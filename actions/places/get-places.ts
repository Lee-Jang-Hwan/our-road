"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import type { Place, TripPlaceRow } from "@/types";

/**
 * 장소 목록 조회 결과
 */
export interface GetPlacesResult {
  success: boolean;
  data?: Place[];
  error?: string;
}

/**
 * 단일 장소 조회 결과
 */
export interface GetPlaceResult {
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
 * 여행별 장소 목록 조회 Server Action
 *
 * @param tripId - 여행 ID
 * @returns 장소 목록 또는 에러
 *
 * @example
 * ```tsx
 * const result = await getPlaces(tripId);
 * if (result.success) {
 *   console.log(result.data); // Place[]
 * }
 * ```
 */
export async function getPlaces(tripId: string): Promise<GetPlacesResult> {
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

    // 5. 장소 목록 조회 (priority 순, 같으면 created_at 순)
    const { data, error } = await supabase
      .from("trip_places")
      .select("*")
      .eq("trip_id", tripId)
      .order("priority", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("장소 목록 조회 오류:", error);
      return {
        success: false,
        error: "장소 목록 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: (data ?? []).map((row) => convertRowToPlace(row as TripPlaceRow)),
    };
  } catch (error) {
    console.error("장소 목록 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 단일 장소 조회 Server Action
 *
 * @param placeId - 장소 ID
 * @param tripId - 여행 ID
 * @returns 장소 정보 또는 에러
 */
export async function getPlace(
  placeId: string,
  tripId: string
): Promise<GetPlaceResult> {
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

    // 4. 장소 조회 (RLS가 자동으로 본인 여행의 장소만 조회)
    const { data, error } = await supabase
      .from("trip_places")
      .select("*")
      .eq("id", placeId)
      .eq("trip_id", tripId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return {
          success: false,
          error: "장소를 찾을 수 없습니다.",
        };
      }
      console.error("장소 조회 오류:", error);
      return {
        success: false,
        error: "장소 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: convertRowToPlace(data as TripPlaceRow),
    };
  } catch (error) {
    console.error("장소 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 장소 개수 조회 Server Action
 *
 * @param tripId - 여행 ID
 * @returns 장소 개수 또는 에러
 */
export async function getPlaceCount(
  tripId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
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

    // 4. 장소 개수 조회
    const { count, error } = await supabase
      .from("trip_places")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId);

    if (error) {
      console.error("장소 개수 조회 오류:", error);
      return {
        success: false,
        error: "장소 개수 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      count: count ?? 0,
    };
  } catch (error) {
    console.error("장소 개수 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
