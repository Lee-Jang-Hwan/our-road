"use client";

import * as React from "react";
import { Plus, Trash2, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlaceCard, PlaceCardSkeleton } from "./place-card";
import type { Place } from "@/types/place";

interface PlaceListProps {
  /** 장소 목록 */
  places: Place[];
  /** 체류 시간 변경 핸들러 */
  onDurationChange?: (placeId: string, duration: number) => void;
  /** 장소 삭제 핸들러 */
  onDelete?: (placeId: string) => void;
  /** 장소 클릭 핸들러 */
  onPlaceClick?: (place: Place) => void;
  /** 순서 변경 핸들러 */
  onReorder?: (placeIds: string[]) => void;
  /** 장소 추가 버튼 클릭 핸들러 */
  onAddClick?: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 빈 상태 메시지 */
  emptyMessage?: string;
  /** 드래그 앤 드롭 활성화 */
  enableDragAndDrop?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export function PlaceList({
  places,
  onDurationChange,
  onDelete,
  onPlaceClick,
  onReorder,
  onAddClick,
  isLoading = false,
  emptyMessage = "추가된 장소가 없습니다",
  enableDragAndDrop = true,
  className,
}: PlaceListProps) {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  // 드래그 시작
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  // 드래그 오버
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  // 드래그 종료
  const handleDragEnd = () => {
    if (
      draggedIndex !== null &&
      dragOverIndex !== null &&
      draggedIndex !== dragOverIndex &&
      onReorder
    ) {
      const newPlaces = [...places];
      const [removed] = newPlaces.splice(draggedIndex, 1);
      newPlaces.splice(dragOverIndex, 0, removed);
      onReorder(newPlaces.map((p) => p.id));
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 터치 드래그 지원을 위한 상태
  const [touchStartY, setTouchStartY] = React.useState<number | null>(null);
  const [touchedIndex, setTouchedIndex] = React.useState<number | null>(null);

  // 터치 시작
  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    setTouchStartY(e.touches[0].clientY);
    setTouchedIndex(index);
  };

  // 터치 이동
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null || touchedIndex === null) return;

    const currentY = e.touches[0].clientY;
    const diffY = currentY - touchStartY;

    // 임계값을 넘으면 드래그 상태로 전환
    if (Math.abs(diffY) > 20) {
      setDraggedIndex(touchedIndex);
      // 새로운 위치 계산
      const itemHeight = 80; // 대략적인 아이템 높이
      const moveCount = Math.round(diffY / itemHeight);
      const newIndex = Math.max(
        0,
        Math.min(places.length - 1, touchedIndex + moveCount)
      );
      setDragOverIndex(newIndex);
    }
  };

  // 터치 종료
  const handleTouchEnd = () => {
    handleDragEnd();
    setTouchStartY(null);
    setTouchedIndex(null);
  };

  // 스와이프 삭제를 위한 상태
  const [swipeX, setSwipeX] = React.useState<Record<string, number>>({});
  const [swipeStartX, setSwipeStartX] = React.useState<number | null>(null);
  const [swipingId, setSwipingId] = React.useState<string | null>(null);

  // 스와이프 시작
  const handleSwipeStart = (e: React.TouchEvent, placeId: string) => {
    setSwipeStartX(e.touches[0].clientX);
    setSwipingId(placeId);
  };

  // 스와이프 이동
  const handleSwipeMove = (e: React.TouchEvent) => {
    if (swipeStartX === null || swipingId === null) return;

    const currentX = e.touches[0].clientX;
    const diffX = currentX - swipeStartX;

    // 왼쪽으로만 스와이프 허용
    if (diffX < 0) {
      setSwipeX((prev) => ({
        ...prev,
        [swipingId]: Math.max(-100, diffX),
      }));
    }
  };

  // 스와이프 종료
  const handleSwipeEnd = (placeId: string) => {
    const swipeAmount = swipeX[placeId] || 0;

    // -80px 이상 스와이프하면 삭제
    if (swipeAmount < -80 && onDelete) {
      onDelete(placeId);
    }

    // 스와이프 초기화
    setSwipeX((prev) => ({ ...prev, [placeId]: 0 }));
    setSwipeStartX(null);
    setSwipingId(null);
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[...Array(3)].map((_, i) => (
          <PlaceCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // 빈 상태
  if (places.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12 px-4 text-center",
          className
        )}
      >
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <MapPin className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground mb-4">{emptyMessage}</p>
        {onAddClick && (
          <Button onClick={onAddClick} className="touch-target">
            <Plus className="mr-2 h-4 w-4" />
            장소 추가하기
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {places.map((place, index) => (
        <div
          key={place.id}
          className={cn(
            "relative transition-transform",
            draggedIndex === index && "opacity-50",
            dragOverIndex === index && "translate-y-2"
          )}
          style={{
            transform:
              swipeX[place.id] !== undefined
                ? `translateX(${swipeX[place.id]}px)`
                : undefined,
          }}
          draggable={enableDragAndDrop}
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          onTouchStart={(e) => {
            handleTouchStart(e, index);
            handleSwipeStart(e, place.id);
          }}
          onTouchMove={(e) => {
            handleTouchMove(e);
            handleSwipeMove(e);
          }}
          onTouchEnd={() => {
            handleTouchEnd();
            handleSwipeEnd(place.id);
          }}
        >
          {/* 삭제 배경 (스와이프 시 표시) */}
          {(swipeX[place.id] || 0) < -20 && (
            <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 bg-destructive rounded-lg">
              <Trash2 className="h-5 w-5 text-destructive-foreground" />
            </div>
          )}

          <PlaceCard
            place={place}
            index={index + 1}
            onDurationChange={
              onDurationChange
                ? (duration) => onDurationChange(place.id, duration)
                : undefined
            }
            onDelete={onDelete ? () => onDelete(place.id) : undefined}
            onClick={onPlaceClick ? () => onPlaceClick(place) : undefined}
            draggable={enableDragAndDrop}
          />
        </div>
      ))}

      {/* 장소 추가 버튼 */}
      {onAddClick && (
        <Button
          variant="outline"
          onClick={onAddClick}
          className="w-full touch-target border-dashed"
        >
          <Plus className="mr-2 h-4 w-4" />
          장소 추가
        </Button>
      )}
    </div>
  );
}

interface PlaceListHeaderProps {
  /** 장소 수 */
  count: number;
  /** 전체 삭제 핸들러 */
  onClearAll?: () => void;
  /** 추가 클래스 */
  className?: string;
}

export function PlaceListHeader({
  count,
  onClearAll,
  className,
}: PlaceListHeaderProps) {
  return (
    <div
      className={cn("flex items-center justify-between py-2 px-1", className)}
    >
      <span className="text-sm text-muted-foreground">
        총 <span className="font-medium text-foreground">{count}</span>개 장소
      </span>
      {onClearAll && count > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-destructive hover:text-destructive h-8"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          전체 삭제
        </Button>
      )}
    </div>
  );
}
