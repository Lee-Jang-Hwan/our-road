"use server";

import { auth } from "@clerk/nextjs/server";
import { carRouteSchema, type CarRouteInput } from "@/lib/schemas";
import type { CarRoute, Coordinate } from "@/types";

// ============================================
// Types
// ============================================

/**
 * 자동차 경로 조회 결과
 */
export interface GetCarRouteResult {
  success: boolean;
  data?: CarRoute;
  error?: {
    code: "ROUTE_NOT_FOUND" | "API_ERROR" | "INVALID_COORDINATES" | "TIMEOUT" | "AUTH_ERROR" | "VALIDATION_ERROR";
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================
// Configuration
// ============================================

const KAKAO_MOBILITY_KEY = process.env.KAKAO_MOBILITY_KEY;
const KAKAO_MOBILITY_BASE_URL = "https://apis-navi.kakaomobility.com/v1";

// ============================================
// Helper Functions
// ============================================

/**
 * 지수 백오프 지연 계산
 */
function calculateBackoffDelay(attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 10000;
  const delay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(delay + jitter, maxDelay);
}

/**
 * 지연 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 폴리라인 인코딩 (Google Polyline Algorithm)
 */
function encodePolyline(vertexes: number[]): string {
  if (vertexes.length < 2) return "";

  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (let i = 0; i < vertexes.length; i += 2) {
    const lng = vertexes[i];
    const lat = vertexes[i + 1];

    const dLat = Math.round((lat - prevLat) * 1e5);
    const dLng = Math.round((lng - prevLng) * 1e5);

    encoded += encodeNumber(dLat);
    encoded += encodeNumber(dLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

function encodeNumber(num: number): string {
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
}

// ============================================
// Server Action
// ============================================

/**
 * 자동차 경로 조회 Server Action (Kakao Mobility API)
 *
 * 두 지점 간의 자동차 경로를 조회합니다.
 * **중요**: 자동차 경로로만 조회하며, 다른 수단으로 자동 전환하지 않습니다.
 * 경로가 없으면 ROUTE_NOT_FOUND 에러를 반환합니다.
 *
 * @param input - 경로 조회 조건
 * @returns 자동차 경로 정보 또는 에러
 *
 * @example
 * ```tsx
 * const result = await getCarRoute({
 *   origin: { lat: 37.5665, lng: 126.9780 },
 *   destination: { lat: 37.5796, lng: 126.9770 },
 *   priority: "TIME",
 * });
 * ```
 */
export async function getCarRoute(
  input: CarRouteInput
): Promise<GetCarRouteResult> {
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

    // 2. API 키 확인
    if (!KAKAO_MOBILITY_KEY) {
      console.error("KAKAO_MOBILITY_KEY가 설정되지 않았습니다.");
      return {
        success: false,
        error: {
          code: "API_ERROR",
          message: "경로 조회 서비스가 준비되지 않았습니다.",
        },
      };
    }

    // 3. Zod 스키마 검증
    const validationResult = carRouteSchema.safeParse(input);
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

    const { origin, destination, waypoints, priority, alternatives } =
      validationResult.data;

    // 4. Kakao Mobility API 요청 URL 구성
    const params = new URLSearchParams({
      origin: `${origin.lng},${origin.lat}`,
      destination: `${destination.lng},${destination.lat}`,
      priority: priority ?? "RECOMMEND",
      alternatives: String(alternatives ?? false),
    });

    // 경유지 추가
    if (waypoints && waypoints.length > 0) {
      const waypointsStr = waypoints
        .slice(0, 5)
        .map((wp: Coordinate) => `${wp.lng},${wp.lat}`)
        .join("|");
      params.append("waypoints", waypointsStr);
    }

    const url = `${KAKAO_MOBILITY_BASE_URL}/directions?${params.toString()}`;

    // 5. API 호출 (재시도 로직 포함)
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `KakaoAK ${KAKAO_MOBILITY_KEY}`,
            "Content-Type": "application/json",
          },
        });

        // 429 (Too Many Requests) - 재시도
        if (response.status === 429 && attempt < maxRetries) {
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = retryAfter
            ? parseInt(retryAfter) * 1000
            : calculateBackoffDelay(attempt);
          await delay(waitTime);
          continue;
        }

        // 5xx 에러 - 재시도
        if (response.status >= 500 && attempt < maxRetries) {
          await delay(calculateBackoffDelay(attempt));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Kakao Mobility API 오류:", response.status, errorText);

          if (response.status === 401) {
            return {
              success: false,
              error: {
                code: "API_ERROR",
                message: "API 인증에 실패했습니다.",
              },
            };
          }

          return {
            success: false,
            error: {
              code: "API_ERROR",
              message: "경로 조회에 실패했습니다.",
              details: { status: response.status },
            },
          };
        }

        const data = await response.json();

        // 경로가 없는 경우 - ROUTE_NOT_FOUND 반환 (다른 수단으로 전환하지 않음)
        if (!data.routes || data.routes.length === 0) {
          return {
            success: false,
            error: {
              code: "ROUTE_NOT_FOUND",
              message: "해당 경로를 찾을 수 없습니다. 출발지와 도착지를 확인해주세요.",
            },
          };
        }

        const route = data.routes[0];

        // 경로 탐색 실패
        if (route.result_code !== 0) {
          return {
            success: false,
            error: {
              code: "ROUTE_NOT_FOUND",
              message: route.result_msg || "경로를 찾을 수 없습니다.",
            },
          };
        }

        // 폴리라인 추출
        let polylinePoints: number[] = [];
        for (const section of route.sections) {
          for (const road of section.roads) {
            polylinePoints = polylinePoints.concat(road.vertexes);
          }
        }

        const polyline = encodePolyline(polylinePoints);

        // 6. 결과 반환
        const carRoute: CarRoute = {
          totalDuration: Math.round(route.summary.duration / 60), // 초 → 분
          totalDistance: route.summary.distance,
          tollFare: route.summary.fare?.toll ?? 0,
          fuelCost: undefined,
          polyline,
          summary: route.summary.origin?.name && route.summary.destination?.name
            ? `${route.summary.origin.name} → ${route.summary.destination.name}`
            : undefined,
        };

        console.log("✅ [카카오 API 호출 성공] 자동차 경로 조회 완료", {
          duration: carRoute.totalDuration,
          distance: carRoute.totalDistance,
          attempt: attempt + 1,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          data: carRoute,
        };
      } catch (error) {
        lastError = error as Error;

        // 네트워크 에러 - 재시도
        if (
          error instanceof TypeError &&
          error.message.includes("fetch") &&
          attempt < maxRetries
        ) {
          await delay(calculateBackoffDelay(attempt));
          continue;
        }

        throw error;
      }
    }

    // 최종 실패 로그
    console.error("❌ [카카오 API 호출 실패] 모든 재시도 실패", {
      attempts: maxRetries + 1,
      lastError: lastError?.message,
      timestamp: new Date().toISOString(),
    });

    throw lastError || new Error("알 수 없는 오류");
  } catch (error) {
    console.error("❌ [카카오 API 호출 예외]", error);
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
 * 두 지점 간 자동차 소요시간만 조회 (빠른 버전)
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 소요 시간 (분) 또는 에러
 */
export async function getCarDuration(
  origin: Coordinate,
  destination: Coordinate
): Promise<{ success: boolean; duration?: number; error?: string }> {
  const result = await getCarRoute({ origin, destination });

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
 * 두 지점 간 자동차 거리만 조회 (빠른 버전)
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 거리 (미터) 또는 에러
 */
export async function getCarDistance(
  origin: Coordinate,
  destination: Coordinate
): Promise<{ success: boolean; distance?: number; error?: string }> {
  const result = await getCarRoute({ origin, destination });

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
