// ============================================
// Common Zod Schemas (공통 스키마)
// ============================================

import { z } from "zod";

/**
 * 시간 검증 스키마 (HH:mm 형식)
 */
export const timeSchema = z
  .string()
  .regex(
    /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    "올바른 시간 형식이 아닙니다 (HH:mm)"
  );

/**
 * 날짜 검증 스키마 (YYYY-MM-DD 형식)
 */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)");

/**
 * 체류 시간 검증 스키마 (30분 ~ 12시간, 30분 단위)
 */
export const durationSchema = z
  .number()
  .int("정수만 입력 가능합니다")
  .min(30, "최소 30분 이상이어야 합니다")
  .max(720, "최대 12시간(720분)까지 가능합니다")
  .refine((val) => val % 30 === 0, {
    message: "30분 단위로 선택해주세요",
  });

/**
 * 우선순위 검증 스키마 (1~100)
 */
export const prioritySchema = z
  .number()
  .int("정수만 입력 가능합니다")
  .min(1, "최소 1 이상이어야 합니다")
  .max(100, "최대 100까지 가능합니다");

/**
 * UUID 검증 스키마
 */
export const uuidSchema = z.string().uuid("올바른 UUID 형식이 아닙니다");

/**
 * 페이지네이션 검증 스키마
 */
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

/**
 * 체류 시간 옵션 생성 (30분 단위)
 * 사용 예: 드롭다운 옵션 생성
 */
export function generateDurationOptions(): Array<{
  value: number;
  label: string;
}> {
  const options: Array<{ value: number; label: string }> = [];

  for (let minutes = 30; minutes <= 720; minutes += 30) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    let label: string;
    if (hours > 0 && mins > 0) {
      label = `${hours}시간 ${mins}분`;
    } else if (hours > 0) {
      label = `${hours}시간`;
    } else {
      label = `${mins}분`;
    }

    options.push({ value: minutes, label });
  }

  return options;
}

/**
 * 시간 옵션 생성 (30분 단위)
 * 사용 예: 시작/종료 시간 드롭다운
 */
export function generateTimeOptions(
  startHour = 0,
  endHour = 24
): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];

  for (let hour = startHour; hour < endHour; hour++) {
    for (const minute of [0, 30]) {
      const value = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      options.push({ value, label: value });
    }
  }

  return options;
}
