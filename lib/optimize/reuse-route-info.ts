/**
 * @file reuse-route-info.ts
 * @description 경로 정보 재사용 유틸리티 함수 (Server-only)
 *
 * 편집 모드에서 순서 변경 시, 기존에 조회한 경로 정보를 재사용하여
 * API 호출을 최소화합니다.
 *
 * 주요 기능:
 * 1. 대중교통 모드: trip_itineraries 테이블에서 기존 경로 정보 검색
 *
 * ⚠️ 이 파일은 Server-only입니다. Client Component에서 사용할 수 없습니다.
 * Client-safe 함수는 reuse-route-info-client.ts를 참조하세요.
 *
 * @dependencies
 * - @/types/schedule: RouteSegment
 * - @/types/route: RouteSegment
 * - @/lib/supabase/server: createClerkSupabaseClient
 *
 * @see {@link .cursor/design/itinerary-edit-mode.md} - 설계 문서
 */

import "server-only";

import { createClerkSupabaseClient } from "@/lib/supabase/server";
import type { RouteSegment } from "@/types/route";
import type { TripItineraryRow, ScheduleItemRow } from "@/types/schedule";

/**
 * TransportInfoRow를 RouteSegment로 변환
 */
function convertTransportInfoToRouteSegment(
  transport: TripItineraryRow["transport_from_origin"],
): RouteSegment | null {
  if (!transport) return null;

  return {
    mode: transport.mode as "walking" | "public" | "car",
    distance: transport.distance,
    duration: transport.duration,
    description: transport.description,
    fare: transport.fare,
    polyline: transport.polyline,
    transitDetails: transport.transit_details
      ? {
          totalFare: transport.transit_details.total_fare,
          transferCount: transport.transit_details.transfer_count,
          walkingTime: transport.transit_details.walking_time,
          walkingDistance: transport.transit_details.walking_distance,
          subPaths: transport.transit_details.sub_paths.map((sp) => ({
            trafficType: sp.traffic_type,
            distance: sp.distance,
            sectionTime: sp.section_time,
            stationCount: sp.station_count,
            startName: sp.start_name,
            endName: sp.end_name,
            polyline: sp.polyline,
            lane: sp.lane
              ? {
                  name: sp.lane.name,
                  busNo: sp.lane.bus_no,
                  busType: sp.lane.bus_type,
                  subwayCode: sp.lane.subway_code,
                  lineColor: sp.lane.line_color,
                }
              : undefined,
            way: sp.way,
          })),
        }
      : undefined,
  };
}

/**
 * trip_itineraries 테이블에서 기존 경로 정보 검색 (대중교통 모드)
 *
 * @param tripId - 여행 ID
 * @param fromPlaceId - 출발지 장소 ID
 * @param toPlaceId - 도착지 장소 ID
 * @returns 경로 정보 또는 null
 */
export async function getRouteFromStoredItinerary(
  tripId: string,
  fromPlaceId: string,
  toPlaceId: string,
): Promise<RouteSegment | null> {
  try {
    // 1. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 2. trip_itineraries 테이블에서 모든 일정 조회
    const { data: itineraries, error } = await supabase
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true });

    if (error) {
      console.error("일정 조회 오류:", error);
      return null;
    }

    if (!itineraries || itineraries.length === 0) {
      return null;
    }

    // 3. 각 일정의 schedule에서 일치하는 구간 찾기
    for (const row of itineraries as TripItineraryRow[]) {
      const schedule = row.schedule as ScheduleItemRow[];

      for (let i = 0; i < schedule.length - 1; i++) {
        const currentItem = schedule[i];
        const nextItem = schedule[i + 1];

        // 일치하는 구간 찾기
        if (
          currentItem.place_id === fromPlaceId &&
          nextItem.place_id === toPlaceId &&
          currentItem.transport_to_next
        ) {
          // RouteSegment 형식으로 변환
          return convertTransportInfoToRouteSegment(
            currentItem.transport_to_next,
          );
        }
      }
    }

    // 일치하는 구간이 없으면 null 반환
    return null;
  } catch (error) {
    console.error("경로 정보 검색 중 예외 발생:", error);
    return null;
  }
}

