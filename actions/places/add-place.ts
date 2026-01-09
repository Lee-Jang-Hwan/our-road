"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { createPlaceSchema, type CreatePlaceInput } from "@/lib/schemas";
import type { Place, TripPlaceRow } from "@/types";

/**
 * 장소 추가 결과
 */
export interface AddPlaceResult {
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
 * 장소 추가 Server Action
 *
 * @param input - 장소 생성 데이터
 * @returns 생성된 장소 정보 또는 에러
 *
 * @example
 * ```tsx
 * const result = await addPlace({
 *   tripId: "uuid",
 *   name: "경복궁",
 *   address: "서울 종로구 사직로 161",
 *   lat: 37.5796,
 *   lng: 126.9770,
 *   category: "tourist_attraction",
 *   estimatedDuration: 120, // 2시간
 * });
 * ```
 */
export async function addPlace(input: CreatePlaceInput): Promise<AddPlaceResult> {
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
    const validationResult = createPlaceSchema.safeParse(input);
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

    // 4. 여행 소유권 확인
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id")
      .eq("id", validatedData.tripId)
      .single();

    if (tripError || !trip) {
      return {
        success: false,
        error: "여행을 찾을 수 없거나 접근 권한이 없습니다.",
      };
    }

    // 5. 현재 장소 수 확인 (최대 개수 제한)
    const { count, error: countError } = await supabase
      .from("trip_places")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", validatedData.tripId);

    if (countError) {
      console.error("장소 수 조회 오류:", countError);
      return {
        success: false,
        error: "장소 수 확인에 실패했습니다.",
      };
    }

    // 여행당 최대 50개 장소 제한
    if (count && count >= 50) {
      return {
        success: false,
        error: "여행당 최대 50개의 장소만 추가할 수 있습니다.",
      };
    }

    // 6. 다음 priority 값 계산
    const { data: lastPlace } = await supabase
      .from("trip_places")
      .select("priority")
      .eq("trip_id", validatedData.tripId)
      .order("priority", { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    const nextPriority = validatedData.priority ?? ((lastPlace?.priority ?? 0) + 1);

    // 7. 장소 추가
    const { data, error } = await supabase
      .from("trip_places")
      .insert({
        trip_id: validatedData.tripId,
        name: validatedData.name,
        address: validatedData.address,
        lat: validatedData.lat,
        lng: validatedData.lng,
        category: validatedData.category ?? null,
        kakao_place_id: validatedData.kakaoPlaceId ?? null,
        estimated_duration: validatedData.estimatedDuration,
        priority: nextPriority,
      })
      .select()
      .single();

    if (error) {
      console.error("장소 추가 오류:", error);
      return {
        success: false,
        error: "장소 추가에 실패했습니다. 다시 시도해주세요.",
      };
    }

    // 8. 여행 상태를 draft로 변경 (optimized 상태일 때만)
    const { data: tripBeforeUpdate } = await supabase
      .from("trips")
      .select("status")
      .eq("id", validatedData.tripId)
      .single();

    if (tripBeforeUpdate?.status === "optimized") {
      const { error: statusUpdateError } = await supabase
        .from("trips")
        .update({ status: "draft" })
        .eq("id", validatedData.tripId)
        .eq("status", "optimized");

      if (statusUpdateError) {
        console.error("❌ [Trip Status Change] 상태 변경 실패", {
          tripId: validatedData.tripId,
          error: statusUpdateError,
        });
      }
    }

    // 9. 캐시 무효화
    revalidatePath(`/plan/${validatedData.tripId}`);
    revalidatePath(`/plan/${validatedData.tripId}/places`);

    return {
      success: true,
      data: convertRowToPlace(data as TripPlaceRow),
    };
  } catch (error) {
    console.error("장소 추가 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}
