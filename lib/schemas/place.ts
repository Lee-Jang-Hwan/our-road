// ============================================
// Place Zod Schema (장소 스키마)
// ============================================

import { z } from "zod";
import { coordinateSchema } from "./coordinate";
import { durationSchema, prioritySchema, uuidSchema } from "./common";

/**
 * 장소 카테고리 스키마
 */
export const placeCategorySchema = z.enum([
  "tourist_attraction",
  "restaurant",
  "cafe",
  "shopping",
  "accommodation",
  "entertainment",
  "culture",
  "nature",
  "other",
]);

/**
 * 장소 기본 정보 스키마
 */
export const placeSchema = z.object({
  id: uuidSchema,
  name: z
    .string()
    .min(1, "장소명은 필수입니다")
    .max(100, "장소명은 100자 이하여야 합니다"),
  address: z
    .string()
    .min(1, "주소는 필수입니다")
    .max(200, "주소는 200자 이하여야 합니다"),
  coordinate: coordinateSchema,
  category: placeCategorySchema.optional(),
  kakaoPlaceId: z.string().optional(),
  estimatedDuration: durationSchema,
  priority: prioritySchema.optional(),
});

/**
 * 장소 생성 스키마 (id 없이)
 */
export const createPlaceSchema = z.object({
  tripId: uuidSchema,
  name: z
    .string()
    .min(1, "장소명은 필수입니다")
    .max(100, "장소명은 100자 이하여야 합니다"),
  address: z
    .string()
    .min(1, "주소는 필수입니다")
    .max(200, "주소는 200자 이하여야 합니다"),
  lat: z
    .number()
    .min(-90, "위도는 -90 이상이어야 합니다")
    .max(90, "위도는 90 이하여야 합니다"),
  lng: z
    .number()
    .min(-180, "경도는 -180 이상이어야 합니다")
    .max(180, "경도는 180 이하여야 합니다"),
  category: placeCategorySchema.optional(),
  kakaoPlaceId: z.string().optional(),
  estimatedDuration: durationSchema.default(60),
  priority: prioritySchema.optional(),
});

/**
 * 장소 수정 스키마 (부분 업데이트)
 */
export const updatePlaceSchema = z.object({
  name: z
    .string()
    .min(1, "장소명은 필수입니다")
    .max(100, "장소명은 100자 이하여야 합니다")
    .optional(),
  address: z
    .string()
    .min(1, "주소는 필수입니다")
    .max(200, "주소는 200자 이하여야 합니다")
    .optional(),
  lat: z
    .number()
    .min(-90, "위도는 -90 이상이어야 합니다")
    .max(90, "위도는 90 이하여야 합니다")
    .optional(),
  lng: z
    .number()
    .min(-180, "경도는 -180 이상이어야 합니다")
    .max(180, "경도는 180 이하여야 합니다")
    .optional(),
  category: placeCategorySchema.optional(),
  estimatedDuration: durationSchema.optional(),
  priority: prioritySchema.optional(),
});

/**
 * 장소 순서 변경 스키마
 */
export const reorderPlacesSchema = z.object({
  tripId: uuidSchema,
  placeIds: z.array(uuidSchema).min(1, "최소 1개 이상의 장소가 필요합니다"),
});

/**
 * 장소 검색 요청 스키마
 */
export const searchPlacesSchema = z.object({
  query: z
    .string()
    .min(1, "검색어를 입력해주세요")
    .max(100, "검색어는 100자 이하여야 합니다"),
  category: placeCategorySchema.optional(),
  x: z.number().optional(), // 경도 (검색 중심점)
  y: z.number().optional(), // 위도 (검색 중심점)
  radius: z.number().min(1).max(20000).optional(), // 검색 반경 (미터)
  page: z.number().int().min(1).max(45).default(1),
  size: z.number().int().min(1).max(15).default(15),
});

/**
 * 주변 장소 검색 스키마
 */
export const nearbyPlacesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  category: placeCategorySchema.optional(),
  radius: z.number().min(100).max(2000).default(500), // 기본 500m
  page: z.number().int().min(1).max(45).default(1),
  size: z.number().int().min(1).max(15).default(15),
});

/**
 * 장소 스키마 타입 추론
 */
export type PlaceInput = z.infer<typeof placeSchema>;
export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;
export type UpdatePlaceInput = z.infer<typeof updatePlaceSchema>;
export type ReorderPlacesInput = z.infer<typeof reorderPlacesSchema>;
export type SearchPlacesInput = z.infer<typeof searchPlacesSchema>;
export type NearbyPlacesInput = z.infer<typeof nearbyPlacesSchema>;
