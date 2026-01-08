"use server";

import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import type {
  DailyItinerary,
  TripItineraryRow,
  ScheduleItem,
  ItinerarySummary,
} from "@/types/schedule";

// ============================================
// Types
// ============================================

/**
 * 일정 조회 결과
 */
export interface GetItineraryResult {
  success: boolean;
  data?: DailyItinerary[];
  error?: string;
}

/**
 * 단일 일자 일정 조회 결과
 */
export interface GetDayItineraryResult {
  success: boolean;
  data?: DailyItinerary;
  error?: string;
}

/**
 * 일정 요약 조회 결과
 */
export interface GetItinerarySummaryResult {
  success: boolean;
  data?: ItinerarySummary;
  error?: string;
}

/**
 * 일정 개수 조회 결과
 */
export interface GetItineraryCountResult {
  success: boolean;
  count?: number;
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * TransportInfoRow를 RouteSegment로 변환
 */
function convertTransportFromRow(transport: {
  mode: string;
  distance: number;
  duration: number;
  description?: string;
  fare?: number;
  polyline?: string;
  transit_details?: {
    total_fare: number;
    transfer_count: number;
    walking_time: number;
    walking_distance: number;
    sub_paths: Array<{
      traffic_type: 1 | 2 | 3 | 10 | 11 | 12 | 14;
      distance: number;
      section_time: number;
      station_count?: number;
      start_name?: string;
      end_name?: string;
      lane?: {
        name: string;
        bus_no?: string;
        bus_type?: string;
        subway_code?: number;
        line_color?: string;
      };
      way?: string;
    }>;
  };
}) {
  return {
    mode: transport.mode as "walking" | "public" | "car",
    distance: transport.distance,
    duration: transport.duration,
    description: transport.description,
    fare: transport.fare,
    polyline: transport.polyline,
    transitDetails: transport.transit_details
      ? {
          totalFare: transport.transit_details.total_fare,
          transferCount: transport.transit_details.transfer_count,
          walkingTime: transport.transit_details.walking_time,
          walkingDistance: transport.transit_details.walking_distance,
          subPaths: transport.transit_details.sub_paths.map((sp) => ({
            trafficType: sp.traffic_type,
            distance: sp.distance,
            sectionTime: sp.section_time,
            stationCount: sp.station_count,
            startName: sp.start_name,
            endName: sp.end_name,
            lane: sp.lane
              ? {
                  name: sp.lane.name,
                  busNo: sp.lane.bus_no,
                  busType: sp.lane.bus_type,
                  subwayCode: sp.lane.subway_code,
                  lineColor: sp.lane.line_color,
                }
              : undefined,
            way: sp.way,
          })),
        }
      : undefined,
  };
}

/**
 * TripItineraryRow를 DailyItinerary로 변환
 */
function convertRowToItinerary(row: TripItineraryRow): DailyItinerary {
  const schedule: ScheduleItem[] = row.schedule.map((item) => ({
    order: item.order,
    placeId: item.place_id,
    placeName: item.place_name,
    arrivalTime: item.arrival_time,
    departureTime: item.departure_time,
    duration: item.duration,
    isFixed: item.is_fixed,
    transportToNext: item.transport_to_next
      ? convertTransportFromRow(item.transport_to_next)
      : undefined,
  }));

  return {
    dayNumber: row.day_number,
    date: row.date,
    schedule,
    totalDistance: row.total_distance ?? 0,
    totalDuration: row.total_duration ?? 0,
    totalStayDuration: row.total_stay_duration ?? 0,
    placeCount: row.place_count ?? 0,
    startTime: schedule[0]?.arrivalTime ?? "10:00",
    endTime: schedule[schedule.length - 1]?.departureTime ?? "22:00",
  };
}

/**
 * UUID 형식 검증
 */
function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// ============================================
// Server Actions
// ============================================

/**
 * 여행 일정 전체 조회 Server Action
 *
 * 특정 여행의 전체 일정(모든 일차)을 조회합니다.
 *
 * @param tripId - 여행 ID
 * @returns 일정 배열 또는 에러
 *
 * @example
 * ```tsx
 * const result = await getItinerary("trip-uuid");
 * if (result.success && result.data) {
 *   result.data.forEach(day => {
 *     console.log(`${day.dayNumber}일차: ${day.placeCount}개 장소`);
 *   });
 * }
 * ```
 */
export async function getItinerary(tripId: string): Promise<GetItineraryResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. UUID 형식 검증
    if (!isValidUUID(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 일정 조회
    const { data, error } = await supabase
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true });

    if (error) {
      console.error("일정 조회 오류:", error);
      return {
        success: false,
        error: "일정 조회에 실패했습니다.",
      };
    }

    // 5. 데이터가 없는 경우 빈 배열 반환
    if (!data || data.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // 6. 데이터 변환
    const itinerary = (data as TripItineraryRow[]).map(convertRowToItinerary);

    return {
      success: true,
      data: itinerary,
    };
  } catch (error) {
    console.error("일정 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 특정 일자 일정 조회 Server Action
 *
 * 특정 여행의 특정 일차 일정만 조회합니다.
 *
 * @param tripId - 여행 ID
 * @param dayNumber - 일차 번호 (1부터 시작)
 * @returns 해당 일차 일정 또는 에러
 *
 * @example
 * ```tsx
 * const result = await getDayItinerary("trip-uuid", 1);
 * if (result.success && result.data) {
 *   console.log(`1일차 일정: ${result.data.schedule.length}개 항목`);
 * }
 * ```
 */
export async function getDayItinerary(
  tripId: string,
  dayNumber: number
): Promise<GetDayItineraryResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. UUID 형식 검증
    if (!isValidUUID(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. 일차 번호 검증
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 30) {
      return {
        success: false,
        error: "유효하지 않은 일차 번호입니다. (1~30)",
      };
    }

    // 4. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 5. 특정 일자 일정 조회
    const { data, error } = await supabase
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", tripId)
      .eq("day_number", dayNumber)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return {
          success: false,
          error: `${dayNumber}일차 일정을 찾을 수 없습니다.`,
        };
      }
      console.error("일정 조회 오류:", error);
      return {
        success: false,
        error: "일정 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: convertRowToItinerary(data as TripItineraryRow),
    };
  } catch (error) {
    console.error("일정 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 일정 요약 정보 조회 Server Action
 *
 * 전체 일정의 요약 정보(총 일수, 장소 수, 이동 거리 등)를 계산합니다.
 *
 * @param tripId - 여행 ID
 * @returns 일정 요약 정보 또는 에러
 *
 * @example
 * ```tsx
 * const result = await getItinerarySummary("trip-uuid");
 * if (result.success && result.data) {
 *   console.log(`총 ${result.data.totalDays}일, ${result.data.totalPlaces}개 장소`);
 *   console.log(`총 이동거리: ${result.data.totalDistance}m`);
 * }
 * ```
 */
export async function getItinerarySummary(
  tripId: string
): Promise<GetItinerarySummaryResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. UUID 형식 검증
    if (!isValidUUID(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 일정 조회
    const { data, error } = await supabase
      .from("trip_itineraries")
      .select("day_number, total_distance, total_duration, total_stay_duration, place_count, schedule")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true });

    if (error) {
      console.error("일정 조회 오류:", error);
      return {
        success: false,
        error: "일정 요약 조회에 실패했습니다.",
      };
    }

    // 5. 일정이 없는 경우
    if (!data || data.length === 0) {
      return {
        success: true,
        data: {
          totalDays: 0,
          totalPlaces: 0,
          totalDistance: 0,
          totalDuration: 0,
          totalStayDuration: 0,
        },
      };
    }

    // 6. 요약 정보 계산
    let totalPlaces = 0;
    let totalDistance = 0;
    let totalDuration = 0;
    let totalStayDuration = 0;
    let estimatedCost = 0;

    for (const row of data) {
      totalPlaces += row.place_count ?? 0;
      totalDistance += row.total_distance ?? 0;
      totalDuration += row.total_duration ?? 0;
      totalStayDuration += row.total_stay_duration ?? 0;

      // 교통비 계산 (schedule 내 fare 합산)
      if (row.schedule && Array.isArray(row.schedule)) {
        for (const item of row.schedule) {
          if (item.transport_to_next?.fare) {
            estimatedCost += item.transport_to_next.fare;
          }
        }
      }
    }

    const summary: ItinerarySummary = {
      totalDays: data.length,
      totalPlaces,
      totalDistance,
      totalDuration,
      totalStayDuration,
      ...(estimatedCost > 0 && { estimatedCost }),
    };

    return {
      success: true,
      data: summary,
    };
  } catch (error) {
    console.error("일정 요약 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 일정 개수 조회 Server Action
 *
 * 저장된 일정 일수를 조회합니다.
 *
 * @param tripId - 여행 ID
 * @returns 일정 개수 또는 에러
 */
export async function getItineraryCount(
  tripId: string
): Promise<GetItineraryCountResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. UUID 형식 검증
    if (!isValidUUID(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 개수 조회
    const { count, error } = await supabase
      .from("trip_itineraries")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId);

    if (error) {
      console.error("일정 개수 조회 오류:", error);
      return {
        success: false,
        error: "일정 개수 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      count: count ?? 0,
    };
  } catch (error) {
    console.error("일정 개수 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

// ============================================
// Cached Functions
// ============================================

/**
 * 캐시된 일정 조회 함수 (내부용)
 *
 * Next.js unstable_cache를 사용하여 일정 데이터를 캐싱합니다.
 * 캐시 키: itinerary-{tripId}
 * 재검증 시간: 60초
 * 태그: itinerary, trip-{tripId}
 */
const getCachedItineraryData = unstable_cache(
  async (tripId: string) => {
    const supabase = createClerkSupabaseClient();

    const { data, error } = await supabase
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data as TripItineraryRow[];
  },
  ["itinerary"],
  {
    revalidate: 60, // 60초 후 재검증
    tags: ["itinerary"],
  }
);

/**
 * 캐시된 일정 조회 Server Action
 *
 * 일정 데이터를 캐싱하여 반복 조회 시 성능을 최적화합니다.
 * 캐시는 60초간 유지되며, 일정 저장/수정/삭제 시 무효화됩니다.
 *
 * @param tripId - 여행 ID
 * @returns 캐시된 일정 배열 또는 에러
 *
 * @example
 * ```tsx
 * // 첫 번째 호출: DB 조회
 * const result1 = await getCachedItinerary("trip-uuid");
 *
 * // 두 번째 호출 (60초 이내): 캐시에서 반환
 * const result2 = await getCachedItinerary("trip-uuid");
 * ```
 */
export async function getCachedItinerary(
  tripId: string
): Promise<GetItineraryResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. UUID 형식 검증
    if (!isValidUUID(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. 캐시된 데이터 조회
    const data = await getCachedItineraryData(tripId);

    // 4. 데이터가 없는 경우 빈 배열 반환
    if (!data || data.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // 5. 데이터 변환
    const itinerary = data.map(convertRowToItinerary);

    return {
      success: true,
      data: itinerary,
    };
  } catch (error) {
    console.error("캐시된 일정 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
