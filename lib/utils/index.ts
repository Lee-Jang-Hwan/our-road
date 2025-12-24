// ============================================
// Utils Module (유틸리티 모듈)
// ============================================

/**
 * @fileoverview
 * 공통 유틸리티 함수 모듈입니다.
 *
 * ## 주요 구성 요소
 *
 * ### 1. Haversine (haversine.ts)
 * - 두 좌표 간 직선거리(Great-circle distance) 계산
 * - 거리 기반 예상 이동 시간 추정
 *
 * ### 2. Retry (retry.ts)
 * - 지수 백오프(Exponential Backoff) 재시도 로직
 * - 배치 처리 유틸리티
 *
 * ## 사용 예시
 *
 * ```typescript
 * import {
 *   haversineDistance,
 *   withRetry,
 *   batchProcess,
 * } from "@/lib/utils";
 *
 * // Haversine 거리 계산
 * const distance = haversineDistance(
 *   { lat: 37.5665, lng: 126.9780 },
 *   { lat: 37.5796, lng: 126.9770 }
 * );
 * console.log(`거리: ${distance}m`);
 *
 * // 재시도 로직
 * const data = await withRetry(
 *   () => fetch("https://api.example.com/data"),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 *
 * // 배치 처리
 * const results = await batchProcess(
 *   items,
 *   async (item) => processItem(item),
 *   5,  // 동시 5개
 *   500 // 배치 간 500ms 대기
 * );
 * ```
 */

// ============================================
// Haversine Exports
// ============================================

export {
  haversineDistance,
  haversineDistanceKm,
  estimateDuration,
  calculateDistanceAndDuration,
  calculateTotalDistance,
  createHaversineMatrix,
} from "./haversine";

// ============================================
// Retry Exports
// ============================================

export type {
  RetryOptions,
} from "./retry";

export {
  calculateBackoffDelay,
  delay,
  withRetry,
  createHttpRetryChecker,
  fetchWithRetry,
  batchProcess,
  tryOrNull,
  tryOrDefault,
} from "./retry";
