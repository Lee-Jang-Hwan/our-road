"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import type { FixedSchedule, TripFixedScheduleRow } from "@/types";

/**
 * 고정 일정 목록 조회 결과
 */
export interface GetFixedSchedulesResult {
  success: boolean;
  data?: FixedSchedule[];
  error?: string;
}

/**
 * 단일 고정 일정 조회 결과
 */
export interface GetFixedScheduleResult {
  success: boolean;
  data?: FixedSchedule;
  error?: string;
}

/**
 * 날짜별 고정 일정 그룹
 */
export interface FixedSchedulesByDate {
  [date: string]: FixedSchedule[];
}

/**
 * 날짜별 고정 일정 조회 결과
 */
export interface GetFixedSchedulesByDateResult {
  success: boolean;
  data?: FixedSchedulesByDate;
  error?: string;
}

/**
 * TripFixedScheduleRow를 FixedSchedule로 변환
 * (endTime은 장소의 체류시간으로 계산되므로 FixedSchedule에는 포함하지 않음)
 */
function convertRowToFixedSchedule(row: TripFixedScheduleRow): FixedSchedule {
  return {
    id: row.id,
    placeId: row.place_id ?? "",
    date: row.date,
    startTime: row.start_time,
    note: row.note ?? undefined,
  };
}

/**
 * 여행별 고정 일정 목록 조회 Server Action
 *
 * @param tripId - 여행 ID
 * @returns 고정 일정 목록 또는 에러
 *
 * @example
 * ```tsx
 * const result = await getFixedSchedules(tripId);
 * if (result.success) {
 *   console.log(result.data); // FixedSchedule[]
 * }
 * ```
 */
export async function getFixedSchedules(
  tripId: string
): Promise<GetFixedSchedulesResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. UUID 형식 검증
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 여행 소유권 확인
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return {
        success: false,
        error: "여행을 찾을 수 없거나 접근 권한이 없습니다.",
      };
    }

    // 5. 고정 일정 목록 조회 (날짜순, 시간순)
    const { data, error } = await supabase
      .from("trip_fixed_schedules")
      .select("*")
      .eq("trip_id", tripId)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("고정 일정 목록 조회 오류:", error);
      return {
        success: false,
        error: "고정 일정 목록 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: (data ?? []).map((row) =>
        convertRowToFixedSchedule(row as TripFixedScheduleRow)
      ),
    };
  } catch (error) {
    console.error("고정 일정 목록 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 단일 고정 일정 조회 Server Action
 *
 * @param scheduleId - 고정 일정 ID
 * @param tripId - 여행 ID
 * @returns 고정 일정 정보 또는 에러
 */
export async function getFixedSchedule(
  scheduleId: string,
  tripId: string
): Promise<GetFixedScheduleResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. UUID 형식 검증
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(scheduleId)) {
      return {
        success: false,
        error: "올바르지 않은 고정 일정 ID입니다.",
      };
    }
    if (!uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 고정 일정 조회
    const { data, error } = await supabase
      .from("trip_fixed_schedules")
      .select("*")
      .eq("id", scheduleId)
      .eq("trip_id", tripId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return {
          success: false,
          error: "고정 일정을 찾을 수 없습니다.",
        };
      }
      console.error("고정 일정 조회 오류:", error);
      return {
        success: false,
        error: "고정 일정 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: convertRowToFixedSchedule(data as TripFixedScheduleRow),
    };
  } catch (error) {
    console.error("고정 일정 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 날짜별로 그룹화된 고정 일정 조회 Server Action
 *
 * @param tripId - 여행 ID
 * @returns 날짜별 고정 일정 그룹 또는 에러
 *
 * @example
 * ```tsx
 * const result = await getFixedSchedulesGroupedByDate(tripId);
 * if (result.success) {
 *   // { "2025-01-15": [...], "2025-01-16": [...] }
 *   console.log(result.data);
 * }
 * ```
 */
export async function getFixedSchedulesGroupedByDate(
  tripId: string
): Promise<GetFixedSchedulesByDateResult> {
  try {
    // 1. 기본 목록 조회
    const result = await getFixedSchedules(tripId);

    if (!result.success || !result.data) {
      return {
        success: result.success,
        error: result.error,
      };
    }

    // 2. 날짜별 그룹화
    const groupedData: FixedSchedulesByDate = {};

    for (const schedule of result.data) {
      if (!groupedData[schedule.date]) {
        groupedData[schedule.date] = [];
      }
      groupedData[schedule.date].push(schedule);
    }

    return {
      success: true,
      data: groupedData,
    };
  } catch (error) {
    console.error("날짜별 고정 일정 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 특정 날짜의 고정 일정 조회 Server Action
 *
 * @param tripId - 여행 ID
 * @param date - 조회할 날짜 (YYYY-MM-DD)
 * @returns 해당 날짜의 고정 일정 목록 또는 에러
 */
export async function getFixedSchedulesByDate(
  tripId: string,
  date: string
): Promise<GetFixedSchedulesResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. UUID 형식 검증
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. 날짜 형식 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return {
        success: false,
        error: "올바르지 않은 날짜 형식입니다. (YYYY-MM-DD)",
      };
    }

    // 4. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 5. 여행 소유권 확인
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return {
        success: false,
        error: "여행을 찾을 수 없거나 접근 권한이 없습니다.",
      };
    }

    // 6. 해당 날짜의 고정 일정 조회
    const { data, error } = await supabase
      .from("trip_fixed_schedules")
      .select("*")
      .eq("trip_id", tripId)
      .eq("date", date)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("날짜별 고정 일정 조회 오류:", error);
      return {
        success: false,
        error: "고정 일정 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: (data ?? []).map((row) =>
        convertRowToFixedSchedule(row as TripFixedScheduleRow)
      ),
    };
  } catch (error) {
    console.error("날짜별 고정 일정 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 고정 일정 개수 조회 Server Action
 *
 * @param tripId - 여행 ID
 * @returns 고정 일정 개수 또는 에러
 */
export async function getFixedScheduleCount(
  tripId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. UUID 형식 검증
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tripId)) {
      return {
        success: false,
        error: "올바르지 않은 여행 ID입니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 고정 일정 개수 조회
    const { count, error } = await supabase
      .from("trip_fixed_schedules")
      .select("*", { count: "exact", head: true })
      .eq("trip_id", tripId);

    if (error) {
      console.error("고정 일정 개수 조회 오류:", error);
      return {
        success: false,
        error: "고정 일정 개수 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      count: count ?? 0,
    };
  } catch (error) {
    console.error("고정 일정 개수 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
