// ============================================
// Optimize Zod Schema (최적화 스키마)
// ============================================

import { z } from "zod";
import { coordinateSchema } from "./coordinate";
import { dateSchema, timeSchema, uuidSchema } from "./common";
import { placeSchema } from "./place";
import { fixedScheduleSchema } from "./schedule";
import { transportModeSchema } from "./trip";

/**
 * 최적화 알고리즘 스키마
 */
export const optimizeAlgorithmSchema = z.enum([
  "nearest_neighbor",
  "genetic",
  "simulated_annealing",
]);

/**
 * 최적화 옵션 스키마
 */
export const optimizeOptionsSchema = z.object({
  /** 일일 최대 활동 시간 (분, 120~720) */
  maxDailyMinutes: z
    .number()
    .int()
    .min(120, "일일 최소 활동 시간은 2시간입니다")
    .max(720, "일일 최대 활동 시간은 12시간입니다")
    .default(480),
  /** 하루 시작 시간 (0~23) */
  startHour: z
    .number()
    .int()
    .min(0, "시작 시간은 0 이상이어야 합니다")
    .max(23, "시작 시간은 23 이하여야 합니다")
    .default(9),
  /** 하루 종료 시간 (0~23) */
  endHour: z
    .number()
    .int()
    .min(0, "종료 시간은 0 이상이어야 합니다")
    .max(23, "종료 시간은 23 이하여야 합니다")
    .default(21),
  /** 사용할 알고리즘 */
  algorithm: optimizeAlgorithmSchema.default("nearest_neighbor"),
  /** 2-opt 반복 횟수 */
  improvementIterations: z
    .number()
    .int()
    .min(10, "최소 10회 반복이 필요합니다")
    .max(1000, "최대 1000회까지 반복 가능합니다")
    .default(100),
  /** 시간 가중치 */
  timeWeight: z
    .number()
    .min(0, "시간 가중치는 0 이상이어야 합니다")
    .max(10, "시간 가중치는 10 이하여야 합니다")
    .default(1.0),
  /** 거리 가중치 */
  distanceWeight: z
    .number()
    .min(0, "거리 가중치는 0 이상이어야 합니다")
    .max(10, "거리 가중치는 10 이하여야 합니다")
    .default(0.1),
});

/**
 * 최적화 요청 스키마
 */
export const optimizeRequestSchema = z
  .object({
    tripId: uuidSchema,
    places: z
      .array(placeSchema)
      .min(2, "최소 2개 이상의 장소가 필요합니다")
      .max(30, "최대 30개까지 장소를 추가할 수 있습니다"),
    origin: coordinateSchema,
    destination: coordinateSchema,
    transportModes: z
      .array(transportModeSchema)
      .min(1, "최소 1개의 이동 수단을 선택해주세요"),
    fixedSchedules: z.array(fixedScheduleSchema),
    options: optimizeOptionsSchema.partial().default({}),
    startDate: dateSchema,
    endDate: dateSchema,
    dailyStartTime: timeSchema,
    dailyEndTime: timeSchema,
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "종료일은 시작일 이후여야 합니다",
    path: ["endDate"],
  })
  .refine((data) => data.dailyStartTime < data.dailyEndTime, {
    message: "일과 종료 시간은 시작 시간 이후여야 합니다",
    path: ["dailyEndTime"],
  });

/**
 * 간단한 최적화 요청 스키마 (tripId만으로 요청)
 */
export const simpleOptimizeRequestSchema = z.object({
  tripId: uuidSchema,
  options: optimizeOptionsSchema.partial().optional(),
});

/**
 * 거리 계산 요청 스키마
 */
export const calculateDistanceSchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  mode: transportModeSchema,
});

/**
 * 일자별 분배 요청 스키마
 */
export const distributeByDaySchema = z.object({
  tripId: uuidSchema,
  placeIds: z
    .array(uuidSchema)
    .min(1, "최소 1개 이상의 장소가 필요합니다")
    .max(30, "최대 30개까지 장소를 추가할 수 있습니다"),
  maxDailyMinutes: z.number().int().min(120).max(720).default(480),
});

/**
 * 스키마 타입 추론
 */
export type OptimizeAlgorithmInput = z.infer<typeof optimizeAlgorithmSchema>;
export type OptimizeOptionsInput = z.infer<typeof optimizeOptionsSchema>;
export type OptimizeRequestInput = z.infer<typeof optimizeRequestSchema>;
export type SimpleOptimizeRequestInput = z.infer<
  typeof simpleOptimizeRequestSchema
>;
export type CalculateDistanceInput = z.infer<typeof calculateDistanceSchema>;
export type DistributeByDayInput = z.infer<typeof distributeByDaySchema>;
