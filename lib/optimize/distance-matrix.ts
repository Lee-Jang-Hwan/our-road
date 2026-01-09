// ============================================
// Distance Matrix Calculation (거리 행렬 계산)
// ============================================

import type { Coordinate } from "@/types/place";
import type { TransportMode, TransitDetails } from "@/types/route";
import type { DistanceMatrix } from "@/types/optimize";
import type { OptimizeNode, DistanceEntry } from "./types";
import {
  haversineDistance,
  estimateDuration,
} from "@/lib/utils/haversine";
import { batchProcess, tryOrNull } from "@/lib/utils/retry";
import { getCarRoute } from "@/lib/api/kakao";
// Note: ODsay는 최종 경로에만 사용 (enrich-transit-routes.ts에서 처리)
// 대중교통 행렬 계산은 Kakao Mobility API 거리 기반으로 추정

// ============================================
// Types
// ============================================

/**
 * 거리 행렬 계산 옵션
 */
export interface DistanceMatrixOptions {
  /** 이동 수단 */
  mode: TransportMode;
  /** API 호출 사용 여부 (false면 Haversine 직선거리만 사용) */
  useApi?: boolean;
  /** API 호출 병렬 처리 개수 (기본: 3) */
  batchSize?: number;
  /** 진행 콜백 */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * 거리 행렬 캐시 키 생성
 */
function createCacheKey(fromId: string, toId: string): string {
  return `${fromId}:${toId}`;
}

// ============================================
// Haversine 기반 거리 행렬 (빠른 버전)
// ============================================

/**
 * Haversine 공식 기반 거리 행렬 생성
 * - 실제 경로가 아닌 직선거리 사용
 * - API 호출 없이 빠르게 계산
 * - 초기 경로 생성에 적합
 *
 * @param nodes - 최적화 노드 배열
 * @param mode - 이동 수단 (시간 추정에 사용)
 * @returns 거리 행렬
 */
export function createHaversineDistanceMatrix(
  nodes: OptimizeNode[],
  mode: TransportMode
): DistanceMatrix {
  const n = nodes.length;
  const places = nodes.map((node) => node.id);
  const distances: number[][] = Array.from({ length: n }, () =>
    Array(n).fill(0)
  );
  const durations: number[][] = Array.from({ length: n }, () =>
    Array(n).fill(0)
  );
  const modes: TransportMode[][] = Array.from({ length: n }, () =>
    Array(n).fill(mode)
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;

      const dist = Math.round(
        haversineDistance(nodes[i].coordinate, nodes[j].coordinate)
      );
      // 이동 수단에 따른 시간 추정
      const duration = estimateDuration(dist, mode);

      distances[i][j] = dist;
      durations[i][j] = duration;
    }
  }

  return { places, distances, durations, modes };
}

// ============================================
// API 기반 거리 행렬 (정확한 버전)
// ============================================

/**
 * 두 좌표가 너무 가까운지 확인 (5m 이내)
 * Kakao Mobility API는 출발지와 도착지가 5m 이내면 경로 탐색 불가
 */
function isTooClose(origin: Coordinate, destination: Coordinate): boolean {
  const distance = haversineDistance(origin, destination);
  return distance < 10; // 10m 이내면 API 호출 스킵 (안전 마진 포함)
}

/**
 * 두 지점 간의 실제 경로 정보 조회
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @param mode - 이동 수단
 * @returns 거리/시간 정보 또는 null
 */
async function getRouteInfo(
  origin: Coordinate,
  destination: Coordinate,
  mode: TransportMode
): Promise<DistanceEntry | null> {
  // 동일 위치 또는 너무 가까운 경우 API 호출 없이 처리
  if (isTooClose(origin, destination)) {
    const dist = haversineDistance(origin, destination);
    return {
      distance: Math.round(dist),
      duration: Math.max(1, estimateDuration(dist, mode)), // 최소 1분
      mode,
    };
  }

  switch (mode) {
    case "car": {
      console.log("📡 [거리 행렬 API 호출] 자동차 경로 조회", {
        from: `${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)}`,
        to: `${destination.lat.toFixed(6)}, ${destination.lng.toFixed(6)}`,
        timestamp: new Date().toISOString(),
      });

      const route = await tryOrNull(() =>
        getCarRoute({ origin, destination })
      );
      
      if (route) {
        console.log("✅ [거리 행렬 API 호출 성공]", {
          duration: route.totalDuration,
          distance: route.totalDistance,
          timestamp: new Date().toISOString(),
        });
        return {
          distance: route.totalDistance,
          duration: route.totalDuration,
          mode: "car",
          polyline: route.polyline, // 실제 경로 폴리라인
        };
      } else {
        console.warn("⚠️ [거리 행렬 API 호출 실패] 경로를 찾을 수 없음", {
          timestamp: new Date().toISOString(),
        });
      }
      break;
    }

    case "public": {
      // 대중교통 모드는 신규 알고리즘(lib/algorithms/public-transit)에서 처리
      // 거리 행렬 방식은 차량 모드에만 사용
      console.warn(
        "[getRouteInfo] Public transit mode should use new algorithm, not distance matrix"
      );
      return null;
    }

    case "walking": {
      // 도보는 직선거리 기반으로 계산 (API 없음)
      const dist = haversineDistance(origin, destination);
      return {
        distance: Math.round(dist),
        duration: estimateDuration(dist, "walking"),
        mode: "walking",
      };
    }
  }

  return null;
}

/**
 * API 기반 거리 행렬 생성
 * - 실제 경로 정보 사용
 * - API 호출이 많으므로 시간이 오래 걸림
 * - 최종 경로 계산에 적합
 *
 * @param nodes - 최적화 노드 배열
 * @param options - 옵션
 * @returns 거리 행렬
 */
export async function createApiDistanceMatrix(
  nodes: OptimizeNode[],
  options: DistanceMatrixOptions
): Promise<DistanceMatrix> {
  const { mode, batchSize = 3, onProgress } = options;
  const n = nodes.length;
  const places = nodes.map((node) => node.id);

  // 초기값: Haversine 기반
  const distances: number[][] = Array.from({ length: n }, () =>
    Array(n).fill(0)
  );
  const durations: number[][] = Array.from({ length: n }, () =>
    Array(n).fill(0)
  );
  const modes: TransportMode[][] = Array.from({ length: n }, () =>
    Array(n).fill(mode)
  );
  const polylines: (string | null)[][] = Array.from({ length: n }, () =>
    Array(n).fill(null)
  );
  const transitDetailsMatrix: (TransitDetails | null)[][] = Array.from({ length: n }, () =>
    Array(n).fill(null)
  );

  // 출발지/도착지 ID 확인 (관례: __origin__, __destination__, __accommodation_N__)
  const originIdx = places.findIndex((id) => id === "__origin__");
  const destinationIdx = places.findIndex((id) => id === "__destination__");

  // 필요한 (i, j) 쌍만 생성 (불필요한 구간 제거)
  const pairs: Array<{ i: number; j: number }> = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue; // 자기 자신은 제외

      // 불필요한 구간 필터링
      // 1. 도착지에서 나가는 경로 제외 (도착지는 종점)
      if (i === destinationIdx) continue;

      // 2. 출발지로 들어오는 경로 제외 (출발지는 시작점)
      if (j === originIdx) continue;

      pairs.push({ i, j });
    }
  }

  const total = pairs.length;
  let completed = 0;

  // 배치 처리로 API 호출
  await batchProcess(
    pairs,
    async ({ i, j }) => {
      const result = await getRouteInfo(
        nodes[i].coordinate,
        nodes[j].coordinate,
        mode
      );

      if (result) {
        distances[i][j] = result.distance;
        durations[i][j] = result.duration;
        modes[i][j] = result.mode;
        polylines[i][j] = result.polyline || null;
        transitDetailsMatrix[i][j] = result.transitDetails || null;
      } else {
        // 폴백: Haversine 거리
        const dist = Math.round(
          haversineDistance(nodes[i].coordinate, nodes[j].coordinate)
        );
        distances[i][j] = dist;
        durations[i][j] = estimateDuration(dist, mode);
        modes[i][j] = mode;
        polylines[i][j] = null;
        transitDetailsMatrix[i][j] = null;
      }

      completed++;
      onProgress?.(completed, total);
    },
    batchSize,
    500 // 배치 간 500ms 대기
  );

  return { places, distances, durations, modes, polylines, transitDetails: transitDetailsMatrix };
}

// ============================================
// 통합 거리 행렬 생성 함수
// ============================================

/**
 * 거리 행렬 생성 (통합)
 *
 * @param nodes - 최적화 노드 배열
 * @param options - 옵션
 * @returns 거리 행렬
 *
 * @example
 * ```ts
 * // 빠른 Haversine 기반
 * const matrix = await createDistanceMatrix(nodes, {
 *   mode: "car",
 *   useApi: false,
 * });
 *
 * // 정확한 API 기반
 * const matrix = await createDistanceMatrix(nodes, {
 *   mode: "car",
 *   useApi: true,
 *   onProgress: (done, total) => console.log(`${done}/${total}`),
 * });
 * ```
 */
export async function createDistanceMatrix(
  nodes: OptimizeNode[],
  options: DistanceMatrixOptions
): Promise<DistanceMatrix> {
  if (options.useApi) {
    return createApiDistanceMatrix(nodes, options);
  }
  return createHaversineDistanceMatrix(nodes, options.mode);
}

// ============================================
// 거리 행렬 유틸리티
// ============================================

/**
 * 거리 행렬에서 특정 구간의 거리/시간 조회
 *
 * @param matrix - 거리 행렬
 * @param fromId - 출발지 ID
 * @param toId - 도착지 ID
 * @returns 거리 정보 또는 null
 */
export function getDistanceEntry(
  matrix: DistanceMatrix,
  fromId: string,
  toId: string
): DistanceEntry | null {
  const fromIdx = matrix.places.indexOf(fromId);
  const toIdx = matrix.places.indexOf(toId);

  if (fromIdx === -1 || toIdx === -1) {
    return null;
  }

  return {
    distance: matrix.distances[fromIdx][toIdx],
    duration: matrix.durations[fromIdx][toIdx],
    mode: matrix.modes[fromIdx][toIdx],
    polyline: matrix.polylines?.[fromIdx]?.[toIdx] ?? undefined,
    transitDetails: matrix.transitDetails?.[fromIdx]?.[toIdx] ?? undefined,
  };
}

/**
 * 거리 행렬 getter 함수 생성
 *
 * @param matrix - 거리 행렬
 * @returns getter 함수
 */
export function createDistanceMatrixGetter(
  matrix: DistanceMatrix
): (fromId: string, toId: string) => DistanceEntry | null {
  // 인덱스 맵 캐싱
  const indexMap = new Map<string, number>();
  matrix.places.forEach((id, idx) => indexMap.set(id, idx));

  return (fromId: string, toId: string): DistanceEntry | null => {
    const fromIdx = indexMap.get(fromId);
    const toIdx = indexMap.get(toId);

    if (fromIdx === undefined || toIdx === undefined) {
      return null;
    }

    return {
      distance: matrix.distances[fromIdx][toIdx],
      duration: matrix.durations[fromIdx][toIdx],
      mode: matrix.modes[fromIdx][toIdx],
      polyline: matrix.polylines?.[fromIdx]?.[toIdx] ?? undefined,
      transitDetails: matrix.transitDetails?.[fromIdx]?.[toIdx] ?? undefined,
    };
  };
}

/**
 * 경로의 총 비용 계산
 *
 * @param matrix - 거리 행렬
 * @param route - 장소 ID 순서 배열
 * @returns { totalDistance, totalDuration }
 */
export function calculateRouteCost(
  matrix: DistanceMatrix,
  route: string[]
): { totalDistance: number; totalDuration: number } {
  if (route.length < 2) {
    return { totalDistance: 0, totalDuration: 0 };
  }

  const getter = createDistanceMatrixGetter(matrix);
  let totalDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const entry = getter(route[i], route[i + 1]);
    if (entry) {
      totalDistance += entry.distance;
      totalDuration += entry.duration;
    }
  }

  return { totalDistance, totalDuration };
}

/**
 * 원본 좌표로부터 노드 배열 생성 (출발지/도착지 포함)
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @param places - 장소 배열
 * @returns 최적화 노드 배열
 */
export function createNodesWithOriginDestination(
  origin: { id: string; name: string; coordinate: Coordinate },
  destination: { id: string; name: string; coordinate: Coordinate },
  places: OptimizeNode[]
): OptimizeNode[] {
  return [
    {
      ...origin,
      duration: 0,
      priority: 0,
      isFixed: false,
    },
    ...places,
    {
      ...destination,
      duration: 0,
      priority: 0,
      isFixed: false,
    },
  ];
}
