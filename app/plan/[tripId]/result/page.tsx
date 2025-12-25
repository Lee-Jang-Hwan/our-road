"use client";

import { use, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LuChevronLeft,
  LuShare2,
  LuSave,
  LuLoader,
  LuSparkles,
} from "react-icons/lu";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DayTabs, DayTabsContainer } from "@/components/itinerary/day-tabs";
import { DayContentPanel } from "@/components/itinerary/day-content";
import { DaySummary } from "@/components/itinerary/day-summary";
import { KakaoMap } from "@/components/map/kakao-map";
import { PlaceMarkers } from "@/components/map/place-markers";
import { OffScreenMarkers, FitBoundsButton } from "@/components/map/off-screen-markers";
import { useSwipe } from "@/hooks/use-swipe";
import { optimizeRoute } from "@/actions/optimize/optimize-route";
import { saveItinerary } from "@/actions/optimize/save-itinerary";
import { getPlaces } from "@/actions/places";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import type { DailyItinerary, ScheduleItem } from "@/types/schedule";
import type { Coordinate, Place } from "@/types/place";

interface ResultPageProps {
  params: Promise<{ tripId: string }>;
}

export default function ResultPage({ params }: ResultPageProps) {
  const { tripId } = use(params);
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState(1);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [itineraries, setItineraries] = useState<DailyItinerary[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPlaces, setHasPlaces] = useState(true);

  // 최적화 실행
  const runOptimization = useCallback(async () => {
    setIsOptimizing(true);
    setError(null);

    try {
      const result = await optimizeRoute({ tripId });

      if (!result.success) {
        setError(result.error?.message || "최적화에 실패했습니다.");
        return;
      }

      if (result.data?.itinerary) {
        setItineraries(result.data.itinerary);
        showSuccessToast("일정이 최적화되었습니다!");
      }
    } catch (err) {
      console.error("최적화 실패:", err);
      setError("최적화 중 오류가 발생했습니다.");
    } finally {
      setIsOptimizing(false);
    }
  }, [tripId]);

  // 초기 로드 시 최적화 실행
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);

      // 먼저 장소가 있는지 확인
      const placesResult = await getPlaces(tripId);
      if (!placesResult.success || !placesResult.data || placesResult.data.length < 2) {
        setHasPlaces(false);
        setError("최소 2개 이상의 장소가 필요합니다. 장소를 추가해주세요.");
        setIsLoading(false);
        return;
      }

      setHasPlaces(true);
      setPlaces(placesResult.data);

      // 최적화 실행
      await runOptimization();
      setIsLoading(false);
    };

    init();
  }, [tripId, runOptimization]);

  // 일자 탭 데이터
  const days = itineraries.map((it) => ({
    dayNumber: it.dayNumber,
    date: it.date,
  }));

  // 스와이프로 일자 전환
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      const currentIndex = days.findIndex((d) => d.dayNumber === selectedDay);
      if (currentIndex < days.length - 1) {
        setSelectedDay(days[currentIndex + 1].dayNumber);
      }
    },
    onSwipeRight: () => {
      const currentIndex = days.findIndex((d) => d.dayNumber === selectedDay);
      if (currentIndex > 0) {
        setSelectedDay(days[currentIndex - 1].dayNumber);
      }
    },
    threshold: 50,
  });

  // 일정 항목 클릭
  const handleItemClick = (item: ScheduleItem) => {
    console.log("Item clicked:", item);
  };

  // 재최적화
  const handleReoptimize = async () => {
    await runOptimization();
  };

  // 저장
  const handleSave = async () => {
    if (itineraries.length === 0) {
      showErrorToast("저장할 일정이 없습니다.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveItinerary({
        tripId,
        itinerary: itineraries,
      });

      if (!result.success) {
        showErrorToast(result.error || "저장에 실패했습니다.");
        return;
      }

      showSuccessToast("일정이 저장되었습니다!");
      router.push("/my");
    } catch (err) {
      console.error("저장 실패:", err);
      showErrorToast("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 공유
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "여행 일정",
          text: "최적화된 여행 일정을 공유합니다.",
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showSuccessToast("링크가 클립보드에 복사되었습니다.");
      }
    } catch (err) {
      // 사용자가 공유를 취소한 경우 무시
      if ((err as Error).name !== "AbortError") {
        console.error("공유 실패:", err);
      }
    }
  };

  // 현재 선택된 일정
  const currentItinerary = itineraries.find(
    (it) => it.dayNumber === selectedDay
  );

  // 현재 일자 마커 데이터 (일정 순서대로)
  const currentDayMarkers = useMemo(() => {
    if (!currentItinerary) return [];

    return currentItinerary.schedule.map((item) => {
      const place = places.find((p) => p.id === item.placeId);
      return {
        id: item.placeId,
        coordinate: place?.coordinate || { lat: 37.5665, lng: 126.978 },
        order: item.order,
        name: item.placeName,
        isFixed: item.isFixed,
        clickable: true,
      };
    });
  }, [currentItinerary, places]);

  // 맵 중심점 계산 (현재 일자 장소들의 중심)
  const mapCenter = useMemo<Coordinate>(() => {
    if (currentDayMarkers.length === 0) {
      return { lat: 37.5665, lng: 126.978 }; // 서울 시청
    }
    const sumLat = currentDayMarkers.reduce((sum, m) => sum + m.coordinate.lat, 0);
    const sumLng = currentDayMarkers.reduce((sum, m) => sum + m.coordinate.lng, 0);
    return {
      lat: sumLat / currentDayMarkers.length,
      lng: sumLng / currentDayMarkers.length,
    };
  }, [currentDayMarkers]);

  // 로딩 상태
  if (isLoading) {
    return (
      <main className="flex flex-col min-h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </header>
        <div className="flex flex-col items-center justify-center flex-1 py-12">
          <LuLoader className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">일정 최적화 중...</p>
          <p className="text-sm text-muted-foreground/70 mt-2">
            장소 간 최적 경로를 계산하고 있습니다
          </p>
        </div>
      </main>
    );
  }

  // 에러 상태
  if (error && !isOptimizing) {
    return (
      <main className="flex flex-col min-h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Link href={`/plan/${tripId}`}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <LuChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="font-semibold text-lg flex-1">최적화 결과</h1>
        </header>
        <div className="flex flex-col items-center justify-center flex-1 px-4 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <p className="text-lg font-medium mb-2">최적화 실패</p>
          <p className="text-muted-foreground mb-6">{error}</p>
          {!hasPlaces ? (
            <Link href={`/plan/${tripId}/places`}>
              <Button>장소 추가하러 가기</Button>
            </Link>
          ) : (
            <Button onClick={handleReoptimize}>다시 시도</Button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <Link href={`/plan/${tripId}`}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <LuChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="font-semibold text-lg flex-1">최적화 결과</h1>
        <Button variant="ghost" size="icon" onClick={handleShare}>
          <LuShare2 className="w-5 h-5" />
        </Button>
      </header>

      {/* 카카오 맵 */}
      {days.length > 0 && currentDayMarkers.length > 0 && (
        <div className="w-full h-48 border-b">
          <KakaoMap
            center={mapCenter}
            level={7}
            className="w-full h-full"
          >
            <PlaceMarkers markers={currentDayMarkers} size="md" />
            <OffScreenMarkers markers={currentDayMarkers} />
            <FitBoundsButton markers={currentDayMarkers} />
          </KakaoMap>
        </div>
      )}

      {/* 일자별 탭 */}
      {days.length > 0 ? (
        <DayTabsContainer
          days={days}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          className="flex-1"
        >
          {/* 일정 내용 */}
          <div className="px-4 py-4" {...swipeHandlers}>
            {isOptimizing ? (
              <div className="flex flex-col items-center justify-center py-12">
                <LuLoader className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">일정 최적화 중...</p>
              </div>
            ) : (
              <>
                {/* 일일 요약 */}
                {currentItinerary && (
                  <DaySummary
                    itinerary={currentItinerary}
                    className="mb-4"
                  />
                )}

                {/* 일정 타임라인 */}
                <DayContentPanel
                  itineraries={itineraries}
                  selectedDay={selectedDay}
                  onItemClick={handleItemClick}
                  isLoading={false}
                />
              </>
            )}
          </div>
        </DayTabsContainer>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">일정이 없습니다</p>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={handleReoptimize}
            disabled={isOptimizing || isSaving}
          >
            {isOptimizing ? (
              <LuLoader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LuSparkles className="w-4 h-4 mr-2" />
            )}
            재최적화
          </Button>
          <Button
            className="flex-1 h-12"
            onClick={handleSave}
            disabled={isOptimizing || isSaving || itineraries.length === 0}
          >
            {isSaving ? (
              <LuLoader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LuSave className="w-4 h-4 mr-2" />
            )}
            저장하기
          </Button>
        </div>
      </div>
    </main>
  );
}
