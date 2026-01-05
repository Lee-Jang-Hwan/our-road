// ============================================
// Enrich Transit Routes (대중교통 경로 상세 정보 조회)
// ============================================

/**
 * @fileoverview
 * 최적화 완료 후 최종 경로에 대해서만 ODsay API를 호출하여
 * 대중교통 상세 정보(폴리라인, 환승 정보, 요금 등)를 추가합니다.
 *
 * 이 모듈은 ODsay API 호출 횟수를 최소화하기 위해 설계되었습니다:
 * - 기존: n × (n-1) 호출 (모든 쌍에 대해)
 * - 개선: 최종 경로의 n-1 구간에 대해서만 호출
 */

import type { Coordinate } from "@/types/place";
import type { TransitDetails } from "@/types/route";
import type { DistanceMatrix } from "@/types/optimize";
import { getBestTransitRouteWithDetails } from "@/lib/api/odsay";
import { batchProcess, tryOrNull } from "@/lib/utils/retry";

// ============================================
// Types
// ============================================

/**
 * 대중교통 상세 정보를 조회할 구간
 */
export interface TransitEnrichmentSegment {
  /** 출발지 ID (거리 행렬 인덱스용) */
  fromId: string;
  /** 도착지 ID (거리 행렬 인덱스용) */
  toId: string;
  /** 출발지 좌표 */
  fromCoord: Coordinate;
  /** 도착지 좌표 */
  toCoord: Coordinate;
}

/**
 * 조회된 대중교통 상세 정보
 */
export interface EnrichedTransitRoute {
  /** 출발지 ID */
  fromId: string;
  /** 도착지 ID */
  toId: string;
  /** 인코딩된 폴리라인 */
  polyline?: string;
  /** 대중교통 상세 정보 (환승, 요금, 노선 등) */
  transitDetails?: TransitDetails;
  /** 실제 거리 (미터) - ODsay 기준 */
  distance?: number;
  /** 실제 소요시간 (분) - ODsay 기준 */
  duration?: number;
}

// ============================================
// Main Function
// ============================================

/**
 * 최종 경로 구간들에 대해 ODsay 대중교통 상세 정보 조회
 *
 * @param segments - 조회할 구간 배열
 * @param options - 옵션
 * @returns 구간별 상세 정보 Map (key: `${fromId}:${toId}`)
 *
 * @example
 * ```ts
 * const segments = [
 *   { fromId: "origin", toId: "place1", fromCoord: {...}, toCoord: {...} },
 *   { fromId: "place1", toId: "place2", fromCoord: {...}, toCoord: {...} },
 * ];
 *
 * const enriched = await enrichTransitRoutes(segments);
 *
 * const detail = enriched.get("origin:place1");
 * console.log(detail?.transitDetails?.transferCount);
 * ```
 */
export async function enrichTransitRoutes(
  segments: TransitEnrichmentSegment[],
  options?: {
    /** 배치 크기 (기본: 3) */
    batchSize?: number;
    /** 배치 간 딜레이 (기본: 500ms) */
    batchDelay?: number;
    /** 진행 콜백 */
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<Map<string, EnrichedTransitRoute>> {
  const { batchSize = 3, batchDelay = 500, onProgress } = options ?? {};
  const results = new Map<string, EnrichedTransitRoute>();

  if (segments.length === 0) {
    return results;
  }

  let completed = 0;
  const total = segments.length;

  await batchProcess(
    segments,
    async (segment) => {
      const key = createSegmentKey(segment.fromId, segment.toId);

      const routeWithDetails = await tryOrNull(() =>
        getBestTransitRouteWithDetails(segment.fromCoord, segment.toCoord)
      );

      if (routeWithDetails) {
        results.set(key, {
          fromId: segment.fromId,
          toId: segment.toId,
          polyline: routeWithDetails.polyline,
          transitDetails: routeWithDetails.details,
          distance: routeWithDetails.totalDistance,
          duration: routeWithDetails.totalDuration,
        });
      } else {
        // 조회 실패 시 기본 정보만 저장
        results.set(key, {
          fromId: segment.fromId,
          toId: segment.toId,
        });
      }

      completed++;
      onProgress?.(completed, total);
    },
    batchSize,
    batchDelay
  );

  return results;
}

// ============================================
// Distance Matrix Integration
// ============================================

/**
 * 거리 행렬에 대중교통 상세 정보 추가
 *
 * 최적화 완료 후 실제 사용되는 구간에만 ODsay 정보를 조회하여
 * 거리 행렬의 polylines, transitDetails 배열을 업데이트합니다.
 *
 * @param distanceMatrix - 거리 행렬 (mutated)
 * @param segments - 조회할 구간 배열
 * @param options - 옵션
 */
export async function enrichDistanceMatrixWithTransit(
  distanceMatrix: DistanceMatrix,
  segments: TransitEnrichmentSegment[],
  options?: {
    batchSize?: number;
    batchDelay?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<void> {
  if (segments.length === 0) {
    return;
  }

  // ODsay 상세 정보 조회
  const enrichedMap = await enrichTransitRoutes(segments, options);

  // 인덱스 맵 생성
  const indexMap = new Map<string, number>();
  distanceMatrix.places.forEach((id, idx) => indexMap.set(id, idx));

  // polylines, transitDetails 배열이 없으면 초기화
  const n = distanceMatrix.places.length;
  if (!distanceMatrix.polylines) {
    distanceMatrix.polylines = Array.from({ length: n }, () =>
      Array(n).fill(null)
    );
  }
  if (!distanceMatrix.transitDetails) {
    distanceMatrix.transitDetails = Array.from({ length: n }, () =>
      Array(n).fill(null)
    );
  }

  // 결과를 거리 행렬에 반영
  for (const segment of segments) {
    const key = createSegmentKey(segment.fromId, segment.toId);
    const enriched = enrichedMap.get(key);

    const fromIdx = indexMap.get(segment.fromId);
    const toIdx = indexMap.get(segment.toId);

    if (fromIdx === undefined || toIdx === undefined) {
      continue;
    }

    if (enriched) {
      // 폴리라인 업데이트
      if (enriched.polyline) {
        distanceMatrix.polylines[fromIdx][toIdx] = enriched.polyline;
      }

      // 대중교통 상세 정보 업데이트
      if (enriched.transitDetails) {
        distanceMatrix.transitDetails[fromIdx][toIdx] = enriched.transitDetails;
      }

      // ODsay 기준 거리/시간으로 업데이트 (더 정확)
      if (enriched.distance !== undefined) {
        distanceMatrix.distances[fromIdx][toIdx] = enriched.distance;
      }
      if (enriched.duration !== undefined) {
        distanceMatrix.durations[fromIdx][toIdx] = enriched.duration;
      }
    }
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * 구간 키 생성
 */
export function createSegmentKey(fromId: string, toId: string): string {
  return `${fromId}:${toId}`;
}

/**
 * 일자별 분배 결과에서 실제 사용되는 구간 추출
 *
 * @param days - 일자별 장소 ID 배열
 * @param nodeMap - 노드 맵 (ID -> 좌표)
 * @param originId - 출발지 ID
 * @param destinationId - 도착지 ID
 * @param getAccommodationForDate - 날짜별 숙소 노드 조회 함수
 * @param dates - 날짜 배열
 * @returns 조회할 구간 배열
 */
export function extractRouteSegments(
  days: string[][],
  nodeMap: Map<string, { coordinate: Coordinate }>,
  originId: string,
  destinationId: string,
  getAccommodationForDate: (date: string) => { id: string; coordinate: Coordinate } | undefined,
  dates: string[]
): TransitEnrichmentSegment[] {
  const segments: TransitEnrichmentSegment[] = [];
  const addedKeys = new Set<string>();

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const dayPlaceIds = days[dayIdx];
    const date = dates[dayIdx];
    const isFirstDay = dayIdx === 0;
    const isLastDay = dayIdx === days.length - 1;

    // 실제 방문 장소만 필터링 (출발지/도착지/숙소 제외)
    const actualPlaceIds = dayPlaceIds.filter(
      (id) =>
        id !== "__origin__" &&
        id !== "__destination__" &&
        !id.startsWith("__accommodation_")
    );

    if (actualPlaceIds.length === 0) {
      continue;
    }

    // 시작점 결정
    let startId: string;
    if (isFirstDay) {
      startId = originId;
    } else {
      const prevDate = dates[dayIdx - 1];
      const prevAccom = getAccommodationForDate(prevDate);
      startId = prevAccom?.id ?? originId;
    }

    // 시작점 -> 첫 장소
    const firstPlaceId = actualPlaceIds[0];
    const startNode = nodeMap.get(startId);
    const firstNode = nodeMap.get(firstPlaceId);

    if (startNode && firstNode) {
      const key = createSegmentKey(startId, firstPlaceId);
      if (!addedKeys.has(key)) {
        segments.push({
          fromId: startId,
          toId: firstPlaceId,
          fromCoord: startNode.coordinate,
          toCoord: firstNode.coordinate,
        });
        addedKeys.add(key);
      }
    }

    // 장소 간 이동
    for (let i = 0; i < actualPlaceIds.length - 1; i++) {
      const fromId = actualPlaceIds[i];
      const toId = actualPlaceIds[i + 1];
      const fromNode = nodeMap.get(fromId);
      const toNode = nodeMap.get(toId);

      if (fromNode && toNode) {
        const key = createSegmentKey(fromId, toId);
        if (!addedKeys.has(key)) {
          segments.push({
            fromId,
            toId,
            fromCoord: fromNode.coordinate,
            toCoord: toNode.coordinate,
          });
          addedKeys.add(key);
        }
      }
    }

    // 마지막 장소 -> 끝점
    const lastPlaceId = actualPlaceIds[actualPlaceIds.length - 1];
    let endId: string;

    if (isLastDay) {
      endId = destinationId;
    } else {
      const todayAccom = getAccommodationForDate(date);
      if (todayAccom) {
        endId = todayAccom.id;
      } else {
        // 숙소가 없으면 끝점 이동 없음
        continue;
      }
    }

    const lastNode = nodeMap.get(lastPlaceId);
    const endNode = nodeMap.get(endId);

    if (lastNode && endNode) {
      const key = createSegmentKey(lastPlaceId, endId);
      if (!addedKeys.has(key)) {
        segments.push({
          fromId: lastPlaceId,
          toId: endId,
          fromCoord: lastNode.coordinate,
          toCoord: endNode.coordinate,
        });
        addedKeys.add(key);
      }
    }
  }

  return segments;
}
