"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { addMinutesToTime } from "@/lib/optimize";
import type {
  Trip,
  TripRow,
  TripWithDetails,
  Place,
  TripPlaceRow,
  FixedSchedule,
  TripFixedScheduleRow,
  DailyItinerary,
  TripItineraryRow,
} from "@/types";

/**
 * 여행 조회 결과
 */
export interface GetTripResult {
  success: boolean;
  data?: Trip;
  error?: string;
}

/**
 * 여행 상세 조회 결과 (관계 데이터 포함)
 */
export interface GetTripWithDetailsResult {
  success: boolean;
  data?: TripWithDetails;
  error?: string;
}

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
 * TripFixedScheduleRow를 FixedSchedule로 변환
 * (endTime은 장소의 체류시간으로 계산되므로 FixedSchedule에는 포함하지 않음)
 */
function convertRowToFixedSchedule(row: TripFixedScheduleRow): FixedSchedule {
  return {
    id: row.id,
    placeId: row.place_id ?? "",
    date: row.date,
    startTime: row.start_time,
    note: row.note ?? undefined,
  };
}

/**
 * TransportInfoRow를 RouteSegment로 변환
 */
function convertTransportInfo(info: TripItineraryRow["transport_from_origin"]): DailyItinerary["transportFromOrigin"] {
  if (!info) return undefined;

  return {
    mode: info.mode as "walking" | "public" | "car",
    distance: info.distance,
    duration: info.duration,
    description: info.description,
    fare: info.fare,
    polyline: info.polyline,
    transitDetails: info.transit_details
      ? {
          totalFare: info.transit_details.total_fare,
          transferCount: info.transit_details.transfer_count,
          walkingTime: info.transit_details.walking_time,
          walkingDistance: info.transit_details.walking_distance,
          subPaths: info.transit_details.sub_paths.map((sp) => ({
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
  const schedule = row.schedule.map((item) => ({
    order: item.order,
    placeId: item.place_id,
    placeName: item.place_name,
    arrivalTime: item.arrival_time,
    departureTime: item.departure_time,
    duration: item.duration,
    isFixed: item.is_fixed,
    transportToNext: convertTransportInfo(item.transport_to_next),
  }));

  const transportToDestination = convertTransportInfo(row.transport_to_destination);

  // startTime: 출발지 출발 시간 (dailyStartTime 또는 기본값)
  const startTime = row.daily_start_time ?? "10:00";
  
  // endTime: 마지막 장소 출발 시간 + 도착지까지 이동 시간
  let endTime = schedule[schedule.length - 1]?.departureTime ?? "22:00";
  if (transportToDestination) {
    endTime = addMinutesToTime(endTime, transportToDestination.duration);
  }

  return {
    dayNumber: row.day_number,
    date: row.date,
    schedule,
    totalDistance: row.total_distance ?? 0,
    totalDuration: row.total_duration ?? 0,
    totalStayDuration: row.total_stay_duration ?? 0,
    placeCount: row.place_count ?? 0,
    startTime,
    endTime,
    transportFromOrigin: convertTransportInfo(row.transport_from_origin),
    transportToDestination,
    dailyStartTime: row.daily_start_time,
    dailyEndTime: row.daily_end_time,
  };
}

/**
 * 단일 여행 조회 Server Action
 *
 * @param tripId - 여행 ID
 * @returns 여행 정보 또는 에러
 */
export async function getTrip(tripId: string): Promise<GetTripResult> {
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
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 여행 조회 (RLS가 자동으로 본인 여행만 조회)
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return {
          success: false,
          error: "여행을 찾을 수 없습니다.",
        };
      }
      console.error("여행 조회 오류:", error);
      return {
        success: false,
        error: "여행 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: convertRowToTrip(data as TripRow),
    };
  } catch (error) {
    console.error("여행 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 여행 상세 조회 Server Action (관계 데이터 포함)
 *
 * @param tripId - 여행 ID
 * @returns 여행 상세 정보 (장소, 고정일정, 일정표 포함) 또는 에러
 */
export async function getTripWithDetails(
  tripId: string
): Promise<GetTripWithDetailsResult> {
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
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 여행 및 관련 데이터 조회 (병렬 처리)
    const [tripResult, placesResult, schedulesResult, itinerariesResult] =
      await Promise.all([
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
        supabase
          .from("trip_itineraries")
          .select("*")
          .eq("trip_id", tripId)
          .order("day_number", { ascending: true }),
      ]);

    // 5. 에러 처리
    if (tripResult.error) {
      if (tripResult.error.code === "PGRST116") {
        return {
          success: false,
          error: "여행을 찾을 수 없습니다.",
        };
      }
      console.error("여행 조회 오류:", tripResult.error);
      return {
        success: false,
        error: "여행 조회에 실패했습니다.",
      };
    }

    // 6. 데이터 변환
    const trip = convertRowToTrip(tripResult.data as TripRow);
    const places = (placesResult.data ?? []).map((row) =>
      convertRowToPlace(row as TripPlaceRow)
    );
    const fixedSchedules = (schedulesResult.data ?? []).map((row) =>
      convertRowToFixedSchedule(row as TripFixedScheduleRow)
    );
    const itinerary =
      itinerariesResult.data && itinerariesResult.data.length > 0
        ? (itinerariesResult.data as TripItineraryRow[]).map(
            convertRowToItinerary
          )
        : undefined;

    return {
      success: true,
      data: {
        ...trip,
        places,
        fixedSchedules,
        itinerary,
      },
    };
  } catch (error) {
    console.error("여행 상세 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
