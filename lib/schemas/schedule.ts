// ============================================
// Schedule Zod Schema (일정 스키마)
// ============================================

import { z } from "zod";
import { dateSchema, timeSchema } from "./common";

/**
 * 장소 ID 스키마 (카카오 장소 ID는 숫자 문자열)
 */
const placeIdSchema = z.string().min(1, "장소를 선택해주세요");

/**
 * 여행/일정 ID 스키마 (UUID 또는 일반 문자열)
 */
const idSchema = z.string().min(1, "ID가 필요합니다");

/**
 * 고정 일정 스키마
 * - 체류 시간은 장소에서 이미 설정되므로 시작 시간만 필요
 */
export const fixedScheduleSchema = z.object({
  id: idSchema,
  placeId: placeIdSchema,
  date: dateSchema,
  startTime: timeSchema,
  note: z.string().max(200, "메모는 200자 이하여야 합니다").optional(),
});

/**
 * 고정 일정 생성 스키마 (id 없이)
 * - 날짜와 시작 시간만 설정 (종료 시간은 장소의 체류 시간으로 자동 계산)
 */
export const createFixedScheduleSchema = z.object({
  tripId: idSchema,
  placeId: placeIdSchema,
  date: dateSchema,
  startTime: timeSchema,
  note: z.string().max(200, "메모는 200자 이하여야 합니다").optional(),
});

/**
 * 고정 일정 수정 스키마
 */
export const updateFixedScheduleSchema = z.object({
  placeId: placeIdSchema.optional(),
  date: dateSchema.optional(),
  startTime: timeSchema.optional(),
  note: z.string().max(200, "메모는 200자 이하여야 합니다").optional(),
});

/**
 * 일정 항목 스키마 (최적화 결과)
 */
export const scheduleItemSchema = z.object({
  order: z.number().int().min(1),
  placeId: placeIdSchema,
  placeName: z.string().min(1).max(100),
  arrivalTime: timeSchema,
  departureTime: timeSchema,
  duration: z.number().int().min(0),
  isFixed: z.boolean(),
  transportToNext: z
    .object({
      mode: z.enum(["walking", "public", "car"]),
      distance: z.number().min(0),
      duration: z.number().min(0),
      description: z.string().optional(),
      fare: z.number().min(0).optional(),
    })
    .optional(),
});

/**
 * 일자별 일정 스키마
 */
export const dailyItinerarySchema = z.object({
  dayNumber: z.number().int().min(1).max(30),
  date: dateSchema,
  schedule: z.array(scheduleItemSchema),
  totalDistance: z.number().min(0),
  totalDuration: z.number().min(0),
  totalStayDuration: z.number().min(0),
  placeCount: z.number().int().min(0),
  startTime: timeSchema,
  endTime: timeSchema,
});

/**
 * 스키마 타입 추론
 */
export type FixedScheduleInput = z.infer<typeof fixedScheduleSchema>;
export type CreateFixedScheduleInput = z.infer<
  typeof createFixedScheduleSchema
>;
export type UpdateFixedScheduleInput = z.infer<
  typeof updateFixedScheduleSchema
>;
export type ScheduleItemInput = z.infer<typeof scheduleItemSchema>;
export type DailyItineraryInput = z.infer<typeof dailyItinerarySchema>;
