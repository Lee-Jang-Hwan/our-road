// ============================================
// Schedule Types (일정 관련 타입)
// ============================================

import type { RouteSegment } from "./route";

/**
 * 고정 일정
 */
export interface FixedSchedule {
  /** UUID */
  id: string;
  /** 연결된 장소 ID */
  placeId: string;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 시작 시간 (HH:mm) */
  startTime: string;
  /** 종료 시간 (HH:mm) */
  endTime: string;
  /** 메모 */
  note?: string;
}

/**
 * 고정 일정 생성 시 필요한 데이터
 */
export interface CreateFixedScheduleData {
  tripId: string;
  placeId: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string;
}

/**
 * 고정 일정 업데이트 시 필요한 데이터
 */
export interface UpdateFixedScheduleData {
  placeId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  note?: string;
}

/**
 * Supabase trip_fixed_schedules 테이블 Row 타입
 */
export interface TripFixedScheduleRow {
  id: string;
  trip_id: string;
  place_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  note: string | null;
  created_at: string;
}

/**
 * 일정 항목 (최적화 결과)
 */
export interface ScheduleItem {
  /** 방문 순서 */
  order: number;
  /** 장소 ID */
  placeId: string;
  /** 장소명 */
  placeName: string;
  /** 도착 시간 (HH:mm) */
  arrivalTime: string;
  /** 출발 시간 (HH:mm) */
  departureTime: string;
  /** 체류 시간 (분) */
  duration: number;
  /** 다음 장소까지 이동 정보 */
  transportToNext?: RouteSegment;
  /** 고정 일정 여부 */
  isFixed: boolean;
}

/**
 * 일자별 일정
 */
export interface DailyItinerary {
  /** 일차 (1, 2, 3...) */
  dayNumber: number;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 일정 항목 배열 */
  schedule: ScheduleItem[];
  /** 총 이동 거리 (미터) */
  totalDistance: number;
  /** 총 이동 시간 (분) */
  totalDuration: number;
  /** 총 체류 시간 (분) */
  totalStayDuration: number;
  /** 장소 수 */
  placeCount: number;
  /** 일과 시작 시간 (HH:mm) */
  startTime: string;
  /** 일과 종료 시간 (HH:mm) */
  endTime: string;
}

/**
 * Supabase trip_itineraries 테이블 Row 타입
 */
export interface TripItineraryRow {
  id: string;
  trip_id: string;
  day_number: number;
  date: string;
  schedule: ScheduleItemRow[];
  total_distance: number | null;
  total_duration: number | null;
  total_stay_duration: number | null;
  place_count: number | null;
  created_at: string;
}

/**
 * JSONB에 저장되는 일정 항목 (snake_case)
 */
export interface ScheduleItemRow {
  order: number;
  place_id: string;
  place_name: string;
  arrival_time: string;
  departure_time: string;
  duration: number;
  is_fixed: boolean;
  transport_to_next?: {
    mode: string;
    distance: number;
    duration: number;
    description?: string;
    fare?: number;
  };
}

/**
 * 일정 요약 정보
 */
export interface ItinerarySummary {
  /** 총 일수 */
  totalDays: number;
  /** 총 장소 수 */
  totalPlaces: number;
  /** 총 이동 거리 (미터) */
  totalDistance: number;
  /** 총 이동 시간 (분) */
  totalDuration: number;
  /** 총 체류 시간 (분) */
  totalStayDuration: number;
  /** 예상 총 비용 (원) */
  estimatedCost?: number;
}
