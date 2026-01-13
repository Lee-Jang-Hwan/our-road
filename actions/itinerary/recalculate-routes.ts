/**
 * @file recalculate-routes.ts
 * @description 경로 재계산 Server Action
 *
 * 편집 모드에서 사용자가 순서를 변경한 후, 실제 경로 정보를 다시 조회합니다.
 * 순서는 유지하고 경로 정보만 업데이트합니다. (최적화 알고리즘 재실행 아님)
 *
 * 주요 기능:
 * 1. 현재 Trip 정보 조회 (이동 수단 확인)
 * 2. 각 구간별로 재사용 가능 여부 판단
 * 3. 새로 생긴 구간만 API 호출
 * 4. 거리 행렬 업데이트 (차량 모드)
 * 5. transportToNext 업데이트
 * 6. 시간 재계산
 * 7. DB 저장
 *
 * @dependencies
 * - @clerk/nextjs/server: auth
 * - @/lib/supabase/server: createClerkSupabaseClient
 * - @/types/schedule: DailyItinerary
 * - @/actions/trips/get-trip: getTrip
 * - @/actions/routes/get-car-route: getCarRoute
 * - @/actions/routes/get-transit-route: getTransitRoute
 * - @/lib/optimize/recalculate-time: recalculateItineraryTimes
 * - @/lib/optimize/reuse-route-info: getRouteFromDistanceMatrix, getRouteFromStoredItinerary
 *
 * @see {@link .cursor/design/itinerary-edit-mode.md} - 설계 문서
 */

"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import type {
  DailyItinerary,
  ScheduleItem,
  TripItineraryRow,
  ScheduleItemRow,
} from "@/types/schedule";
import type { TransportMode, RouteSegment } from "@/types/route";
import type { Coordinate } from "@/types/place";
import { getTrip, getTripWithDetails } from "@/actions/trips/get-trip";
import { getPlaces } from "@/actions/places";
import { getCarRoute } from "@/actions/routes/get-car-route";
import { getTransitRoute } from "@/actions/routes/get-transit-route";
import { getBestTransitRouteWithDetails } from "@/lib/api/odsay";
import { getCarRoute as getKakaoCarRoute } from "@/lib/api/kakao";
import { recalculateItineraryTimes } from "@/lib/optimize/recalculate-time";
import { getRouteFromStoredItinerary } from "@/lib/optimize/reuse-route-info";
import { updateDayItinerary } from "./update-itinerary";

export interface RecalculateRoutesInput {
  tripId: string;
  /** 변경된 일정 (선택적). 제공되지 않으면 DB에서 조회 */
  itineraries?: DailyItinerary[];
  /** 변경 전 일정 (선택적). 제공되면 이 일정과 비교하여 새 구간 판단 */
  originalItineraries?: DailyItinerary[];
}

export interface RecalculateRoutesResult {
  success: boolean;
  data?: DailyItinerary[];
  error?: string;
}

/**
 * 경로 재계산 Server Action
 *
 * @param input - 재계산할 여행 ID
 * @returns 재계산된 일정 또는 에러
 */
export async function recalculateRoutes(
  input: RecalculateRoutesInput,
): Promise<RecalculateRoutesResult> {
  const startTime = Date.now();
  let apiCallCount = 0;
  const routeStatusLog: Array<{
    fromPlace: string;
    toPlace: string;
    status: string;
    hasPolyline: boolean;
    hasTransitDetails: boolean;
    subPathsCount?: number;
  }> = [];

  try {
    console.group(`[경로 재계산] 시작 - tripId: ${input.tripId}`);

    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    const {
      tripId,
      itineraries: providedItineraries,
      originalItineraries: providedOriginalItineraries,
    } = input;

    // 2. Trip 상세 정보 조회 (이동 수단, 장소 정보 포함)
    const tripWithDetailsResult = await getTripWithDetails(tripId);
    if (!tripWithDetailsResult.success || !tripWithDetailsResult.data) {
      return {
        success: false,
        error: tripWithDetailsResult.error || "여행 정보를 찾을 수 없습니다.",
      };
    }

    const trip = tripWithDetailsResult.data;
    const transportMode: TransportMode = trip.transportModes[0] || "car";

    // 일정 결정: 제공된 일정이 있으면 사용, 없으면 DB에서 조회
    let itineraries: DailyItinerary[];
    if (providedItineraries && providedItineraries.length > 0) {
      itineraries = providedItineraries;
      console.log(
        `[경로 재계산] 클라이언트에서 제공된 일정 사용: ${itineraries.length}일차`,
      );
    } else {
      if (!trip.itinerary || trip.itinerary.length === 0) {
        return {
          success: false,
          error: "일정이 없습니다. 먼저 일정을 최적화해주세요.",
        };
      }
      itineraries = trip.itinerary;
      console.log(
        `[경로 재계산] DB에서 조회한 일정 사용: ${itineraries.length}일차`,
      );
    }
    console.log(`[경로 재계산] 일정 수: ${itineraries.length}일차`);

    // 3. 장소 정보 조회 (좌표 필요)
    const places = trip.places;
    const placeMap = new Map(places.map((p) => [p.id, p]));

    // 3-1. 이전 일정에서 구간 정보 추출 (변경 전 일정과 비교하기 위해)
    // 우선순위: 1) 제공된 originalItineraries, 2) DB에서 조회한 일정
    // 출발지→첫 경유지, 경유지 간 구간, 마지막 경유지→도착지 모두 포함
    const previousSegments = new Set<string>();

    // 좌표 기반 구간 키 생성 헬퍼 함수
    // 좌표는 소수점 6자리까지 반올림하여 비교 (약 10cm 정확도)
    const roundCoord = (coord: Coordinate): Coordinate => ({
      lat: Math.round(coord.lat * 1000000) / 1000000,
      lng: Math.round(coord.lng * 1000000) / 1000000,
    });

    const createSegmentKey = (
      from: string | Coordinate,
      to: string | Coordinate,
    ): string => {
      if (typeof from === "string" && typeof to === "string") {
        // 장소 ID 기반
        return `${from}→${to}`;
      } else if (typeof from === "object" && typeof to === "string") {
        // 출발지 좌표 → 장소 ID (좌표 반올림)
        const rounded = roundCoord(from);
        return `__origin__(${rounded.lat},${rounded.lng})→${to}`;
      } else if (typeof from === "string" && typeof to === "object") {
        // 장소 ID → 도착지 좌표 (좌표 반올림)
        const rounded = roundCoord(to);
        return `${from}→__destination__(${rounded.lat},${rounded.lng})`;
      } else if (typeof from === "object" && typeof to === "object") {
        // 좌표 → 좌표 (일반적으로 사용되지 않음)
        const roundedFrom = roundCoord(from);
        const roundedTo = roundCoord(to);
        return `__origin__(${roundedFrom.lat},${roundedFrom.lng})→__destination__(${roundedTo.lat},${roundedTo.lng})`;
      } else {
        // 타입 가드 실패 시 (실제로는 발생하지 않아야 함)
        throw new Error("Invalid segment key parameters");
      }
    };

    // dayOrigin/dayDestination 계산을 위한 헬퍼 함수
    const getDayOriginCoord = (
      dayNumber: number,
      itinerary?: DailyItinerary,
      allItineraries?: DailyItinerary[],
    ): Coordinate | null => {
      // 1. itinerary의 dayOrigin이 있으면 사용
      if (itinerary?.dayOrigin) {
        return { lat: itinerary.dayOrigin.lat, lng: itinerary.dayOrigin.lng };
      }

      // 2. 첫날이면 trip의 origin 사용
      if (dayNumber === 1) {
        const originCoord =
          trip.origin &&
          typeof trip.origin.lat === "number" &&
          typeof trip.origin.lng === "number"
            ? { lat: trip.origin.lat, lng: trip.origin.lng }
            : null;
        if (originCoord) return originCoord;
      }

      // 3. 숙소가 있으면 숙소 사용
      const accommodationCoord =
        trip.accommodations?.[0]?.location &&
        typeof trip.accommodations[0].location.lat === "number" &&
        typeof trip.accommodations[0].location.lng === "number"
          ? {
              lat: trip.accommodations[0].location.lat,
              lng: trip.accommodations[0].location.lng,
            }
          : null;
      if (accommodationCoord) return accommodationCoord;

      // 4. 전날 마지막 장소 (allItineraries가 제공된 경우에만)
      if (dayNumber > 1 && allItineraries) {
        const prevItinerary = allItineraries.find(
          (it) => it.dayNumber === dayNumber - 1,
        );
        if (prevItinerary && prevItinerary.schedule.length > 0) {
          const lastPlaceId =
            prevItinerary.schedule[prevItinerary.schedule.length - 1].placeId;
          const lastPlace = placeMap.get(lastPlaceId);
          if (lastPlace?.coordinate) {
            return lastPlace.coordinate;
          }
        }
      }

      return null;
    };

    const getDayDestinationCoord = (
      dayNumber: number,
      totalDays: number,
      itinerary?: DailyItinerary,
    ): Coordinate | null => {
      // 1. itinerary의 dayDestination이 있으면 사용
      if (itinerary?.dayDestination) {
        return {
          lat: itinerary.dayDestination.lat,
          lng: itinerary.dayDestination.lng,
        };
      }

      // 2. 마지막 날이면 trip의 destination 사용
      if (dayNumber === totalDays) {
        const destinationCoord =
          trip.destination &&
          typeof trip.destination.lat === "number" &&
          typeof trip.destination.lng === "number"
            ? { lat: trip.destination.lat, lng: trip.destination.lng }
            : null;
        if (destinationCoord) return destinationCoord;
      }

      // 3. 숙소가 있으면 숙소 사용
      const accommodationCoord =
        trip.accommodations?.[0]?.location &&
        typeof trip.accommodations[0].location.lat === "number" &&
        typeof trip.accommodations[0].location.lng === "number"
          ? {
              lat: trip.accommodations[0].location.lat,
              lng: trip.accommodations[0].location.lng,
            }
          : null;
      if (accommodationCoord) return accommodationCoord;

      return null;
    };

    if (providedOriginalItineraries && providedOriginalItineraries.length > 0) {
      // 제공된 변경 전 일정 사용
      console.log(
        `[경로 재계산] 제공된 변경 전 일정 사용: ${providedOriginalItineraries.length}일차`,
      );
      const totalDays = providedOriginalItineraries.length;

      for (const itinerary of providedOriginalItineraries) {
        // 출발지 → 첫 경유지
        if (itinerary.transportFromOrigin && itinerary.schedule.length > 0) {
          const dayOriginCoord = getDayOriginCoord(
            itinerary.dayNumber,
            itinerary,
            providedOriginalItineraries,
          );
          if (dayOriginCoord) {
            const firstPlaceId = itinerary.schedule[0].placeId;
            const segmentKey = createSegmentKey(dayOriginCoord, firstPlaceId);
            previousSegments.add(segmentKey);
          }
        }

        // 경유지 간 구간
        for (let i = 0; i < itinerary.schedule.length - 1; i++) {
          const segmentKey = createSegmentKey(
            itinerary.schedule[i].placeId,
            itinerary.schedule[i + 1].placeId,
          );
          previousSegments.add(segmentKey);
        }

        // 마지막 경유지 → 도착지
        if (itinerary.transportToDestination && itinerary.schedule.length > 0) {
          const dayDestinationCoord = getDayDestinationCoord(
            itinerary.dayNumber,
            totalDays,
            itinerary,
          );
          if (dayDestinationCoord) {
            const lastPlaceId =
              itinerary.schedule[itinerary.schedule.length - 1].placeId;
            const segmentKey = createSegmentKey(
              lastPlaceId,
              dayDestinationCoord,
            );
            previousSegments.add(segmentKey);
          }
        }
      }
    } else {
      // DB에서 이전 일정 조회 (현재 일정과 비교하기 위해)
      const supabase = createClerkSupabaseClient();
      const { data: storedItineraries, error: fetchError } = await supabase
        .from("trip_itineraries")
        .select("*")
        .eq("trip_id", tripId)
        .order("day_number", { ascending: true });

      if (fetchError) {
        console.error("[경로 재계산] 이전 일정 조회 오류:", fetchError);
      }

      // DB에서 조회한 일정에서 구간 정보 추출
      if (storedItineraries) {
        console.log(
          `[경로 재계산] DB에서 조회한 일정 사용: ${storedItineraries.length}일차`,
        );

        // dayOrigin/dayDestination 계산을 위해 trip 정보 필요
        const isFirstDay = (dayNumber: number) => dayNumber === 1;
        const isLastDay = (dayNumber: number) =>
          dayNumber === storedItineraries.length;
        const hasAccommodation =
          trip.accommodations && trip.accommodations.length > 0;
        const originCoord =
          trip.origin &&
          typeof trip.origin.lat === "number" &&
          typeof trip.origin.lng === "number"
            ? { lat: trip.origin.lat, lng: trip.origin.lng }
            : null;
        const destinationCoord =
          trip.destination &&
          typeof trip.destination.lat === "number" &&
          typeof trip.destination.lng === "number"
            ? { lat: trip.destination.lat, lng: trip.destination.lng }
            : null;
        const accommodationCoord =
          hasAccommodation &&
          trip.accommodations?.[0]?.location &&
          typeof trip.accommodations[0].location.lat === "number" &&
          typeof trip.accommodations[0].location.lng === "number"
            ? {
                lat: trip.accommodations[0].location.lat,
                lng: trip.accommodations[0].location.lng,
              }
            : null;

        for (const row of storedItineraries as TripItineraryRow[]) {
          const schedule = row.schedule as ScheduleItemRow[];

          // 출발지 → 첫 경유지
          if (row.transport_from_origin && schedule.length > 0) {
            const firstPlaceId = schedule[0].place_id;
            let originCoordForDay: Coordinate | null = null;

            if (isFirstDay(row.day_number) && originCoord) {
              originCoordForDay = originCoord;
            } else if (!isFirstDay(row.day_number) && accommodationCoord) {
              originCoordForDay = accommodationCoord;
            } else if (!isFirstDay(row.day_number)) {
              // 전날 마지막 장소
              const prevRow = storedItineraries.find(
                (r) => r.day_number === row.day_number - 1,
              ) as TripItineraryRow | undefined;
              if (prevRow && prevRow.schedule.length > 0) {
                const prevSchedule = prevRow.schedule as ScheduleItemRow[];
                const lastPlaceId =
                  prevSchedule[prevSchedule.length - 1].place_id;
                const lastPlace = placeMap.get(lastPlaceId);
                if (lastPlace?.coordinate) {
                  originCoordForDay = lastPlace.coordinate;
                }
              }
            }

            if (originCoordForDay) {
              const segmentKey = createSegmentKey(
                originCoordForDay,
                firstPlaceId,
              );
              previousSegments.add(segmentKey);
            }
          }

          // 경유지 간 구간
          for (let i = 0; i < schedule.length - 1; i++) {
            const segmentKey = createSegmentKey(
              schedule[i].place_id,
              schedule[i + 1].place_id,
            );
            previousSegments.add(segmentKey);
          }

          // 마지막 경유지 → 도착지
          if (row.transport_to_destination && schedule.length > 0) {
            const lastPlaceId = schedule[schedule.length - 1].place_id;
            let destinationCoordForDay: Coordinate | null = null;

            if (isLastDay(row.day_number) && destinationCoord) {
              destinationCoordForDay = destinationCoord;
            } else if (accommodationCoord) {
              destinationCoordForDay = accommodationCoord;
            }

            if (destinationCoordForDay) {
              const segmentKey = createSegmentKey(
                lastPlaceId,
                destinationCoordForDay,
              );
              previousSegments.add(segmentKey);
            }
          }
        }
      }
    }

    console.log(
      `[경로 재계산] 이전 일정에서 발견된 구간 수: ${previousSegments.size}`,
    );

    // 4. 각 구간별로 재사용 가능 여부 판단 및 새로 생긴 구간만 API 호출
    const updatedItineraries = await Promise.all(
      itineraries.map(async (itinerary) => {
        console.log(
          `[경로 재계산] ${itinerary.dayNumber}일차 처리 시작 - 장소 수: ${itinerary.schedule.length}`,
        );
        const updatedSchedule: ScheduleItem[] = [];

        for (let i = 0; i < itinerary.schedule.length; i++) {
          const currentItem = itinerary.schedule[i];
          const nextItem = itinerary.schedule[i + 1];
          let routeSegment: RouteSegment | undefined =
            currentItem.transportToNext;

          // 마지막 항목이 아니면 다음 장소까지의 경로 정보 필요
          if (nextItem) {
            const fromPlace = placeMap.get(currentItem.placeId);
            const toPlace = placeMap.get(nextItem.placeId);

            const fromPlaceName = fromPlace?.name || currentItem.placeName;
            const toPlaceName = toPlace?.name || nextItem.placeName;

            if (!fromPlace || !toPlace) {
              // 장소 정보가 없으면 기존 정보 유지
              console.warn(
                `[경로 재계산] 장소 정보 없음: ${currentItem.placeId} → ${nextItem.placeId}`,
              );
              routeSegment = currentItem.transportToNext;
              routeStatusLog.push({
                fromPlace: fromPlaceName,
                toPlace: toPlaceName,
                status: "장소 정보 없음",
                hasPolyline: !!routeSegment?.polyline,
                hasTransitDetails: !!routeSegment?.transitDetails,
              });
            } else {
              // 현재 구간이 이전 일정에도 존재하는지 확인
              const currentSegmentKey = `${currentItem.placeId}→${nextItem.placeId}`;
              const isExistingSegment = previousSegments.has(currentSegmentKey);

              // 경로 재계산: 일정이 변경되었을 수 있으므로 항상 저장된 일정에서 경로 확인
              // 1. 먼저 저장된 일정에서 재사용 시도 (대중교통 모드 및 차량 모드)
              //    단, 현재 일정에 새로 생긴 구간이면 재사용하지 않음
              const storedRoute = isExistingSegment
                ? await getRouteFromStoredItinerary(
                    tripId,
                    currentItem.placeId,
                    nextItem.placeId,
                  )
                : null;

              // 저장된 일정에 해당 구간이 있는지 확인
              const hasStoredRoute = !!storedRoute;
              const hasExistingRoute = !!routeSegment;
              const hasDuration = !!routeSegment?.duration;
              const hasDistance = !!routeSegment?.distance;
              const hasPolyline = !!routeSegment?.polyline;
              const hasTransitDetails = !!routeSegment?.transitDetails;

              // 저장된 경로가 있고 상세 정보도 있으며, 좌표가 일치하는지 확인
              // 장소 ID 기반 매칭이므로 좌표는 일치한다고 가정
              const coordinatesMatch = true;

              // 경로 품질 검증: polyline이 너무 짧으면 (50자 미만) 재사용하지 않음
              const hasValidPolyline =
                storedRoute?.polyline && storedRoute.polyline.length >= 50;

              // 대중교통 모드: transitDetails와 subPaths가 있어야 함
              const hasValidTransitDetails =
                transportMode === "public"
                  ? storedRoute?.transitDetails &&
                    storedRoute.transitDetails.subPaths &&
                    storedRoute.transitDetails.subPaths.length > 0
                  : true;

              // 저장된 일정에 해당 구간이 있고 유효하면 재사용
              // 단, 현재 일정에 새로 생긴 구간이면 재사용하지 않음
              const canReuseStoredRoute =
                isExistingSegment &&
                storedRoute &&
                storedRoute.duration &&
                storedRoute.distance &&
                coordinatesMatch &&
                (transportMode === "public"
                  ? hasValidPolyline && hasValidTransitDetails
                  : hasValidPolyline);

              // 재계산 필요 여부 결정:
              // 1. 새로 생긴 구간이면 무조건 API 호출
              // 2. 기존 구간이지만 저장된 경로를 재사용할 수 없으면 API 호출
              const needsRecalculation =
                !isExistingSegment || !canReuseStoredRoute;

              console.log(`[경로 재계산] ${fromPlaceName} → ${toPlaceName}`, {
                새로생긴구간: !isExistingSegment,
                기존구간: isExistingSegment,
                저장된경로존재: hasStoredRoute,
                기존경로존재: hasExistingRoute,
                duration: hasDuration,
                distance: hasDistance,
                polyline: hasPolyline,
                transitDetails: hasTransitDetails,
                저장된경로재사용가능: canReuseStoredRoute,
                재계산필요: needsRecalculation,
              });

              if (canReuseStoredRoute) {
                // 저장된 경로 재사용 (기존 구간)
                console.log(
                  `[경로 재계산] ✅ 기존 구간 - 저장된 경로 재사용: ${fromPlaceName} → ${toPlaceName}`,
                  {
                    polyline: !!storedRoute.polyline,
                    transitDetails: !!storedRoute.transitDetails,
                    subPathsCount:
                      storedRoute.transitDetails?.subPaths?.length || 0,
                    좌표일치: coordinatesMatch,
                  },
                );
                routeSegment = storedRoute;
                routeStatusLog.push({
                  fromPlace: fromPlaceName,
                  toPlace: toPlaceName,
                  status: "기존 구간 - 저장된 경로 재사용",
                  hasPolyline: !!storedRoute.polyline,
                  hasTransitDetails: !!storedRoute.transitDetails,
                  subPathsCount: storedRoute.transitDetails?.subPaths?.length,
                });
              } else {
                // 저장된 경로가 없거나 재사용할 수 없으면 무조건 API 호출
                if (!isExistingSegment) {
                  // 새로 생긴 구간
                  console.log(
                    `[경로 재계산] 🆕 새로 생긴 구간 - API 호출 필요: ${fromPlaceName} → ${toPlaceName}`,
                  );
                } else if (storedRoute) {
                  // 기존 구간이지만 재사용 불가능한 이유 로깅
                  const storedCoordinatesMatch = true;
                  const storedHasValidPolyline =
                    storedRoute.polyline && storedRoute.polyline.length >= 50;
                  const storedHasValidTransitDetails =
                    transportMode === "public"
                      ? storedRoute.transitDetails &&
                        storedRoute.transitDetails.subPaths &&
                        storedRoute.transitDetails.subPaths.length > 0
                      : true;

                  const reason = !storedCoordinatesMatch
                    ? "좌표 불일치"
                    : !storedRoute.duration || !storedRoute.distance
                      ? "기본 정보 없음"
                      : transportMode === "public" && !storedHasValidPolyline
                        ? "polyline 너무 짧음"
                        : transportMode === "public" &&
                            !storedHasValidTransitDetails
                          ? "대중교통 상세 정보 없음"
                          : transportMode === "car" && !storedHasValidPolyline
                            ? "차량 경로 정보 없음"
                            : "알 수 없음";
                  console.log(
                    `[경로 재계산] ⚠️ 기존 구간이지만 저장된 경로 재사용 불가: ${fromPlaceName} → ${toPlaceName}`,
                    {
                      이유: reason,
                      storedRoute: {
                        duration: !!storedRoute.duration,
                        distance: !!storedRoute.distance,
                        polyline: !!storedRoute.polyline,
                        polylineLength: storedRoute.polyline?.length || 0,
                        transitDetails: !!storedRoute.transitDetails,
                        subPathsCount:
                          storedRoute.transitDetails?.subPaths?.length || 0,
                      },
                    },
                  );
                } else {
                  console.log(
                    `[경로 재계산] ⚠️ 기존 구간이지만 저장된 경로 없음 - API 호출 필요: ${fromPlaceName} → ${toPlaceName}`,
                  );
                }

                // 2. 재사용할 수 없으면 API 호출로 새로 조회
                const fromCoord: Coordinate = fromPlace.coordinate;
                const toCoord: Coordinate = toPlace.coordinate;

                console.log(
                  `[경로 재계산] API 호출 시작: ${fromPlaceName} → ${toPlaceName}`,
                  {
                    fromCoord,
                    toCoord,
                    transportMode,
                  },
                );
                apiCallCount++;

                try {
                  if (transportMode === "car") {
                    // 차량 모드: Kakao Mobility API
                    const apiStartTime = Date.now();
                    const carRouteResult = await getCarRoute({
                      origin: fromCoord,
                      destination: toCoord,
                      priority: "TIME",
                    });
                    const apiDuration = Date.now() - apiStartTime;

                    if (carRouteResult.success && carRouteResult.data) {
                      console.log(
                        `[경로 재계산] 차량 API 성공 (${apiDuration}ms): ${fromPlaceName} → ${toPlaceName}`,
                        {
                          distance: carRouteResult.data.totalDistance,
                          duration: carRouteResult.data.totalDuration,
                          polyline: !!carRouteResult.data.polyline,
                          polylineLength:
                            carRouteResult.data.polyline?.length || 0,
                        },
                      );
                      routeSegment = {
                        mode: "car",
                        distance: carRouteResult.data.totalDistance,
                        duration: carRouteResult.data.totalDuration,
                        polyline: carRouteResult.data.polyline,
                        fare: carRouteResult.data.fuelCost,
                      };
                      routeStatusLog.push({
                        fromPlace: fromPlaceName,
                        toPlace: toPlaceName,
                        status: !isExistingSegment
                          ? "🆕 새 구간 - 차량 API 성공"
                          : "⚠️ 기존 구간 - 차량 API 성공 (재사용 불가)",
                        hasPolyline: !!carRouteResult.data.polyline,
                        hasTransitDetails: false,
                      });
                    } else {
                      console.error(
                        `[경로 재계산] 차량 API 실패: ${fromPlaceName} → ${toPlaceName}`,
                        carRouteResult,
                      );
                      // API 호출 실패 시 기존 정보 유지
                      routeSegment = currentItem.transportToNext;
                      routeStatusLog.push({
                        fromPlace: fromPlaceName,
                        toPlace: toPlaceName,
                        status: !isExistingSegment
                          ? "🆕 새 구간 - 차량 API 실패"
                          : "⚠️ 기존 구간 - 차량 API 실패",
                        hasPolyline: !!routeSegment?.polyline,
                        hasTransitDetails: false,
                      });
                    }
                  } else if (transportMode === "public") {
                    // 대중교통 모드: ODsay API (상세 정보 포함)
                    const apiStartTime = Date.now();
                    const transitRouteWithDetails =
                      await getBestTransitRouteWithDetails(fromCoord, toCoord);
                    const apiDuration = Date.now() - apiStartTime;

                    if (transitRouteWithDetails) {
                      // TransitRouteWithDetails에서 상세 정보 추출
                      const { details, polyline } = transitRouteWithDetails;
                      const subPathsCount = details.subPaths?.length || 0;
                      const transitSubPathsCount =
                        details.subPaths?.filter((sp) => sp.trafficType !== 3)
                          .length || 0;
                      const walkingSubPathsCount =
                        details.subPaths?.filter((sp) => sp.trafficType === 3)
                          .length || 0;

                      console.log(
                        `[경로 재계산] 대중교통 API 성공 (${apiDuration}ms): ${fromPlaceName} → ${toPlaceName}`,
                        {
                          distance: transitRouteWithDetails.totalDistance,
                          duration: transitRouteWithDetails.totalDuration,
                          fare: transitRouteWithDetails.totalFare,
                          polyline: !!polyline,
                          polylineLength: polyline?.length || 0,
                          transferCount: details.transferCount,
                          totalSubPaths: subPathsCount,
                          transitSubPaths: transitSubPathsCount,
                          walkingSubPaths: walkingSubPathsCount,
                          subPathsWithPolyline:
                            details.subPaths?.filter((sp) => sp.polyline)
                              .length || 0,
                        },
                      );

                      // 열차 경로 감지 및 polyline 보완
                      const hasTrain =
                        details.subPaths?.some((sp) => sp.trafficType === 10) ||
                        false;
                      let finalPolyline = polyline;

                      // 열차 경로이고 polyline이 없거나 너무 짧으면 Kakao Map API로 보완 시도
                      if (hasTrain && (!polyline || polyline.length < 50)) {
                        console.log(
                          `[경로 재계산] 열차 경로 polyline 보완 시도: ${fromPlaceName} → ${toPlaceName}`,
                          {
                            기존polyline길이: polyline?.length || 0,
                            subPathsCount: details.subPaths?.length || 0,
                          },
                        );
                        try {
                          const kakaoRoute = await getKakaoCarRoute({
                            origin: fromCoord,
                            destination: toCoord,
                            priority: "TIME",
                          });

                          if (kakaoRoute?.polyline) {
                            const kakaoPolylineLength =
                              kakaoRoute.polyline.length;
                            const existingPolylineLength =
                              polyline?.length || 0;

                            if (kakaoPolylineLength > existingPolylineLength) {
                              finalPolyline = kakaoRoute.polyline;
                              console.log(
                                `[경로 재계산] ✅ Kakao Map API로 polyline 보완 성공:`,
                                {
                                  기존길이: existingPolylineLength,
                                  보완길이: kakaoPolylineLength,
                                  개선율: `${Math.round((kakaoPolylineLength / Math.max(existingPolylineLength, 1)) * 100)}%`,
                                  주의: "자동차 경로를 사용하므로 열차 경로와 다를 수 있음",
                                },
                              );
                            } else {
                              console.log(
                                `[경로 재계산] ⚠️ Kakao Map API polyline이 기존보다 짧거나 같음:`,
                                {
                                  기존길이: existingPolylineLength,
                                  kakao길이: kakaoPolylineLength,
                                },
                              );
                            }
                          } else {
                            console.warn(
                              `[경로 재계산] Kakao Map API 응답에 polyline 없음`,
                            );
                          }
                        } catch (error) {
                          console.warn(
                            `[경로 재계산] Kakao Map API polyline 보완 실패:`,
                            error,
                          );
                        }
                      }

                      routeSegment = {
                        mode: "public",
                        distance: transitRouteWithDetails.totalDistance,
                        duration: transitRouteWithDetails.totalDuration,
                        fare: transitRouteWithDetails.totalFare,
                        polyline: finalPolyline, // 전체 경로 폴리라인 (보완된 경우 포함)
                        transitDetails: {
                          totalFare: details.totalFare,
                          transferCount: details.transferCount,
                          walkingTime: details.walkingTime,
                          walkingDistance: details.walkingDistance,
                          subPaths: details.subPaths || [],
                        },
                      };
                      routeStatusLog.push({
                        fromPlace: fromPlaceName,
                        toPlace: toPlaceName,
                        status: !isExistingSegment
                          ? hasTrain &&
                            finalPolyline &&
                            finalPolyline.length > (polyline?.length || 0)
                            ? "🆕 새 구간 - 대중교통 API 성공 (열차 경로 Kakao 보완)"
                            : "🆕 새 구간 - 대중교통 API 성공"
                          : hasTrain &&
                              finalPolyline &&
                              finalPolyline.length > (polyline?.length || 0)
                            ? "⚠️ 기존 구간 - 대중교통 API 성공 (열차 경로 Kakao 보완, 재사용 불가)"
                            : "⚠️ 기존 구간 - 대중교통 API 성공 (재사용 불가)",
                        hasPolyline: !!finalPolyline,
                        hasTransitDetails: true,
                        subPathsCount,
                      });
                    } else {
                      console.error(
                        `[경로 재계산] 대중교통 API 실패: ${fromPlaceName} → ${toPlaceName}`,
                      );
                      // API 호출 실패 시 기존 정보 유지
                      routeSegment = currentItem.transportToNext;
                      routeStatusLog.push({
                        fromPlace: fromPlaceName,
                        toPlace: toPlaceName,
                        status: !isExistingSegment
                          ? "🆕 새 구간 - 대중교통 API 실패"
                          : "⚠️ 기존 구간 - 대중교통 API 실패",
                        hasPolyline: !!routeSegment?.polyline,
                        hasTransitDetails: !!routeSegment?.transitDetails,
                      });
                    }
                  }
                } catch (error) {
                  console.error(
                    `[경로 재계산] API 호출 예외: ${fromPlaceName} → ${toPlaceName}`,
                    error,
                  );
                  // 에러 발생 시 기존 정보 유지
                  routeSegment = currentItem.transportToNext;
                  routeStatusLog.push({
                    fromPlace: fromPlaceName,
                    toPlace: toPlaceName,
                    status: !isExistingSegment
                      ? "🆕 새 구간 - API 예외 발생"
                      : "⚠️ 기존 구간 - API 예외 발생",
                    hasPolyline: !!routeSegment?.polyline,
                    hasTransitDetails: !!routeSegment?.transitDetails,
                  });
                }
              }
            }

            updatedSchedule.push({
              ...currentItem,
              transportToNext: routeSegment,
            });
          } else {
            // 마지막 항목
            updatedSchedule.push(currentItem);
          }
        }

        // transportFromOrigin 재계산 (dayOrigin → 첫 장소)
        let updatedTransportFromOrigin = itinerary.transportFromOrigin;
        // dayOrigin 좌표 계산 (itinerary에 없으면 trip 정보로 계산)
        const dayOriginCoord = getDayOriginCoord(
          itinerary.dayNumber,
          itinerary,
          itineraries,
        );

        if (dayOriginCoord && updatedSchedule.length > 0) {
          const firstPlace = placeMap.get(updatedSchedule[0].placeId);
          if (firstPlace) {
            const fromCoord: Coordinate = dayOriginCoord;
            const toCoord: Coordinate = firstPlace.coordinate;
            // dayOrigin 이름 가져오기
            const fromPlaceName =
              itinerary.dayOrigin?.name ||
              (itinerary.dayNumber === 1
                ? trip.origin?.name
                : trip.accommodations?.[0]?.location?.name) ||
              "출발지";
            const toPlaceName = firstPlace.name;

            // 이전 일정과 비교하여 구간이 존재하는지 확인
            const currentSegmentKey = createSegmentKey(
              fromCoord,
              updatedSchedule[0].placeId,
            );
            const isExistingSegment = previousSegments.has(currentSegmentKey);

            // 기존 경로가 있고 첫 장소가 변경되지 않았는지 확인
            const firstPlaceChanged =
              !itinerary.schedule[0] ||
              itinerary.schedule[0].placeId !== updatedSchedule[0].placeId;

            // 재사용 가능 여부 확인
            const canReuseStoredRoute =
              !firstPlaceChanged &&
              isExistingSegment &&
              itinerary.transportFromOrigin &&
              itinerary.transportFromOrigin.duration &&
              itinerary.transportFromOrigin.distance &&
              (transportMode === "public"
                ? itinerary.transportFromOrigin.polyline &&
                  itinerary.transportFromOrigin.polyline.length >= 50 &&
                  itinerary.transportFromOrigin.transitDetails &&
                  itinerary.transportFromOrigin.transitDetails.subPaths &&
                  itinerary.transportFromOrigin.transitDetails.subPaths.length >
                    0
                : itinerary.transportFromOrigin.polyline &&
                  itinerary.transportFromOrigin.polyline.length >= 50);

            if (canReuseStoredRoute) {
              console.log(
                `[경로 재계산] ✅ 출발지 → 첫 장소 - 저장된 경로 재사용: ${fromPlaceName} → ${toPlaceName}`,
              );
              updatedTransportFromOrigin = itinerary.transportFromOrigin;
              routeStatusLog.push({
                fromPlace: fromPlaceName,
                toPlace: toPlaceName,
                status: "출발지 → 첫 장소 - 저장된 경로 재사용",
                hasPolyline: !!itinerary.transportFromOrigin.polyline,
                hasTransitDetails:
                  !!itinerary.transportFromOrigin.transitDetails,
              });
            } else if (
              firstPlaceChanged ||
              !itinerary.transportFromOrigin ||
              !isExistingSegment
            ) {
              console.log(
                `[경로 재계산] 출발지 → 첫 장소 재계산: ${fromPlaceName} → ${toPlaceName}`,
              );
              apiCallCount++;

              try {
                if (transportMode === "car") {
                  const carRouteResult = await getCarRoute({
                    origin: fromCoord,
                    destination: toCoord,
                    priority: "TIME",
                  });
                  if (carRouteResult.success && carRouteResult.data) {
                    updatedTransportFromOrigin = {
                      mode: "car",
                      distance: carRouteResult.data.totalDistance,
                      duration: carRouteResult.data.totalDuration,
                      polyline: carRouteResult.data.polyline,
                      fare: carRouteResult.data.fuelCost,
                    };
                    routeStatusLog.push({
                      fromPlace: fromPlaceName,
                      toPlace: toPlaceName,
                      status: "출발지 → 첫 장소 - 차량 API 성공",
                      hasPolyline: !!carRouteResult.data.polyline,
                      hasTransitDetails: false,
                    });
                  } else {
                    console.warn(
                      `[경로 재계산] 출발지 → 첫 장소 차량 API 실패`,
                    );
                    routeStatusLog.push({
                      fromPlace: fromPlaceName,
                      toPlace: toPlaceName,
                      status: "출발지 → 첫 장소 - 차량 API 실패",
                      hasPolyline: !!updatedTransportFromOrigin?.polyline,
                      hasTransitDetails: false,
                    });
                  }
                } else if (transportMode === "public") {
                  const transitRouteWithDetails =
                    await getBestTransitRouteWithDetails(fromCoord, toCoord);
                  if (transitRouteWithDetails) {
                    const { details, polyline } = transitRouteWithDetails;
                    updatedTransportFromOrigin = {
                      mode: "public",
                      distance: transitRouteWithDetails.totalDistance,
                      duration: transitRouteWithDetails.totalDuration,
                      fare: transitRouteWithDetails.totalFare,
                      polyline,
                      transitDetails: {
                        totalFare: details.totalFare,
                        transferCount: details.transferCount,
                        walkingTime: details.walkingTime,
                        walkingDistance: details.walkingDistance,
                        subPaths: details.subPaths || [],
                      },
                    };
                    routeStatusLog.push({
                      fromPlace: fromPlaceName,
                      toPlace: toPlaceName,
                      status: "출발지 → 첫 장소 - 대중교통 API 성공",
                      hasPolyline: !!polyline,
                      hasTransitDetails: true,
                      subPathsCount: details.subPaths?.length,
                    });
                  } else {
                    console.warn(
                      `[경로 재계산] 출발지 → 첫 장소 대중교통 API 실패`,
                    );
                    routeStatusLog.push({
                      fromPlace: fromPlaceName,
                      toPlace: toPlaceName,
                      status: "출발지 → 첫 장소 - 대중교통 API 실패",
                      hasPolyline: !!updatedTransportFromOrigin?.polyline,
                      hasTransitDetails:
                        !!updatedTransportFromOrigin?.transitDetails,
                    });
                  }
                }
              } catch (error) {
                console.error(
                  `[경로 재계산] 출발지 → 첫 장소 API 예외:`,
                  error,
                );
                routeStatusLog.push({
                  fromPlace: fromPlaceName,
                  toPlace: toPlaceName,
                  status: "출발지 → 첫 장소 - API 예외 발생",
                  hasPolyline: !!updatedTransportFromOrigin?.polyline,
                  hasTransitDetails:
                    !!updatedTransportFromOrigin?.transitDetails,
                });
              }
            } else {
              console.log(`[경로 재계산] 출발지 → 첫 장소 재사용 (변경 없음)`);
            }
          }
        }

        // transportToDestination 재계산 (마지막 장소 → dayDestination)
        let updatedTransportToDestination = itinerary.transportToDestination;
        // dayDestination 좌표 계산 (itinerary에 없으면 trip 정보로 계산)
        const dayDestinationCoord = getDayDestinationCoord(
          itinerary.dayNumber,
          itineraries.length,
          itinerary,
        );

        if (dayDestinationCoord && updatedSchedule.length > 0) {
          const lastPlace = placeMap.get(
            updatedSchedule[updatedSchedule.length - 1].placeId,
          );
          if (lastPlace) {
            const fromCoord: Coordinate = lastPlace.coordinate;
            const toCoord: Coordinate = dayDestinationCoord;
            const fromPlaceName = lastPlace.name;
            // dayDestination 이름 가져오기
            const toPlaceName =
              itinerary.dayDestination?.name ||
              (itinerary.dayNumber === itineraries.length
                ? trip.destination?.name
                : trip.accommodations?.[0]?.location?.name) ||
              "도착지";

            // 이전 일정과 비교하여 구간이 존재하는지 확인
            const currentSegmentKey = createSegmentKey(
              updatedSchedule[updatedSchedule.length - 1].placeId,
              toCoord,
            );
            const isExistingSegment = previousSegments.has(currentSegmentKey);

            // 기존 경로가 있고 마지막 장소가 변경되지 않았는지 확인
            const lastPlaceChanged =
              !itinerary.schedule[itinerary.schedule.length - 1] ||
              itinerary.schedule[itinerary.schedule.length - 1].placeId !==
                updatedSchedule[updatedSchedule.length - 1].placeId;

            // 재사용 가능 여부 확인
            const canReuseStoredRoute =
              !lastPlaceChanged &&
              isExistingSegment &&
              itinerary.transportToDestination &&
              itinerary.transportToDestination.duration &&
              itinerary.transportToDestination.distance &&
              (transportMode === "public"
                ? itinerary.transportToDestination.polyline &&
                  itinerary.transportToDestination.polyline.length >= 50 &&
                  itinerary.transportToDestination.transitDetails &&
                  itinerary.transportToDestination.transitDetails.subPaths &&
                  itinerary.transportToDestination.transitDetails.subPaths
                    .length > 0
                : itinerary.transportToDestination.polyline &&
                  itinerary.transportToDestination.polyline.length >= 50);

            if (canReuseStoredRoute) {
              console.log(
                `[경로 재계산] ✅ 마지막 장소 → 도착지 - 저장된 경로 재사용: ${fromPlaceName} → ${toPlaceName}`,
              );
              updatedTransportToDestination = itinerary.transportToDestination;
              routeStatusLog.push({
                fromPlace: fromPlaceName,
                toPlace: toPlaceName,
                status: "마지막 장소 → 도착지 - 저장된 경로 재사용",
                hasPolyline: !!itinerary.transportToDestination.polyline,
                hasTransitDetails:
                  !!itinerary.transportToDestination.transitDetails,
              });
            } else if (
              lastPlaceChanged ||
              !itinerary.transportToDestination ||
              !isExistingSegment
            ) {
              console.log(
                `[경로 재계산] 마지막 장소 → 도착지 재계산: ${fromPlaceName} → ${toPlaceName}`,
              );
              apiCallCount++;

              try {
                if (transportMode === "car") {
                  const carRouteResult = await getCarRoute({
                    origin: fromCoord,
                    destination: toCoord,
                    priority: "TIME",
                  });
                  if (carRouteResult.success && carRouteResult.data) {
                    updatedTransportToDestination = {
                      mode: "car",
                      distance: carRouteResult.data.totalDistance,
                      duration: carRouteResult.data.totalDuration,
                      polyline: carRouteResult.data.polyline,
                      fare: carRouteResult.data.fuelCost,
                    };
                    routeStatusLog.push({
                      fromPlace: fromPlaceName,
                      toPlace: toPlaceName,
                      status: "마지막 장소 → 도착지 - 차량 API 성공",
                      hasPolyline: !!carRouteResult.data.polyline,
                      hasTransitDetails: false,
                    });
                  } else {
                    console.warn(
                      `[경로 재계산] 마지막 장소 → 도착지 차량 API 실패`,
                    );
                    routeStatusLog.push({
                      fromPlace: fromPlaceName,
                      toPlace: toPlaceName,
                      status: "마지막 장소 → 도착지 - 차량 API 실패",
                      hasPolyline: !!updatedTransportToDestination?.polyline,
                      hasTransitDetails: false,
                    });
                  }
                } else if (transportMode === "public") {
                  const transitRouteWithDetails =
                    await getBestTransitRouteWithDetails(fromCoord, toCoord);
                  if (transitRouteWithDetails) {
                    const { details, polyline } = transitRouteWithDetails;
                    updatedTransportToDestination = {
                      mode: "public",
                      distance: transitRouteWithDetails.totalDistance,
                      duration: transitRouteWithDetails.totalDuration,
                      fare: transitRouteWithDetails.totalFare,
                      polyline,
                      transitDetails: {
                        totalFare: details.totalFare,
                        transferCount: details.transferCount,
                        walkingTime: details.walkingTime,
                        walkingDistance: details.walkingDistance,
                        subPaths: details.subPaths || [],
                      },
                    };
                    routeStatusLog.push({
                      fromPlace: fromPlaceName,
                      toPlace: toPlaceName,
                      status: "마지막 장소 → 도착지 - 대중교통 API 성공",
                      hasPolyline: !!polyline,
                      hasTransitDetails: true,
                      subPathsCount: details.subPaths?.length,
                    });
                  } else {
                    console.warn(
                      `[경로 재계산] 마지막 장소 → 도착지 대중교통 API 실패`,
                    );
                    routeStatusLog.push({
                      fromPlace: fromPlaceName,
                      toPlace: toPlaceName,
                      status: "마지막 장소 → 도착지 - 대중교통 API 실패",
                      hasPolyline: !!updatedTransportToDestination?.polyline,
                      hasTransitDetails:
                        !!updatedTransportToDestination?.transitDetails,
                    });
                  }
                }
              } catch (error) {
                console.error(
                  `[경로 재계산] 마지막 장소 → 도착지 API 예외:`,
                  error,
                );
                routeStatusLog.push({
                  fromPlace: fromPlaceName,
                  toPlace: toPlaceName,
                  status: "마지막 장소 → 도착지 - API 예외 발생",
                  hasPolyline: !!updatedTransportToDestination?.polyline,
                  hasTransitDetails:
                    !!updatedTransportToDestination?.transitDetails,
                });
              }
            } else {
              console.log(
                `[경로 재계산] 마지막 장소 → 도착지 재사용 (변경 없음)`,
              );
            }
          }
        }

        return {
          ...itinerary,
          schedule: updatedSchedule,
          transportFromOrigin: updatedTransportFromOrigin,
          transportToDestination: updatedTransportToDestination,
        };
      }),
    );

    // 4. 시간 재계산
    const recalculatedItineraries = recalculateItineraryTimes(
      updatedItineraries,
      trip.dailyStartTime || "10:00",
      trip.dailyEndTime || "22:00",
    );

    // 5. DB 저장
    const savePromises = recalculatedItineraries.map((itinerary) =>
      updateDayItinerary({
        tripId,
        dayNumber: itinerary.dayNumber,
        schedule: itinerary.schedule,
        totalDistance: itinerary.totalDistance,
        totalDuration: itinerary.totalDuration,
        totalStayDuration: itinerary.totalStayDuration,
        transportFromOrigin: itinerary.transportFromOrigin,
        transportToDestination: itinerary.transportToDestination,
      }),
    );

    const saveResults = await Promise.all(savePromises);

    // 저장 실패한 일정이 있는지 확인
    const failedSaves = saveResults.filter((result) => !result.success);
    if (failedSaves.length > 0) {
      const errorMessages = failedSaves
        .map((result) => result.error)
        .filter(Boolean)
        .join(", ");

      return {
        success: false,
        error: `일부 일정 저장에 실패했습니다: ${errorMessages}`,
      };
    }

    const totalDuration = Date.now() - startTime;
    const routesWithPolyline = routeStatusLog.filter(
      (r) => r.hasPolyline,
    ).length;
    const routesWithTransitDetails = routeStatusLog.filter(
      (r) => r.hasTransitDetails,
    ).length;
    const routesReused = routeStatusLog.filter(
      (r) => r.status.includes("재사용") || r.status.includes("기존"),
    ).length;
    const routesApiSuccess = routeStatusLog.filter((r) =>
      r.status.includes("API 성공"),
    ).length;
    const routesApiFailed = routeStatusLog.filter(
      (r) => r.status.includes("API 실패") || r.status.includes("예외"),
    ).length;

    console.log(`[경로 재계산] 완료 - 총 소요 시간: ${totalDuration}ms`);
    console.log(`[경로 재계산] 통계:`, {
      총구간수: routeStatusLog.length,
      API호출횟수: apiCallCount,
      API성공: routesApiSuccess,
      API실패: routesApiFailed,
      재사용: routesReused,
      polyline있음: routesWithPolyline,
      polyline없음: routeStatusLog.length - routesWithPolyline,
      transitDetails있음: routesWithTransitDetails,
      transitDetails없음: routeStatusLog.length - routesWithTransitDetails,
    });
    console.table(routeStatusLog);
    console.groupEnd();

    return {
      success: true,
      data: recalculatedItineraries,
    };
  } catch (error) {
    console.error("[경로 재계산] 예외 발생:", error);
    console.log(`[경로 재계산] 통계:`, {
      총구간수: routeStatusLog.length,
      API호출횟수: apiCallCount,
    });
    console.table(routeStatusLog);
    console.groupEnd();
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
