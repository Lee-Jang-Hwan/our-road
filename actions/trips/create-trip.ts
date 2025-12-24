"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { createTripSchema, type CreateTripInput } from "@/lib/schemas";
import type { Trip, TripRow } from "@/types";

/**
 * 여행 생성 결과
 */
export interface CreateTripResult {
  success: boolean;
  data?: Trip;
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
 * 여행 생성 Server Action
 *
 * @param input - 여행 생성 데이터
 * @returns 생성된 여행 정보 또는 에러
 *
 * @example
 * ```tsx
 * const result = await createTrip({
 *   title: "서울 여행",
 *   startDate: "2025-01-15",
 *   endDate: "2025-01-17",
 *   origin: { name: "서울역", address: "...", lat: 37.5, lng: 127.0 },
 *   destination: { name: "서울역", address: "...", lat: 37.5, lng: 127.0 },
 *   transportModes: ["public"],
 * });
 * ```
 */
export async function createTrip(
  input: CreateTripInput
): Promise<CreateTripResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. Zod 스키마 검증
    const validationResult = createTripSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    const validatedData = validationResult.data;

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 여행 생성
    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id: userId,
        title: validatedData.title,
        start_date: validatedData.startDate,
        end_date: validatedData.endDate,
        origin: validatedData.origin,
        destination: validatedData.destination,
        daily_start_time: validatedData.dailyStartTime,
        daily_end_time: validatedData.dailyEndTime,
        transport_mode: validatedData.transportModes,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      console.error("여행 생성 오류:", error);
      return {
        success: false,
        error: "여행 생성에 실패했습니다. 다시 시도해주세요.",
      };
    }

    // 5. 캐시 무효화
    revalidatePath("/my");
    revalidatePath("/plan");

    return {
      success: true,
      data: convertRowToTrip(data as TripRow),
    };
  } catch (error) {
    console.error("여행 생성 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}
