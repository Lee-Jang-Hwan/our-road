"use client";

import * as React from "react";
import {
  Clock,
  ArrowDown,
  Car,
  TrainFront,
  Footprints,
  Pin,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScheduleItem, DailyItinerary } from "@/types/schedule";
import type { TransportMode } from "@/types/route";

// 이동수단 아이콘
const transportIcons: Record<TransportMode, React.ReactNode> = {
  walking: <Footprints className="h-3.5 w-3.5" />,
  public: <TrainFront className="h-3.5 w-3.5" />,
  car: <Car className="h-3.5 w-3.5" />,
};

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

interface ScheduleTimelineItemProps {
  /** 일정 항목 */
  item: ScheduleItem;
  /** 첫 번째 항목 여부 */
  isFirst?: boolean;
  /** 마지막 항목 여부 */
  isLast?: boolean;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 추가 클래스 */
  className?: string;
}

export function ScheduleTimelineItem({
  item,
  isFirst = false,
  isLast = false,
  onClick,
  className,
}: ScheduleTimelineItemProps) {
  return (
    <div className={cn("relative", className)}>
      {/* 타임라인 연결선 (상단) */}
      {!isFirst && (
        <div className="absolute left-[18px] top-0 w-0.5 h-3 bg-border" />
      )}

      {/* 일정 항목 */}
      <div
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg",
          item.isFixed
            ? "bg-primary/5 border border-primary/20"
            : "bg-card border",
          onClick && "cursor-pointer hover:bg-accent/50"
        )}
        onClick={onClick}
      >
        {/* 순서 번호 */}
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold shrink-0",
            item.isFixed
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          )}
        >
          {item.order}
        </div>

        {/* 장소 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate">{item.placeName}</span>
                {item.isFixed && (
                  <Badge
                    variant="secondary"
                    className="gap-0.5 text-[10px] h-5 bg-primary/10 text-primary"
                  >
                    <Pin className="h-2.5 w-2.5" />
                    고정
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* 시간 정보 */}
          <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {item.arrivalTime} - {item.departureTime}
              </span>
            </div>
            <span className="text-xs">({formatDuration(item.duration)})</span>
          </div>
        </div>
      </div>

      {/* 이동 정보 (마지막 항목 제외) */}
      {!isLast && item.transportToNext && (
        <div className="relative ml-[18px] py-2">
          {/* 타임라인 연결선 */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border" />

          {/* 이동 정보 카드 */}
          <div className="ml-6 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded">
              {transportIcons[item.transportToNext.mode as TransportMode] || (
                <ArrowDown className="h-3.5 w-3.5" />
              )}
              <span>{formatDuration(item.transportToNext.duration)}</span>
              <span className="text-muted-foreground/60">·</span>
              <span>{formatDistance(item.transportToNext.distance)}</span>
            </div>
            {item.transportToNext.fare && item.transportToNext.fare > 0 && (
              <span className="text-muted-foreground/70">
                ₩{item.transportToNext.fare.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 타임라인 연결선 (하단) */}
      {!isLast && !item.transportToNext && (
        <div className="absolute left-[18px] bottom-0 w-0.5 h-3 bg-border" />
      )}
    </div>
  );
}

interface ScheduleTimelineProps {
  /** 일정 항목 배열 */
  schedule: ScheduleItem[];
  /** 항목 클릭 핸들러 */
  onItemClick?: (item: ScheduleItem) => void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 빈 상태 메시지 */
  emptyMessage?: string;
  /** 추가 클래스 */
  className?: string;
}

export function ScheduleTimeline({
  schedule,
  onItemClick,
  isLoading = false,
  emptyMessage = "일정이 없습니다",
  className,
}: ScheduleTimelineProps) {
  // 로딩 상태
  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[...Array(3)].map((_, i) => (
          <ScheduleTimelineSkeleton key={i} />
        ))}
      </div>
    );
  }

  // 빈 상태
  if (schedule.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12 text-center",
          className
        )}
      >
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {schedule.map((item, index) => (
        <ScheduleTimelineItem
          key={`${item.placeId}-${item.order}`}
          item={item}
          isFirst={index === 0}
          isLast={index === schedule.length - 1}
          onClick={onItemClick ? () => onItemClick(item) : undefined}
        />
      ))}
    </div>
  );
}

interface DailyScheduleTimelineProps {
  /** 일자별 일정 */
  itinerary: DailyItinerary;
  /** 항목 클릭 핸들러 */
  onItemClick?: (item: ScheduleItem) => void;
  /** 헤더 표시 여부 */
  showHeader?: boolean;
  /** 요약 표시 여부 */
  showSummary?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export function DailyScheduleTimeline({
  itinerary,
  onItemClick,
  showHeader = true,
  showSummary = true,
  className,
}: DailyScheduleTimelineProps) {
  const formattedDate = React.useMemo(() => {
    const date = new Date(itinerary.date);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = dayNames[date.getDay()];
    return `${month}월 ${day}일 (${dayName})`;
  }, [itinerary.date]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* 헤더 */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">
              {itinerary.dayNumber}일차
            </h3>
            <p className="text-sm text-muted-foreground">{formattedDate}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{itinerary.placeCount}개 장소</p>
            <p>
              {itinerary.startTime} - {itinerary.endTime}
            </p>
          </div>
        </div>
      )}

      {/* 타임라인 */}
      <ScheduleTimeline
        schedule={itinerary.schedule}
        onItemClick={onItemClick}
      />

      {/* 요약 */}
      {showSummary && itinerary.schedule.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-muted-foreground">이동</span>
              <span className="ml-1 font-medium">
                {formatDistance(itinerary.totalDistance)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">이동시간</span>
              <span className="ml-1 font-medium">
                {formatDuration(itinerary.totalDuration)}
              </span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">체류시간</span>
            <span className="ml-1 font-medium">
              {formatDuration(itinerary.totalStayDuration)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleTimelineSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
