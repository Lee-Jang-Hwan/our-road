"use client";

import { use, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { LuChevronLeft, LuShare2, LuLoader, LuPencil, LuHotel } from "react-icons/lu";
import { AlertCircle, MapPin, Clock, ArrowRight, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DayTabs, DayTabsContainer } from "@/components/itinerary/day-tabs";
import { DayContentPanel } from "@/components/itinerary/day-content";
import { UnassignedPlaces } from "@/components/itinerary/unassigned-places";
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
import type { DailyAccommodation } from "@/types/accommodation";

interface ResultPageProps {
  params: Promise<{ tripId: string }>;
}

/**
 * 숙소 누락 날짜를 확인하는 함수
 */
function getMissingAccommodationDates(
  startDate: string,
  endDate: string,
  accommodations?: DailyAccommodation[]
): string[] {
  if (!accommodations || accommodations.length === 0) {
    // 숙소가 전혀 없는 경우 - 모든 숙박 날짜가 누락됨
    const missingDates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const nights = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // 숙박은 시작일부터 (종료일 - 1) 까지
    for (let i = 0; i < nights; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      missingDates.push(date.toISOString().split('T')[0]);
    }
    return missingDates;
  }

  // 필요한 모든 숙박 날짜 계산
  const start = new Date(startDate);
  const end = new Date(endDate);
  const nights = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  const requiredDates = new Set<string>();
  for (let i = 0; i < nights; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    requiredDates.add(date.toISOString().split('T')[0]);
  }

  // 숙소가 커버하는 날짜 제거
  accommodations.forEach(acc => {
    const accStart = new Date(acc.startDate);
    const accEnd = new Date(acc.endDate);
    const accNights = Math.floor((accEnd.getTime() - accStart.getTime()) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < accNights; i++) {
      const date = new Date(accStart);
      date.setDate(accStart.getDate() + i);
      requiredDates.delete(date.toISOString().split('T')[0]);
    }
  });

  return Array.from(requiredDates).sort();
}

/**
 * 날짜를 "M월 D일" 형식으로 포맷
 */
function formatDateKorean(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function ResultPage({ params }: ResultPageProps) {
  const { tripId } = use(params);
  const handleBack = useSafeBack(`/plan/${tripId}`);
  const [selectedDay, setSelectedDay] = useState(1);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [itineraries, setItineraries] = useState<DailyItinerary[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPlaces, setHasPlaces] = useState(true);
  const [unassignedPlaceInfos, setUnassignedPlaceInfos] = useState<
    UnassignedPlaceInfo[]
  >([]);

  // 최적화 실행
  const runOptimization = useCallback(async () => {
    console.log("🚀 [최적화 시작] 일정 최적화를 시작합니다.", {
      tripId,
      timestamp: new Date().toISOString(),
    });
    setIsOptimizing(true);
    setError(null);

    try {
      const result = await optimizeRoute({ tripId });

      if (!result.success) {
        console.error("❌ [최적화 실패]", result.error?.message);
        setError(result.error?.message || "최적화에 실패했습니다.");
        return;
      }

      if (result.data?.itinerary) {
        setItineraries(result.data.itinerary);

        // 누락된 장소 확인 (상세 정보 포함)
        const unassignedError = result.data.errors?.find(
          (e) => e.code === "EXCEEDS_DAILY_LIMIT",
        );

        if (unassignedError?.details?.unassignedPlaceDetails) {
          // 상세 정보가 있는 경우
          setUnassignedPlaceInfos(
            unassignedError.details
              .unassignedPlaceDetails as UnassignedPlaceInfo[],
          );
        } else if (unassignedError?.details?.unassignedPlaces) {
          // 기존 방식: 장소 ID만 있는 경우 (후방 호환)
          const placeIds = unassignedError.details.unassignedPlaces as string[];
          // places 로드 후 처리될 수 있도록 ID만 저장
          const placesResult = await getPlaces(tripId);
          const loadedPlaces = placesResult.data || [];

          const infos: UnassignedPlaceInfo[] = placeIds.map((placeId) => {
            const place = loadedPlaces.find((p) => p.id === placeId);
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

        console.log("✅ [최적화 완료] 일정 최적화가 완료되었습니다.", {
          itineraryCount: result.data.itinerary.length,
          timestamp: new Date().toISOString(),
        });

        // 최적화 직후 자동 저장
        console.log("💾 [자동 저장 시작] 최적화 결과를 DB에 저장합니다.");
        try {
          const saveResult = await saveItinerary({
            tripId,
            itinerary: result.data.itinerary,
          });

          if (!saveResult.success) {
            console.error("❌ [저장 실패]", saveResult.error);
            showErrorToast(saveResult.error || "저장에 실패했습니다.");
            // 저장 실패해도 결과는 표시
          } else {
            console.log("✅ [저장 완료] 일정이 DB에 저장되었습니다.");
            showSuccessToast("일정이 최적화되고 저장되었습니다!");
          }
        } catch (saveErr) {
          console.error("❌ [저장 실패]", saveErr);
          showErrorToast("저장 중 오류가 발생했습니다.");
          // 저장 실패해도 결과는 표시
        }
      }
    } catch (err) {
      console.error("❌ [최적화 실패]", err);
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
      for (const subPath of subPaths) {
        if (!subPath.startCoord || !subPath.endCoord) continue;

        const subTransportMode =
          subPath.trafficType === 3
            ? ("walking" as const)
            : ("public" as const);

        // 대중교통 구간: passStopCoords가 있으면 path로 사용
        // 도보 구간: polyline 사용 (TMap)
        let pathCoords: Coordinate[] | undefined;
        if (
          subPath.trafficType !== 3 &&
          subPath.passStopCoords &&
          subPath.passStopCoords.length > 0
        ) {
          // 대중교통 구간: 시작점 + 경유 정류장 + 끝점
          pathCoords = [
            subPath.startCoord,
            ...subPath.passStopCoords,
            subPath.endCoord,
          ];
        }

        segments.push({
          from: subPath.startCoord,
          to: subPath.endCoord,
          encodedPath: subPath.polyline, // 도보 구간의 TMap polyline
          path: pathCoords, // 대중교통 구간의 passStopCoords 기반 경로
          transportMode: subTransportMode,
          segmentIndex,
        });
      }

      // subPath가 없으면 전체 polyline 사용 (폴백)
      if (subPaths.length === 0) {
        segments.push({
          from: fromCoord,
          to: toCoord,
          encodedPath: transport?.polyline,
          transportMode: baseTransportMode,
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
      {trip && (() => {
        const missingDates = getMissingAccommodationDates(
          trip.startDate,
          trip.endDate,
          trip.accommodations
        );
        
        if (missingDates.length > 0) {
          // 연속된 날짜를 그룹화
          const groups: string[][] = [];
          let currentGroup: string[] = [missingDates[0]];
          
          for (let i = 1; i < missingDates.length; i++) {
            const prevDate = new Date(missingDates[i - 1]);
            const currDate = new Date(missingDates[i]);
            const diff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
            
            if (diff === 1) {
              currentGroup.push(missingDates[i]);
            } else {
              groups.push(currentGroup);
              currentGroup = [missingDates[i]];
            }
          }
          groups.push(currentGroup);
          
          return (
            <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800 mb-1">
                    숙소 설정이 필요합니다
                  </p>
                  <div className="text-sm text-yellow-700 space-y-1">
                    {groups.map((group, idx) => {
                      if (group.length === 1) {
                        return (
                          <p key={idx}>
                            • {formatDateKorean(group[0])} 숙소가 설정되지 않았습니다.
                          </p>
                        );
                      } else {
                        return (
                          <p key={idx}>
                            • {formatDateKorean(group[0])} ~ {formatDateKorean(group[group.length - 1])} 숙소가 설정되지 않았습니다.
                          </p>
                        );
                      }
                    })}
                  </div>
                  <Link href={`/plan/${tripId}/edit`} className="mt-2 inline-block">
                    <Button variant="outline" size="sm" className="h-8 text-xs bg-white hover:bg-yellow-50">
                      <LuHotel className="w-3.5 h-3.5 mr-1.5" />
                      숙소 설정하기
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

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
