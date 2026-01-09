"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { updatePlaceSchema, type UpdatePlaceInput } from "@/lib/schemas";
import type { Place, TripPlaceRow } from "@/types";

/**
 * 장소 수정 결과
 */
export interface UpdatePlaceResult {
  success: boolean;
  data?: Place;
  error?: string;
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
 * 장소 수정 Server Action
 *
 * @param placeId - 수정할 장소 ID
 * @param tripId - 여행 ID
 * @param input - 수정할 장소 데이터 (부분 업데이트)
 * @returns 수정된 장소 정보 또는 에러
 *
 * @example
 * ```tsx
 * const result = await updatePlace(placeId, tripId, {
 *   estimatedDuration: 90, // 1시간 30분
 *   category: "cafe",
 * });
 * ```
 */
export async function updatePlace(
  placeId: string,
  tripId: string,
  input: UpdatePlaceInput
): Promise<UpdatePlaceResult> {
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

    // 3. Zod 스키마 검증
    const validationResult = updatePlaceSchema.safeParse(input);
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

    // 5. 장소가 해당 여행에 속하는지 확인 및 여행 소유권 확인
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

    // 6. 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.address !== undefined) updateData.address = validatedData.address;
    if (validatedData.lat !== undefined) updateData.lat = validatedData.lat;
    if (validatedData.lng !== undefined) updateData.lng = validatedData.lng;
    if (validatedData.category !== undefined) updateData.category = validatedData.category;
    if (validatedData.estimatedDuration !== undefined) {
      updateData.estimated_duration = validatedData.estimatedDuration;
    }
    if (validatedData.priority !== undefined) updateData.priority = validatedData.priority;

    // 7. 장소 수정
    const { data, error } = await supabase
      .from("trip_places")
      .update(updateData)
      .eq("id", placeId)
      .select()
      .single();

    if (error) {
      console.error("장소 수정 오류:", error);
      return {
        success: false,
        error: "장소 수정에 실패했습니다.",
      };
    }

    // 8. 여행 상태를 draft로 변경 (optimized 상태일 때만)
    const { data: tripBeforeUpdate } = await supabase
      .from("trips")
      .select("status")
      .eq("id", tripId)
      .single();

    if (tripBeforeUpdate?.status === "optimized") {
      console.log("🔄 [Trip Status Change] 장소 수정으로 인한 상태 변경", {
        tripId,
        placeId,
        from: "optimized",
        to: "draft",
        reason: "place_updated",
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
    revalidatePath(`/plan/${tripId}/places`);

    return {
      success: true,
      data: convertRowToPlace(data as TripPlaceRow),
    };
  } catch (error) {
    console.error("장소 수정 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 장소 체류 시간만 수정하는 Server Action
 *
 * @param placeId - 수정할 장소 ID
 * @param tripId - 여행 ID
 * @param duration - 새로운 체류 시간 (분) - 30~720분, 30분 단위
 * @returns 수정된 장소 정보 또는 에러
 */
export async function updatePlaceDuration(
  placeId: string,
  tripId: string,
  duration: number
): Promise<UpdatePlaceResult> {
  return updatePlace(placeId, tripId, { estimatedDuration: duration });
}
