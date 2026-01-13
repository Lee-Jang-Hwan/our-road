// ============================================
// Optimize Types (최적화 엔진 관련 타입)
// ============================================

import type { Coordinate, Place } from "./place";
import type { TransportMode, TransitDetails } from "./route";
import type { DailyItinerary, FixedSchedule } from "./schedule";

/**
 * 최적화 알고리즘 종류
 */
export type OptimizeAlgorithm =
  | "nearest_neighbor"
  | "genetic"
  | "simulated_annealing";

/**
 * 최적화 옵션
 */
export interface OptimizeOptions {
  /** 일일 최대 활동 시간 (분, 미지정 시 trip의 dailyStartTime~dailyEndTime 전체 사용) */
  maxDailyMinutes: number;
  /** 하루 시작 시간 (시, 기본: 9) */
  startHour: number;
  /** 하루 종료 시간 (시, 기본: 21) */
  endHour: number;
  /** 사용할 알고리즘 */
  algorithm: OptimizeAlgorithm;
  /** 2-opt 반복 횟수 (기본: 100) */
  improvementIterations: number;
  /** 시간 가중치 (기본: 1.0) */
  timeWeight: number;
  /** 거리 가중치 (기본: 0.1) */
  distanceWeight: number;
}

/**
 * 최적화 옵션 기본값
 *
 * 참고: 일자별 시간 제약은 다음과 같이 적용됩니다:
 * - 1일차: 여행 시작 시간(dailyStartTime) ~ 20:00
 * - 중간 일차: 10:00 ~ 20:00
 * - 마지막 일차: 10:00 ~ 여행 종료 시간(dailyEndTime)
 * - 1일 여행: 여행 시작 시간 ~ 여행 종료 시간
 *
 * 아래 기본값은 일자별 시간 제약이 적용되지 않을 때 사용됩니다.
 */
export const DEFAULT_OPTIMIZE_OPTIONS: OptimizeOptions = {
  maxDailyMinutes: 600, // 10시간 (중간 일차 기준: 10:00~20:00)
  startHour: 10,
  endHour: 20,
  algorithm: "nearest_neighbor",
  improvementIterations: 100,
  timeWeight: 1.0,
  distanceWeight: 0.1,
};

/**
 * 최적화 요청
 */
export interface OptimizeRequest {
  /** 여행 ID */
  tripId: string;
  /** 방문 장소 목록 */
  places: Place[];
  /** 출발지 좌표 */
  origin: Coordinate;
  /** 도착지 좌표 */
  destination: Coordinate;
  /** 선택한 이동 수단 */
  transportModes: TransportMode[];
  /** 고정 일정 */
  fixedSchedules: FixedSchedule[];
  /** 최적화 옵션 */
  options: Partial<OptimizeOptions>;
  /** 여행 시작일 */
  startDate: string;
  /** 여행 종료일 */
  endDate: string;
  /** 일일 시작 시간 (HH:mm) */
  dailyStartTime: string;
  /** 일일 종료 시간 (HH:mm) */
  dailyEndTime: string;
}

/**
 * 최적화 에러 코드
 */
export type OptimizeErrorCode =
  | "INVALID_COORDINATES"
  | "API_RATE_LIMIT"
  | "ROUTE_NOT_FOUND"
  | "FIXED_SCHEDULE_CONFLICT"
  | "TIMEOUT"
  | "INSUFFICIENT_PLACES"
  | "EXCEEDS_DAILY_LIMIT"
  | "TRANSIT_DETAILS_ERROR"
  | "UNKNOWN";

/**
 * 최적화 오류
 */
export interface OptimizeError {
  /** 에러 코드 */
  code: OptimizeErrorCode;
  /** 에러 메시지 */
  message: string;
  /** 관련 장소 ID */
  placeId?: string;
  /** 추가 상세 정보 */
  details?: Record<string, unknown>;
}

/**
 * 최적화 통계
 */
export interface OptimizeStatistics {
  /** 총 장소 수 */
  totalPlaces: number;
  /** 총 일수 */
  totalDays: number;
  /** 총 이동 거리 (km) */
  totalDistance: number;
  /** 총 이동 시간 (분) */
  totalDuration: number;
  /** 총 체류 시간 (분) */
  totalStayDuration: number;
  /** 일평균 이동 거리 (km) */
  averageDailyDistance: number;
  /** 일평균 방문 장소 수 */
  averageDailyPlaces: number;
  /** 최적화 소요 시간 (ms) */
  optimizationTimeMs: number;
  /** 초기 대비 개선율 (%) */
  improvementPercentage: number;
}

/**
 * 최적화 결과
 */
export interface OptimizeResult {
  /** 성공 여부 */
  success: boolean;
  /** 여행 ID */
  tripId: string;
  /** 최적화된 일정 */
  itinerary: DailyItinerary[];
  /** 통계 정보 */
  statistics: OptimizeStatistics;
  /** 오류 목록 (경고 포함) */
  errors?: OptimizeError[];
  /** 최적화 완료 시간 */
  completedAt: string;
}

/**
 * 거리 행렬
 */
export interface DistanceMatrix {
  /** 장소 ID 배열 (행/열 인덱스 매핑) */
  places: string[];
  /** 거리 (미터) - distances[i][j]는 places[i]에서 places[j]까지의 거리 */
  distances: number[][];
  /** 시간 (분) - durations[i][j]는 places[i]에서 places[j]까지의 소요 시간 */
  durations: number[][];
  /** 각 구간 이동 수단 */
  modes: TransportMode[][];
  /** 각 구간 경로 폴리라인 (인코딩된 문자열) */
  polylines?: (string | null)[][];
  /** 대중교통 상세 정보 (public 모드일 때) */
  transitDetails?: (TransitDetails | null)[][];
  /** 통행료 (원) - car 모드일 때 */
  fares?: (number | null)[][];
  /** 택시 요금 (원) - car 모드일 때 */
  taxiFares?: (number | null)[][];
  /** 주요 IC/톨게이트 안내 정보 - car 모드일 때 */
  guidesMatrix?: (import("@/types/route").RouteGuide[] | null)[][];
  /** 자동차 경로 구간별 정보 - car 모드일 때 */
  carSegmentsMatrix?: (import("@/types/route").CarRouteSegment[] | null)[][];
}

/**
 * 최적화 진행 상태 (실시간 업데이트용)
 */
export interface OptimizeProgress {
  /** 현재 단계 */
  stage:
    | "calculating_matrix"
    | "initial_route"
    | "improving"
    | "distributing"
    | "fetching_routes"
    | "completed";
  /** 진행률 (0-100) */
  percentage: number;
  /** 현재 단계 설명 */
  message: string;
  /** 예상 남은 시간 (초) */
  estimatedTimeRemaining?: number;
}

/**
 * 2-opt 개선 결과
 */
export interface TwoOptResult {
  /** 개선된 경로 (장소 ID 순서) */
  route: string[];
  /** 초기 비용 */
  initialCost: number;
  /** 최종 비용 */
  finalCost: number;
  /** 개선율 (%) */
  improvementPercentage: number;
  /** 반복 횟수 */
  iterations: number;
}

/**
 * 누락된 장소 이유 코드
 */
export type UnassignedReasonCode =
  | "TIME_EXCEEDED"      // 일일 활동 시간 초과
  | "DISTANCE_TOO_FAR"   // 다른 장소들과 거리가 너무 멂
  | "FIXED_CONFLICT"     // 고정 일정과 충돌
  | "NO_ROUTE"           // 경로를 찾을 수 없음
  | "LOW_PRIORITY"       // 우선순위가 낮아 제외됨
  | "UNKNOWN";           // 알 수 없음

/**
 * 누락된 장소 상세 정보
 */
export interface UnassignedPlaceInfo {
  /** 장소 ID */
  placeId: string;
  /** 장소 이름 */
  placeName: string;
  /** 누락 이유 코드 */
  reasonCode: UnassignedReasonCode;
  /** 누락 이유 상세 메시지 */
  reasonMessage: string;
  /** 추가 정보 (예: 예상 소요 시간, 거리 등) */
  details?: {
    estimatedDuration?: number;  // 예상 체류 시간 (분)
    estimatedTravelTime?: number; // 예상 이동 시간 (분)
    availableTime?: number;       // 남은 가용 시간 (분)
  };
}

/**
 * 일자별 분배 결과
 */
export interface DayDistributionResult {
  /** 일자별 장소 ID 배열 */
  days: string[][];
  /** 일자별 총 시간 (분) */
  dailyDurations: number[];
  /** 분배되지 못한 장소 ID */
  unassignedPlaces: string[];
  /** 분배되지 못한 장소 상세 정보 */
  unassignedPlaceDetails?: UnassignedPlaceInfo[];
}

/**
 * 고정 일정 충돌 정보
 */
export interface ScheduleConflict {
  /** 충돌 유형 */
  type: "overlap" | "exceeds_daily_limit" | "outside_hours";
  /** 관련 고정 일정 ID */
  scheduleIds: string[];
  /** 날짜 */
  date: string;
  /** 충돌 설명 */
  message: string;
}

/**
 * 비용 함수 입력
 */
export interface CostFunctionInput {
  /** 이동 시간 (분) */
  travelTime: number;
  /** 이동 거리 (미터) */
  travelDistance: number;
  /** 시간 가중치 */
  timeWeight: number;
  /** 거리 가중치 */
  distanceWeight: number;
}

/**
 * 비용 계산 함수
 * cost = timeWeight * travelTime + distanceWeight * (travelDistance / 1000)
 */
export function calculateCost(input: CostFunctionInput): number {
  const { travelTime, travelDistance, timeWeight, distanceWeight } = input;
  return timeWeight * travelTime + distanceWeight * (travelDistance / 1000);
}
