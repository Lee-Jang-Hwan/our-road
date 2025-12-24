"use server";

import { auth } from "@clerk/nextjs/server";
import { transitRouteSchema, type TransitRouteInput } from "@/lib/schemas";
import type { TransitRoute, Coordinate, RouteSegment, TransitSegment, PublicTransportMode } from "@/types";

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

/**
 * ODsay API 응답 타입 (간소화)
 */
interface ODsaySearchPathResult {
  pointDistance: number;
  busCount: number;
  subwayCount: number;
  subwayBusCount: number;
  path: ODsayPath[];
}

interface ODsayPath {
  pathType: number;
  info: {
    totalTime: number;
    totalDistance: number;
    payment: number;
    busTransitCount: number;
    subwayTransitCount: number;
    totalWalk: number;
    totalWalkTime: number;
  };
  subPath: ODsaySubPath[];
}

interface ODsaySubPath {
  trafficType: number;
  distance: number;
  sectionTime: number;
  stationCount?: number;
  startName?: string;
  endName?: string;
  lane?: Array<{
    name?: string;
    subwayCode?: number;
    busNo?: string;
    type?: number;
  }>;
}

// ============================================
// Configuration
// ============================================

const ODSAY_API_KEY = process.env.ODSAY_API_KEY;
const ODSAY_BASE_URL = "https://api.odsay.com/v1/api";

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
 * ODsay trafficType을 TransportMode로 변환
 */
function getTransportMode(trafficType: number): "walking" | "public" {
  // 1: 지하철, 2: 버스, 3: 도보
  return trafficType === 3 ? "walking" : "public";
}

/**
 * ODsay 대중교통 타입을 PublicTransportMode로 변환
 */
function getPublicTransportMode(trafficType: number, subwayCode?: number): PublicTransportMode {
  if (trafficType === 1) {
    return "subway";
  } else if (trafficType === 2) {
    return "bus";
  }
  return "bus"; // 기본값
}

/**
 * ODsay Path를 TransitRoute로 변환
 */
function convertODsayPathToTransitRoute(path: ODsayPath): TransitRoute {
  const segments: (RouteSegment | TransitSegment)[] = [];

  let walkingTime = 0;
  let walkingDistance = 0;

  for (const subPath of path.subPath) {
    if (subPath.trafficType === 3) {
      // 도보 구간
      walkingTime += subPath.sectionTime;
      walkingDistance += subPath.distance;

      const segment: RouteSegment = {
        mode: "walking",
        distance: subPath.distance,
        duration: subPath.sectionTime,
        description: subPath.startName && subPath.endName
          ? `${subPath.startName} → ${subPath.endName}`
          : "도보 이동",
      };
      segments.push(segment);
    } else {
      // 대중교통 구간
      const mode = getPublicTransportMode(
        subPath.trafficType,
        subPath.lane?.[0]?.subwayCode
      );

      const lineName = subPath.lane?.[0]?.name || subPath.lane?.[0]?.busNo;

      const segment: TransitSegment = {
        mode,
        lineName,
        startStation: subPath.startName ?? "",
        endStation: subPath.endName ?? "",
        stationCount: subPath.stationCount,
        duration: subPath.sectionTime,
        distance: subPath.distance,
      };
      segments.push(segment);
    }
  }

  return {
    totalDuration: path.info.totalTime,
    totalDistance: path.info.totalDistance,
    totalFare: path.info.payment,
    transferCount: path.info.busTransitCount + path.info.subwayTransitCount - 1,
    segments,
    walkingTime,
    walkingDistance,
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

    // 2. API 키 확인
    if (!ODSAY_API_KEY) {
      console.error("ODSAY_API_KEY가 설정되지 않았습니다.");
      return {
        success: false,
        error: {
          code: "API_ERROR",
          message: "경로 조회 서비스가 준비되지 않았습니다.",
        },
      };
    }

    // 3. Zod 스키마 검증
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

    // 4. ODsay API 요청 URL 구성
    const params = new URLSearchParams({
      apiKey: ODSAY_API_KEY,
      SX: String(origin.lng),
      SY: String(origin.lat),
      EX: String(destination.lng),
      EY: String(destination.lat),
      OPT: String(sortType ?? 0),
      SearchType: String(searchType ?? 0),
    });

    const url = `${ODSAY_BASE_URL}/searchPubTransPathT?${params.toString()}`;

    // 5. API 호출 (재시도 로직 포함)
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        // 429 (Too Many Requests) - 재시도
        if (response.status === 429 && attempt < maxRetries) {
          await delay(calculateBackoffDelay(attempt));
          continue;
        }

        // 5xx 에러 - 재시도
        if (response.status >= 500 && attempt < maxRetries) {
          await delay(calculateBackoffDelay(attempt));
          continue;
        }

        if (!response.ok) {
          console.error("ODsay API HTTP 오류:", response.status);
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

        // ODsay 자체 에러 응답 확인
        if (data.error) {
          const errorCode = data.error.code;

          // 경로 없음 에러 (-98, -99)
          if (errorCode === -98 || errorCode === -99) {
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
              message: data.error.msg || "경로 조회에 실패했습니다.",
            },
          };
        }

        // 경로가 없는 경우 - ROUTE_NOT_FOUND 반환 (다른 수단으로 전환하지 않음)
        if (!data.result || !data.result.path || data.result.path.length === 0) {
          return {
            success: false,
            error: {
              code: "ROUTE_NOT_FOUND",
              message: "해당 경로를 찾을 수 없습니다. 출발지와 도착지를 확인해주세요.",
            },
          };
        }

        const result: ODsaySearchPathResult = data.result;

        // 경로 변환
        let routes = result.path.map(convertODsayPathToTransitRoute);

        // limit 적용
        if (limit && routes.length > limit) {
          routes = routes.slice(0, limit);
        }

        // 6. 결과 반환
        return {
          success: true,
          data: {
            bestRoute: routes[0],
            alternativeRoutes: routes.slice(1),
            meta: {
              pointDistance: result.pointDistance,
              busCount: result.busCount,
              subwayCount: result.subwayCount,
              subwayBusCount: result.subwayBusCount,
            },
          },
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

    throw lastError || new Error("알 수 없는 오류");
  } catch (error) {
    console.error("대중교통 경로 조회 중 예외 발생:", error);
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
