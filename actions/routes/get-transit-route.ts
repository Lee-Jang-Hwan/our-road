"use server";

import { auth } from "@clerk/nextjs/server";
import { transitRouteSchema, type TransitRouteInput } from "@/lib/schemas";
import type { TransitRoute, Coordinate } from "@/types";
import { searchTransitRoute, ODsayApiError } from "@/lib/api/odsay";

// ============================================
// Types
// ============================================

/**
 * 대중교통 경로 조회 결과
 */
export interface GetTransitRouteResult {
  success: boolean;
  data?: {
    /** 최적 경로 */
    bestRoute: TransitRoute;
    /** 대안 경로들 */
    alternativeRoutes: TransitRoute[];
    /** 검색 메타 정보 */
    meta: {
      /** 출발-도착 직선거리 (미터) */
      pointDistance: number;
      /** 버스 경로 수 */
      busCount: number;
      /** 지하철 경로 수 */
      subwayCount: number;
      /** 버스+지하철 경로 수 */
      subwayBusCount: number;
    };
  };
  error?: {
    code: "ROUTE_NOT_FOUND" | "API_ERROR" | "INVALID_COORDINATES" | "TIMEOUT" | "AUTH_ERROR" | "VALIDATION_ERROR";
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================
// Server Action
// ============================================

/**
 * 대중교통 경로 조회 Server Action (ODsay API)
 *
 * 두 지점 간의 대중교통 경로를 조회합니다.
 * **중요**: 대중교통 경로로만 조회하며, 다른 수단으로 자동 전환하지 않습니다.
 * 경로가 없으면 ROUTE_NOT_FOUND 에러를 반환합니다.
 *
 * @param input - 경로 조회 조건
 * @returns 대중교통 경로 정보 또는 에러
 *
 * @example
 * ```tsx
 * const result = await getTransitRoute({
 *   origin: { lat: 37.5665, lng: 126.9780 },
 *   destination: { lat: 37.5796, lng: 126.9770 },
 *   sortType: 0, // 추천순
 * });
 * ```
 */
export async function getTransitRoute(
  input: TransitRouteInput
): Promise<GetTransitRouteResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "로그인이 필요합니다.",
        },
      };
    }

    // 2. Zod 스키마 검증
    const validationResult = transitRouteSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: errorMessage,
        },
      };
    }

    const { origin, destination, sortType, searchType, limit } =
      validationResult.data;

    // 3. lib/api/odsay.ts의 searchTransitRoute 사용
    const result = await searchTransitRoute({
      origin,
      destination,
      sortType,
      searchType,
    });

    // 경로가 없는 경우
    if (!result) {
      return {
        success: false,
        error: {
          code: "ROUTE_NOT_FOUND",
          message: "해당 경로를 찾을 수 없습니다. 출발지와 도착지를 확인해주세요.",
        },
      };
    }

    // limit 적용
    let routes = result.routes;
    if (limit && routes.length > limit) {
      routes = routes.slice(0, limit);
    }

    // 4. 결과 반환
    return {
      success: true,
      data: {
        bestRoute: routes[0],
        alternativeRoutes: routes.slice(1),
        meta: result.meta,
      },
    };
  } catch (error) {
    // ODsayApiError 처리
    if (error instanceof ODsayApiError) {
      console.error("[Server Action] ODsay API 에러:", error.code, error.message);

      // 경로 없음 에러 (-98, -99)
      if (error.code === -98 || error.code === -99) {
        return {
          success: false,
          error: {
            code: "ROUTE_NOT_FOUND",
            message: "해당 경로를 찾을 수 없습니다. 출발지와 도착지를 확인해주세요.",
          },
        };
      }

      return {
        success: false,
        error: {
          code: "API_ERROR",
          message: error.message,
          details: error.details as Record<string, unknown>,
        },
      };
    }

    console.error("[Server Action] 대중교통 경로 조회 중 예외 발생:", error);
    return {
      success: false,
      error: {
        code: "API_ERROR",
        message: "서버 오류가 발생했습니다.",
      },
    };
  }
}

/**
 * 대중교통 최적 경로 1개만 조회
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 최적 대중교통 경로 또는 에러
 */
export async function getBestTransitRoute(
  origin: Coordinate,
  destination: Coordinate
): Promise<{ success: boolean; route?: TransitRoute; error?: string }> {
  // 인증 확인
  const { userId } = await auth();
  if (!userId) {
    return {
      success: false,
      error: "로그인이 필요합니다.",
    };
  }

  const result = await getTransitRoute({ origin, destination, limit: 1 });

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message ?? "경로 조회 실패",
    };
  }

  return {
    success: true,
    route: result.data?.bestRoute,
  };
}

/**
 * 대중교통 소요시간만 조회 (빠른 버전)
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 소요 시간 (분) 또는 에러
 */
export async function getTransitDuration(
  origin: Coordinate,
  destination: Coordinate
): Promise<{ success: boolean; duration?: number; error?: string }> {
  // 인증 확인
  const { userId } = await auth();
  if (!userId) {
    return {
      success: false,
      error: "로그인이 필요합니다.",
    };
  }

  const result = await getTransitRoute({ origin, destination, limit: 1 });

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message ?? "경로 조회 실패",
    };
  }

  return {
    success: true,
    duration: result.data?.bestRoute.totalDuration,
  };
}

/**
 * 대중교통 요금만 조회 (빠른 버전)
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 요금 (원) 또는 에러
 */
export async function getTransitFare(
  origin: Coordinate,
  destination: Coordinate
): Promise<{ success: boolean; fare?: number; error?: string }> {
  // 인증 확인
  const { userId } = await auth();
  if (!userId) {
    return {
      success: false,
      error: "로그인이 필요합니다.",
    };
  }

  const result = await getTransitRoute({ origin, destination, limit: 1 });

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message ?? "경로 조회 실패",
    };
  }

  return {
    success: true,
    fare: result.data?.bestRoute.totalFare,
  };
}
