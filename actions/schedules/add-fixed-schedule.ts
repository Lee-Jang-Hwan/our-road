"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import {
  createFixedScheduleSchema,
  type CreateFixedScheduleInput,
} from "@/lib/schemas";
import type { FixedSchedule, TripFixedScheduleRow } from "@/types";

/**
 * 고정 일정 추가 결과
 */
export interface AddFixedScheduleResult {
  success: boolean;
  data?: FixedSchedule;
  error?: string;
}

/**
 * TripFixedScheduleRow를 FixedSchedule로 변환
 */
function convertRowToFixedSchedule(row: TripFixedScheduleRow): FixedSchedule {
  return {
    id: row.id,
    placeId: row.place_id ?? "",
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    note: row.note ?? undefined,
  };
}

/**
 * 고정 일정 추가 Server Action
 *
 * @param input - 고정 일정 생성 데이터
 * @returns 생성된 고정 일정 정보 또는 에러
 *
 * @example
 * ```tsx
 * const result = await addFixedSchedule({
 *   tripId: "uuid",
 *   placeId: "uuid",
 *   date: "2025-01-15",
 *   startTime: "12:00",
 *   endTime: "14:00",
 *   note: "점심 예약",
 * });
 * ```
 */
export async function addFixedSchedule(
  input: CreateFixedScheduleInput
): Promise<AddFixedScheduleResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. Zod 스키마 검증
    const validationResult = createFixedScheduleSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    const validatedData = validationResult.data;

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 여행 소유권 확인 및 여행 기간 조회
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, start_date, end_date")
      .eq("id", validatedData.tripId)
      .single();

    if (tripError || !trip) {
      return {
        success: false,
        error: "여행을 찾을 수 없거나 접근 권한이 없습니다.",
      };
    }

    // 5. 날짜가 여행 기간 내에 있는지 확인
    if (validatedData.date < trip.start_date || validatedData.date > trip.end_date) {
      return {
        success: false,
        error: `날짜는 여행 기간(${trip.start_date} ~ ${trip.end_date}) 내여야 합니다.`,
      };
    }

    // 6. 장소가 해당 여행에 속하는지 확인
    const { data: place, error: placeError } = await supabase
      .from("trip_places")
      .select("id")
      .eq("id", validatedData.placeId)
      .eq("trip_id", validatedData.tripId)
      .single();

    if (placeError || !place) {
      return {
        success: false,
        error: "장소를 찾을 수 없거나 해당 여행에 속하지 않습니다.",
      };
    }

    // 7. 같은 날짜/시간에 충돌하는 고정 일정이 있는지 확인
    const { data: conflictingSchedules } = await supabase
      .from("trip_fixed_schedules")
      .select("id, start_time, end_time")
      .eq("trip_id", validatedData.tripId)
      .eq("date", validatedData.date);

    if (conflictingSchedules && conflictingSchedules.length > 0) {
      const hasConflict = conflictingSchedules.some((schedule) => {
        // 시간 겹침 확인: 새 일정의 시작시간이 기존 종료시간 전이고,
        // 새 일정의 종료시간이 기존 시작시간 후이면 겹침
        return (
          validatedData.startTime < schedule.end_time &&
          validatedData.endTime > schedule.start_time
        );
      });

      if (hasConflict) {
        return {
          success: false,
          error: "해당 시간대에 이미 다른 고정 일정이 있습니다.",
        };
      }
    }

    // 8. 여행당 고정 일정 최대 개수 확인 (최대 20개)
    const { count, error: countError } = await supabase
      .from("trip_fixed_schedules")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", validatedData.tripId);

    if (countError) {
      console.error("고정 일정 수 조회 오류:", countError);
      return {
        success: false,
        error: "고정 일정 수 확인에 실패했습니다.",
      };
    }

    if (count && count >= 20) {
      return {
        success: false,
        error: "여행당 최대 20개의 고정 일정만 추가할 수 있습니다.",
      };
    }

    // 9. 고정 일정 추가
    const { data, error } = await supabase
      .from("trip_fixed_schedules")
      .insert({
        trip_id: validatedData.tripId,
        place_id: validatedData.placeId,
        date: validatedData.date,
        start_time: validatedData.startTime,
        end_time: validatedData.endTime,
        note: validatedData.note ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("고정 일정 추가 오류:", error);
      return {
        success: false,
        error: "고정 일정 추가에 실패했습니다. 다시 시도해주세요.",
      };
    }

    // 10. 캐시 무효화
    revalidatePath(`/plan/${validatedData.tripId}`);
    revalidatePath(`/plan/${validatedData.tripId}/schedule`);

    return {
      success: true,
      data: convertRowToFixedSchedule(data as TripFixedScheduleRow),
    };
  } catch (error) {
    console.error("고정 일정 추가 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}
