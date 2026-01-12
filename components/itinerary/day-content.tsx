"use client";

import * as React from "react";
import { Clock, Hotel, MapPin, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { normalizeTime } from "@/lib/optimize";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleItem } from "./schedule-item";
import { RouteSegmentConnector } from "./route-segment";
import { DaySummary } from "./day-summary";
import type {
  DailyItinerary,
  ScheduleItem as ScheduleItemType,
} from "@/types/schedule";
import type { TripLocation } from "@/types/trip";

interface DayContentProps {
  /** 일자별 일정 */
  itinerary: DailyItinerary;
  /** Trip-level origin (fallback when dayOrigin is missing) */
  origin?: TripLocation | null;
  /** Trip-level destination (fallback when dayDestination is missing) */
  destination?: TripLocation | null;
  /** 항목 클릭 핸들러 */
  onItemClick?: (item: ScheduleItemType) => void;
  /** 출발지/숙소 클릭 핸들러 */
  onOriginClick?: (coordinate: { lat: number; lng: number }) => void;
  /** 도착지/숙소 클릭 핸들러 */
  onDestinationClick?: (coordinate: { lat: number; lng: number }) => void;
  /** 수정 핸들러 */
  onEdit?: (item: ScheduleItemType) => void;
  /** 삭제 핸들러 */
  onDelete?: (item: ScheduleItemType) => void;
  /** 항목 네비게이션 핸들러 (index로 이동) */
  onNavigateToItem?: (index: number) => void;
  /** 네비게이션 버튼 표시 여부 */
  showNavigation?: boolean;
  /** 헤더 표시 여부 */
  showHeader?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 일자별 일정 내용 컴포넌트
 * - 장소 타임라인 표시
 * - 이동 구간 정보 포함
 */
export function DayContent({
  itinerary,
  origin,
  destination,
  onItemClick,
  onOriginClick,
  onDestinationClick,
  onEdit,
  onDelete,
  onNavigateToItem,
  showNavigation = true,
  showHeader = true,
  className,
}: DayContentProps) {
  const [isSummaryExpanded, setIsSummaryExpanded] = React.useState(false);

  // Normalize type to prevent "waypoint" type from being passed to OriginDestinationItem
  const normalizeEndpointType = (
    type: NonNullable<DailyItinerary["dayOrigin"]>["type"],
  ): "origin" | "accommodation" | "destination" | "lastPlace" => {
    return type === "waypoint" ? "lastPlace" : type;
  };

  const formattedDate = React.useMemo(() => {
    const date = new Date(itinerary.date);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = dayNames[date.getDay()];
    return `${month}월 ${day}일 (${dayName})`;
  }, [itinerary.date]);

  // Resolved origin: prioritize dayOrigin, fallback to trip origin
  const resolvedOrigin: NonNullable<DailyItinerary["dayOrigin"]> | null =
    itinerary.dayOrigin ?? (origin ? { ...origin, type: "origin" } : null);

  // Resolved destination: prioritize dayDestination, fallback to trip destination
  const resolvedDestination: NonNullable<
    DailyItinerary["dayDestination"]
  > | null =
    itinerary.dayDestination ??
    (destination ? { ...destination, type: "destination" } : null);

  return (
    <div className={cn("space-y-4", className)}>
      {/* 헤더 */}
      {showHeader && (
        <>
          <DayContentHeader
            dayNumber={itinerary.dayNumber}
            formattedDate={formattedDate}
            placeCount={itinerary.placeCount}
            startTime={itinerary.startTime}
            endTime={itinerary.endTime}
            isExpanded={isSummaryExpanded}
            onToggle={() => setIsSummaryExpanded(!isSummaryExpanded)}
          />
          {/* 토글 시에만 표시되는 요약 */}
          {isSummaryExpanded && <DaySummary itinerary={itinerary} />}
        </>
      )}

      {/* 일정 목록 */}
      {itinerary.schedule.length === 0 ? (
        <DayContentEmpty />
      ) : (
        <div className="space-y-1">
          {/* 시작점 (출발지 또는 전날 숙소) - dayOrigin 우선, 없으면 trip origin 사용 */}
          {resolvedOrigin && (
            <>
              <OriginDestinationItem
                type={normalizeEndpointType(resolvedOrigin.type)}
                name={resolvedOrigin.name}
                time={itinerary.dailyStartTime || itinerary.startTime}
                onClick={
                  onOriginClick
                    ? () =>
                        onOriginClick({
                          lat: resolvedOrigin.lat,
                          lng: resolvedOrigin.lng,
                        })
                    : undefined
                }
              />
              {/* 시작점 → 첫 장소 이동 */}
              {itinerary.transportFromOrigin && (
                <RouteSegmentConnector
                  segment={itinerary.transportFromOrigin}
                />
              )}
            </>
          )}

          {itinerary.schedule.map((item, index) => (
            <React.Fragment key={`${item.placeId}-${item.order}`}>
              {/* 일정 항목 */}
              <ScheduleItem
                item={item}
                onClick={onItemClick ? () => onItemClick(item) : undefined}
                onEdit={onEdit ? () => onEdit(item) : undefined}
                onDelete={onDelete ? () => onDelete(item) : undefined}
                showNavigation={showNavigation}
                onPrevious={
                  index > 0 ? () => onNavigateToItem?.(index - 1) : undefined
                }
                onNext={
                  index < itinerary.schedule.length - 1
                    ? () => onNavigateToItem?.(index + 1)
                    : undefined
                }
              />

              {/* 이동 구간 (마지막 항목 제외) */}
              {index < itinerary.schedule.length - 1 &&
                item.transportToNext && (
                  <RouteSegmentConnector segment={item.transportToNext} />
                )}
            </React.Fragment>
          ))}

          {/* 끝점 (도착지 또는 숙소) - dayDestination 우선, 없으면 trip destination 사용 */}
          {resolvedDestination && (
            <>
              {itinerary.transportToDestination && (
                <RouteSegmentConnector
                  segment={itinerary.transportToDestination}
                />
              )}
              <OriginDestinationItem
                type={normalizeEndpointType(resolvedDestination.type)}
                name={resolvedDestination.name}
                time={calculateDestinationArrivalTime(itinerary)}
                onClick={
                  onDestinationClick
                    ? () =>
                        onDestinationClick({
                          lat: resolvedDestination.lat,
                          lng: resolvedDestination.lng,
                        })
                    : undefined
                }
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface DayContentHeaderProps {
  dayNumber: number;
  formattedDate: string;
  placeCount: number;
  startTime: string;
  endTime: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

function DayContentHeader({
  dayNumber,
  formattedDate,
  placeCount,
  startTime,
  endTime,
  isExpanded = false,
  onToggle,
}: DayContentHeaderProps) {
  const Icon = isExpanded ? ChevronUp : ChevronDown;

  return (
    <div
      className={cn(
        "flex items-center justify-between pb-3 border-b",
        onToggle &&
          "cursor-pointer hover:bg-muted/30 -mx-2 px-2 py-2 rounded-lg transition-colors",
      )}
      onClick={onToggle}
    >
      <div>
        <h3 className="font-semibold text-lg">{dayNumber}일차</h3>
        <p className="text-sm text-muted-foreground">{formattedDate}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right text-sm text-muted-foreground">
          <p className="flex items-center gap-1 justify-end">
            <MapPin className="h-3.5 w-3.5" />
            {placeCount}개 장소
          </p>
          <p className="flex items-center gap-1 justify-end">
            <Clock className="h-3.5 w-3.5" />
            {normalizeTime(startTime)} - {normalizeTime(endTime)}
          </p>
        </div>
        {onToggle && (
          <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
      </div>
    </div>
  );
}

function DayContentEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Clock className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">이 날의 일정이 없습니다</p>
      <p className="text-sm text-muted-foreground/70 mt-1">
        장소를 추가하여 일정을 계획해보세요
      </p>
    </div>
  );
}

/**
 * 도착지 도착 시간 계산
 */
function calculateDestinationArrivalTime(itinerary: DailyItinerary): string {
  const lastItem = itinerary.schedule[itinerary.schedule.length - 1];
  if (!lastItem) return itinerary.endTime;

  // 마지막 장소 출발 시간 + 도착지까지 이동 시간
  const departureMinutes = timeToMinutes(lastItem.departureTime);
  const travelMinutes = itinerary.transportToDestination?.duration ?? 0;
  return minutesToTime(departureMinutes + travelMinutes);
}

/**
 * 시간 문자열을 분으로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분을 시간 문자열로 변환
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

interface OriginDestinationItemProps {
  type: "origin" | "destination" | "accommodation" | "lastPlace";
  name: string;
  time: string;
  onClick?: () => void;
}

/**
 * 출발지/도착지/숙소/전날 마지막 장소 표시 컴포넌트
 */
function OriginDestinationItem({
  type,
  name,
  time,
  onClick,
}: OriginDestinationItemProps) {
  const isOrigin = type === "origin" || type === "lastPlace";
  const isAccommodation = type === "accommodation";

  // 타입별 스타일 및 라벨
  const styles = isOrigin
    ? "bg-green-100 text-green-600"
    : isAccommodation
      ? "bg-purple-100 text-purple-600"
      : "bg-red-100 text-red-600";

  const label =
    type === "origin"
      ? "출발"
      : type === "lastPlace"
        ? "시작"
        : isAccommodation
          ? "숙소"
          : "도착";
  const Icon = isAccommodation ? Hotel : MapPin;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-dashed bg-muted/30",
        onClick && "cursor-pointer hover:bg-muted/50 transition-colors",
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          styles,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium">{normalizeTime(time)}</p>
      </div>
    </div>
  );
}

interface DayContentLoadingProps {
  itemCount?: number;
  className?: string;
}

/**
 * 로딩 스켈레톤
 */
export function DayContentLoading({
  itemCount = 3,
  className,
}: DayContentLoadingProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* 헤더 스켈레톤 */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="space-y-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* 일정 스켈레톤 */}
      <div className="space-y-3">
        {[...Array(itemCount)].map((_, i) => (
          <React.Fragment key={i}>
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            {i < itemCount - 1 && (
              <div className="flex items-center gap-2 ml-10 py-1">
                <Skeleton className="h-5 w-24" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

interface DayContentPanelProps {
  /** 일자별 일정 배열 */
  itineraries: DailyItinerary[];
  /** 현재 선택된 일차 */
  selectedDay: number;
  /** Trip-level origin (fallback when dayOrigin is missing) */
  origin?: TripLocation | null;
  /** Trip-level destination (fallback when dayDestination is missing) */
  destination?: TripLocation | null;
  /** 항목 클릭 핸들러 */
  onItemClick?: (item: ScheduleItemType) => void;
  /** 출발지/숙소 클릭 핸들러 */
  onOriginClick?: (coordinate: { lat: number; lng: number }) => void;
  /** 도착지/숙소 클릭 핸들러 */
  onDestinationClick?: (coordinate: { lat: number; lng: number }) => void;
  /** 수정 핸들러 */
  onEdit?: (item: ScheduleItemType) => void;
  /** 삭제 핸들러 */
  onDelete?: (item: ScheduleItemType) => void;
  /** 항목 네비게이션 핸들러 (index로 이동) */
  onNavigateToItem?: (index: number) => void;
  /** 네비게이션 버튼 표시 여부 */
  showNavigation?: boolean;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 선택된 일자의 컨텐츠를 표시하는 패널
 */
export function DayContentPanel({
  itineraries,
  selectedDay,
  origin,
  destination,
  onItemClick,
  onOriginClick,
  onDestinationClick,
  onEdit,
  onDelete,
  onNavigateToItem,
  showNavigation = true,
  isLoading = false,
  className,
}: DayContentPanelProps) {
  const selectedItinerary = React.useMemo(
    () => itineraries.find((it) => it.dayNumber === selectedDay),
    [itineraries, selectedDay],
  );

  if (isLoading) {
    return <DayContentLoading className={className} />;
  }

  if (!selectedItinerary) {
    return (
      <div className={cn("py-12 text-center", className)}>
        <p className="text-muted-foreground">
          선택된 일자의 일정을 찾을 수 없습니다
        </p>
      </div>
    );
  }

  return (
    <DayContent
      itinerary={selectedItinerary}
      origin={origin}
      destination={destination}
      onItemClick={onItemClick}
      onOriginClick={onOriginClick}
      onDestinationClick={onDestinationClick}
      onEdit={onEdit}
      onDelete={onDelete}
      onNavigateToItem={onNavigateToItem}
      showNavigation={showNavigation}
      showHeader={true}
      className={className}
    />
  );
}
