"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import {
  updateFixedScheduleSchema,
  type UpdateFixedScheduleInput,
} from "@/lib/schemas";
import type { FixedSchedule, TripFixedScheduleRow } from "@/types";

/**
 * 고정 일정 수정 결과
 */
export interface UpdateFixedScheduleResult {
  success: boolean;
  data?: FixedSchedule;
  error?: string;
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
 * 시작 시간과 체류 시간으로 종료 시간 계산
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = startMinutes + durationMinutes;
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  return `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
}

/**
 * 고정 일정 수정 Server Action
 *
 * @param scheduleId - 수정할 고정 일정 ID
 * @param tripId - 여행 ID
 * @param input - 수정할 데이터 (부분 업데이트)
 * @returns 수정된 고정 일정 정보 또는 에러
 *
 * @example
 * ```tsx
 * const result = await updateFixedSchedule(scheduleId, tripId, {
 *   startTime: "13:00",
 *   endTime: "15:00",
 * });
 * ```
 */
export async function updateFixedSchedule(
  scheduleId: string,
  tripId: string,
  input: UpdateFixedScheduleInput
): Promise<UpdateFixedScheduleResult> {
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
    if (!uuidRegex.test(scheduleId)) {
      return {
        success: false,
        error: "올바르지 않은 고정 일정 ID입니다.",
      };
    }
    if (!uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. Zod 스키마 검증
    const validationResult = updateFixedScheduleSchema.safeParse(input);
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

    // 업데이트할 데이터가 없는 경우
    if (Object.keys(validatedData).length === 0) {
      return {
        success: false,
        error: "수정할 데이터가 없습니다.",
      };
    }

    // 4. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 5. 기존 고정 일정 조회 및 여행 소유권 확인
    const { data: existingSchedule, error: scheduleError } = await supabase
      .from("trip_fixed_schedules")
      .select("*, trips!inner(start_date, end_date)")
      .eq("id", scheduleId)
      .eq("trip_id", tripId)
      .single();

    if (scheduleError || !existingSchedule) {
      return {
        success: false,
        error: "고정 일정을 찾을 수 없거나 접근 권한이 없습니다.",
      };
    }

    // 6. 날짜가 변경되는 경우 여행 기간 내인지 확인
    if (validatedData.date) {
      const tripData = existingSchedule.trips as { start_date: string; end_date: string };
      if (validatedData.date < tripData.start_date || validatedData.date > tripData.end_date) {
        return {
          success: false,
          error: `날짜는 여행 기간(${tripData.start_date} ~ ${tripData.end_date}) 내여야 합니다.`,
        };
      }
    }

    // 7. 장소 정보 조회 (변경된 경우 새 장소, 아니면 기존 장소)
    const targetPlaceId = validatedData.placeId ?? existingSchedule.place_id;
    const { data: place, error: placeError } = await supabase
      .from("trip_places")
      .select("id, estimated_duration")
      .eq("id", targetPlaceId)
      .eq("trip_id", tripId)
      .single();

    if (placeError || !place) {
      return {
        success: false,
        error: "장소를 찾을 수 없거나 해당 여행에 속하지 않습니다.",
      };
    }

    // 8. 시간이 변경되는 경우 충돌 확인
    const newDate = validatedData.date ?? existingSchedule.date;
    const newStartTime = validatedData.startTime ?? existingSchedule.start_time;
    const estimatedDuration = place.estimated_duration || 60; // 기본 1시간
    const newEndTime = calculateEndTime(newStartTime, estimatedDuration);

    // 같은 날짜의 다른 고정 일정과 충돌 확인
    const { data: conflictingSchedules } = await supabase
      .from("trip_fixed_schedules")
      .select("id, start_time, end_time")
      .eq("trip_id", tripId)
      .eq("date", newDate)
      .neq("id", scheduleId); // 자기 자신 제외

    if (conflictingSchedules && conflictingSchedules.length > 0) {
      const hasConflict = conflictingSchedules.some((schedule) => {
        return newStartTime < schedule.end_time && newEndTime > schedule.start_time;
      });

      if (hasConflict) {
        return {
          success: false,
          error: "해당 시간대에 이미 다른 고정 일정이 있습니다.",
        };
      }
    }

    // 9. 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {};
    if (validatedData.placeId !== undefined) updateData.place_id = validatedData.placeId;
    if (validatedData.date !== undefined) updateData.date = validatedData.date;
    if (validatedData.startTime !== undefined) {
      updateData.start_time = validatedData.startTime;
      // 시작 시간이 변경되면 종료 시간도 재계산
      updateData.end_time = newEndTime;
    }
    // 장소가 변경되면 종료 시간도 재계산 (체류 시간이 달라질 수 있음)
    if (validatedData.placeId !== undefined) {
      updateData.end_time = newEndTime;
    }
    if (validatedData.note !== undefined) updateData.note = validatedData.note;

    // 10. 고정 일정 수정
    const { data, error } = await supabase
      .from("trip_fixed_schedules")
      .update(updateData)
      .eq("id", scheduleId)
      .select()
      .single();

    if (error) {
      console.error("고정 일정 수정 오류:", error);
      return {
        success: false,
        error: "고정 일정 수정에 실패했습니다.",
      };
    }

    // 11. 여행 상태를 draft로 변경 (optimized 상태일 때만)
    const { data: tripBeforeUpdate } = await supabase
      .from("trips")
      .select("status")
      .eq("id", tripId)
      .single();

    if (tripBeforeUpdate?.status === "optimized") {
      console.log("🔄 [Trip Status Change] 고정 일정 수정으로 인한 상태 변경", {
        tripId,
        scheduleId,
        from: "optimized",
        to: "draft",
        reason: "fixed_schedule_updated",
        timestamp: new Date().toISOString(),
      });

      const { error: statusUpdateError } = await supabase
        .from("trips")
        .update({ status: "draft" })
        .eq("id", tripId)
        .eq("status", "optimized");

      if (statusUpdateError) {
        console.error("❌ [Trip Status Change] 상태 변경 실패", {
          tripId,
          error: statusUpdateError,
        });
      } else {
        console.log("✅ [Trip Status Change] 상태 변경 완료", {
          tripId,
          from: "optimized",
          to: "draft",
        });
      }
    }

    // 12. 캐시 무효화
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/plan/${tripId}/schedule`);

    return {
      success: true,
      data: convertRowToFixedSchedule(data as TripFixedScheduleRow),
    };
  } catch (error) {
    console.error("고정 일정 수정 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
