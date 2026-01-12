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
import type { DailyItinerary, ScheduleItem } from "@/types/schedule";
import type { TransportMode, RouteSegment } from "@/types/route";
import type { Coordinate } from "@/types/place";
import { getTrip } from "@/actions/trips/get-trip";
import { getPlaces } from "@/actions/places";
import { getCarRoute } from "@/actions/routes/get-car-route";
import { getTransitRoute } from "@/actions/routes/get-transit-route";
import { getBestTransitRouteWithDetails } from "@/lib/api/odsay";
import { getCarRoute as getKakaoCarRoute } from "@/lib/api/kakao";
import { recalculateItineraryTimes } from "@/lib/optimize/recalculate-time";
import {
  getRouteFromStoredItinerary,
} from "@/lib/optimize/reuse-route-info";
import { updateDayItinerary } from "./update-itinerary";

export interface RecalculateRoutesInput {
  tripId: string;
  itineraries: DailyItinerary[];
}

export interface RecalculateRoutesResult {
  success: boolean;
  data?: DailyItinerary[];
  error?: string;
}

/**
 * 경로 재계산 Server Action
 *
 * @param input - 재계산할 일정 정보
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

    const { tripId, itineraries } = input;
    console.log(`[경로 재계산] 일정 수: ${itineraries.length}일차`);

    // 2. Trip 정보 조회 (이동 수단 확인)
    const tripResult = await getTrip(tripId);
    if (!tripResult.success || !tripResult.data) {
      return {
        success: false,
        error: tripResult.error || "여행 정보를 찾을 수 없습니다.",
      };
    }

    const trip = tripResult.data;
    const transportMode: TransportMode = trip.transportModes[0] || "car";

    // 3. 장소 정보 조회 (좌표 필요)
    const placesResult = await getPlaces(tripId);
    if (!placesResult.success || !placesResult.data) {
      return {
        success: false,
        error: "장소 정보를 불러올 수 없습니다.",
      };
    }

    const places = placesResult.data;
    const placeMap = new Map(places.map((p) => [p.id, p]));

    // 4. 각 구간별로 재사용 가능 여부 판단 및 새로 생긴 구간만 API 호출
    const updatedItineraries = await Promise.all(
      itineraries.map(async (itinerary) => {
        console.log(`[경로 재계산] ${itinerary.dayNumber}일차 처리 시작 - 장소 수: ${itinerary.schedule.length}`);
        const updatedSchedule: ScheduleItem[] = [];

        for (let i = 0; i < itinerary.schedule.length; i++) {
          const currentItem = itinerary.schedule[i];
          const nextItem = itinerary.schedule[i + 1];

          // 마지막 항목이 아니면 다음 장소까지의 경로 정보 필요
          if (nextItem) {
            let routeSegment = currentItem.transportToNext;
            const fromPlace = placeMap.get(currentItem.placeId);
            const toPlace = placeMap.get(nextItem.placeId);

            const fromPlaceName = fromPlace?.name || currentItem.placeName;
            const toPlaceName = toPlace?.name || nextItem.placeName;

            if (!fromPlace || !toPlace) {
              // 장소 정보가 없으면 기존 정보 유지
              console.warn(`[경로 재계산] 장소 정보 없음: ${currentItem.placeId} → ${nextItem.placeId}`);
              routeSegment = currentItem.transportToNext;
              routeStatusLog.push({
                fromPlace: fromPlaceName,
                toPlace: toPlaceName,
                status: "장소 정보 없음",
                hasPolyline: !!routeSegment?.polyline,
                hasTransitDetails: !!routeSegment?.transitDetails,
              });
            } else {
              // 경로 재계산: 기존 정보가 있어도 상세 정보(polyline, transitDetails)가 없으면 새로 조회
              const hasExistingRoute = !!routeSegment;
              const hasDuration = !!routeSegment?.duration;
              const hasDistance = !!routeSegment?.distance;
              const hasPolyline = !!routeSegment?.polyline;
              const hasTransitDetails = !!routeSegment?.transitDetails;
              
              const needsRecalculation = 
                !routeSegment || 
                !routeSegment.duration || 
                !routeSegment.distance ||
                (transportMode === "public" && (!routeSegment.polyline || !routeSegment.transitDetails)) ||
                (transportMode === "car" && !routeSegment.polyline);

              console.log(`[경로 재계산] ${fromPlaceName} → ${toPlaceName}`, {
                기존경로존재: hasExistingRoute,
                duration: hasDuration,
                distance: hasDistance,
                polyline: hasPolyline,
                transitDetails: hasTransitDetails,
                재계산필요: needsRecalculation,
              });

              if (needsRecalculation) {
                // 1. 먼저 저장된 일정에서 재사용 시도 (대중교통 모드 및 차량 모드)
                const storedRoute = await getRouteFromStoredItinerary(
                  tripId,
                  currentItem.placeId,
                  nextItem.placeId,
                );

                // 저장된 경로가 있고 상세 정보도 있으면 재사용
                if (storedRoute && 
                    storedRoute.duration && 
                    storedRoute.distance &&
                    (transportMode === "public" 
                      ? (storedRoute.polyline && storedRoute.transitDetails)
                      : storedRoute.polyline)) {
                  console.log(`[경로 재계산] 저장된 경로 재사용: ${fromPlaceName} → ${toPlaceName}`, {
                    polyline: !!storedRoute.polyline,
                    transitDetails: !!storedRoute.transitDetails,
                    subPathsCount: storedRoute.transitDetails?.subPaths?.length || 0,
                  });
                  routeSegment = storedRoute;
                  routeStatusLog.push({
                    fromPlace: fromPlaceName,
                    toPlace: toPlaceName,
                    status: "저장된 경로 재사용",
                    hasPolyline: !!storedRoute.polyline,
                    hasTransitDetails: !!storedRoute.transitDetails,
                    subPathsCount: storedRoute.transitDetails?.subPaths?.length,
                  });
                } else {
                  // 2. 재사용할 수 없으면 API 호출로 새로 조회
                  const fromCoord: Coordinate = fromPlace.coordinate;
                  const toCoord: Coordinate = toPlace.coordinate;

                  console.log(`[경로 재계산] API 호출 시작: ${fromPlaceName} → ${toPlaceName}`, {
                    fromCoord,
                    toCoord,
                    transportMode,
                  });
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
                        console.log(`[경로 재계산] 차량 API 성공 (${apiDuration}ms): ${fromPlaceName} → ${toPlaceName}`, {
                          distance: carRouteResult.data.totalDistance,
                          duration: carRouteResult.data.totalDuration,
                          polyline: !!carRouteResult.data.polyline,
                          polylineLength: carRouteResult.data.polyline?.length || 0,
                        });
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
                          status: "차량 API 성공",
                          hasPolyline: !!carRouteResult.data.polyline,
                          hasTransitDetails: false,
                        });
                      } else {
                        console.error(`[경로 재계산] 차량 API 실패: ${fromPlaceName} → ${toPlaceName}`, carRouteResult);
                        // API 호출 실패 시 기존 정보 유지
                        routeSegment = currentItem.transportToNext;
                        routeStatusLog.push({
                          fromPlace: fromPlaceName,
                          toPlace: toPlaceName,
                          status: "차량 API 실패",
                          hasPolyline: !!routeSegment?.polyline,
                          hasTransitDetails: false,
                        });
                      }
                    } else if (transportMode === "public") {
                      // 대중교통 모드: ODsay API (상세 정보 포함)
                      const apiStartTime = Date.now();
                      const transitRouteWithDetails = await getBestTransitRouteWithDetails(
                        fromCoord,
                        toCoord
                      );
                      const apiDuration = Date.now() - apiStartTime;

                      if (transitRouteWithDetails) {
                        // TransitRouteWithDetails에서 상세 정보 추출
                        const { details, polyline } = transitRouteWithDetails;
                        const subPathsCount = details.subPaths?.length || 0;
                        const transitSubPathsCount = details.subPaths?.filter(sp => sp.trafficType !== 3).length || 0;
                        const walkingSubPathsCount = details.subPaths?.filter(sp => sp.trafficType === 3).length || 0;

                        console.log(`[경로 재계산] 대중교통 API 성공 (${apiDuration}ms): ${fromPlaceName} → ${toPlaceName}`, {
                          distance: transitRouteWithDetails.totalDistance,
                          duration: transitRouteWithDetails.totalDuration,
                          fare: transitRouteWithDetails.totalFare,
                          polyline: !!polyline,
                          polylineLength: polyline?.length || 0,
                          transferCount: details.transferCount,
                          totalSubPaths: subPathsCount,
                          transitSubPaths: transitSubPathsCount,
                          walkingSubPaths: walkingSubPathsCount,
                          subPathsWithPolyline: details.subPaths?.filter(sp => sp.polyline).length || 0,
                        });

                        // 열차 경로 감지 및 polyline 보완
                        const hasTrain = details.subPaths?.some(sp => sp.trafficType === 10) || false;
                        let finalPolyline = polyline;
                        
                        // 열차 경로이고 polyline이 없거나 너무 짧으면 Kakao Map API로 보완 시도
                        if (hasTrain && (!polyline || polyline.length < 50)) {
                          console.log(`[경로 재계산] 열차 경로 polyline 보완 시도: ${fromPlaceName} → ${toPlaceName}`, {
                            기존polyline길이: polyline?.length || 0,
                            subPathsCount: details.subPaths?.length || 0,
                          });
                          try {
                            const kakaoRoute = await getKakaoCarRoute({
                              origin: fromCoord,
                              destination: toCoord,
                              priority: "TIME",
                            });
                            
                            if (kakaoRoute?.polyline) {
                              const kakaoPolylineLength = kakaoRoute.polyline.length;
                              const existingPolylineLength = polyline?.length || 0;
                              
                              if (kakaoPolylineLength > existingPolylineLength) {
                                finalPolyline = kakaoRoute.polyline;
                                console.log(`[경로 재계산] ✅ Kakao Map API로 polyline 보완 성공:`, {
                                  기존길이: existingPolylineLength,
                                  보완길이: kakaoPolylineLength,
                                  개선율: `${Math.round((kakaoPolylineLength / Math.max(existingPolylineLength, 1)) * 100)}%`,
                                  주의: "자동차 경로를 사용하므로 열차 경로와 다를 수 있음",
                                });
                              } else {
                                console.log(`[경로 재계산] ⚠️ Kakao Map API polyline이 기존보다 짧거나 같음:`, {
                                  기존길이: existingPolylineLength,
                                  kakao길이: kakaoPolylineLength,
                                });
                              }
                            } else {
                              console.warn(`[경로 재계산] Kakao Map API 응답에 polyline 없음`);
                            }
                          } catch (error) {
                            console.warn(`[경로 재계산] Kakao Map API polyline 보완 실패:`, error);
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
                          status: hasTrain && finalPolyline && finalPolyline.length > (polyline?.length || 0)
                            ? "대중교통 API 성공 (열차 경로 Kakao 보완)"
                            : "대중교통 API 성공",
                          hasPolyline: !!finalPolyline,
                          hasTransitDetails: true,
                          subPathsCount,
                        });
                      } else {
                        console.error(`[경로 재계산] 대중교통 API 실패: ${fromPlaceName} → ${toPlaceName}`);
                        // API 호출 실패 시 기존 정보 유지
                        routeSegment = currentItem.transportToNext;
                        routeStatusLog.push({
                          fromPlace: fromPlaceName,
                          toPlace: toPlaceName,
                          status: "대중교통 API 실패",
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
                      status: "API 예외 발생",
                      hasPolyline: !!routeSegment?.polyline,
                      hasTransitDetails: !!routeSegment?.transitDetails,
                    });
                  }
                }
              } else {
                // 기존 정보가 완전하면 그대로 사용
                console.log(`[경로 재계산] 기존 경로 사용: ${fromPlaceName} → ${toPlaceName}`, {
                  polyline: !!routeSegment?.polyline,
                  transitDetails: !!routeSegment?.transitDetails,
                  subPathsCount: routeSegment?.transitDetails?.subPaths?.length || 0,
                });
                routeSegment = currentItem.transportToNext;
                routeStatusLog.push({
                  fromPlace: fromPlaceName,
                  toPlace: toPlaceName,
                  status: "기존 경로 사용",
                  hasPolyline: !!routeSegment?.polyline,
                  hasTransitDetails: !!routeSegment?.transitDetails,
                  subPathsCount: routeSegment?.transitDetails?.subPaths?.length,
                });
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

        return {
          ...itinerary,
          schedule: updatedSchedule,
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
    const routesWithPolyline = routeStatusLog.filter(r => r.hasPolyline).length;
    const routesWithTransitDetails = routeStatusLog.filter(r => r.hasTransitDetails).length;
    const routesReused = routeStatusLog.filter(r => r.status.includes("재사용") || r.status.includes("기존")).length;
    const routesApiSuccess = routeStatusLog.filter(r => r.status.includes("API 성공")).length;
    const routesApiFailed = routeStatusLog.filter(r => r.status.includes("API 실패") || r.status.includes("예외")).length;

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

