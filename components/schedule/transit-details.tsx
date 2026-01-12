"use client";

import * as React from "react";
import { Bus, Train, Footprints, Clock, ArrowRight, ChevronDown, ChevronUp, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TransitDetails, TransitSubPath } from "@/types/route";

interface TransitDetailsCardProps {
  /** 대중교통 상세 정보 */
  transitDetails: TransitDetails;
  /** 컴팩트 모드 (접힌 상태로 시작) */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 구간 타입에 따른 아이콘 반환
 */
function getTrafficIcon(trafficType: number) {
  switch (trafficType) {
    case 1: // 지하철
    case 10: // 열차
      return <Train className="w-4 h-4" />;
    case 2: // 버스
    case 11: // 고속버스
    case 12: // 시외버스
      return <Bus className="w-4 h-4" />;
    case 3: // 도보
      return <Footprints className="w-4 h-4" />;
    case 14: // 해운
      return <Ship className="w-4 h-4" />;
    default:
      return <Train className="w-4 h-4" />;
  }
}

/**
 * 구간 타입에 따른 라벨 반환
 */
function getTrafficLabel(trafficType: number) {
  switch (trafficType) {
    case 1:
      return "지하철";
    case 2:
      return "버스";
    case 3:
      return "도보";
    case 10:
      return "열차";
    case 11:
      return "고속버스";
    case 12:
      return "시외버스";
    case 14:
      return "해운";
    default:
      return "대중교통";
  }
}

/**
 * 시간 포맷팅 (분 → 시간분)
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}시간`;
  }
  return `${hours}시간 ${mins}분`;
}

/**
 * 거리 포맷팅 (미터 → km/m)
 */
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${meters}m`;
}

/**
 * 하위 구간 아이템 컴포넌트
 */
function SubPathItem({ subPath }: { subPath: TransitSubPath }) {
  const icon = getTrafficIcon(subPath.trafficType);
  const lineColor = subPath.lane?.lineColor;

  return (
    <div className="flex items-start gap-2 py-2">
      {/* 아이콘 */}
      <div
        className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
        style={{
          backgroundColor: lineColor ? `${lineColor}20` : "rgb(var(--muted))",
          color: lineColor || "inherit",
        }}
      >
        {icon}
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        {subPath.trafficType === 3 ? (
          // 도보
          <div className="text-sm text-muted-foreground">
            도보 {formatDistance(subPath.distance)} ({subPath.sectionTime}분)
          </div>
        ) : (
          // 대중교통 (지하철/버스)
          <>
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 노선명 */}
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: lineColor || "#6b7280" }}
              >
                {/* 열차의 경우 노선명 우선 표시 (KTX, 새마을호 등) */}
                {subPath.trafficType === 10
                  ? (subPath.lane?.name && subPath.lane.name.trim()
                      ? subPath.lane.name
                      : "열차")
                  : (subPath.lane?.name && subPath.lane.name.trim()
                      ? subPath.lane.name
                      : getTrafficLabel(subPath.trafficType))}
              </span>

              {/* 버스 유형 */}
              {subPath.lane?.busType && (
                <span className="text-xs text-muted-foreground">
                  ({subPath.lane.busType})
                </span>
              )}

              {/* 방면 */}
              {subPath.way && (
                <span className="text-xs text-muted-foreground">
                  {subPath.way} 방면
                </span>
              )}
            </div>

            {/* 출발역 → 도착역 */}
            <div className="flex items-center gap-1 mt-1 text-sm">
              <span className="font-medium">{subPath.startName}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="font-medium">{subPath.endName}</span>
            </div>

            {/* 정류장 수, 소요시간 */}
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              {subPath.stationCount && (
                <span>{subPath.stationCount}개 정류장</span>
              )}
              <span>{subPath.sectionTime}분</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 대중교통 상세 정보 카드 컴포넌트
 */
export function TransitDetailsCard({
  transitDetails,
  compact = false,
  className,
}: TransitDetailsCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(!compact);

  // 총 소요시간 계산
  const totalTime = transitDetails.subPaths.reduce(
    (sum, sp) => sum + sp.sectionTime,
    0
  );

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      {/* 헤더 (요약 정보) */}
      <button
        type="button"
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm font-medium">
            <Clock className="w-4 h-4 text-primary" />
            <span>{formatDuration(totalTime)}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {transitDetails.transferCount > 0 && (
              <span>환승 {transitDetails.transferCount}회</span>
            )}
            {transitDetails.walkingTime > 0 && (
              <span>도보 {transitDetails.walkingTime}분</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary">
            ₩{transitDetails.totalFare.toLocaleString()}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* 상세 구간 정보 */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t">
          <div className="divide-y">
            {transitDetails.subPaths.map((subPath, index) => (
              <SubPathItem key={index} subPath={subPath} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 인라인 대중교통 요약 정보 (한 줄)
 */
export function TransitSummaryInline({
  transitDetails,
  className,
}: {
  transitDetails: TransitDetails;
  className?: string;
}) {
  // 대중교통 구간만 필터링 (도보 제외)
  const transitPaths = transitDetails.subPaths.filter(
    (sp) => sp.trafficType !== 3
  );

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {transitPaths.map((subPath, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium text-white"
            style={{ backgroundColor: subPath.lane?.lineColor || "#6b7280" }}
          >
            {getTrafficIcon(subPath.trafficType)}
            <span>
              {/* 열차의 경우 노선명 우선 표시 (KTX, 새마을호 등) */}
              {subPath.trafficType === 10
                ? (subPath.lane?.name && subPath.lane.name.trim()
                    ? subPath.lane.name
                    : "열차")
                : (subPath.lane?.name && subPath.lane.name.trim()
                    ? subPath.lane.name
                    : getTrafficLabel(subPath.trafficType))}
            </span>
          </span>
        </React.Fragment>
      ))}

      {transitDetails.walkingTime > 0 && (
        <>
          <span className="text-xs text-muted-foreground mx-1">+</span>
          <span className="text-xs text-muted-foreground">
            도보 {transitDetails.walkingTime}분
          </span>
        </>
      )}
    </div>
  );
}

/**
 * 대중교통 이동 안내 컴포넌트 (구간 사이에 표시)
 */
export function TransitRouteGuide({
  transitDetails,
  fromName,
  toName,
  className,
}: {
  transitDetails: TransitDetails;
  fromName: string;
  toName: string;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // 총 소요시간 계산
  const totalTime = transitDetails.subPaths.reduce(
    (sum, sp) => sum + sp.sectionTime,
    0
  );

  return (
    <div className={cn("my-2", className)}>
      {/* 요약 버튼 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
      >
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{totalTime}분</span>
        </div>

        <div className="flex-1 min-w-0">
          <TransitSummaryInline transitDetails={transitDetails} />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-primary font-medium">
            ₩{transitDetails.totalFare.toLocaleString()}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* 상세 정보 펼침 */}
      {isExpanded && (
        <div className="mt-2 ml-4 pl-4 border-l-2 border-primary/20">
          <div className="text-xs text-muted-foreground mb-2">
            {fromName} → {toName}
          </div>
          {transitDetails.subPaths.map((subPath, index) => (
            <SubPathItem key={index} subPath={subPath} />
          ))}
        </div>
      )}
    </div>
  );
}

export type { TransitDetailsCardProps };
