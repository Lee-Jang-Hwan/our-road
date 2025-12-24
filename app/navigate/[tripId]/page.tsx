"use client";

import { use, useEffect, useState, useMemo, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  LuChevronLeft,
  LuMapPin,
  LuNavigation,
  LuClock,
  LuRoute,
  LuChevronRight,
  LuChevronUp,
  LuChevronDown,
  LuLocate,
  LuExternalLink,
} from "react-icons/lu";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { KakaoMap, useKakaoMap, useMapBounds, kakao } from "@/components/map/kakao-map";
import { PlaceMarkers } from "@/components/map/place-markers";
import { DirectRoutePolyline } from "@/components/map/route-polyline";
import { CurrentLocationTracker, useCurrentLocation } from "@/components/map/current-location";

import { getTripWithDetails } from "@/actions/trips/get-trip";
import type { TripWithDetails, Coordinate } from "@/types";
import type { ScheduleItem, DailyItinerary } from "@/types/schedule";

interface NavigatePageProps {
  params: Promise<{ tripId: string }>;
}

/**
 * 거리 포맷 (미터 → km)
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
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

/**
 * 날짜 포맷 (YYYY-MM-DD → M월 D일)
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * Haversine 거리 계산 (미터)
 */
function calculateDistance(from: Coordinate, to: Coordinate): number {
  const R = 6371000; // 지구 반지름 (미터)
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 카카오맵 앱 열기 (길찾기)
 */
function openKakaoMapNavigation(
  destination: { name: string; coordinate: Coordinate },
  origin?: Coordinate
) {
  if (origin) {
    // 출발지 포함
    const url = `https://map.kakao.com/link/from/${encodeURIComponent("현재 위치")},${origin.lat},${origin.lng}/to/${encodeURIComponent(destination.name)},${destination.coordinate.lat},${destination.coordinate.lng}`;
    window.open(url, "_blank");
  } else {
    // 도착지만
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(destination.name)},${destination.coordinate.lat},${destination.coordinate.lng}`;
    window.open(url, "_blank");
  }
}

/**
 * 네이버맵 앱 열기 (길찾기)
 */
function openNaverMapNavigation(
  destination: { name: string; coordinate: Coordinate },
  origin?: Coordinate
) {
  if (origin) {
    const url = `https://map.naver.com/v5/directions/${origin.lng},${origin.lat}/${destination.coordinate.lng},${destination.coordinate.lat}/-/transit`;
    window.open(url, "_blank");
  } else {
    const url = `https://map.naver.com/v5/search/${encodeURIComponent(destination.name)}?c=${destination.coordinate.lng},${destination.coordinate.lat},15,0,0,0,dh`;
    window.open(url, "_blank");
  }
}

/**
 * 네비게이션 하단 패널
 */
function NavigationBottomPanel({
  currentItem,
  nextItem,
  currentLocation,
  onOpenKakaoMap,
  onOpenNaverMap,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  isExpanded,
  onToggleExpand,
}: {
  currentItem: ScheduleItem & { coordinate: Coordinate };
  nextItem?: ScheduleItem & { coordinate: Coordinate };
  currentLocation: Coordinate | null;
  onOpenKakaoMap: () => void;
  onOpenNaverMap: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const distanceToNext = useMemo(() => {
    if (!currentLocation || !currentItem) return null;
    return calculateDistance(currentLocation, currentItem.coordinate);
  }, [currentLocation, currentItem]);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-background border-t shadow-lg safe-area-bottom">
      {/* 확장 토글 */}
      <button
        className="w-full flex items-center justify-center py-2 border-b"
        onClick={onToggleExpand}
      >
        {isExpanded ? (
          <LuChevronDown className="w-5 h-5 text-muted-foreground" />
        ) : (
          <LuChevronUp className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      <div className="p-4 space-y-4">
        {/* 현재 목적지 정보 */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
            {currentItem.order}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg truncate">{currentItem.placeName}</h3>
              {currentItem.isFixed && (
                <Badge variant="secondary" className="shrink-0">고정</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <LuClock className="w-4 h-4" />
                {currentItem.arrivalTime} - {currentItem.departureTime}
              </span>
              {distanceToNext !== null && (
                <span className="flex items-center gap-1">
                  <LuRoute className="w-4 h-4" />
                  {formatDistance(distanceToNext)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 확장된 정보 */}
        {isExpanded && (
          <>
            {/* 다음 목적지 미리보기 */}
            {nextItem && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">다음 목적지</p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">
                    {nextItem.order}
                  </div>
                  <span className="font-medium text-sm truncate">{nextItem.placeName}</span>
                </div>
              </div>
            )}

            {/* 이동 정보 */}
            {currentItem.transportToNext && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <LuNavigation className="w-4 h-4" />
                  <span>
                    {currentItem.transportToNext.mode === "walking"
                      ? "도보"
                      : currentItem.transportToNext.mode === "car"
                      ? "자동차"
                      : "대중교통"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <LuClock className="w-4 h-4" />
                  <span>{formatDuration(currentItem.transportToNext.duration)}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <LuRoute className="w-4 h-4" />
                  <span>{formatDistance(currentItem.transportToNext.distance)}</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* 네비게이션 버튼들 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevious}
            disabled={!hasPrevious}
          >
            <LuChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={onOpenKakaoMap}
          >
            <LuExternalLink className="w-4 h-4 mr-2" />
            카카오맵
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={onOpenNaverMap}
          >
            <LuExternalLink className="w-4 h-4 mr-2" />
            네이버맵
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNext}
            disabled={!hasNext}
          >
            <LuChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 지도 내부 컴포넌트 (KakaoMapContext 내에서 사용)
 */
function NavigationMapContent({
  trip,
  currentDayItinerary,
  currentIndex,
  currentLocation,
  onMarkerClick,
  onCenterToCurrentLocation,
}: {
  trip: TripWithDetails;
  currentDayItinerary: DailyItinerary;
  currentIndex: number;
  currentLocation: Coordinate | null;
  onMarkerClick: (placeId: string) => void;
  onCenterToCurrentLocation: () => void;
}) {
  const setBounds = useMapBounds();
  const { map, isReady } = useKakaoMap();

  // 장소 ID → 좌표 맵 생성
  const placeCoordinates = useMemo(() => {
    const map = new Map<string, Coordinate>();
    trip.places.forEach((place) => {
      map.set(place.id, place.coordinate);
    });
    return map;
  }, [trip.places]);

  // 마커 데이터 생성
  const markers = useMemo(() => {
    return currentDayItinerary.schedule.map((item, index) => {
      const coordinate = placeCoordinates.get(item.placeId) || { lat: 0, lng: 0 };
      return {
        id: item.placeId,
        coordinate,
        order: index + 1,
        name: item.placeName,
        isFixed: item.isFixed,
        clickable: true,
      };
    });
  }, [currentDayItinerary.schedule, placeCoordinates]);

  // 현재 및 다음 목적지
  const currentScheduleItem = currentDayItinerary.schedule[currentIndex];
  const nextScheduleItem = currentDayItinerary.schedule[currentIndex + 1];

  const currentDestination = currentScheduleItem
    ? placeCoordinates.get(currentScheduleItem.placeId)
    : null;

  const nextDestination = nextScheduleItem
    ? placeCoordinates.get(nextScheduleItem.placeId)
    : null;

  // 경로 폴리라인 (현재 위치 → 현재 목적지 → 다음 목적지)
  const routePath = useMemo(() => {
    const path: Coordinate[] = [];

    if (currentLocation) {
      path.push(currentLocation);
    }

    if (currentDestination) {
      path.push(currentDestination);
    }

    if (nextDestination) {
      path.push(nextDestination);
    }

    return path;
  }, [currentLocation, currentDestination, nextDestination]);

  // 초기 바운드 설정
  useEffect(() => {
    if (!isReady || markers.length === 0) return;

    const coordinates = markers.map((m) => m.coordinate);
    if (currentLocation) {
      coordinates.push(currentLocation);
    }

    setBounds(coordinates, 80);
  }, [isReady, markers, currentLocation, setBounds]);

  // 현재 목적지로 지도 이동
  useEffect(() => {
    if (!map || !isReady || !currentDestination) return;

    const position = new kakao.maps.LatLng(currentDestination.lat, currentDestination.lng);
    map.panTo(position);
  }, [map, isReady, currentDestination]);

  return (
    <>
      {/* 현재 위치 마커 */}
      <CurrentLocationTracker
        enabled={true}
        showAccuracy={true}
        pulse={true}
        followLocation={false}
      />

      {/* 장소 마커들 */}
      <PlaceMarkers
        markers={markers}
        selectedId={currentScheduleItem?.placeId}
        onMarkerClick={onMarkerClick}
        size="md"
      />

      {/* 경로 폴리라인 (현재 위치 → 목적지) */}
      {routePath.length >= 2 && (
        <DirectRoutePolyline
          origin={routePath[0]}
          destination={routePath[routePath.length - 1]}
          waypoints={routePath.slice(1, -1)}
          transportMode="public"
          straight={true}
        />
      )}

      {/* 현재 위치로 이동 버튼 */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-4 right-4 z-10 shadow-lg"
        onClick={onCenterToCurrentLocation}
      >
        <LuLocate className="w-5 h-5" />
      </Button>
    </>
  );
}

export default function NavigatePage({ params }: NavigatePageProps) {
  const { tripId } = use(params);
  const { user, isLoaded } = useUser();
  const [trip, setTrip] = useState<TripWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [daySelectOpen, setDaySelectOpen] = useState(false);

  // 현재 위치 추적
  const { coordinate: currentLocation, error: locationError } = useCurrentLocation({
    enabled: true,
    enableHighAccuracy: true,
  });

  // 여행 데이터 로드
  useEffect(() => {
    async function loadTrip() {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      const result = await getTripWithDetails(tripId);

      if (result.success && result.data) {
        setTrip(result.data);

        // 오늘 날짜에 해당하는 일차 찾기
        if (result.data.itinerary && result.data.itinerary.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const todayIndex = result.data.itinerary.findIndex((it) => it.date === today);
          if (todayIndex !== -1) {
            setSelectedDayIndex(todayIndex);
          }
        }
      } else {
        setError(result.error || "여행 정보를 불러오는데 실패했습니다.");
      }

      setIsLoading(false);
    }

    if (isLoaded && user) {
      loadTrip();
    } else if (isLoaded && !user) {
      setIsLoading(false);
    }
  }, [user, isLoaded, tripId]);

  // 현재 일정
  const currentDayItinerary = useMemo(() => {
    if (!trip?.itinerary || trip.itinerary.length === 0) return null;
    return trip.itinerary[selectedDayIndex] || trip.itinerary[0];
  }, [trip?.itinerary, selectedDayIndex]);

  // 장소 ID → 좌표 맵
  const placeCoordinates = useMemo(() => {
    if (!trip) return new Map<string, Coordinate>();
    const map = new Map<string, Coordinate>();
    trip.places.forEach((place) => {
      map.set(place.id, place.coordinate);
    });
    return map;
  }, [trip]);

  // 현재 일정 항목에 좌표 추가
  const currentItemWithCoordinate = useMemo(() => {
    if (!currentDayItinerary || currentDayItinerary.schedule.length === 0) return null;
    const item = currentDayItinerary.schedule[currentIndex];
    if (!item) return null;
    const coordinate = placeCoordinates.get(item.placeId);
    if (!coordinate) return null;
    return { ...item, coordinate };
  }, [currentDayItinerary, currentIndex, placeCoordinates]);

  // 다음 일정 항목에 좌표 추가
  const nextItemWithCoordinate = useMemo(() => {
    if (!currentDayItinerary || currentIndex >= currentDayItinerary.schedule.length - 1) return undefined;
    const item = currentDayItinerary.schedule[currentIndex + 1];
    if (!item) return undefined;
    const coordinate = placeCoordinates.get(item.placeId);
    if (!coordinate) return undefined;
    return { ...item, coordinate };
  }, [currentDayItinerary, currentIndex, placeCoordinates]);

  // 마커 클릭 핸들러
  const handleMarkerClick = useCallback((placeId: string) => {
    if (!currentDayItinerary) return;
    const index = currentDayItinerary.schedule.findIndex((item) => item.placeId === placeId);
    if (index !== -1) {
      setCurrentIndex(index);
    }
  }, [currentDayItinerary]);

  // 현재 위치로 지도 이동
  const handleCenterToCurrentLocation = useCallback(() => {
    // 이 기능은 map ref를 통해 구현해야 하지만,
    // KakaoMap 컴포넌트 외부에서 직접 접근이 어려움
    // 따라서 여기서는 간단히 구현
  }, []);

  // 이전/다음 장소로 이동
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentDayItinerary && currentIndex < currentDayItinerary.schedule.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentDayItinerary, currentIndex]);

  // 카카오맵 앱 열기
  const handleOpenKakaoMap = useCallback(() => {
    if (!currentItemWithCoordinate) return;
    openKakaoMapNavigation(
      { name: currentItemWithCoordinate.placeName, coordinate: currentItemWithCoordinate.coordinate },
      currentLocation || undefined
    );
  }, [currentItemWithCoordinate, currentLocation]);

  // 네이버맵 앱 열기
  const handleOpenNaverMap = useCallback(() => {
    if (!currentItemWithCoordinate) return;
    openNaverMapNavigation(
      { name: currentItemWithCoordinate.placeName, coordinate: currentItemWithCoordinate.coordinate },
      currentLocation || undefined
    );
  }, [currentItemWithCoordinate, currentLocation]);

  // 로딩 중
  if (!isLoaded || isLoading) {
    return (
      <main className="flex flex-col h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </header>
        <div className="flex-1 bg-muted animate-pulse" />
      </main>
    );
  }

  // 미로그인 상태
  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center h-[calc(100dvh-64px)] px-4 gap-4">
        <p className="text-muted-foreground">로그인이 필요합니다</p>
        <Link href="/sign-in">
          <Button>로그인하기</Button>
        </Link>
      </main>
    );
  }

  // 에러 상태
  if (error || !trip) {
    return (
      <main className="flex flex-col h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Link href={`/my/trips/${tripId}`}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <LuChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="font-semibold text-lg">네비게이션</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <p className="text-destructive">{error || "여행 정보를 찾을 수 없습니다."}</p>
          <Link href={`/my/trips/${tripId}`}>
            <Button variant="outline">돌아가기</Button>
          </Link>
        </div>
      </main>
    );
  }

  // 일정이 없는 경우
  if (!trip.itinerary || trip.itinerary.length === 0 || !currentDayItinerary) {
    return (
      <main className="flex flex-col h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Link href={`/my/trips/${tripId}`}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <LuChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="font-semibold text-lg">{trip.title}</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <LuNavigation className="w-16 h-16 text-muted-foreground" />
          <p className="text-muted-foreground text-center">
            최적화된 일정이 없습니다.<br />
            일정을 최적화한 후 네비게이션을 시작해주세요.
          </p>
          <Link href={`/plan/${tripId}`}>
            <Button>일정 편집하기</Button>
          </Link>
        </div>
      </main>
    );
  }

  // 일정에 장소가 없는 경우
  if (currentDayItinerary.schedule.length === 0) {
    return (
      <main className="flex flex-col h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Link href={`/my/trips/${tripId}`}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <LuChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="font-semibold text-lg">{trip.title}</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <LuMapPin className="w-16 h-16 text-muted-foreground" />
          <p className="text-muted-foreground text-center">
            {selectedDayIndex + 1}일차에 일정이 없습니다.<br />
            다른 일차를 선택해주세요.
          </p>
          <Button onClick={() => setDaySelectOpen(true)}>
            일차 선택
          </Button>
        </div>
      </main>
    );
  }

  // 지도 초기 중심 좌표
  const initialCenter = currentItemWithCoordinate?.coordinate ||
    (trip.places[0]?.coordinate) ||
    { lat: 37.5665, lng: 126.978 };

  return (
    <main className="flex flex-col h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-background z-10">
        <Link href={`/my/trips/${tripId}`}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <LuChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-lg truncate">{trip.title}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDaySelectOpen(true)}
        >
          {currentDayItinerary.dayNumber}일차
          <LuChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </header>

      {/* 위치 권한 오류 표시 */}
      {locationError && (
        <div className="px-4 py-2 bg-yellow-100 text-yellow-800 text-sm">
          위치 정보: {locationError}
        </div>
      )}

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        <KakaoMap
          center={initialCenter}
          level={5}
          className="w-full h-full"
        >
          <NavigationMapContent
            trip={trip}
            currentDayItinerary={currentDayItinerary}
            currentIndex={currentIndex}
            currentLocation={currentLocation}
            onMarkerClick={handleMarkerClick}
            onCenterToCurrentLocation={handleCenterToCurrentLocation}
          />
        </KakaoMap>

        {/* 하단 네비게이션 패널 */}
        {currentItemWithCoordinate && (
          <NavigationBottomPanel
            currentItem={currentItemWithCoordinate}
            nextItem={nextItemWithCoordinate}
            currentLocation={currentLocation}
            onOpenKakaoMap={handleOpenKakaoMap}
            onOpenNaverMap={handleOpenNaverMap}
            onPrevious={handlePrevious}
            onNext={handleNext}
            hasPrevious={currentIndex > 0}
            hasNext={currentIndex < currentDayItinerary.schedule.length - 1}
            isExpanded={isPanelExpanded}
            onToggleExpand={() => setIsPanelExpanded(!isPanelExpanded)}
          />
        )}
      </div>

      {/* 일차 선택 Sheet */}
      <Sheet open={daySelectOpen} onOpenChange={setDaySelectOpen}>
        <SheetContent side="bottom" className="max-h-[60vh]">
          <SheetHeader>
            <SheetTitle>일차 선택</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-2 overflow-y-auto">
            {trip.itinerary?.map((itinerary, index) => (
              <button
                key={itinerary.dayNumber}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  index === selectedDayIndex
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                }`}
                onClick={() => {
                  setSelectedDayIndex(index);
                  setCurrentIndex(0);
                  setDaySelectOpen(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{itinerary.dayNumber}일차</p>
                    <p className={`text-sm ${index === selectedDayIndex ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {formatDate(itinerary.date)}
                    </p>
                  </div>
                  <div className={`text-sm ${index === selectedDayIndex ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {itinerary.placeCount}개 장소
                  </div>
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
