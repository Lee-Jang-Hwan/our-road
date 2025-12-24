"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { LuChevronLeft, LuPlus, LuCalendarClock } from "react-icons/lu";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FixedScheduleDialog,
  FixedScheduleCard,
} from "@/components/schedule/fixed-schedule-form";
import { useTripDraft } from "@/hooks/use-trip-draft";
import type { Place } from "@/types/place";
import type { FixedSchedule } from "@/types/schedule";
import type { CreateFixedScheduleInput } from "@/lib/schemas";

interface SchedulePageProps {
  params: Promise<{ tripId: string }>;
}

export default function SchedulePage({ params }: SchedulePageProps) {
  const { tripId } = use(params);
  const { getDraftByTripId, isLoaded } = useTripDraft();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<FixedSchedule | undefined>();
  const [schedules, setSchedules] = useState<FixedSchedule[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [tripDates, setTripDates] = useState<{ startDate: string; endDate: string }>({
    startDate: "",
    endDate: "",
  });

  // sessionStorage에서 여행 데이터 로드
  useEffect(() => {
    if (!isLoaded) return;

    const draft = getDraftByTripId(tripId);
    if (draft) {
      // 장소 목록 로드
      setPlaces(draft.places);
      // 여행 기간 로드
      setTripDates({
        startDate: draft.tripInfo.startDate,
        endDate: draft.tripInfo.endDate,
      });
    }
  }, [tripId, getDraftByTripId, isLoaded]);

  // 로딩 상태
  if (!isLoaded) {
    return (
      <main className="flex flex-col min-h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </header>
        <div className="flex-1 px-4 py-4 space-y-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </main>
    );
  }

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
          placeId: data.placeId,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          note: data.note || undefined,
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

  // 장소가 없거나 날짜가 설정되지 않은 경우
  const hasNoPlaces = places.length === 0;
  const hasNoDates = !tripDates.startDate || !tripDates.endDate;
  const canAddSchedule = !hasNoPlaces && !hasNoDates;

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
        <Button size="sm" onClick={handleAddNew} disabled={!canAddSchedule}>
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

      {/* 경고: 장소가 없는 경우 */}
      {hasNoPlaces && (
        <div className="px-4 pt-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              먼저 장소를 추가해주세요. 고정 일정은 추가된 장소에만 설정할 수 있습니다.
              <Link href={`/plan/${tripId}/places`} className="ml-1 underline text-primary">
                장소 추가하러 가기
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* 경고: 여행 기간이 없는 경우 */}
      {hasNoDates && !hasNoPlaces && (
        <div className="px-4 pt-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              여행 기간이 설정되지 않았습니다. 새 여행을 만들어주세요.
            </AlertDescription>
          </Alert>
        </div>
      )}

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
              {hasNoPlaces
                ? "먼저 장소를 추가해주세요"
                : "예약된 일정이 있다면 추가해보세요"}
            </p>
            {canAddSchedule && (
              <Button onClick={handleAddNew}>
                <LuPlus className="w-4 h-4 mr-1" />
                고정 일정 추가
              </Button>
            )}
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
