// ============================================
// Kakao API Client (카카오 API 클라이언트)
// ============================================

import type {
  KakaoKeywordSearchResponse,
  KakaoCategorySearchResponse,
  KakaoCoord2AddressResponse,
  KakaoDirectionsResponse,
  KakaoCategoryCode,
  KakaoPlaceDocument,
} from "@/types/kakao";
import type { PlaceSearchResult, Coordinate, CarRoute } from "@/types";
import { convertKakaoPlaceToSearchResult } from "@/types/kakao";

// ============================================
// Configuration
// ============================================

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO_MOBILITY_KEY = process.env.KAKAO_MOBILITY_KEY;

const KAKAO_LOCAL_BASE_URL = "https://dapi.kakao.com/v2/local";
const KAKAO_MOBILITY_BASE_URL = "https://apis-navi.kakaomobility.com/v1";

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

export class KakaoApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "KakaoApiError";
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
 * 재시도 가능한 fetch
 */
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // 429 (Too Many Requests) - 재시도
      if (response.status === 429 && attempt < retries) {
        const retryAfter = response.headers.get("Retry-After");
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : calculateBackoffDelay(attempt);
        await delay(waitTime);
        continue;
      }

      // 5xx 에러 - 재시도
      if (response.status >= 500 && attempt < retries) {
        await delay(calculateBackoffDelay(attempt));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new KakaoApiError(
          `Kakao API 오류: ${errorText}`,
          "API_ERROR",
          response.status
        );
      }

      return (await response.json()) as T;
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

      // KakaoApiError는 바로 throw
      if (error instanceof KakaoApiError) {
        throw error;
      }
    }
  }

  throw lastError || new KakaoApiError("알 수 없는 오류", "UNKNOWN_ERROR");
}

// ============================================
// Kakao Local API
// ============================================

/**
 * 키워드 검색 옵션
 */
export interface KeywordSearchOptions {
  /** 검색어 */
  query: string;
  /** 중심 좌표 (경도) */
  x?: number;
  /** 중심 좌표 (위도) */
  y?: number;
  /** 검색 반경 (미터, 0~20000) */
  radius?: number;
  /** 페이지 번호 (1~45) */
  page?: number;
  /** 결과 개수 (1~15) */
  size?: number;
  /** 정렬 기준 */
  sort?: "accuracy" | "distance";
}

/**
 * 키워드로 장소 검색
 *
 * @param options - 검색 옵션
 * @returns 검색 결과
 *
 * @example
 * ```ts
 * const result = await searchByKeyword({
 *   query: "경복궁",
 *   page: 1,
 *   size: 15,
 * });
 * ```
 */
export async function searchByKeyword(
  options: KeywordSearchOptions
): Promise<{
  places: PlaceSearchResult[];
  meta: {
    totalCount: number;
    pageableCount: number;
    isEnd: boolean;
  };
}> {
  if (!KAKAO_REST_API_KEY) {
    throw new KakaoApiError(
      "KAKAO_REST_API_KEY가 설정되지 않았습니다",
      "CONFIG_ERROR"
    );
  }

  const params = new URLSearchParams({
    query: options.query,
    page: String(options.page ?? 1),
    size: String(options.size ?? 15),
    sort: options.sort ?? "accuracy",
  });

  if (options.x !== undefined && options.y !== undefined) {
    params.append("x", String(options.x));
    params.append("y", String(options.y));
    if (options.radius !== undefined) {
      params.append("radius", String(options.radius));
    }
  }

  const url = `${KAKAO_LOCAL_BASE_URL}/search/keyword.json?${params.toString()}`;

  const data = await fetchWithRetry<KakaoKeywordSearchResponse>(url, {
    method: "GET",
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });

  return {
    places: data.documents.map(convertKakaoPlaceToSearchResult),
    meta: {
      totalCount: data.meta.total_count,
      pageableCount: data.meta.pageable_count,
      isEnd: data.meta.is_end,
    },
  };
}

/**
 * 카테고리 검색 옵션
 */
export interface CategorySearchOptions {
  /** 카테고리 코드 */
  categoryCode: KakaoCategoryCode;
  /** 중심 좌표 (경도) */
  x: number;
  /** 중심 좌표 (위도) */
  y: number;
  /** 검색 반경 (미터, 0~20000) */
  radius?: number;
  /** 페이지 번호 (1~45) */
  page?: number;
  /** 결과 개수 (1~15) */
  size?: number;
  /** 정렬 기준 */
  sort?: "accuracy" | "distance";
}

/**
 * 카테고리로 장소 검색 (주변 검색)
 *
 * @param options - 검색 옵션
 * @returns 검색 결과
 *
 * @example
 * ```ts
 * const result = await searchByCategory({
 *   categoryCode: "FD6", // 음식점
 *   x: 126.9770,
 *   y: 37.5796,
 *   radius: 500,
 * });
 * ```
 */
export async function searchByCategory(
  options: CategorySearchOptions
): Promise<{
  places: PlaceSearchResult[];
  meta: {
    totalCount: number;
    pageableCount: number;
    isEnd: boolean;
  };
}> {
  if (!KAKAO_REST_API_KEY) {
    throw new KakaoApiError(
      "KAKAO_REST_API_KEY가 설정되지 않았습니다",
      "CONFIG_ERROR"
    );
  }

  const params = new URLSearchParams({
    category_group_code: options.categoryCode,
    x: String(options.x),
    y: String(options.y),
    radius: String(options.radius ?? 500),
    page: String(options.page ?? 1),
    size: String(options.size ?? 15),
    sort: options.sort ?? "distance",
  });

  const url = `${KAKAO_LOCAL_BASE_URL}/search/category.json?${params.toString()}`;

  const data = await fetchWithRetry<KakaoCategorySearchResponse>(url, {
    method: "GET",
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });

  return {
    places: data.documents.map(convertKakaoPlaceToSearchResult),
    meta: {
      totalCount: data.meta.total_count,
      pageableCount: data.meta.pageable_count,
      isEnd: data.meta.is_end,
    },
  };
}

/**
 * 좌표 → 주소 변환 결과
 */
export interface AddressResult {
  /** 도로명 주소 */
  roadAddress: string | null;
  /** 지번 주소 */
  address: string;
  /** 지역 정보 */
  region: {
    region1: string; // 시/도
    region2: string; // 구/군
    region3: string; // 동/읍/면
  };
}

/**
 * 좌표를 주소로 변환
 *
 * @param coordinate - 좌표 정보
 * @returns 주소 정보
 *
 * @example
 * ```ts
 * const address = await coordToAddress({
 *   lat: 37.5796,
 *   lng: 126.9770,
 * });
 * ```
 */
export async function coordToAddress(
  coordinate: Coordinate
): Promise<AddressResult | null> {
  if (!KAKAO_REST_API_KEY) {
    throw new KakaoApiError(
      "KAKAO_REST_API_KEY가 설정되지 않았습니다",
      "CONFIG_ERROR"
    );
  }

  const params = new URLSearchParams({
    x: String(coordinate.lng),
    y: String(coordinate.lat),
  });

  const url = `${KAKAO_LOCAL_BASE_URL}/geo/coord2address.json?${params.toString()}`;

  const data = await fetchWithRetry<KakaoCoord2AddressResponse>(url, {
    method: "GET",
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });

  if (!data.documents || data.documents.length === 0) {
    return null;
  }

  const doc = data.documents[0];

  return {
    roadAddress: doc.road_address?.address_name ?? null,
    address: doc.address.address_name,
    region: {
      region1: doc.address.region_1depth_name,
      region2: doc.address.region_2depth_name,
      region3: doc.address.region_3depth_name,
    },
  };
}

// ============================================
// Kakao Mobility API (자동차 경로)
// ============================================

/**
 * 자동차 경로 조회 옵션
 */
export interface CarRouteOptions {
  /** 출발지 좌표 */
  origin: Coordinate;
  /** 도착지 좌표 */
  destination: Coordinate;
  /** 경유지 목록 (최대 5개) */
  waypoints?: Coordinate[];
  /** 우선 순위 */
  priority?: "RECOMMEND" | "TIME" | "DISTANCE";
  /** 대안 경로 제공 여부 */
  alternatives?: boolean;
}

/**
 * 자동차 경로 조회
 *
 * @param options - 경로 옵션
 * @returns 자동차 경로 정보
 *
 * @example
 * ```ts
 * const route = await getCarRoute({
 *   origin: { lat: 37.5665, lng: 126.9780 },
 *   destination: { lat: 37.5796, lng: 126.9770 },
 *   priority: "TIME",
 * });
 * ```
 */
export async function getCarRoute(
  options: CarRouteOptions
): Promise<CarRoute | null> {
  if (!KAKAO_MOBILITY_KEY) {
    throw new KakaoApiError(
      "KAKAO_MOBILITY_KEY가 설정되지 않았습니다",
      "CONFIG_ERROR"
    );
  }

  // 경유지 처리
  let url = `${KAKAO_MOBILITY_BASE_URL}/directions`;

  const params = new URLSearchParams({
    origin: `${options.origin.lng},${options.origin.lat}`,
    destination: `${options.destination.lng},${options.destination.lat}`,
    priority: options.priority ?? "RECOMMEND",
    alternatives: String(options.alternatives ?? false),
  });

  // 경유지가 있으면 waypoints 파라미터 추가
  if (options.waypoints && options.waypoints.length > 0) {
    const waypointsStr = options.waypoints
      .slice(0, 5) // 최대 5개
      .map((wp) => `${wp.lng},${wp.lat}`)
      .join("|");
    params.append("waypoints", waypointsStr);
  }

  url = `${url}?${params.toString()}`;

  try {
    const data = await fetchWithRetry<KakaoDirectionsResponse>(url, {
      method: "GET",
      headers: {
        Authorization: `KakaoAK ${KAKAO_MOBILITY_KEY}`,
        "Content-Type": "application/json",
      },
    });

    // 경로가 없는 경우
    if (!data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];

    // 경로 탐색 실패 (유고 정보, 동일 위치 등)
    // - result_code 1: 출발지/도착지 주변 도로에 유고 정보(교통 장애)
    // - result_code 2: 출발지와 도착지가 5m 이내
    // 이 경우 조용히 null 반환하고 fallback 처리
    if (route.result_code !== 0) {
      return null;
    }

    // 폴리라인 추출 (모든 섹션의 roads vertexes 합치기)
    let polylinePoints: number[] = [];
    for (const section of route.sections) {
      for (const road of section.roads) {
        polylinePoints = polylinePoints.concat(road.vertexes);
      }
    }

    // 폴리라인을 간략화된 문자열로 변환 (위도,경도 쌍)
    const polyline = encodePolyline(polylinePoints);

    return {
      totalDuration: Math.round(route.summary.duration / 60), // 초 → 분
      totalDistance: route.summary.distance,
      tollFare: route.summary.fare.toll,
      fuelCost: undefined, // Kakao API는 유류비 미제공
      polyline,
      summary: `${route.summary.origin.name} → ${route.summary.destination.name}`,
    };
  } catch (error) {
    if (error instanceof KakaoApiError) {
      throw error;
    }
    console.error("자동차 경로 조회 오류:", error);
    return null;
  }
}

/**
 * 폴리라인 인코딩 (Google Polyline Algorithm)
 * Kakao vertexes 배열 [lng1, lat1, lng2, lat2, ...] → 인코딩된 문자열
 */
function encodePolyline(vertexes: number[]): string {
  if (vertexes.length < 2) return "";

  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (let i = 0; i < vertexes.length; i += 2) {
    const lng = vertexes[i];
    const lat = vertexes[i + 1];

    // 위도, 경도 순서로 인코딩 (Google 표준)
    const dLat = Math.round((lat - prevLat) * 1e5);
    const dLng = Math.round((lng - prevLng) * 1e5);

    encoded += encodeNumber(dLat);
    encoded += encodeNumber(dLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

/**
 * 단일 숫자 인코딩
 */
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
// Convenience Functions
// ============================================

/**
 * 두 지점 간 자동차 소요시간만 조회 (빠른 버전)
 */
export async function getCarDuration(
  origin: Coordinate,
  destination: Coordinate
): Promise<number | null> {
  const route = await getCarRoute({ origin, destination });
  return route?.totalDuration ?? null;
}

/**
 * 두 지점 간 자동차 거리만 조회 (빠른 버전)
 */
export async function getCarDistance(
  origin: Coordinate,
  destination: Coordinate
): Promise<number | null> {
  const route = await getCarRoute({ origin, destination });
  return route?.totalDistance ?? null;
}

/**
 * 여러 장소 검색 (키워드 목록)
 */
export async function searchMultipleKeywords(
  queries: string[],
  options?: Omit<KeywordSearchOptions, "query">
): Promise<Map<string, PlaceSearchResult[]>> {
  const results = new Map<string, PlaceSearchResult[]>();

  // 병렬 처리 (최대 5개씩)
  const batchSize = 5;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((query) =>
        searchByKeyword({ ...options, query }).catch(() => ({
          places: [],
          meta: { totalCount: 0, pageableCount: 0, isEnd: true },
        }))
      )
    );

    batch.forEach((query, idx) => {
      results.set(query, batchResults[idx].places);
    });
  }

  return results;
}

// ============================================
// Export Raw API Access (for advanced use)
// ============================================

export {
  fetchWithRetry,
  calculateBackoffDelay,
  KAKAO_LOCAL_BASE_URL,
  KAKAO_MOBILITY_BASE_URL,
  RETRY_CONFIG,
};
