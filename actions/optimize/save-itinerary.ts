"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import type {
  DailyItinerary,
  ScheduleItemRow,
  TripItineraryRow,
} from "@/types/schedule";

// ============================================
// Types
// ============================================

/**
 * 일정 저장 입력
 */
export interface SaveItineraryInput {
  tripId: string;
  itinerary: DailyItinerary[];
}

/**
 * 일정 저장 결과
 */
export interface SaveItineraryResult {
  success: boolean;
  data?: {
    savedCount: number;
  };
  error?: string;
}

/**
 * 일정 삭제 결과
 */
export interface DeleteItineraryResult {
  success: boolean;
  deletedCount?: number;
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * RouteSegment를 TransportInfoRow 형식으로 변환
 */
function convertTransportToRow(transport: {
  mode: string;
  distance: number;
  duration: number;
  description?: string;
  fare?: number;
  polyline?: string;
  transitDetails?: {
    totalFare: number;
    transferCount: number;
    walkingTime: number;
    walkingDistance: number;
    subPaths: Array<{
      trafficType: 1 | 2 | 3 | 10 | 11 | 12 | 14;
      distance: number;
      sectionTime: number;
      stationCount?: number;
      startName?: string;
      endName?: string;
      lane?: {
        name: string;
        busNo?: string;
        busType?: string;
        subwayCode?: number;
        lineColor?: string;
      };
      way?: string;
    }>;
  };
}) {
  return {
    mode: transport.mode,
    distance: transport.distance,
    duration: transport.duration,
    description: transport.description,
    fare: transport.fare,
    polyline: transport.polyline,
    transit_details: transport.transitDetails
      ? {
          total_fare: transport.transitDetails.totalFare,
          transfer_count: transport.transitDetails.transferCount,
          walking_time: transport.transitDetails.walkingTime,
          walking_distance: transport.transitDetails.walkingDistance,
          sub_paths: transport.transitDetails.subPaths.map((sp) => ({
            traffic_type: sp.trafficType,
            distance: sp.distance,
            section_time: sp.sectionTime,
            station_count: sp.stationCount,
            start_name: sp.startName,
            end_name: sp.endName,
            lane: sp.lane
              ? {
                  name: sp.lane.name,
                  bus_no: sp.lane.busNo,
                  bus_type: sp.lane.busType,
                  subway_code: sp.lane.subwayCode,
                  line_color: sp.lane.lineColor,
                }
              : undefined,
            way: sp.way,
          })),
        }
      : undefined,
  };
}

/**
 * DailyItinerary를 DB Row 형식으로 변환
 */
function toInt(value: number): number {
  return Math.round(value);
}

function convertItineraryToRow(
  itinerary: DailyItinerary,
  tripId: string
): Omit<TripItineraryRow, "id" | "created_at"> {
  const scheduleRows: ScheduleItemRow[] = itinerary.schedule.map((item) => ({
    order: item.order,
    place_id: item.placeId,
    place_name: item.placeName,
    arrival_time: item.arrivalTime,
    departure_time: item.departureTime,
    duration: item.duration,
    is_fixed: item.isFixed,
    transport_to_next: item.transportToNext
      ? convertTransportToRow(item.transportToNext)
      : undefined,
  }));

  return {
    trip_id: tripId,
    day_number: itinerary.dayNumber,
    date: itinerary.date,
    schedule: scheduleRows,
    total_distance: toInt(itinerary.totalDistance),
    total_duration: toInt(itinerary.totalDuration),
    total_stay_duration: toInt(itinerary.totalStayDuration),
    place_count: itinerary.placeCount,
    transport_from_origin: itinerary.transportFromOrigin
      ? convertTransportToRow(itinerary.transportFromOrigin)
      : undefined,
    transport_to_destination: itinerary.transportToDestination
      ? convertTransportToRow(itinerary.transportToDestination)
      : undefined,
    daily_start_time: itinerary.dailyStartTime,
    daily_end_time: itinerary.dailyEndTime,
  };
}

// ============================================
// Server Actions
// ============================================

/**
 * 최적화 결과 저장 Server Action
 *
 * 기존 일정을 삭제하고 새로운 일정을 저장합니다.
 *
 * @param input - 저장할 일정 데이터
 * @returns 저장 결과
 *
 * @example
 * ```tsx
 * const result = await saveItinerary({
 *   tripId: "...",
 *   itinerary: optimizeResult.itinerary,
 * });
 * if (result.success) {
 *   console.log(`${result.data.savedCount}개 일정 저장됨`);
 * }
 * ```
 */
export async function saveItinerary(
  input: SaveItineraryInput
): Promise<SaveItineraryResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    const { tripId, itinerary } = input;

    // 2. UUID 형식 검증
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. 일정 데이터 검증
    if (!itinerary || itinerary.length === 0) {
      return {
        success: false,
        error: "저장할 일정이 없습니다.",
      };
    }

    // 4. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 5. 여행 소유권 확인
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return {
        success: false,
        error: "여행을 찾을 수 없거나 접근 권한이 없습니다.",
      };
    }

    // 6. 기존 일정 삭제
    const { error: deleteError } = await supabase
      .from("trip_itineraries")
      .delete()
      .eq("trip_id", tripId);

    if (deleteError) {
      console.error("기존 일정 삭제 오류:", deleteError);
      return {
        success: false,
        error: "기존 일정 삭제에 실패했습니다.",
      };
    }

    // 7. 새 일정 저장
    const rows = itinerary.map((day) => convertItineraryToRow(day, tripId));

    const { error: insertError } = await supabase
      .from("trip_itineraries")
      .insert(rows);

    if (insertError) {
      console.error("일정 저장 오류:", insertError);
      return {
        success: false,
        error: "일정 저장에 실패했습니다.",
      };
    }

    // 8. 여행 상태 업데이트
    await supabase
      .from("trips")
      .update({ status: "optimized" })
      .eq("id", tripId);

    // 9. 캐시 무효화
    revalidatePath("/my");
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/plan/${tripId}/result`);

    return {
      success: true,
      data: {
        savedCount: itinerary.length,
      },
    };
  } catch (error) {
    console.error("일정 저장 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 일정 삭제 Server Action
 *
 * 특정 여행의 모든 일정을 삭제합니다.
 *
 * @param tripId - 여행 ID
 * @returns 삭제 결과
 */
export async function deleteItinerary(
  tripId: string
): Promise<DeleteItineraryResult> {
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

    // 4. 여행 소유권 확인
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return {
        success: false,
        error: "여행을 찾을 수 없거나 접근 권한이 없습니다.",
      };
    }

    // 5. 기존 일정 개수 확인
    const { count } = await supabase
      .from("trip_itineraries")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId);

    // 6. 일정 삭제
    const { error: deleteError } = await supabase
      .from("trip_itineraries")
      .delete()
      .eq("trip_id", tripId);

    if (deleteError) {
      console.error("일정 삭제 오류:", deleteError);
      return {
        success: false,
        error: "일정 삭제에 실패했습니다.",
      };
    }

    // 7. 여행 상태 업데이트 (draft로 변경)
    await supabase.from("trips").update({ status: "draft" }).eq("id", tripId);

    // 8. 캐시 무효화
    revalidatePath("/my");
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/plan/${tripId}/result`);

    return {
      success: true,
      deletedCount: count ?? 0,
    };
  } catch (error) {
    console.error("일정 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 일정 존재 여부 확인 Server Action
 *
 * @param tripId - 여행 ID
 * @returns 일정 존재 여부
 */
export async function hasItinerary(
  tripId: string
): Promise<{ success: boolean; hasItinerary?: boolean; error?: string }> {
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

    // 4. 일정 개수 확인
    const { count, error } = await supabase
      .from("trip_itineraries")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId);

    if (error) {
      console.error("일정 확인 오류:", error);
      return {
        success: false,
        error: "일정 확인에 실패했습니다.",
      };
    }

    return {
      success: true,
      hasItinerary: (count ?? 0) > 0,
    };
  } catch (error) {
    console.error("일정 확인 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
