"use client";

import { use, useEffect, useState, useMemo, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
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
} from "react-icons/lu";
import { Train, Bus, Footprints, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MapSkeleton, EmptyState, ErrorState } from "@/components/ux";

import {
  KakaoMap,
  useKakaoMap,
  useMapBounds,
} from "@/components/map/kakao-map";
import {
  PlaceMarkers,
  SingleMarker,
  type SingleMarkerProps,
} from "@/components/map/place-markers";
import { RealRoutePolyline } from "@/components/map/route-polyline";
import {
  CurrentLocationTracker,
  useCurrentLocation,
} from "@/components/map/current-location";

import { getTripWithDetails } from "@/actions/trips/get-trip";
import { getSegmentColor } from "@/lib/utils";
import { useSafeBack } from "@/hooks/use-safe-back";
import type { TripWithDetails, Coordinate } from "@/types";
import type { ScheduleItem, DailyItinerary } from "@/types/schedule";

interface NavigatePageProps {
  params: Promise<{ tripId: string }>;
}

/**
 * 카카오맵 아이콘 컴포넌트 */
function KakaoMapIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/kakaomap_basic.png"
      alt="카카오맵"
      width={24}
      height={24}
      className={className}
    />
  );
}

/**
 * 네이버맵 아이콘 컴포넌트 */
function NaverMapIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/naver.webp"
      alt="Naver Map"
      width={24}
      height={24}
      className={className}
    />
  );
}

/**
 * 구글맵 아이콘 컴포넌트 */
function GoogleMapIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/google.png"
      alt="Google Map"
      width={24}
      height={24}
      className={className}
    />
  );
}

/**
 * 거리 포맷팅 (미터 → km)
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * 소요 시간 포맷팅 (분 → 시간)
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD → M/D)
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Haversine 거리 계산 (미터)
 */
function calculateDistance(from: Coordinate, to: Coordinate): number {
  const R = 6371000; // 筌왖요금獄쏆꼷요금?(沃섎챸苑?
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
 * 카카오맵 네비게이션 열기 (새 창)
 */
function openKakaoMapNavigation(
  destination: { name: string; coordinate: Coordinate },
  origin?: Coordinate,
) {
  if (origin) {
    const url =
      "https://map.kakao.com/link/from/" +
      encodeURIComponent("Current Location") +
      "," +
      origin.lat +
      "," +
      origin.lng +
      "/to/" +
      encodeURIComponent(destination.name) +
      "," +
      destination.coordinate.lat +
      "," +
      destination.coordinate.lng;
    window.open(url, "_blank");
  } else {
    const url =
      "https://map.kakao.com/link/to/" +
      encodeURIComponent(destination.name) +
      "," +
      destination.coordinate.lat +
      "," +
      destination.coordinate.lng;
    window.open(url, "_blank");
  }
}

/**
 * 네이버맵 네비게이션 열기 (새 창)
 */
function openNaverMapNavigation(
  destination: { name: string; coordinate: Coordinate },
  origin?: Coordinate,
) {
  if (origin) {
    const url =
      "https://map.naver.com/v5/directions/" +
      origin.lng +
      "," +
      origin.lat +
      "/" +
      destination.coordinate.lng +
      "," +
      destination.coordinate.lat +
      "/-/transit";
    window.open(url, "_blank");
  } else {
    const url =
      "https://map.naver.com/v5/search/" +
      encodeURIComponent(destination.name) +
      "?c=" +
      destination.coordinate.lng +
      "," +
      destination.coordinate.lat +
      ",15,0,0,0,dh";
    window.open(url, "_blank");
  }
}

/**
 * 구글맵 네비게이션 열기 (새 창)
 */
function openGoogleMapNavigation(
  destination: { name: string; coordinate: Coordinate },
  origin?: Coordinate,
) {
  if (origin) {
    const url =
      "https://www.google.com/maps/dir/?api=1&origin=" +
      origin.lat +
      "," +
      origin.lng +
      "&destination=" +
      destination.coordinate.lat +
      "," +
      destination.coordinate.lng +
      "&travelmode=transit";
    window.open(url, "_blank");
  } else {
    const url =
      "https://www.google.com/maps/search/?api=1&query=" +
      destination.coordinate.lat +
      "," +
      destination.coordinate.lng;
    window.open(url, "_blank");
  }
}

/**
 * 교통수단 타입에 따른 아이콘 반환
 */
function getTrafficIcon(trafficType: number) {
  switch (trafficType) {
    case 1: // 吏?섏쿋
      
      return <Train className="w-3 h-3" />;
    case 2: // 버스
      return <Bus className="w-3 h-3" />;
    case 6: // 시외버스
      return <Bus className="w-3 h-3" />;
    case 3: // 도보
      return <Footprints className="w-3 h-3" />;
    default:
      return null;
  }
}

/**
 * 교통수단 타입에 따른 라벨 반환
 */
function getTrafficLabel(trafficType: number) {
  switch (trafficType) {
    case 1:
      return "지하철";
    case 2:
      return "버스";
    case 3:
      return "도보";
    case 4:
      return "기차";
    case 5:
      return "고속버스";
    case 6:
      return "시외버스";
    default:
      return "대중교통";
  }
}

/**
 * 네비게이션 하단 패널 컴포넌트
 */
function NavigationBottomPanel({
  currentItem,
  nextItem,
  currentLocation,
  onOpenKakaoMap,
  onOpenNaverMap,
  onOpenGoogleMap,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  isExpanded,
  onToggleExpand,
  isOriginSegment,
  isDestinationSegment,
}: {
  currentItem: ScheduleItem & { coordinate: Coordinate };
  nextItem?: ScheduleItem & { coordinate: Coordinate };
  currentLocation: Coordinate | null;
  onOpenKakaoMap: () => void;
  onOpenNaverMap: () => void;
  onOpenGoogleMap: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isOriginSegment?: boolean;
  isDestinationSegment?: boolean;
}) {
  const distanceToNext = useMemo(() => {
    if (!currentLocation || !currentItem) return null;
    return calculateDistance(currentLocation, currentItem.coordinate);
  }, [currentLocation, currentItem]);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-background border-t shadow-lg safe-area-bottom">
      {/* 접기/펼치기 버튼 */}
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
        {/* 현재 장소 정보 + 네비게이션 버튼 */}
        <div className="flex items-center gap-3">
          {/* 이전 버튼 */}
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="shrink-0 size-10 touch-target"
          >
            <LuChevronLeft className="w-5 h-5" />
          </Button>

          {/* 순서 표시 */}
          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
            {isOriginSegment
              ? "출발"
              : isDestinationSegment
                ? "도착"
                : currentItem.order}
          </div>

          {/* 장소 이름 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg truncate">
                {currentItem.placeName}
              </h3>
            </div>

            {distanceToNext !== null && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <LuRoute className="w-4 h-4" />
                {formatDistance(distanceToNext)}
              </div>
            )}
          </div>

          {/* 다음 버튼 */}
          <Button
            variant="outline"
            size="icon"
            onClick={onNext}
            disabled={!hasNext}
            className="shrink-0 size-10 touch-target"
          >
            <LuChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* 상세 정보 */}
        {isExpanded && (
          <>
            {/* 다음 장소 미리보기 */}
            {nextItem && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">
                  다음 장소
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">
                    {nextItem.order}
                  </div>
                  <span className="font-medium text-sm truncate">
                    {nextItem.placeName}
                  </span>
                </div>
              </div>
            )}

            {/* 요금猷요금類ｋ궖 */}
            {currentItem.transportToNext && (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <LuNavigation className="w-4 h-4" />
                    <span>
                      {currentItem.transportToNext.mode === "walking"
  ? "Walk"
  : currentItem.transportToNext.mode === "car"
    ? "Car"
    : "Transit"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <LuClock className="w-4 h-4" />
                    <span>
                      {formatDuration(currentItem.transportToNext.duration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <LuRoute className="w-4 h-4" />
                    <span>
                      {formatDistance(currentItem.transportToNext.distance)}
                    </span>
                  </div>
                </div>

                {/* 요금餓λ쵌요금요금怨멸쉭 ?類ｋ궖 */}
                {currentItem.transportToNext.mode === "public" &&
                  currentItem.transportToNext.transitDetails && (
                    <div className="space-y-2">
                      {/* ?紐꾧퐨 ?遺용튋 */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {currentItem.transportToNext.transitDetails.subPaths
                          .filter((sp) => sp.trafficType !== 3)
                          .map((subPath, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1"
                            >
                              {index > 0 && (
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              )}
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white"
                                style={{
                                  backgroundColor:
                                    subPath.lane?.lineColor || "#6b7280",
                                }}
                              >
                                {getTrafficIcon(subPath.trafficType)}
                                {subPath.lane?.name ||
                                  getTrafficLabel(subPath.trafficType)}
                              </span>
                            </div>
                          ))}
                      </div>

                      {/* ?遺쏀닊 獄요금?뤿뱟 ?類ｋ궖 */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {currentItem.transportToNext.transitDetails.totalFare >
                          0 && (
                          <span className="text-primary font-medium">
                            {currentItem.transportToNext.transitDetails.totalFare.toLocaleString()}
                          </span>
                        )}
                        {currentItem.transportToNext.transitDetails
                          .transferCount > 0 && (
                          <span>
                            환승{" "}
                            {
                              currentItem.transportToNext.transitDetails
                                .transferCount
                            }
                            분 </span>
                        )}
                        {currentItem.transportToNext.transitDetails
                          .walkingTime > 0 && (
                          <span className="flex items-center gap-1">
                            <Footprints className="w-3 h-3" />
                            도보{" "}
                            {
                              currentItem.transportToNext.transitDetails
                                .walkingTime
                            }
                            분 </span>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </>
        )}

        {/* 筌왖요금요금獄쏅뗀以덂첎?疫?甕곌쑵요금?*/}
        <div className="flex gap-4 justify-center">
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenKakaoMap}
            className="touch-target"
          >
            <KakaoMapIcon className="w-6 h-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenNaverMap}
            className="touch-target"
          >
            <NaverMapIcon className="w-6 h-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenGoogleMap}
            className="touch-target"
          >
            <GoogleMapIcon className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 筌왖요금요금? ?뚮똾猷요금곕뱜 (KakaoMapContext 요금곷퓠요금요금요금
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

  const placeCoordinates = useMemo(() => {
    const map = new Map<string, Coordinate>();
    trip.places.forEach((place) => {
      map.set(place.id, place.coordinate);
    });
    return map;
  }, [trip.places]);

  // 마커 생성 (구간별 색상 적용)
  const markers = useMemo(() => {
    return currentDayItinerary.schedule.map((item, index) => {
      const coordinate = placeCoordinates.get(item.placeId) || {
        lat: 0,
        lng: 0,
      };
      return {
        id: item.placeId,
        coordinate,
        order: index + 1,
        name: item.placeName,
        isFixed: item.isFixed,
        clickable: true,
        color: getSegmentColor(index), // 구간별 색상 적용
      };
    });
  }, [currentDayItinerary.schedule, placeCoordinates]);

  // 현재 및 다음 장소 정보
  const currentScheduleItem = currentDayItinerary.schedule[currentIndex];

  const currentDestination = currentScheduleItem
    ? placeCoordinates.get(currentScheduleItem.placeId)
    : null;

  // nextDestination는 현재 위치에서 다음 위치로 이동할 때 사용 (주석 처리)
  // const nextDestination = nextScheduleItem
  //   ? placeCoordinates.get(nextScheduleItem.placeId)
  //   : null;

  // 경로 구간 생성 (출발지 대중교통 경로 구간별 표시)
  const routeSegments = useMemo(() => {
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

    // 요금덈꺖 ?袁⑺뒄 ?類ㅼ뵥
    const lodgingLocation = trip.accommodations?.[0]?.location;
    const isAccommodationCoord = (coord: Coordinate) => {
      if (!lodgingLocation) return false;
      return (
        Math.abs(coord.lat - lodgingLocation.lat) < 0.0001 &&
        Math.abs(coord.lng - lodgingLocation.lng) < 0.0001
      );
    };

    // 출발지에서 첫 장소로 (subPaths 있으면)
    if (
      currentDayItinerary.dayOrigin &&
      currentDayItinerary.transportFromOrigin &&
      markers.length > 0
    ) {
      const transport = currentDayItinerary.transportFromOrigin;
      const fromCoord = {
        lat: currentDayItinerary.dayOrigin.lat,
        lng: currentDayItinerary.dayOrigin.lng,
      };
      const toCoord = markers[0].coordinate;
      const isFromAccommodation = isAccommodationCoord(fromCoord);

      // subPaths揶쎛 요금됱몵筌요금브쑬요금 요금곸몵筌요금袁⑷퍥 野껋럥以요금요금?
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
        // subPaths揶쎛 요금곸몵筌요금袁⑷퍥 野껋럥以요금요금?(요금뉕탢요금
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

    // 장소 간 이동 (subPaths 있으면)
    for (let i = 0; i < currentDayItinerary.schedule.length - 1; i++) {
      const scheduleItem = currentDayItinerary.schedule[i];
      if (markers[i] && markers[i + 1]) {
        const transport = scheduleItem.transportToNext;
        if (!transport) continue;

        const fromCoord = markers[i].coordinate;
        const toCoord = markers[i + 1].coordinate;

        // subPaths揶쎛 요금됱몵筌요금브쑬요금 요금곸몵筌요금袁⑷퍥 野껋럥以요금요금?
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

            // 요금餓λ쵌요금요금닌덉퍢: passStopCoords揶쎛 요금됱몵筌?path嚥요금요금?
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
          // subPaths揶쎛 요금곸몵筌요금袁⑷퍥 野껋럥以요금요금?(요금뉕탢요금
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

    // 筌띾뜆?筌요금關요금요금?袁⑷컩筌왖 (subPaths ?브쑬요금
    if (
      currentDayItinerary.dayDestination &&
      currentDayItinerary.transportToDestination &&
      markers.length > 0
    ) {
      const transport = currentDayItinerary.transportToDestination;
      const lastIndex = markers.length - 1;
      const fromCoord = markers[lastIndex].coordinate;
      const toCoord = {
        lat: currentDayItinerary.dayDestination.lat,
        lng: currentDayItinerary.dayDestination.lng,
      };
      const isToAccommodation = isAccommodationCoord(toCoord);
      const isToDestination =
        !isToAccommodation &&
        currentDayItinerary.dayDestination.type === "destination";

      // subPaths揶쎛 요금됱몵筌요금브쑬요금 요금곸몵筌요금袁⑷퍥 野껋럥以요금요금?
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
        // subPaths揶쎛 요금곸몵筌요금袁⑷퍥 野껋럥以요금요금?(요금뉕탢요금
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
  }, [currentDayItinerary, markers, trip.transportModes, trip.accommodations]);

  // 지도 범위 자동 조정
  useEffect(() => {
    if (!isReady || markers.length === 0) return;

    const coordinates = markers.map((m) => m.coordinate);
    if (currentLocation) {
      coordinates.push(currentLocation);
    }

    setBounds(coordinates, 80);
  }, [isReady, markers, currentLocation, setBounds]);

  // ?袁⑹삺 筌뤴뫗?삼쭪?嚥?筌왖요금요금猷?
  useEffect(() => {
    if (!map || !isReady || !currentDestination) return;

    const position = new window.kakao.maps.LatLng(
      currentDestination.lat,
      currentDestination.lng,
    );
    map.panTo(position);
  }, [map, isReady, currentDestination]);

  return (
    <>
      {/* 현재 위치 마커*/}
      <CurrentLocationTracker
        enabled={true}
        showAccuracy={true}
        pulse={true}
        followLocation={false}
      />

      {/* 野껋럥以요금?요금?깆뵥 (요금쇱젫 요금餓λ쵌요금?野껋럥以? */}
      {routeSegments.length > 0 && (
        <RealRoutePolyline
          segments={routeSegments}
          strokeWeight={5}
          strokeOpacity={0.9}
          useSegmentColors={true}
        />
      )}

      {/* 출발지 마커 (dayOrigin이 있으면 표시) */}
      {currentDayItinerary.dayOrigin && (
        <SingleMarker
          coordinate={{
            lat: currentDayItinerary.dayOrigin.lat,
            lng: currentDayItinerary.dayOrigin.lng,
          }}
          type={
            (currentDayItinerary.dayOrigin.type === "waypoint"
              ? "default"
              : currentDayItinerary.dayOrigin.type) as SingleMarkerProps["type"]
          }
        />
      )}

      {/* 장소 마커들*/}
      <PlaceMarkers
        markers={markers}
        selectedId={currentScheduleItem?.placeId}
        onMarkerClick={onMarkerClick}
        size="md"
      />

      {/* ?袁⑷컩筌왖 筌띾뜆鍮?(dayDestination요금요금됱뱽 요금?춸) */}
      {currentDayItinerary.dayDestination && (
        <SingleMarker
          coordinate={{
            lat: currentDayItinerary.dayDestination.lat,
            lng: currentDayItinerary.dayDestination.lng,
          }}
          type={
            (currentDayItinerary.dayDestination.type === "waypoint"
              ? "default"
              : currentDayItinerary.dayDestination
                  .type) as SingleMarkerProps["type"]
          }
        />
      )}

      {/* ?袁⑹삺 ?袁⑺뒄嚥요금?猷?甕곌쑵요금*/}
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
  const handleBack = useSafeBack(`/my/trips/${tripId}`);
  const [trip, setTrip] = useState<TripWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [daySelectOpen, setDaySelectOpen] = useState(false);

  // 현재 위치 추적
  const { coordinate: currentLocation, error: locationError } =
    useCurrentLocation({
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

        // 요금삳뮎 ?醫롮요금요금?요금?롫뮉 요금깃컧 筌≪뼐由?
        if (result.data.itinerary && result.data.itinerary.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const todayIndex = result.data.itinerary.findIndex(
            (it) => it.date === today,
          );
          if (todayIndex !== -1) {
            setSelectedDayIndex(todayIndex);
          }

          // 초기 currentIndex 설정: dayOrigin이 있으면 -1, 없으면 0
          const initialItinerary =
            result.data.itinerary[todayIndex !== -1 ? todayIndex : 0];
          if (initialItinerary?.dayOrigin) {
            setCurrentIndex(-1); // ?곗뮆而삼쭪? 요금筌?野껋럩?筌왖 ?닌덉퍢?봔요금요금뽰삂
          } else {
            setCurrentIndex(0); // 筌?甕곕뜆요금野껋럩?筌왖?봔요금요금뽰삂
          }
        }
      } else {
        setError(result.error || "여행 정보를 불러오는 중 오류가 발생했습니다.");
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

  const placeCoordinates = useMemo(() => {
    if (!trip) return new Map<string, Coordinate>();
    const map = new Map<string, Coordinate>();
    trip.places.forEach((place) => {
      map.set(place.id, place.coordinate);
    });
    return map;
  }, [trip]);

  // 현재 일정 요금요금요금ル슦紐요금곕떽?
  // currentIndex = -1: ?곗뮆而삼쭪? 요금筌?野껋럩?筌왖
  // currentIndex = 0~N: 野껋럩?筌왖요금  // currentIndex = schedule.length: 筌띾뜆?筌?野껋럩?筌왖 요금?袁⑷컩筌왖
  const currentItemWithCoordinate = useMemo(() => {
    if (!currentDayItinerary || currentDayItinerary.schedule.length === 0)
      return null;

    // ?곗뮆而삼쭪? 요금筌?野껋럩?筌왖 ?닌덉퍢
    if (currentIndex === -1 && currentDayItinerary.dayOrigin) {
      // ?곗뮆而삼쭪? ?類ｋ궖 獄쏆꼹요금
      return {
        placeId: "origin",
        placeName: currentDayItinerary.dayOrigin.name,
        coordinate: {
          lat: currentDayItinerary.dayOrigin.lat,
          lng: currentDayItinerary.dayOrigin.lng,
        },
        arrivalTime: "",
        departureTime: "",
        duration: 0,
        isFixed: false,
        order: 0, // 숙소는 0번        transportToNext: currentDayItinerary.transportFromOrigin,
      };
    }

    // 筌띾뜆?筌?野껋럩?筌왖 요금?袁⑷컩筌왖 ?닌덉퍢
    if (
      currentIndex === currentDayItinerary.schedule.length &&
      currentDayItinerary.dayDestination
    ) {
      return {
        placeId: "destination",
        placeName: currentDayItinerary.dayDestination.name,
        coordinate: {
          lat: currentDayItinerary.dayDestination.lat,
          lng: currentDayItinerary.dayDestination.lng,
        },
        arrivalTime: "",
        departureTime: "",
        duration: 0,
        isFixed: false,
        order: currentDayItinerary.schedule.length + 1,
        transportToNext: undefined,
      };
    }

    // 요금곗뺘 野껋럩?筌왖
    const item = currentDayItinerary.schedule[currentIndex];
    if (!item) return null;
    const coordinate = placeCoordinates.get(item.placeId);
    if (!coordinate) return null;
    return { ...item, coordinate };
  }, [currentDayItinerary, currentIndex, placeCoordinates]);

  // 요금쇱벉 요금깆젟 요금요금요금ル슦紐요금곕떽?
  const nextItemWithCoordinate = useMemo(() => {
    if (!currentDayItinerary) return undefined;

    // ?곗뮆而삼쭪? ?닌덉퍢?癒?퐣요금筌?野껋럩?筌왖揶쎛 요금쇱벉
    if (currentIndex === -1) {
      const firstPlace = currentDayItinerary.schedule[0];
      if (!firstPlace) return undefined;
      const coordinate = placeCoordinates.get(firstPlace.placeId);
      if (!coordinate) return undefined;
      return { ...firstPlace, coordinate };
    }

    // 筌띾뜆?筌?野껋럩?筌왖 筌욊낯요금?욱요금袁⑷컩筌왖揶쎛 요금됱몵筌요금袁⑷컩筌왖揶쎛 요금쇱벉
    if (
      currentIndex === currentDayItinerary.schedule.length - 1 &&
      currentDayItinerary.dayDestination
    ) {
      return {
        placeId: "destination",
        placeName: currentDayItinerary.dayDestination.name,
        coordinate: {
          lat: currentDayItinerary.dayDestination.lat,
          lng: currentDayItinerary.dayDestination.lng,
        },
        arrivalTime: "",
        departureTime: "",
        duration: 0,
        isFixed: false,
        order: currentDayItinerary.schedule.length + 1,
        transportToNext: undefined,
      };
    }

    // 요금쇱벉 野껋럩?筌왖
    if (currentIndex >= currentDayItinerary.schedule.length - 1)
      return undefined;
    const item = currentDayItinerary.schedule[currentIndex + 1];
    if (!item) return undefined;
    const coordinate = placeCoordinates.get(item.placeId);
    if (!coordinate) return undefined;
    return { ...item, coordinate };
  }, [currentDayItinerary, currentIndex, placeCoordinates]);
  // Marker click handler
  const handleMarkerClick = useCallback(
    (placeId: string) => {
      if (!currentDayItinerary) return;
      const index = currentDayItinerary.schedule.findIndex(
        (item) => item.placeId === placeId,
      );
      if (index !== -1) {
        setCurrentIndex(index);
      }
    },
    [currentDayItinerary],
  );

  // ?袁⑹삺 ?袁⑺뒄嚥?筌왖요금요금猷?
  const handleCenterToCurrentLocation = useCallback(() => {
    // 현재 위치로 map ref를 통해 지도를 이동하는 기능
    // KakaoMap ?뚮똾猷요금곕뱜 ?紐요금癒?퐣 筌욊낯요금?臾롫젏요금요금요금?
    // 추후 구현 예정
  }, []);

  // 요금곸읈/요금쇱벉 ?關?쇗에요금?猷?
  // currentIndex 甕곕뗄요금 -1(?곗뮆而삼쭪?) ~ schedule.length(?袁⑷컩筌왖)
  const handlePrevious = useCallback(() => {
    const minIndex = currentDayItinerary?.dayOrigin ? -1 : 0;
    if (currentIndex > minIndex) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex, currentDayItinerary]);

  const handleNext = useCallback(() => {
    if (!currentDayItinerary) return;
    const maxIndex = currentDayItinerary.dayDestination
      ? currentDayItinerary.schedule.length
      : currentDayItinerary.schedule.length - 1;

    if (currentIndex < maxIndex) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentDayItinerary, currentIndex]);

  // 카카오맵 네비게이션 열기
  const handleOpenKakaoMap = useCallback(() => {
    if (!currentItemWithCoordinate) return;
    openKakaoMapNavigation(
      {
        name: currentItemWithCoordinate.placeName,
        coordinate: currentItemWithCoordinate.coordinate,
      },
      currentLocation || undefined,
    );
  }, [currentItemWithCoordinate, currentLocation]);

  // 네이버맵 네비게이션 열기
  const handleOpenNaverMap = useCallback(() => {
    if (!currentItemWithCoordinate) return;
    openNaverMapNavigation(
      {
        name: currentItemWithCoordinate.placeName,
        coordinate: currentItemWithCoordinate.coordinate,
      },
      currentLocation || undefined,
    );
  }, [currentItemWithCoordinate, currentLocation]);

  // 구글맵 네비게이션 열기
  const handleOpenGoogleMap = useCallback(() => {
    if (!currentItemWithCoordinate) return;
    openGoogleMapNavigation(
      {
        name: currentItemWithCoordinate.placeName,
        coordinate: currentItemWithCoordinate.coordinate,
      },
      currentLocation || undefined,
    );
  }, [currentItemWithCoordinate, currentLocation]);
  // Loading state
  if (!isLoaded || isLoading) {
    return (
      <main className="flex flex-col h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-1 border-b">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-16 ml-auto rounded-md" />
        </header>
        <div className="flex-1">
          <MapSkeleton className="h-full" />
        </div>
      </main>
    );
  }

  // 沃섎챶以덃뉩紐꾩뵥 ?怨밴묶
  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center h-[calc(100dvh-64px)] px-4 gap-4">
        <p className="text-muted-foreground">Please sign in to continue.</p>
        <Link href="/sign-in">
          <Button className="touch-target">Sign in</Button>
        </Link>
      </main>
    );
  }

  // 에러 상태
  if (error || !trip) {
    return (
      <main className="flex flex-col h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-1 border-b">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 touch-target"
            onClick={handleBack}
          >
            <LuChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-lg">Navigation</h1>
        </header>
        <ErrorState
          type="generic"
          description={error || "여행 정보를 불러오는 중 오류가 발생했습니다."}
          onBack={() => window.history.back()}
        />
      </main>
    );
  }

  // 일정이 없는 경우
  if (!trip.itinerary || trip.itinerary.length === 0 || !currentDayItinerary) {
    return (
      <main className="flex flex-col h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-1 border-b">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 touch-target"
            onClick={handleBack}
          >
            <LuChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-lg">Navigation</h1>
        </header>
        <EmptyState
          type="itinerary"
          description="아직 생성된 일정이 없습니다. 일정을 최적화하여 네비게이션을 시작해보세요."
          actionLabel="일정 최적화하기"
          onAction={() => (window.location.href = `/plan/${tripId}`)}
        />
      </main>
    );
  }

  // 일정이 있지만 장소가 없는 경우
  if (currentDayItinerary.schedule.length === 0) {
    return (
      <main className="flex flex-col h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-1 border-b">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 touch-target"
            onClick={handleBack}
          >
            <LuChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-lg">Navigation</h1>
        </header>
        <EmptyState
          icon={<LuMapPin className="w-8 h-8" />}
          title={`${selectedDayIndex + 1}일차에 일정이 없습니다`}
          description="이 날짜에 방문할 장소를 추가해주세요."
          actionLabel="일차 선택"
          onAction={() => setDaySelectOpen(true)}
        />
      </main>
    );
  }

  // 筌왖요금?λ뜃由?餓λ쵐요금?ル슦紐?
  const initialCenter = currentItemWithCoordinate?.coordinate ||
    trip.places[0]?.coordinate || { lat: 37.5665, lng: 126.978 };

  return (
    <main className="flex flex-col h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-1 border-b bg-background z-10">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 touch-target"
          onClick={handleBack}
        >
          <LuChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-lg truncate">{trip.title}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDaySelectOpen(true)}
          className="touch-target"
        >
          {currentDayItinerary.dayNumber}일차
          <LuChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </header>

      {/* 현재 위치 오류 알림 */}
      {locationError && (
        <div className="px-4 py-2 bg-yellow-100 text-yellow-800 text-sm">
          현재 위치 오류: {locationError}
        </div>
      )}

      {/* 筌왖요금?怨몃열 */}
      <div className="flex-1 relative overflow-hidden">
        <KakaoMap
          center={initialCenter}
          level={5}
          className="absolute inset-0 w-full h-full"
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
            onOpenGoogleMap={handleOpenGoogleMap}
            onPrevious={handlePrevious}
            onNext={handleNext}
            hasPrevious={
              currentIndex > (currentDayItinerary.dayOrigin ? -1 : 0)
            }
            hasNext={
              currentIndex <
              (currentDayItinerary.dayDestination
                ? currentDayItinerary.schedule.length
                : currentDayItinerary.schedule.length - 1)
            }
            isExpanded={isPanelExpanded}
            onToggleExpand={() => setIsPanelExpanded(!isPanelExpanded)}
            isOriginSegment={currentIndex === -1}
            isDestinationSegment={
              currentIndex === currentDayItinerary.schedule.length &&
              !!currentDayItinerary.dayDestination
            }
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
                  // dayOrigin요금요금됱몵筌?-1, 요금곸몵筌?0?봔요금요금뽰삂
                  setCurrentIndex(itinerary.dayOrigin ? -1 : 0);
                  setDaySelectOpen(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{itinerary.dayNumber}일차</p>
                    <p
                      className={`text-sm ${index === selectedDayIndex ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                    >
                      {formatDate(itinerary.date)}
                    </p>
                  </div>
                  <div
                    className={`text-sm ${index === selectedDayIndex ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                  >
                    장소 {itinerary.placeCount}개
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










