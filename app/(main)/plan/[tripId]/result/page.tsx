"use client";

import { use, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuChevronLeft, LuShare2, LuLoader, LuPencil } from "react-icons/lu";
import { AlertCircle, MapPin, Clock, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DayTabs, DayTabsContainer } from "@/components/itinerary/day-tabs";
import { DayContentPanel } from "@/components/itinerary/day-content";
import { UnassignedPlaces } from "@/components/itinerary/unassigned-places";
import { AccommodationWarning } from "@/components/trip/accommodation-warning";
import { KakaoMap } from "@/components/map/kakao-map";
import {
  PlaceMarkers,
  SingleMarker,
  type SingleMarkerProps,
} from "@/components/map/place-markers";
import { RealRoutePolyline } from "@/components/map/route-polyline";
import {
  OffScreenMarkers,
  FitBoundsButton,
} from "@/components/map/off-screen-markers";
import { useSwipe } from "@/hooks/use-swipe";
import { useSafeBack } from "@/hooks/use-safe-back";
import { optimizeRoute } from "@/actions/optimize/optimize-route";
import { saveItinerary } from "@/actions/optimize/save-itinerary";
import { getPlaces } from "@/actions/places";
import { getTrip } from "@/actions/trips/get-trip";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { getSegmentColor } from "@/lib/utils";
import type { DailyItinerary, ScheduleItem } from "@/types/schedule";
import type { Coordinate, Place } from "@/types/place";
import type { Trip } from "@/types/trip";
import type { UnassignedPlaceInfo } from "@/types/optimize";
import type { RouteSegment } from "@/types/route";

interface ResultPageProps {
  params: Promise<{ tripId: string }>;
}

export default function ResultPage({ params }: ResultPageProps) {
  const { tripId } = use(params);
  const router = useRouter();
  const handleBack = useSafeBack(`/plan/${tripId}`);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPlaces, setHasPlaces] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [itineraries, setItineraries] = useState<DailyItinerary[]>([]);
  const [unassignedPlaceInfos, setUnassignedPlaceInfos] = useState<
    UnassignedPlaceInfo[]
  >([]);
  const [selectedDay, setSelectedDay] = useState(1);

    // places를 ref로 관리하여 무한 루프 방지

  // 최적화 실행
  const runOptimization = useCallback(async () => {
    setIsOptimizing(true);
    setError(null);

    try {
      const result = await optimizeRoute({ tripId });

      if (!result.success) {
        setError(result.error?.message || "최적화에 실패했습니다.");
        setIsOptimizing(false);
        return;
      }

      if (result.data?.itinerary) {
        // 누락된 장소 확인
        const unassignedError = result.data.errors?.find(
          (e) => e.code === "EXCEEDS_DAILY_LIMIT",
        );

        if (unassignedError?.details?.unassignedPlaceDetails) {
          setUnassignedPlaceInfos(
            unassignedError.details
              .unassignedPlaceDetails as UnassignedPlaceInfo[],
          );
        } else if (unassignedError?.details?.unassignedPlaces) {
          const placeIds = unassignedError.details.unassignedPlaces as string[];
          const infos: UnassignedPlaceInfo[] = placeIds.map((placeId) => {
            const place = places.find((p) => p.id === placeId);
            return {
              placeId,
              placeName: place?.name || "알 수 없는 장소",
              reasonCode: "TIME_EXCEEDED" as const,
              reasonMessage:
                "일일 활동 시간이 부족하여 일정에 포함하지 못했습니다.",
              details: place
                ? { estimatedDuration: place.estimatedDuration }
                : undefined,
            };
          });
          setUnassignedPlaceInfos(infos);
        } else {
          setUnassignedPlaceInfos([]);
        }

        // 최적화 결과 저장
        const saveResult = await saveItinerary({
          tripId,
          itinerary: result.data.itinerary,
        });

        if (!saveResult.success) {
          showErrorToast(saveResult.error || "저장에 실패했습니다.");
        } else {
          showSuccessToast("일정이 최적화되고 저장되었습니다!");
          setItineraries(result.data.itinerary);
        }
      }
    } catch (err) {
      console.error("최적화 실패:", err);
      setError("최적화 중 오류가 발생했습니다.");
    } finally {
      setIsOptimizing(false);
    }
  }, [tripId, places]);

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
      if (
        !placesResult.success ||
        !placesResult.data ||
        placesResult.data.length < 2
      ) {
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
  const handleItemClick = (item: ScheduleItem) => {};

  // 공유
  const handleShare = async () => {
    // 공유용 URL 생성
    const shareUrl = `${window.location.origin}/share/${tripId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: trip?.title || "여행 일정",
          text: "최적화된 여행 일정을 공유합니다.",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
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
    (it) => it.dayNumber === selectedDay,
  );

  // 현재 일자의 시작점/끝점 좌표 계산 (dayOrigin/dayDestination만 사용)
  const dayEndpoints = useMemo(() => {
    if (!currentItinerary) return { origin: null, destination: null };

    const dayOrigin = currentItinerary.dayOrigin;
    const dayDestination = currentItinerary.dayDestination;

    const endpoints = {
      origin: dayOrigin
        ? { lat: dayOrigin.lat, lng: dayOrigin.lng, type: dayOrigin.type }
        : null,
      destination: dayDestination
        ? {
            lat: dayDestination.lat,
            lng: dayDestination.lng,
            type: dayDestination.type,
          }
        : null,
    };

    console.log(`[Result Page Day ${selectedDay}] dayEndpoints:`, endpoints);

    return endpoints;
  }, [currentItinerary, selectedDay]);

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
      allCoords.push({
        lat: dayEndpoints.origin.lat,
        lng: dayEndpoints.origin.lng,
      });
    }

    // 장소들 추가
    currentDayMarkers.forEach((m) => allCoords.push(m.coordinate));

    // 끝점 추가 (dayDestination 또는 trip.destination)
    if (dayEndpoints.destination) {
      allCoords.push({
        lat: dayEndpoints.destination.lat,
        lng: dayEndpoints.destination.lng,
      });
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

  // 경로 구간 배열 (dayOrigin/dayDestination 기반)
  // 각 구간별 polyline(실제 경로) 또는 직선 연결, 구간별 색상 인덱스 포함
  // 대중교통 모드: subPath별로 세분화 (도보 구간 포함)
  const routeSegments = useMemo(() => {
    if (!trip || !currentItinerary) return [];

    const segments: Array<{
      from: Coordinate;
      to: Coordinate;
      encodedPath?: string;
      path?: Coordinate[]; // passStopCoords 기반 경로
      transportMode: "walking" | "public" | "car";
      segmentIndex: number;
    }> = [];

    const isCarMode = trip.transportModes.includes("car");
    const baseTransportMode = isCarMode
      ? ("car" as const)
      : ("public" as const);

    // 일자별 시작점/끝점 좌표 (안전한 체크 포함)
    const originCoord = dayEndpoints.origin
      ? { lat: dayEndpoints.origin.lat, lng: dayEndpoints.origin.lng }
      : null;
    const destCoord = dayEndpoints.destination
      ? { lat: dayEndpoints.destination.lat, lng: dayEndpoints.destination.lng }
      : null;

    // 대중교통 subPath에서 세분화된 경로 세그먼트 추출 함수
    const extractSubPathSegments = (
      transport: RouteSegment | undefined,
      fromCoord: Coordinate,
      toCoord: Coordinate,
      segmentIndex: number,
    ) => {
      // 자동차 모드이거나 transitDetails가 없으면 기존 방식
      if (isCarMode || !transport?.transitDetails?.subPaths) {
        segments.push({
          from: fromCoord,
          to: toCoord,
          encodedPath: transport?.polyline,
          transportMode: baseTransportMode,
          segmentIndex,
        });
        return;
      }

      // 대중교통 모드: subPath별로 세분화
      const subPaths = transport.transitDetails.subPaths;

      // subPath가 없으면 전체 polyline 사용 (폴백)
      if (!subPaths || subPaths.length === 0) {
        segments.push({
          from: fromCoord,
          to: toCoord,
          encodedPath: transport?.polyline,
          transportMode: baseTransportMode,
          segmentIndex,
        });
        return;
      }

      for (const subPath of subPaths) {
        const subTransportMode = subPath.trafficType === 3 ? "walking" as const : "public" as const;

        // 시작/끝 좌표 결정 (subPath 좌표 우선, 없으면 전체 구간 좌표 사용)
        const subFrom = subPath.startCoord || fromCoord;
        const subTo = subPath.endCoord || toCoord;

        // 대중교통 구간: passStopCoords가 있으면 path로 사용
        // 도보 구간: polyline 사용 (TMap), 없으면 직선 연결
        let pathCoords: Coordinate[] | undefined;
        if (subPath.trafficType !== 3 && subPath.passStopCoords && subPath.passStopCoords.length > 0) {
          // 대중교통 구간: 시작점 + 경유 정류장 + 끝점
          pathCoords = [
            subFrom,
            ...subPath.passStopCoords,
            subTo,
          ];
        }

        segments.push({
          from: subFrom,
          to: subTo,
          encodedPath: subPath.polyline, // 도보 구간의 TMap polyline
          path: pathCoords, // 대중교통 구간의 passStopCoords 기반 경로
          transportMode: subTransportMode,
          segmentIndex,
        });
      }
    };

    // 출발지 → 첫 장소 (dayOrigin이 있고 transportFromOrigin이 있을 때만)
    if (
      originCoord &&
      currentItinerary.transportFromOrigin &&
      currentDayMarkers.length > 0
    ) {
      extractSubPathSegments(
        currentItinerary.transportFromOrigin,
        originCoord,
        currentDayMarkers[0].coordinate,
        0,
      );
    }

    // 장소들 사이
    for (let i = 0; i < currentItinerary.schedule.length - 1; i++) {
      const scheduleItem = currentItinerary.schedule[i];
      if (currentDayMarkers[i] && currentDayMarkers[i + 1]) {
        extractSubPathSegments(
          scheduleItem.transportToNext,
          currentDayMarkers[i].coordinate,
          currentDayMarkers[i + 1].coordinate,
          i + 1,
        );
      }
    }

    // 마지막 장소 → 도착지 (dayDestination이 있고 transportToDestination이 있을 때만)
    if (
      destCoord &&
      currentItinerary.transportToDestination &&
      currentDayMarkers.length > 0
    ) {
      const lastIndex = currentDayMarkers.length - 1;
      extractSubPathSegments(
        currentItinerary.transportToDestination,
        currentDayMarkers[lastIndex].coordinate,
        destCoord,
        lastIndex,
      );
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
            <Link href={`/plan/${tripId}`}>
              <Button>편집 페이지로 돌아가기</Button>
            </Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleBack}
        >
          <LuChevronLeft className="w-5 h-5" />
        </Button>
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
              <span className="truncate max-w-[100px]">
                {trip.destination.name}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground shrink-0">
              <Clock className="h-4 w-4" />
              <span>
                {trip.dailyStartTime} - {trip.dailyEndTime}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 숙소 누락 경고 */}
      {trip && currentItinerary && (
        <AccommodationWarning
          tripId={tripId}
          startDate={trip.startDate}
          endDate={trip.endDate}
          accommodations={trip.accommodations}
          lastPlaceName={
            currentItinerary.schedule.length > 0
              ? currentItinerary.schedule[currentItinerary.schedule.length - 1]
                  ?.placeName
              : undefined
          }
          className="mx-4 mt-4"
        />
      )}

      {/* 누락된 장소 경고 (호버 시 상세 이유 표시) */}
      <UnassignedPlaces places={unassignedPlaceInfos} />

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
                coordinate={{
                  lat: dayEndpoints.origin.lat,
                  lng: dayEndpoints.origin.lng,
                }}
                type={
                  (dayEndpoints.origin.type === "waypoint"
                    ? "default"
                    : dayEndpoints.origin.type) as SingleMarkerProps["type"]
                }
              />
            )}

            {/* 장소 마커들 */}
            {currentDayMarkers.length > 0 && (
              <PlaceMarkers markers={currentDayMarkers} size="md" />
            )}

            {/* 끝점 마커 (도착지 또는 숙소) */}
            {dayEndpoints.destination && (
              <SingleMarker
                coordinate={{
                  lat: dayEndpoints.destination.lat,
                  lng: dayEndpoints.destination.lng,
                }}
                type={
                  (dayEndpoints.destination.type === "waypoint"
                    ? "default"
                    : dayEndpoints.destination
                        .type) as SingleMarkerProps["type"]
                }
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
                {/* 일정 타임라인 */}
                <DayContentPanel
                  itineraries={itineraries}
                  selectedDay={selectedDay}
                  origin={trip?.origin}
                  destination={trip?.destination}
                  onItemClick={handleItemClick}
                  showNavigation={false}
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
        <Link href={`/plan/${tripId}`}>
          <Button
            variant="default"
            size="sm"
            className="bg-black text-white hover:bg-gray-900 w-full"
          >
            <LuPencil className="w-4 h-4 mr-2" />
            편집하기
          </Button>
        </Link>
      </div>
    </main>
  );
}
