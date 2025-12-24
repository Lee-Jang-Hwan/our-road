// ============================================
// Optimize Server Actions - 최적화 실행 통합 Export
// ============================================

/**
 * @fileoverview
 * 경로 최적화 관련 Server Actions 모듈입니다.
 *
 * ## 주요 기능
 *
 * ### 1. 경로 최적화 (optimize-route.ts)
 * - 거리 행렬 계산
 * - Nearest Neighbor 초기 경로 생성
 * - 2-opt 개선
 * - 고정 일정 반영
 * - 일자별 분배
 * - 구간 이동 정보 조회
 *
 * ### 2. 결과 저장 (save-itinerary.ts)
 * - 최적화 결과 DB 저장
 * - 기존 일정 삭제 후 새 일정 저장
 * - 일정 존재 여부 확인
 *
 * ### 3. 거리 계산 (calculate-distance.ts)
 * - 두 좌표 간 거리/시간 계산
 * - 여행 전체 거리 행렬 계산
 * - Haversine 기반 빠른 계산
 *
 * ### 4. 일자별 분배 (distribute-days.ts)
 * - 장소 목록 일자별 분배
 * - 시간 제약 고려
 * - 분배 미리보기
 *
 * ## 사용 예시
 *
 * ```typescript
 * import {
 *   optimizeRoute,
 *   saveItinerary,
 *   calculateDistanceMatrix,
 *   distributeDays,
 * } from "@/actions/optimize";
 *
 * // 1. 경로 최적화 실행
 * const result = await optimizeRoute({ tripId: "..." });
 *
 * if (result.success) {
 *   // 2. 결과 저장
 *   await saveItinerary({
 *     tripId: "...",
 *     itinerary: result.data.itinerary,
 *   });
 * }
 *
 * // 3. 거리 행렬만 계산
 * const matrix = await calculateDistanceMatrix({
 *   tripId: "...",
 *   mode: "car",
 *   useApi: true,
 * });
 *
 * // 4. 일자별 분배만 실행
 * const distribution = await distributeDays({
 *   tripId: "...",
 *   placeIds: ["place1", "place2"],
 *   maxDailyMinutes: 480,
 * });
 * ```
 */

// ============================================
// Optimize Route (경로 최적화)
// ============================================

export { optimizeRoute } from "./optimize-route";

export type { OptimizeRouteResult } from "./optimize-route";

// ============================================
// Save Itinerary (일정 저장)
// ============================================

export {
  saveItinerary,
  deleteItinerary,
  hasItinerary,
} from "./save-itinerary";

export type {
  SaveItineraryInput,
  SaveItineraryResult,
  DeleteItineraryResult,
} from "./save-itinerary";

// ============================================
// Calculate Distance (거리 계산)
// ============================================

export {
  calculateDistance,
  calculateDistanceMatrix,
  calculateQuickDistanceMatrix,
  getPlaceDistance,
} from "./calculate-distance";

export type {
  CalculateSingleDistanceInput,
  CalculateSingleDistanceResult,
  CalculateDistanceMatrixInput,
  CalculateDistanceMatrixResult,
  GetDistanceInput,
  GetDistanceResult,
} from "./calculate-distance";

// ============================================
// Distribute Days (일자별 분배)
// ============================================

export {
  distributeDays,
  distributeAllPlaces,
  previewDistribution,
  adjustDayDistribution,
} from "./distribute-days";

export type {
  DistributeDaysResult,
  ExtendedDistributeInput,
} from "./distribute-days";
