// ============================================
// Route Schemas (경로 조회 관련 스키마)
// ============================================

import { z } from "zod";
import { coordinateSchema } from "./coordinate";
import { transportModeSchema } from "./trip";

/**
 * 경로 우선순위 스키마
 */
export const routePrioritySchema = z.enum(["time", "distance", "fare"], {
  errorMap: () => ({ message: "유효한 우선순위를 선택해주세요." }),
});

/**
 * 기본 경로 조회 스키마
 */
export const baseRouteSchema = z.object({
  /** 출발지 좌표 */
  origin: coordinateSchema,
  /** 도착지 좌표 */
  destination: coordinateSchema,
});

/**
 * 자동차 경로 조회 스키마
 */
export const carRouteSchema = baseRouteSchema.extend({
  /** 경유지 (최대 5개) */
  waypoints: z.array(coordinateSchema).max(5, "경유지는 최대 5개까지 가능합니다.").optional(),
  /** 우선순위 (RECOMMEND: 추천, TIME: 시간 우선, DISTANCE: 거리 우선) */
  priority: z.enum(["RECOMMEND", "TIME", "DISTANCE"]).optional().default("RECOMMEND"),
  /** 대안 경로 포함 여부 */
  alternatives: z.boolean().optional().default(false),
});

/**
 * 대중교통 경로 조회 스키마
 */
export const transitRouteSchema = baseRouteSchema.extend({
  /** 정렬 기준 (0: 추천, 1: 시간순, 2: 환승횟수순, 3: 도보거리순) */
  sortType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional().default(0),
  /** 검색 유형 (0: 도시내, 1: 도시간, 2: 통합) */
  searchType: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional().default(0),
  /** 경로 개수 제한 (선택) */
  limit: z.number().int().min(1).max(10).optional(),
});

/**
 * 도보 경로 조회 스키마
 */
export const walkingRouteSchema = baseRouteSchema;

/**
 * 통합 경로 조회 스키마
 */
export const routeQuerySchema = baseRouteSchema.extend({
  /** 이동 수단 */
  mode: transportModeSchema,
  /** 우선순위 (선택) */
  priority: routePrioritySchema.optional(),
  /** 출발 시간 (HH:mm, 선택) */
  departureTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "시간 형식이 올바르지 않습니다. (HH:mm)")
    .optional(),
});

// ============================================
// Public Transit Algorithm Schemas
// ============================================

export const latLngSchema = coordinateSchema;

export const waypointSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  coord: latLngSchema,
  isFixed: z.boolean(),
  dayLock: z.number().int().min(1).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  stayMinutes: z.number().int().min(0).max(24 * 60).optional(),
});

export const tripInputSchema = z.object({
  tripId: z.string().min(1).optional(),
  days: z.number().int().min(1).max(30),
  start: latLngSchema,
  end: latLngSchema.optional(),
  lodging: latLngSchema.optional(),
  dailyMaxMinutes: z.number().int().min(10).max(24 * 60).optional(),
  waypoints: z.array(waypointSchema).min(1),
});

// ============================================
// Type Exports
// ============================================

export type RoutePriorityInput = z.infer<typeof routePrioritySchema>;
export type BaseRouteInput = z.infer<typeof baseRouteSchema>;
export type CarRouteInput = z.infer<typeof carRouteSchema>;
export type TransitRouteInput = z.infer<typeof transitRouteSchema>;
export type WalkingRouteInput = z.infer<typeof walkingRouteSchema>;
export type RouteQueryInput = z.infer<typeof routeQuerySchema>;
export type LatLngInput = z.infer<typeof latLngSchema>;
export type WaypointInput = z.infer<typeof waypointSchema>;
export type TripInputInput = z.infer<typeof tripInputSchema>;
