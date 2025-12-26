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
  Bus,
  Train,
  ChevronDown,
  ChevronUp,
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
 * 구간 타입에 따른 아이콘 반환
 */
function getTrafficIcon(trafficType: 1 | 2 | 3, className?: string) {
  switch (trafficType) {
    case 1: // 지하철
      return <Train className={cn("w-3 h-3", className)} />;
    case 2: // 버스
      return <Bus className={cn("w-3 h-3", className)} />;
    case 3: // 도보
      return <Footprints className={cn("w-3 h-3", className)} />;
  }
}

/**
 * 타임라인 스타일의 이동 구간 연결선
 */
export function RouteSegmentConnector({
  segment,
  className,
}: RouteSegmentConnectorProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const icon = transportIcons[segment.mode] || <ArrowDown className="h-3.5 w-3.5" />;
  const hasTransitDetails = segment.mode === "public" && segment.transitDetails;

  // 대중교통 구간만 필터링 (도보 제외)
  const transitPaths = hasTransitDetails
    ? segment.transitDetails!.subPaths.filter((sp) => sp.trafficType !== 3)
    : [];

  return (
    <div className={cn("relative py-2 pl-[18px]", className)}>
      {/* 연결선 */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border" />

      {/* 이동 정보 */}
      <div className="ml-6">
        {hasTransitDetails ? (
          // 대중교통 상세 정보 표시
          <div className="space-y-1.5">
            {/* 요약 정보 (클릭하여 펼치기) */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:bg-muted/50 rounded px-2 py-1.5 -ml-2 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {icon}
                <span>{formatDuration(segment.duration)}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>{formatDistance(segment.distance)}</span>
              </div>

              {/* 노선 배지들 */}
              <div className="flex items-center gap-1 flex-wrap">
                {transitPaths.slice(0, 3).map((subPath, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                    style={{ backgroundColor: subPath.lane?.lineColor || "#6b7280" }}
                  >
                    {getTrafficIcon(subPath.trafficType, "w-2.5 h-2.5")}
                    <span>{subPath.lane?.name || (subPath.trafficType === 1 ? "지하철" : "버스")}</span>
                  </span>
                ))}
                {transitPaths.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{transitPaths.length - 3}</span>
                )}
              </div>

              {/* 요금 */}
              {segment.transitDetails!.totalFare > 0 && (
                <span className="text-primary text-[10px] font-medium">
                  ₩{segment.transitDetails!.totalFare.toLocaleString()}
                </span>
              )}

              {/* 펼치기/접기 아이콘 */}
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>

            {/* 상세 구간 정보 */}
            {isExpanded && (
              <div className="ml-2 pl-3 border-l-2 border-primary/20 space-y-2">
                {segment.transitDetails!.subPaths.map((subPath, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs">
                    {/* 아이콘 */}
                    <div
                      className="flex items-center justify-center w-5 h-5 rounded-full shrink-0 mt-0.5"
                      style={{
                        backgroundColor: subPath.lane?.lineColor
                          ? `${subPath.lane.lineColor}20`
                          : "rgb(var(--muted))",
                        color: subPath.lane?.lineColor || "inherit",
                      }}
                    >
                      {getTrafficIcon(subPath.trafficType, "w-3 h-3")}
                    </div>

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      {subPath.trafficType === 3 ? (
                        // 도보
                        <span className="text-muted-foreground">
                          도보 {formatDistance(subPath.distance)} ({subPath.sectionTime}분)
                        </span>
                      ) : (
                        // 대중교통
                        <div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                              style={{ backgroundColor: subPath.lane?.lineColor || "#6b7280" }}
                            >
                              {subPath.lane?.name || (subPath.trafficType === 1 ? "지하철" : "버스")}
                            </span>
                            {subPath.way && (
                              <span className="text-muted-foreground">{subPath.way} 방면</span>
                            )}
                          </div>
                          <div className="mt-0.5 text-foreground">
                            {subPath.startName} → {subPath.endName}
                          </div>
                          <div className="text-muted-foreground">
                            {subPath.stationCount && <span>{subPath.stationCount}개 정류장 · </span>}
                            {subPath.sectionTime}분
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // 기본 표시 (도보, 자동차 등)
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
