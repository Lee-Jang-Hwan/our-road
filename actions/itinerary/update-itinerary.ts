"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import type {
  DailyItinerary,
  ScheduleItem,
  ScheduleItemRow,
  TripItineraryRow,
} from "@/types/schedule";

// ============================================
// Types
// ============================================

/**
 * 일정 항목 수정 입력
 */
export interface UpdateScheduleItemInput {
  /** 장소 ID (변경 시) */
  placeId?: string;
  /** 장소명 (변경 시) */
  placeName?: string;
  /** 도착 시간 (HH:mm) */
  arrivalTime?: string;
  /** 출발 시간 (HH:mm) */
  departureTime?: string;
  /** 체류 시간 (분) */
  duration?: number;
}

/**
 * 일자별 일정 수정 입력
 */
export interface UpdateDayItineraryInput {
  tripId: string;
  dayNumber: number;
  /** 일정 항목 배열 (전체 교체) */
  schedule?: ScheduleItem[];
  /** 총 이동 거리 (미터) */
  totalDistance?: number;
  /** 총 이동 시간 (분) */
  totalDuration?: number;
  /** 총 체류 시간 (분) */
  totalStayDuration?: number;
}

/**
 * 일정 항목 순서 변경 입력
 */
export interface ReorderScheduleInput {
  tripId: string;
  dayNumber: number;
  /** 새로운 순서 (placeId 배열) */
  newOrder: string[];
}

/**
 * 일정 항목 이동 입력 (다른 일자로)
 */
export interface MoveScheduleItemInput {
  tripId: string;
  fromDayNumber: number;
  toDayNumber: number;
  placeId: string;
  /** 도착 일자에서의 위치 (0부터 시작, 기본값: 마지막) */
  toIndex?: number;
}

/**
 * 일정 수정 결과
 */
export interface UpdateItineraryResult {
  success: boolean;
  data?: DailyItinerary;
  error?: string;
}

/**
 * 일정 순서 변경 결과
 */
export interface ReorderScheduleResult {
  success: boolean;
  data?: DailyItinerary;
  error?: string;
}

/**
 * 일정 항목 이동 결과
 */
export interface MoveScheduleItemResult {
  success: boolean;
  data?: {
    fromDay: DailyItinerary;
    toDay: DailyItinerary;
  };
  error?: string;
}

/**
 * 단일 항목 수정 결과
 */
export interface UpdateScheduleItemResult {
  success: boolean;
  data?: ScheduleItem;
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * UUID 형식 검증
 */
function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * 시간 형식 검증 (HH:mm)
 */
function isValidTime(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

/**
 * ScheduleItem을 ScheduleItemRow로 변환
 */
function convertItemToRow(item: ScheduleItem): ScheduleItemRow {
  return {
    order: item.order,
    place_id: item.placeId,
    place_name: item.placeName,
    arrival_time: item.arrivalTime,
    departure_time: item.departureTime,
    duration: item.duration,
    is_fixed: item.isFixed,
    transport_to_next: item.transportToNext
      ? {
          mode: item.transportToNext.mode,
          distance: item.transportToNext.distance,
          duration: item.transportToNext.duration,
          description: item.transportToNext.description,
          fare: item.transportToNext.fare,
        }
      : undefined,
  };
}

/**
 * ScheduleItemRow를 ScheduleItem으로 변환
 */
function convertRowToItem(row: ScheduleItemRow): ScheduleItem {
  return {
    order: row.order,
    placeId: row.place_id,
    placeName: row.place_name,
    arrivalTime: row.arrival_time,
    departureTime: row.departure_time,
    duration: row.duration,
    isFixed: row.is_fixed,
    transportToNext: row.transport_to_next
      ? {
          mode: row.transport_to_next.mode as "walking" | "public" | "car",
          distance: row.transport_to_next.distance,
          duration: row.transport_to_next.duration,
          description: row.transport_to_next.description,
          fare: row.transport_to_next.fare,
        }
      : undefined,
  };
}

/**
 * TripItineraryRow를 DailyItinerary로 변환
 */
function convertRowToItinerary(row: TripItineraryRow): DailyItinerary {
  const schedule = row.schedule.map(convertRowToItem);

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
 * 일정 요약 정보 재계산
 */
function recalculateSummary(schedule: ScheduleItem[]): {
  totalDistance: number;
  totalDuration: number;
  totalStayDuration: number;
  placeCount: number;
} {
  let totalDistance = 0;
  let totalDuration = 0;
  let totalStayDuration = 0;

  for (const item of schedule) {
    totalStayDuration += item.duration;
    if (item.transportToNext) {
      totalDistance += item.transportToNext.distance;
      totalDuration += item.transportToNext.duration;
    }
  }

  return {
    totalDistance,
    totalDuration,
    totalStayDuration,
    placeCount: schedule.length,
  };
}

/**
 * 캐시 무효화
 */
function invalidateCache(tripId: string, dayNumber?: number) {
  revalidateTag("itinerary");
  revalidatePath("/my");
  revalidatePath(`/plan/${tripId}`);
  revalidatePath(`/my/trips/${tripId}`);
}

// ============================================
// Server Actions
// ============================================

/**
 * 일자별 일정 수정 Server Action
 *
 * 특정 일차의 일정을 수정합니다.
 * schedule 배열 전체를 교체하거나 요약 정보만 수정할 수 있습니다.
 *
 * @param input - 수정할 일정 데이터
 * @returns 수정된 일정 또는 에러
 *
 * @example
 * ```tsx
 * const result = await updateDayItinerary({
 *   tripId: "trip-uuid",
 *   dayNumber: 1,
 *   schedule: [...newSchedule],
 * });
 * ```
 */
export async function updateDayItinerary(
  input: UpdateDayItineraryInput,
): Promise<UpdateItineraryResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    const { tripId, dayNumber, schedule, ...summaryUpdates } = input;

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

    // 5. 기존 일정 조회
    const { data: existingData, error: fetchError } = await supabase
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", tripId)
      .eq("day_number", dayNumber)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return {
          success: false,
          error: `${dayNumber}일차 일정을 찾을 수 없습니다.`,
        };
      }
      console.error("일정 조회 오류:", fetchError);
      return {
        success: false,
        error: "일정 조회에 실패했습니다.",
      };
    }

    // 6. 업데이트 데이터 준비
    const existingRow = existingData as TripItineraryRow;
    let updatedSchedule = existingRow.schedule;
    let summary = {
      total_distance: existingRow.total_distance,
      total_duration: existingRow.total_duration,
      total_stay_duration: existingRow.total_stay_duration,
      place_count: existingRow.place_count,
    };

    // schedule이 제공된 경우 전체 교체
    if (schedule) {
      // 순서 번호 재할당
      const orderedSchedule = schedule.map((item, index) => ({
        ...item,
        order: index + 1,
      }));
      updatedSchedule = orderedSchedule.map(convertItemToRow);

      // 요약 정보 재계산
      const recalculated = recalculateSummary(orderedSchedule);
      summary = {
        total_distance: recalculated.totalDistance,
        total_duration: recalculated.totalDuration,
        total_stay_duration: recalculated.totalStayDuration,
        place_count: recalculated.placeCount,
      };
    }

    // 개별 요약 정보 업데이트 적용
    if (summaryUpdates.totalDistance !== undefined) {
      summary.total_distance = summaryUpdates.totalDistance;
    }
    if (summaryUpdates.totalDuration !== undefined) {
      summary.total_duration = summaryUpdates.totalDuration;
    }
    if (summaryUpdates.totalStayDuration !== undefined) {
      summary.total_stay_duration = summaryUpdates.totalStayDuration;
    }

    // 7. 일정 업데이트
    const { data, error: updateError } = await supabase
      .from("trip_itineraries")
      .update({
        schedule: updatedSchedule,
        ...summary,
      })
      .eq("trip_id", tripId)
      .eq("day_number", dayNumber)
      .select()
      .single();

    if (updateError) {
      console.error("일정 수정 오류:", updateError);
      return {
        success: false,
        error: "일정 수정에 실패했습니다.",
      };
    }

    // 8. 캐시 무효화
    invalidateCache(tripId, dayNumber);

    return {
      success: true,
      data: convertRowToItinerary(data as TripItineraryRow),
    };
  } catch (error) {
    console.error("일정 수정 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 일정 항목 순서 변경 Server Action
 *
 * 특정 일차 내에서 일정 항목들의 순서를 변경합니다.
 *
 * @param input - 순서 변경 정보
 * @returns 수정된 일정 또는 에러
 *
 * @example
 * ```tsx
 * const result = await reorderScheduleItems({
 *   tripId: "trip-uuid",
 *   dayNumber: 1,
 *   newOrder: ["place-3", "place-1", "place-2"], // 새로운 순서
 * });
 * ```
 */
export async function reorderScheduleItems(
  input: ReorderScheduleInput,
): Promise<ReorderScheduleResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    const { tripId, dayNumber, newOrder } = input;

    // 2. 검증
    if (!isValidUUID(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 30) {
      return {
        success: false,
        error: "유효하지 않은 일차 번호입니다. (1~30)",
      };
    }

    if (!newOrder || newOrder.length === 0) {
      return {
        success: false,
        error: "새로운 순서를 지정해주세요.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 기존 일정 조회
    const { data: existingData, error: fetchError } = await supabase
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", tripId)
      .eq("day_number", dayNumber)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return {
          success: false,
          error: `${dayNumber}일차 일정을 찾을 수 없습니다.`,
        };
      }
      console.error("일정 조회 오류:", fetchError);
      return {
        success: false,
        error: "일정 조회에 실패했습니다.",
      };
    }

    const existingRow = existingData as TripItineraryRow;

    // 5. 새 순서대로 재배열
    const scheduleMap = new Map<string, ScheduleItemRow>();
    for (const item of existingRow.schedule) {
      scheduleMap.set(item.place_id, item);
    }

    // 모든 placeId가 존재하는지 확인
    for (const placeId of newOrder) {
      if (!scheduleMap.has(placeId)) {
        return {
          success: false,
          error: `장소 ID '${placeId}'를 찾을 수 없습니다.`,
        };
      }
    }

    // 새 순서로 재배열 및 order 재할당
    const reorderedSchedule: ScheduleItemRow[] = newOrder.map(
      (placeId, index) => {
        const item = scheduleMap.get(placeId)!;
        return {
          ...item,
          order: index + 1,
        };
      },
    );

    // 6. 일정 업데이트
    const { data, error: updateError } = await supabase
      .from("trip_itineraries")
      .update({ schedule: reorderedSchedule })
      .eq("trip_id", tripId)
      .eq("day_number", dayNumber)
      .select()
      .single();

    if (updateError) {
      console.error("일정 순서 변경 오류:", updateError);
      return {
        success: false,
        error: "일정 순서 변경에 실패했습니다.",
      };
    }

    // 7. 캐시 무효화
    invalidateCache(tripId, dayNumber);

    return {
      success: true,
      data: convertRowToItinerary(data as TripItineraryRow),
    };
  } catch (error) {
    console.error("일정 순서 변경 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 일정 항목 이동 Server Action (다른 일자로)
 *
 * 특정 일정 항목을 다른 일차로 이동합니다.
 *
 * @param input - 이동 정보
 * @returns 수정된 출발/도착 일정 또는 에러
 *
 * @example
 * ```tsx
 * const result = await moveScheduleItem({
 *   tripId: "trip-uuid",
 *   fromDayNumber: 1,
 *   toDayNumber: 2,
 *   placeId: "place-uuid",
 *   toIndex: 0, // 2일차 맨 앞으로
 * });
 * ```
 */
export async function moveScheduleItem(
  input: MoveScheduleItemInput,
): Promise<MoveScheduleItemResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    const { tripId, fromDayNumber, toDayNumber, placeId, toIndex } = input;

    // 2. 검증
    if (!isValidUUID(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    if (
      !Number.isInteger(fromDayNumber) ||
      fromDayNumber < 1 ||
      fromDayNumber > 30
    ) {
      return {
        success: false,
        error: "유효하지 않은 출발 일차 번호입니다. (1~30)",
      };
    }

    if (!Number.isInteger(toDayNumber) || toDayNumber < 1 || toDayNumber > 30) {
      return {
        success: false,
        error: "유효하지 않은 도착 일차 번호입니다. (1~30)",
      };
    }

    if (fromDayNumber === toDayNumber) {
      return {
        success: false,
        error: "같은 일차로 이동할 수 없습니다. 순서 변경을 사용하세요.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 두 일정 모두 조회
    const { data: bothDays, error: fetchError } = await supabase
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", tripId)
      .in("day_number", [fromDayNumber, toDayNumber]);

    if (fetchError) {
      console.error("일정 조회 오류:", fetchError);
      return {
        success: false,
        error: "일정 조회에 실패했습니다.",
      };
    }

    const fromRow = (bothDays as TripItineraryRow[]).find(
      (r) => r.day_number === fromDayNumber,
    );
    const toRow = (bothDays as TripItineraryRow[]).find(
      (r) => r.day_number === toDayNumber,
    );

    if (!fromRow) {
      return {
        success: false,
        error: `${fromDayNumber}일차 일정을 찾을 수 없습니다.`,
      };
    }

    if (!toRow) {
      return {
        success: false,
        error: `${toDayNumber}일차 일정을 찾을 수 없습니다.`,
      };
    }

    // 5. 이동할 항목 찾기
    const itemIndex = fromRow.schedule.findIndex(
      (item) => item.place_id === placeId,
    );
    if (itemIndex === -1) {
      return {
        success: false,
        error: "이동할 일정 항목을 찾을 수 없습니다.",
      };
    }

    const movingItem = fromRow.schedule[itemIndex];

    // 6. 출발 일정에서 제거
    const newFromSchedule = fromRow.schedule
      .filter((_, i) => i !== itemIndex)
      .map((item, index) => ({ ...item, order: index + 1 }));

    // 7. 도착 일정에 추가
    const insertIndex =
      toIndex !== undefined
        ? Math.max(0, Math.min(toIndex, toRow.schedule.length))
        : toRow.schedule.length;

    const newToSchedule = [
      ...toRow.schedule.slice(0, insertIndex),
      { ...movingItem, order: insertIndex + 1 },
      ...toRow.schedule.slice(insertIndex),
    ].map((item, index) => ({ ...item, order: index + 1 }));

    // 8. 요약 정보 재계산
    const fromSummary = recalculateSummary(
      newFromSchedule.map(convertRowToItem),
    );
    const toSummary = recalculateSummary(newToSchedule.map(convertRowToItem));

    // 9. 두 일정 모두 업데이트
    const [fromUpdate, toUpdate] = await Promise.all([
      supabase
        .from("trip_itineraries")
        .update({
          schedule: newFromSchedule,
          total_distance: fromSummary.totalDistance,
          total_duration: fromSummary.totalDuration,
          total_stay_duration: fromSummary.totalStayDuration,
          place_count: fromSummary.placeCount,
        })
        .eq("trip_id", tripId)
        .eq("day_number", fromDayNumber)
        .select()
        .single(),
      supabase
        .from("trip_itineraries")
        .update({
          schedule: newToSchedule,
          total_distance: toSummary.totalDistance,
          total_duration: toSummary.totalDuration,
          total_stay_duration: toSummary.totalStayDuration,
          place_count: toSummary.placeCount,
        })
        .eq("trip_id", tripId)
        .eq("day_number", toDayNumber)
        .select()
        .single(),
    ]);

    if (fromUpdate.error || toUpdate.error) {
      console.error("일정 이동 오류:", fromUpdate.error || toUpdate.error);
      return {
        success: false,
        error: "일정 이동에 실패했습니다.",
      };
    }

    // 10. 캐시 무효화
    invalidateCache(tripId);

    return {
      success: true,
      data: {
        fromDay: convertRowToItinerary(fromUpdate.data as TripItineraryRow),
        toDay: convertRowToItinerary(toUpdate.data as TripItineraryRow),
      },
    };
  } catch (error) {
    console.error("일정 이동 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 단일 일정 항목 수정 Server Action
 *
 * 특정 일정 항목의 시간이나 체류시간 등을 수정합니다.
 *
 * @param tripId - 여행 ID
 * @param dayNumber - 일차 번호
 * @param placeId - 수정할 장소 ID
 * @param updates - 수정할 데이터
 * @returns 수정된 항목 또는 에러
 *
 * @example
 * ```tsx
 * const result = await updateScheduleItem(
 *   "trip-uuid",
 *   1,
 *   "place-uuid",
 *   {
 *     arrivalTime: "11:00",
 *     departureTime: "13:00",
 *     duration: 120,
 *   }
 * );
 * ```
 */
export async function updateScheduleItem(
  tripId: string,
  dayNumber: number,
  placeId: string,
  updates: UpdateScheduleItemInput,
): Promise<UpdateScheduleItemResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. 검증
    if (!isValidUUID(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 30) {
      return {
        success: false,
        error: "유효하지 않은 일차 번호입니다. (1~30)",
      };
    }

    if (updates.arrivalTime && !isValidTime(updates.arrivalTime)) {
      return {
        success: false,
        error: "올바르지 않은 도착 시간 형식입니다. (HH:mm)",
      };
    }

    if (updates.departureTime && !isValidTime(updates.departureTime)) {
      return {
        success: false,
        error: "올바르지 않은 출발 시간 형식입니다. (HH:mm)",
      };
    }

    if (updates.duration !== undefined) {
      if (updates.duration < 30 || updates.duration > 720) {
        return {
          success: false,
          error: "체류 시간은 30분~720분 사이여야 합니다.",
        };
      }
      if (updates.duration % 30 !== 0) {
        return {
          success: false,
          error: "체류 시간은 30분 단위여야 합니다.",
        };
      }
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 기존 일정 조회
    const { data: existingData, error: fetchError } = await supabase
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", tripId)
      .eq("day_number", dayNumber)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return {
          success: false,
          error: `${dayNumber}일차 일정을 찾을 수 없습니다.`,
        };
      }
      console.error("일정 조회 오류:", fetchError);
      return {
        success: false,
        error: "일정 조회에 실패했습니다.",
      };
    }

    const existingRow = existingData as TripItineraryRow;

    // 5. 항목 찾기 및 수정
    const itemIndex = existingRow.schedule.findIndex(
      (item) => item.place_id === placeId,
    );
    if (itemIndex === -1) {
      return {
        success: false,
        error: "수정할 일정 항목을 찾을 수 없습니다.",
      };
    }

    const updatedSchedule = [...existingRow.schedule];
    const targetItem = { ...updatedSchedule[itemIndex] };

    if (updates.placeId !== undefined) {
      targetItem.place_id = updates.placeId;
    }
    if (updates.placeName !== undefined) {
      targetItem.place_name = updates.placeName;
    }
    if (updates.arrivalTime !== undefined) {
      targetItem.arrival_time = updates.arrivalTime;
    }
    if (updates.departureTime !== undefined) {
      targetItem.departure_time = updates.departureTime;
    }
    if (updates.duration !== undefined) {
      targetItem.duration = updates.duration;
    }

    updatedSchedule[itemIndex] = targetItem;

    // 6. 요약 정보 재계산
    const summary = recalculateSummary(updatedSchedule.map(convertRowToItem));

    // 7. 일정 업데이트
    const { error: updateError } = await supabase
      .from("trip_itineraries")
      .update({
        schedule: updatedSchedule,
        total_stay_duration: summary.totalStayDuration,
      })
      .eq("trip_id", tripId)
      .eq("day_number", dayNumber);

    if (updateError) {
      console.error("일정 항목 수정 오류:", updateError);
      return {
        success: false,
        error: "일정 항목 수정에 실패했습니다.",
      };
    }

    // 8. 캐시 무효화
    invalidateCache(tripId, dayNumber);

    return {
      success: true,
      data: convertRowToItem(targetItem),
    };
  } catch (error) {
    console.error("일정 항목 수정 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 일정 항목 삭제 Server Action
 *
 * 특정 일차에서 일정 항목을 삭제합니다.
 *
 * @param tripId - 여행 ID
 * @param dayNumber - 일차 번호
 * @param placeId - 삭제할 장소 ID
 * @returns 수정된 일정 또는 에러
 *
 * @example
 * ```tsx
 * const result = await deleteScheduleItem("trip-uuid", 1, "place-uuid");
 * if (result.success) {
 *   console.log("항목이 삭제되었습니다.");
 * }
 * ```
 */
export async function deleteScheduleItem(
  tripId: string,
  dayNumber: number,
  placeId: string,
): Promise<UpdateItineraryResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. 검증
    if (!isValidUUID(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 30) {
      return {
        success: false,
        error: "유효하지 않은 일차 번호입니다. (1~30)",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 기존 일정 조회
    const { data: existingData, error: fetchError } = await supabase
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", tripId)
      .eq("day_number", dayNumber)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return {
          success: false,
          error: `${dayNumber}일차 일정을 찾을 수 없습니다.`,
        };
      }
      console.error("일정 조회 오류:", fetchError);
      return {
        success: false,
        error: "일정 조회에 실패했습니다.",
      };
    }

    const existingRow = existingData as TripItineraryRow;

    // 5. 항목 찾기
    const itemIndex = existingRow.schedule.findIndex(
      (item) => item.place_id === placeId,
    );
    if (itemIndex === -1) {
      return {
        success: false,
        error: "삭제할 일정 항목을 찾을 수 없습니다.",
      };
    }

    // 6. 항목 삭제 및 순서 재할당
    const newSchedule = existingRow.schedule
      .filter((_, i) => i !== itemIndex)
      .map((item, index) => ({ ...item, order: index + 1 }));

    // 7. 요약 정보 재계산
    const summary = recalculateSummary(newSchedule.map(convertRowToItem));

    // 8. 일정 업데이트
    const { data, error: updateError } = await supabase
      .from("trip_itineraries")
      .update({
        schedule: newSchedule,
        total_distance: summary.totalDistance,
        total_duration: summary.totalDuration,
        total_stay_duration: summary.totalStayDuration,
        place_count: summary.placeCount,
      })
      .eq("trip_id", tripId)
      .eq("day_number", dayNumber)
      .select()
      .single();

    if (updateError) {
      console.error("일정 항목 삭제 오류:", updateError);
      return {
        success: false,
        error: "일정 항목 삭제에 실패했습니다.",
      };
    }

    // 9. 캐시 무효화
    invalidateCache(tripId, dayNumber);

    return {
      success: true,
      data: convertRowToItinerary(data as TripItineraryRow),
    };
  } catch (error) {
    console.error("일정 항목 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
