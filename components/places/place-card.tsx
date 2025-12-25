"use client";

import * as React from "react";
import {
  MapPin,
  Clock,
  GripVertical,
  Trash2,
  MoreVertical,
  Utensils,
  Coffee,
  Camera,
  ShoppingBag,
  Building,
  TreePine,
  Star,
  Ticket,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateDurationOptions } from "@/lib/schemas";
import type { Place, PlaceCategory } from "@/types/place";

// 체류 시간 옵션 생성 (30분~12시간, 30분 단위)
const durationOptions = generateDurationOptions();

// 카테고리별 아이콘 매핑
const categoryIcons: Record<PlaceCategory, React.ReactNode> = {
  tourist_attraction: <Camera className="h-4 w-4" />,
  restaurant: <Utensils className="h-4 w-4" />,
  cafe: <Coffee className="h-4 w-4" />,
  shopping: <ShoppingBag className="h-4 w-4" />,
  accommodation: <Building className="h-4 w-4" />,
  entertainment: <Ticket className="h-4 w-4" />,
  culture: <Star className="h-4 w-4" />,
  nature: <TreePine className="h-4 w-4" />,
  other: <MapPin className="h-4 w-4" />,
};

// 카테고리 한글 매핑
const categoryLabels: Record<PlaceCategory, string> = {
  tourist_attraction: "관광지",
  restaurant: "음식점",
  cafe: "카페",
  shopping: "쇼핑",
  accommodation: "숙박",
  entertainment: "엔터테인먼트",
  culture: "문화시설",
  nature: "자연/공원",
  other: "기타",
};

interface PlaceCardProps {
  /** 장소 데이터 */
  place: Place;
  /** 순서 번호 (1부터 시작) */
  index?: number;
  /** 체류 시간 변경 핸들러 */
  onDurationChange?: (duration: number) => void;
  /** 삭제 핸들러 */
  onDelete?: () => void;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 드래그 가능 여부 */
  draggable?: boolean;
  /** 드래그 핸들 속성 */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  /** 선택 상태 */
  selected?: boolean;
  /** 간략 모드 (체류시간 숨김) */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export function PlaceCard({
  place,
  index,
  onDurationChange,
  onDelete,
  onClick,
  draggable = false,
  dragHandleProps,
  selected = false,
  compact = false,
  className,
}: PlaceCardProps) {
  const categoryIcon = place.category
    ? categoryIcons[place.category]
    : categoryIcons.other;
  const categoryLabel = place.category
    ? categoryLabels[place.category]
    : "기타";

  // 체류 시간 포맷팅
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}시간 ${mins}분`;
    if (hours > 0) return `${hours}시간`;
    return `${mins}분`;
  };

  return (
    <div
      className={cn(
        "relative rounded-xl bg-zinc-900 text-white p-4 transition-all active:scale-[0.98]",
        selected && "ring-2 ring-primary",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* 드래그 핸들 */}
        {draggable && (
          <div
            {...dragHandleProps}
            className="flex items-center justify-center w-6 h-full cursor-grab active:cursor-grabbing touch-target"
          >
            <GripVertical className="h-5 w-5 text-zinc-400" />
          </div>
        )}

        {/* 순서 번호 */}
        {index !== undefined && (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-zinc-900 text-sm font-bold shrink-0">
            {index}
          </div>
        )}

        {/* 장소 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-base leading-tight line-clamp-2">
                {place.name}
              </h4>
              <p className="text-sm text-zinc-400 line-clamp-1 mt-1">
                {place.address}
              </p>
            </div>

            {/* 삭제/더보기 메뉴 */}
            {onDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* 카테고리 및 체류시간 */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {place.category && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium">
                {categoryIcon}
                {categoryLabel}
              </span>
            )}

            {!compact && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-zinc-400" />
                {onDurationChange ? (
                  <Select
                    value={place.estimatedDuration.toString()}
                    onValueChange={(value) =>
                      onDurationChange(parseInt(value))
                    }
                  >
                    <SelectTrigger
                      className="h-8 w-auto text-xs border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value.toString()}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-zinc-400 font-medium">
                    {formatDuration(place.estimatedDuration)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PlaceCardCompactProps {
  /** 장소 데이터 */
  place: Place;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 추가 버튼 표시 */
  showAddButton?: boolean;
  /** 추가 핸들러 */
  onAdd?: () => void;
  /** 추가 클래스 */
  className?: string;
}

export function PlaceCardCompact({
  place,
  onClick,
  showAddButton = false,
  onAdd,
  className,
}: PlaceCardCompactProps) {
  const categoryIcon = place.category
    ? categoryIcons[place.category]
    : categoryIcons.other;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card",
        onClick && "cursor-pointer hover:bg-accent/50",
        className
      )}
      onClick={onClick}
    >
      {/* 카테고리 아이콘 */}
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0">
        {categoryIcon}
      </div>

      {/* 장소 정보 */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate text-sm">{place.name}</h4>
        <p className="text-xs text-muted-foreground truncate">{place.address}</p>
      </div>

      {/* 추가 버튼 */}
      {showAddButton && onAdd && (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="shrink-0"
        >
          추가
        </Button>
      )}
    </div>
  );
}

interface PlaceCardSkeletonProps {
  className?: string;
}

export function PlaceCardSkeleton({ className }: PlaceCardSkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-zinc-900 p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-zinc-700 shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-zinc-700 rounded w-3/4" />
          <div className="h-4 bg-zinc-800 rounded w-1/2" />
          <div className="flex gap-2">
            <div className="h-6 bg-zinc-800 rounded-full w-16" />
            <div className="h-6 bg-zinc-800 rounded w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
