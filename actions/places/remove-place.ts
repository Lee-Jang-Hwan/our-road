"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";

/**
 * 장소 삭제 결과
 */
export interface RemovePlaceResult {
  success: boolean;
  error?: string;
}

/**
 * 장소 삭제 Server Action
 *
 * @param placeId - 삭제할 장소 ID
 * @param tripId - 여행 ID (캐시 무효화용)
 * @returns 성공 여부 또는 에러
 *
 * @example
 * ```tsx
 * const result = await removePlace(placeId, tripId);
 * if (result.success) {
 *   // 삭제 성공
 * }
 * ```
 */
export async function removePlace(
  placeId: string,
  tripId: string
): Promise<RemovePlaceResult> {
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
    if (!uuidRegex.test(placeId)) {
      return {
        success: false,
        error: "올바르지 않은 장소 ID입니다.",
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

    // 4. 장소가 해당 여행에 속하는지 확인 및 여행 소유권 확인
    const { data: place, error: placeError } = await supabase
      .from("trip_places")
      .select("id, trip_id")
      .eq("id", placeId)
      .eq("trip_id", tripId)
      .single();

    if (placeError || !place) {
      return {
        success: false,
        error: "장소를 찾을 수 없거나 접근 권한이 없습니다.",
      };
    }

    // 5. 장소 삭제
    const { error } = await supabase
      .from("trip_places")
      .delete()
      .eq("id", placeId);

    if (error) {
      console.error("장소 삭제 오류:", error);
      return {
        success: false,
        error: "장소 삭제에 실패했습니다.",
      };
    }

    // 6. 캐시 무효화
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/plan/${tripId}/places`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("장소 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 여러 장소 일괄 삭제 Server Action
 *
 * @param placeIds - 삭제할 장소 ID 배열
 * @param tripId - 여행 ID
 * @returns 성공 여부 및 삭제된 수 또는 에러
 */
export async function removePlaces(
  placeIds: string[],
  tripId: string
): Promise<RemovePlaceResult & { deletedCount?: number }> {
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
    if (!placeIds || placeIds.length === 0) {
      return {
        success: false,
        error: "삭제할 장소를 선택해주세요.",
      };
    }

    if (placeIds.length > 50) {
      return {
        success: false,
        error: "한 번에 최대 50개까지 삭제할 수 있습니다.",
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

    for (const placeId of placeIds) {
      if (!uuidRegex.test(placeId)) {
        return {
          success: false,
          error: "올바르지 않은 장소 ID가 포함되어 있습니다.",
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

    // 6. 장소 일괄 삭제
    const { error } = await supabase
      .from("trip_places")
      .delete()
      .eq("trip_id", tripId)
      .in("id", placeIds);

    if (error) {
      console.error("장소 일괄 삭제 오류:", error);
      return {
        success: false,
        error: "장소 삭제에 실패했습니다.",
      };
    }

    // 7. 캐시 무효화
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/plan/${tripId}/places`);

    return {
      success: true,
      deletedCount: placeIds.length,
    };
  } catch (error) {
    console.error("장소 일괄 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
