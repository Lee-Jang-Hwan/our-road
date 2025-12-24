// ============================================
// Trip Types (여행 계획 관련 타입)
// ============================================

import type { Coordinate, Place } from "./place";
import type { TransportMode } from "./route";
import type { DailyItinerary, FixedSchedule } from "./schedule";

/**
 * 여행 계획 상태
 */
export type TripStatus = "draft" | "optimizing" | "optimized" | "completed";

/**
 * 여행 출발지/도착지 정보 (JSONB 구조)
 */
export interface TripLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * 여행 계획
 */
export interface Trip {
  /** UUID */
  id: string;
  /** Clerk User ID */
  userId: string;
  /** 여행 제목 */
  title: string;
  /** 시작일 (YYYY-MM-DD) */
  startDate: string;
  /** 종료일 (YYYY-MM-DD) */
  endDate: string;
  /** 출발지 */
  origin: TripLocation;
  /** 도착지 */
  destination: TripLocation;
  /** 하루 시작 시간 (HH:mm, 기본 10:00) */
  dailyStartTime: string;
  /** 하루 종료 시간 (HH:mm, 기본 22:00) */
  dailyEndTime: string;
  /** 선택한 이동 수단 */
  transportModes: TransportMode[];
  /** 상태 */
  status: TripStatus;
  /** 생성일시 */
  createdAt: string;
  /** 수정일시 */
  updatedAt: string;
}

/**
 * 여행 계획 상세 (관계 데이터 포함)
 */
export interface TripWithDetails extends Trip {
  /** 방문 장소 목록 */
  places: Place[];
  /** 고정 일정 */
  fixedSchedules: FixedSchedule[];
  /** 최적화된 일정 (결과) */
  itinerary?: DailyItinerary[];
}

/**
 * 여행 생성 시 필요한 데이터
 */
export interface CreateTripData {
  title: string;
  startDate: string;
  endDate: string;
  origin: TripLocation;
  destination: TripLocation;
  dailyStartTime?: string;
  dailyEndTime?: string;
  transportModes: TransportMode[];
}

/**
 * 여행 업데이트 시 필요한 데이터
 */
export interface UpdateTripData {
  title?: string;
  startDate?: string;
  endDate?: string;
  origin?: TripLocation;
  destination?: TripLocation;
  dailyStartTime?: string;
  dailyEndTime?: string;
  transportModes?: TransportMode[];
  status?: TripStatus;
}

/**
 * Supabase trips 테이블 Row 타입
 */
export interface TripRow {
  id: string;
  user_id: string;
  title: string;
  start_date: string;
  end_date: string;
  origin: TripLocation;
  destination: TripLocation;
  daily_start_time: string;
  daily_end_time: string;
  transport_mode: TransportMode[];
  status: TripStatus;
  created_at: string;
  updated_at: string;
}

/**
 * 여행 목록 조회 시 필터
 */
export interface TripListFilter {
  status?: TripStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * 여행 목록 항목 (간략 정보)
 */
export interface TripListItem {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  placeCount: number;
  createdAt: string;
}

/**
 * 여행 일수 계산 유틸리티 타입
 */
export interface TripDuration {
  /** 총 일수 */
  days: number;
  /** 총 박수 */
  nights: number;
  /** 표시용 텍스트 (예: "2박 3일") */
  displayText: string;
}

/**
 * 여행 공유 정보
 */
export interface TripShare {
  tripId: string;
  shareUrl: string;
  expiresAt?: string;
  isPublic: boolean;
}

/**
 * Trip Row를 Trip으로 변환하는 헬퍼 타입
 */
export function convertTripRowToTrip(row: TripRow): Trip {
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
 * 여행 일수 계산 함수
 */
export function calculateTripDuration(
  startDate: string,
  endDate: string
): TripDuration {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const nights = days - 1;

  return {
    days,
    nights,
    displayText: nights > 0 ? `${nights}박 ${days}일` : "당일치기",
  };
}
