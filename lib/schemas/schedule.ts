// ============================================
// Schedule Zod Schema (일정 스키마)
// ============================================

import { z } from "zod";
import { dateSchema, timeSchema, uuidSchema } from "./common";

/**
 * 고정 일정 스키마
 */
export const fixedScheduleSchema = z
  .object({
    id: uuidSchema,
    placeId: uuidSchema,
    date: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    note: z.string().max(200, "메모는 200자 이하여야 합니다").optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "종료 시간은 시작 시간 이후여야 합니다",
    path: ["endTime"],
  });

/**
 * 고정 일정 생성 스키마 (id 없이)
 */
export const createFixedScheduleSchema = z
  .object({
    tripId: uuidSchema,
    placeId: uuidSchema,
    date: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    note: z.string().max(200, "메모는 200자 이하여야 합니다").optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "종료 시간은 시작 시간 이후여야 합니다",
    path: ["endTime"],
  });

/**
 * 고정 일정 수정 스키마
 */
export const updateFixedScheduleSchema = z
  .object({
    placeId: uuidSchema.optional(),
    date: dateSchema.optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    note: z.string().max(200, "메모는 200자 이하여야 합니다").optional(),
  })
  .refine(
    (data) => {
      // startTime과 endTime이 모두 있을 때만 검증
      if (data.startTime && data.endTime) {
        return data.startTime < data.endTime;
      }
      return true;
    },
    {
      message: "종료 시간은 시작 시간 이후여야 합니다",
      path: ["endTime"],
    }
  );

/**
 * 일정 항목 스키마 (최적화 결과)
 */
export const scheduleItemSchema = z.object({
  order: z.number().int().min(1),
  placeId: uuidSchema,
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
