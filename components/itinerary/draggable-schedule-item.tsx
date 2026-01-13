/**
 * @file draggable-schedule-item.tsx
 * @description 드래그 가능한 일정 항목 컴포넌트
 *
 * 편집 모드에서 드래그 앤 드롭으로 순서를 변경할 수 있는 일정 항목입니다.
 * 기존 ScheduleItem의 기능을 확장하여 드래그 기능을 추가했습니다.
 *
 * 주요 기능:
 * 1. @dnd-kit/sortable의 useSortable 사용
 * 2. 드래그 핸들
 * 3. 삭제 버튼 (편집 모드에서만)
 * 4. 체류 시간 편집 (선택적)
 *
 * @dependencies
 * - @dnd-kit/sortable: useSortable
 * - @dnd-kit/core: useDraggable
 * - react
 * - @/components/itinerary/schedule-item: ScheduleItem (참고)
 * - @/types/schedule: ScheduleItem
 */

"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Clock, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import type { ScheduleItem } from "@/types/schedule";
import { ScheduleItem as BaseScheduleItem } from "./schedule-item";

interface DraggableScheduleItemProps {
  item: ScheduleItem;
  dayNumber: number;
  placeCount: number; // 일차별 총 장소 수 (최소 1개 확인용)
  onDelete?: () => void;
  onDurationChange?: (duration: number) => void;
  hideTime?: boolean;
}

export function DraggableScheduleItem({
  item,
  dayNumber,
  placeCount,
  onDelete,
  onDurationChange,
  hideTime = false,
}: DraggableScheduleItemProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [durationDialogOpen, setDurationDialogOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(item.duration);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `day-${dayNumber}-place-${item.placeId}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const handleDeleteClick = () => {
    // 일차별 최소 1개 장소 확인
    if (placeCount <= 1) {
      alert("일차별 최소 1개 장소는 유지해야 합니다.");
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    onDelete?.();
    setDeleteDialogOpen(false);
  };

  const handleDurationClick = () => {
    setSelectedDuration(item.duration);
    setDurationDialogOpen(true);
  };

  const handleDurationConfirm = () => {
    if (selectedDuration !== item.duration) {
      onDurationChange?.(selectedDuration);
    }
    setDurationDialogOpen(false);
  };

  // 체류 시간 옵션 생성 (30분 단위, 30~720분)
  const durationOptions = Array.from({ length: 24 }, (_, i) => {
    const minutes = (i + 1) * 30;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const label =
      hours > 0
        ? mins > 0
          ? `${hours}시간 ${mins}분`
          : `${hours}시간`
        : `${mins}분`;
    return { value: minutes, label };
  });

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group relative",
          isDragging && "z-50"
        )}
      >
        <div
          className={cn(
            "relative flex items-center gap-3 rounded-xl transition-all duration-300",
            "bg-card/80 backdrop-blur-sm border border-border/50",
            "hover:border-border hover:shadow-md hover:shadow-black/5",
            isDragging && "shadow-2xl shadow-primary/20 border-primary/50 bg-card/95 scale-[1.02]"
          )}
        >
          {/* 드래그 핸들 - hover 시에만 표시 */}
          <div
            {...attributes}
            {...listeners}
            className={cn(
              "flex items-center justify-center w-10 h-full cursor-grab active:cursor-grabbing",
              "text-muted-foreground/30 transition-all duration-200",
              "hover:text-muted-foreground/70 group-hover:opacity-100",
              "opacity-0 touch-none"
            )}
          >
            <GripVertical className="h-4 w-4" />
          </div>

          {/* 일정 항목 */}
          <div className="flex-1 py-3 pr-2">
            <BaseScheduleItem
              item={item}
              draggable={false}
              hideTime={hideTime}
              className="border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
            />
          </div>

          {/* 액션 메뉴 - hover 시에만 표시 */}
          <div className={cn(
            "flex items-center gap-1 pr-3 transition-opacity duration-200",
            "opacity-0 group-hover:opacity-100"
          )}>
            {onDurationChange && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                onClick={handleDurationClick}
                title="체류 시간 변경"
              >
                <Clock className="h-4 w-4" />
              </Button>
            )}

            {onDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    disabled={placeCount <= 1}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    disabled={placeCount <= 1}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>장소 삭제</DialogTitle>
            <DialogDescription>
              &quot;{item.placeName}&quot; 장소를 일정에서 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 체류 시간 변경 다이얼로그 */}
      <Dialog open={durationDialogOpen} onOpenChange={setDurationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>체류 시간 변경</DialogTitle>
            <DialogDescription>
              &quot;{item.placeName}&quot; 장소의 체류 시간을 변경하세요.
              <br />
              (30분 단위, 최소 30분, 최대 12시간)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedDuration.toString()}
              onValueChange={(value) => setSelectedDuration(parseInt(value, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="체류 시간 선택" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDurationDialogOpen(false)}
            >
              취소
            </Button>
            <Button onClick={handleDurationConfirm}>
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

