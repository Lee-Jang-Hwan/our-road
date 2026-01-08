"use client";

import { use, useEffect, useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  LuChevronLeft,
  LuPencil,
  LuTrash2,
  LuShare2,
  LuLoader,
  LuMapPin,
  LuCalendar,
  LuClock,
  LuRoute,
  LuNavigation,
} from "react-icons/lu";

import { useSafeBack } from "@/hooks/use-safe-back";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { DayTabsContainer } from "@/components/itinerary/day-tabs";
import { DayContentPanel } from "@/components/itinerary/day-content";
import { DaySummary } from "@/components/itinerary/day-summary";
import { KakaoMap } from "@/components/map/kakao-map";
import { PlaceMarkers, SingleMarker } from "@/components/map/place-markers";
import { RealRoutePolyline } from "@/components/map/route-polyline";
import { OffScreenMarkers, FitBoundsButton } from "@/components/map/off-screen-markers";
import { useSwipe } from "@/hooks/use-swipe";

import { getTripWithDetails } from "@/actions/trips/get-trip";
import { deleteTrip } from "@/actions/trips/delete-trip";
import { getSegmentColor } from "@/lib/utils";
import type { TripWithDetails, TripStatus, Coordinate } from "@/types";
import type { ScheduleItem } from "@/types/schedule";
import { calculateTripDuration } from "@/types/trip";

interface TripDetailPageProps {
  params: Promise<{ tripId: string }>;
}

/**
 * 상태별 배지 스타일
 */
function getStatusBadge(status: TripStatus) {
  switch (status) {
    case "draft":
      return (
        <Badge variant="secondary" className="text-xs">
          작성 중
        </Badge>
      );
    case "optimizing":
      return (
        <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
          최적화 중
        </Badge>
      );
    case "optimized":
      return (
        <Badge variant="default" className="text-xs">
          최적화 완료
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline" className="text-xs">
          완료
        </Badge>
      );
    default:
      return null;
  }
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

export default function TripDetailPage({ params }: TripDetailPageProps) {
  const { tripId } = use(params);
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const handleBack = useSafeBack("/my");
  const [trip, setTrip] = useState<TripWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 여행 상세 로드
  useEffect(() => {
    async function loadTrip() {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      const result = await getTripWithDetails(tripId);

      if (result.success && result.data) {
        setTrip(result.data);
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

    return currentItinerary.schedule.map((item, index) => {
      const place = trip.places.find((p) => p.id === item.placeId);
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
  }, [currentItinerary, trip?.places]);

  // 맵 중심점 계산 (출발지, 장소들, 도착지 모두 포함)
  const mapCenter = useMemo<Coordinate>(() => {
    const allCoords: Coordinate[] = [];

    // 출발지 추가
    if (trip?.origin) {
      allCoords.push({ lat: trip.origin.lat, lng: trip.origin.lng });
    }

    // 장소들 추가
    currentDayMarkers.forEach((m) => allCoords.push(m.coordinate));

    // 도착지 추가
    if (trip?.destination) {
      allCoords.push({ lat: trip.destination.lat, lng: trip.destination.lng });
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
  }, [currentDayMarkers, trip?.origin, trip?.destination]);

  // 경로 구간 배열 (출발지 → 장소들 순서대로 → 도착지)
  // 각 구간별 polyline(실제 경로) 또는 직선 연결, 구간별 색상 인덱스 포함
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

    // 출발지 → 첫 장소 (첫 번째 장소 색상 사용)
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

    // 마지막 장소 → 도착지 (마지막 장소 색상 사용)
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
    // TODO: 지도에서 해당 장소 표시
  };

  // 삭제 실행
  const handleDeleteConfirm = () => {
    startTransition(async () => {
      const result = await deleteTrip(tripId);

      if (result.success) {
        router.push("/my");
      } else {
        setError(result.error || "삭제에 실패했습니다.");
        setDeleteDialogOpen(false);
      }
    });
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
      // 공유 API 미지원 시 URL 복사
      await navigator.clipboard.writeText(window.location.href);
      alert("링크가 클립보드에 복사되었습니다.");
    }
  };

  // 네비게이션 시작
  const handleStartNavigation = () => {
    router.push(`/navigate/${tripId}`);
  };

  // 로딩 중
  if (!isLoaded || isLoading) {
    return (
      <main className="flex flex-col min-h-[calc(100dvh-64px)]">
        {/* 헤더 스켈레톤 */}
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-5 w-32" />
          <div className="flex-1" />
          <Skeleton className="w-10 h-10 rounded-lg" />
        </header>

        {/* 여행 정보 스켈레톤 */}
        <div className="px-4 py-4 border-b space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* 컨텐츠 스켈레톤 */}
        <div className="flex-1 px-4 py-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    );
  }

  // 미로그인 상태
  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[calc(100dvh-64px)] px-4 gap-4">
        <p className="text-muted-foreground">로그인이 필요합니다</p>
        <Link href="/sign-in">
          <Button>로그인하기</Button>
        </Link>
      </main>
    );
  }

  // 에러 상태
  if (error && !trip) {
    return (
      <main className="flex flex-col min-h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleBack}
          >
            <LuChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-lg">여행 상세</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={handleBack}>
            목록으로 돌아가기
          </Button>
        </div>
      </main>
    );
  }

  if (!trip) {
    return null;
  }

  const duration = calculateTripDuration(trip.startDate, trip.endDate);
  const hasItinerary = trip.itinerary && trip.itinerary.length > 0;

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
        <h1 className="font-semibold text-lg flex-1 line-clamp-1">{trip.title}</h1>
        <Button variant="ghost" size="icon" onClick={handleShare}>
          <LuShare2 className="w-5 h-5" />
        </Button>
      </header>

      {/* 에러 메시지 */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 여행 정보 */}
      <section className="px-4 py-4 border-b space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-semibold text-lg">{trip.title}</h2>
          {getStatusBadge(trip.status)}
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
          {!hasItinerary && (
            <Link href={`/plan/${tripId}`}>
              <Button variant="default" size="sm" className="bg-black text-white hover:bg-gray-900">
                <LuPencil className="w-4 h-4 mr-2" />
                편집하기
              </Button>
            </Link>
          )}
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
            {/* 경로 폴리라인 (출발지 → 장소들 → 도착지) - 구간별 색상 적용 */}
            {routeSegments.length > 0 && (
              <RealRoutePolyline
                segments={routeSegments}
                strokeWeight={5}
                strokeOpacity={0.9}
                useSegmentColors={true}
              />
            )}

            {/* 출발지 마커 */}
            <SingleMarker
              coordinate={{ lat: trip.origin.lat, lng: trip.origin.lng }}
              type="origin"
            />

            {/* 장소 마커들 */}
            {currentDayMarkers.length > 0 && (
              <PlaceMarkers markers={currentDayMarkers} size="md" />
            )}

            {/* 도착지 마커 */}
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
            {/* 일일 요약 */}
            {currentItinerary && (
              <DaySummary
                itinerary={currentItinerary}
                className="mb-4"
              />
            )}

            {/* 일정 타임라인 */}
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
          <h3 className="font-semibold text-lg mb-2">최적화된 일정이 없습니다</h3>
          <p className="text-muted-foreground text-sm text-center mb-6">
            {trip.places.length > 0
              ? "장소가 추가되어 있습니다. 일정을 최적화해보세요."
              : "장소를 추가하고 일정을 최적화해보세요."}
          </p>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={() => router.push(`/plan/${tripId}`)}
          >
            <LuPencil className="w-4 h-4 mr-2" />
            편집하기
          </Button>
          {hasItinerary && (
            <Button
              className="flex-1 h-12"
              onClick={handleStartNavigation}
            >
              <LuNavigation className="w-4 h-4 mr-2" />
              네비게이션
            </Button>
          )}
          {!hasItinerary && (
            <Button
              variant="destructive"
              className="h-12"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <LuTrash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>여행 삭제</DialogTitle>
            <DialogDescription>
              &quot;{trip.title}&quot; 여행을 삭제하시겠습니까?
              <br />
              삭제된 여행은 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <LuLoader className="w-4 h-4 mr-2 animate-spin" />
                  삭제 중...
                </>
              ) : (
                "삭제"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
