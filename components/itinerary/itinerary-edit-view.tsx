/**
 * @file itinerary-edit-view.tsx
 * @description 편집 모드 전용 일정 뷰 컴포넌트
 *
 * 편집 모드에서 모든 일차의 일정을 세로로 나열하여 드래그 앤 드롭으로
 * 순서를 변경할 수 있게 하는 컴포넌트입니다.
 *
 * 주요 기능:
 * 1. 모든 일차를 세로로 나열
 * 2. 스크롤 가능한 영역
 * 3. 드래그 앤 드롭 지원
 * 4. 일차 간 이동 지원
 *
 * 구조:
 * - DndContext (최상위)
 *   - DayHeader (드래그 불가)
 *   - DraggableScheduleItem들
 *   - DropZone들
 *
 * @dependencies
 * - @dnd-kit/core: DndContext
 * - @dnd-kit/sortable: SortableContext
 * - react
 * - @/components/itinerary/day-header: DayHeader
 * - @/components/itinerary/draggable-schedule-item: DraggableScheduleItem
 * - @/components/itinerary/drop-zone: DropZone
 *
 * @see {@link .cursor/design/itinerary-edit-mode.md} - 설계 문서
 */

"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { DailyItinerary, ScheduleItem } from "@/types/schedule";
import { DayHeader } from "./day-header";
import { DraggableScheduleItem } from "./draggable-schedule-item";
import { DropZone } from "./drop-zone";

interface ItineraryEditViewProps {
  itineraries: DailyItinerary[];
  onReorder: (dayNumber: number, newOrder: string[]) => void;
  onMove: (
    fromDay: number,
    toDay: number,
    placeId: string,
    toIndex: number,
  ) => void;
  onDelete: (dayNumber: number, placeId: string) => void;
  onDurationChange?: (dayNumber: number, placeId: string, duration: number) => void;
}

export function ItineraryEditView({
  itineraries,
  onReorder,
  onMove,
  onDelete,
  onDurationChange,
}: ItineraryEditViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // 모든 드래그 가능한 항목 ID 수집
  const allItemIds = itineraries.flatMap((itinerary) =>
    itinerary.schedule.map(
      (item) => `day-${itinerary.dayNumber}-place-${item.placeId}`,
    ),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);

    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // 드래그 항목 ID 파싱
    const activeIdStr = active.id as string;
    const activeMatch = activeIdStr.match(/^day-(\d+)-place-(.+)$/);
    if (!activeMatch) return;

    const [, fromDayStr, placeId] = activeMatch;
    const fromDay = parseInt(fromDayStr, 10);

    // 드롭 위치 파싱
    const overIdStr = over.id as string;

    // 같은 일차 내 이동인지 확인
    if (overIdStr.startsWith(`day-${fromDay}-place-`)) {
      // 같은 일차 내 순서 변경
      const overMatch = overIdStr.match(/^day-(\d+)-place-(.+)$/);
      if (!overMatch) return;

      const [, , overPlaceId] = overMatch;
      const fromItinerary = itineraries.find((it) => it.dayNumber === fromDay);
      if (!fromItinerary) return;

      const currentOrder = fromItinerary.schedule.map((item) => item.placeId);
      const fromIndex = currentOrder.indexOf(placeId);
      const toIndex = currentOrder.indexOf(overPlaceId);

      if (fromIndex === -1 || toIndex === -1) return;

      // 순서 변경
      const newOrder = [...currentOrder];
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, placeId);

      onReorder(fromDay, newOrder);
    } else if (overIdStr.startsWith(`day-`) && overIdStr.includes("-drop-")) {
      // 다른 일차로 이동
      const dropMatch = overIdStr.match(/^day-(\d+)-drop-(\d+)$/);
      if (!dropMatch) return;

      const [, toDayStr, toIndexStr] = dropMatch;
      const toDay = parseInt(toDayStr, 10);
      const toIndex = parseInt(toIndexStr, 10);

      onMove(fromDay, toDay, placeId, toIndex);
    } else if (overIdStr.startsWith(`day-`) && overIdStr.includes("-place-")) {
      // 다른 일차의 특정 장소 앞/뒤로 이동
      const overMatch = overIdStr.match(/^day-(\d+)-place-(.+)$/);
      if (!overMatch) return;

      const [, toDayStr] = overMatch;
      const toDay = parseInt(toDayStr, 10);

      const toItinerary = itineraries.find((it) => it.dayNumber === toDay);
      if (!toItinerary) return;

      const toIndex = toItinerary.schedule.findIndex(
        (item) => `day-${toDay}-place-${item.placeId}` === overIdStr,
      );

      onMove(fromDay, toDay, placeId, toIndex >= 0 ? toIndex : toItinerary.schedule.length);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-8 pb-20">
        {itineraries.map((itinerary) => (
          <div key={itinerary.dayNumber} className="space-y-1">
            {/* 일차 헤더 */}
            <DayHeader
              dayNumber={itinerary.dayNumber}
              date={itinerary.date}
              placeCount={itinerary.placeCount}
            />

            {/* 드롭 존 (일차 헤더 아래) */}
            <DropZone
              dayNumber={itinerary.dayNumber}
              insertIndex={0}
              isActive={activeId !== null}
            />

            {/* 일정 항목들 */}
            <SortableContext
              items={itinerary.schedule.map(
                (item) => `day-${itinerary.dayNumber}-place-${item.placeId}`,
              )}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1 px-4">
                {itinerary.schedule.map((item, index) => (
                  <div key={`${item.placeId}-${item.order}`} className="space-y-1">
                    <DraggableScheduleItem
                      item={item}
                      dayNumber={itinerary.dayNumber}
                      placeCount={itinerary.schedule.length}
                      onDelete={() => onDelete(itinerary.dayNumber, item.placeId)}
                      onDurationChange={
                        onDurationChange
                          ? (duration) =>
                              onDurationChange(
                                itinerary.dayNumber,
                                item.placeId,
                                duration
                              )
                          : undefined
                      }
                    />
                    {/* 장소 사이 드롭 존 */}
                    {index < itinerary.schedule.length - 1 && (
                      <DropZone
                        dayNumber={itinerary.dayNumber}
                        insertIndex={index + 1}
                        isActive={activeId !== null}
                      />
                    )}
                  </div>
                ))}
              </div>
            </SortableContext>
          </div>
        ))}
      </div>
    </DndContext>
  );
}

