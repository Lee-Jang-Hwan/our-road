"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { LuChevronLeft, LuMapPin, LuCalendarClock, LuSparkles, LuSettings } from "react-icons/lu";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTripDraft } from "@/hooks/use-trip-draft";
import { useSafeBack } from "@/hooks/use-safe-back";
import type { TripStatus } from "@/types/trip";
import type { FixedSchedule } from "@/types/schedule";
import type { Place } from "@/types/place";

interface TripEditPageProps {
  params: Promise<{ tripId: string }>;
}

export default function TripEditPage({ params }: TripEditPageProps) {
  const { tripId } = use(params);
  const { getDraftByTripId, isLoaded } = useTripDraft();
  const handleBack = useSafeBack("/my");
  const [tripData, setTripData] = useState<{
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    status: TripStatus;
    placeCount: number;
    fixedScheduleCount: number;
    fixedSchedules: FixedSchedule[];
    places: Place[];
  } | null>(null);

  // sessionStorage에서 여행 데이터 로드
  useEffect(() => {
    if (!isLoaded) return;

    const draft = getDraftByTripId(tripId);
    if (draft) {
      setTripData({
        id: tripId,
        title: draft.tripInfo.title,
        startDate: draft.tripInfo.startDate,
        endDate: draft.tripInfo.endDate,
        status: "draft",
        placeCount: draft.places.length,
        fixedScheduleCount: draft.fixedSchedules?.length || 0,
        fixedSchedules: draft.fixedSchedules || [],
        places: draft.places || [],
      });
    } else {
      // draft가 없으면 기본값 (직접 URL 접근 시)
      setTripData({
        id: tripId,
        title: "새 여행",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
        status: "draft",
        placeCount: 0,
        fixedScheduleCount: 0,
        fixedSchedules: [],
        places: [],
      });
    }
  }, [tripId, getDraftByTripId, isLoaded]);

  // 로딩 상태
  if (!isLoaded || !tripData) {
    return (
      <main className="flex flex-col min-h-[calc(100dvh-64px)]">
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </header>
        <div className="flex-1 px-4 py-6 space-y-4">
          <Skeleton className="h-4 w-48 mb-4" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </main>
    );
  }

  const trip = tripData;

  const steps = [
    {
      icon: LuMapPin,
      title: "장소 추가",
      description: "방문하고 싶은 장소들을 추가하세요",
      href: `/plan/${tripId}/places`,
      count: trip.placeCount,
      countLabel: "개 장소",
      isComplete: trip.placeCount > 0,
    },
    {
      icon: LuCalendarClock,
      title: "고정 일정 설정",
      description: "예약된 시간이 있다면 설정하세요",
      href: `/plan/${tripId}/schedule`,
      count: trip.fixedScheduleCount,
      countLabel: "개 일정",
      isComplete: false,
      isOptional: true,
    },
  ];

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleBack}
          >
            <LuChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg">{trip.title}</h1>
            <p className="text-xs text-muted-foreground">
              {trip.startDate} ~ {trip.endDate}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <LuSettings className="w-5 h-5" />
        </Button>
      </header>

      {/* 단계 카드 목록 */}
      <div className="flex-1 px-4 py-6 space-y-4">
        <p className="text-sm text-muted-foreground mb-4">
          아래 단계를 따라 여행을 계획해보세요
        </p>

        {steps.map((step, index) => {
          const Icon = step.icon;
          const isPlaceStep = step.title === "장소 추가";
          const isFixedScheduleStep = step.title === "고정 일정 설정";
          const hasPlaces = isPlaceStep && trip.places.length > 0;
          const hasFixedSchedules = isFixedScheduleStep && trip.fixedSchedules.length > 0;

          return (
            <Link
              key={step.title}
              href={step.href}
            >
              <Card
                className="transition-all hover:border-primary hover:shadow-sm"
              >
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      step.isComplete || hasFixedSchedules
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="text-sm font-semibold">{index + 1}</span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{step.title}</CardTitle>
                      {step.isOptional && (
                        <Badge variant="secondary" className="text-xs">
                          선택
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{step.description}</CardDescription>
                  </div>
                  <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                </CardHeader>

                {/* 장소 미리보기 */}
                {hasPlaces && (
                  <CardContent className="pt-0 pb-3">
                    <div className="space-y-2">
                      {trip.places.slice(0, 3).map((place, placeIndex) => (
                        <div
                          key={place.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 text-white"
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-zinc-900 text-sm font-bold shrink-0">
                            {placeIndex + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {place.name}
                            </p>
                            <p className="text-xs text-zinc-400 truncate">
                              {place.address}
                            </p>
                          </div>
                        </div>
                      ))}
                      {trip.places.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                          외 {trip.places.length - 3}개 장소
                        </p>
                      )}
                    </div>
                  </CardContent>
                )}

                {/* 고정 일정 미리보기 */}
                {hasFixedSchedules && (
                  <CardContent className="pt-0 pb-3">
                    <div className="space-y-2">
                      {trip.fixedSchedules.slice(0, 3).map((schedule) => {
                        const place = trip.places.find((p) => p.id === schedule.placeId);
                        return (
                          <div
                            key={schedule.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 text-white"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 shrink-0">
                              <Clock className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {place?.name || "알 수 없는 장소"}
                              </p>
                              <p className="text-xs text-zinc-400">
                                {format(new Date(schedule.date), "M월 d일")} {schedule.startTime}
                              </p>
                            </div>
                            <Badge className="bg-white/10 text-white text-xs border-0 shrink-0">
                              고정
                            </Badge>
                          </div>
                        );
                      })}
                      {trip.fixedSchedules.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                          외 {trip.fixedSchedules.length - 3}개 일정
                        </p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            </Link>
          );
        })}
      </div>

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
        <Link href={`/plan/${tripId}/result`}>
          <Button
            className="w-full h-12"
            disabled={trip.placeCount === 0}
          >
            <LuSparkles className="w-4 h-4 mr-2" />
            일정 최적화하기
          </Button>
        </Link>
      </div>
    </main>
  );
}
