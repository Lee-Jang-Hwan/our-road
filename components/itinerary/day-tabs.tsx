"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSwipe } from "@/hooks/use-swipe";

interface DayTab {
  /** 일차 번호 */
  dayNumber: number;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
}

interface DayTabsProps {
  /** 일자 탭 목록 */
  days: DayTab[];
  /** 현재 선택된 일차 */
  selectedDay: number;
  /** 일차 선택 핸들러 */
  onSelectDay: (dayNumber: number) => void;
  /** 추가 클래스 */
  className?: string;
}

// 날짜 포맷팅 (MM/DD)
const formatTabDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
};

/**
 * 일자별 탭 네비게이션 컴포넌트
 * - "1일차\n12/24" 형식으로 표시
 * - 활성 탭 인디케이터
 * - 좌우 스와이프로 일자 전환
 */
export function DayTabs({
  days,
  selectedDay,
  onSelectDay,
  className,
}: DayTabsProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = React.useState(false);
  const [showRightArrow, setShowRightArrow] = React.useState(false);

  // 스크롤 상태 확인
  const checkScrollState = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  // 초기 스크롤 상태 및 resize 이벤트 핸들링
  React.useEffect(() => {
    checkScrollState();
    window.addEventListener("resize", checkScrollState);
    return () => window.removeEventListener("resize", checkScrollState);
  }, [checkScrollState, days]);

  // 이전/다음 일차로 이동
  const goToPreviousDay = React.useCallback(() => {
    const currentIndex = days.findIndex((d) => d.dayNumber === selectedDay);
    if (currentIndex > 0) {
      onSelectDay(days[currentIndex - 1].dayNumber);
    }
  }, [days, selectedDay, onSelectDay]);

  const goToNextDay = React.useCallback(() => {
    const currentIndex = days.findIndex((d) => d.dayNumber === selectedDay);
    if (currentIndex < days.length - 1) {
      onSelectDay(days[currentIndex + 1].dayNumber);
    }
  }, [days, selectedDay, onSelectDay]);

  // 스와이프 핸들러
  const swipeHandlers = useSwipe({
    onSwipeLeft: goToNextDay,
    onSwipeRight: goToPreviousDay,
    threshold: 50,
  });

  // 스크롤 화살표 클릭
  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -120, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 120, behavior: "smooth" });
  };

  // 선택된 탭으로 스크롤
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const selectedTab = container.querySelector(
      `[data-day="${selectedDay}"]`
    ) as HTMLElement;
    if (selectedTab) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = selectedTab.getBoundingClientRect();

      if (tabRect.left < containerRect.left) {
        container.scrollBy({
          left: tabRect.left - containerRect.left - 16,
          behavior: "smooth",
        });
      } else if (tabRect.right > containerRect.right) {
        container.scrollBy({
          left: tabRect.right - containerRect.right + 16,
          behavior: "smooth",
        });
      }
    }
  }, [selectedDay]);

  if (days.length === 0) return null;

  return (
    <div
      className={cn(
        "bg-background border-b",
        className
      )}
      {...swipeHandlers}
    >
      <div className="relative flex items-center">
        {/* 왼쪽 화살표 */}
        {showLeftArrow && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 z-10 h-full rounded-none bg-gradient-to-r from-background to-transparent"
            onClick={scrollLeft}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* 탭 목록 */}
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto scrollbar-hide px-4 py-2 gap-2"
          onScroll={checkScrollState}
        >
          {days.map((day) => (
            <DayTabItem
              key={day.dayNumber}
              dayNumber={day.dayNumber}
              date={day.date}
              isSelected={selectedDay === day.dayNumber}
              onClick={() => onSelectDay(day.dayNumber)}
            />
          ))}
        </div>

        {/* 오른쪽 화살표 */}
        {showRightArrow && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 z-10 h-full rounded-none bg-gradient-to-l from-background to-transparent"
            onClick={scrollRight}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface DayTabItemProps {
  dayNumber: number;
  date: string;
  isSelected: boolean;
  onClick: () => void;
}

function DayTabItem({ dayNumber, date, isSelected, onClick }: DayTabItemProps) {
  return (
    <button
      data-day={dayNumber}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center min-w-[64px] px-3 py-2 rounded-lg transition-all shrink-0",
        isSelected
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/50 text-muted-foreground hover:bg-muted"
      )}
    >
      <span className="text-sm font-semibold">{dayNumber}일차</span>
      <span className={cn("text-xs", isSelected ? "opacity-90" : "opacity-70")}>
        {formatTabDate(date)}
      </span>
    </button>
  );
}

interface DayTabsContainerProps {
  /** 일자 탭 목록 */
  days: DayTab[];
  /** 현재 선택된 일차 */
  selectedDay: number;
  /** 일차 선택 핸들러 */
  onSelectDay: (dayNumber: number) => void;
  /** 컨텐츠 영역 */
  children: React.ReactNode;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 탭과 컨텐츠를 함께 감싸는 컨테이너
 * 스와이프로 컨텐츠 전환 지원
 */
export function DayTabsContainer({
  days,
  selectedDay,
  onSelectDay,
  children,
  className,
}: DayTabsContainerProps) {
  // 이전/다음 일차로 이동
  const goToPreviousDay = React.useCallback(() => {
    const currentIndex = days.findIndex((d) => d.dayNumber === selectedDay);
    if (currentIndex > 0) {
      onSelectDay(days[currentIndex - 1].dayNumber);
    }
  }, [days, selectedDay, onSelectDay]);

  const goToNextDay = React.useCallback(() => {
    const currentIndex = days.findIndex((d) => d.dayNumber === selectedDay);
    if (currentIndex < days.length - 1) {
      onSelectDay(days[currentIndex + 1].dayNumber);
    }
  }, [days, selectedDay, onSelectDay]);

  // 컨텐츠 영역 스와이프 핸들러
  const swipeHandlers = useSwipe({
    onSwipeLeft: goToNextDay,
    onSwipeRight: goToPreviousDay,
    threshold: 50,
  });

  return (
    <div className={cn("flex flex-col", className)}>
      <DayTabs
        days={days}
        selectedDay={selectedDay}
        onSelectDay={onSelectDay}
      />
      <div className="flex-1 overflow-auto" {...swipeHandlers}>
        {children}
      </div>
    </div>
  );
}

/**
 * 간단한 일자 탭 (키보드 네비게이션 지원)
 */
export function DayTabsSimple({
  days,
  selectedDay,
  onSelectDay,
  className,
}: DayTabsProps) {
  const handleKeyDown = (e: React.KeyboardEvent, dayNumber: number) => {
    const currentIndex = days.findIndex((d) => d.dayNumber === dayNumber);

    if (e.key === "ArrowLeft" && currentIndex > 0) {
      e.preventDefault();
      onSelectDay(days[currentIndex - 1].dayNumber);
    } else if (e.key === "ArrowRight" && currentIndex < days.length - 1) {
      e.preventDefault();
      onSelectDay(days[currentIndex + 1].dayNumber);
    }
  };

  return (
    <div
      className={cn(
        "flex gap-1 p-1 bg-muted rounded-lg w-fit",
        className
      )}
      role="tablist"
    >
      {days.map((day) => (
        <button
          key={day.dayNumber}
          role="tab"
          aria-selected={selectedDay === day.dayNumber}
          tabIndex={selectedDay === day.dayNumber ? 0 : -1}
          onClick={() => onSelectDay(day.dayNumber)}
          onKeyDown={(e) => handleKeyDown(e, day.dayNumber)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
            selectedDay === day.dayNumber
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {day.dayNumber}일차
        </button>
      ))}
    </div>
  );
}
