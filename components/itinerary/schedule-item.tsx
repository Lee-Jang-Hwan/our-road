"use client";

import * as React from "react";
import { Clock, Pin, MoreVertical, Edit, Trash2, GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { normalizeTime } from "@/lib/optimize";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScheduleItem as ScheduleItemType } from "@/types/schedule";

// 시간 포맷팅 (분 -> 시간분)
const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
};

interface ScheduleItemProps {
  /** 일정 항목 */
  item: ScheduleItemType;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 수정 핸들러 */
  onEdit?: () => void;
  /** 삭제 핸들러 */
  onDelete?: () => void;
  /** 드래그 가능 여부 */
  draggable?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 개별 일정 항목 컴포넌트
 * - 장소명 + 시간 + 체류시간
 * - 고정 일정 배경색 구분
 */
export function ScheduleItem({
  item,
  onClick,
  onEdit,
  onDelete,
  draggable = false,
  className,
}: ScheduleItemProps) {
  const hasActions = onEdit || onDelete;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 p-3 rounded-lg transition-colors",
        item.isFixed
          ? "bg-primary/10 border-2 border-primary/40 shadow-sm"
          : "bg-card border border-border",
        onClick && "cursor-pointer hover:bg-accent/50",
        className
      )}
      onClick={onClick}
    >
      {/* 드래그 핸들 */}
      {draggable && (
        <div className="flex items-center justify-center w-6 h-full cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      {/* 순서 번호 */}
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0",
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
          <div className="min-w-0 flex-1">
            {/* 장소명 + 고정 배지 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium truncate">{item.placeName}</span>
              {item.isFixed && (
                <Badge
                  variant="secondary"
                  className="gap-0.5 text-[10px] h-5 bg-primary/10 text-primary shrink-0"
                >
                  <Pin className="h-2.5 w-2.5" />
                  고정
                </Badge>
              )}
            </div>

            {/* 시간 정보 */}
            <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {normalizeTime(item.arrivalTime)} - {normalizeTime(item.departureTime)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground/70">
                ({formatDuration(item.duration)})
              </span>
            </div>
          </div>

          {/* 액션 메뉴 */}
          {hasActions && (
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
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    수정
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

interface ScheduleItemCompactProps {
  /** 일정 항목 */
  item: ScheduleItemType;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 컴팩트 버전의 일정 항목 (목록용)
 */
export function ScheduleItemCompact({
  item,
  onClick,
  className,
}: ScheduleItemCompactProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md",
        item.isFixed ? "bg-primary/5" : "bg-muted/50",
        onClick && "cursor-pointer hover:bg-accent/50",
        className
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0",
          item.isFixed
            ? "bg-primary text-primary-foreground"
            : "bg-muted-foreground/20 text-foreground"
        )}
      >
        {item.order}
      </span>
      <span className="flex-1 truncate text-sm">{item.placeName}</span>
      <span className="text-xs text-muted-foreground shrink-0">
        {normalizeTime(item.arrivalTime)}
      </span>
    </div>
  );
}

/**
 * 스켈레톤 로딩 UI
 */
export function ScheduleItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border">
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

interface ScheduleItemListProps {
  /** 일정 항목 배열 */
  items: ScheduleItemType[];
  /** 항목 클릭 핸들러 */
  onItemClick?: (item: ScheduleItemType) => void;
  /** 수정 핸들러 */
  onEdit?: (item: ScheduleItemType) => void;
  /** 삭제 핸들러 */
  onDelete?: (item: ScheduleItemType) => void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 빈 상태 메시지 */
  emptyMessage?: string;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 일정 항목 목록 (이동 정보 없이)
 */
export function ScheduleItemList({
  items,
  onItemClick,
  onEdit,
  onDelete,
  isLoading = false,
  emptyMessage = "일정이 없습니다",
  className,
}: ScheduleItemListProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[...Array(3)].map((_, i) => (
          <ScheduleItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 text-center",
          className
        )}
      >
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item) => (
        <ScheduleItem
          key={`${item.placeId}-${item.order}`}
          item={item}
          onClick={onItemClick ? () => onItemClick(item) : undefined}
          onEdit={onEdit ? () => onEdit(item) : undefined}
          onDelete={onDelete ? () => onDelete(item) : undefined}
        />
      ))}
    </div>
  );
}
