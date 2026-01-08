"use client";

import { useState } from "react";
import { AlertTriangle, MapPin, Clock, Route, ChevronDown, ChevronUp, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { UnassignedPlaceInfo, UnassignedReasonCode } from "@/types/optimize";

interface UnassignedPlacesProps {
  /** 누락된 장소 목록 */
  places: UnassignedPlaceInfo[];
  /** 추가 클래스 */
  className?: string;
}

/**
 * 누락 이유 코드에 따른 아이콘 반환
 */
function getReasonIcon(code: UnassignedReasonCode) {
  switch (code) {
    case "TIME_EXCEEDED":
      return <Clock className="h-3.5 w-3.5" />;
    case "DISTANCE_TOO_FAR":
      return <Route className="h-3.5 w-3.5" />;
    case "NO_ROUTE":
      return <Route className="h-3.5 w-3.5" />;
    default:
      return <Info className="h-3.5 w-3.5" />;
  }
}

/**
 * 누락 이유 코드에 따른 한국어 레이블 반환
 */
function getReasonLabel(code: UnassignedReasonCode): string {
  switch (code) {
    case "TIME_EXCEEDED":
      return "시간 초과";
    case "DISTANCE_TOO_FAR":
      return "거리 초과";
    case "FIXED_CONFLICT":
      return "일정 충돌";
    case "NO_ROUTE":
      return "경로 없음";
    case "LOW_PRIORITY":
      return "우선순위 낮음";
    default:
      return "알 수 없음";
  }
}

/**
 * 누락 이유 코드에 따른 색상 클래스 반환
 */
function getReasonColorClass(code: UnassignedReasonCode): string {
  switch (code) {
    case "TIME_EXCEEDED":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "DISTANCE_TOO_FAR":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "NO_ROUTE":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "FIXED_CONFLICT":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

/**
 * 단일 누락 장소 아이템 (호버 툴팁 포함)
 */
function UnassignedPlaceItem({ place }: { place: UnassignedPlaceInfo }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg cursor-help transition-colors",
              "hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
            )}
          >
            <MapPin className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="flex-1 text-sm font-medium text-amber-800 dark:text-amber-300 truncate">
              {place.placeName}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                getReasonColorClass(place.reasonCode)
              )}
            >
              {getReasonIcon(place.reasonCode)}
              {getReasonLabel(place.reasonCode)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-xs p-3 bg-white dark:bg-gray-900 border shadow-lg"
        >
          <div className="space-y-2">
            <p className="font-semibold text-sm text-foreground">
              {place.placeName}
            </p>
            <p className="text-sm text-muted-foreground">
              {place.reasonMessage}
            </p>
            {place.details && (
              <div className="pt-2 border-t space-y-1">
                {place.details.estimatedDuration !== undefined && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    예상 체류 시간: {place.details.estimatedDuration}분
                  </p>
                )}
                {place.details.estimatedTravelTime !== undefined && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Route className="h-3 w-3" />
                    예상 이동 시간: {place.details.estimatedTravelTime}분
                  </p>
                )}
                {place.details.availableTime !== undefined && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    남은 가용 시간: {place.details.availableTime}분
                  </p>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * 누락된 장소 목록 컴포넌트
 *
 * 최적화 결과에서 일정에 포함되지 못한 장소들을 표시합니다.
 * 각 장소에 호버하면 누락 이유를 상세히 볼 수 있습니다.
 */
export function UnassignedPlaces({ places, className }: UnassignedPlacesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (places.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-b bg-amber-50 dark:bg-amber-950/30",
        className
      )}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            {places.length}개 장소가 일정에 포함되지 못했습니다
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <p className="text-xs text-amber-600 dark:text-amber-500 mb-3">
            일일 활동 시간 내에 모든 장소를 배치할 수 없어 다음 장소들이 제외되었습니다.
            <br />
            <span className="font-medium">각 장소에 마우스를 올리면 상세 이유를 확인할 수 있습니다.</span>
          </p>
          <div className="space-y-1">
            {places.map((place) => (
              <UnassignedPlaceItem key={place.placeId} place={place} />
            ))}
          </div>
          <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-3 pt-2 border-t border-amber-200 dark:border-amber-800">
            💡 여행 기간을 늘리거나, 장소 수를 줄이거나, 일일 활동 시간을 조정해보세요.
          </p>
        </div>
      )}
    </div>
  );
}
