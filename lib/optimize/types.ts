// ============================================
// Optimize Engine Internal Types (최적화 엔진 내부 타입)
// ============================================

import type { Coordinate } from "@/types/place";
import type { TransportMode } from "@/types/route";

/**
 * 최적화 노드 (내부 계산용)
 * - 장소 정보를 최적화 알고리즘에서 사용하기 좋은 형태로 변환
 */
export interface OptimizeNode {
  /** 장소 ID */
  id: string;
  /** 장소명 */
  name: string;
  /** 좌표 */
  coordinate: Coordinate;
  /** 예상 체류 시간 (분) */
  duration: number;
  /** 우선순위 (낮을수록 높음) */
  priority: number;
  /** 고정 일정 여부 */
  isFixed: boolean;
  /** 고정 일정인 경우 날짜 (YYYY-MM-DD) */
  fixedDate?: string;
  /** 고정 일정인 경우 시작 시간 (HH:mm) */
  fixedStartTime?: string;
  /** 고정 일정인 경우 종료 시간 (HH:mm) */
  fixedEndTime?: string;
}

/**
 * 거리 행렬 엔트리
 */
export interface DistanceEntry {
  /** 거리 (미터) */
  distance: number;
  /** 소요 시간 (분) */
  duration: number;
  /** 이동 수단 */
  mode: TransportMode;
}

/**
 * 거리 행렬 조회 함수 타입
 */
export type DistanceMatrixGetter = (
  fromId: string,
  toId: string
) => DistanceEntry | null;

/**
 * 경로 비용 정보
 */
export interface RouteCost {
  /** 총 거리 (미터) */
  totalDistance: number;
  /** 총 시간 (분) */
  totalDuration: number;
  /** 가중치 적용된 비용 */
  weightedCost: number;
}

/**
 * 시간 윈도우 (고정 일정용)
 */
export interface TimeWindow {
  /** 시작 시간 (분, 00:00 기준) */
  start: number;
  /** 종료 시간 (분, 00:00 기준) */
  end: number;
}

/**
 * 일자별 시간 설정
 */
export interface DailyTimeConfig {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 일일 시작 시간 (분, 00:00 기준) */
  startMinute: number;
  /** 일일 종료 시간 (분, 00:00 기준) */
  endMinute: number;
  /** 일일 최대 활동 시간 (분) */
  maxMinutes: number;
}

/**
 * 일자별 장소 할당 결과
 */
export interface DayAssignment {
  /** 일차 (1부터 시작) */
  dayNumber: number;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 할당된 장소 ID 순서 */
  placeIds: string[];
  /** 사용된 시간 (분) */
  usedMinutes: number;
  /** 남은 시간 (분) */
  remainingMinutes: number;
}

/**
 * 2-opt 스왑 결과
 */
export interface TwoOptSwap {
  /** 스왑 위치 i */
  i: number;
  /** 스왑 위치 j */
  j: number;
  /** 비용 개선량 */
  improvement: number;
}

/**
 * 최적화 설정 (내부용)
 */
export interface OptimizeConfig {
  /** 시간 가중치 */
  timeWeight: number;
  /** 거리 가중치 */
  distanceWeight: number;
  /** 2-opt 최대 반복 횟수 */
  maxIterations: number;
  /** 개선 없을 때 조기 종료 횟수 */
  noImprovementLimit: number;
}

/**
 * 기본 최적화 설정
 */
export const DEFAULT_OPTIMIZE_CONFIG: OptimizeConfig = {
  timeWeight: 1.0,
  distanceWeight: 0.1,
  maxIterations: 100,
  noImprovementLimit: 20,
};

// ============================================
// Utility Functions
// ============================================

/**
 * HH:mm 형식의 시간을 분으로 변환
 * @param time - HH:mm 형식 시간
 * @returns 분 (00:00 기준)
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분을 HH:mm 형식으로 변환
 * @param minutes - 분 (00:00 기준)
 * @returns HH:mm 형식 시간
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * 두 시간 문자열 사이의 분 차이 계산
 * @param start - 시작 시간 (HH:mm)
 * @param end - 종료 시간 (HH:mm)
 * @returns 분 차이
 */
export function getMinutesBetween(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

/**
 * 시간에 분을 더한 결과 반환
 * @param time - 시작 시간 (HH:mm)
 * @param minutes - 더할 분
 * @returns 결과 시간 (HH:mm)
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const totalMinutes = timeToMinutes(time) + minutes;
  return minutesToTime(totalMinutes);
}

/**
 * 날짜 문자열에서 일수 차이 계산
 * @param startDate - 시작 날짜 (YYYY-MM-DD)
 * @param endDate - 종료 날짜 (YYYY-MM-DD)
 * @returns 일수 (endDate - startDate + 1)
 */
export function getDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * 날짜 배열 생성
 * @param startDate - 시작 날짜 (YYYY-MM-DD)
 * @param days - 일수
 * @returns 날짜 배열
 */
export function generateDateRange(startDate: string, days: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split("T")[0]);
  }

  return dates;
}
