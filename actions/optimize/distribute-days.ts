"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { distributeByDaySchema, type DistributeByDayInput } from "@/lib/schemas";
import type { DayDistributionResult } from "@/types/optimize";
import type { FixedSchedule } from "@/types/schedule";
import type { TransportMode } from "@/types/route";
import type { OptimizeNode } from "@/lib/optimize/types";
import {
  createDistanceMatrix,
  distributeToDaily,
  toDayAssignments,
  validateDistribution,
  getDistributionStats,
  timeToMinutes,
} from "@/lib/optimize";
import type { DayAssignment } from "@/lib/optimize/types";

// ============================================
// Types
// ============================================

/**
 * 일자별 분배 결과 (상세)
 */
export interface DistributeDaysResult {
  success: boolean;
  data?: {
    /** 일자별 분배 결과 */
    distribution: DayDistributionResult;
    /** 일자별 상세 할당 정보 */
    dayAssignments: DayAssignment[];
    /** 분배 통계 */
    stats: {
      totalDays: number;
      totalPlaces: number;
      avgPlacesPerDay: number;
      avgDurationPerDay: number;
      maxDayPlaces: number;
      minDayPlaces: number;
      unassignedCount: number;
    };
    /** 검증 결과 */
    validation: {
      isValid: boolean;
      missingPlaces: string[];
      duplicatePlaces: string[];
      allPlacesAssigned: boolean;
    };
  };
  error?: string;
}

/**
 * 확장 분배 입력
 */
export interface ExtendedDistributeInput {
  tripId: string;
  placeIds?: string[];
  maxDailyMinutes?: number;
  mode?: TransportMode;
}

// ============================================
// Server Actions
// ============================================

/**
 * 일자별 분배 Server Action (단독 호출용)
 *
 * 주어진 장소 목록을 여행 기간에 맞게 일자별로 분배합니다.
 * 최적화 없이 순서대로 분배하며, 시간 제약을 고려합니다.
 *
 * @param input - 분배 입력
 * @returns 분배 결과
 *
 * @example
 * ```tsx
 * const result = await distributeDays({
 *   tripId: "...",
 *   placeIds: ["place1", "place2", "place3"],
 *   maxDailyMinutes: 480,
 * });
 * if (result.success) {
 *   console.log(result.data.distribution.days);
 *   // [["place1", "place2"], ["place3"]]
 * }
 * ```
 */
export async function distributeDays(
  input: DistributeByDayInput
): Promise<DistributeDaysResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. 입력 검증
    const validationResult = distributeByDaySchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { tripId, placeIds, maxDailyMinutes } = validationResult.data;

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 여행 조회
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return {
        success: false,
        error: "여행을 찾을 수 없습니다.",
      };
    }

    // 5. 장소 조회
    const { data: allPlaces, error: placesError } = await supabase
      .from("trip_places")
      .select("*")
      .eq("trip_id", tripId)
      .in("id", placeIds);

    if (placesError || !allPlaces) {
      return {
        success: false,
        error: "장소 조회에 실패했습니다.",
      };
    }

    // placeIds 순서대로 정렬
    const places = placeIds
      .map((id) => allPlaces.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (places.length === 0) {
      return {
        success: false,
        error: "유효한 장소가 없습니다.",
      };
    }

    // 6. 고정 일정 조회
    const { data: schedulesData } = await supabase
      .from("trip_fixed_schedules")
      .select("*")
      .eq("trip_id", tripId);

    const fixedSchedules: FixedSchedule[] = (schedulesData ?? []).map(
      (row) => ({
        id: row.id,
        placeId: row.place_id ?? "",
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        note: row.note ?? undefined,
      })
    );

    // 7. 노드 맵 생성
    const nodeMap = new Map<string, OptimizeNode>();

    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      const fixedSchedule = fixedSchedules.find(
        (s) => s.placeId === place.id
      );

      const node: OptimizeNode = fixedSchedule
        ? {
            id: place.id,
            name: place.name,
            coordinate: { lat: place.lat, lng: place.lng },
            duration:
              timeToMinutes(fixedSchedule.endTime) -
              timeToMinutes(fixedSchedule.startTime),
            priority: 0,
            isFixed: true,
            fixedDate: fixedSchedule.date,
            fixedStartTime: fixedSchedule.startTime,
            fixedEndTime: fixedSchedule.endTime,
          }
        : {
            id: place.id,
            name: place.name,
            coordinate: { lat: place.lat, lng: place.lng },
            duration: place.estimated_duration,
            priority: place.priority ?? i + 1,
            isFixed: false,
          };

      nodeMap.set(node.id, node);
    }

    // 8. 거리 행렬 계산 (Haversine 기반 빠른 계산)
    const nodes = Array.from(nodeMap.values());
    const transportMode: TransportMode = trip.transport_mode?.includes("car")
      ? "car"
      : "public";

    const distanceMatrix = await createDistanceMatrix(nodes, {
      mode: transportMode,
      useApi: false, // 빠른 계산을 위해 Haversine 사용
    });

    // 9. 일자별 분배 실행
    const actualMaxMinutes =
      maxDailyMinutes ??
      timeToMinutes(trip.daily_end_time) -
        timeToMinutes(trip.daily_start_time);

    const distribution = distributeToDaily(
      placeIds,
      nodeMap,
      distanceMatrix,
      {
        startDate: trip.start_date,
        endDate: trip.end_date,
        dailyStartTime: trip.daily_start_time,
        dailyEndTime: trip.daily_end_time,
        maxDailyMinutes: actualMaxMinutes,
        fixedSchedules,
      }
    );

    // 10. 결과 변환
    const dayAssignments = toDayAssignments(distribution, {
      startDate: trip.start_date,
      endDate: trip.end_date,
      dailyStartTime: trip.daily_start_time,
      dailyEndTime: trip.daily_end_time,
      maxDailyMinutes: actualMaxMinutes,
    });

    // 11. 검증
    const validation = validateDistribution(distribution, placeIds);

    // 12. 통계
    const stats = getDistributionStats(distribution);

    return {
      success: true,
      data: {
        distribution,
        dayAssignments,
        stats,
        validation,
      },
    };
  } catch (error) {
    console.error("일자별 분배 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 전체 장소 일자별 분배 Server Action
 *
 * 여행의 모든 장소를 일자별로 분배합니다.
 * placeIds를 지정하지 않으면 모든 장소를 priority 순으로 분배합니다.
 *
 * @param input - 여행 ID 및 옵션
 * @returns 분배 결과
 */
export async function distributeAllPlaces(
  input: ExtendedDistributeInput
): Promise<DistributeDaysResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    const { tripId, maxDailyMinutes } = input;

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

    // 4. 장소 목록 조회
    const { data: places, error } = await supabase
      .from("trip_places")
      .select("id")
      .eq("trip_id", tripId)
      .order("priority", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      return {
        success: false,
        error: "장소 조회에 실패했습니다.",
      };
    }

    if (!places || places.length === 0) {
      return {
        success: false,
        error: "분배할 장소가 없습니다.",
      };
    }

    // 5. 모든 장소 ID로 분배 실행
    const placeIds = places.map((p) => p.id);

    return distributeDays({
      tripId,
      placeIds,
      maxDailyMinutes: maxDailyMinutes ?? 480,
    });
  } catch (error) {
    console.error("전체 장소 분배 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 분배 미리보기 Server Action
 *
 * 실제 분배를 저장하지 않고 결과만 미리 확인합니다.
 * 프론트엔드에서 분배 결과를 미리 보여줄 때 사용합니다.
 *
 * @param input - 분배 입력
 * @returns 분배 미리보기 결과
 */
export async function previewDistribution(
  input: ExtendedDistributeInput
): Promise<DistributeDaysResult> {
  // 미리보기는 distributeAllPlaces와 동일하지만
  // 저장하지 않고 결과만 반환
  return distributeAllPlaces(input);
}

/**
 * 특정 일자의 분배 조정 Server Action
 *
 * 특정 일자에 장소를 추가하거나 제거합니다.
 *
 * @param tripId - 여행 ID
 * @param dayNumber - 일차 (1부터 시작)
 * @param placeIds - 해당 일자에 배치할 장소 ID 목록
 * @returns 조정된 분배 결과
 */
export async function adjustDayDistribution(
  tripId: string,
  dayNumber: number,
  placeIds: string[]
): Promise<{
  success: boolean;
  data?: DayAssignment;
  error?: string;
}> {
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

    // 3. 일차 검증
    if (dayNumber < 1) {
      return {
        success: false,
        error: "일차는 1 이상이어야 합니다.",
      };
    }

    // 4. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 5. 여행 조회
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return {
        success: false,
        error: "여행을 찾을 수 없습니다.",
      };
    }

    // 6. 일차가 여행 기간 내인지 확인
    const startDate = new Date(trip.start_date);
    const endDate = new Date(trip.end_date);
    const totalDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

    if (dayNumber > totalDays) {
      return {
        success: false,
        error: `일차는 ${totalDays}일 이내여야 합니다.`,
      };
    }

    // 7. 장소 조회 및 시간 계산
    const { data: places } = await supabase
      .from("trip_places")
      .select("*")
      .eq("trip_id", tripId)
      .in("id", placeIds);

    if (!places) {
      return {
        success: false,
        error: "장소 조회에 실패했습니다.",
      };
    }

    // 8. 해당 일자 계산
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayNumber - 1);
    const dateStr = date.toISOString().split("T")[0];

    // 9. 총 사용 시간 계산
    const usedMinutes = places.reduce(
      (sum, p) => sum + p.estimated_duration,
      0
    );

    const maxMinutes =
      timeToMinutes(trip.daily_end_time) -
      timeToMinutes(trip.daily_start_time);

    return {
      success: true,
      data: {
        dayNumber,
        date: dateStr,
        placeIds,
        usedMinutes,
        remainingMinutes: maxMinutes - usedMinutes,
      },
    };
  } catch (error) {
    console.error("일자 분배 조정 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
