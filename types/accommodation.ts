// ============================================
// Accommodation Types (숙소 관련 타입)
// ============================================

import type { TripLocation } from "./trip";

/**
 * 숙소 정보 (연속 일정 지원)
 */
export interface DailyAccommodation {
  /** 숙박 시작일 (YYYY-MM-DD) - 체크인 날짜 */
  startDate: string;
  /** 숙박 종료일 (YYYY-MM-DD) - 체크아웃 날짜 */
  endDate: string;
  /** 숙소 위치 정보 */
  location: TripLocation;
  /** 체크인 시간 (HH:mm) */
  checkInTime?: string;
  /** 체크아웃 시간 (HH:mm) */
  checkOutTime?: string;
}
