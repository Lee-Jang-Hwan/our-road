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
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
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
    <Card
      className={cn(
        "relative transition-all",
        selected && "ring-2 ring-primary",
        onClick && "cursor-pointer hover:bg-accent/50",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* 드래그 핸들 */}
          {draggable && (
            <div
              {...dragHandleProps}
              className="flex items-center justify-center w-6 h-full cursor-grab active:cursor-grabbing touch-target"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {/* 순서 번호 */}
          {index !== undefined && (
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              {index}
            </div>
          )}

          {/* 장소 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-medium truncate">{place.name}</h4>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
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
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
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
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {place.category && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {categoryIcon}
                  {categoryLabel}
                </Badge>
              )}

              {!compact && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {onDurationChange ? (
                    <Select
                      value={place.estimatedDuration.toString()}
                      onValueChange={(value) =>
                        onDurationChange(parseInt(value))
                      }
                    >
                      <SelectTrigger
                        className="h-7 w-auto text-xs border-dashed"
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
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(place.estimatedDuration)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
    <Card className={cn("animate-pulse", className)}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="flex gap-2">
              <div className="h-5 bg-muted rounded w-16" />
              <div className="h-5 bg-muted rounded w-20" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
