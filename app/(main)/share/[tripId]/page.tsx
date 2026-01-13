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
import { DraggableBottomSheet } from "@/components/itinerary/draggable-bottom-sheet";
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
  // 선택된 장소의 좌표 (맵 이동용)
  const [selectedPlaceCenter, setSelectedPlaceCenter] =
    useState<Coordinate | null>(null);

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

  // 일자 변경 시 선택된 장소 좌표 초기화
  useEffect(() => {
    setSelectedPlaceCenter(null);
  }, [selectedDay]);

  // 현재 일자의 시작점/끝점 좌표 계산 (dayOrigin/dayDestination + 레거시 데이터 fallback)
  const dayEndpoints = useMemo(() => {
    if (!currentItinerary || !trip) return { origin: null, destination: null };

    const isFirstDay = selectedDay === 1;
    const isLastDay = selectedDay === (trip.itinerary?.length || 0);
    const lodgingLocation = trip.accommodations?.[0]?.location;
    const hasLodging =
      !!lodgingLocation &&
      typeof lodgingLocation.lat === "number" &&
      typeof lodgingLocation.lng === "number";

    // 신규 데이터: dayOrigin/dayDestination 사용
    let dayOrigin = currentItinerary.dayOrigin;
    let dayDestination = currentItinerary.dayDestination;

    // 레거시 데이터 fallback: dayOrigin/dayDestination이 없으면 계산
    if (
      !dayOrigin &&
      isFirstDay &&
      trip.origin &&
      typeof trip.origin.lat === "number"
    ) {
      // Day 1: 전체 출발지 사용
      dayOrigin = {
        type: "origin" as const,
        name: trip.origin.name,
        address: trip.origin.address,
        lat: trip.origin.lat,
        lng: trip.origin.lng,
      };
    } else if (!dayOrigin && !isFirstDay && hasLodging && lodgingLocation) {
      // Day 2+, 숙소 있음: 숙소 사용
      dayOrigin = {
        type: "accommodation" as const,
        name: lodgingLocation.name,
        address: lodgingLocation.address,
        lat: lodgingLocation.lat,
        lng: lodgingLocation.lng,
      };
    } else if (!dayOrigin && !isFirstDay && !hasLodging) {
      // Day 2+, 숙소 없음: 전날 마지막 장소 사용
      const prevDay = trip.itinerary?.find(
        (it) => it.dayNumber === selectedDay - 1,
      );
      if (prevDay && prevDay.schedule.length > 0) {
        const lastSchedule = prevDay.schedule[prevDay.schedule.length - 1];
        const lastPlace = trip.places?.find(
          (p) => p.id === lastSchedule.placeId,
        );
        const legacyCoord = lastPlace as unknown as
          | { lat?: number; lng?: number }
          | undefined;
        const lastCoord =
          lastPlace?.coordinate ??
          (legacyCoord &&
          typeof legacyCoord.lat === "number" &&
          typeof legacyCoord.lng === "number"
            ? { lat: legacyCoord.lat, lng: legacyCoord.lng }
            : undefined);
        if (lastCoord && typeof lastCoord.lat === "number") {
          dayOrigin = {
            type: "lastPlace" as const,
            name: lastPlace?.name || "이전 장소",
            address: lastPlace?.address || "",
            lat: lastCoord.lat,
            lng: lastCoord.lng,
          };
        }
      }
    }

    if (
      !dayDestination &&
      isLastDay &&
      !hasLodging &&
      trip.destination &&
      typeof trip.destination.lat === "number"
    ) {
      // 마지막 날, 숙소 없음: 전체 도착지 사용
      dayDestination = {
        type: "destination" as const,
        name: trip.destination.name,
        address: trip.destination.address,
        lat: trip.destination.lat,
        lng: trip.destination.lng,
      };
    } else if (!dayDestination && hasLodging && lodgingLocation) {
      // 숙소 있음: 모든 날의 종점은 숙소
      dayDestination = {
        type: "accommodation" as const,
        name: lodgingLocation.name,
        address: lodgingLocation.address,
        lat: lodgingLocation.lat,
        lng: lodgingLocation.lng,
      };
    }

    return {
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
  }, [currentItinerary, selectedDay, trip]);

  // fallback이 적용된 itinerary (타임라인 표시용)
  const enrichedItinerary = useMemo(() => {
    if (!currentItinerary) return null;

    const lodgingLocation = trip?.accommodations?.[0]?.location;

    // dayOrigin/dayDestination이 이미 완전히 있으면 그대로 반환
    const hasCompleteOrigin = currentItinerary.dayOrigin;
    const hasCompleteDestination = currentItinerary.dayDestination;

    // 둘 다 완전히 있으면 fallback 불필요
    if (hasCompleteOrigin && hasCompleteDestination) {
      return currentItinerary;
    }

    // fallback으로 계산된 값 주입 (없는 것만)
    return {
      ...currentItinerary,
      dayOrigin: hasCompleteOrigin
        ? currentItinerary.dayOrigin
        : dayEndpoints.origin
          ? {
              type: dayEndpoints.origin.type,
              name:
                dayEndpoints.origin.type === "origin"
                  ? trip?.origin?.name || "출발지"
                  : dayEndpoints.origin.type === "accommodation"
                    ? lodgingLocation?.name || "숙소"
                    : dayEndpoints.origin.type === "destination"
                      ? trip?.destination?.name || "도착지"
                      : dayEndpoints.origin.type === "lastPlace"
                        ? "이전 장소"
                        : "시작",
              address:
                dayEndpoints.origin.type === "origin"
                  ? trip?.origin?.address || ""
                  : dayEndpoints.origin.type === "accommodation"
                    ? lodgingLocation?.address || ""
                    : dayEndpoints.origin.type === "destination"
                      ? trip?.destination?.address || ""
                      : "",
              lat: dayEndpoints.origin.lat,
              lng: dayEndpoints.origin.lng,
            }
          : undefined,
      dayDestination: hasCompleteDestination
        ? currentItinerary.dayDestination
        : dayEndpoints.destination
          ? {
              type: dayEndpoints.destination.type,
              name:
                dayEndpoints.destination.type === "origin"
                  ? trip?.origin?.name || "출발지"
                  : dayEndpoints.destination.type === "accommodation"
                    ? lodgingLocation?.name || "숙소"
                    : dayEndpoints.destination.type === "destination"
                      ? trip?.destination?.name || "도착지"
                      : "종점",
              address:
                dayEndpoints.destination.type === "origin"
                  ? trip?.origin?.address || ""
                  : dayEndpoints.destination.type === "accommodation"
                    ? lodgingLocation?.address || ""
                    : dayEndpoints.destination.type === "destination"
                      ? trip?.destination?.address || ""
                      : "",
              lat: dayEndpoints.destination.lat,
              lng: dayEndpoints.destination.lng,
            }
          : undefined,
    };
  }, [currentItinerary, dayEndpoints, trip]);

  // enrichedItinerary를 포함한 전체 itineraries 배열
  const enrichedItineraries = useMemo(() => {
    if (!trip?.itinerary) return [];

    return trip.itinerary.map((it) => {
      if (it.dayNumber !== selectedDay) return it;
      return enrichedItinerary || it;
    });
  }, [trip?.itinerary, selectedDay, enrichedItinerary]);

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
        color: getSegmentColor(index), // 구간별 색상 적용
      };
    });
  }, [currentItinerary, trip?.places]);

  // 맵 중심점 계산 (일자별 시작점, 장소들, 일자별 끝점 모두 포함)
  const mapCenter = useMemo<Coordinate>(() => {
    const allCoords: Coordinate[] = [];

    // 시작점 추가 (dayOrigin)
    if (dayEndpoints.origin) {
      allCoords.push({
        lat: dayEndpoints.origin.lat,
        lng: dayEndpoints.origin.lng,
      });
    }

    // 장소들 추가
    currentDayMarkers.forEach((m) => allCoords.push(m.coordinate));

    // 끝점 추가 (dayDestination)
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
  const routeSegments = useMemo(() => {
    if (!trip || !currentItinerary) return [];

    const segments: Array<{
      from: Coordinate;
      to: Coordinate;
      encodedPath?: string;
      path?: Coordinate[];
      transportMode: "walking" | "public" | "car";
      segmentIndex: number;
      isToAccommodation?: boolean;
      isFromAccommodation?: boolean;
      isToDestination?: boolean;
    }> = [];

    const isCarMode = trip.transportModes.includes("car");
    const baseTransportMode = isCarMode
      ? ("car" as const)
      : ("public" as const);

    // 숙소 위치 확인
    const lodgingLocation = trip.accommodations?.[0]?.location;
    const isAccommodationCoord = (coord: Coordinate) => {
      if (!lodgingLocation) return false;
      return (
        Math.abs(coord.lat - lodgingLocation.lat) < 0.0001 &&
        Math.abs(coord.lng - lodgingLocation.lng) < 0.0001
      );
    };

    // 출발지 → 첫 장소 (subPaths 분리)
    if (
      currentItinerary.dayOrigin &&
      currentItinerary.transportFromOrigin &&
      currentDayMarkers.length > 0
    ) {
      const transport = currentItinerary.transportFromOrigin;
      const fromCoord = {
        lat: currentItinerary.dayOrigin.lat,
        lng: currentItinerary.dayOrigin.lng,
      };
      const toCoord = currentDayMarkers[0].coordinate;
      const isFromAccommodation = isAccommodationCoord(fromCoord);

      // subPaths가 있으면 분리, 없으면 전체 경로 사용
      if (
        transport.transitDetails?.subPaths &&
        transport.transitDetails.subPaths.length > 0
      ) {
        const subPaths = transport.transitDetails.subPaths;
        for (const subPath of subPaths) {
          const subTransportMode =
            subPath.trafficType === 3
              ? ("walking" as const)
              : baseTransportMode;
          const subFrom = subPath.startCoord || fromCoord;
          const subTo = subPath.endCoord || toCoord;

          segments.push({
            from: subFrom,
            to: subTo,
            encodedPath:
              subPath.trafficType === 3
                ? subPath.polyline
                : subPath.polyline || transport.polyline,
            transportMode: subTransportMode,
            segmentIndex: 0,
            isFromAccommodation,
          });
        }
      } else {
        // subPaths가 없으면 전체 경로 사용 (레거시)
        segments.push({
          from: fromCoord,
          to: toCoord,
          encodedPath: transport.polyline,
          transportMode: baseTransportMode,
          segmentIndex: 0,
          isFromAccommodation,
        });
      }
    }

    // 장소들 사이 (subPaths 분리)
    for (let i = 0; i < currentItinerary.schedule.length - 1; i++) {
      const scheduleItem = currentItinerary.schedule[i];
      if (currentDayMarkers[i] && currentDayMarkers[i + 1]) {
        const transport = scheduleItem.transportToNext;
        if (!transport) continue;

        const fromCoord = currentDayMarkers[i].coordinate;
        const toCoord = currentDayMarkers[i + 1].coordinate;

        // subPaths가 있으면 분리, 없으면 전체 경로 사용
        if (
          transport.transitDetails?.subPaths &&
          transport.transitDetails.subPaths.length > 0
        ) {
          const subPaths = transport.transitDetails.subPaths;
          for (const subPath of subPaths) {
            const subTransportMode =
              subPath.trafficType === 3
                ? ("walking" as const)
                : baseTransportMode;
            const subFrom = subPath.startCoord || fromCoord;
            const subTo = subPath.endCoord || toCoord;

            // 대중교통 구간: passStopCoords가 있으면 path로 사용
            let pathCoords: Coordinate[] | undefined;
            if (
              subPath.trafficType !== 3 &&
              subPath.passStopCoords &&
              subPath.passStopCoords.length > 0
            ) {
              pathCoords = [subFrom, ...subPath.passStopCoords, subTo];
            }

            segments.push({
              from: subFrom,
              to: subTo,
              encodedPath:
                subPath.trafficType === 3
                  ? subPath.polyline
                  : subPath.polyline || transport.polyline,
              path: pathCoords,
              transportMode: subTransportMode,
              segmentIndex: i + 1,
              isFromAccommodation: isAccommodationCoord(subFrom),
              isToAccommodation: isAccommodationCoord(subTo),
            });
          }
        } else {
          // subPaths가 없으면 전체 경로 사용 (레거시)
          segments.push({
            from: fromCoord,
            to: toCoord,
            encodedPath: transport.polyline,
            transportMode: baseTransportMode,
            segmentIndex: i + 1,
            isFromAccommodation: isAccommodationCoord(fromCoord),
            isToAccommodation: isAccommodationCoord(toCoord),
          });
        }
      }
    }

    // 마지막 장소 → 도착지 (subPaths 분리)
    if (
      currentItinerary.dayDestination &&
      currentItinerary.transportToDestination &&
      currentDayMarkers.length > 0
    ) {
      const transport = currentItinerary.transportToDestination;
      const lastIndex = currentDayMarkers.length - 1;
      const fromCoord = currentDayMarkers[lastIndex].coordinate;
      const toCoord = {
        lat: currentItinerary.dayDestination.lat,
        lng: currentItinerary.dayDestination.lng,
      };
      const isToAccommodation = isAccommodationCoord(toCoord);
      const isToDestination =
        !isToAccommodation &&
        currentItinerary.dayDestination.type === "destination";

      // subPaths가 있으면 분리, 없으면 전체 경로 사용
      if (
        transport.transitDetails?.subPaths &&
        transport.transitDetails.subPaths.length > 0
      ) {
        const subPaths = transport.transitDetails.subPaths;
        for (const subPath of subPaths) {
          const subTransportMode =
            subPath.trafficType === 3
              ? ("walking" as const)
              : baseTransportMode;
          const subFrom = subPath.startCoord || fromCoord;
          const subTo = subPath.endCoord || toCoord;

          segments.push({
            from: subFrom,
            to: subTo,
            encodedPath:
              subPath.trafficType === 3
                ? subPath.polyline
                : subPath.polyline || transport.polyline,
            transportMode: subTransportMode,
            segmentIndex: lastIndex,
            isToAccommodation,
            isToDestination,
          });
        }
      } else {
        // subPaths가 없으면 전체 경로 사용 (레거시)
        segments.push({
          from: fromCoord,
          to: toCoord,
          encodedPath: transport.polyline,
          transportMode: baseTransportMode,
          segmentIndex: lastIndex,
          isToAccommodation,
          isToDestination,
        });
      }
    }

    return segments;
  }, [currentItinerary, currentDayMarkers, trip]);

  // 일정 항목 클릭
  const handleItemClick = (item: ScheduleItem) => {
    if (!trip?.places) return;

    // 해당 장소 찾기
    const place = trip.places.find((p) => p.id === item.placeId);
    if (place?.coordinate) {
      // 맵을 해당 장소의 좌표로 이동
      setSelectedPlaceCenter(place.coordinate);
    }
  };

  // 출발지/숙소 클릭
  const handleOriginClick = (coordinate: { lat: number; lng: number }) => {
    setSelectedPlaceCenter(coordinate);
  };

  // 도착지/숙소 클릭
  const handleDestinationClick = (coordinate: { lat: number; lng: number }) => {
    setSelectedPlaceCenter(coordinate);
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
        <header className="flex items-center gap-3 px-4 py-1 border-b">
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
        <header className="flex items-center gap-3 px-4 py-1 border-b">
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
      <header className="flex items-center gap-3 px-4 py-1 border-b">
        <h1 className="font-semibold text-lg flex-1 line-clamp-1">
          {trip.title}
        </h1>
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
            <Button
              variant="link"
              size="sm"
              className="text-primary h-auto p-0"
            >
              나도 계획하기
            </Button>
          </Link>
        </div>
      </div>

      {/* 여행 정보 */}
      <section className="px-4 py-3 border-b space-y-2">
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
                  trip.itinerary!.reduce(
                    (acc, it) => acc + it.totalDuration,
                    0,
                  ),
                )}
              </span>
            </div>
          )}
          {hasItinerary && (
            <div className="flex items-center gap-1.5">
              <LuRoute className="w-4 h-4 shrink-0" />
              <span>
                {formatDistance(
                  trip.itinerary!.reduce(
                    (acc, it) => acc + it.totalDistance,
                    0,
                  ),
                )}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 카카오 맵 및 일정 바텀 시트 */}
      {hasItinerary && trip ? (
        <div className="flex-1 relative overflow-hidden">
          {/* 카카오 맵 */}
          <KakaoMap
            center={selectedPlaceCenter || mapCenter}
            level={7}
            className="absolute inset-0 w-full h-full"
          >
            {/* 경로 폴리라인 (출발지 → 장소들 → 도착지) - 구간별 색상 적용 */}
            {routeSegments.length > 0 && (
              <RealRoutePolyline
                segments={routeSegments}
                strokeWeight={3}
                strokeOpacity={0.9}
                useSegmentColors={true}
              />
            )}

            {/* 출발지 마커 (dayEndpoints 사용) */}
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

            {/* 도착지 마커 (dayEndpoints 사용) */}
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

          {/* 일정 바텀 시트 */}
          <DraggableBottomSheet>
            <DayTabsContainer
              days={days}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            >
              <div className="px-4 py-4" {...swipeHandlers}>
                {/* 일정 타임라인 */}
                <DayContentPanel
                  itineraries={enrichedItineraries}
                  selectedDay={selectedDay}
                  onItemClick={handleItemClick}
                  onOriginClick={handleOriginClick}
                  onDestinationClick={handleDestinationClick}
                  showNavigation={false}
                  isLoading={false}
                />
              </div>
            </DayTabsContainer>
          </DraggableBottomSheet>
        </div>
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
