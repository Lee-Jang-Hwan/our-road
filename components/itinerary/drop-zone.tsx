/**
 * @file drop-zone.tsx
 * @description 드롭 존 컴포넌트
 *
 * 편집 모드에서 드래그 중일 때 드롭 가능한 위치를 시각적으로 표시하는 컴포넌트입니다.
 *
 * @dependencies
 * - react
 * - @dnd-kit/core: useDroppable
 */

"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  dayNumber: number;
  insertIndex: number;
  isActive: boolean;
}

export function DropZone({ dayNumber, insertIndex, isActive }: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayNumber}-drop-${insertIndex}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative h-1 mx-4 my-2 rounded-full transition-all duration-300",
        "before:absolute before:inset-0 before:rounded-full",
        isActive && !isOver && "before:bg-gradient-to-r before:from-transparent before:via-primary/10 before:to-transparent before:opacity-50",
        isOver && "h-2 before:bg-primary/30 before:shadow-lg before:shadow-primary/20"
      )}
    >
      {isOver && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-0.5 w-full bg-primary rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
}

