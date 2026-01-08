"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import {
  simpleOptimizeRequestSchema,
  type SimpleOptimizeRequestInput,
} from "@/lib/schemas";
import type {
  OptimizeResult,
  OptimizeStatistics,
  OptimizeError,
  DistanceMatrix,
} from "@/types/optimize";
import type { DailyItinerary, ScheduleItem, FixedSchedule, DayEndpoint } from "@/types/schedule";
import type { Place, TripPlaceRow } from "@/types/place";
import type { Trip, TripRow, TripLocation } from "@/types/trip";
import type { DailyAccommodation } from "@/types/accommodation";
import type { TransportMode } from "@/types/route";
import type { OptimizeNode } from "@/lib/optimize/types";
import {
  createDistanceMatrix,
  nearestNeighborWithEndpoints,
  twoOptWithEndpoints,
  distributeToDaily,
  validateFixedSchedules,
  fixedScheduleToNode,
  timeToMinutes,
  minutesToTime,
  addMinutesToTime,
  getDaysBetween,
  generateDateRange,
  createDistanceMatrixGetter,
} from "@/lib/optimize";
import { optimizePublicTransitRoute } from "./optimize-route-public-transit";

// ============================================
// Types
// ============================================

/**
 * 최적화 실행 결과
 */
export interface OptimizeRouteResult {
  success: boolean;
  data?: OptimizeResult;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 최적화 진행 단계
 */
type OptimizeStage =
  | "validating"
  | "calculating_matrix"
  | "initial_route"
  | "improving"
  | "distributing"
  | "fetching_routes"
  | "saving"
  | "completed";

// ============================================
// Helper Functions
// ============================================

/**
 * TripRow를 Trip으로 변환
 */
function convertRowToTrip(row: TripRow): Trip {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    origin: row.origin,
    destination: row.destination,
    dailyStartTime: row.daily_start_time,
    dailyEndTime: row.daily_end_time,
    transportModes: row.transport_mode,
    status: row.status,
    accommodations: row.accommodations ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * TripPlaceRow를 Place로 변환
 */
function convertRowToPlace(row: TripPlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    coordinate: {
      lat: row.lat,
      lng: row.lng,
    },
    category: row.category ?? undefined,
    kakaoPlaceId: row.kakao_place_id ?? undefined,
    estimatedDuration: row.estimated_duration,
    priority: row.priority ?? undefined,
  };
}

/**
 * Place를 OptimizeNode로 변환
 */
function placeToOptimizeNode(place: Place, priority: number): OptimizeNode {
  return {
    id: place.id,
    name: place.name,
    coordinate: place.coordinate,
    duration: place.estimatedDuration,
    priority: place.priority ?? priority,
    isFixed: false,
  };
}

/**
 * TripLocation을 OptimizeNode로 변환
 */
function locationToOptimizeNode(
  location: TripLocation,
  id: string
): OptimizeNode {
  return {
    id,
    name: location.name,
    coordinate: {
      lat: location.lat,
      lng: location.lng,
    },
    duration: 0,
    priority: 0,
    isFixed: false,
  };
}

/**
 * 숙소를 OptimizeNode로 변환
 */
function accommodationToOptimizeNode(
  accom: DailyAccommodation,
  index: number
): OptimizeNode {
  return {
    id: `__accommodation_${index}__`,
    name: accom.location.name,
    coordinate: {
      lat: accom.location.lat,
      lng: accom.location.lng,
    },
    duration: 0,
    priority: 0,
    isFixed: false,
  };
}

/**
 * 이동수단 결정 (여행 설정 기준)
 */
function getPrimaryTransportMode(modes: TransportMode[]): TransportMode {
  // 자동차가 포함되어 있으면 자동차 우선
  if (modes.includes("car")) {
    return "car";
  }
  // 대중교통이 포함되어 있으면 대중교통
  if (modes.includes("public")) {
    return "public";
  }
  // 그 외에는 도보
  return "walking";
}

/**
 * 일자별 분배 결과를 DailyItinerary로 변환
 * @param skipTransportToDestination - true면 도착지까지 이동 정보 생략 (숙소 없는 날)
 * @param dayOrigin - 이 날의 시작점 정보 (출발지 또는 전날 숙소)
 * @param dayDestination - 이 날의 끝점 정보 (도착지, 숙소, 또는 undefined)
 */
async function createDailyItinerary(
  dayPlaceIds: string[],
  nodeMap: Map<string, OptimizeNode>,
  distanceMatrix: DistanceMatrix,
  date: string,
  dayNumber: number,
  dailyStartTime: string,
  dailyEndTime: string,
  transportMode: TransportMode,
  originId: string,
  destinationId: string,
  skipTransportToDestination: boolean = false,
  dayOrigin?: DayEndpoint,
  dayDestination?: DayEndpoint
): Promise<DailyItinerary> {
  const schedule: ScheduleItem[] = [];
  const getDistance = createDistanceMatrixGetter(distanceMatrix);

  let totalDistance = 0;
  let totalDuration = 0;
  let totalStayDuration = 0;

  // 출발지에서 첫 장소까지 이동 정보 계산
  let transportFromOrigin: DailyItinerary["transportFromOrigin"];
  let currentTime = timeToMinutes(dailyStartTime);

  if (dayPlaceIds.length > 0) {
    const firstPlaceId = dayPlaceIds[0];
    const entry = getDistance(originId, firstPlaceId);
    if (entry) {
      transportFromOrigin = {
        mode: entry.mode,
        distance: entry.distance,
        duration: entry.duration,
        polyline: entry.polyline,
        transitDetails: entry.transitDetails,
      };
      // 첫 장소 도착 시간 = 출발 시간 + 이동 시간
      currentTime = timeToMinutes(dailyStartTime) + entry.duration;
      totalDistance += entry.distance;
      totalDuration += entry.duration;
    }
  }

  for (let i = 0; i < dayPlaceIds.length; i++) {
    const placeId = dayPlaceIds[i];
    const node = nodeMap.get(placeId);

    if (!node) continue;

    // 고정 일정인 경우 해당 시간으로 조정
    if (node.isFixed && node.fixedStartTime) {
      currentTime = timeToMinutes(node.fixedStartTime);
    }

    const arrivalTime = minutesToTime(currentTime);
    const departureTime = addMinutesToTime(arrivalTime, node.duration);

    // 다음 장소까지 이동 정보 계산
    let transportToNext: ScheduleItem["transportToNext"];

    if (i < dayPlaceIds.length - 1) {
      const nextPlaceId = dayPlaceIds[i + 1];
      const entry = getDistance(placeId, nextPlaceId);

      if (entry) {
        transportToNext = {
          mode: entry.mode,
          distance: entry.distance,
          duration: entry.duration,
          polyline: entry.polyline,
          transitDetails: entry.transitDetails,
        };

        totalDistance += entry.distance;
        totalDuration += entry.duration;
        currentTime = timeToMinutes(departureTime) + entry.duration;
      }
    }

    totalStayDuration += node.duration;

    schedule.push({
      order: i + 1,
      placeId: node.id,
      placeName: node.name,
      arrivalTime,
      departureTime,
      duration: node.duration,
      isFixed: node.isFixed,
      transportToNext,
    });
  }

  // 마지막 장소에서 도착지까지 이동 정보 계산 (숙소 없는 날은 생략)
  let transportToDestination: DailyItinerary["transportToDestination"];
  if (dayPlaceIds.length > 0 && !skipTransportToDestination) {
    const lastPlaceId = dayPlaceIds[dayPlaceIds.length - 1];
    const entry = getDistance(lastPlaceId, destinationId);
    if (entry) {
      transportToDestination = {
        mode: entry.mode,
        distance: entry.distance,
        duration: entry.duration,
        polyline: entry.polyline,
        transitDetails: entry.transitDetails,
      };
      totalDistance += entry.distance;
      totalDuration += entry.duration;
    }
  }

  const startTime = schedule[0]?.arrivalTime ?? dailyStartTime;
  const endTime = schedule[schedule.length - 1]?.departureTime ?? dailyStartTime;

  return {
    dayNumber,
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
    dailyStartTime,
    dailyEndTime,
    dayOrigin,
    dayDestination,
  };
}

// ============================================
// Main Server Action
// ============================================

/**
 * 경로 최적화 실행 Server Action
 *
 * 1. 거리 행렬 계산
 * 2. Nearest Neighbor 초기 경로 생성
 * 3. 고정 일정 반영
 * 4. 일자별 분배
 * 5. 구간 이동 정보 조회
 *
 * @param input - 최적화 요청 (tripId 필수)
 * @returns 최적화 결과
 *
 * @example
 * ```tsx
 * const result = await optimizeRoute({ tripId: "..." });
 * if (result.success) {
 *   console.log(result.data.itinerary); // DailyItinerary[]
 * }
 * ```
 */
export async function optimizeRoute(
  input: SimpleOptimizeRequestInput
): Promise<OptimizeRouteResult> {
  const startTime = Date.now();
  const errors: OptimizeError[] = [];

  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "로그인이 필요합니다.",
        },
      };
    }

    // 2. 입력 검증
    const validationResult = simpleOptimizeRequestSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: errorMessage,
        },
      };
    }

    const { tripId, options: userOptions } = validationResult.data;

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 여행 및 관련 데이터 조회
    const [tripResult, placesResult, schedulesResult] = await Promise.all([
      supabase.from("trips").select("*").eq("id", tripId).single(),
      supabase
        .from("trip_places")
        .select("*")
        .eq("trip_id", tripId)
        .order("priority", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("trip_fixed_schedules")
        .select("*")
        .eq("trip_id", tripId)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true }),
    ]);

    if (tripResult.error || !tripResult.data) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "여행을 찾을 수 없습니다.",
        },
      };
    }

    const trip = convertRowToTrip(tripResult.data as TripRow);
    const places = (placesResult.data ?? []).map((row) =>
      convertRowToPlace(row as TripPlaceRow)
    );

    // 고정 일정 변환
    const fixedSchedules: FixedSchedule[] = (schedulesResult.data ?? []).map(
      (row) => ({
        id: row.id,
        placeId: row.place_id ?? "",
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        note: row.note ?? undefined,
      })
    );

    // 5. 최소 장소 수 확인
    if (places.length < 2) {
      return {
        success: false,
        error: {
          code: "INSUFFICIENT_PLACES",
          message: "최소 2개 이상의 장소가 필요합니다.",
        },
      };
    }

    // 6. 고정 일정 유효성 검증
    const constraintValidation = validateFixedSchedules(fixedSchedules, {
      startDate: trip.startDate,
      endDate: trip.endDate,
      dailyStartTime: trip.dailyStartTime,
      dailyEndTime: trip.dailyEndTime,
    });

    if (!constraintValidation.isValid) {
      return {
        success: false,
        error: {
          code: "FIXED_SCHEDULE_CONFLICT",
          message:
            constraintValidation.conflicts[0]?.message ??
            "고정 일정에 충돌이 있습니다.",
        },
      };
    }

    // 경고 메시지는 errors에 추가
    for (const warning of constraintValidation.warnings) {
      errors.push({
        code: "UNKNOWN",
        message: warning,
      });
    }

    // 7. 노드 맵 생성
    const nodeMap = new Map<string, OptimizeNode>();

    // 출발지/도착지 노드 생성
    const originNode = locationToOptimizeNode(trip.origin, "__origin__");
    const destinationNode = locationToOptimizeNode(
      trip.destination,
      "__destination__"
    );

    nodeMap.set(originNode.id, originNode);
    nodeMap.set(destinationNode.id, destinationNode);

    // 숙소 노드 생성 (연속 일정 지원)
    const accommodationNodes = new Map<string, OptimizeNode>();
    const tripAccommodations = trip.accommodations ?? [];

    for (let i = 0; i < tripAccommodations.length; i++) {
      const accom = tripAccommodations[i];
      const node = accommodationToOptimizeNode(accom, i);
      nodeMap.set(node.id, node);

      // 숙소 기간 내 모든 날짜에 대해 노드 매핑 (startDate부터 endDate 전날까지)
      // 체크아웃은 endDate 아침이므로, endDate 전날까지 숙박
      const start = new Date(accom.startDate);
      const end = new Date(accom.endDate);
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        accommodationNodes.set(dateStr, node);
      }
    }

    // 장소 노드 생성
    const placeNodes: OptimizeNode[] = [];
    for (let i = 0; i < places.length; i++) {
      const place = places[i];

      // 고정 일정인 장소 확인
      const fixedSchedule = fixedSchedules.find(
        (s) => s.placeId === place.id
      );

      let node: OptimizeNode;
      if (fixedSchedule) {
        // 고정 일정이 있는 장소
        node = fixedScheduleToNode(fixedSchedule, {
          id: place.id,
          name: place.name,
          coordinate: place.coordinate,
        });
      } else {
        // 일반 장소
        node = placeToOptimizeNode(place, i + 1);
      }

      nodeMap.set(node.id, node);
      placeNodes.push(node);
    }

    // 8. 이동 수단 결정
    const transportMode = getPrimaryTransportMode(trip.transportModes);

    // 9. 대중교통 모드: 신규 알고리즘 사용
    if (transportMode === "public") {
      return await optimizePublicTransitRoute({
        tripId,
        trip,
        places,
        placeNodes,
        fixedSchedules,
        userOptions,
        errors,
        startTime,
      });
    }

    // 10. 차량 모드: 기존 거리 행렬 방식
    const allAccommodationNodes = Array.from(accommodationNodes.values());
    const allNodes = [
      originNode,
      ...placeNodes,
      ...allAccommodationNodes,
      destinationNode,
    ];

    const distanceMatrix = await createDistanceMatrix(allNodes, {
      mode: transportMode,
      useApi: true, // API 기반 실제 거리 사용
      batchSize: 3,
    });

    // 10. 최적화 설정
    const optimizeConfig = {
      timeWeight: userOptions?.timeWeight ?? 1.0,
      distanceWeight: userOptions?.distanceWeight ?? 0.1,
    };

    // 11. Nearest Neighbor 초기 경로 생성
    const initialResult = nearestNeighborWithEndpoints(
      placeNodes,
      distanceMatrix,
      optimizeConfig,
      originNode.id,
      destinationNode.id
    );

    // 12. 2-opt로 경로 개선
    const improvedResult = twoOptWithEndpoints(
      initialResult.route,
      distanceMatrix,
      optimizeConfig,
      {
        maxIterations: userOptions?.improvementIterations ?? 100,
        noImprovementLimit: 20,
      }
    );

    // 13. 일자별 분배
    const totalDays = getDaysBetween(trip.startDate, trip.endDate);
    const dates = generateDateRange(trip.startDate, totalDays);

    const dailyMaxMinutes =
      userOptions?.maxDailyMinutes ??
      timeToMinutes(trip.dailyEndTime) - timeToMinutes(trip.dailyStartTime);

    const distributionResult = distributeToDaily(
      improvedResult.route,
      nodeMap,
      distanceMatrix,
      {
        startDate: trip.startDate,
        endDate: trip.endDate,
        dailyStartTime: trip.dailyStartTime,
        dailyEndTime: trip.dailyEndTime,
        maxDailyMinutes: dailyMaxMinutes,
        fixedSchedules,
      }
    );

    // 분배되지 못한 장소 경고 (출발지/도착지/숙소 제외)
    const actualUnassignedPlaces = distributionResult.unassignedPlaces.filter(
      (id) =>
        id !== "__origin__" &&
        id !== "__destination__" &&
        !id.startsWith("__accommodation_")
    );

    if (actualUnassignedPlaces.length > 0) {
      // 상세 정보 포함하여 전달
      const unassignedPlaceDetails = actualUnassignedPlaces.map((placeId) => {
        const place = places.find((p) => p.id === placeId);
        const node = nodeMap.get(placeId);
        return {
          placeId,
          placeName: place?.name || placeId,
          reasonCode: "TIME_EXCEEDED" as const,
          reasonMessage: "일일 활동 시간이 부족하여 일정에 포함하지 못했습니다.",
          details: {
            estimatedDuration: place?.estimatedDuration ?? node?.duration,
          },
        };
      });

      errors.push({
        code: "EXCEEDS_DAILY_LIMIT",
        message: `${actualUnassignedPlaces.length}개 장소가 일정에 포함되지 못했습니다.`,
        details: {
          unassignedPlaces: actualUnassignedPlaces,
          unassignedPlaceDetails,
        },
      });
    }

    // 14. DailyItinerary 생성 (일자별 동적 시작/끝점)
    const itinerary: DailyItinerary[] = [];
    const totalDaysCount = distributionResult.days.length;

    for (let i = 0; i < totalDaysCount; i++) {
      const dayPlaceIds = distributionResult.days[i];
      const date = dates[i];
      const isFirstDay = i === 0;
      const isLastDay = i === totalDaysCount - 1;

      // 출발지/도착지/숙소 제외 (실제 방문 장소만)
      const actualPlaceIds = dayPlaceIds.filter(
        (id) =>
          id !== "__origin__" &&
          id !== "__destination__" &&
          !id.startsWith("__accommodation_")
      );

      // 시작점 결정
      let actualStartId: string;
      let dayOriginInfo: DayEndpoint | undefined;

      if (isFirstDay) {
        // 첫날: 출발지에서 시작
        actualStartId = originNode.id;
        dayOriginInfo = {
          name: trip.origin.name,
          address: trip.origin.address,
          lat: trip.origin.lat,
          lng: trip.origin.lng,
          type: "origin",
        };
      } else {
        // 그 외: 이전 날의 숙소 또는 이전 날 마지막 장소
        const prevDate = dates[i - 1];
        // 연속 일정 지원: prevDate가 startDate <= prevDate < endDate 범위에 있는 숙소 찾기
        const prevAccomData = tripAccommodations.find(
          (a) => a.startDate <= prevDate && prevDate < a.endDate
        );
        const prevAccomNode = accommodationNodes.get(prevDate);

        if (prevAccomNode && prevAccomData) {
          actualStartId = prevAccomNode.id;
          dayOriginInfo = {
            name: prevAccomData.location.name,
            address: prevAccomData.location.address,
            lat: prevAccomData.location.lat,
            lng: prevAccomData.location.lng,
            type: "accommodation",
          };
        } else if (
          itinerary[i - 1] &&
          itinerary[i - 1].schedule.length > 0
        ) {
          // 이전 날 마지막 방문 장소 (숙소가 없는 경우)
          const lastSchedule = itinerary[i - 1].schedule[itinerary[i - 1].schedule.length - 1];
          actualStartId = lastSchedule.placeId;
          const lastNode = nodeMap.get(lastSchedule.placeId);
          if (lastNode) {
            dayOriginInfo = {
              name: lastNode.name,
              address: "",
              lat: lastNode.coordinate.lat,
              lng: lastNode.coordinate.lng,
              type: "lastPlace", // 전날 마지막 장소에서 시작
            };
          }
        } else {
          // 이전 날 방문 장소가 없으면 출발지 사용
          actualStartId = originNode.id;
          dayOriginInfo = {
            name: trip.origin.name,
            address: trip.origin.address,
            lat: trip.origin.lat,
            lng: trip.origin.lng,
            type: "origin",
          };
        }
      }

      // 끝점 결정
      let actualEndId: string;
      let skipTransportToDestination = false;
      let dayDestinationInfo: DayEndpoint | undefined;

      if (isLastDay) {
        // 마지막 날: 무조건 도착지
        actualEndId = destinationNode.id;
        dayDestinationInfo = {
          name: trip.destination.name,
          address: trip.destination.address,
          lat: trip.destination.lat,
          lng: trip.destination.lng,
          type: "destination",
        };
      } else {
        // 중간 날: 숙소가 있으면 숙소, 없으면 마지막 장소에서 종료
        // 연속 일정 지원: date가 startDate <= date < endDate 범위에 있는 숙소 찾기
        const todayAccomData = tripAccommodations.find(
          (a) => a.startDate <= date && date < a.endDate
        );
        const todayAccomNode = accommodationNodes.get(date);

        if (todayAccomNode && todayAccomData) {
          actualEndId = todayAccomNode.id;
          dayDestinationInfo = {
            name: todayAccomData.location.name,
            address: todayAccomData.location.address,
            lat: todayAccomData.location.lat,
            lng: todayAccomData.location.lng,
            type: "accommodation",
          };
        } else {
          // 숙소 없음: 마지막 장소에서 종료 (transportToDestination 생략)
          // 실제 끝점은 없지만 dummy ID 사용
          actualEndId = "__no_destination__";
          skipTransportToDestination = true;
          // dayDestinationInfo는 undefined로 유지 (끝점 없음 = 마지막 장소에서 종료)
        }
      }

      if (actualPlaceIds.length === 0) {
        // 빈 날은 기본 정보만
        itinerary.push({
          dayNumber: i + 1,
          date,
          schedule: [],
          totalDistance: 0,
          totalDuration: 0,
          totalStayDuration: 0,
          placeCount: 0,
          startTime: trip.dailyStartTime,
          endTime: trip.dailyStartTime,
          dailyStartTime: trip.dailyStartTime,
          dailyEndTime: trip.dailyEndTime,
          dayOrigin: dayOriginInfo,
          dayDestination: dayDestinationInfo,
        });
        continue;
      }

      const dailyItinerary = await createDailyItinerary(
        actualPlaceIds,
        nodeMap,
        distanceMatrix,
        date,
        i + 1,
        trip.dailyStartTime,
        trip.dailyEndTime,
        transportMode,
        actualStartId,
        actualEndId,
        skipTransportToDestination,
        dayOriginInfo,
        dayDestinationInfo
      );

      itinerary.push(dailyItinerary);
    }

    // 15. 통계 계산
    const statistics: OptimizeStatistics = {
      totalPlaces: places.length,
      totalDays: totalDays,
      totalDistance:
        itinerary.reduce((sum, day) => sum + day.totalDistance, 0) / 1000, // km
      totalDuration: itinerary.reduce((sum, day) => sum + day.totalDuration, 0),
      totalStayDuration: itinerary.reduce(
        (sum, day) => sum + day.totalStayDuration,
        0
      ),
      averageDailyDistance:
        itinerary.reduce((sum, day) => sum + day.totalDistance, 0) /
        1000 /
        totalDays,
      averageDailyPlaces:
        itinerary.reduce((sum, day) => sum + day.placeCount, 0) / totalDays,
      optimizationTimeMs: Date.now() - startTime,
      improvementPercentage: improvedResult.improvementPercentage,
    };

    // 16. 여행 상태 업데이트
    await supabase
      .from("trips")
      .update({ status: "optimized" })
      .eq("id", tripId);

    // 17. 캐시 무효화
    revalidatePath("/my");
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/plan/${tripId}/result`);

    return {
      success: true,
      data: {
        success: true,
        tripId,
        itinerary,
        statistics,
        errors: errors.length > 0 ? errors : undefined,
        completedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("최적화 실행 중 예외 발생:", error);
    return {
      success: false,
      error: {
        code: "UNKNOWN",
        message: "최적화 중 오류가 발생했습니다. 다시 시도해주세요.",
      },
    };
  }
}
