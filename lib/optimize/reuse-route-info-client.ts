/**
 * @file reuse-route-info-client.ts
 * @description 경로 정보 재사용 유틸리티 함수 (Client-safe)
 *
 * Client Component에서도 사용 가능한 경로 정보 재사용 함수입니다.
 *
 * @dependencies
 * - @/types/route: RouteSegment
 * - @/types/optimize: DistanceMatrix
 */

import type { RouteSegment } from "@/types/route";
import type { DistanceMatrix } from "@/types/optimize";

/**
 * 거리 행렬에서 경로 정보 조회 (차량 모드)
 *
 * @param placeId1 - 출발지 장소 ID
 * @param placeId2 - 도착지 장소 ID
 * @param distanceMatrix - 거리 행렬
 * @returns 경로 정보 또는 null
 */
export function getRouteFromDistanceMatrix(
  placeId1: string,
  placeId2: string,
  distanceMatrix: DistanceMatrix,
): RouteSegment | null {
  const index1 = distanceMatrix.places.indexOf(placeId1);
  const index2 = distanceMatrix.places.indexOf(placeId2);

  // 장소가 거리 행렬에 없으면 null 반환
  if (index1 === -1 || index2 === -1) {
    return null;
  }

  const distance = distanceMatrix.distances[index1]?.[index2];
  const duration = distanceMatrix.durations[index1]?.[index2];
  const mode = distanceMatrix.modes[index1]?.[index2];
  const polyline = distanceMatrix.polylines?.[index1]?.[index2];
  const transitDetails = distanceMatrix.transitDetails?.[index1]?.[index2];

  // 거리나 시간 정보가 없으면 null 반환
  if (distance === undefined || duration === undefined || !mode) {
    return null;
  }

  return {
    mode,
    distance,
    duration,
    polyline: polyline || undefined,
    transitDetails: transitDetails || undefined,
  };
}

