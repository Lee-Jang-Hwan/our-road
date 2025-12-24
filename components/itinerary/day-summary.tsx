"use client";

import * as React from "react";
import {
  Route,
  Clock,
  MapPin,
  Timer,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DailyItinerary, ItinerarySummary } from "@/types/schedule";

// 시간 포맷팅 (분 -> 시간분)
const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
};

// 거리 포맷팅 (미터 -> km/m)
const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${meters}m`;
};

interface DaySummaryProps {
  /** 일자별 일정 */
  itinerary: DailyItinerary;
  /** 간소화 표시 */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 일자별 요약 컴포넌트
 * - 총 이동거리/시간
 * - 장소 수, 체류시간
 */
export function DaySummary({
  itinerary,
  compact = false,
  className,
}: DaySummaryProps) {
  if (itinerary.schedule.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-4 text-xs text-muted-foreground",
          className
        )}
      >
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {itinerary.placeCount}곳
        </span>
        <span className="flex items-center gap-1">
          <Route className="h-3 w-3" />
          {formatDistance(itinerary.totalDistance)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(itinerary.totalDuration)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <SummaryItem
          icon={<Route className="h-4 w-4" />}
          label="이동"
          value={formatDistance(itinerary.totalDistance)}
        />
        <SummaryItem
          icon={<Clock className="h-4 w-4" />}
          label="이동시간"
          value={formatDuration(itinerary.totalDuration)}
        />
      </div>
      <div className="flex items-center gap-4">
        <SummaryItem
          icon={<MapPin className="h-4 w-4" />}
          label="장소"
          value={`${itinerary.placeCount}곳`}
        />
        <SummaryItem
          icon={<Timer className="h-4 w-4" />}
          label="체류"
          value={formatDuration(itinerary.totalStayDuration)}
        />
      </div>
    </div>
  );
}

interface SummaryItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function SummaryItem({ icon, label, value }: SummaryItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

interface DaySummaryCardProps {
  /** 일자별 일정 */
  itinerary: DailyItinerary;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 카드 형태의 일자별 요약
 */
export function DaySummaryCard({
  itinerary,
  onClick,
  className,
}: DaySummaryCardProps) {
  const formattedDate = React.useMemo(() => {
    const date = new Date(itinerary.date);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = dayNames[date.getDay()];
    return `${month}/${day} (${dayName})`;
  }, [itinerary.date]);

  return (
    <Card
      className={cn(
        "transition-colors",
        onClick && "cursor-pointer hover:bg-accent/50",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{itinerary.dayNumber}일차</span>
            <span className="text-sm text-muted-foreground">{formattedDate}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {itinerary.startTime} - {itinerary.endTime}
          </span>
        </div>

        {/* 요약 그리드 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">장소</span>
            <span className="font-medium">{itinerary.placeCount}곳</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Route className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">이동</span>
            <span className="font-medium">{formatDistance(itinerary.totalDistance)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">이동시간</span>
            <span className="font-medium">{formatDuration(itinerary.totalDuration)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">체류</span>
            <span className="font-medium">{formatDuration(itinerary.totalStayDuration)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TripSummaryProps {
  /** 전체 일정 요약 */
  summary: ItinerarySummary;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 전체 여행 요약 컴포넌트
 */
export function TripSummary({ summary, className }: TripSummaryProps) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-4", className)}>
      <SummaryStatCard
        icon={<MapPin className="h-5 w-5" />}
        label="총 장소"
        value={`${summary.totalPlaces}곳`}
      />
      <SummaryStatCard
        icon={<Route className="h-5 w-5" />}
        label="총 이동거리"
        value={formatDistance(summary.totalDistance)}
      />
      <SummaryStatCard
        icon={<Clock className="h-5 w-5" />}
        label="총 이동시간"
        value={formatDuration(summary.totalDuration)}
      />
      <SummaryStatCard
        icon={<Timer className="h-5 w-5" />}
        label="총 체류시간"
        value={formatDuration(summary.totalStayDuration)}
      />
    </div>
  );
}

interface SummaryStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function SummaryStatCard({ icon, label, value }: SummaryStatCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center p-4 text-center">
        <div className="text-muted-foreground mb-2">{icon}</div>
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

interface DaySummaryListProps {
  /** 일자별 일정 배열 */
  itineraries: DailyItinerary[];
  /** 선택된 일차 */
  selectedDay?: number;
  /** 일차 선택 핸들러 */
  onSelectDay?: (dayNumber: number) => void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 일자별 요약 목록
 */
export function DaySummaryList({
  itineraries,
  selectedDay,
  onSelectDay,
  isLoading = false,
  className,
}: DaySummaryListProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[...Array(3)].map((_, i) => (
          <DaySummaryCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (itineraries.length === 0) {
    return (
      <div className={cn("py-8 text-center", className)}>
        <p className="text-muted-foreground">일정이 없습니다</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {itineraries.map((itinerary) => (
        <DaySummaryCard
          key={itinerary.dayNumber}
          itinerary={itinerary}
          onClick={onSelectDay ? () => onSelectDay(itinerary.dayNumber) : undefined}
          className={cn(
            selectedDay === itinerary.dayNumber && "ring-2 ring-primary"
          )}
        />
      ))}
    </div>
  );
}

function DaySummaryCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
