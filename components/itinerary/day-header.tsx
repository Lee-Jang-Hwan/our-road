/**
 * @file day-header.tsx
 * @description 편집 모드용 일차 헤더 컴포넌트
 *
 * 편집 모드에서 각 일차의 헤더를 표시하는 컴포넌트입니다.
 * 드래그 불가하며, 일반 스크롤 요소입니다.
 * 일차 헤더 아래에 드롭 가능한 드롭 존 역할도 합니다.
 *
 * @dependencies
 * - react
 * - @/types/schedule: DailyItinerary
 */

"use client";

import { Calendar } from "lucide-react";

interface DayHeaderProps {
  dayNumber: number;
  date: string;
  placeCount: number;
}

export function DayHeader({ dayNumber, date, placeCount }: DayHeaderProps) {
  const formattedDate = (() => {
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = dayNames[d.getDay()];
    return `${month}월 ${day}일 (${dayName})`;
  })();

  return (
    <div className="z-10 flex items-center justify-between py-4 px-6 mb-2 rounded-xl bg-gradient-to-r from-background via-background to-background/95 backdrop-blur-md border border-border/50 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold text-lg">
          {dayNumber}
        </div>
        <div>
          <h3 className="font-semibold text-base text-foreground">
            {dayNumber}일차
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>
      <div className="px-3 py-1.5 rounded-lg bg-muted/50 text-sm font-medium text-muted-foreground">
        {placeCount}개 장소
      </div>
    </div>
  );
}
