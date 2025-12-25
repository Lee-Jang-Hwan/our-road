"use client";

import { use, useState, useEffect, useCallback } from "react";
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
import { getPlaces } from "@/actions/places";
import {
  addFixedSchedule,
  getFixedSchedules,
  updateFixedSchedule,
  deleteFixedSchedule
} from "@/actions/schedules";
import { getTrip } from "@/actions/trips";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import type { Place } from "@/types/place";
import type { FixedSchedule } from "@/types/schedule";
import type { CreateFixedScheduleInput } from "@/lib/schemas";

interface SchedulePageProps {
  params: Promise<{ tripId: string }>;
}

export default function SchedulePage({ params }: SchedulePageProps) {
  const { tripId } = use(params);
  const { getDraftByTripId, saveFixedSchedules, isLoaded } = useTripDraft();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<FixedSchedule | undefined>();
  const [schedules, setSchedules] = useState<FixedSchedule[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [tripDates, setTripDates] = useState<{ startDate: string; endDate: string }>({
    startDate: "",
    endDate: "",
  });
  const [isInitialized, setIsInitialized] = useState(false);

  // DB에서 데이터 로드
  const loadDataFromDB = useCallback(async () => {
    try {
      // 병렬로 데이터 로드
      const [tripResult, placesResult, schedulesResult] = await Promise.all([
        getTrip(tripId),
        getPlaces(tripId),
        getFixedSchedules(tripId),
      ]);

      if (tripResult.success && tripResult.data) {
        setTripDates({
          startDate: tripResult.data.startDate,
          endDate: tripResult.data.endDate,
        });
      }

      if (placesResult.success && placesResult.data) {
        setPlaces(placesResult.data);
      }

      if (schedulesResult.success && schedulesResult.data) {
        setSchedules(schedulesResult.data);
        saveFixedSchedules(schedulesResult.data);
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    }
  }, [tripId, saveFixedSchedules]);

  // 초기 로드
  useEffect(() => {
    if (!isLoaded || isInitialized) return;

    const init = async () => {
      // 먼저 DB에서 데이터 로드 시도
      const [tripResult, placesResult, schedulesResult] = await Promise.all([
        getTrip(tripId),
        getPlaces(tripId),
        getFixedSchedules(tripId),
      ]);

      let hasDBData = false;

      if (tripResult.success && tripResult.data) {
        setTripDates({
          startDate: tripResult.data.startDate,
          endDate: tripResult.data.endDate,
        });
        hasDBData = true;
      }

      if (placesResult.success && placesResult.data && placesResult.data.length > 0) {
        setPlaces(placesResult.data);
        hasDBData = true;
      }

      if (schedulesResult.success && schedulesResult.data && schedulesResult.data.length > 0) {
        setSchedules(schedulesResult.data);
        saveFixedSchedules(schedulesResult.data);
        hasDBData = true;
      }

      // DB에 데이터가 없으면 sessionStorage에서 시도
      if (!hasDBData) {
        const draft = getDraftByTripId(tripId);
        if (draft) {
          if (draft.places?.length > 0) {
            setPlaces(draft.places);
          }
          if (draft.tripInfo) {
            setTripDates({
              startDate: draft.tripInfo.startDate,
              endDate: draft.tripInfo.endDate,
            });
          }
          if (draft.fixedSchedules?.length > 0) {
            setSchedules(draft.fixedSchedules);
          }
        }
      }

      setIsInitialized(true);
    };

    init();
  }, [tripId, getDraftByTripId, isLoaded, isInitialized, saveFixedSchedules]);

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

  // 폼 제출 → DB에 저장
  const handleSubmit = async (data: CreateFixedScheduleInput) => {
    setIsSubmitting(true);
    try {
      if (editingSchedule) {
        // 수정
        const result = await updateFixedSchedule(editingSchedule.id, tripId, {
          placeId: data.placeId,
          date: data.date,
          startTime: data.startTime,
          note: data.note,
        });

        if (!result.success) {
          showErrorToast(result.error || "고정 일정 수정에 실패했습니다.");
          return;
        }

        setSchedules((prev) =>
          prev.map((s) =>
            s.id === editingSchedule.id ? result.data! : s
          )
        );
        showSuccessToast("고정 일정이 수정되었습니다.");
      } else {
        // 추가
        const result = await addFixedSchedule({
          tripId,
          placeId: data.placeId,
          date: data.date,
          startTime: data.startTime,
          note: data.note,
        });

        if (!result.success || !result.data) {
          showErrorToast(result.error || "고정 일정 추가에 실패했습니다.");
          return;
        }

        setSchedules((prev) => [...prev, result.data!]);
        showSuccessToast("고정 일정이 추가되었습니다.");
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error("일정 저장 실패:", error);
      showErrorToast("고정 일정 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 삭제 → DB에서 삭제
  const handleDelete = async () => {
    if (!editingSchedule) return;
    if (!confirm("이 고정 일정을 삭제하시겠습니까?")) return;

    setIsSubmitting(true);
    try {
      const result = await deleteFixedSchedule(editingSchedule.id, tripId);

      if (!result.success) {
        showErrorToast(result.error || "고정 일정 삭제에 실패했습니다.");
        return;
      }

      setSchedules((prev) => prev.filter((s) => s.id !== editingSchedule.id));
      setIsDialogOpen(false);
      showSuccessToast("고정 일정이 삭제되었습니다.");
    } catch (error) {
      console.error("고정 일정 삭제 실패:", error);
      showErrorToast("고정 일정 삭제에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
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
            {schedules.map((schedule) => {
              const place = places.find((p) => p.id === schedule.placeId);
              return (
                <FixedScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  placeName={place?.name || "알 수 없는 장소"}
                  duration={place?.estimatedDuration}
                  onClick={() => handleEdit(schedule)}
                />
              );
            })}
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
