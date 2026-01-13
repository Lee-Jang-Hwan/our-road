// ============================================
// Trip Zod Schema (여행 계획 스키마)
// ============================================

import { z } from "zod";
import {
  dateSchema,
  timeSchema,
  uuidSchema,
  dateFormatValidator,
} from "./common";

/**
 * 여행 상태 스키마
 */
export const tripStatusSchema = z.enum([
  "draft",
  "optimizing",
  "optimized",
  "completed",
]);

/**
 * 이동 수단 스키마
 */
export const transportModeSchema = z.enum(["walking", "public", "car"]);

/**
 * 여행 위치 (출발지/도착지) 스키마
 */
export const tripLocationSchema = z.object({
  name: z
    .string()
    .min(1, "위치명은 필수입니다")
    .max(100, "위치명은 100자 이하여야 합니다"),
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
});

/**
 * 숙소 스키마 (연속 일정 지원)
 */
export const dailyAccommodationSchema = z
  .object({
    startDate: dateSchema,
    endDate: dateSchema,
    location: tripLocationSchema,
    checkInTime: timeSchema.optional(),
    checkInDurationMin: z.number().int().min(0).max(180).optional(),
    checkOutTime: timeSchema.optional(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "체크아웃 날짜는 체크인 날짜 이후여야 합니다",
    path: ["endDate"],
  });

/**
 * 여행 생성 스키마
 */
export const createTripSchema = z
  .object({
    title: z
      .string()
      .min(1, "여행 제목은 필수입니다")
      .max(50, "여행 제목은 50자 이하여야 합니다"),

    startDate: z
      .string()
      .min(1, "시작일을 선택해주세요")
      .refine(dateFormatValidator),
    endDate: z
      .string()
      .min(1, "종료일을 선택해주세요")
      .refine(dateFormatValidator),
      origin: tripLocationSchema
      .optional()
      .refine((val) => val !== undefined && val !== null, {
        message: "출발지를 입력해주세요",
      }),
    destination: tripLocationSchema
      .optional()
      .refine((val) => val !== undefined && val !== null, {
        message: "도착지를 입력해주세요",
      }),
    dailyStartTime: timeSchema.default("10:00"),
    dailyEndTime: timeSchema.default("22:00"),
    transportModes: z
      .array(transportModeSchema)
      .min(1, "최소 1개의 이동 수단을 선택해주세요"),
    accommodations: z.array(dailyAccommodationSchema).optional(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "종료일은 시작일 이후여야 합니다",
    path: ["endDate"],
  })
  .refine(
    (data) => {
      const diffDays =
        (new Date(data.endDate).getTime() -
          new Date(data.startDate).getTime()) /
        (1000 * 60 * 60 * 24);
      return diffDays <= 29; // 0일차 포함하여 최대 30일
    },
    {
      message: "여행 기간은 최대 30일입니다",
      path: ["endDate"],
    },
  )
  .refine((data) => data.dailyStartTime < data.dailyEndTime, {
    message: "일과 종료 시간은 시작 시간 이후여야 합니다",
    path: ["dailyEndTime"],
  });

/**
 * 여행 수정 스키마
 */
export const updateTripSchema = z
  .object({
    title: z
      .string()
      .min(1, "여행 제목은 필수입니다")
      .max(50, "여행 제목은 50자 이하여야 합니다")
      .optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    origin: tripLocationSchema.optional(),
    destination: tripLocationSchema.optional(),
    dailyStartTime: timeSchema.optional(),
    dailyEndTime: timeSchema.optional(),
    transportModes: z
      .array(transportModeSchema)
      .min(1, "최소 1개의 이동 수단을 선택해주세요")
      .optional(),
    accommodations: z.array(dailyAccommodationSchema).optional(),
    status: tripStatusSchema.optional(),
  })
  .refine(
    (data) => {
      // startDate와 endDate가 모두 있을 때만 검증
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    {
      message: "종료일은 시작일 이후여야 합니다",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      // startDate와 endDate가 모두 있을 때만 검증
      if (data.startDate && data.endDate) {
        const diffDays =
          (new Date(data.endDate).getTime() -
            new Date(data.startDate).getTime()) /
          (1000 * 60 * 60 * 24);
        return diffDays <= 29;
      }
      return true;
    },
    {
      message: "여행 기간은 최대 30일입니다",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      // dailyStartTime과 dailyEndTime이 모두 있을 때만 검증
      if (data.dailyStartTime && data.dailyEndTime) {
        return data.dailyStartTime < data.dailyEndTime;
      }
      return true;
    },
    {
      message: "일과 종료 시간은 시작 시간 이후여야 합니다",
      path: ["dailyEndTime"],
    },
  );

/**
 * 여행 목록 필터 스키마
 */
export const tripListFilterSchema = z.object({
  status: tripStatusSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

/**
 * 여행 ID 파라미터 스키마
 */
export const tripIdParamSchema = z.object({
  tripId: uuidSchema,
});

/**
 * 스키마 타입 추론
 */
export type TripStatusInput = z.infer<typeof tripStatusSchema>;
export type TransportModeInput = z.infer<typeof transportModeSchema>;
export type TripLocationInput = z.infer<typeof tripLocationSchema>;
export type DailyAccommodationInput = z.infer<typeof dailyAccommodationSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type TripListFilterInput = z.infer<typeof tripListFilterSchema>;
