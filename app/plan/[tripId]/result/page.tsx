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
import { AlertCircle, AlertTriangle, MapPin, Clock, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DayTabs, DayTabsContainer } from "@/components/itinerary/day-tabs";
import { DayContentPanel } from "@/components/itinerary/day-content";
import { DaySummary } from "@/components/itinerary/day-summary";
import { KakaoMap } from "@/components/map/kakao-map";
import { PlaceMarkers, SingleMarker } from "@/components/map/place-markers";
import { RealRoutePolyline } from "@/components/map/route-polyline";
import { OffScreenMarkers, FitBoundsButton } from "@/components/map/off-screen-markers";
import { useSwipe } from "@/hooks/use-swipe";
import { optimizeRoute } from "@/actions/optimize/optimize-route";
import { saveItinerary } from "@/actions/optimize/save-itinerary";
import { getPlaces } from "@/actions/places";
import { getTrip } from "@/actions/trips/get-trip";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { getSegmentColor } from "@/lib/utils";
import type { DailyItinerary, ScheduleItem } from "@/types/schedule";
import type { Coordinate, Place } from "@/types/place";
import type { Trip } from "@/types/trip";

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
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPlaces, setHasPlaces] = useState(true);
  const [unassignedPlaces, setUnassignedPlaces] = useState<string[]>([]);
  const [showUnassigned, setShowUnassigned] = useState(false);

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

        // 누락된 장소 확인
        const unassignedError = result.data.errors?.find(
          (e) => e.code === "EXCEEDS_DAILY_LIMIT"
        );
        if (unassignedError?.details?.unassignedPlaces) {
          setUnassignedPlaces(unassignedError.details.unassignedPlaces as string[]);
        } else {
          setUnassignedPlaces([]);
        }

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

      // trip 정보 로드
      const tripResult = await getTrip(tripId);
      if (tripResult.success && tripResult.data) {
        setTrip(tripResult.data);
      }

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

  // 누락된 장소 정보 (이름 포함)
  const unassignedPlaceInfos = useMemo(() => {
    return unassignedPlaces
      .map((placeId) => {
        const place = places.find((p) => p.id === placeId);
        return place ? { id: placeId, name: place.name } : null;
      })
      .filter((p): p is { id: string; name: string } => p !== null);
  }, [unassignedPlaces, places]);

  // 현재 일자의 시작점/끝점 좌표 계산 (dayOrigin/dayDestination 우선 사용)
  const dayEndpoints = useMemo(() => {
    if (!currentItinerary || !trip) return { origin: null, destination: null };

    const dayOrigin = currentItinerary.dayOrigin;
    const dayDestination = currentItinerary.dayDestination;

    return {
      origin: dayOrigin
        ? { lat: dayOrigin.lat, lng: dayOrigin.lng, type: dayOrigin.type }
        : { lat: trip.origin.lat, lng: trip.origin.lng, type: "origin" as const },
      destination: dayDestination
        ? { lat: dayDestination.lat, lng: dayDestination.lng, type: dayDestination.type }
        : { lat: trip.destination.lat, lng: trip.destination.lng, type: "destination" as const },
    };
  }, [currentItinerary, trip]);

  // 현재 일자 마커 데이터 (일정 순서대로, 구간별 색상 적용)
  const currentDayMarkers = useMemo(() => {
    if (!currentItinerary) return [];

    return currentItinerary.schedule.map((item, index) => {
      const place = places.find((p) => p.id === item.placeId);
      return {
        id: item.placeId,
        coordinate: place?.coordinate || { lat: 37.5665, lng: 126.978 },
        order: item.order,
        name: item.placeName,
        isFixed: item.isFixed,
        clickable: true,
        color: getSegmentColor(index), // 구간별 색상 적용
      };
    });
  }, [currentItinerary, places]);

  // 맵 중심점 계산 (일자별 시작점, 장소들, 일자별 끝점 모두 포함)
  const mapCenter = useMemo<Coordinate>(() => {
    const allCoords: Coordinate[] = [];

    // 시작점 추가 (dayOrigin 또는 trip.origin)
    if (dayEndpoints.origin) {
      allCoords.push({ lat: dayEndpoints.origin.lat, lng: dayEndpoints.origin.lng });
    }

    // 장소들 추가
    currentDayMarkers.forEach((m) => allCoords.push(m.coordinate));

    // 끝점 추가 (dayDestination 또는 trip.destination)
    if (dayEndpoints.destination) {
      allCoords.push({ lat: dayEndpoints.destination.lat, lng: dayEndpoints.destination.lng });
    }

    if (allCoords.length === 0) {
      return { lat: 37.5665, lng: 126.978 }; // 서울 시청
    }

    const sumLat = allCoords.reduce((sum, c) => sum + c.lat, 0);
    const sumLng = allCoords.reduce((sum, c) => sum + c.lng, 0);
    return {
      lat: sumLat / allCoords.length,
      lng: sumLng / allCoords.length,
    };
  }, [currentDayMarkers, dayEndpoints]);

  // 경로 구간 배열 (시작점 → 장소들 순서대로 → 끝점)
  // 각 구간별 polyline(실제 경로) 또는 직선 연결, 구간별 색상 인덱스 포함
  const routeSegments = useMemo(() => {
    if (!trip || !currentItinerary || !dayEndpoints.origin || !dayEndpoints.destination) return [];

    const segments: Array<{
      from: Coordinate;
      to: Coordinate;
      encodedPath?: string;
      transportMode: "walking" | "public" | "car";
      segmentIndex: number;
    }> = [];

    const transportMode = trip.transportModes.includes("car") ? "car" as const : "public" as const;
    // 일자별 시작점/끝점 사용 (dayOrigin/dayDestination)
    const originCoord = { lat: dayEndpoints.origin.lat, lng: dayEndpoints.origin.lng };
    const destCoord = { lat: dayEndpoints.destination.lat, lng: dayEndpoints.destination.lng };

    // 시작점 → 첫 장소 (첫 번째 장소 색상 사용)
    if (currentItinerary.schedule.length > 0 && currentDayMarkers.length > 0) {
      segments.push({
        from: originCoord,
        to: currentDayMarkers[0].coordinate,
        encodedPath: currentItinerary.transportFromOrigin?.polyline,
        transportMode,
        segmentIndex: 0,
      });
    }

    // 장소들 사이 (도착 장소의 색상 사용)
    for (let i = 0; i < currentItinerary.schedule.length - 1; i++) {
      const scheduleItem = currentItinerary.schedule[i];
      if (currentDayMarkers[i] && currentDayMarkers[i + 1]) {
        segments.push({
          from: currentDayMarkers[i].coordinate,
          to: currentDayMarkers[i + 1].coordinate,
          encodedPath: scheduleItem.transportToNext?.polyline,
          transportMode,
          segmentIndex: i + 1,
        });
      }
    }

    // 마지막 장소 → 끝점 (마지막 장소 색상 사용)
    if (currentItinerary.schedule.length > 0 && currentDayMarkers.length > 0) {
      const lastIndex = currentDayMarkers.length - 1;
      segments.push({
        from: currentDayMarkers[lastIndex].coordinate,
        to: destCoord,
        encodedPath: currentItinerary.transportToDestination?.polyline,
        transportMode,
        segmentIndex: lastIndex,
      });
    }

    return segments;
  }, [currentItinerary, currentDayMarkers, trip, dayEndpoints]);

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

      {/* 여행 정보 요약 */}
      {trip && (
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate max-w-[100px]">{trip.origin.name}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
              <span className="truncate max-w-[100px]">{trip.destination.name}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground shrink-0">
              <Clock className="h-4 w-4" />
              <span>{trip.dailyStartTime} - {trip.dailyEndTime}</span>
            </div>
          </div>
        </div>
      )}

      {/* 누락된 장소 경고 */}
      {unassignedPlaceInfos.length > 0 && (
        <div className="px-4 py-3 border-b bg-amber-50 dark:bg-amber-950/30">
          <button
            type="button"
            className="w-full flex items-center justify-between text-left"
            onClick={() => setShowUnassigned(!showUnassigned)}
          >
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">
                {unassignedPlaceInfos.length}개 장소가 일정에 포함되지 못했습니다
              </span>
            </div>
            {showUnassigned ? (
              <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            )}
          </button>
          {showUnassigned && (
            <div className="mt-2 pl-6 space-y-1">
              <p className="text-xs text-amber-600 dark:text-amber-500 mb-2">
                일일 활동 시간 내에 모든 장소를 배치할 수 없어 다음 장소들이 제외되었습니다.
                여행 기간을 늘리거나 장소 수를 줄여보세요.
              </p>
              {unassignedPlaceInfos.map((place) => (
                <div
                  key={place.id}
                  className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400"
                >
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{place.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 카카오 맵 */}
      {days.length > 0 && trip && (
        <div className="w-full h-48 border-b relative overflow-hidden">
          <KakaoMap
            center={mapCenter}
            level={7}
            className="absolute inset-0 w-full h-full"
          >
            {/* 경로 폴리라인 (출발지 → 장소들 → 도착지) - 구간별 색상 적용 */}
            {routeSegments.length > 0 && (
              <RealRoutePolyline
                segments={routeSegments}
                strokeWeight={5}
                strokeOpacity={0.9}
                useSegmentColors={true}
              />
            )}

            {/* 시작점 마커 (출발지, 숙소, 또는 전날 마지막 장소) */}
            {dayEndpoints.origin && (
              <SingleMarker
                coordinate={{ lat: dayEndpoints.origin.lat, lng: dayEndpoints.origin.lng }}
                type={dayEndpoints.origin.type}
              />
            )}

            {/* 장소 마커들 */}
            {currentDayMarkers.length > 0 && (
              <PlaceMarkers markers={currentDayMarkers} size="md" />
            )}

            {/* 끝점 마커 (도착지 또는 숙소) */}
            {dayEndpoints.destination && (
              <SingleMarker
                coordinate={{ lat: dayEndpoints.destination.lat, lng: dayEndpoints.destination.lng }}
                type={dayEndpoints.destination.type}
              />
            )}

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
                  origin={trip?.origin}
                  destination={trip?.destination}
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
