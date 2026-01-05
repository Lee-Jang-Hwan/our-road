// ============================================
// Route Server Actions - 경로 조회 통합 Export
// ============================================

/**
 * @fileoverview
 * 경로 조회 Server Actions 모듈입니다.
 *
 * ## 주요 기능
 *
 * ### 1. 자동차 경로 (get-car-route.ts)
 * - Kakao Mobility API 사용
 * - 경유지 지원 (최대 5개)
 * - 톨비, 폴리라인 정보 포함
 *
 * ### 2. 대중교통 경로 (get-transit-route.ts)
 * - ODsay API 사용
 * - 환승 정보, 요금 포함
 * - 다중 경로 제공
 *
 * ### 3. 도보 경로 (get-walking-route.ts)
 * - TMAP API 사용 (실제 도보 경로, 폴리라인 포함)
 * - TMAP 실패 시 Haversine 공식 기반 fallback
 * - 최대 10km 제한
 * - 도보 가능 여부 확인 함수 제공
 *
 * ## 중요 사항
 *
 * - **선호 수단으로만 조회**: 각 함수는 해당 이동 수단의 경로만 조회합니다.
 *   경로가 없으면 자동으로 다른 수단으로 전환하지 않고 ROUTE_NOT_FOUND 에러를 반환합니다.
 *
 * - **에러 코드**:
 *   - `ROUTE_NOT_FOUND`: 해당 수단으로 경로를 찾을 수 없음
 *   - `API_ERROR`: API 호출 실패
 *   - `INVALID_COORDINATES`: 잘못된 좌표
 *   - `AUTH_ERROR`: 인증 필요
 *   - `VALIDATION_ERROR`: 입력값 검증 실패
 *
 * ## 사용 예시
 *
 * ```typescript
 * import {
 *   getCarRoute,
 *   getTransitRoute,
 *   getWalkingRoute,
 *   isWalkable,
 * } from "@/actions/routes";
 *
 * // 자동차 경로 조회
 * const carResult = await getCarRoute({
 *   origin: { lat: 37.5665, lng: 126.9780 },
 *   destination: { lat: 37.5796, lng: 126.9770 },
 *   priority: "TIME",
 * });
 *
 * if (carResult.success) {
 *   console.log(`소요 시간: ${carResult.data.totalDuration}분`);
 * } else if (carResult.error.code === "ROUTE_NOT_FOUND") {
 *   console.log("자동차 경로를 찾을 수 없습니다.");
 * }
 *
 * // 대중교통 경로 조회
 * const transitResult = await getTransitRoute({
 *   origin: { lat: 37.5665, lng: 126.9780 },
 *   destination: { lat: 37.5796, lng: 126.9770 },
 *   sortType: 1, // 시간순
 * });
 *
 * // 도보 가능 여부 확인
 * const walkable = await isWalkable(origin, destination, 15);
 * if (walkable.walkable) {
 *   console.log(`도보 ${walkable.duration}분 소요`);
 * }
 * ```
 */

// ============================================
// Car Route (자동차 경로)
// ============================================

export {
  getCarRoute,
  getCarDuration,
  getCarDistance,
} from "./get-car-route";

export type { GetCarRouteResult } from "./get-car-route";

// ============================================
// Transit Route (대중교통 경로)
// ============================================

export {
  getTransitRoute,
  getBestTransitRoute,
  getTransitDuration,
  getTransitFare,
} from "./get-transit-route";

export type { GetTransitRouteResult } from "./get-transit-route";

// ============================================
// Walking Route (도보 경로)
// ============================================

export {
  getWalkingRoute,
  getWalkingDuration,
  getWalkingDistance,
  isWalkable,
} from "./get-walking-route";

export type { GetWalkingRouteResult } from "./get-walking-route";
