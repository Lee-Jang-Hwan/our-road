"use client";

import {
  use,
  useEffect,
  useState,
  useMemo,
  useTransition,
  useCallback,
} from "react";
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
import { AlertCircle } from "lucide-react";
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
import { UnassignedPlaces } from "@/components/itinerary/unassigned-places";
import { RouteFindingAnimation } from "@/components/optimize/route-finding-animation";
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

import { getTripWithDetails } from "@/actions/trips/get-trip";
import { deleteTrip } from "@/actions/trips/delete-trip";
import { getPlaces } from "@/actions/places";
import { optimizeRoute } from "@/actions/optimize/optimize-route";
import { saveItinerary } from "@/actions/optimize/save-itinerary";
import { getSegmentColor } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import type { TripWithDetails, TripStatus, Coordinate } from "@/types";
import type { ScheduleItem } from "@/types/schedule";
import type { Place } from "@/types/place";
import type { UnassignedPlaceInfo } from "@/types/optimize";
import { calculateTripDuration } from "@/types/trip";
import { AccommodationWarning } from "@/components/trip/accommodation-warning";

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
        <Badge
          variant="secondary"
          className="text-xs bg-yellow-100 text-yellow-800"
        >
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
  // 선택된 장소의 좌표 (맵 이동용)
  const [selectedPlaceCenter, setSelectedPlaceCenter] =
    useState<Coordinate | null>(null);

  // 최적화 관련 상태
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [unassignedPlaceInfos, setUnassignedPlaceInfos] = useState<
    UnassignedPlaceInfo[]
  >([]);
  const [optimizeError, setOptimizeError] = useState<{
    message: string;
    code?: string;
    retryCount: number;
  } | null>(null);
  const MAX_RETRY_COUNT = 2;

  // 최적화 실행
  const runOptimization = useCallback(async () => {
    setIsOptimizing(true);
    setOptimizeError(null);

    try {
      const result = await optimizeRoute({ tripId });

      if (!result.success) {
        const currentRetryCount = optimizeError?.retryCount || 0;
        setOptimizeError({
          message: result.error?.message || "최적화에 실패했습니다.",
          code: result.error?.code,
          retryCount: currentRetryCount + 1,
        });
        return;
      }

      if (result.data?.itinerary) {
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

        // 최적화 직후 자동 저장
        try {
          const saveResult = await saveItinerary({
            tripId,
            itinerary: result.data.itinerary,
          });

          if (!saveResult.success) {
            showErrorToast(saveResult.error || "저장에 실패했습니다.");
            // 저장 실패해도 결과는 표시
          } else {
            showSuccessToast("일정이 최적화되고 저장되었습니다!");

            // DB에서 최신 데이터 다시 로드
            const reloadResult = await getTripWithDetails(tripId);
            if (reloadResult.success && reloadResult.data) {
              setTrip(reloadResult.data);
            }
          }
        } catch {
          showErrorToast("저장 중 오류가 발생했습니다.");
          // 저장 실패해도 결과는 표시
        }
      }
    } catch {
      const currentRetryCount = optimizeError?.retryCount || 0;
      setOptimizeError({
        message: "최적화 중 오류가 발생했습니다.",
        retryCount: currentRetryCount + 1,
      });
    } finally {
      setIsOptimizing(false);
    }
  }, [tripId, optimizeError, places]);

  // 여행 상세 로드
  useEffect(() => {
    async function loadTrip() {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      const result = await getTripWithDetails(tripId);

      if (result.success && result.data) {
        setTrip(result.data);

        // 자동 최적화 조건: draft 또는 optimizing 상태면 무조건 재최적화
        const shouldOptimize =
          result.data.status === "draft" || result.data.status === "optimizing";

        if (shouldOptimize) {
          // 장소 데이터 로드 (최적화에 필요)
          const placesResult = await getPlaces(tripId);
          if (placesResult.success && placesResult.data) {
            setPlaces(placesResult.data);
          }

          // 최적화 실행
          await runOptimization();
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
  }, [user, isLoaded, tripId, runOptimization]);

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
      // 마지막 날, 숙소 없음: 전체 도착지 사용 (단, 출발지와 완전히 같은 좌표가 아닌 경우만)
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

    // 공유용 URL 생성
    const shareUrl = `${window.location.origin}/share/${tripId}`;

    try {
      await navigator.share({
        title: trip.title,
        text: `${trip.title} - ${formatDate(trip.startDate)} ~ ${formatDate(trip.endDate)}`,
        url: shareUrl,
      });
    } catch {
      // 공유 API 미지원 시 URL 복사
      await navigator.clipboard.writeText(shareUrl);
      alert("링크가 클립보드에 복사되었습니다.");
    }
  };

  // 네비게이션 시작
  const handleStartNavigation = () => {
    router.push(`/navigate/${tripId}`);
  };

  // 최적화 재시도
  const handleRetryOptimization = () => {
    setOptimizeError(null);
    runOptimization();
  };

  // 로딩 중 또는 최적화 중 화면 (스켈레톤 대신 애니메이션 표시)
  if (!isLoaded || isLoading || isOptimizing) {
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
          <h1 className="font-semibold text-lg flex-1">여행 상세</h1>
        </header>
        <div className="flex-1 flex items-center justify-center py-8">
          <RouteFindingAnimation />
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
        <h1 className="font-semibold text-lg flex-1 line-clamp-1">
          {trip.title}
        </h1>
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

      {/* 최적화 에러 UI */}
      {optimizeError && (
        <div className="mx-4 mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium mb-1">최적화 실패</p>
              <p className="text-sm">{optimizeError.message}</p>
              {optimizeError.retryCount < MAX_RETRY_COUNT && (
                <p className="text-xs mt-2 text-muted-foreground">
                  재시도 {optimizeError.retryCount}/{MAX_RETRY_COUNT}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            {optimizeError.retryCount < MAX_RETRY_COUNT ? (
              <Button onClick={handleRetryOptimization} size="sm">
                다시 시도
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => router.push(`/plan/${tripId}`)}
                  size="sm"
                >
                  편집 페이지로
                </Button>
                <Button
                  onClick={() => setOptimizeError(null)}
                  variant="ghost"
                  size="sm"
                >
                  닫기
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 누락된 장소 경고 */}
      {unassignedPlaceInfos.length > 0 && (
        <UnassignedPlaces places={unassignedPlaceInfos} />
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
              <Button
                variant="default"
                size="sm"
                className="bg-black text-white hover:bg-gray-900"
              >
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

      {/* 숙소 누락 경고 */}
      <AccommodationWarning
        tripId={tripId}
        startDate={trip.startDate}
        endDate={trip.endDate}
        accommodations={trip.accommodations}
        lastPlaceName={
          trip.places && trip.places.length > 0
            ? trip.places[trip.places.length - 1]?.name
            : undefined
        }
        className="mx-4 mt-4"
      />

      {/* 카카오 맵 */}
      {hasItinerary && trip && (
        <div className="w-full h-64 border-b relative overflow-hidden sticky top-6 z-10">
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
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <LuRoute className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">
            최적화된 일정이 없습니다
          </h3>
          <p className="text-muted-foreground text-sm text-center mb-6">
            {trip.places.length > 0
              ? "장소가 추가되어 있습니다. 일정을 최적화해보세요."
              : "장소를 추가하고 일정을 최적화해보세요."}
          </p>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
        <div className="flex gap-3 pb-4">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={() => router.push(`/plan/${tripId}`)}
          >
            <LuPencil className="w-4 h-4 mr-2" />
            편집하기
          </Button>
          {hasItinerary && (
            <Button className="flex-1 h-12" onClick={handleStartNavigation}>
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
