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
import type {
  TripInput,
  TripOutput,
  DayPlan,
  SegmentCost,
  Waypoint,
  LatLng,
} from "@/types/route";
import type { SimpleOptimizeRequestInput } from "@/lib/schemas";
import {
  getDaysBetween,
  generateDateRange,
  timeToMinutes,
  minutesToTime,
  addMinutesToTime,
  generateDailyTimeConfigs,
  DEFAULT_MIDDLE_DAY_START_TIME,
  DEFAULT_MIDDLE_DAY_END_TIME,
} from "@/lib/optimize";
import type { DailyTimeConfig } from "@/lib/optimize/types";
import { calculateDistance } from "@/lib/algorithms/utils/geo";

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
function placeToWaypoint(
  place: Place,
  fixedSchedules: FixedSchedule[],
): Waypoint {
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

type TripLocationLike = Trip["origin"] & {
  coordinate?: { lat: number; lng: number };
};

function resolveLatLng(location?: TripLocationLike | null): LatLng | undefined {
  if (!location) return undefined;
  if (Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
    return { lat: location.lat, lng: location.lng };
  }
  const coord = location.coordinate;
  if (coord && Number.isFinite(coord.lat) && Number.isFinite(coord.lng)) {
    return { lat: coord.lat, lng: coord.lng };
  }
  return undefined;
}

/**
 * TripOutput을 OptimizeResult로 변환
 */
function convertTripOutputToOptimizeResult(
  output: TripOutput,
  trip: Trip,
  places: Place[],
  fixedSchedules: FixedSchedule[],
  errors: OptimizeError[],
  startTime: number,
  dailyTimeConfigs: DailyTimeConfig[],
): OptimizeResult {
  const totalDays = getDaysBetween(trip.startDate, trip.endDate);
  const dates = generateDateRange(trip.startDate, totalDays);
  const originCoord = resolveLatLng(trip.origin);
  const destinationCoord = resolveLatLng(trip.destination);

  // Place ID로 매핑
  const placeMap = new Map(places.map((p) => [p.id, p]));

  // 고정 일정 매핑 (placeId -> FixedSchedule)
  const fixedScheduleMap = new Map(
    fixedSchedules.map((fs) => [fs.placeId, fs]),
  );

  // 제외된 장소 수집 (excludedWaypointIds)
  const allExcludedIds = output.dayPlans.flatMap(
    (dayPlan) => dayPlan.excludedWaypointIds || [],
  );
  const uniqueExcludedIds = [...new Set(allExcludedIds)];

  if (uniqueExcludedIds.length > 0) {
    const unassignedPlaceDetails = uniqueExcludedIds.map((placeId) => {
      const place = placeMap.get(placeId);
      return {
        placeId,
        placeName: place?.name || placeId,
        reasonCode: "TIME_EXCEEDED" as const,
        reasonMessage: "일일 활동 시간이 부족하여 일정에 포함하지 못했습니다.",
        details: {
          estimatedDuration: place?.estimatedDuration,
        },
      };
    });

    errors.push({
      code: "EXCEEDS_DAILY_LIMIT",
      message: `${uniqueExcludedIds.length}개 장소가 일정에 포함되지 못했습니다.`,
      details: {
        unassignedPlaces: uniqueExcludedIds,
        unassignedPlaceDetails,
      },
    });
  }

  // SegmentCost를 key로 매핑
  const segmentMap = new Map(
    output.segmentCosts.map((s) => [`${s.key.fromId}:${s.key.toId}`, s]),
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

    // 일자별 시간 설정 적용
    const dayTimeConfig = dailyTimeConfigs[dayIndex];
    const dayStartTime = dayTimeConfig ? minutesToTime(dayTimeConfig.startMinute) : trip.dailyStartTime;
    const dayEndTime = dayTimeConfig ? minutesToTime(dayTimeConfig.endMinute) : trip.dailyEndTime;
    let currentTime = dayTimeConfig?.startMinute ?? timeToMinutes(trip.dailyStartTime);

    // 출발지 정보 (첫날은 trip.origin, 숙소 있으면 숙소, 없으면 표시 안 함)
    let dayOrigin: DailyItinerary["dayOrigin"];
    if (dayIndex === 0 && originCoord) {
      dayOrigin = {
        name: trip.origin.name,
        address: trip.origin.address,
        lat: originCoord.lat,
        lng: originCoord.lng,
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
    } else {
      // 숙소가 없으면 전날 마지막 장소 사용
      const prevDayPlan = output.dayPlans[dayIndex - 1];
      if (prevDayPlan && prevDayPlan.waypointOrder.length > 0) {
        const lastPlaceId =
          prevDayPlan.waypointOrder[prevDayPlan.waypointOrder.length - 1];
        const lastPlace = placeMap.get(lastPlaceId);
        if (lastPlace) {
          dayOrigin = {
            name: lastPlace.name,
            address: lastPlace.address,
            lat: lastPlace.coordinate.lat,
            lng: lastPlace.coordinate.lng,
            type: "lastPlace",
          };
        }
      }
    }
    // 숙소가 없으면 dayOrigin을 설정하지 않음 (2일차부터는 출발지 표시 없이 경유지부터 시작)

    // 도착지 정보 (숙소가 있으면 모든 날 숙소, 없으면 마지막 날만 도착지)
    let dayDestination: DailyItinerary["dayDestination"];
    const hasAccommodation =
      trip.accommodations && trip.accommodations.length > 0;
    const isLastDay = dayIndex === output.dayPlans.length - 1;

    if (hasAccommodation) {
      // 숙소가 있으면 모든 날의 종점은 숙소
      const accom = trip.accommodations[0];
      dayDestination = {
        name: accom.location.name,
        address: accom.location.address,
        lat: accom.location.lat,
        lng: accom.location.lng,
        type: "accommodation",
      };
    } else if (isLastDay && trip.destination && destinationCoord) {
      // 숙소가 없고 마지막 날이면 최종 도착지 표시
      // (출발지와의 거리 체크는 하지 않음 - 사용자가 설정한 도착지 존중)
      dayDestination = {
        name: trip.destination.name,
        address: trip.destination.address,
        lat: destinationCoord.lat,
        lng: destinationCoord.lng,
        type: "destination",
      };
    }
    // 숙소가 없고 마지막 날이 아니면 dayDestination은 undefined (다음 날 이어짐)

    // 출발지 → 첫 장소 이동 정보
    // dayOrigin이 있는 경우에만 transportFromOrigin 생성
    let transportFromOrigin: DailyItinerary["transportFromOrigin"];
    if (dayOrigin && dayPlan.waypointOrder.length > 0) {
      const firstPlaceId = dayPlan.waypointOrder[0];

      // originId 결정: 첫날은 __origin__, 숙소 있으면 __accommodation_0__, 없으면 전날 마지막 장소 ID
      let originId: string;
      if (dayIndex === 0) {
        originId = "__origin__";
      } else if (hasAccommodation) {
        originId = "__accommodation_0__";
      } else {
        const prevDayPlan = output.dayPlans[dayIndex - 1];
        originId =
          prevDayPlan && prevDayPlan.waypointOrder.length > 0
            ? prevDayPlan.waypointOrder[prevDayPlan.waypointOrder.length - 1]
            : "__origin__";
      }

      const segmentKey = `${originId}:${firstPlaceId}`;
      const segment = segmentMap.get(segmentKey);

      if (segment) {
        // transitDetails가 있으면 대중교통, 없으면 도보로 간주
        const isWalking =
          !segment.transitDetails ||
          (segment.transitDetails.subPaths.length === 1 &&
            segment.transitDetails.subPaths[0].trafficType === 3);

        transportFromOrigin = {
          mode: isWalking ? "walking" : "public",
          distance: segment.distanceMeters || 0,
          duration: segment.durationMinutes,
          polyline:
            typeof segment.polyline === "string" ? segment.polyline : undefined,
          transitDetails: segment.transitDetails,
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
      const departureTime = addMinutesToTime(
        arrivalTime,
        place.estimatedDuration,
      );

      totalStayDuration += place.estimatedDuration;

      // 다음 장소까지 이동 정보
      let transportToNext: ScheduleItem["transportToNext"];
      if (i < dayPlan.waypointOrder.length - 1) {
        const nextPlaceId = dayPlan.waypointOrder[i + 1];
        const segmentKey = `${placeId}:${nextPlaceId}`;
        const segment = segmentMap.get(segmentKey);

        if (segment) {
          // transitDetails가 있으면 대중교통, 없으면 도보로 간주
          const isWalking =
            !segment.transitDetails ||
            (segment.transitDetails.subPaths.length === 1 &&
              segment.transitDetails.subPaths[0].trafficType === 3);

          transportToNext = {
            mode: isWalking ? "walking" : "public",
            distance: segment.distanceMeters || 0,
            duration: segment.durationMinutes,
            polyline:
              typeof segment.polyline === "string"
                ? segment.polyline
                : undefined,
            transitDetails: segment.transitDetails,
          };
          currentTime = timeToMinutes(departureTime) + segment.durationMinutes;
          totalDistance += segment.distanceMeters || 0;
          totalDuration += segment.durationMinutes;
        }
      }

      // 고정 일정 확인
      const fixedSchedule = fixedScheduleMap.get(place.id);
      const isFixed = !!fixedSchedule;

      schedule.push({
        order: i + 1,
        placeId: place.id,
        placeName: place.name,
        arrivalTime,
        departureTime,
        duration: place.estimatedDuration,
        isFixed,
        transportToNext,
      });
    }

    let transportToDestination: DailyItinerary["transportToDestination"];
    if (dayPlan.waypointOrder.length > 0 && dayDestination) {
      const lastPlaceId =
        dayPlan.waypointOrder[dayPlan.waypointOrder.length - 1];

      // destinationId 결정: 마지막 날은 항상 __destination__, 그 외는 숙소 있으면 __accommodation_0__
      const destinationId = isLastDay
        ? "__destination__"
        : hasAccommodation
          ? "__accommodation_0__"
          : "__destination__";
      const segmentKey = `${lastPlaceId}:${destinationId}`;
      const segment = segmentMap.get(segmentKey);

      if (!segment) {
        console.warn(
          `[convertTripOutputToOptimizeResult] Day ${dayIndex + 1}: Segment not found for key "${segmentKey}"`,
          {
            lastPlaceId,
            destinationId,
            isLastDay,
            hasAccommodation,
            availableKeys: Array.from(segmentMap.keys())
              .filter(
                (k) => k.includes(lastPlaceId) || k.includes(destinationId),
              )
              .slice(0, 10),
          },
        );
      }

      if (segment) {
        // transitDetails가 있으면 대중교통, 없으면 도보로 간주
        const isWalking =
          !segment.transitDetails ||
          (segment.transitDetails.subPaths.length === 1 &&
            segment.transitDetails.subPaths[0].trafficType === 3);

        transportToDestination = {
          mode: isWalking ? "walking" : "public",
          distance: segment.distanceMeters || 0,
          duration: segment.durationMinutes,
          polyline:
            typeof segment.polyline === "string" ? segment.polyline : undefined,
          transitDetails: segment.transitDetails,
        };
        totalDistance += segment.distanceMeters || 0;
        totalDuration += segment.durationMinutes;
      }
    }

    // startTime: 출발지 출발 시간 (일자별 시작 시간)
    const startTimeValue = dayStartTime;

    // endTime: 마지막 장소 출발 시간 + 도착지까지 이동 시간
    let endTimeValue =
      schedule[schedule.length - 1]?.departureTime ?? dayStartTime;
    if (transportToDestination) {
      endTimeValue = addMinutesToTime(endTimeValue, transportToDestination.duration);
    }

    itinerary.push({
      dayNumber: dayIndex + 1,
      date,
      schedule,
      totalDistance,
      totalDuration,
      totalStayDuration,
      placeCount: schedule.length,
      startTime: startTimeValue,
      endTime: endTimeValue,
      transportFromOrigin,
      transportToDestination,
      dailyStartTime: dayStartTime,
      dailyEndTime: dayEndTime,
      dayOrigin,
      dayDestination,
    });
  }

  // 통계 계산
  const statistics: OptimizeStatistics = {
    totalPlaces: places.length,
    totalDays,
    totalDistance:
      itinerary.reduce((sum, day) => sum + day.totalDistance, 0) / 1000, // km
    totalDuration: itinerary.reduce((sum, day) => sum + day.totalDuration, 0),
    totalStayDuration: itinerary.reduce(
      (sum, day) => sum + day.totalStayDuration,
      0,
    ),
    averageDailyDistance:
      itinerary.reduce((sum, day) => sum + day.totalDistance, 0) /
      1000 /
      totalDays,
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
  params: OptimizePublicTransitParams,
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
    const originCoord = resolveLatLng(trip.origin);
    if (!originCoord) {
      throw new Error("Invalid trip origin coordinates");
    }
    const destinationCoord = resolveLatLng(trip.destination);
    const lodgingCoord = trip.accommodations?.[0]
      ? resolveLatLng(trip.accommodations[0].location)
      : undefined;

    const totalDays = getDaysBetween(trip.startDate, trip.endDate);

    // 일자별 시간 제약 생성
    // - 1일차: 여행 시작 시간 ~ 20:00
    // - 중간 일차: 10:00 ~ 20:00
    // - 마지막 일차: 10:00 ~ 여행 종료 시간
    const dailyTimeConfigs: DailyTimeConfig[] = generateDailyTimeConfigs({
      totalDays,
      startDate: trip.startDate,
      firstDayStartTime: trip.dailyStartTime,
      lastDayEndTime: trip.dailyEndTime,
      middleDayStartTime: DEFAULT_MIDDLE_DAY_START_TIME,
      middleDayEndTime: DEFAULT_MIDDLE_DAY_END_TIME,
    });

    // TripInput용 일자별 시간 제약 변환
    const dailyTimeLimits = dailyTimeConfigs.map((config, index) => ({
      dayNumber: index + 1,
      maxMinutes: config.maxMinutes,
      startTime: minutesToTime(config.startMinute),
      endTime: minutesToTime(config.endMinute),
    }));

    // TripInput 변환 (신규 알고리즘 호환)
    const tripInput: TripInput = {
      tripId,
      days: totalDays,
      start: originCoord,
      end: destinationCoord,
      lodging: lodgingCoord,
      tripStartDate: trip.startDate,
      waypoints: places.map((place) => placeToWaypoint(place, fixedSchedules)),
      dailyTimeLimits,
    };

    console.log(
      "[OptimizePublicTransit] Calling generatePublicTransitRoute with:",
      {
        tripId,
        days: tripInput.days,
        waypointsCount: tripInput.waypoints.length,
        dailyTimeLimits: dailyTimeLimits.map((l) => `Day${l.dayNumber}: ${l.startTime}-${l.endTime} (${l.maxMinutes}min)`),
      },
    );

    // 신규 알고리즘 실행
    const publicTransitOutput = await generatePublicTransitRoute(tripInput);

    // TripOutput → OptimizeResult 변환
    const optimizeResult = convertTripOutputToOptimizeResult(
      publicTransitOutput,
      trip,
      places,
      fixedSchedules,
      errors,
      startTime,
      dailyTimeConfigs,
    );

    // 여행 상태 업데이트
    await supabase
      .from("trips")
      .update({ status: "optimized" })
      .eq("id", tripId);

    // 캐시 무효화
    revalidatePath("/my");
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/my/trips/${tripId}`);

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
