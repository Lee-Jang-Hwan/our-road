"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { reorderPlacesSchema, type ReorderPlacesInput } from "@/lib/schemas";

/**
 * 장소 순서 변경 결과
 */
export interface ReorderPlacesResult {
  success: boolean;
  error?: string;
}

/**
 * 장소 순서 변경 Server Action
 *
 * 드래그 앤 드롭 등으로 장소 순서를 변경할 때 사용합니다.
 * placeIds 배열의 인덱스가 새로운 priority 값이 됩니다.
 *
 * @param input - 여행 ID와 새로운 순서의 장소 ID 배열
 * @returns 성공 여부 또는 에러
 *
 * @example
 * ```tsx
 * // 장소를 1번째에서 3번째로 이동
 * const result = await reorderPlaces({
 *   tripId: "uuid",
 *   placeIds: ["place-3-id", "place-1-id", "place-2-id"],
 * });
 * ```
 */
export async function reorderPlaces(
  input: ReorderPlacesInput
): Promise<ReorderPlacesResult> {
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
    const validationResult = reorderPlacesSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { tripId, placeIds } = validationResult.data;

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

    // 5. 모든 장소가 해당 여행에 속하는지 확인
    const { data: existingPlaces, error: placesError } = await supabase
      .from("trip_places")
      .select("id")
      .eq("trip_id", tripId)
      .in("id", placeIds);

    if (placesError) {
      console.error("장소 조회 오류:", placesError);
      return {
        success: false,
        error: "장소 확인에 실패했습니다.",
      };
    }

    if (!existingPlaces || existingPlaces.length !== placeIds.length) {
      return {
        success: false,
        error: "일부 장소를 찾을 수 없거나 해당 여행에 속하지 않습니다.",
      };
    }

    // 6. 각 장소의 priority 업데이트 (배열 인덱스 + 1)
    const updatePromises = placeIds.map((placeId, index) =>
      supabase
        .from("trip_places")
        .update({ priority: index + 1 })
        .eq("id", placeId)
        .eq("trip_id", tripId)
    );

    const results = await Promise.all(updatePromises);

    // 에러 확인
    const failedUpdate = results.find((result) => result.error);
    if (failedUpdate?.error) {
      console.error("장소 순서 변경 오류:", failedUpdate.error);
      return {
        success: false,
        error: "장소 순서 변경에 실패했습니다.",
      };
    }

    // 7. 캐시 무효화
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/plan/${tripId}/places`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("장소 순서 변경 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 단일 장소 순서 이동 Server Action
 *
 * @param placeId - 이동할 장소 ID
 * @param tripId - 여행 ID
 * @param newIndex - 새로운 위치 (0부터 시작)
 * @returns 성공 여부 또는 에러
 */
export async function movePlaceToIndex(
  placeId: string,
  tripId: string,
  newIndex: number
): Promise<ReorderPlacesResult> {
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
    if (!uuidRegex.test(placeId) || !uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 ID입니다.",
      };
    }

    if (newIndex < 0) {
      return {
        success: false,
        error: "위치는 0 이상이어야 합니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 현재 장소 목록 조회 (순서대로)
    const { data: places, error: placesError } = await supabase
      .from("trip_places")
      .select("id")
      .eq("trip_id", tripId)
      .order("priority", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (placesError) {
      console.error("장소 목록 조회 오류:", placesError);
      return {
        success: false,
        error: "장소 목록 조회에 실패했습니다.",
      };
    }

    if (!places || places.length === 0) {
      return {
        success: false,
        error: "장소가 없습니다.",
      };
    }

    // 5. 현재 장소 위치 찾기
    const currentIndex = places.findIndex((p) => p.id === placeId);
    if (currentIndex === -1) {
      return {
        success: false,
        error: "장소를 찾을 수 없습니다.",
      };
    }

    // 같은 위치면 변경 없음
    if (currentIndex === newIndex) {
      return { success: true };
    }

    // 6. 새로운 순서 배열 생성
    const placeIds = places.map((p) => p.id);
    const [movedPlace] = placeIds.splice(currentIndex, 1);
    const targetIndex = Math.min(newIndex, placeIds.length);
    placeIds.splice(targetIndex, 0, movedPlace);

    // 7. reorderPlaces 호출
    return reorderPlaces({ tripId, placeIds });
  } catch (error) {
    console.error("장소 이동 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
