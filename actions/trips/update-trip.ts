"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { updateTripSchema, type UpdateTripInput } from "@/lib/schemas";
import type { Trip, TripRow } from "@/types";

/**
 * 여행 수정 결과
 */
export interface UpdateTripResult {
  success: boolean;
  data?: Trip;
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
 * 여행 수정 Server Action
 *
 * @param tripId - 여행 ID
 * @param input - 수정할 데이터 (부분 업데이트 지원)
 * @returns 수정된 여행 정보 또는 에러
 *
 * @example
 * ```tsx
 * // 제목만 수정
 * const result = await updateTrip(tripId, { title: "새 제목" });
 *
 * // 여러 필드 수정
 * const result = await updateTrip(tripId, {
 *   title: "수정된 여행",
 *   startDate: "2025-01-20",
 *   endDate: "2025-01-22",
 * });
 * ```
 */
export async function updateTrip(
  tripId: string,
  input: UpdateTripInput
): Promise<UpdateTripResult> {
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

    // 3. Zod 스키마 검증
    const validationResult = updateTripSchema.safeParse(input);
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

    // 4. 빈 업데이트 체크
    if (Object.keys(validatedData).length === 0) {
      return {
        success: false,
        error: "수정할 내용이 없습니다.",
      };
    }

    // 5. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 6. 업데이트 데이터 구성 (snake_case 변환)
    const updateData: Record<string, unknown> = {};

    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }
    if (validatedData.startDate !== undefined) {
      updateData.start_date = validatedData.startDate;
    }
    if (validatedData.endDate !== undefined) {
      updateData.end_date = validatedData.endDate;
    }
    if (validatedData.origin !== undefined) {
      updateData.origin = validatedData.origin;
    }
    if (validatedData.destination !== undefined) {
      updateData.destination = validatedData.destination;
    }
    if (validatedData.dailyStartTime !== undefined) {
      updateData.daily_start_time = validatedData.dailyStartTime;
    }
    if (validatedData.dailyEndTime !== undefined) {
      updateData.daily_end_time = validatedData.dailyEndTime;
    }
    if (validatedData.transportModes !== undefined) {
      updateData.transport_mode = validatedData.transportModes;
    }
    if (validatedData.accommodations !== undefined) {
      updateData.accommodations = validatedData.accommodations;
    }
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
    }

    // 여행 정보가 변경되면 기존 최적화 결과가 무효화되므로 status를 draft로 변경
    // 단, status가 명시적으로 전달된 경우는 제외 (명시적 상태 변경 허용)
    if (validatedData.status === undefined && Object.keys(updateData).length > 0) {
      // 현재 trip 상태 확인
      const { data: currentTrip } = await supabase
        .from("trips")
        .select("status")
        .eq("id", tripId)
        .single();

      // optimized 상태였다면 draft로 변경
      if (currentTrip?.status === "optimized") {
        updateData.status = "draft";
      }
    }

    // 7. 여행 수정 (RLS가 자동으로 본인 여행만 수정)
    const { data, error } = await supabase
      .from("trips")
      .update(updateData)
      .eq("id", tripId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return {
          success: false,
          error: "여행을 찾을 수 없거나 수정 권한이 없습니다.",
        };
      }
      console.error("여행 수정 오류:", error);
      return {
        success: false,
        error: "여행 수정에 실패했습니다.",
      };
    }

    // 8. 캐시 무효화
    revalidatePath("/my");
    revalidatePath(`/plan/${tripId}`);

    return {
      success: true,
      data: convertRowToTrip(data as TripRow),
    };
  } catch (error) {
    console.error("여행 수정 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 여행 상태 변경 Server Action
 *
 * @param tripId - 여행 ID
 * @param status - 새로운 상태
 * @returns 수정된 여행 정보 또는 에러
 */
export async function updateTripStatus(
  tripId: string,
  status: "draft" | "optimizing" | "optimized" | "completed"
): Promise<UpdateTripResult> {
  return updateTrip(tripId, { status });
}
