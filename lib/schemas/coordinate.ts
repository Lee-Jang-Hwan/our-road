// ============================================
// Coordinate Zod Schema (좌표 스키마)
// ============================================

import { z } from "zod";

/**
 * 좌표 검증 스키마
 * - lat: 위도 (-90 ~ 90)
 * - lng: 경도 (-180 ~ 180)
 */
export const coordinateSchema = z.object({
  lat: z
    .number()
    .min(-90, "위도는 -90 이상이어야 합니다")
    .max(90, "위도는 90 이하여야 합니다"),
  lng: z
    .number()
    .min(-180, "경도는 -180 이상이어야 합니다")
    .max(180, "경도는 180 이하여야 합니다"),
});

/**
 * 좌표 타입 (스키마에서 추론)
 */
export type CoordinateInput = z.infer<typeof coordinateSchema>;

/**
 * 한국 내 좌표 검증 스키마 (대략적인 범위)
 * - lat: 33 ~ 43 (제주도 ~ 북한 최북단)
 * - lng: 124 ~ 132 (서해 ~ 동해)
 */
export const koreaCoordinateSchema = z.object({
  lat: z
    .number()
    .min(33, "한국 내 위도 범위를 벗어났습니다")
    .max(43, "한국 내 위도 범위를 벗어났습니다"),
  lng: z
    .number()
    .min(124, "한국 내 경도 범위를 벗어났습니다")
    .max(132, "한국 내 경도 범위를 벗어났습니다"),
});

/**
 * 좌표 유효성 검사 함수
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * 한국 내 좌표인지 확인하는 함수
 */
export function isKoreaCoordinate(lat: number, lng: number): boolean {
  return lat >= 33 && lat <= 43 && lng >= 124 && lng <= 132;
}
