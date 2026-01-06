// ============================================
// Optimize Engine (최적화 엔진 통합 모듈)
// ============================================

/**
 * @fileoverview
 * 여행 경로 최적화를 위한 핵심 알고리즘 모듈입니다.
 *
 * ## 주요 구성 요소
 *
 * ### 1. 타입 정의 (types.ts)
 * - 최적화에 사용되는 내부 타입 정의
 * - 시간 변환 유틸리티 함수
 *
 * ### 2. 거리 행렬 (distance-matrix.ts)
 * - Haversine 기반 직선거리 계산 (빠름)
 * - API 기반 실제 거리 계산 (정확)
 *
 * ### 3. Nearest Neighbor (nearest-neighbor.ts)
 * - 탐욕적 알고리즘으로 초기 경로 생성
 * - O(n²) 시간 복잡도
 *
 * ### 4. 2-opt (two-opt.ts)
 * - 초기 경로를 반복적으로 개선
 * - 최대 100회 반복
 * - 5~10% 개선 목표
 *
 * ### 5. 일자별 분배 (daily-distributor.ts)
 * - 시간 제약에 맞게 경로를 일자별로 분배
 * - trip의 dailyStartTime~dailyEndTime 전체 시간 사용
 *
 * ### 6. 제약 처리 (constraint-handler.ts)
 * - 고정 일정 충돌 감지
 * - 시간 윈도우 제약 처리
 *
 * ## 사용 예시
 *
 * ```typescript
 * import {
 *   createDistanceMatrix,
 *   nearestNeighbor,
 *   twoOptWithEndpoints,
 *   distributeToDaily,
 *   validateFixedSchedules,
 * } from "@/lib/optimize";
 *
 * // 1. 고정 일정 검증
 * const validation = validateFixedSchedules(fixedSchedules, {
 *   startDate: "2024-01-15",
 *   endDate: "2024-01-17",
 *   dailyStartTime: "10:00",
 *   dailyEndTime: "22:00",
 * });
 *
 * if (!validation.isValid) {
 *   console.error("고정 일정 충돌:", validation.conflicts);
 *   return;
 * }
 *
 * // 2. 거리 행렬 생성
 * const matrix = await createDistanceMatrix(nodes, {
 *   mode: "car",
 *   useApi: true, // 실제 경로 정보 사용
 * });
 *
 * // 3. 초기 경로 생성 (Nearest Neighbor)
 * const initial = nearestNeighborWithEndpoints(
 *   nodes,
 *   matrix,
 *   { timeWeight: 1.0, distanceWeight: 0.1 },
 *   "origin-id",
 *   "destination-id"
 * );
 *
 * // 4. 2-opt로 경로 개선
 * const improved = twoOptWithEndpoints(
 *   initial.route,
 *   matrix,
 *   { timeWeight: 1.0, distanceWeight: 0.1 },
 *   { maxIterations: 100 }
 * );
 *
 * console.log(`개선율: ${improved.improvementPercentage}%`);
 *
 * // 5. 일자별 분배
 * const distribution = distributeToDaily(
 *   improved.route,
 *   nodeMap,
 *   matrix,
 *   {
 *     startDate: "2024-01-15",
 *     endDate: "2024-01-17",
 *     dailyStartTime: "10:00",
 *     dailyEndTime: "22:00",
 *     fixedSchedules,
 *   }
 * );
 *
 * console.log("일자별 분배:", distribution.days);
 * ```
 */

// ============================================
// Type Exports
// ============================================

export type {
  OptimizeNode,
  DistanceEntry,
  DistanceMatrixGetter,
  RouteCost,
  TimeWindow,
  DailyTimeConfig,
  DayAssignment,
  TwoOptSwap,
  OptimizeConfig,
} from "./types";

export {
  DEFAULT_OPTIMIZE_CONFIG,
  timeToMinutes,
  minutesToTime,
  getMinutesBetween,
  addMinutesToTime,
  getDaysBetween,
  generateDateRange,
} from "./types";

// ============================================
// Distance Matrix Exports
// ============================================

export type {
  DistanceMatrixOptions,
} from "./distance-matrix";

export {
  createHaversineDistanceMatrix,
  createApiDistanceMatrix,
  createDistanceMatrix,
  getDistanceEntry,
  createDistanceMatrixGetter,
  calculateRouteCost,
  createNodesWithOriginDestination,
} from "./distance-matrix";

// ============================================
// Nearest Neighbor Exports
// ============================================

export type {
  NearestNeighborResult,
} from "./nearest-neighbor";

export {
  nearestNeighbor,
  nearestNeighborWithEndpoints,
  calculateRouteMetrics,
} from "./nearest-neighbor";

// ============================================
// 2-opt Exports
// ============================================

export type {
  TwoOptOptions,
} from "./two-opt";

export {
  twoOpt,
  twoOptWithEndpoints,
  iteratedTwoOpt,
  estimateImprovementPotential,
} from "./two-opt";

// ============================================
// Daily Distributor Exports
// ============================================

export type {
  DailyDistributorOptions,
} from "./daily-distributor";

export {
  distributeToDaily,
  toDayAssignments,
  validateDistribution,
  getDistributionStats,
} from "./daily-distributor";

// ============================================
// Constraint Handler Exports
// ============================================

export type {
  ConstraintValidationResult,
  ConstraintOptions,
} from "./constraint-handler";

export {
  detectScheduleConflicts,
  detectOutOfHoursConflicts,
  detectDailyLimitConflicts,
  validateFixedSchedules,
  calculateDailyConstraints,
  canPlaceAt,
  findAvailableSlot,
  fixedScheduleToNode,
  getTotalFixedMinutes,
  getAvailableMinutes,
} from "./constraint-handler";
