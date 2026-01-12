// ============================================
// Kakao API Client (카카오 API 클라이언트)
// ============================================

import type {
  KakaoKeywordSearchResponse,
  KakaoCategorySearchResponse,
  KakaoCoord2AddressResponse,
  KakaoSearchAddressResponse,
  KakaoDirectionsResponse,
  KakaoCategoryCode,
} from "@/types/kakao";
import type { PlaceSearchResult, Coordinate, CarRoute } from "@/types";
import { convertKakaoPlaceToSearchResult } from "@/types/kakao";
import {
  logApiStart,
  logApiSuccess,
  logApiError,
} from "@/lib/utils/api-logger";

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
    public readonly status?: number,
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
  retries = RETRY_CONFIG.maxRetries,
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
          response.status,
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
export async function searchByKeyword(options: KeywordSearchOptions): Promise<{
  places: PlaceSearchResult[];
  meta: {
    totalCount: number;
    pageableCount: number;
    isEnd: boolean;
  };
}> {
  const startTime = logApiStart("Kakao Keyword Search", {
    api: "Kakao Local",
    method: "GET",
    params: { query: options.query, page: options.page },
  });

  if (!KAKAO_REST_API_KEY) {
    throw new KakaoApiError(
      "KAKAO_REST_API_KEY가 설정되지 않았습니다",
      "CONFIG_ERROR",
    );
  }

  try {
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

    const result = {
      places: data.documents.map(convertKakaoPlaceToSearchResult),
      meta: {
        totalCount: data.meta.total_count,
        pageableCount: data.meta.pageable_count,
        isEnd: data.meta.is_end,
      },
    };

    logApiSuccess("Kakao Keyword Search", startTime, {
      api: "Kakao Local",
      params: { resultCount: result.places.length },
    });

    return result;
  } catch (error) {
    logApiError("Kakao Keyword Search", startTime, error);
    throw error;
  }
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
  options: CategorySearchOptions,
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
      "CONFIG_ERROR",
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
  coordinate: Coordinate,
): Promise<AddressResult | null> {
  if (!KAKAO_REST_API_KEY) {
    throw new KakaoApiError(
      "KAKAO_REST_API_KEY가 설정되지 않았습니다",
      "CONFIG_ERROR",
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
// 주소 검색 API
// ============================================

/**
 * 주소 검색 결과
 */
export interface AddressSearchResult {
  /** 주소명 */
  addressName: string;
  /** 주소 타입 */
  addressType: "REGION" | "ROAD" | "REGION_ADDR" | "ROAD_ADDR";
  /** 좌표 */
  coordinate: Coordinate;
  /** 지번 주소 상세 */
  address?: {
    addressName: string;
    region1: string; // 시/도
    region2: string; // 구/군
    region3: string; // 동/읍/면
  };
  /** 도로명 주소 상세 */
  roadAddress?: {
    addressName: string;
    region1: string; // 시/도
    region2: string; // 구/군
    region3: string; // 동/읍/면
    roadName: string; // 도로명
    buildingName: string; // 건물명
    zoneNo: string; // 우편번호
  };
}

/**
 * 주소 검색 옵션
 */
export interface AddressSearchOptions {
  /** 검색할 주소 (도로명 또는 지번) */
  query: string;
  /** 결과 개수 (1~30) */
  size?: number;
  /** 페이지 번호 (1~45) */
  page?: number;
}

/**
 * 주소로 좌표 검색
 *
 * @param options - 검색 옵션
 * @returns 주소 검색 결과
 *
 * @example
 * ```ts
 * // 도로명 주소 검색
 * const result = await searchByAddress({
 *   query: "서울 강남구 테헤란로 152",
 * });
 *
 * // 지번 주소 검색
 * const result = await searchByAddress({
 *   query: "서울 강남구 역삼동 737",
 * });
 * ```
 */
export async function searchByAddress(options: AddressSearchOptions): Promise<{
  results: AddressSearchResult[];
  meta: {
    totalCount: number;
    pageableCount: number;
    isEnd: boolean;
  };
}> {
  if (!KAKAO_REST_API_KEY) {
    throw new KakaoApiError(
      "KAKAO_REST_API_KEY가 설정되지 않았습니다",
      "CONFIG_ERROR",
    );
  }

  const params = new URLSearchParams({
    query: options.query,
    page: String(options.page ?? 1),
    size: String(options.size ?? 10),
  });

  const url = `${KAKAO_LOCAL_BASE_URL}/search/address.json?${params.toString()}`;

  const data = await fetchWithRetry<KakaoSearchAddressResponse>(url, {
    method: "GET",
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });

  const results: AddressSearchResult[] = data.documents.map((doc) => ({
    addressName: doc.address_name,
    addressType: doc.address_type,
    coordinate: {
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
    },
    address: doc.address
      ? {
          addressName: doc.address.address_name,
          region1: doc.address.region_1depth_name,
          region2: doc.address.region_2depth_name,
          region3: doc.address.region_3depth_name,
        }
      : undefined,
    roadAddress: doc.road_address
      ? {
          addressName: doc.road_address.address_name,
          region1: doc.road_address.region_1depth_name,
          region2: doc.road_address.region_2depth_name,
          region3: doc.road_address.region_3depth_name,
          roadName: doc.road_address.road_name,
          buildingName: doc.road_address.building_name,
          zoneNo: doc.road_address.zone_no,
        }
      : undefined,
  }));

  return {
    results,
    meta: {
      totalCount: data.meta.total_count,
      pageableCount: data.meta.pageable_count,
      isEnd: data.meta.is_end,
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
  options: CarRouteOptions,
): Promise<CarRoute | null> {
  const startTime = logApiStart("Kakao Car Route", {
    api: "Kakao Mobility",
    method: "GET",
    params: {
      origin: options.origin,
      destination: options.destination,
      waypoints: options.waypoints?.length,
    },
  });

  if (!KAKAO_MOBILITY_KEY) {
    throw new KakaoApiError(
      "KAKAO_MOBILITY_KEY가 설정되지 않았습니다",
      "CONFIG_ERROR",
    );
  }

  try {
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

    const data = await fetchWithRetry<KakaoDirectionsResponse>(url, {
      method: "GET",
      headers: {
        Authorization: `KakaoAK ${KAKAO_MOBILITY_KEY}`,
        "Content-Type": "application/json",
      },
    });

    // 개발 환경: API 응답 확인
    if (process.env.NODE_ENV === "development") {
      console.group("🚗 [Kakao API] 경로 조회 응답");
      console.log("출발지:", options.origin);
      console.log("도착지:", options.destination);
      console.log("API 응답:", JSON.stringify(data, null, 2));
      console.groupEnd();
    }

    // 경로가 없는 경우
    if (!data.routes || data.routes.length === 0) {
      logApiSuccess("Kakao Car Route", startTime, {
        api: "Kakao Mobility",
        params: { result: "no routes" },
      });
      return null;
    }

    const route = data.routes[0];

    // 개발 환경: route.summary.fare 확인
    if (process.env.NODE_ENV === "development") {
      console.group("💰 [Kakao API] 요금 정보");
      console.log("톨비:", route.summary.fare?.toll);
      console.log("택시 요금:", route.summary.fare?.taxi);
      console.log(
        "fare 객체 전체:",
        JSON.stringify(route.summary.fare, null, 2),
      );
      console.log("구간 수:", route.sections.length);
      console.groupEnd();
    }

    // 경로 탐색 실패 (유고 정보, 동일 위치 등)
    // - result_code 1: 출발지/도착지 주변 도로에 유고 정보(교통 장애)
    // - result_code 2: 출발지와 도착지가 5m 이내
    // 이 경우 조용히 null 반환하고 fallback 처리
    if (route.result_code !== 0) {
      logApiSuccess("Kakao Car Route", startTime, {
        api: "Kakao Mobility",
        params: { result: `failed with code ${route.result_code}` },
      });
      return null;
    }

    // 폴리라인 추출 및 구간별 정보 추출
    let polylinePoints: number[] = [];
    const segments: import("@/types/route").CarRouteSegment[] = [];
    const allGuides: import("@/types/route").RouteGuide[] = [];

    for (
      let sectionIndex = 0;
      sectionIndex < route.sections.length;
      sectionIndex++
    ) {
      const section = route.sections[sectionIndex];

      // 구간별 폴리라인 추출
      let sectionPolylinePoints: number[] = [];
      for (const road of section.roads) {
        sectionPolylinePoints = sectionPolylinePoints.concat(road.vertexes);
        polylinePoints = polylinePoints.concat(road.vertexes);
      }

      // 구간별 통행료 추정 (거리 비율로 계산)
      const totalTollFare = route.summary.fare?.toll ?? 0;
      const segmentTollFare =
        route.summary.distance > 0
          ? Math.round(
              (section.distance / route.summary.distance) * totalTollFare,
            )
          : 0;

      // 구간 설명 생성
      let description: string | undefined;

      // 1. 주요 도로명 추출 (빈 문자열이 아닌 것만)
      const roadNames = section.roads
        .map((road) => road.name)
        .filter((name) => name && name.trim().length > 0);

      // 고유한 도로명만 사용 (중복 제거)
      const uniqueRoadNames =
        roadNames.length > 0 ? [...new Set(roadNames)] : [];

      if (uniqueRoadNames.length > 0) {
        if (uniqueRoadNames.length === 1) {
          description = uniqueRoadNames[0];
        } else if (uniqueRoadNames.length <= 5) {
          // 5개 이하면 모두 표시
          description = uniqueRoadNames.join(" → ");
        } else {
          // 5개 초과면 첫 3개, 중간 1개, 마지막 1개 표시 (총 5개)
          const firstThree = uniqueRoadNames.slice(0, 3);
          const middle =
            uniqueRoadNames[Math.floor(uniqueRoadNames.length / 2)];
          const last = uniqueRoadNames[uniqueRoadNames.length - 1];
          description = `${firstThree.join(" → ")} → ... → ${middle} → ... → ${last}`;
        }
      } else {
        // 2. 도로명이 없으면 안내 정보(guides) 활용
        const guideNames =
          section.guides
            ?.map((guide) => guide.name)
            .filter((name) => name && name.trim().length > 0) || [];

        if (guideNames.length > 0) {
          // 첫 번째 안내 정보 사용 (IC, 톨게이트 등)
          description = guideNames[0];
        } else {
          // 3. 그것도 없으면 거리 기반으로 기본 설명
          if (section.distance < 100) {
            description = "단거리 구간";
          } else if (section.distance < 1000) {
            description = "일반 도로";
          } else {
            description = undefined; // 거리가 충분하면 설명 생략 가능
          }
        }
      }

      // 구간별 IC/톨게이트 안내 정보 추출
      const sectionGuides: import("@/types/route").RouteGuide[] = [];

      // 개발 환경: 구간별 guides 원본 확인
      if (process.env.NODE_ENV === "development") {
        console.group(`📍 [Guides 추출] 구간 ${sectionIndex}`);
        console.log("원본 guides:", JSON.stringify(section.guides, null, 2));
        console.log("guides 개수:", section.guides?.length ?? 0);
        console.groupEnd();
      }

      if (section.guides && section.guides.length > 0) {
        for (const guide of section.guides) {
          // IC나 톨게이트 관련 안내만 필터링
          const guideName = guide.name || "";
          if (
            guideName.includes("IC") ||
            guideName.includes("톨게이트") ||
            guideName.includes("TG") ||
            guideName.includes("나들목") ||
            guideName.includes("분기점")
          ) {
            sectionGuides.push({
              name: guide.name,
              coord: { lat: guide.y, lng: guide.x },
              distance: guide.distance,
              duration: Math.round(guide.duration / 60), // 초 → 분
              type: guide.type,
              guidance: guide.guidance,
            });
            // 전체 경로의 guides에도 추가 (중복 제거)
            if (!allGuides.some((g) => g.name === guide.name)) {
              allGuides.push({
                name: guide.name,
                coord: { lat: guide.y, lng: guide.x },
                distance: guide.distance,
                duration: Math.round(guide.duration / 60),
                type: guide.type,
                guidance: guide.guidance,
              });
            }
          }
        }
      }

      // 개발 환경: 필터링된 guides 확인
      if (process.env.NODE_ENV === "development") {
        console.group(`✅ [Guides 필터링 결과] 구간 ${sectionIndex}`);
        console.log("필터링된 guides:", JSON.stringify(sectionGuides, null, 2));
        console.log("필터링된 guides 개수:", sectionGuides.length);
        console.groupEnd();
      }

      segments.push({
        index: sectionIndex,
        distance: section.distance,
        duration: Math.round(section.duration / 60), // 초 → 분
        tollFare: segmentTollFare > 0 ? segmentTollFare : undefined,
        description,
        roadNames: uniqueRoadNames.length > 0 ? uniqueRoadNames : undefined, // 전체 도로명 배열 추가
        polyline: encodePolyline(sectionPolylinePoints),
        guides: sectionGuides.length > 0 ? sectionGuides : undefined,
      });
    }

    // 폴리라인을 간략화된 문자열로 변환 (위도,경도 쌍)
    const polyline = encodePolyline(polylinePoints);

    // Guides 제한: 처음 IC와 끝 IC를 포함하여 최대 5개만 표시
    function limitGuides(
      guides: import("@/types/route").RouteGuide[],
      maxCount: number = 5,
    ): import("@/types/route").RouteGuide[] {
      if (guides.length <= maxCount) {
        return guides;
      }

      const result: import("@/types/route").RouteGuide[] = [];
      const indices = new Set<number>();

      // 첫 번째 IC (항상 포함)
      indices.add(0);

      // 중간 IC들 선택 (균등하게 분배)
      const middleCount = maxCount - 2; // 첫 번째와 마지막 제외
      if (middleCount > 0 && guides.length > 2) {
        for (let i = 1; i <= middleCount; i++) {
          const index = Math.floor(
            ((guides.length - 1) * i) / (middleCount + 1),
          );
          indices.add(index);
        }
      }

      // 마지막 IC (항상 포함)
      indices.add(guides.length - 1);

      // 인덱스 순서대로 정렬하여 결과 생성
      const sortedIndices = Array.from(indices).sort((a, b) => a - b);
      for (const index of sortedIndices) {
        result.push(guides[index]);
      }

      return result.slice(0, maxCount);
    }

    const limitedGuides = limitGuides(allGuides, 5);

    // 개발 환경: Guides 제한 로그
    if (process.env.NODE_ENV === "development" && allGuides.length > 5) {
      console.group("🔍 [Guides 제한] 최대 5개로 제한");
      console.log("원본 guides 개수:", allGuides.length);
      console.log("제한된 guides 개수:", limitedGuides.length);
      console.log(
        "제한된 guides:",
        limitedGuides.map((g) => g.name),
      );
      console.groupEnd();
    }

    // 톨비 필터링: 도시 내 경로에서 톨비 제거
    // - 거리 50km 이하이고 톨비 1000원 이하인 경우 → 도시 내 경로로 간주
    // - 또는 실제 톨게이트/IC가 없는 경우 → 톨비 없음
    let filteredTollFare = route.summary.fare?.toll ?? 0;
    const isShortDistance = route.summary.distance <= 50000; // 50km 이하
    const isLowToll = filteredTollFare <= 1000; // 1000원 이하
    const hasNoTollGates = allGuides.length === 0; // 실제 톨게이트/IC 없음

    if (
      filteredTollFare > 0 &&
      ((isShortDistance && isLowToll) || hasNoTollGates)
    ) {
      // 개발 환경: 톨비 필터링 로그
      if (process.env.NODE_ENV === "development") {
        console.group("🔍 [톨비 필터링] 도시 내 경로 감지");
        console.log("원본 톨비:", filteredTollFare);
        console.log("거리:", route.summary.distance, "m");
        console.log("짧은 거리:", isShortDistance);
        console.log("낮은 톨비:", isLowToll);
        console.log("톨게이트 없음:", hasNoTollGates);
        console.log("필터링된 톨비: 0");
        console.groupEnd();
      }
      filteredTollFare = 0;

      // 구간별 톨비도 모두 0으로 설정
      segments.forEach((segment) => {
        if (segment.tollFare && segment.tollFare > 0) {
          segment.tollFare = undefined;
        }
      });
    }

    const result = {
      totalDuration: Math.round(route.summary.duration / 60), // 초 → 분
      totalDistance: route.summary.distance,
      tollFare: filteredTollFare > 0 ? filteredTollFare : undefined,
      taxiFare: route.summary.fare?.taxi ?? undefined,
      fuelCost: undefined, // Kakao API는 유류비 미제공
      polyline,
      summary: `${route.summary.origin.name} → ${route.summary.destination.name}`,
      segments: segments.length > 0 ? segments : undefined,
      guides: limitedGuides.length > 0 ? limitedGuides : undefined,
    };

    // 개발 환경: 최종 CarRoute 객체 확인
    if (process.env.NODE_ENV === "development") {
      console.group("✅ [최종 CarRoute]");
      console.log("CarRoute 객체:", {
        totalDuration: result.totalDuration,
        totalDistance: result.totalDistance,
        tollFare: result.tollFare,
        taxiFare: result.taxiFare,
        segments: result.segments?.length ?? 0,
        guides: result.guides?.length ?? 0,
        guides_상세: JSON.stringify(result.guides, null, 2),
        segments_상세: JSON.stringify(result.segments?.slice(0, 2), null, 2), // 처음 2개만
      });
      console.groupEnd();
    }

    logApiSuccess("Kakao Car Route", startTime, {
      api: "Kakao Mobility",
      params: {
        duration: result.totalDuration,
        distance: result.totalDistance,
      },
    });

    return result;
  } catch (error) {
    logApiError("Kakao Car Route", startTime, error);
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
  destination: Coordinate,
): Promise<number | null> {
  const route = await getCarRoute({ origin, destination });
  return route?.totalDuration ?? null;
}

/**
 * 두 지점 간 자동차 거리만 조회 (빠른 버전)
 */
export async function getCarDistance(
  origin: Coordinate,
  destination: Coordinate,
): Promise<number | null> {
  const route = await getCarRoute({ origin, destination });
  return route?.totalDistance ?? null;
}

/**
 * 여러 장소 검색 (키워드 목록)
 */
export async function searchMultipleKeywords(
  queries: string[],
  options?: Omit<KeywordSearchOptions, "query">,
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
        })),
      ),
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
