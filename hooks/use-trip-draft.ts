"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { CreateTripInput } from "@/lib/schemas";
import type { Place } from "@/types/place";
import type { FixedSchedule } from "@/types/schedule";

/**
 * 여행 임시 저장 데이터 타입
 */
export interface TripDraft {
  /** 여행 기본 정보 */
  tripInfo: CreateTripInput;
  /** 추가된 장소 목록 */
  places: Place[];
  /** 고정 일정 목록 */
  fixedSchedules: FixedSchedule[];
  /** 임시 ID */
  tempId: string;
  /** 생성 시간 */
  createdAt: string;
}

const STORAGE_KEY = "trip-draft";

/**
 * 여행 임시 저장 데이터를 관리하는 훅
 * sessionStorage를 사용하여 페이지 간 데이터 유지
 */
export function useTripDraft() {
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // ref로 최신 draft 값 유지 (useCallback 의존성 문제 해결)
  const draftRef = useRef<TripDraft | null>(null);
  draftRef.current = draft;

  // 초기 로드
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TripDraft;
        setDraft(parsed);
      }
    } catch (error) {
      console.error("여행 임시 데이터 로드 실패:", error);
    }
    setIsLoaded(true);
  }, []);

  // 여행 기본 정보 저장
  const saveTripInfo = useCallback((tripInfo: CreateTripInput, tempId: string) => {
    const newDraft: TripDraft = {
      tripInfo,
      places: draftRef.current?.places || [],
      fixedSchedules: draftRef.current?.fixedSchedules || [],
      tempId,
      createdAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newDraft));
      setDraft(newDraft);
    } catch (error) {
      console.error("여행 임시 데이터 저장 실패:", error);
    }

    return newDraft;
  }, []);

  // 장소 목록 저장
  const savePlaces = useCallback((places: Place[]) => {
    const currentDraft = draftRef.current;
    if (!currentDraft) return;

    const newDraft: TripDraft = {
      ...currentDraft,
      places,
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newDraft));
      setDraft(newDraft);
    } catch (error) {
      console.error("장소 목록 저장 실패:", error);
    }
  }, []);

  // 고정 일정 목록 저장
  const saveFixedSchedules = useCallback((fixedSchedules: FixedSchedule[]) => {
    const currentDraft = draftRef.current;
    if (!currentDraft) return;

    const newDraft: TripDraft = {
      ...currentDraft,
      fixedSchedules,
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newDraft));
      setDraft(newDraft);
    } catch (error) {
      console.error("고정 일정 저장 실패:", error);
    }
  }, []);

  // 특정 tripId에 해당하는 draft 가져오기
  const getDraftByTripId = useCallback((tripId: string): TripDraft | null => {
    const currentDraft = draftRef.current;
    if (currentDraft?.tempId === tripId) {
      return currentDraft;
    }
    return null;
  }, []);

  // 임시 데이터 삭제
  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      setDraft(null);
    } catch (error) {
      console.error("여행 임시 데이터 삭제 실패:", error);
    }
  }, []);

  return {
    draft,
    isLoaded,
    saveTripInfo,
    savePlaces,
    saveFixedSchedules,
    getDraftByTripId,
    clearDraft,
  };
}

/**
 * 특정 tripId의 draft를 가져오는 헬퍼 함수 (서버 사이드에서는 사용 불가)
 */
export function getTripDraftFromStorage(tripId: string): TripDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as TripDraft;
      if (parsed.tempId === tripId) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("여행 임시 데이터 로드 실패:", error);
  }

  return null;
}
