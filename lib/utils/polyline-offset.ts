/**
 * @file polyline-offset.ts
 * @description 폴리라인 경로에 오프셋을 적용하여 겹치는 경로를 나란히 표시하는 유틸리티 함수
 * 
 * 주요 기능:
 * - 폴리라인의 각 점에서 진행 방향에 수직으로 오프셋 적용
 * - 여러 경로가 겹칠 때 각 경로를 옆으로 이동시켜 모두 보이도록 함
 */

import type { Coordinate } from "@/types/place";

/**
 * 두 좌표 간의 방위각(bearing)을 계산 (도 단위)
 * @param from - 시작 좌표
 * @param to - 끝 좌표
 * @returns 방위각 (0-360도)
 */
function calculateBearing(from: Coordinate, to: Coordinate): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * 주어진 좌표에서 방위각과 거리를 이용하여 새로운 좌표를 계산
 * @param coord - 시작 좌표
 * @param bearing - 방위각 (도 단위)
 * @param distanceMeters - 이동 거리 (미터)
 * @returns 새로운 좌표
 */
function moveCoordinate(
  coord: Coordinate,
  bearing: number,
  distanceMeters: number
): Coordinate {
  const earthRadius = 6371000; // 지구 반경 (미터)
  const bearingRad = (bearing * Math.PI) / 180;
  const latRad = (coord.lat * Math.PI) / 180;
  const lngRad = (coord.lng * Math.PI) / 180;
  const angularDistance = distanceMeters / earthRadius;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const newLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    );

  return {
    lat: (newLatRad * 180) / Math.PI,
    lng: (newLngRad * 180) / Math.PI,
  };
}

/**
 * 폴리라인 경로에 수직 오프셋을 적용
 * @param path - 원본 경로 좌표 배열
 * @param offsetMeters - 오프셋 거리 (미터), 양수는 오른쪽, 음수는 왼쪽
 * @returns 오프셋이 적용된 새로운 경로 좌표 배열
 */
export function offsetPolyline(
  path: Coordinate[],
  offsetMeters: number
): Coordinate[] {
  if (path.length < 2 || offsetMeters === 0) {
    return path;
  }

  const offsetPath: Coordinate[] = [];

  for (let i = 0; i < path.length; i++) {
    const current = path[i];
    let bearing: number;

    if (i === 0) {
      // 첫 번째 점: 다음 점으로의 방향 사용
      bearing = calculateBearing(current, path[i + 1]);
    } else if (i === path.length - 1) {
      // 마지막 점: 이전 점으로부터의 방향 사용
      bearing = calculateBearing(path[i - 1], current);
    } else {
      // 중간 점: 이전과 다음 점의 평균 방향 사용
      const bearing1 = calculateBearing(path[i - 1], current);
      const bearing2 = calculateBearing(current, path[i + 1]);
      bearing = (bearing1 + bearing2) / 2;
    }

    // 진행 방향에서 90도 회전 (오른쪽으로)
    const perpendicularBearing = (bearing + 90) % 360;

    // 오프셋 적용
    const offsetCoord = moveCoordinate(current, perpendicularBearing, offsetMeters);
    offsetPath.push(offsetCoord);
  }

  return offsetPath;
}

/**
 * 여러 경로에 대해 균등하게 분산된 오프셋을 계산
 * @param routeCount - 총 경로 개수
 * @param baseOffsetMeters - 기본 오프셋 거리 (미터)
 * @returns 각 경로의 오프셋 값 배열
 */
export function calculateRouteOffsets(
  routeCount: number,
  baseOffsetMeters: number = 15
): number[] {
  if (routeCount <= 1) {
    return [0];
  }

  const offsets: number[] = [];
  const totalWidth = (routeCount - 1) * baseOffsetMeters;
  const startOffset = -totalWidth / 2;

  for (let i = 0; i < routeCount; i++) {
    offsets.push(startOffset + i * baseOffsetMeters);
  }

  return offsets;
}

/**
 * 인코딩된 폴리라인을 디코딩 (Google Polyline Algorithm)
 * @param encoded - 인코딩된 폴리라인 문자열
 * @returns 좌표 배열
 */
export function decodePolyline(encoded: string): Coordinate[] {
  const points: Coordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Decode latitude
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    // Decode longitude
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}



