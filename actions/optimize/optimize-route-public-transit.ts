"use server";

import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { generatePublicTransitRoute } from "@/lib/algorithms/public-transit";
import type {
  OptimizeResult,
  OptimizeStatistics,
  OptimizeError,
} from "@/types/optimize";
import type { DailyItinerary, ScheduleItem } from "@/types/schedule";
import type { Place } from "@/types/place";
import type { Trip } from "@/types/trip";
import type { OptimizeNode } from "@/lib/optimize/types";
import type { FixedSchedule } from "@/types/schedule";
import type { TripInput, TripOutput, DayPlan, SegmentCost, Waypoint } from "@/types/route";
import type { SimpleOptimizeRequestInput } from "@/lib/schemas";
import {
  getDaysBetween,
  generateDateRange,
  timeToMinutes,
  minutesToTime,
  addMinutesToTime,
} from "@/lib/optimize";

// ============================================
// Types
// ============================================

export interface OptimizePublicTransitParams {
  tripId: string;
  trip: Trip;
  places: Place[];
  placeNodes: OptimizeNode[];
  fixedSchedules: FixedSchedule[];
  userOptions?: SimpleOptimizeRequestInput["options"];
  errors: OptimizeError[];
  startTime: number;
}

export interface OptimizeRouteResult {
  success: boolean;
  data?: OptimizeResult;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Place를 Waypoint로 변환
 */
function placeToWaypoint(place: Place, fixedSchedules: FixedSchedule[]): Waypoint {
  const fixedSchedule = fixedSchedules.find((s) => s.placeId === place.id);

  return {
    id: place.id,
    name: place.name,
    coord: {
      lat: place.coordinate.lat,
      lng: place.coordinate.lng,
    },
    stayMinutes: place.estimatedDuration,
    importance: place.priority || 3,
    isFixed: !!fixedSchedule,
    fixedDate: fixedSchedule?.date,
    fixedStartTime: fixedSchedule?.startTime,
  };
}

/**
 * TripOutput을 OptimizeResult로 변환
 */
function convertTripOutputToOptimizeResult(
  output: TripOutput,
  trip: Trip,
  places: Place[],
  errors: OptimizeError[],
  startTime: number
): OptimizeResult {
  const totalDays = getDaysBetween(trip.startDate, trip.endDate);
  const dates = generateDateRange(trip.startDate, totalDays);

  // Place ID로 매핑
  const placeMap = new Map(places.map((p) => [p.id, p]));

  // SegmentCost를 key로 매핑
  const segmentMap = new Map(
    output.segmentCosts.map((s) => [`${s.key.fromId}:${s.key.toId}`, s])
  );

  // DailyItinerary 생성
  const itinerary: DailyItinerary[] = [];

  for (let dayIndex = 0; dayIndex < output.dayPlans.length; dayIndex++) {
    const dayPlan = output.dayPlans[dayIndex];
    const date = dates[dayIndex];
    const schedule: ScheduleItem[] = [];

    let totalDistance = 0;
    let totalDuration = 0;
    let totalStayDuration = 0;
    let currentTime = timeToMinutes(trip.dailyStartTime);

    // 출발지 정보 (첫날은 trip.origin, 이후는 숙소 또는 전날 마지막 장소)
    let dayOrigin: DailyItinerary["dayOrigin"];
    if (dayIndex === 0) {
      dayOrigin = {
        name: trip.origin.name,
        address: trip.origin.address,
        lat: trip.origin.lat,
        lng: trip.origin.lng,
        type: "origin",
      };
    } else if (trip.accommodations && trip.accommodations.length > 0) {
      const accom = trip.accommodations[0]; // 단일 숙소 가정
      dayOrigin = {
        name: accom.location.name,
        address: accom.location.address,
        lat: accom.location.lat,
        lng: accom.location.lng,
        type: "accommodation",
      };
    }

    // 도착지 정보 (마지막 날은 trip.destination, 중간은 숙소)
    let dayDestination: DailyItinerary["dayDestination"];
    if (dayIndex === output.dayPlans.length - 1) {
      if (trip.destination) {
        dayDestination = {
          name: trip.destination.name,
          address: trip.destination.address,
          lat: trip.destination.lat,
          lng: trip.destination.lng,
          type: "destination",
        };
      }
    } else if (trip.accommodations && trip.accommodations.length > 0) {
      const accom = trip.accommodations[0];
      dayDestination = {
        name: accom.location.name,
        address: accom.location.address,
        lat: accom.location.lat,
        lng: accom.location.lng,
        type: "accommodation",
      };
    }

    // 출발지 → 첫 장소 이동 정보
    let transportFromOrigin: DailyItinerary["transportFromOrigin"];
    if (dayPlan.waypointOrder.length > 0) {
      const firstPlaceId = dayPlan.waypointOrder[0];
      const originId = dayIndex === 0 ? "__origin__" : "__accommodation_0__";
      const segmentKey = `${originId}:${firstPlaceId}`;
      const segment = segmentMap.get(segmentKey);

      if (segment) {
        transportFromOrigin = {
          mode: segment.transitDetails?.transportMode === "subway" ? "public" :
                segment.transitDetails?.transportMode === "bus" ? "public" :
                segment.transitDetails?.transportMode === "walking" ? "walking" : "public",
          distance: segment.distanceMeters || 0,
          duration: segment.durationMinutes,
          polyline: typeof segment.polyline === "string" ? segment.polyline : undefined,
          transitDetails: segment.transitDetails ? {
            totalFare: 0, // segmentCost에는 요금 정보 없음
            transferCount: segment.transfers || 0,
            walkingTime: segment.transitDetails.transportMode === "walking" ? segment.durationMinutes : 0,
            walkingDistance: segment.transitDetails.transportMode === "walking" ? (segment.distanceMeters || 0) : 0,
            subPaths: [], // 상세 subPath 정보는 segmentCost에 없음
          } : undefined,
        };
        currentTime += segment.durationMinutes;
        totalDistance += segment.distanceMeters || 0;
        totalDuration += segment.durationMinutes;
      }
    }

    // 각 장소 방문
    for (let i = 0; i < dayPlan.waypointOrder.length; i++) {
      const placeId = dayPlan.waypointOrder[i];
      const place = placeMap.get(placeId);

      if (!place) continue;

      const arrivalTime = minutesToTime(currentTime);
      const departureTime = addMinutesToTime(arrivalTime, place.estimatedDuration);

      totalStayDuration += place.estimatedDuration;

      // 다음 장소까지 이동 정보
      let transportToNext: ScheduleItem["transportToNext"];
      if (i < dayPlan.waypointOrder.length - 1) {
        const nextPlaceId = dayPlan.waypointOrder[i + 1];
        const segmentKey = `${placeId}:${nextPlaceId}`;
        const segment = segmentMap.get(segmentKey);

        if (segment) {
          transportToNext = {
            mode: segment.transitDetails?.transportMode === "subway" ? "public" :
                  segment.transitDetails?.transportMode === "bus" ? "public" :
                  segment.transitDetails?.transportMode === "walking" ? "walking" : "public",
            distance: segment.distanceMeters || 0,
            duration: segment.durationMinutes,
            polyline: typeof segment.polyline === "string" ? segment.polyline : undefined,
            transitDetails: segment.transitDetails ? {
              totalFare: 0,
              transferCount: segment.transfers || 0,
              walkingTime: segment.transitDetails.transportMode === "walking" ? segment.durationMinutes : 0,
              walkingDistance: segment.transitDetails.transportMode === "walking" ? (segment.distanceMeters || 0) : 0,
              subPaths: [],
            } : undefined,
          };
          currentTime = timeToMinutes(departureTime) + segment.durationMinutes;
          totalDistance += segment.distanceMeters || 0;
          totalDuration += segment.durationMinutes;
        }
      }

      schedule.push({
        order: i + 1,
        placeId: place.id,
        placeName: place.name,
        arrivalTime,
        departureTime,
        duration: place.estimatedDuration,
        isFixed: false, // TODO: fixedSchedule 확인
        transportToNext,
      });
    }

    // 마지막 장소 → 도착지/숙소 이동 정보
    let transportToDestination: DailyItinerary["transportToDestination"];
    if (dayPlan.waypointOrder.length > 0 && dayDestination) {
      const lastPlaceId = dayPlan.waypointOrder[dayPlan.waypointOrder.length - 1];
      const destinationId = dayIndex === output.dayPlans.length - 1 ? "__destination__" : "__accommodation_0__";
      const segmentKey = `${lastPlaceId}:${destinationId}`;
      const segment = segmentMap.get(segmentKey);

      if (segment) {
        transportToDestination = {
          mode: segment.transitDetails?.transportMode === "subway" ? "public" :
                segment.transitDetails?.transportMode === "bus" ? "public" :
                segment.transitDetails?.transportMode === "walking" ? "walking" : "public",
          distance: segment.distanceMeters || 0,
          duration: segment.durationMinutes,
          polyline: typeof segment.polyline === "string" ? segment.polyline : undefined,
          transitDetails: segment.transitDetails ? {
            totalFare: 0,
            transferCount: segment.transfers || 0,
            walkingTime: segment.transitDetails.transportMode === "walking" ? segment.durationMinutes : 0,
            walkingDistance: segment.transitDetails.transportMode === "walking" ? (segment.distanceMeters || 0) : 0,
            subPaths: [],
          } : undefined,
        };
        totalDistance += segment.distanceMeters || 0;
        totalDuration += segment.durationMinutes;
      }
    }

    const startTime = schedule[0]?.arrivalTime ?? trip.dailyStartTime;
    const endTime = schedule[schedule.length - 1]?.departureTime ?? trip.dailyStartTime;

    itinerary.push({
      dayNumber: dayIndex + 1,
      date,
      schedule,
      totalDistance,
      totalDuration,
      totalStayDuration,
      placeCount: schedule.length,
      startTime,
      endTime,
      transportFromOrigin,
      transportToDestination,
      dailyStartTime: trip.dailyStartTime,
      dailyEndTime: trip.dailyEndTime,
      dayOrigin,
      dayDestination,
    });
  }

  // 통계 계산
  const statistics: OptimizeStatistics = {
    totalPlaces: places.length,
    totalDays,
    totalDistance: itinerary.reduce((sum, day) => sum + day.totalDistance, 0) / 1000, // km
    totalDuration: itinerary.reduce((sum, day) => sum + day.totalDuration, 0),
    totalStayDuration: itinerary.reduce((sum, day) => sum + day.totalStayDuration, 0),
    averageDailyDistance:
      itinerary.reduce((sum, day) => sum + day.totalDistance, 0) / 1000 / totalDays,
    averageDailyPlaces:
      itinerary.reduce((sum, day) => sum + day.placeCount, 0) / totalDays,
    optimizationTimeMs: Date.now() - startTime,
    improvementPercentage: 0, // 대중교통 알고리즘은 improvement% 계산하지 않음
  };

  return {
    success: true,
    tripId: trip.id,
    itinerary,
    statistics,
    errors: errors.length > 0 ? errors : undefined,
    completedAt: new Date().toISOString(),
  };
}

// ============================================
// Main Function
// ============================================

/**
 * 대중교통 모드 최적화 (신규 알고리즘)
 */
export async function optimizePublicTransitRoute(
  params: OptimizePublicTransitParams
): Promise<OptimizeRouteResult> {
  const {
    tripId,
    trip,
    places,
    placeNodes,
    fixedSchedules,
    userOptions,
    errors,
    startTime,
  } = params;

  try {
    const supabase = createClerkSupabaseClient();

    // TripInput 변환 (신규 알고리즘 호환)
    const tripInput: TripInput = {
      tripId,
      days: getDaysBetween(trip.startDate, trip.endDate),
      start: {
        lat: trip.origin.lat,
        lng: trip.origin.lng,
      },
      end: trip.destination
        ? {
            lat: trip.destination.lat,
            lng: trip.destination.lng,
          }
        : undefined,
      lodging: trip.accommodations?.[0]
        ? {
            lat: trip.accommodations[0].location.lat,
            lng: trip.accommodations[0].location.lng,
          }
        : undefined,
      waypoints: places.map((place) => placeToWaypoint(place, fixedSchedules)),
      dailyMaxMinutes: userOptions?.maxDailyMinutes,
    };

    console.log("[OptimizePublicTransit] Calling generatePublicTransitRoute with:", {
      tripId,
      days: tripInput.days,
      waypointsCount: tripInput.waypoints.length,
    });

    // 신규 알고리즘 실행
    const publicTransitOutput = await generatePublicTransitRoute(tripInput);

    console.log("[OptimizePublicTransit] Result:", {
      dayPlansCount: publicTransitOutput.dayPlans.length,
      segmentsCount: publicTransitOutput.segmentCosts.length,
    });

    // TripOutput → OptimizeResult 변환
    const optimizeResult = convertTripOutputToOptimizeResult(
      publicTransitOutput,
      trip,
      places,
      errors,
      startTime
    );

    // 여행 상태 업데이트
    await supabase
      .from("trips")
      .update({ status: "optimized" })
      .eq("id", tripId);

    // 캐시 무효화
    revalidatePath("/my");
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/plan/${tripId}/result`);

    return {
      success: true,
      data: optimizeResult,
    };
  } catch (error) {
    console.error("[OptimizePublicTransit] 예외 발생:", error);
    return {
      success: false,
      error: {
        code: "UNKNOWN",
        message: "대중교통 경로 최적화 중 오류가 발생했습니다.",
      },
    };
  }
}
