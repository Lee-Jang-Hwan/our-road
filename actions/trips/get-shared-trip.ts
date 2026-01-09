"use server";

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  Trip,
  TripRow,
  TripWithDetails,
  Place,
  TripPlaceRow,
  DailyItinerary,
  TripItineraryRow,
} from "@/types";

/**
 * 공유된 여행 조회 결과
 */
export interface GetSharedTripResult {
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
  return {
    dayNumber: row.day_number,
    date: row.date,
    schedule: row.schedule.map((item) => ({
      order: item.order,
      placeId: item.place_id,
      placeName: item.place_name,
      arrivalTime: item.arrival_time,
      departureTime: item.departure_time,
      duration: item.duration,
      isFixed: item.is_fixed,
      transportToNext: convertTransportInfo(item.transport_to_next),
    })),
    totalDistance: row.total_distance ?? 0,
    totalDuration: row.total_duration ?? 0,
    totalStayDuration: row.total_stay_duration ?? 0,
    placeCount: row.place_count ?? 0,
    startTime: row.schedule[0]?.arrival_time ?? "10:00",
    endTime: row.schedule[row.schedule.length - 1]?.departure_time ?? "22:00",
    transportFromOrigin: convertTransportInfo(row.transport_from_origin),
    transportToDestination: convertTransportInfo(row.transport_to_destination),
    dailyStartTime: row.daily_start_time,
    dailyEndTime: row.daily_end_time,
  };
}

/**
 * 공유된 여행 조회 Server Action (로그인 불필요)
 *
 * Service Role을 사용하여 RLS를 우회하고 읽기 전용으로 여행 정보를 조회합니다.
 * 최적화된 일정(itinerary)이 있는 여행만 공유 가능합니다.
 *
 * @param tripId - 여행 ID
 * @returns 여행 상세 정보 (장소, 일정표 포함) 또는 에러
 */
export async function getSharedTrip(
  tripId: string
): Promise<GetSharedTripResult> {
  try {
    // 1. UUID 형식 검증
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 2. Service Role 클라이언트로 RLS 우회
    const supabase = getServiceRoleClient();

    // 3. 여행 및 관련 데이터 조회 (병렬 처리)
    const [tripResult, placesResult, itinerariesResult] = await Promise.all([
      supabase.from("trips").select("*").eq("id", tripId).single(),
      supabase
        .from("trip_places")
        .select("*")
        .eq("trip_id", tripId)
        .order("priority", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("trip_itineraries")
        .select("*")
        .eq("trip_id", tripId)
        .order("day_number", { ascending: true }),
    ]);

    // 4. 에러 처리
    if (tripResult.error) {
      if (tripResult.error.code === "PGRST116") {
        return {
          success: false,
          error: "여행을 찾을 수 없습니다.",
        };
      }
      console.error("공유 여행 조회 오류:", tripResult.error);
      return {
        success: false,
        error: "여행 조회에 실패했습니다.",
      };
    }

    // 5. 최적화된 일정이 없으면 공유 불가
    if (!itinerariesResult.data || itinerariesResult.data.length === 0) {
      return {
        success: false,
        error: "아직 공유할 수 없는 여행입니다. 일정이 최적화되지 않았습니다.",
      };
    }

    // 6. 데이터 변환
    const trip = convertRowToTrip(tripResult.data as TripRow);
    const places = (placesResult.data ?? []).map((row) =>
      convertRowToPlace(row as TripPlaceRow)
    );
    const itinerary = (itinerariesResult.data as TripItineraryRow[]).map(
      convertRowToItinerary
    );

    // 7. 민감한 정보 제거 (userId)
    const sanitizedTrip: TripWithDetails = {
      ...trip,
      userId: "", // 소유자 정보 숨김
      places,
      fixedSchedules: [], // 고정 일정은 공유하지 않음
      itinerary,
    };

    return {
      success: true,
      data: sanitizedTrip,
    };
  } catch (error) {
    console.error("공유 여행 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
