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
import { Train, Bus, Footprints, ArrowRight, Ship } from "lucide-react";

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
 * 移댁뭅?ㅻ㏊ 濡쒓퀬 ?꾩씠肄? */
function KakaoMapIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/kakaomap_basic.png"
      alt="移댁뭅?ㅻ㏊"
      width={24}
      height={24}
      className={className}
    />
  );
}

/**
 * ?ㅼ씠踰꾨㏊ 濡쒓퀬 ?꾩씠肄? */
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
 * 援ш?留?濡쒓퀬 ?꾩씠肄? */
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
 * 嫄곕━ ?щ㎎ (誘명꽣 ??km)
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * ?쒓컙 ?щ㎎ (遺????쒓컙)
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
 * ?좎쭨 ?щ㎎ (YYYY-MM-DD ??M??D??
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Haversine 嫄곕━ 怨꾩궛 (誘명꽣)
 */
function calculateDistance(from: Coordinate, to: Coordinate): number {
  const R = 6371000; // 吏援?諛섏?由?(誘명꽣)
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
 * 移댁뭅?ㅻ㏊ ???닿린 (湲몄갼湲?
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
 * ?ㅼ씠踰꾨㏊ ???닿린 (湲몄갼湲?
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
 * 援ш?留????닿린 (湲몄갼湲?
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
 * 援ш컙 ??낆뿉 ?곕Ⅸ ?꾩씠肄?諛섑솚
 */
function getTrafficIcon(trafficType: number) {
  switch (trafficType) {
    case 1: // 吏?섏쿋
    case 10: // ?댁감
      return <Train className="w-3 h-3" />;
    case 2: // 踰꾩뒪
    case 11: // 怨좎냽踰꾩뒪
    case 12: // ?쒖쇅踰꾩뒪
      return <Bus className="w-3 h-3" />;
    case 3: // ?꾨낫
      return <Footprints className="w-3 h-3" />;
    case 14: // ?댁슫
      return <Ship className="w-3 h-3" />;
    default:
      return <Train className="w-3 h-3" />;
  }
}

/**
 * 援ш컙 ??낆뿉 ?곕Ⅸ ?쇰꺼 諛섑솚
 */
function getTrafficLabel(trafficType: number) {
  switch (trafficType) {
    case 1:
      return "Subway";
    case 2:
      return "Bus";
    case 3:
      return "Walk";
    case 10:
      return "Train";
    case 11:
      return "Express Bus";
    case 12:
      return "Airport Bus";
    case 14:
      return "Ferry";
    default:
      return "Transit";
  }
}

/**
 * ?ㅻ퉬寃뚯씠???섎떒 ?⑤꼸
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
      {/* ?뺤옣 ?좉? */}
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
        {/* ?꾩옱 紐⑹쟻吏 ?뺣낫 + ?ㅻ퉬寃뚯씠??踰꾪듉 */}
        <div className="flex items-center gap-3">
          {/* ?댁쟾 踰꾪듉 */}
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="shrink-0 size-10 touch-target"
          >
            <LuChevronLeft className="w-5 h-5" />
          </Button>

          {/* ?쒖꽌 踰덊샇 */}
          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
            {isOriginSegment
              ? "異쒕컻"
              : isDestinationSegment
                ? "?꾩갑"
                : currentItem.order}
          </div>

          {/* ?μ냼 ?뺣낫 */}
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

          {/* ?ㅼ쓬 踰꾪듉 */}
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

        {/* ?뺤옣???뺣낫 */}
        {isExpanded && (
          <>
            {/* ?ㅼ쓬 紐⑹쟻吏 誘몃━蹂닿린 */}
            {nextItem && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">
                  ?ㅼ쓬 紐⑹쟻吏
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

            {/* ?대룞 ?뺣낫 */}
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

                {/* ?以묎탳???곸꽭 ?뺣낫 */}
                {currentItem.transportToNext.mode === "public" &&
                  currentItem.transportToNext.transitDetails && (
                    <div className="space-y-2">
                      {/* ?몄꽑 ?붿빟 */}
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

                      {/* ?붽툑 諛??섏듅 ?뺣낫 */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {currentItem.transportToNext.transitDetails.totalFare >
                          0 && (
                          <span className="text-primary font-medium">
                            ??                            {currentItem.transportToNext.transitDetails.totalFare.toLocaleString()}
                          </span>
                        )}
                        {currentItem.transportToNext.transitDetails
                          .transferCount > 0 && (
                          <span>
                            ?섏듅{" "}
                            {
                              currentItem.transportToNext.transitDetails
                                .transferCount
                            }
                            ??                          </span>
                        )}
                        {currentItem.transportToNext.transitDetails
                          .walkingTime > 0 && (
                          <span className="flex items-center gap-1">
                            <Footprints className="w-3 h-3" />
                            ?꾨낫{" "}
                            {
                              currentItem.transportToNext.transitDetails
                                .walkingTime
                            }
                            遺?                          </span>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </>
        )}

        {/* 吏????諛붾줈媛湲?踰꾪듉??*/}
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
 * 吏???대? 而댄룷?뚰듃 (KakaoMapContext ?댁뿉???ъ슜)
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

  // 留덉빱 ?곗씠???앹꽦 (援ш컙蹂??됱긽 ?곸슜)
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
        color: getSegmentColor(index), // 援ш컙蹂??됱긽 ?곸슜
      };
    });
  }, [currentDayItinerary.schedule, placeCoordinates]);

  // ?꾩옱 諛??ㅼ쓬 紐⑹쟻吏
  const currentScheduleItem = currentDayItinerary.schedule[currentIndex];

  const currentDestination = currentScheduleItem
    ? placeCoordinates.get(currentScheduleItem.placeId)
    : null;

  // nextDestination? ?꾩옱 ?ъ슜?섏? ?딆?留??ν썑 ?ъ슜 ?덉젙
  // const nextDestination = nextScheduleItem
  //   ? placeCoordinates.get(nextScheduleItem.placeId)
  //   : null;

  // 寃쎈줈 援ш컙 諛곗뿴 (?ㅼ젣 ?以묎탳??寃쎈줈 ?쒖떆)
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

    // ?숈냼 ?꾩튂 ?뺤씤
    const lodgingLocation = trip.accommodations?.[0]?.location;
    const isAccommodationCoord = (coord: Coordinate) => {
      if (!lodgingLocation) return false;
      return (
        Math.abs(coord.lat - lodgingLocation.lat) < 0.0001 &&
        Math.abs(coord.lng - lodgingLocation.lng) < 0.0001
      );
    };

    // 異쒕컻吏 ??泥??μ냼 (subPaths 遺꾨━)
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

      // subPaths媛 ?덉쑝硫?遺꾨━, ?놁쑝硫??꾩껜 寃쎈줈 ?ъ슜
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
        // subPaths媛 ?놁쑝硫??꾩껜 寃쎈줈 ?ъ슜 (?덇굅??
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

    // ?μ냼???ъ씠 (subPaths 遺꾨━)
    for (let i = 0; i < currentDayItinerary.schedule.length - 1; i++) {
      const scheduleItem = currentDayItinerary.schedule[i];
      if (markers[i] && markers[i + 1]) {
        const transport = scheduleItem.transportToNext;
        if (!transport) continue;

        const fromCoord = markers[i].coordinate;
        const toCoord = markers[i + 1].coordinate;

        // subPaths媛 ?덉쑝硫?遺꾨━, ?놁쑝硫??꾩껜 寃쎈줈 ?ъ슜
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

            // ?以묎탳??援ш컙: passStopCoords媛 ?덉쑝硫?path濡??ъ슜
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
          // subPaths媛 ?놁쑝硫??꾩껜 寃쎈줈 ?ъ슜 (?덇굅??
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

    // 留덉?留??μ냼 ???꾩갑吏 (subPaths 遺꾨━)
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

      // subPaths媛 ?덉쑝硫?遺꾨━, ?놁쑝硫??꾩껜 寃쎈줈 ?ъ슜
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
        // subPaths媛 ?놁쑝硫??꾩껜 寃쎈줈 ?ъ슜 (?덇굅??
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

  // 珥덇린 諛붿슫???ㅼ젙
  useEffect(() => {
    if (!isReady || markers.length === 0) return;

    const coordinates = markers.map((m) => m.coordinate);
    if (currentLocation) {
      coordinates.push(currentLocation);
    }

    setBounds(coordinates, 80);
  }, [isReady, markers, currentLocation, setBounds]);

  // ?꾩옱 紐⑹쟻吏濡?吏???대룞
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
      {/* ?꾩옱 ?꾩튂 留덉빱 */}
      <CurrentLocationTracker
        enabled={true}
        showAccuracy={true}
        pulse={true}
        followLocation={false}
      />

      {/* 寃쎈줈 ?대━?쇱씤 (?ㅼ젣 ?以묎탳??寃쎈줈) */}
      {routeSegments.length > 0 && (
        <RealRoutePolyline
          segments={routeSegments}
          strokeWeight={5}
          strokeOpacity={0.9}
          useSegmentColors={true}
        />
      )}

      {/* 異쒕컻吏 留덉빱 (dayOrigin???덉쓣 ?뚮쭔) */}
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

      {/* ?μ냼 留덉빱??*/}
      <PlaceMarkers
        markers={markers}
        selectedId={currentScheduleItem?.placeId}
        onMarkerClick={onMarkerClick}
        size="md"
      />

      {/* ?꾩갑吏 留덉빱 (dayDestination???덉쓣 ?뚮쭔) */}
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

      {/* ?꾩옱 ?꾩튂濡??대룞 踰꾪듉 */}
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

  // ?꾩옱 ?꾩튂 異붿쟻
  const { coordinate: currentLocation, error: locationError } =
    useCurrentLocation({
      enabled: true,
      enableHighAccuracy: true,
    });

  // ?ы뻾 ?곗씠??濡쒕뱶
  useEffect(() => {
    async function loadTrip() {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      const result = await getTripWithDetails(tripId);

      if (result.success && result.data) {
        setTrip(result.data);

        // ?ㅻ뒛 ?좎쭨???대떦?섎뒗 ?쇱감 李얘린
        if (result.data.itinerary && result.data.itinerary.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const todayIndex = result.data.itinerary.findIndex(
            (it) => it.date === today,
          );
          if (todayIndex !== -1) {
            setSelectedDayIndex(todayIndex);
          }

          // 珥덇린 currentIndex ?ㅼ젙: dayOrigin???덉쑝硫?-1, ?놁쑝硫?0
          const initialItinerary =
            result.data.itinerary[todayIndex !== -1 ? todayIndex : 0];
          if (initialItinerary?.dayOrigin) {
            setCurrentIndex(-1); // 異쒕컻吏 ??泥?寃쎌쑀吏 援ш컙遺???쒖옉
          } else {
            setCurrentIndex(0); // 泥?踰덉㎏ 寃쎌쑀吏遺???쒖옉
          }
        }
      } else {
        setError(result.error || "?ы뻾 ?뺣낫瑜?遺덈윭?ㅻ뒗???ㅽ뙣?덉뒿?덈떎.");
      }

      setIsLoading(false);
    }

    if (isLoaded && user) {
      loadTrip();
    } else if (isLoaded && !user) {
      setIsLoading(false);
    }
  }, [user, isLoaded, tripId]);

  // ?꾩옱 ?쇱젙
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

  // ?꾩옱 ?쇱젙 ??ぉ??醫뚰몴 異붽?
  // currentIndex = -1: 異쒕컻吏 ??泥?寃쎌쑀吏
  // currentIndex = 0~N: 寃쎌쑀吏??  // currentIndex = schedule.length: 留덉?留?寃쎌쑀吏 ???꾩갑吏
  const currentItemWithCoordinate = useMemo(() => {
    if (!currentDayItinerary || currentDayItinerary.schedule.length === 0)
      return null;

    // 異쒕컻吏 ??泥?寃쎌쑀吏 援ш컙
    if (currentIndex === -1 && currentDayItinerary.dayOrigin) {
      // 異쒕컻吏 ?뺣낫 諛섑솚
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
        order: 0, // 異쒕컻吏??0踰?        transportToNext: currentDayItinerary.transportFromOrigin,
      };
    }

    // 留덉?留?寃쎌쑀吏 ???꾩갑吏 援ш컙
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

    // ?쇰컲 寃쎌쑀吏
    const item = currentDayItinerary.schedule[currentIndex];
    if (!item) return null;
    const coordinate = placeCoordinates.get(item.placeId);
    if (!coordinate) return null;
    return { ...item, coordinate };
  }, [currentDayItinerary, currentIndex, placeCoordinates]);

  // ?ㅼ쓬 ?쇱젙 ??ぉ??醫뚰몴 異붽?
  const nextItemWithCoordinate = useMemo(() => {
    if (!currentDayItinerary) return undefined;

    // 異쒕컻吏 援ш컙?먯꽌??泥?寃쎌쑀吏媛 ?ㅼ쓬
    if (currentIndex === -1) {
      const firstPlace = currentDayItinerary.schedule[0];
      if (!firstPlace) return undefined;
      const coordinate = placeCoordinates.get(firstPlace.placeId);
      if (!coordinate) return undefined;
      return { ...firstPlace, coordinate };
    }

    // 留덉?留?寃쎌쑀吏 吏곸쟾?닿퀬 ?꾩갑吏媛 ?덉쑝硫??꾩갑吏媛 ?ㅼ쓬
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

    // ?ㅼ쓬 寃쎌쑀吏
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

  // ?꾩옱 ?꾩튂濡?吏???대룞
  const handleCenterToCurrentLocation = useCallback(() => {
    // ??湲곕뒫? map ref瑜??듯빐 援ы쁽?댁빞 ?섏?留?
    // KakaoMap 而댄룷?뚰듃 ?몃??먯꽌 吏곸젒 ?묎렐???대젮?
    // ?곕씪???ш린?쒕뒗 媛꾨떒??援ы쁽
  }, []);

  // ?댁쟾/?ㅼ쓬 ?μ냼濡??대룞
  // currentIndex 踰붿쐞: -1(異쒕컻吏) ~ schedule.length(?꾩갑吏)
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

  // 移댁뭅?ㅻ㏊ ???닿린
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

  // ?ㅼ씠踰꾨㏊ ???닿린
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

  // 援ш?留????닿린
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
        <header className="flex items-center gap-3 px-4 py-3 border-b">
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

  // 誘몃줈洹몄씤 ?곹깭
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

  // ?먮윭 ?곹깭
  if (error || !trip) {
    return (
      <main className="flex flex-col h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
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
          description={error || "?ы뻾 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎."}
          onBack={() => window.history.back()}
        />
      </main>
    );
  }

  // ?쇱젙???녿뒗 寃쎌슦
  if (!trip.itinerary || trip.itinerary.length === 0 || !currentDayItinerary) {
    return (
      <main className="flex flex-col h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
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
          description="理쒖쟻?붾맂 ?쇱젙???놁뒿?덈떎. ?쇱젙??理쒖쟻?뷀븳 ???ㅻ퉬寃뚯씠?섏쓣 ?쒖옉?댁＜?몄슂."
          actionLabel="?쇱젙 ?몄쭛?섍린"
          onAction={() => (window.location.href = `/plan/${tripId}`)}
        />
      </main>
    );
  }

  // ?쇱젙???μ냼媛 ?녿뒗 寃쎌슦
  if (currentDayItinerary.schedule.length === 0) {
    return (
      <main className="flex flex-col h-[calc(100dvh-64px)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
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
          title={`${selectedDayIndex + 1}?쇱감???쇱젙???놁뒿?덈떎`}
          description="?ㅻⅨ ?쇱감瑜??좏깮?댁＜?몄슂."
          actionLabel="?쇱감 ?좏깮"
          onAction={() => setDaySelectOpen(true)}
        />
      </main>
    );
  }

  // 吏??珥덇린 以묒떖 醫뚰몴
  const initialCenter = currentItemWithCoordinate?.coordinate ||
    trip.places[0]?.coordinate || { lat: 37.5665, lng: 126.978 };

  return (
    <main className="flex flex-col h-[calc(100dvh-64px)]">
      {/* ?ㅻ뜑 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-background z-10">
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
          {currentDayItinerary.dayNumber}?쇱감
          <LuChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </header>

      {/* ?꾩튂 沅뚰븳 ?ㅻ쪟 ?쒖떆 */}
      {locationError && (
        <div className="px-4 py-2 bg-yellow-100 text-yellow-800 text-sm">
          ?꾩튂 ?뺣낫: {locationError}
        </div>
      )}

      {/* 吏???곸뿭 */}
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

        {/* ?섎떒 ?ㅻ퉬寃뚯씠???⑤꼸 */}
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

      {/* ?쇱감 ?좏깮 Sheet */}
      <Sheet open={daySelectOpen} onOpenChange={setDaySelectOpen}>
        <SheetContent side="bottom" className="max-h-[60vh]">
          <SheetHeader>
            <SheetTitle>?쇱감 ?좏깮</SheetTitle>
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
                  // dayOrigin???덉쑝硫?-1, ?놁쑝硫?0遺???쒖옉
                  setCurrentIndex(itinerary.dayOrigin ? -1 : 0);
                  setDaySelectOpen(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{itinerary.dayNumber}?쇱감</p>
                    <p
                      className={`text-sm ${index === selectedDayIndex ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                    >
                      {formatDate(itinerary.date)}
                    </p>
                  </div>
                  <div
                    className={`text-sm ${index === selectedDayIndex ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                  >
                    {itinerary.placeCount}媛??μ냼
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









