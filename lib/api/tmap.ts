// ============================================
// TMAP API Client (티맵 API 클라이언트)
// ============================================

import type { Coordinate, WalkingRoute } from "@/types";

// ============================================
// Configuration
// ============================================

const TMAP_APP_KEY = process.env.TMAP_APP_KEY;
const TMAP_API_BASE_URL = "https://apis.openapi.sk.com/tmap";

/**
 * 재시도 설정
 */
const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelay: 500,
  maxDelay: 3000,
};

// ============================================
// Error Types
// ============================================

export class TmapApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "TmapApiError";
  }
}

// ============================================
// Types
// ============================================

/**
 * TMAP 도보 경로 응답
 */
interface TmapWalkingResponse {
  type: string;
  features: TmapFeature[];
}

interface TmapFeature {
  type: string;
  geometry: {
    type: "Point" | "LineString";
    coordinates: number[] | number[][];
  };
  properties: {
    totalDistance?: number;
    totalTime?: number;
    index?: number;
    pointIndex?: number;
    name?: string;
    description?: string;
    direction?: string;
    nearPoiName?: string;
    nearPoiX?: string;
    nearPoiY?: string;
    intersectionName?: string;
    facilityType?: string;
    facilityName?: string;
    turnType?: number;
    pointType?: string;
    lineIndex?: number;
    distance?: number;
    time?: number;
    roadType?: number;
    categoryRoadType?: number;
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * 지수 백오프 지연 계산
 */
function calculateBackoffDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 500;
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
        throw new TmapApiError(
          `TMAP API 오류: ${errorText}`,
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

      // TmapApiError는 바로 throw
      if (error instanceof TmapApiError) {
        throw error;
      }
    }
  }

  throw lastError || new TmapApiError("알 수 없는 오류", "UNKNOWN_ERROR");
}

/**
 * Google Polyline Algorithm으로 인코딩
 */
function encodePolyline(coordinates: number[][]): string {
  if (coordinates.length === 0) return "";

  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const coord of coordinates) {
    const lng = coord[0];
    const lat = coord[1];

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
// TMAP Walking Route API
// ============================================

/**
 * TMAP 도보 경로 조회
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 도보 경로 정보 또는 null
 *
 * @example
 * ```ts
 * const route = await getTmapWalkingRoute(
 *   { lat: 37.5665, lng: 126.9780 },
 *   { lat: 37.5796, lng: 126.9770 }
 * );
 * ```
 */
export async function getTmapWalkingRoute(
  origin: Coordinate,
  destination: Coordinate
): Promise<WalkingRoute | null> {
  if (!TMAP_APP_KEY) {
    console.warn("TMAP_APP_KEY가 설정되지 않았습니다. Fallback 사용.");
    return null;
  }

  const url = `${TMAP_API_BASE_URL}/routes/pedestrian?version=1`;

  const requestBody = {
    startX: origin.lng.toString(),
    startY: origin.lat.toString(),
    endX: destination.lng.toString(),
    endY: destination.lat.toString(),
    reqCoordType: "WGS84GEO",
    resCoordType: "WGS84GEO",
    startName: encodeURIComponent("출발지"),
    endName: encodeURIComponent("도착지"),
  };

  try {
    const data = await fetchWithRetry<TmapWalkingResponse>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        appKey: TMAP_APP_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!data.features || data.features.length === 0) {
      return null;
    }

    // 첫 번째 feature에서 전체 통계 추출
    const firstFeature = data.features[0];
    const totalDistance = firstFeature.properties.totalDistance ?? 0;
    const totalTime = firstFeature.properties.totalTime ?? 0;

    // LineString geometry에서 좌표 추출하여 폴리라인 생성
    const allCoordinates: number[][] = [];
    for (const feature of data.features) {
      if (feature.geometry.type === "LineString") {
        const coords = feature.geometry.coordinates as number[][];
        allCoordinates.push(...coords);
      }
    }

    const polyline = encodePolyline(allCoordinates);

    return {
      totalDuration: Math.ceil(totalTime / 60), // 초 → 분
      totalDistance: totalDistance, // 미터
      polyline,
    };
  } catch (error) {
    if (error instanceof TmapApiError) {
      console.error("TMAP API 오류:", error.message);
    } else {
      console.error("TMAP 도보 경로 조회 오류:", error);
    }
    return null;
  }
}

/**
 * 두 지점 간 도보 소요시간만 조회 (빠른 버전)
 */
export async function getTmapWalkingDuration(
  origin: Coordinate,
  destination: Coordinate
): Promise<number | null> {
  const route = await getTmapWalkingRoute(origin, destination);
  return route?.totalDuration ?? null;
}

/**
 * 두 지점 간 도보 거리만 조회 (빠른 버전)
 */
export async function getTmapWalkingDistance(
  origin: Coordinate,
  destination: Coordinate
): Promise<number | null> {
  const route = await getTmapWalkingRoute(origin, destination);
  return route?.totalDistance ?? null;
}

// ============================================
// Export
// ============================================

export { TMAP_API_BASE_URL, RETRY_CONFIG };
