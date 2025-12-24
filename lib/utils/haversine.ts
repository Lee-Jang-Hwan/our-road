// ============================================
// Haversine Distance Calculation (직선거리 계산)
// ============================================

import type { Coordinate } from "@/types/place";

/**
 * 지구 반경 (미터)
 */
const EARTH_RADIUS_METERS = 6_371_000;

/**
 * 도(degree)를 라디안(radian)으로 변환
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Haversine 공식을 사용하여 두 좌표 간의 직선거리(Great-circle distance) 계산
 *
 * @param coord1 - 첫 번째 좌표
 * @param coord2 - 두 번째 좌표
 * @returns 거리 (미터)
 *
 * @example
 * ```ts
 * const distance = haversineDistance(
 *   { lat: 37.5665, lng: 126.9780 }, // 서울 시청
 *   { lat: 37.5796, lng: 126.9770 }, // 경복궁
 * );
 * console.log(distance); // 약 1450m
 * ```
 */
export function haversineDistance(
  coord1: Coordinate,
  coord2: Coordinate
): number {
  const lat1 = toRadians(coord1.lat);
  const lat2 = toRadians(coord2.lat);
  const deltaLat = toRadians(coord2.lat - coord1.lat);
  const deltaLng = toRadians(coord2.lng - coord1.lng);

  // Haversine 공식
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Haversine 거리를 킬로미터로 반환
 *
 * @param coord1 - 첫 번째 좌표
 * @param coord2 - 두 번째 좌표
 * @returns 거리 (킬로미터)
 */
export function haversineDistanceKm(
  coord1: Coordinate,
  coord2: Coordinate
): number {
  return haversineDistance(coord1, coord2) / 1000;
}

/**
 * 직선거리 기반 예상 이동 시간 계산
 *
 * @param distance - 거리 (미터)
 * @param mode - 이동 수단 ("walking" | "public" | "car")
 * @returns 예상 시간 (분)
 *
 * 속도 가정:
 * - 도보: 4km/h (약 66.7m/min)
 * - 대중교통: 20km/h (약 333m/min) - 대기시간 포함 평균
 * - 자동차: 30km/h (약 500m/min) - 도심 평균 (신호대기 포함)
 */
export function estimateDuration(
  distance: number,
  mode: "walking" | "public" | "car"
): number {
  const speedsMetersPerMin: Record<typeof mode, number> = {
    walking: 66.7, // 4km/h
    public: 333, // 20km/h (대기시간 포함)
    car: 500, // 30km/h (도심)
  };

  const speed = speedsMetersPerMin[mode];
  return Math.ceil(distance / speed);
}

/**
 * 두 좌표 간의 거리와 예상 시간을 함께 계산
 *
 * @param coord1 - 첫 번째 좌표
 * @param coord2 - 두 번째 좌표
 * @param mode - 이동 수단
 * @returns { distance: 미터, duration: 분 }
 */
export function calculateDistanceAndDuration(
  coord1: Coordinate,
  coord2: Coordinate,
  mode: "walking" | "public" | "car"
): { distance: number; duration: number } {
  const distance = haversineDistance(coord1, coord2);
  const duration = estimateDuration(distance, mode);
  return { distance: Math.round(distance), duration };
}

/**
 * 여러 좌표 간의 총 거리 계산 (경로 순서대로)
 *
 * @param coordinates - 좌표 배열
 * @returns 총 거리 (미터)
 */
export function calculateTotalDistance(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += haversineDistance(coordinates[i], coordinates[i + 1]);
  }

  return Math.round(total);
}

/**
 * 여러 좌표 간의 거리 행렬 생성 (Haversine 기반)
 *
 * @param coordinates - 좌표 배열 (ID와 함께)
 * @returns 거리 행렬 (2D 배열, distances[i][j] = i에서 j까지 거리)
 */
export function createHaversineMatrix(
  coordinates: Array<{ id: string; coordinate: Coordinate }>
): {
  ids: string[];
  distances: number[][];
} {
  const n = coordinates.length;
  const distances: number[][] = Array.from({ length: n }, () =>
    Array(n).fill(0)
  );

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = Math.round(
        haversineDistance(coordinates[i].coordinate, coordinates[j].coordinate)
      );
      distances[i][j] = dist;
      distances[j][i] = dist; // 대칭
    }
  }

  return {
    ids: coordinates.map((c) => c.id),
    distances,
  };
}
