"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import {
  tripListFilterSchema,
  type TripListFilterInput,
} from "@/lib/schemas";
import type { Trip, TripRow, TripListItem } from "@/types";

/**
 * 여행 목록 조회 결과
 */
export interface GetTripsResult {
  success: boolean;
  data?: Trip[];
  total?: number;
  error?: string;
}

/**
 * 여행 목록 항목 조회 결과 (간략 정보)
 */
export interface GetTripListResult {
  success: boolean;
  data?: TripListItem[];
  total?: number;
  error?: string;
}

/**
 * TripRow를 Trip으로 변환
 */
function convertRowToTrip(row: TripRow): Trip {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    origin: row.origin,
    destination: row.destination,
    dailyStartTime: row.daily_start_time,
    dailyEndTime: row.daily_end_time,
    transportModes: row.transport_mode,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 여행 목록 조회 Server Action
 *
 * @param filter - 필터 옵션 (상태, 날짜 범위, 페이지네이션)
 * @returns 여행 목록 또는 에러
 *
 * @example
 * ```tsx
 * // 전체 목록 조회
 * const result = await getTrips();
 *
 * // 필터링 조회
 * const result = await getTrips({
 *   status: "draft",
 *   limit: 10,
 *   offset: 0,
 * });
 * ```
 */
export async function getTrips(
  filter?: Partial<TripListFilterInput>
): Promise<GetTripsResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. 필터 검증 및 기본값 적용
    const validationResult = tripListFilterSchema.safeParse(filter ?? {});
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { status, startDate, endDate, limit, offset } = validationResult.data;

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 쿼리 구성
    let query = supabase
      .from("trips")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // 필터 적용
    if (status) {
      query = query.eq("status", status);
    }
    if (startDate) {
      query = query.gte("start_date", startDate);
    }
    if (endDate) {
      query = query.lte("end_date", endDate);
    }

    // 페이지네이션
    query = query.range(offset, offset + limit - 1);

    // 5. 쿼리 실행
    const { data, error, count } = await query;

    if (error) {
      console.error("여행 목록 조회 오류:", error);
      return {
        success: false,
        error: "여행 목록 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: (data as TripRow[]).map(convertRowToTrip),
      total: count ?? 0,
    };
  } catch (error) {
    console.error("여행 목록 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 여행 목록 간략 조회 Server Action (장소 수 포함)
 *
 * @param filter - 필터 옵션
 * @returns 여행 목록 항목 (간략 정보) 또는 에러
 */
export async function getTripList(
  filter?: Partial<TripListFilterInput>
): Promise<GetTripListResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. 필터 검증 및 기본값 적용
    const validationResult = tripListFilterSchema.safeParse(filter ?? {});
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { status, startDate, endDate, limit, offset } = validationResult.data;

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 여행 목록 조회
    let tripsQuery = supabase
      .from("trips")
      .select(
        "id, title, start_date, end_date, status, transport_mode, created_at, updated_at, trip_places(count)",
        {
          count: "exact",
        }
      )
      .order("created_at", { ascending: false });

    if (status) {
      tripsQuery = tripsQuery.eq("status", status);
    }
    if (startDate) {
      tripsQuery = tripsQuery.gte("start_date", startDate);
    }
    if (endDate) {
      tripsQuery = tripsQuery.lte("end_date", endDate);
    }

    tripsQuery = tripsQuery.range(offset, offset + limit - 1);

    const { data: trips, error: tripsError, count } = await tripsQuery;

    if (tripsError) {
      console.error("여행 목록 조회 오류:", tripsError);
      return {
        success: false,
        error: "여행 목록 조회에 실패했습니다.",
      };
    }

    if (!trips || trips.length === 0) {
      return {
        success: true,
        data: [],
        total: 0,
      };
    }

    // 5. 결과 변환
    const tripListItems: TripListItem[] = trips.map((trip: any) => ({
      id: trip.id,
      title: trip.title,
      startDate: trip.start_date,
      endDate: trip.end_date,
      status: trip.status,
      transportModes: trip.transport_mode,
      placeCount: trip.trip_places?.[0]?.count ?? 0,
      createdAt: trip.created_at,
      updatedAt: trip.updated_at,
    }));

    return {
      success: true,
      data: tripListItems,
      total: count ?? 0,
    };
  } catch (error) {
    console.error("여행 목록 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
