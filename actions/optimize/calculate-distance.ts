"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { coordinateSchema, transportModeSchema } from "@/lib/schemas";
import type { DistanceMatrix } from "@/types/optimize";
import type { Coordinate } from "@/types/place";
import type { TransportMode } from "@/types/route";
import type { OptimizeNode, DistanceEntry } from "@/lib/optimize/types";
import {
  createDistanceMatrix,
  createHaversineDistanceMatrix,
  getDistanceEntry,
} from "@/lib/optimize";
import { z } from "zod";

// ============================================
// Types
// ============================================

/**
 * 단일 거리 계산 입력
 */
export interface CalculateSingleDistanceInput {
  origin: Coordinate;
  destination: Coordinate;
  mode: TransportMode;
}

/**
 * 단일 거리 계산 결과
 */
export interface CalculateSingleDistanceResult {
  success: boolean;
  data?: DistanceEntry;
  error?: string;
}

/**
 * 거리 행렬 계산 입력
 */
export interface CalculateDistanceMatrixInput {
  tripId: string;
  mode?: TransportMode;
  useApi?: boolean;
}

/**
 * 거리 행렬 계산 결과
 */
export interface CalculateDistanceMatrixResult {
  success: boolean;
  data?: DistanceMatrix;
  error?: string;
}

/**
 * 두 장소 간 거리 조회 입력
 */
export interface GetDistanceInput {
  tripId: string;
  fromPlaceId: string;
  toPlaceId: string;
  mode?: TransportMode;
}

/**
 * 두 장소 간 거리 조회 결과
 */
export interface GetDistanceResult {
  success: boolean;
  data?: DistanceEntry;
  error?: string;
}

// ============================================
// Validation Schemas
// ============================================

const singleDistanceSchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  mode: transportModeSchema,
});

const distanceMatrixSchema = z.object({
  tripId: z
    .string()
    .uuid("올바르지 않은 여행 ID입니다."),
  mode: transportModeSchema.optional().default("public"),
  useApi: z.boolean().optional().default(false),
});

// ============================================
// Server Actions
// ============================================

/**
 * 두 좌표 간 거리 계산 Server Action (단독 호출용)
 *
 * @param input - 출발지, 도착지, 이동수단
 * @returns 거리/시간 정보
 *
 * @example
 * ```tsx
 * const result = await calculateDistance({
 *   origin: { lat: 37.5665, lng: 126.9780 },
 *   destination: { lat: 37.5796, lng: 126.9770 },
 *   mode: "car",
 * });
 * if (result.success) {
 *   console.log(`거리: ${result.data.distance}m, 시간: ${result.data.duration}분`);
 * }
 * ```
 */
export async function calculateDistance(
  input: CalculateSingleDistanceInput
): Promise<CalculateSingleDistanceResult> {
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
    const validationResult = singleDistanceSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { origin, destination, mode } = validationResult.data;

    // 3. 두 지점으로 노드 생성
    const originCoord: Coordinate = { lat: origin.lat, lng: origin.lng };
    const destCoord: Coordinate = { lat: destination.lat, lng: destination.lng };

    const nodes: OptimizeNode[] = [
      {
        id: "origin",
        name: "출발지",
        coordinate: originCoord,
        duration: 0,
        priority: 0,
        isFixed: false,
      },
      {
        id: "destination",
        name: "도착지",
        coordinate: destCoord,
        duration: 0,
        priority: 0,
        isFixed: false,
      },
    ];

    // 4. 거리 행렬 계산 (API 사용)
    const matrix = await createDistanceMatrix(nodes, {
      mode,
      useApi: true,
    });

    // 5. 결과 추출
    const entry = getDistanceEntry(matrix, "origin", "destination");

    if (!entry) {
      return {
        success: false,
        error: "거리 계산에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: entry,
    };
  } catch (error) {
    console.error("거리 계산 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 여행의 모든 장소에 대한 거리 행렬 계산 Server Action
 *
 * @param input - 여행 ID 및 옵션
 * @returns 거리 행렬
 *
 * @example
 * ```tsx
 * const result = await calculateDistanceMatrix({
 *   tripId: "...",
 *   mode: "car",
 *   useApi: true,
 * });
 * if (result.success) {
 *   console.log(result.data); // DistanceMatrix
 * }
 * ```
 */
export async function calculateDistanceMatrix(
  input: CalculateDistanceMatrixInput
): Promise<CalculateDistanceMatrixResult> {
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
    const validationResult = distanceMatrixSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { tripId, mode, useApi } = validationResult.data;

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 여행 및 장소 조회
    const [tripResult, placesResult] = await Promise.all([
      supabase.from("trips").select("*").eq("id", tripId).single(),
      supabase
        .from("trip_places")
        .select("*")
        .eq("trip_id", tripId)
        .order("priority", { ascending: true }),
    ]);

    if (tripResult.error || !tripResult.data) {
      return {
        success: false,
        error: "여행을 찾을 수 없습니다.",
      };
    }

    const trip = tripResult.data;
    const places = placesResult.data ?? [];

    if (places.length < 2) {
      return {
        success: false,
        error: "최소 2개 이상의 장소가 필요합니다.",
      };
    }

    // 5. 노드 생성 (출발지 + 장소들 + 도착지)
    const nodes: OptimizeNode[] = [
      // 출발지
      {
        id: "__origin__",
        name: trip.origin.name,
        coordinate: {
          lat: trip.origin.lat,
          lng: trip.origin.lng,
        },
        duration: 0,
        priority: 0,
        isFixed: false,
      },
      // 장소들
      ...places.map((place, index) => ({
        id: place.id,
        name: place.name,
        coordinate: {
          lat: place.lat,
          lng: place.lng,
        },
        duration: place.estimated_duration,
        priority: place.priority ?? index + 1,
        isFixed: false,
      })),
      // 도착지
      {
        id: "__destination__",
        name: trip.destination.name,
        coordinate: {
          lat: trip.destination.lat,
          lng: trip.destination.lng,
        },
        duration: 0,
        priority: 0,
        isFixed: false,
      },
    ];

    // 6. 거리 행렬 계산
    const matrix = await createDistanceMatrix(nodes, {
      mode: mode ?? "public",
      useApi: useApi ?? false,
      batchSize: 3,
    });

    return {
      success: true,
      data: matrix,
    };
  } catch (error) {
    console.error("거리 행렬 계산 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 빠른 거리 행렬 계산 (Haversine 기반, API 미사용)
 *
 * @param input - 여행 ID 및 이동수단
 * @returns 거리 행렬
 */
export async function calculateQuickDistanceMatrix(
  input: Omit<CalculateDistanceMatrixInput, "useApi">
): Promise<CalculateDistanceMatrixResult> {
  return calculateDistanceMatrix({
    ...input,
    useApi: false,
  });
}

/**
 * 두 장소 간 거리 조회 Server Action
 *
 * @param input - 여행 ID, 출발 장소 ID, 도착 장소 ID
 * @returns 거리/시간 정보
 */
export async function getPlaceDistance(
  input: GetDistanceInput
): Promise<GetDistanceResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    const { tripId, fromPlaceId, toPlaceId, mode } = input;

    // 2. UUID 형식 검증
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }
    if (!uuidRegex.test(fromPlaceId)) {
      return {
        success: false,
        error: "올바르지 않은 출발 장소 ID입니다.",
      };
    }
    if (!uuidRegex.test(toPlaceId)) {
      return {
        success: false,
        error: "올바르지 않은 도착 장소 ID입니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 두 장소 조회
    const { data: places, error } = await supabase
      .from("trip_places")
      .select("*")
      .eq("trip_id", tripId)
      .in("id", [fromPlaceId, toPlaceId]);

    if (error || !places || places.length !== 2) {
      return {
        success: false,
        error: "장소를 찾을 수 없습니다.",
      };
    }

    const fromPlace = places.find((p) => p.id === fromPlaceId);
    const toPlace = places.find((p) => p.id === toPlaceId);

    if (!fromPlace || !toPlace) {
      return {
        success: false,
        error: "장소를 찾을 수 없습니다.",
      };
    }

    // 5. 거리 계산
    const result = await calculateDistance({
      origin: { lat: fromPlace.lat, lng: fromPlace.lng },
      destination: { lat: toPlace.lat, lng: toPlace.lng },
      mode: mode ?? "public",
    });

    return result;
  } catch (error) {
    console.error("장소 간 거리 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
