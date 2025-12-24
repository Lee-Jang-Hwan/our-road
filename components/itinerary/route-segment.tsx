"use client";

import * as React from "react";
import {
  Car,
  TrainFront,
  Footprints,
  ArrowDown,
  Clock,
  Route,
  Banknote,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { RouteSegment as RouteSegmentType, TransportMode } from "@/types/route";

// 이동수단 아이콘
const transportIcons: Record<TransportMode, React.ReactNode> = {
  walking: <Footprints className="h-3.5 w-3.5" />,
  public: <TrainFront className="h-3.5 w-3.5" />,
  car: <Car className="h-3.5 w-3.5" />,
};

// 이동수단 라벨
const transportLabels: Record<TransportMode, string> = {
  walking: "도보",
  public: "대중교통",
  car: "자동차",
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

interface RouteSegmentProps {
  /** 이동 구간 정보 */
  segment: RouteSegmentType;
  /** 간소화 표시 */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 구간별 이동 정보 컴포넌트
 * - 이동수단 아이콘
 * - 소요시간, 거리
 */
export function RouteSegment({
  segment,
  compact = false,
  className,
}: RouteSegmentProps) {
  const icon = transportIcons[segment.mode] || <ArrowDown className="h-3.5 w-3.5" />;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        {icon}
        <span>{formatDuration(segment.duration)}</span>
        <span className="text-muted-foreground/50">·</span>
        <span>{formatDistance(segment.distance)}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1.5 rounded-md">
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-medium text-foreground">
          {transportLabels[segment.mode]}
        </span>
      </div>

      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatDuration(segment.duration)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Route className="h-3.5 w-3.5" />
          <span>{formatDistance(segment.distance)}</span>
        </div>
        {segment.fare && segment.fare > 0 && (
          <div className="flex items-center gap-1">
            <Banknote className="h-3.5 w-3.5" />
            <span>₩{segment.fare.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface RouteSegmentConnectorProps {
  /** 이동 구간 정보 */
  segment: RouteSegmentType;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 타임라인 스타일의 이동 구간 연결선
 */
export function RouteSegmentConnector({
  segment,
  className,
}: RouteSegmentConnectorProps) {
  const icon = transportIcons[segment.mode] || <ArrowDown className="h-3.5 w-3.5" />;

  return (
    <div className={cn("relative py-2 pl-[18px]", className)}>
      {/* 연결선 */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border" />

      {/* 이동 정보 */}
      <div className="ml-6 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
          {icon}
          <span>{formatDuration(segment.duration)}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>{formatDistance(segment.distance)}</span>
        </div>
        {segment.fare && segment.fare > 0 && (
          <span className="text-muted-foreground/70">
            ₩{segment.fare.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

interface RouteSegmentCardProps {
  /** 이동 구간 정보 */
  segment: RouteSegmentType;
  /** 출발지 이름 */
  fromName?: string;
  /** 도착지 이름 */
  toName?: string;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 카드 형태의 이동 구간 정보
 */
export function RouteSegmentCard({
  segment,
  fromName,
  toName,
  className,
}: RouteSegmentCardProps) {
  const icon = transportIcons[segment.mode] || <ArrowDown className="h-4 w-4" />;

  return (
    <div
      className={cn(
        "border rounded-lg p-3 bg-card",
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span className="text-sm font-medium text-foreground">
            {transportLabels[segment.mode]}
          </span>
        </div>
      </div>

      {/* 출발/도착 */}
      {(fromName || toName) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          {fromName && <span>{fromName}</span>}
          {fromName && toName && <ArrowDown className="h-3 w-3 rotate-[-90deg]" />}
          {toName && <span>{toName}</span>}
        </div>
      )}

      {/* 상세 정보 */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatDuration(segment.duration)}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Route className="h-3.5 w-3.5" />
          <span>{formatDistance(segment.distance)}</span>
        </div>
        {segment.fare && segment.fare > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Banknote className="h-3.5 w-3.5" />
            <span>₩{segment.fare.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* 설명 */}
      {segment.description && (
        <p className="mt-2 text-xs text-muted-foreground">
          {segment.description}
        </p>
      )}
    </div>
  );
}

interface RouteSegmentInlineProps {
  /** 이동 구간 정보 */
  segment: RouteSegmentType;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 인라인 형태의 이동 구간 정보 (한 줄)
 */
export function RouteSegmentInline({
  segment,
  className,
}: RouteSegmentInlineProps) {
  const icon = transportIcons[segment.mode] || <ArrowDown className="h-3 w-3" />;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className
      )}
    >
      {icon}
      <span>{formatDuration(segment.duration)}</span>
      <span>·</span>
      <span>{formatDistance(segment.distance)}</span>
      {segment.fare && segment.fare > 0 && (
        <>
          <span>·</span>
          <span>₩{segment.fare.toLocaleString()}</span>
        </>
      )}
    </span>
  );
}
