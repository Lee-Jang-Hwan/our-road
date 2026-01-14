"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  LuChevronLeft,
  LuMapPin,
  LuCalendarClock,
  LuSparkles,
  LuPencil,
  LuLoader,
} from "react-icons/lu";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTripDraft } from "@/hooks/use-trip-draft";
import { useRouter } from "next/navigation";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { getTrip } from "@/actions/trips/get-trip";
import { updateTrip } from "@/actions/trips/update-trip";
import { getPlaces } from "@/actions/places/get-places";
import { getFixedSchedules } from "@/actions/schedules/get-fixed-schedules";
import { showErrorToast } from "@/lib/toast";
import type { TripStatus } from "@/types/trip";
import type { FixedSchedule } from "@/types/schedule";
import type { Place } from "@/types/place";

interface TripEditPageProps {
  params: Promise<{ tripId: string }>;
}

export default function TripEditPage({ params }: TripEditPageProps) {
  const { tripId } = use(params);
  const router = useRouter();
  const { navigate, isNavigating, isNavigatingTo } = useSafeNavigation();
  const { getDraftByTripId, savePlaces, saveFixedSchedules, isLoaded } =
    useTripDraft();
  const handleBack = () => {
    navigate("/my");
  };
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // 초기 로드: DB에서 데이터 가져오기
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

      // DB에서 여행 정보 로드
      if (tripResult.success && tripResult.data) {
        const places =
          placesResult.success && placesResult.data ? placesResult.data : [];
        const fixedSchedules =
          schedulesResult.success && schedulesResult.data
            ? schedulesResult.data
            : [];

        // DB 데이터를 sessionStorage에 저장
        if (places.length > 0) {
          savePlaces(places);
        }
        if (fixedSchedules.length > 0) {
          saveFixedSchedules(fixedSchedules);
        }

        setTripData({
          id: tripId,
          title: tripResult.data.title,
          startDate: tripResult.data.startDate,
          endDate: tripResult.data.endDate,
          status: tripResult.data.status,
          placeCount: places.length,
          fixedScheduleCount: fixedSchedules.length,
          fixedSchedules: fixedSchedules,
          places: places,
        });
        hasDBData = true;
      }

      // DB에 데이터가 없으면 sessionStorage에서 시도
      if (!hasDBData) {
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
          // 둘 다 없으면 기본값 (직접 URL 접근 시)
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
      }

      setIsInitialized(true);
    };

    init();
  }, [
    tripId,
    getDraftByTripId,
    isLoaded,
    isInitialized,
    savePlaces,
    saveFixedSchedules,
  ]);

  // 로딩 상태
  if (!isLoaded || !tripData) {
    return (
      <main className="flex flex-col min-h-[calc(100dvh-64px)]">
        <header className="flex items-center justify-between px-4 py-1 border-b">
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

  // 최적화 버튼 클릭 핸들러
  const handleOptimizeClick = async () => {
    setIsOptimizing(true);

    try {
      // 1. 현재 Trip 상태 확인
      const tripResult = await getTrip(tripId);
      const currentStatus = tripResult.data?.status;

      // 2. draft 또는 optimizing 상태면 optimizing으로 변경
      if (currentStatus === "draft" || currentStatus === "optimizing") {
        await updateTrip(tripId, { status: "optimizing" });
      }
      // optimized 상태면 상태 변경 없이 그냥 이동

      // 3. /my/trips/[tripId]로 이동
      navigate(`/my/trips/${tripId}`);
    } catch (error) {
      console.error("최적화 버튼 처리 실패:", error);
      showErrorToast("오류가 발생했습니다.");
    } finally {
      setIsOptimizing(false);
    }
  };

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
    // TODO: 고정 일정 선택 오류 디버깅 후 다시 활성화
    // {
    //   icon: LuCalendarClock,
    //   title: "고정 일정 설정",
    //   description: "예약된 시간이 있다면 설정하세요",
    //   href: `/plan/${tripId}/schedule`,
    //   count: trip.fixedScheduleCount,
    //   countLabel: "개 일정",
    //   isComplete: false,
    //   isOptional: true,
    // },
  ];

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-1 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleBack}
            disabled={isNavigating}
          >
            <LuChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg">{trip.title}</h1>
            <p className="text-xs text-muted-foreground ">
              {trip.startDate} ~ {trip.endDate}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/plan/${tripId}/edit`)}
          disabled={isNavigating}
          className="touch-target disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isNavigatingTo(`/plan/${tripId}/edit`) ? (
            <>
              <LuLoader className="w-4 h-4 mr-2 animate-spin" />
              이동 중...
            </>
          ) : (
            <>
              <LuPencil className="w-4 h-4" />
              수정하기
            </>
          )}
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
          const hasFixedSchedules =
            isFixedScheduleStep && trip.fixedSchedules.length > 0;

          const isNavigatingToStep = isNavigatingTo(step.href);

          return (
            <div
              key={step.title}
              className="block mb-2 last:mb-0"
            >
              <Card
                onClick={() => !isNavigating && navigate(step.href)}
                className={`transition-all duration-200 hover:border-primary hover:shadow-lg hover:bg-primary/10 hover:scale-[1.02] active:scale-[0.98] active:bg-primary/20 cursor-pointer ${
                  isNavigating ? "opacity-50 cursor-not-allowed" : ""
                }`}
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
                      <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                      <CardTitle className="text-base">{step.title}</CardTitle>
                      {step.isOptional && (
                        <Badge variant="secondary" className="text-xs">
                          선택
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{step.description}</CardDescription>
                  </div>
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
                        const place = trip.places.find(
                          (p) => p.id === schedule.placeId,
                        );
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
                                {format(new Date(schedule.date), "M월 d일")}{" "}
                                {schedule.startTime}
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

                {/* 네비게이션 중 표시 */}
                {isNavigatingToStep && (
                  <CardContent className="pt-0 pb-3">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <LuLoader className="w-4 h-4 animate-spin" />
                      <span>이동 중...</span>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          );
        })}
      </div>

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 p-4 backdrop-blur-sm bg-background/80 border-t pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:static md:border-t-0 md:pt-4 md:pb-4">
        <Button
          className="w-full h-12 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={
            trip.placeCount === 0 ||
            isOptimizing ||
            isNavigating ||
            isNavigatingTo(`/my/trips/${tripId}`)
          }
          onClick={handleOptimizeClick}
        >
          {isOptimizing || isNavigatingTo(`/my/trips/${tripId}`) ? (
            <>
              <LuLoader className="w-4 h-4 mr-2 animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <LuSparkles className="w-4 h-4 mr-2" />
              일정 최적화하기
            </>
          )}
        </Button>
      </div>
    </main>
  );
}
