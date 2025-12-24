"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import {
  LuChevronLeft,
  LuShare2,
  LuSave,
  LuLoader2,
  LuSparkles,
} from "react-icons/lu";

import { Button } from "@/components/ui/button";
import { DayTabsContainer } from "@/components/itinerary/day-tabs";
import { DayContentPanel } from "@/components/itinerary/day-content";
import { DaySummary } from "@/components/itinerary/day-summary";
import { useSwipe } from "@/hooks/use-swipe";
import type { DailyItinerary, ScheduleItem } from "@/types/schedule";

interface ResultPageProps {
  params: Promise<{ tripId: string }>;
}

export default function ResultPage({ params }: ResultPageProps) {
  const { tripId } = use(params);
  const [selectedDay, setSelectedDay] = useState(1);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // TODO: 실제 최적화 결과 로드
  // 데모용 더미 데이터
  const itineraries: DailyItinerary[] = useMemo(
    () => [
      {
        dayNumber: 1,
        date: "2025-01-15",
        startTime: "10:00",
        endTime: "20:30",
        placeCount: 4,
        totalDuration: 630,
        totalDistance: 45000,
        schedule: [
          {
            placeId: "1",
            placeName: "성산일출봉",
            address: "제주특별자치도 서귀포시 성산읍",
            order: 1,
            startTime: "10:00",
            endTime: "12:00",
            duration: 120,
            isFixed: false,
            transportToNext: {
              mode: "public",
              duration: 30,
              distance: 15000,
              description: "버스 201번",
            },
          },
          {
            placeId: "2",
            placeName: "섭지코지",
            address: "제주특별자치도 서귀포시 성산읍",
            order: 2,
            startTime: "12:30",
            endTime: "14:00",
            duration: 90,
            isFixed: false,
            transportToNext: {
              mode: "public",
              duration: 20,
              distance: 8000,
              description: "버스 201번",
            },
          },
          {
            placeId: "3",
            placeName: "카페 델문도",
            address: "제주특별자치도 서귀포시",
            order: 3,
            startTime: "14:20",
            endTime: "15:20",
            duration: 60,
            isFixed: true,
            transportToNext: {
              mode: "public",
              duration: 40,
              distance: 22000,
              description: "버스 780번 환승",
            },
          },
          {
            placeId: "4",
            placeName: "중문 색달해변",
            address: "제주특별자치도 서귀포시 중문동",
            order: 4,
            startTime: "16:00",
            endTime: "18:00",
            duration: 120,
            isFixed: false,
          },
        ],
      },
      {
        dayNumber: 2,
        date: "2025-01-16",
        startTime: "10:00",
        endTime: "19:00",
        placeCount: 3,
        totalDuration: 540,
        totalDistance: 32000,
        schedule: [
          {
            placeId: "5",
            placeName: "한라산 영실코스",
            address: "제주특별자치도 서귀포시",
            order: 1,
            startTime: "10:00",
            endTime: "14:00",
            duration: 240,
            isFixed: false,
            transportToNext: {
              mode: "car",
              duration: 30,
              distance: 20000,
              description: "자가용",
            },
          },
          {
            placeId: "6",
            placeName: "오설록 티뮤지엄",
            address: "제주특별자치도 서귀포시 안덕면",
            order: 2,
            startTime: "14:30",
            endTime: "16:00",
            duration: 90,
            isFixed: false,
            transportToNext: {
              mode: "car",
              duration: 20,
              distance: 12000,
              description: "자가용",
            },
          },
          {
            placeId: "7",
            placeName: "새별오름",
            address: "제주특별자치도 제주시 애월읍",
            order: 3,
            startTime: "16:20",
            endTime: "18:20",
            duration: 120,
            isFixed: false,
          },
        ],
      },
      {
        dayNumber: 3,
        date: "2025-01-17",
        startTime: "10:00",
        endTime: "18:00",
        placeCount: 2,
        totalDuration: 480,
        totalDistance: 15000,
        schedule: [],
      },
    ],
    []
  );

  // 일자 탭 데이터
  const days = itineraries.map((it) => ({
    dayNumber: it.dayNumber,
    date: it.date,
  }));

  // 스와이프로 일자 전환
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      const currentIndex = days.findIndex((d) => d.dayNumber === selectedDay);
      if (currentIndex < days.length - 1) {
        setSelectedDay(days[currentIndex + 1].dayNumber);
      }
    },
    onSwipeRight: () => {
      const currentIndex = days.findIndex((d) => d.dayNumber === selectedDay);
      if (currentIndex > 0) {
        setSelectedDay(days[currentIndex - 1].dayNumber);
      }
    },
    threshold: 50,
  });

  // 일정 항목 클릭
  const handleItemClick = (item: ScheduleItem) => {
    console.log("Item clicked:", item);
    // TODO: 지도에서 해당 장소 표시
  };

  // 재최적화
  const handleReoptimize = async () => {
    setIsOptimizing(true);
    try {
      // TODO: Server Action으로 재최적화
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } finally {
      setIsOptimizing(false);
    }
  };

  // 저장
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Server Action으로 저장
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } finally {
      setIsSaving(false);
    }
  };

  // 현재 선택된 일정
  const currentItinerary = itineraries.find(
    (it) => it.dayNumber === selectedDay
  );

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <Link href={`/plan/${tripId}`}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <LuChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="font-semibold text-lg flex-1">최적화 결과</h1>
        <Button variant="ghost" size="icon">
          <LuShare2 className="w-5 h-5" />
        </Button>
      </header>

      {/* 일자별 탭 */}
      <DayTabsContainer
        days={days}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        className="flex-1"
      >
        {/* 일정 내용 */}
        <div className="px-4 py-4" {...swipeHandlers}>
          {isOptimizing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <LuLoader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">일정 최적화 중...</p>
            </div>
          ) : (
            <>
              {/* 일일 요약 */}
              {currentItinerary && (
                <DaySummary
                  dayNumber={currentItinerary.dayNumber}
                  date={currentItinerary.date}
                  placeCount={currentItinerary.placeCount}
                  totalDuration={currentItinerary.totalDuration}
                  totalDistance={currentItinerary.totalDistance}
                  className="mb-4"
                />
              )}

              {/* 일정 타임라인 */}
              <DayContentPanel
                itineraries={itineraries}
                selectedDay={selectedDay}
                onItemClick={handleItemClick}
                isLoading={false}
              />
            </>
          )}
        </div>
      </DayTabsContainer>

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={handleReoptimize}
            disabled={isOptimizing || isSaving}
          >
            {isOptimizing ? (
              <LuLoader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LuSparkles className="w-4 h-4 mr-2" />
            )}
            재최적화
          </Button>
          <Button
            className="flex-1 h-12"
            onClick={handleSave}
            disabled={isOptimizing || isSaving}
          >
            {isSaving ? (
              <LuLoader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LuSave className="w-4 h-4 mr-2" />
            )}
            저장하기
          </Button>
        </div>
      </div>
    </main>
  );
}
