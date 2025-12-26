// ============================================
// ODsay API Client (대중교통 API 클라이언트)
// ============================================

import type {
  ODsayResponse,
  ODsaySearchPathResult,
  ODsayPath,
  ODsayError,
  ODsaySubPath,
} from "@/types/odsay";
import type { Coordinate, TransitRoute, TransitDetails, TransitSubPath, TransitLane } from "@/types";
import { convertODsayPathToTransitRoute, ODSAY_BUS_TYPE_MAP, ODSAY_SUBWAY_LINE_MAP, type ODsayBusType, type ODsaySubwayCode } from "@/types/odsay";

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
    lang: "0",
    output: "json",
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
 * 지하철 노선 색상 매핑
 */
const SUBWAY_LINE_COLORS: Record<number, string> = {
  1: "#0052A4", // 1호선
  2: "#00A84D", // 2호선
  3: "#EF7C1C", // 3호선
  4: "#00A5DE", // 4호선
  5: "#996CAC", // 5호선
  6: "#CD7C2F", // 6호선
  7: "#747F00", // 7호선
  8: "#E6186C", // 8호선
  9: "#BDB092", // 9호선
  100: "#FABE00", // 분당선
  101: "#0090D2", // 공항철도
  104: "#77C4A3", // 경의중앙선
  108: "#0C8E72", // 경춘선
  109: "#D4003B", // 신분당선
  112: "#0054A6", // 경강선
  113: "#B7C452", // 우이신설
  116: "#FABE00", // 수인분당선
  117: "#9A6292", // GTX-A
};

/**
 * 버스 유형별 색상 매핑
 */
const BUS_TYPE_COLORS: Record<number, string> = {
  1: "#52B043", // 일반
  2: "#00A0E9", // 좌석
  3: "#52B043", // 마을
  4: "#E60012", // 직행좌석
  5: "#0068B7", // 공항
  6: "#0068B7", // 간선
  7: "#52B043", // 외곽
  11: "#0068B7", // 간선
  12: "#52B043", // 지선
  13: "#F2B70A", // 순환
  14: "#E60012", // 광역
  15: "#E60012", // 급행
};

/**
 * ODsaySubPath를 TransitSubPath로 변환
 */
function convertSubPathToTransitSubPath(subPath: ODsaySubPath): TransitSubPath {
  const lane = subPath.lane?.[0];
  let transitLane: TransitLane | undefined;

  if (lane) {
    if (subPath.trafficType === 1) {
      // 지하철
      const subwayCode = lane.subwayCode as ODsaySubwayCode | undefined;
      transitLane = {
        name: subwayCode ? ODSAY_SUBWAY_LINE_MAP[subwayCode] ?? lane.name : lane.name,
        subwayCode: lane.subwayCode,
        lineColor: subwayCode ? SUBWAY_LINE_COLORS[subwayCode] : undefined,
      };
    } else if (subPath.trafficType === 2) {
      // 버스
      const busType = lane.type as ODsayBusType | undefined;
      transitLane = {
        name: lane.busNo || lane.name,
        busNo: lane.busNo,
        busType: busType ? ODSAY_BUS_TYPE_MAP[busType] : undefined,
        lineColor: busType ? BUS_TYPE_COLORS[busType] : "#52B043",
      };
    }
  }

  // 경유 정류장 좌표 추출
  const passStopCoords: Array<{ lat: number; lng: number }> = [];
  if (subPath.passStopList?.stations) {
    for (const station of subPath.passStopList.stations) {
      if (station.y && station.x) {
        passStopCoords.push({
          lat: parseFloat(station.y),
          lng: parseFloat(station.x),
        });
      }
    }
  }

  return {
    trafficType: subPath.trafficType,
    distance: subPath.distance,
    sectionTime: subPath.sectionTime,
    stationCount: subPath.stationCount,
    startName: subPath.startName,
    startCoord: subPath.startX && subPath.startY
      ? { lat: subPath.startY, lng: subPath.startX }
      : undefined,
    endName: subPath.endName,
    endCoord: subPath.endX && subPath.endY
      ? { lat: subPath.endY, lng: subPath.endX }
      : undefined,
    lane: transitLane,
    way: subPath.way,
    passStopCoords: passStopCoords.length > 0 ? passStopCoords : undefined,
  };
}

/**
 * ODsayPath에서 TransitDetails 추출
 */
function extractTransitDetails(path: ODsayPath): TransitDetails {
  const subPaths = path.subPath.map(convertSubPathToTransitSubPath);

  // 도보 시간/거리 계산
  const walkingInfo = path.subPath
    .filter((sp) => sp.trafficType === 3)
    .reduce(
      (acc, sp) => ({
        walkingTime: acc.walkingTime + sp.sectionTime,
        walkingDistance: acc.walkingDistance + sp.distance,
      }),
      { walkingTime: 0, walkingDistance: 0 }
    );

  // 환승 횟수 계산 (도보 제외 구간 수 - 1)
  const transferCount = Math.max(
    0,
    path.subPath.filter((sp) => sp.trafficType !== 3).length - 1
  );

  return {
    totalFare: path.info.payment,
    transferCount,
    walkingTime: walkingInfo.walkingTime,
    walkingDistance: walkingInfo.walkingDistance,
    subPaths,
  };
}

/**
 * 좌표 배열을 Google Polyline 알고리즘으로 인코딩
 */
function encodePolyline(coordinates: Coordinate[]): string {
  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const coord of coordinates) {
    const lat = Math.round(coord.lat * 1e5);
    const lng = Math.round(coord.lng * 1e5);

    encoded += encodeNumber(lat - prevLat);
    encoded += encodeNumber(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

/**
 * 숫자를 polyline 문자열로 인코딩
 */
function encodeNumber(num: number): string {
  let value = num < 0 ? ~(num << 1) : num << 1;
  let encoded = "";

  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }
  encoded += String.fromCharCode(value + 63);

  return encoded;
}

/**
 * ODsayPath에서 전체 경로 좌표 추출하여 polyline 생성
 * passStopList가 없는 경우 각 subPath의 시작/종료 좌표만 사용
 */
function extractRoutePolyline(path: ODsayPath): string | undefined {
  const allCoords: Coordinate[] = [];

  for (const subPath of path.subPath) {
    // 출발 좌표
    if (subPath.startX && subPath.startY) {
      allCoords.push({ lat: subPath.startY, lng: subPath.startX });
    }

    // 경유 정류장 좌표 (대중교통 구간)
    if (subPath.passStopList?.stations && subPath.passStopList.stations.length > 0) {
      for (const station of subPath.passStopList.stations) {
        if (station.y && station.x) {
          allCoords.push({
            lat: parseFloat(station.y),
            lng: parseFloat(station.x),
          });
        }
      }
    }

    // 도착 좌표
    if (subPath.endX && subPath.endY) {
      allCoords.push({ lat: subPath.endY, lng: subPath.endX });
    }
  }

  if (allCoords.length < 2) {
    return undefined;
  }

  return encodePolyline(allCoords);
}

/**
 * ODsay loadLane API 응답 타입
 */
interface ODsayLoadLaneResult {
  lane?: Array<{
    class: number;
    section: Array<{
      graphPos: string; // "lng,lat|lng,lat|..." 형태의 좌표 문자열
    }>;
  }>;
}

/**
 * ODsay mapObj를 사용하여 상세 경로 좌표 조회 (loadLane API)
 * @param mapObj - 경로의 mapObj 값 (path.info.mapObj)
 * @returns 좌표 배열
 */
async function getDetailedRouteCoords(mapObj: string): Promise<Coordinate[]> {
  if (!ODSAY_API_KEY || !mapObj) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      apiKey: ODSAY_API_KEY,
      mapObject: mapObj,
      lang: "0",
      output: "json",
    });

    const url = `${ODSAY_BASE_URL}/loadLane?${params.toString()}`;
    const data = await fetchWithRetry<ODsayResponse<ODsayLoadLaneResult>>(url);

    if (!data.result?.lane) {
      return [];
    }

    const allCoords: Coordinate[] = [];

    for (const lane of data.result.lane) {
      for (const section of lane.section) {
        if (section.graphPos) {
          const points = section.graphPos.split("|");
          for (const point of points) {
            const [lngStr, latStr] = point.split(",");
            const lng = parseFloat(lngStr);
            const lat = parseFloat(latStr);
            if (!isNaN(lat) && !isNaN(lng)) {
              allCoords.push({ lat, lng });
            }
          }
        }
      }
    }

    return allCoords;
  } catch (error) {
    console.error("loadLane API 오류:", error);
    return [];
  }
}

/**
 * ODsay 상세 경로 polyline 생성 (loadLane API 사용)
 * @param mapObj - 경로의 mapObj 값
 * @returns 인코딩된 polyline
 */
async function getDetailedRoutePolyline(mapObj: string): Promise<string | undefined> {
  const coords = await getDetailedRouteCoords(mapObj);
  if (coords.length < 2) {
    return undefined;
  }
  return encodePolyline(coords);
}

/**
 * 대중교통 상세 경로 정보 결과
 */
export interface TransitRouteWithDetails extends TransitRoute {
  /** 상세 대중교통 정보 */
  details: TransitDetails;
  /** 인코딩된 폴리라인 (전체 경로) */
  polyline?: string;
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
 * 대중교통 최적 경로 + 상세 정보 조회
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 상세 정보가 포함된 대중교통 경로
 */
export async function getBestTransitRouteWithDetails(
  origin: Coordinate,
  destination: Coordinate
): Promise<TransitRouteWithDetails | null> {
  const result = await searchTransitRoute({
    origin,
    destination,
    sortType: 0, // 추천순
  });

  if (!result || result.rawPaths.length === 0) {
    return null;
  }

  const bestPath = result.rawPaths[0];
  const route = result.routes[0];
  const details = extractTransitDetails(bestPath);

  // 1차: loadLane API로 상세 경로 좌표 조회 시도
  let polyline: string | undefined;
  const mapObj = bestPath.info?.mapObj;

  if (mapObj) {
    polyline = await getDetailedRoutePolyline(mapObj);
  }

  // 2차: loadLane 실패 시 subPath 좌표로 폴백
  if (!polyline) {
    polyline = extractRoutePolyline(bestPath);
  }

  return {
    ...route,
    details,
    polyline,
  };
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
