// ============================================
// Nearest Neighbor Algorithm (최근접 이웃 알고리즘)
// ============================================

import type { DistanceMatrix } from "@/types/optimize";
import type { OptimizeNode, OptimizeConfig } from "./types";
import { createDistanceMatrixGetter } from "./distance-matrix";
import { calculateCost } from "@/types/optimize";

// ============================================
// Types
// ============================================

/**
 * Nearest Neighbor 알고리즘 결과
 */
export interface NearestNeighborResult {
  /** 최적화된 경로 (장소 ID 순서) */
  route: string[];
  /** 총 이동 거리 (미터) */
  totalDistance: number;
  /** 총 이동 시간 (분) */
  totalDuration: number;
  /** 가중치 적용된 총 비용 */
  totalCost: number;
}

// ============================================
// Core Algorithm
// ============================================

/**
 * Nearest Neighbor 알고리즘
 *
 * 탐욕적(Greedy) 방식으로 현재 위치에서 가장 가까운 미방문 장소를
 * 다음 방문지로 선택하여 경로를 생성합니다.
 *
 * - 시간 복잡도: O(n²)
 * - 공간 복잡도: O(n)
 * - 최적해 보장: X (휴리스틱)
 * - 적합한 용도: 초기 경로 생성, 빠른 근사해
 *
 * @param nodes - 최적화 노드 배열
 * @param distanceMatrix - 거리 행렬
 * @param config - 최적화 설정
 * @param startId - 시작 노드 ID (기본: 첫 번째 노드)
 * @returns 알고리즘 결과
 *
 * @example
 * ```ts
 * const result = nearestNeighbor(
 *   nodes,
 *   distanceMatrix,
 *   { timeWeight: 1.0, distanceWeight: 0.1 },
 *   "origin-node-id"
 * );
 * console.log(result.route); // ["origin", "place1", "place2", ...]
 * ```
 */
export function nearestNeighbor(
  nodes: OptimizeNode[],
  distanceMatrix: DistanceMatrix,
  config: Pick<OptimizeConfig, "timeWeight" | "distanceWeight">,
  startId?: string
): NearestNeighborResult {
  if (nodes.length === 0) {
    return {
      route: [],
      totalDistance: 0,
      totalDuration: 0,
      totalCost: 0,
    };
  }

  if (nodes.length === 1) {
    return {
      route: [nodes[0].id],
      totalDistance: 0,
      totalDuration: 0,
      totalCost: 0,
    };
  }

  const getDistance = createDistanceMatrixGetter(distanceMatrix);

  // 시작 노드 결정
  const startNode = startId
    ? nodes.find((n) => n.id === startId)
    : nodes[0];

  if (!startNode) {
    throw new Error(`Start node not found: ${startId}`);
  }

  // 결과 초기화
  const route: string[] = [startNode.id];
  const visited = new Set<string>([startNode.id]);
  let totalDistance = 0;
  let totalDuration = 0;
  let totalCost = 0;
  let currentId = startNode.id;

  // 모든 노드를 방문할 때까지 반복
  while (visited.size < nodes.length) {
    let nearestId: string | null = null;
    let nearestCost = Infinity;
    let nearestDistance = 0;
    let nearestDuration = 0;

    // 미방문 노드 중 가장 가까운 것 탐색
    for (const node of nodes) {
      if (visited.has(node.id)) continue;

      const entry = getDistance(currentId, node.id);
      if (!entry) continue;

      // 비용 계산 (시간 + 거리 가중합)
      const cost = calculateCost({
        travelTime: entry.duration,
        travelDistance: entry.distance,
        timeWeight: config.timeWeight,
        distanceWeight: config.distanceWeight,
      });

      if (cost < nearestCost) {
        nearestCost = cost;
        nearestId = node.id;
        nearestDistance = entry.distance;
        nearestDuration = entry.duration;
      }
    }

    // 다음 노드로 이동
    if (nearestId) {
      route.push(nearestId);
      visited.add(nearestId);
      totalDistance += nearestDistance;
      totalDuration += nearestDuration;
      totalCost += nearestCost;
      currentId = nearestId;
    } else {
      // 더 이상 방문할 노드가 없음 (연결 끊김)
      break;
    }
  }

  return {
    route,
    totalDistance,
    totalDuration,
    totalCost,
  };
}

/**
 * 출발지와 도착지를 고정한 Nearest Neighbor 알고리즘
 *
 * @param nodes - 중간 방문 노드 배열 (출발지/도착지 제외)
 * @param distanceMatrix - 거리 행렬 (출발지/도착지 포함)
 * @param config - 최적화 설정
 * @param originId - 출발지 ID
 * @param destinationId - 도착지 ID
 * @returns 알고리즘 결과
 */
export function nearestNeighborWithEndpoints(
  nodes: OptimizeNode[],
  distanceMatrix: DistanceMatrix,
  config: Pick<OptimizeConfig, "timeWeight" | "distanceWeight">,
  originId: string,
  destinationId: string
): NearestNeighborResult {
  // 중간 노드들만으로 경로 생성
  const middleNodes = nodes.filter(
    (n) => n.id !== originId && n.id !== destinationId
  );

  if (middleNodes.length === 0) {
    // 중간 노드 없음: 출발 → 도착 직행
    const getDistance = createDistanceMatrixGetter(distanceMatrix);
    const entry = getDistance(originId, destinationId);

    return {
      route: [originId, destinationId],
      totalDistance: entry?.distance ?? 0,
      totalDuration: entry?.duration ?? 0,
      totalCost: entry
        ? calculateCost({
            travelTime: entry.duration,
            travelDistance: entry.distance,
            timeWeight: config.timeWeight,
            distanceWeight: config.distanceWeight,
          })
        : 0,
    };
  }

  // 출발지에서 시작하여 중간 노드들 방문
  const getDistance = createDistanceMatrixGetter(distanceMatrix);
  const visited = new Set<string>();
  const route: string[] = [originId];
  let totalDistance = 0;
  let totalDuration = 0;
  let totalCost = 0;
  let currentId = originId;

  // 모든 중간 노드 방문
  while (visited.size < middleNodes.length) {
    let nearestId: string | null = null;
    let nearestCost = Infinity;
    let nearestDistance = 0;
    let nearestDuration = 0;

    for (const node of middleNodes) {
      if (visited.has(node.id)) continue;

      const entry = getDistance(currentId, node.id);
      if (!entry) continue;

      const cost = calculateCost({
        travelTime: entry.duration,
        travelDistance: entry.distance,
        timeWeight: config.timeWeight,
        distanceWeight: config.distanceWeight,
      });

      if (cost < nearestCost) {
        nearestCost = cost;
        nearestId = node.id;
        nearestDistance = entry.distance;
        nearestDuration = entry.duration;
      }
    }

    if (nearestId) {
      route.push(nearestId);
      visited.add(nearestId);
      totalDistance += nearestDistance;
      totalDuration += nearestDuration;
      totalCost += nearestCost;
      currentId = nearestId;
    } else {
      break;
    }
  }

  // 마지막 노드에서 도착지로 이동
  const lastEntry = getDistance(currentId, destinationId);
  if (lastEntry) {
    route.push(destinationId);
    totalDistance += lastEntry.distance;
    totalDuration += lastEntry.duration;
    totalCost += calculateCost({
      travelTime: lastEntry.duration,
      travelDistance: lastEntry.distance,
      timeWeight: config.timeWeight,
      distanceWeight: config.distanceWeight,
    });
  } else {
    // 도착지로의 경로가 없어도 일단 추가
    route.push(destinationId);
  }

  return {
    route,
    totalDistance,
    totalDuration,
    totalCost,
  };
}

/**
 * 경로의 총 비용 계산
 *
 * @param route - 장소 ID 순서 배열
 * @param distanceMatrix - 거리 행렬
 * @param config - 최적화 설정
 * @returns 총 비용 정보
 */
export function calculateRouteMetrics(
  route: string[],
  distanceMatrix: DistanceMatrix,
  config: Pick<OptimizeConfig, "timeWeight" | "distanceWeight">
): { totalDistance: number; totalDuration: number; totalCost: number } {
  if (route.length < 2) {
    return { totalDistance: 0, totalDuration: 0, totalCost: 0 };
  }

  const getDistance = createDistanceMatrixGetter(distanceMatrix);
  let totalDistance = 0;
  let totalDuration = 0;
  let totalCost = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const entry = getDistance(route[i], route[i + 1]);
    if (entry) {
      totalDistance += entry.distance;
      totalDuration += entry.duration;
      totalCost += calculateCost({
        travelTime: entry.duration,
        travelDistance: entry.distance,
        timeWeight: config.timeWeight,
        distanceWeight: config.distanceWeight,
      });
    }
  }

  return { totalDistance, totalDuration, totalCost };
}
