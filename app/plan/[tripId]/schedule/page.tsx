"use client";

import { use, useState } from "react";
import Link from "next/link";
import { LuChevronLeft, LuPlus, LuCalendarClock } from "react-icons/lu";

import { Button } from "@/components/ui/button";
import {
  FixedScheduleDialog,
  FixedScheduleCard,
} from "@/components/schedule/fixed-schedule-form";
import type { Place } from "@/types/place";
import type { FixedSchedule } from "@/types/schedule";
import type { CreateFixedScheduleInput } from "@/lib/schemas";

interface SchedulePageProps {
  params: Promise<{ tripId: string }>;
}

export default function SchedulePage({ params }: SchedulePageProps) {
  const { tripId } = use(params);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<FixedSchedule | undefined>();
  const [schedules, setSchedules] = useState<FixedSchedule[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // TODO: 실제 데이터 로드
  const tripDates = {
    startDate: "2025-01-15",
    endDate: "2025-01-18",
  };

  // TODO: 실제 장소 목록 로드
  const places: Place[] = [
    {
      id: "1",
      name: "성산일출봉",
      address: "제주특별자치도 서귀포시 성산읍",
      coordinate: { lat: 33.4583, lng: 126.9425 },
      estimatedDuration: 120,
    },
    {
      id: "2",
      name: "카페 델문도",
      address: "제주특별자치도 서귀포시",
      coordinate: { lat: 33.4, lng: 126.9 },
      estimatedDuration: 60,
    },
  ];

  // 새 고정 일정 추가
  const handleAddNew = () => {
    setEditingSchedule(undefined);
    setIsDialogOpen(true);
  };

  // 고정 일정 수정
  const handleEdit = (schedule: FixedSchedule) => {
    setEditingSchedule(schedule);
    setIsDialogOpen(true);
  };

  // 폼 제출
  const handleSubmit = async (data: CreateFixedScheduleInput) => {
    setIsSubmitting(true);
    try {
      if (editingSchedule) {
        // 수정
        setSchedules((prev) =>
          prev.map((s) =>
            s.id === editingSchedule.id
              ? { ...s, ...data, updatedAt: new Date().toISOString() }
              : s
          )
        );
      } else {
        // 추가
        const newSchedule: FixedSchedule = {
          id: crypto.randomUUID(),
          tripId: data.tripId,
          placeId: data.placeId,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          note: data.note || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setSchedules((prev) => [...prev, newSchedule]);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error("일정 저장 실패:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!editingSchedule) return;
    if (!confirm("이 고정 일정을 삭제하시겠습니까?")) return;

    setSchedules((prev) => prev.filter((s) => s.id !== editingSchedule.id));
    setIsDialogOpen(false);
  };

  // 장소명 찾기
  const getPlaceName = (placeId: string) => {
    return places.find((p) => p.id === placeId)?.name || "알 수 없는 장소";
  };

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <Link href={`/plan/${tripId}`}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <LuChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="font-semibold text-lg flex-1">고정 일정 설정</h1>
        <Button size="sm" onClick={handleAddNew}>
          <LuPlus className="w-4 h-4 mr-1" />
          추가
        </Button>
      </header>

      {/* 안내 */}
      <div className="px-4 py-4 bg-muted/30 border-b">
        <p className="text-sm text-muted-foreground">
          예약된 레스토랑, 공연 등 특정 시간에 반드시 방문해야 하는 일정을
          설정하세요. 최적화 시 이 일정은 고정됩니다.
        </p>
      </div>

      {/* 고정 일정 목록 */}
      <div className="flex-1 px-4 py-4">
        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <LuCalendarClock className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-1">
              고정 일정이 없습니다
            </p>
            <p className="text-sm text-muted-foreground/70 mb-4">
              예약된 일정이 있다면 추가해보세요
            </p>
            <Button onClick={handleAddNew}>
              <LuPlus className="w-4 h-4 mr-1" />
              고정 일정 추가
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <FixedScheduleCard
                key={schedule.id}
                schedule={schedule}
                placeName={getPlaceName(schedule.placeId)}
                onClick={() => handleEdit(schedule)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
        <Link href={`/plan/${tripId}`}>
          <Button variant="outline" className="w-full h-12">
            완료
          </Button>
        </Link>
      </div>

      {/* 고정 일정 추가/수정 다이얼로그 */}
      <FixedScheduleDialog
        open={isDialogOpen}
        tripId={tripId}
        places={places}
        tripDates={tripDates}
        existingSchedule={editingSchedule}
        onSubmit={handleSubmit}
        onDelete={editingSchedule ? handleDelete : undefined}
        onCancel={() => setIsDialogOpen(false)}
        isLoading={isSubmitting}
      />
    </main>
  );
}
