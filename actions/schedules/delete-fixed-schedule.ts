"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";

/**
 * 고정 일정 삭제 결과
 */
export interface DeleteFixedScheduleResult {
  success: boolean;
  error?: string;
}

/**
 * 고정 일정 삭제 Server Action
 *
 * @param scheduleId - 삭제할 고정 일정 ID
 * @param tripId - 여행 ID (캐시 무효화용)
 * @returns 성공 여부 또는 에러
 *
 * @example
 * ```tsx
 * const result = await deleteFixedSchedule(scheduleId, tripId);
 * if (result.success) {
 *   // 삭제 성공
 * }
 * ```
 */
export async function deleteFixedSchedule(
  scheduleId: string,
  tripId: string
): Promise<DeleteFixedScheduleResult> {
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

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 고정 일정이 해당 여행에 속하는지 확인 및 여행 소유권 확인
    const { data: schedule, error: scheduleError } = await supabase
      .from("trip_fixed_schedules")
      .select("id, trip_id")
      .eq("id", scheduleId)
      .eq("trip_id", tripId)
      .single();

    if (scheduleError || !schedule) {
      return {
        success: false,
        error: "고정 일정을 찾을 수 없거나 접근 권한이 없습니다.",
      };
    }

    // 5. 고정 일정 삭제
    const { error } = await supabase
      .from("trip_fixed_schedules")
      .delete()
      .eq("id", scheduleId);

    if (error) {
      console.error("고정 일정 삭제 오류:", error);
      return {
        success: false,
        error: "고정 일정 삭제에 실패했습니다.",
      };
    }

    // 6. 여행 상태를 draft로 변경 (optimized 상태일 때만)
    const { data: tripBeforeUpdate } = await supabase
      .from("trips")
      .select("status")
      .eq("id", tripId)
      .single();

    if (tripBeforeUpdate?.status === "optimized") {
      console.log("🔄 [Trip Status Change] 고정 일정 삭제로 인한 상태 변경", {
        tripId,
        scheduleId,
        from: "optimized",
        to: "draft",
        reason: "fixed_schedule_deleted",
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

    // 7. 캐시 무효화
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/plan/${tripId}/schedule`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("고정 일정 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 여러 고정 일정 일괄 삭제 Server Action
 *
 * @param scheduleIds - 삭제할 고정 일정 ID 배열
 * @param tripId - 여행 ID
 * @returns 성공 여부 및 삭제된 수 또는 에러
 */
export async function deleteFixedSchedules(
  scheduleIds: string[],
  tripId: string
): Promise<DeleteFixedScheduleResult & { deletedCount?: number }> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. 입력 검증
    if (!scheduleIds || scheduleIds.length === 0) {
      return {
        success: false,
        error: "삭제할 고정 일정을 선택해주세요.",
      };
    }

    if (scheduleIds.length > 20) {
      return {
        success: false,
        error: "한 번에 최대 20개까지 삭제할 수 있습니다.",
      };
    }

    // 3. UUID 형식 검증
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    for (const scheduleId of scheduleIds) {
      if (!uuidRegex.test(scheduleId)) {
        return {
          success: false,
          error: "올바르지 않은 고정 일정 ID가 포함되어 있습니다.",
        };
      }
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

    // 6. 고정 일정 일괄 삭제
    const { error } = await supabase
      .from("trip_fixed_schedules")
      .delete()
      .eq("trip_id", tripId)
      .in("id", scheduleIds);

    if (error) {
      console.error("고정 일정 일괄 삭제 오류:", error);
      return {
        success: false,
        error: "고정 일정 삭제에 실패했습니다.",
      };
    }

    // 7. 여행 상태를 draft로 변경 (optimized 상태일 때만)
    const { data: tripBeforeUpdate } = await supabase
      .from("trips")
      .select("status")
      .eq("id", tripId)
      .single();

    if (tripBeforeUpdate?.status === "optimized") {
      console.log("🔄 [Trip Status Change] 고정 일정 일괄 삭제로 인한 상태 변경", {
        tripId,
        scheduleIds,
        deletedCount: scheduleIds.length,
        from: "optimized",
        to: "draft",
        reason: "fixed_schedules_deleted_batch",
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

    // 8. 캐시 무효화
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/plan/${tripId}/schedule`);

    return {
      success: true,
      deletedCount: scheduleIds.length,
    };
  } catch (error) {
    console.error("고정 일정 일괄 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 특정 날짜의 모든 고정 일정 삭제 Server Action
 *
 * @param tripId - 여행 ID
 * @param date - 삭제할 날짜 (YYYY-MM-DD)
 * @returns 성공 여부 및 삭제된 수 또는 에러
 */
export async function deleteFixedSchedulesByDate(
  tripId: string,
  date: string
): Promise<DeleteFixedScheduleResult & { deletedCount?: number }> {
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

    // 3. 날짜 형식 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return {
        success: false,
        error: "올바르지 않은 날짜 형식입니다. (YYYY-MM-DD)",
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

    // 6. 해당 날짜의 고정 일정 수 확인
    const { count } = await supabase
      .from("trip_fixed_schedules")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .eq("date", date);

    // 7. 해당 날짜의 모든 고정 일정 삭제
    const { error } = await supabase
      .from("trip_fixed_schedules")
      .delete()
      .eq("trip_id", tripId)
      .eq("date", date);

    if (error) {
      console.error("날짜별 고정 일정 삭제 오류:", error);
      return {
        success: false,
        error: "고정 일정 삭제에 실패했습니다.",
      };
    }

    // 8. 여행 상태를 draft로 변경 (optimized 상태일 때만)
    const { data: tripBeforeUpdate } = await supabase
      .from("trips")
      .select("status")
      .eq("id", tripId)
      .single();

    if (tripBeforeUpdate?.status === "optimized") {
      console.log("🔄 [Trip Status Change] 날짜별 고정 일정 삭제로 인한 상태 변경", {
        tripId,
        date,
        deletedCount: count ?? 0,
        from: "optimized",
        to: "draft",
        reason: "fixed_schedules_deleted_by_date",
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

    // 9. 캐시 무효화
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/plan/${tripId}/schedule`);

    return {
      success: true,
      deletedCount: count ?? 0,
    };
  } catch (error) {
    console.error("날짜별 고정 일정 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
