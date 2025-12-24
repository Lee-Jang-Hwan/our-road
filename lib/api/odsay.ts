// ============================================
// ODsay API Client (대중교통 API 클라이언트)
// ============================================

import type {
  ODsayResponse,
  ODsaySearchPathResult,
  ODsayPath,
  ODsayError,
} from "@/types/odsay";
import type { Coordinate, TransitRoute } from "@/types";
import { convertODsayPathToTransitRoute } from "@/types/odsay";

// ============================================
// Configuration
// ============================================

const ODSAY_API_KEY = process.env.ODSAY_API_KEY;
const ODSAY_BASE_URL = "https://api.odsay.com/v1/api";

/**
 * 재시도 설정
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1초
  maxDelay: 10000, // 10초
};

// ============================================
// Error Types
// ============================================

export class ODsayApiError extends Error {
  constructor(
    message: string,
    public readonly code: number | string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ODsayApiError";
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * 지수 백오프 지연 계산
 */
function calculateBackoffDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000; // 최대 1초 지터
  return Math.min(delay + jitter, RETRY_CONFIG.maxDelay);
}

/**
 * 지연 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ODsay 에러 응답인지 확인
 */
function isODsayError(data: unknown): data is ODsayError {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as ODsayError).error === "object"
  );
}

/**
 * 재시도 가능한 fetch
 */
async function fetchWithRetry<T>(
  url: string,
  retries = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      // 429 (Too Many Requests) - 재시도
      if (response.status === 429 && attempt < retries) {
        const waitTime = calculateBackoffDelay(attempt);
        await delay(waitTime);
        continue;
      }

      // 5xx 에러 - 재시도
      if (response.status >= 500 && attempt < retries) {
        await delay(calculateBackoffDelay(attempt));
        continue;
      }

      if (!response.ok) {
        throw new ODsayApiError(
          `ODsay API HTTP 오류: ${response.status}`,
          response.status
        );
      }

      const data = await response.json();

      // ODsay 자체 에러 응답 확인
      if (isODsayError(data)) {
        throw new ODsayApiError(
          data.error.msg,
          data.error.code,
          data
        );
      }

      return data as T;
    } catch (error) {
      lastError = error as Error;

      // 네트워크 에러 - 재시도
      if (
        error instanceof TypeError &&
        error.message.includes("fetch") &&
        attempt < retries
      ) {
        await delay(calculateBackoffDelay(attempt));
        continue;
      }

      // ODsayApiError는 바로 throw
      if (error instanceof ODsayApiError) {
        throw error;
      }
    }
  }

  throw lastError || new ODsayApiError("알 수 없는 오류", "UNKNOWN_ERROR");
}

// ============================================
// ODsay API Functions
// ============================================

/**
 * 대중교통 경로 검색 옵션
 */
export interface TransitRouteOptions {
  /** 출발지 좌표 */
  origin: Coordinate;
  /** 도착지 좌표 */
  destination: Coordinate;
  /** 정렬 기준 (0: 추천순, 1: 시간순, 2: 환승횟수순, 3: 도보거리순) */
  sortType?: 0 | 1 | 2 | 3;
  /** 검색 유형 (0: 도시내, 1: 도시간, 2: 통합) */
  searchType?: 0 | 1 | 2;
}

/**
 * 대중교통 경로 검색 결과
 */
export interface TransitSearchResult {
  /** 경로 목록 */
  routes: TransitRoute[];
  /** 원본 데이터 (고급 사용) */
  rawPaths: ODsayPath[];
  /** 검색 정보 */
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
}

/**
 * 대중교통 경로 조회
 *
 * @param options - 검색 옵션
 * @returns 대중교통 경로 정보
 *
 * @example
 * ```ts
 * const result = await searchTransitRoute({
 *   origin: { lat: 37.5665, lng: 126.9780 },
 *   destination: { lat: 37.5796, lng: 126.9770 },
 *   sortType: 0, // 추천순
 * });
 * ```
 */
export async function searchTransitRoute(
  options: TransitRouteOptions
): Promise<TransitSearchResult | null> {
  if (!ODSAY_API_KEY) {
    throw new ODsayApiError(
      "ODSAY_API_KEY가 설정되지 않았습니다",
      "CONFIG_ERROR"
    );
  }

  const params = new URLSearchParams({
    apiKey: ODSAY_API_KEY,
    SX: String(options.origin.lng),
    SY: String(options.origin.lat),
    EX: String(options.destination.lng),
    EY: String(options.destination.lat),
    OPT: String(options.sortType ?? 0),
    SearchType: String(options.searchType ?? 0),
  });

  const url = `${ODSAY_BASE_URL}/searchPubTransPathT?${params.toString()}`;

  try {
    const data = await fetchWithRetry<ODsayResponse<ODsaySearchPathResult>>(url);

    // 경로가 없는 경우
    if (!data.result || !data.result.path || data.result.path.length === 0) {
      return null;
    }

    const result = data.result;

    // 경로 변환
    const routes = result.path.map(convertODsayPathToTransitRoute);

    return {
      routes,
      rawPaths: result.path,
      meta: {
        pointDistance: result.pointDistance,
        busCount: result.busCount,
        subwayCount: result.subwayCount,
        subwayBusCount: result.subwayBusCount,
      },
    };
  } catch (error) {
    if (error instanceof ODsayApiError) {
      // 경로 없음 에러는 null 반환
      if (error.code === -98 || error.code === -99) {
        return null;
      }
      throw error;
    }
    console.error("대중교통 경로 조회 오류:", error);
    return null;
  }
}

/**
 * 대중교통 최적 경로 1개만 조회
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 최적 대중교통 경로
 */
export async function getBestTransitRoute(
  origin: Coordinate,
  destination: Coordinate
): Promise<TransitRoute | null> {
  const result = await searchTransitRoute({
    origin,
    destination,
    sortType: 0, // 추천순
  });

  return result?.routes[0] ?? null;
}

/**
 * 대중교통 소요시간만 조회 (빠른 버전)
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 소요 시간 (분)
 */
export async function getTransitDuration(
  origin: Coordinate,
  destination: Coordinate
): Promise<number | null> {
  const route = await getBestTransitRoute(origin, destination);
  return route?.totalDuration ?? null;
}

/**
 * 대중교통 요금만 조회 (빠른 버전)
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 요금 (원)
 */
export async function getTransitFare(
  origin: Coordinate,
  destination: Coordinate
): Promise<number | null> {
  const route = await getBestTransitRoute(origin, destination);
  return route?.totalFare ?? null;
}

// ============================================
// Advanced Functions
// ============================================

/**
 * 여러 경로 동시 조회 (batch)
 *
 * @param routeRequests - 경로 요청 배열
 * @returns 경로 결과 배열
 */
export async function searchMultipleRoutes(
  routeRequests: Array<{
    origin: Coordinate;
    destination: Coordinate;
  }>
): Promise<(TransitRoute | null)[]> {
  // 병렬 처리 (최대 3개씩 - ODsay API 제한 고려)
  const batchSize = 3;
  const results: (TransitRoute | null)[] = [];

  for (let i = 0; i < routeRequests.length; i += batchSize) {
    const batch = routeRequests.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(({ origin, destination }) =>
        getBestTransitRoute(origin, destination).catch(() => null)
      )
    );
    results.push(...batchResults);

    // Rate limiting - 배치 사이 딜레이
    if (i + batchSize < routeRequests.length) {
      await delay(500);
    }
  }

  return results;
}

/**
 * 경로 유형별 필터링
 *
 * @param routes - 경로 목록
 * @param type - 경로 유형 (1: 지하철, 2: 버스, 3: 버스+지하철)
 * @returns 필터링된 경로 목록
 */
export function filterRoutesByType(
  routes: TransitRoute[],
  type: 1 | 2 | 3
): TransitRoute[] {
  return routes.filter((route) => {
    const hasSubway = route.segments.some(
      (seg) => "mode" in seg && seg.mode === "subway"
    );
    const hasBus = route.segments.some(
      (seg) => "mode" in seg && seg.mode === "bus"
    );

    switch (type) {
      case 1: // 지하철만
        return hasSubway && !hasBus;
      case 2: // 버스만
        return hasBus && !hasSubway;
      case 3: // 버스+지하철
        return hasBus && hasSubway;
      default:
        return true;
    }
  });
}

/**
 * 환승 횟수로 경로 정렬
 */
export function sortRoutesByTransfer(
  routes: TransitRoute[],
  ascending = true
): TransitRoute[] {
  return [...routes].sort((a, b) =>
    ascending
      ? a.transferCount - b.transferCount
      : b.transferCount - a.transferCount
  );
}

/**
 * 소요 시간으로 경로 정렬
 */
export function sortRoutesByDuration(
  routes: TransitRoute[],
  ascending = true
): TransitRoute[] {
  return [...routes].sort((a, b) =>
    ascending
      ? a.totalDuration - b.totalDuration
      : b.totalDuration - a.totalDuration
  );
}

/**
 * 요금으로 경로 정렬
 */
export function sortRoutesByFare(
  routes: TransitRoute[],
  ascending = true
): TransitRoute[] {
  return [...routes].sort((a, b) =>
    ascending ? a.totalFare - b.totalFare : b.totalFare - a.totalFare
  );
}

// ============================================
// Export Configuration (for advanced use)
// ============================================

export {
  fetchWithRetry,
  calculateBackoffDelay,
  ODSAY_BASE_URL,
  RETRY_CONFIG,
};
