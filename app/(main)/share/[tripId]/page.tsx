"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  LuShare2,
  LuMapPin,
  LuCalendar,
  LuClock,
  LuRoute,
  LuExternalLink,
} from "react-icons/lu";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { DayTabsContainer } from "@/components/itinerary/day-tabs";
import { DayContentPanel } from "@/components/itinerary/day-content";
import { KakaoMap } from "@/components/map/kakao-map";
import { PlaceMarkers, SingleMarker } from "@/components/map/place-markers";
import { RealRoutePolyline } from "@/components/map/route-polyline";
import { OffScreenMarkers, FitBoundsButton } from "@/components/map/off-screen-markers";
import { useSwipe } from "@/hooks/use-swipe";

import { getSharedTrip } from "@/actions/trips/get-shared-trip";
import { getSegmentColor } from "@/lib/utils";
import type { TripWithDetails, Coordinate } from "@/types";
import type { ScheduleItem } from "@/types/schedule";
import { calculateTripDuration } from "@/types/trip";

interface SharedTripPageProps {
  params: Promise<{ tripId: string }>;
}

/**
 * 날짜 포맷 (YYYY-MM-DD → M월 D일)
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 거리 포맷 (미터 → km)
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * 시간 포맷 (분 → 시간)
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

export default function SharedTripPage({ params }: SharedTripPageProps) {
  const { tripId } = use(params);
  const [trip, setTrip] = useState<TripWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);

  // 여행 상세 로드
  useEffect(() => {
    async function loadTrip() {
      setIsLoading(true);
      setError(null);

      const result = await getSharedTrip(tripId);

      if (result.success && result.data) {
        setTrip(result.data);
      } else {
        setError(result.error || "여행 정보를 불러오는데 실패했습니다.");
      }

      setIsLoading(false);
    }

    loadTrip();
  }, [tripId]);

  // 일자 탭 데이터
  const days = useMemo(() => {
    if (!trip?.itinerary) return [];
    return trip.itinerary.map((it) => ({
      dayNumber: it.dayNumber,
      date: it.date,
    }));
  }, [trip?.itinerary]);

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

  // 현재 선택된 일정
  const currentItinerary = useMemo(() => {
    return trip?.itinerary?.find((it) => it.dayNumber === selectedDay);
  }, [trip?.itinerary, selectedDay]);

  // 현재 일자 마커 데이터 (일정 순서대로, 구간별 색상 적용)
  const currentDayMarkers = useMemo(() => {
    if (!currentItinerary || !trip?.places) return [];

    const placeCoordinates = new Map<string, Coordinate>();
    trip.places.forEach((place) => {
      placeCoordinates.set(place.id, place.coordinate);
    });

    return currentItinerary.schedule.map((item, index) => {
      const coordinate =
        placeCoordinates.get(item.placeId) ?? { lat: 37.5665, lng: 126.978 };
      return {
        id: item.placeId,
        coordinate,
        order: item.order,
        name: item.placeName,
        isFixed: item.isFixed,
        clickable: true,
        color: getSegmentColor(index),
      };
    });
  }, [currentItinerary, trip?.places]);

  // 맵 중심점 계산
  const mapCenter = useMemo<Coordinate>(() => {
    const allCoords: Coordinate[] = [];

    if (trip?.origin) {
      allCoords.push({ lat: trip.origin.lat, lng: trip.origin.lng });
    }

    currentDayMarkers.forEach((m) => allCoords.push(m.coordinate));

    if (trip?.destination) {
      allCoords.push({ lat: trip.destination.lat, lng: trip.destination.lng });
    }

    if (allCoords.length === 0) {
      return { lat: 37.5665, lng: 126.978 };
    }

    const sumLat = allCoords.reduce((sum, c) => sum + c.lat, 0);
    const sumLng = allCoords.reduce((sum, c) => sum + c.lng, 0);
    return {
      lat: sumLat / allCoords.length,
      lng: sumLng / allCoords.length,
    };
  }, [currentDayMarkers, trip?.origin, trip?.destination]);

  // 경로 구간 배열
  const routeSegments = useMemo(() => {
    if (!trip || !currentItinerary) return [];

    const segments: Array<{
      from: Coordinate;
      to: Coordinate;
      encodedPath?: string;
      transportMode: "walking" | "public" | "car";
      segmentIndex: number;
    }> = [];

    const transportMode = trip.transportModes.includes("car") ? "car" as const : "public" as const;
    const originCoord = { lat: trip.origin.lat, lng: trip.origin.lng };
    const destCoord = { lat: trip.destination.lat, lng: trip.destination.lng };

    if (currentItinerary.schedule.length > 0 && currentDayMarkers.length > 0) {
      segments.push({
        from: originCoord,
        to: currentDayMarkers[0].coordinate,
        encodedPath: currentItinerary.transportFromOrigin?.polyline,
        transportMode,
        segmentIndex: 0,
      });
    }

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
  }, [currentItinerary, currentDayMarkers, trip]);

  // 일정 항목 클릭
  const handleItemClick = (item: ScheduleItem) => {
    console.log("Item clicked:", item);
  };

  // 공유
  const handleShare = async () => {
    if (!trip) return;

    try {
      await navigator.share({
        title: trip.title,
        text: `${trip.title} - ${formatDate(trip.startDate)} ~ ${formatDate(trip.endDate)}`,
        url: window.location.href,
      });
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      alert("링크가 클립보드에 복사되었습니다.");
    }
  };

  // 로딩 중
  if (isLoading) {
    return (
      <main className="flex flex-col min-h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Skeleton className="h-5 w-32" />
          <div className="flex-1" />
          <Skeleton className="w-10 h-10 rounded-lg" />
        </header>

        <div className="px-4 py-4 border-b space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        <div className="flex-1 px-4 py-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    );
  }

  // 에러 상태
  if (error || !trip) {
    return (
      <main className="flex flex-col min-h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <h1 className="font-semibold text-lg">공유된 여행</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <LuRoute className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-foreground">
              {error || "여행을 찾을 수 없습니다"}
            </p>
            <p className="text-sm text-muted-foreground">
              링크가 올바른지 확인해주세요
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">
              <LuExternalLink className="w-4 h-4 mr-2" />
              홈으로 이동
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  const duration = calculateTripDuration(trip.startDate, trip.endDate);
  const hasItinerary = trip.itinerary && trip.itinerary.length > 0;

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <h1 className="font-semibold text-lg flex-1 line-clamp-1">{trip.title}</h1>
        <Button variant="ghost" size="icon" onClick={handleShare}>
          <LuShare2 className="w-5 h-5" />
        </Button>
      </header>

      {/* 공유 배너 */}
      <div className="px-4 py-2 bg-primary/5 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            공유된 여행 일정입니다
          </span>
          <Link href="/sign-up">
            <Button variant="link" size="sm" className="text-primary h-auto p-0">
              나도 계획하기
            </Button>
          </Link>
        </div>
      </div>

      {/* 여행 정보 */}
      <section className="px-4 py-4 border-b space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-semibold text-lg">{trip.title}</h2>
          <Badge variant="default" className="text-xs">
            공유됨
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <LuCalendar className="w-4 h-4 shrink-0" />
          <span>
            {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
          </span>
          <span className="text-xs">({duration.displayText})</span>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <LuMapPin className="w-4 h-4 shrink-0" />
            <span>장소 {trip.places.length}곳</span>
          </div>
          {hasItinerary && (
            <div className="flex items-center gap-1.5">
              <LuClock className="w-4 h-4 shrink-0" />
              <span>
                {formatDuration(
                  trip.itinerary!.reduce((acc, it) => acc + it.totalDuration, 0)
                )}
              </span>
            </div>
          )}
          {hasItinerary && (
            <div className="flex items-center gap-1.5">
              <LuRoute className="w-4 h-4 shrink-0" />
              <span>
                {formatDistance(
                  trip.itinerary!.reduce((acc, it) => acc + it.totalDistance, 0)
                )}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 카카오 맵 */}
      {hasItinerary && trip && (
        <div className="w-full h-48 border-b relative overflow-hidden">
          <KakaoMap
            center={mapCenter}
            level={7}
            className="absolute inset-0 w-full h-full"
          >
            {routeSegments.length > 0 && (
              <RealRoutePolyline
                segments={routeSegments}
                strokeWeight={5}
                strokeOpacity={0.9}
                useSegmentColors={true}
              />
            )}

            <SingleMarker
              coordinate={{ lat: trip.origin.lat, lng: trip.origin.lng }}
              type="origin"
            />

            {currentDayMarkers.length > 0 && (
              <PlaceMarkers markers={currentDayMarkers} size="md" />
            )}

            <SingleMarker
              coordinate={{ lat: trip.destination.lat, lng: trip.destination.lng }}
              type="destination"
            />

            <OffScreenMarkers markers={currentDayMarkers} />
            <FitBoundsButton markers={currentDayMarkers} />
          </KakaoMap>
        </div>
      )}

      {/* 일정 표시 */}
      {hasItinerary ? (
        <DayTabsContainer
          days={days}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          className="flex-1"
        >
          <div className="px-4 py-4" {...swipeHandlers}>
            <DayContentPanel
              itineraries={trip.itinerary!}
              selectedDay={selectedDay}
              origin={trip.origin}
              destination={trip.destination}
              onItemClick={handleItemClick}
              isLoading={false}
            />
          </div>
        </DayTabsContainer>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <LuRoute className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">일정이 없습니다</h3>
          <p className="text-muted-foreground text-sm text-center">
            이 여행에는 아직 최적화된 일정이 없습니다.
          </p>
        </div>
      )}

      {/* 하단 CTA */}
      <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
        <Link href="/sign-up" className="block">
          <Button className="w-full h-12">
            <LuRoute className="w-4 h-4 mr-2" />
            나도 여행 계획하기
          </Button>
        </Link>
      </div>
    </main>
  );
}
