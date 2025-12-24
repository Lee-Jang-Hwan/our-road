"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";

/**
 * 여행 삭제 결과
 */
export interface DeleteTripResult {
  success: boolean;
  error?: string;
}

/**
 * 여행 삭제 Server Action
 *
 * 관련 데이터(장소, 고정일정, 일정표)는 CASCADE로 자동 삭제됩니다.
 *
 * @param tripId - 삭제할 여행 ID
 * @returns 성공 여부 또는 에러
 *
 * @example
 * ```tsx
 * const result = await deleteTrip(tripId);
 * if (result.success) {
 *   // 삭제 성공
 *   router.push("/my");
 * }
 * ```
 */
export async function deleteTrip(tripId: string): Promise<DeleteTripResult> {
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

    // 4. 여행 삭제 (RLS가 자동으로 본인 여행만 삭제)
    // CASCADE 설정으로 관련 데이터 자동 삭제:
    // - trip_places
    // - trip_fixed_schedules
    // - trip_itineraries
    const { error } = await supabase.from("trips").delete().eq("id", tripId);

    if (error) {
      console.error("여행 삭제 오류:", error);
      return {
        success: false,
        error: "여행 삭제에 실패했습니다.",
      };
    }

    // 5. 캐시 무효화
    revalidatePath("/my");
    revalidatePath("/plan");

    return {
      success: true,
    };
  } catch (error) {
    console.error("여행 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 여러 여행 일괄 삭제 Server Action
 *
 * @param tripIds - 삭제할 여행 ID 배열
 * @returns 성공 여부 및 삭제된 수 또는 에러
 */
export async function deleteTrips(
  tripIds: string[]
): Promise<DeleteTripResult & { deletedCount?: number }> {
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
    if (!tripIds || tripIds.length === 0) {
      return {
        success: false,
        error: "삭제할 여행을 선택해주세요.",
      };
    }

    if (tripIds.length > 50) {
      return {
        success: false,
        error: "한 번에 최대 50개까지 삭제할 수 있습니다.",
      };
    }

    // 3. UUID 형식 검증
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const tripId of tripIds) {
      if (!uuidRegex.test(tripId)) {
        return {
          success: false,
          error: "올바르지 않은 여행 ID가 포함되어 있습니다.",
        };
      }
    }

    // 4. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 5. 여행 일괄 삭제
    const { error } = await supabase
      .from("trips")
      .delete()
      .in("id", tripIds);

    if (error) {
      console.error("여행 일괄 삭제 오류:", error);
      return {
        success: false,
        error: "여행 삭제에 실패했습니다.",
      };
    }

    // 6. 캐시 무효화
    revalidatePath("/my");
    revalidatePath("/plan");

    return {
      success: true,
      deletedCount: tripIds.length,
    };
  } catch (error) {
    console.error("여행 일괄 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
