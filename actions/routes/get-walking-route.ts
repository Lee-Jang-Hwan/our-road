"use server";

import { auth } from "@clerk/nextjs/server";
import { walkingRouteSchema, type WalkingRouteInput } from "@/lib/schemas";
import { getTmapWalkingRoute } from "@/lib/api/tmap";
import type { WalkingRoute, Coordinate } from "@/types";

// ============================================
// Types
// ============================================

/**
 * 도보 경로 조회 결과
 */
export interface GetWalkingRouteResult {
  success: boolean;
  data?: WalkingRoute;
  error?: {
    code: "ROUTE_NOT_FOUND" | "API_ERROR" | "INVALID_COORDINATES" | "TIMEOUT" | "AUTH_ERROR" | "VALIDATION_ERROR";
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================
// Constants
// ============================================

/**
 * 도보 속도 (m/min)
 * 평균 도보 속도: 4km/h = 66.67m/min
 */
const WALKING_SPEED_M_PER_MIN = 66.67;

/**
 * 최대 도보 거리 제한 (미터)
 * 약 10km를 초과하면 경로를 제공하지 않음
 */
const MAX_WALKING_DISTANCE = 10000;

// ============================================
// Helper Functions
// ============================================

/**
 * Haversine 공식을 사용한 두 좌표 간 직선거리 계산
 *
 * @param coord1 - 첫 번째 좌표
 * @param coord2 - 두 번째 좌표
 * @returns 거리 (미터)
 */
function haversineDistance(
  coord1: Coordinate,
  coord2: Coordinate
): number {
  const EARTH_RADIUS_METERS = 6_371_000;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1 = toRadians(coord1.lat);
  const lat2 = toRadians(coord2.lat);
  const deltaLat = toRadians(coord2.lat - coord1.lat);
  const deltaLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * 도보 소요 시간 계산
 *
 * @param distance - 거리 (미터)
 * @returns 소요 시간 (분)
 */
function calculateWalkingDuration(distance: number): number {
  return Math.ceil(distance / WALKING_SPEED_M_PER_MIN);
}

/**
 * 간단한 직선 폴리라인 생성
 * 출발지에서 도착지까지의 직선
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 인코딩된 폴리라인 문자열
 */
function createSimplePolyline(
  origin: Coordinate,
  destination: Coordinate
): string {
  // Google Polyline Algorithm으로 인코딩
  const encodeNumber = (num: number): string => {
    let sgnNum = num << 1;
    if (num < 0) {
      sgnNum = ~sgnNum;
    }

    let encoded = "";
    while (sgnNum >= 0x20) {
      encoded += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
      sgnNum >>= 5;
    }
    encoded += String.fromCharCode(sgnNum + 63);
    return encoded;
  };

  let encoded = "";

  // 시작점
  const lat1 = Math.round(origin.lat * 1e5);
  const lng1 = Math.round(origin.lng * 1e5);
  encoded += encodeNumber(lat1);
  encoded += encodeNumber(lng1);

  // 끝점 (델타 값)
  const lat2 = Math.round(destination.lat * 1e5) - lat1;
  const lng2 = Math.round(destination.lng * 1e5) - lng1;
  encoded += encodeNumber(lat2);
  encoded += encodeNumber(lng2);

  return encoded;
}

// ============================================
// Server Action
// ============================================

/**
 * 도보 경로 조회 Server Action
 *
 * 두 지점 간의 도보 경로를 조회합니다.
 * TMAP API를 우선 사용하고, 실패시 Haversine 공식 기반 추정치를 사용합니다.
 *
 * **중요**: 도보 경로로만 조회하며, 다른 수단으로 자동 전환하지 않습니다.
 * 거리가 너무 멀면 (10km 초과) ROUTE_NOT_FOUND 에러를 반환합니다.
 *
 * @param input - 경로 조회 조건
 * @returns 도보 경로 정보 또는 에러
 *
 * @example
 * ```tsx
 * const result = await getWalkingRoute({
 *   origin: { lat: 37.5665, lng: 126.9780 },
 *   destination: { lat: 37.5696, lng: 126.9810 },
 * });
 * ```
 */
export async function getWalkingRoute(
  input: WalkingRouteInput
): Promise<GetWalkingRouteResult> {
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
    const validationResult = walkingRouteSchema.safeParse(input);
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

    const { origin, destination } = validationResult.data as {
      origin: Coordinate;
      destination: Coordinate;
    };

    // 3. 거리 사전 확인 (직선거리 기준)
    const straightLineDistance = haversineDistance(origin, destination);
    const estimatedDistance = Math.round(straightLineDistance * 1.3);

    // 거리 제한 확인 - 너무 멀면 ROUTE_NOT_FOUND 반환
    if (estimatedDistance > MAX_WALKING_DISTANCE) {
      return {
        success: false,
        error: {
          code: "ROUTE_NOT_FOUND",
          message: `도보로 이동하기에는 거리가 너무 멉니다 (약 ${(estimatedDistance / 1000).toFixed(1)}km). 다른 이동 수단을 이용해주세요.`,
          details: {
            distance: estimatedDistance,
            maxDistance: MAX_WALKING_DISTANCE,
          },
        },
      };
    }

    // 4. TMAP API로 실제 도보 경로 조회 시도
    const tmapRoute = await getTmapWalkingRoute(origin, destination);

    if (tmapRoute) {
      // TMAP 성공 - 실제 경로 데이터 반환
      return {
        success: true,
        data: tmapRoute,
      };
    }

    // 5. TMAP 실패 시 Fallback: Haversine 기반 추정
    console.log("TMAP API 실패, Haversine fallback 사용");

    const duration = calculateWalkingDuration(estimatedDistance);
    const polyline = createSimplePolyline(origin, destination);

    const walkingRoute: WalkingRoute = {
      totalDuration: duration,
      totalDistance: estimatedDistance,
      polyline,
    };

    return {
      success: true,
      data: walkingRoute,
    };
  } catch (error) {
    console.error("도보 경로 조회 중 예외 발생:", error);
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
 * 두 지점 간 도보 소요시간만 조회 (빠른 버전)
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 소요 시간 (분) 또는 에러
 */
export async function getWalkingDuration(
  origin: Coordinate,
  destination: Coordinate
): Promise<{ success: boolean; duration?: number; error?: string }> {
  const result = await getWalkingRoute({ origin, destination });

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message ?? "경로 조회 실패",
    };
  }

  return {
    success: true,
    duration: result.data?.totalDuration,
  };
}

/**
 * 두 지점 간 도보 거리만 조회 (빠른 버전)
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 거리 (미터) 또는 에러
 */
export async function getWalkingDistance(
  origin: Coordinate,
  destination: Coordinate
): Promise<{ success: boolean; distance?: number; error?: string }> {
  const result = await getWalkingRoute({ origin, destination });

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message ?? "경로 조회 실패",
    };
  }

  return {
    success: true,
    distance: result.data?.totalDistance,
  };
}

/**
 * 도보 가능 여부 확인
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @param maxMinutes - 최대 허용 시간 (분, 기본: 30분)
 * @returns 도보 가능 여부
 */
export async function isWalkable(
  origin: Coordinate,
  destination: Coordinate,
  maxMinutes: number = 30
): Promise<{ success: boolean; walkable?: boolean; duration?: number; error?: string }> {
  const result = await getWalkingRoute({ origin, destination });

  if (!result.success) {
    // ROUTE_NOT_FOUND는 도보 불가능으로 처리
    if (result.error?.code === "ROUTE_NOT_FOUND") {
      return {
        success: true,
        walkable: false,
        duration: undefined,
      };
    }

    return {
      success: false,
      error: result.error?.message ?? "경로 조회 실패",
    };
  }

  const duration = result.data?.totalDuration ?? 0;

  return {
    success: true,
    walkable: duration <= maxMinutes,
    duration,
  };
}
