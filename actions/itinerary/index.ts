// ============================================
// Itinerary Server Actions - 일정 조회/수정 통합 Export
// ============================================

/**
 * @fileoverview
 * 최적화 결과 일정 조회 및 수정 관련 Server Actions 모듈입니다.
 *
 * ## 주요 기능
 *
 * ### 1. 일정 조회 (get-itinerary.ts)
 * - 전체 일정 조회 (getItinerary)
 * - 특정 일자 일정 조회 (getDayItinerary)
 * - 일정 요약 정보 조회 (getItinerarySummary)
 * - 일정 개수 조회 (getItineraryCount)
 * - 캐시된 일정 조회 (getCachedItinerary)
 *
 * ### 2. 일정 수정 (update-itinerary.ts)
 * - 일자별 일정 수정 (updateDayItinerary)
 * - 일정 항목 순서 변경 (reorderScheduleItems)
 * - 일정 항목 이동 - 다른 일자로 (moveScheduleItem)
 * - 단일 항목 수정 (updateScheduleItem)
 * - 일정 항목 삭제 (deleteScheduleItem)
 *
 * ## 캐싱 전략
 *
 * - `getCachedItinerary`: Next.js unstable_cache 사용
 *   - 캐시 키: itinerary-{tripId}
 *   - 재검증 시간: 60초
 *   - 태그: itinerary
 * - 수정/삭제 시 revalidateTag("itinerary") 호출로 캐시 무효화
 * - revalidatePath로 관련 페이지 캐시 무효화
 *
 * ## 사용 예시
 *
 * ```typescript
 * import {
 *   getItinerary,
 *   getDayItinerary,
 *   getItinerarySummary,
 *   getCachedItinerary,
 *   updateDayItinerary,
 *   reorderScheduleItems,
 *   moveScheduleItem,
 *   updateScheduleItem,
 *   deleteScheduleItem,
 * } from "@/actions/itinerary";
 *
 * // 1. 전체 일정 조회
 * const result = await getItinerary("trip-uuid");
 * if (result.success && result.data) {
 *   console.log(`총 ${result.data.length}일 일정`);
 * }
 *
 * // 2. 특정 일자 조회
 * const day1 = await getDayItinerary("trip-uuid", 1);
 *
 * // 3. 요약 정보 조회
 * const summary = await getItinerarySummary("trip-uuid");
 * if (summary.success && summary.data) {
 *   console.log(`총 ${summary.data.totalPlaces}개 장소`);
 * }
 *
 * // 4. 캐시된 조회 (성능 최적화)
 * const cached = await getCachedItinerary("trip-uuid");
 *
 * // 5. 일정 순서 변경
 * await reorderScheduleItems({
 *   tripId: "trip-uuid",
 *   dayNumber: 1,
 *   newOrder: ["place-3", "place-1", "place-2"],
 * });
 *
 * // 6. 다른 일자로 이동
 * await moveScheduleItem({
 *   tripId: "trip-uuid",
 *   fromDayNumber: 1,
 *   toDayNumber: 2,
 *   placeId: "place-uuid",
 *   toIndex: 0,
 * });
 *
 * // 7. 시간 수정
 * await updateScheduleItem("trip-uuid", 1, "place-uuid", {
 *   arrivalTime: "11:00",
 *   departureTime: "13:00",
 *   duration: 120,
 * });
 *
 * // 8. 항목 삭제
 * await deleteScheduleItem("trip-uuid", 1, "place-uuid");
 * ```
 */

// ============================================
// Get Itinerary (일정 조회)
// ============================================

export {
  getItinerary,
  getDayItinerary,
  getItinerarySummary,
  getItineraryCount,
  getCachedItinerary,
} from "./get-itinerary";

export type {
  GetItineraryResult,
  GetDayItineraryResult,
  GetItinerarySummaryResult,
  GetItineraryCountResult,
} from "./get-itinerary";

// ============================================
// Update Itinerary (일정 수정)
// ============================================

export {
  updateDayItinerary,
  reorderScheduleItems,
  moveScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
} from "./update-itinerary";

export type {
  UpdateScheduleItemInput,
  UpdateDayItineraryInput,
  ReorderScheduleInput,
  MoveScheduleItemInput,
  UpdateItineraryResult,
  ReorderScheduleResult,
  MoveScheduleItemResult,
  UpdateScheduleItemResult,
} from "./update-itinerary";
