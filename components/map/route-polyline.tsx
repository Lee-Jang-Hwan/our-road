"use client";

import * as React from "react";
import { useKakaoMap } from "./kakao-map";
import type { Coordinate } from "@/types/place";
import type { TransportMode } from "@/types/route";
import { getSegmentColor } from "@/lib/utils";
import {
  offsetPolyline,
  calculateRouteOffsets,
  decodePolyline as decodePolylineUtil,
} from "@/lib/utils/polyline-offset";

// ============================================
// Polyline Decoding (Google Polyline Algorithm)
// ============================================

/**
 * 인코딩된 폴리라인을 좌표 배열로 디코딩
 * @param encoded - 인코딩된 폴리라인 문자열
 * @returns 좌표 배열
 */
function decodePolyline(encoded: string): Coordinate[] {
  const points: Coordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Decode latitude
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    // Decode longitude
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

interface RoutePolylineProps {
  /** 경로 좌표 배열 */
  path?: Coordinate[];
  /** 인코딩된 폴리라인 문자열 (Google Polyline Algorithm) */
  encodedPath?: string;
  /** 이동 수단 (색상 결정) */
  transportMode?: TransportMode;
  /** 선 두께 */
  strokeWeight?: number;
  /** 선 색상 (커스텀) */
  strokeColor?: string;
  /** 선 투명도 (0-1) */
  strokeOpacity?: number;
  /** 선 스타일 */
  strokeStyle?:
    | "solid"
    | "shortdash"
    | "shortdot"
    | "shortdashdot"
    | "dot"
    | "dash"
    | "dashdot"
    | "longdash"
    | "longdashdot";
  /** z-index */
  zIndex?: number;
}

// 이동 수단별 색상
const TRANSPORT_COLORS: Record<TransportMode, string> = {
  walking: "#f97316", // orange-500
  public: "#1d4ed8", // blue-700 (더 진하게)
  car: "#22c55e", // green-500
};

// 숙소 마커 색상 (place-markers.tsx와 동일)
const ACCOMMODATION_COLOR = "#a855f7"; // purple-500

// 도착지 경로 색상 (하늘색)
const DESTINATION_COLOR = "#06b6d4"; // cyan-500 (더 연하게)

/**
 * 경로 폴리라인 컴포넌트
 */
export function RoutePolyline({
  path,
  encodedPath,
  transportMode = "public",
  strokeWeight = 4,
  strokeColor,
  strokeOpacity = 0.8,
  strokeStyle = "solid",
  zIndex = 1,
}: RoutePolylineProps) {
  const { map, isReady } = useKakaoMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef = React.useRef<any>(null);

  // 인코딩된 경로가 있으면 디코딩, 아니면 path 사용
  const actualPath = React.useMemo(() => {
    if (encodedPath) {
      const decoded = decodePolyline(encodedPath);
      return decoded;
    }
    return path || [];
  }, [encodedPath, path]);

  React.useEffect(() => {
    if (!map || !isReady || actualPath.length < 2) {
      return;
    }

    const linePath = actualPath.map(
      (coord) => new window.kakao.maps.LatLng(coord.lat, coord.lng),
    );

    const color = strokeColor || TRANSPORT_COLORS[transportMode];

    if (polylineRef.current) {
      // 기존 폴리라인 업데이트
      polylineRef.current.setPath(linePath);
      polylineRef.current.setOptions({
        strokeWeight,
        strokeColor: color,
        strokeOpacity,
        strokeStyle,
        zIndex,
      });
    } else {
      // 새 폴리라인 생성
      polylineRef.current = new window.kakao.maps.Polyline({
        map,
        path: linePath,
        strokeWeight,
        strokeColor: color,
        strokeOpacity,
        strokeStyle,
        zIndex,
      });
    }
  }, [
    map,
    isReady,
    actualPath,
    transportMode,
    strokeWeight,
    strokeColor,
    strokeOpacity,
    strokeStyle,
    zIndex,
  ]);

  // cleanup
  React.useEffect(() => {
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, []);

  return null;
}

interface RouteSegmentData {
  /** 구간 ID */
  id: string;
  /** 경로 좌표 */
  path: Coordinate[];
  /** 이동 수단 */
  transportMode: TransportMode;
}

interface MultiRoutePolylineProps {
  /** 경로 구간 배열 */
  segments: RouteSegmentData[];
  /** 선택된 구간 ID */
  selectedSegmentId?: string;
  /** 구간 클릭 핸들러 */
  onSegmentClick?: (segmentId: string) => void;
}

/**
 * 다중 경로 구간 폴리라인 컴포넌트
 */
export function MultiRoutePolyline({
  segments,
  selectedSegmentId,
}: MultiRoutePolylineProps) {
  const { map, isReady } = useKakaoMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylinesRef = React.useRef<Map<string, any>>(new Map());

  React.useEffect(() => {
    if (!map || !isReady) return;

    const currentPolylines = polylinesRef.current;
    const newSegmentIds = new Set(segments.map((s) => s.id));

    // 기존 폴리라인 중 더 이상 없는 것 제거
    currentPolylines.forEach((polyline, id) => {
      if (!newSegmentIds.has(id)) {
        polyline.setMap(null);
        currentPolylines.delete(id);
      }
    });

    // 폴리라인 생성 또는 업데이트
    segments.forEach((segment, index) => {
      const { id, path, transportMode } = segment;

      if (path.length < 2) return;

      const linePath = path.map(
        (coord) => new window.kakao.maps.LatLng(coord.lat, coord.lng),
      );

      const isSelected = id === selectedSegmentId;
      const color = TRANSPORT_COLORS[transportMode];
      const weight = isSelected ? 6 : 4;
      const opacity = isSelected ? 1 : 0.7;

      let polyline = currentPolylines.get(id);

      if (polyline) {
        polyline.setPath(linePath);
        polyline.setOptions({
          strokeWeight: weight,
          strokeOpacity: opacity,
          zIndex: isSelected ? 10 : index,
        });
      } else {
        polyline = new window.kakao.maps.Polyline({
          map,
          path: linePath,
          strokeWeight: weight,
          strokeColor: color,
          strokeOpacity: opacity,
          strokeStyle: "solid",
          zIndex: isSelected ? 10 : index,
        });

        currentPolylines.set(id, polyline);
      }
    });
  }, [map, isReady, segments, selectedSegmentId]);

  // cleanup
  React.useEffect(() => {
    const polylines = polylinesRef.current;
    return () => {
      polylines.forEach((polyline) => {
        polyline.setMap(null);
      });
      polylines.clear();
    };
  }, []);

  return null;
}

interface DirectRoutePolylineProps {
  /** 출발지 */
  origin: Coordinate;
  /** 도착지 */
  destination: Coordinate;
  /** 경유지 배열 */
  waypoints?: Coordinate[];
  /** 이동 수단 */
  transportMode?: TransportMode;
  /** 직선 연결 (실제 경로 대신) */
  straight?: boolean;
  /** 커스텀 선 색상 */
  strokeColor?: string;
}

/**
 * 출발지-경유지-도착지를 연결하는 간단한 폴리라인
 */
export function DirectRoutePolyline({
  origin,
  destination,
  waypoints = [],
  transportMode = "public",
  straight = true,
  strokeColor,
}: DirectRoutePolylineProps) {
  const path = React.useMemo(() => {
    return [origin, ...waypoints, destination];
  }, [origin, destination, waypoints]);

  if (!straight) {
    // 실제 경로 API를 사용해야 하는 경우
    // 여기서는 단순히 직선으로 연결
    return null;
  }

  return (
    <RoutePolyline
      path={path}
      transportMode={transportMode}
      strokeColor={strokeColor}
      strokeStyle="shortdash"
      strokeOpacity={0.6}
    />
  );
}

// ============================================
// Real Route Polyline (실제 경로 표시)
// ============================================

interface RealRoutePolylineProps {
  /** 경로 구간 배열 - path 또는 encodedPath가 있으면 실제 경로, 없으면 직선 */
  segments: Array<{
    from: Coordinate;
    to: Coordinate;
    path?: Coordinate[];
    encodedPath?: string;
    transportMode: TransportMode;
    segmentIndex?: number;
    /** 숙소로 가는 경로 여부 */
    isToAccommodation?: boolean;
    /** 숙소에서 출발하는 경로 여부 */
    isFromAccommodation?: boolean;
    /** 도착지로 가는 경로 여부 */
    isToDestination?: boolean;
  }>;
  /** 선 두께 */
  strokeWeight?: number;
  /** 선 투명도 */
  strokeOpacity?: number;
  /** 구간별 색상 사용 여부 (true면 각 구간마다 다른 색상) */
  useSegmentColors?: boolean;
  /** 선택된 구간 인덱스 (더 두껍고 불투명하게 표시) */
  selectedSegmentIndex?: number;
  /** 오프셋 적용 여부 (기본값: true) */
  enableOffset?: boolean;
}

/**
 * 실제 경로 폴리라인 컴포넌트
 * - path 배열이 있으면 좌표 배열로 경로 표시
 * - encodedPath가 있으면 인코딩된 폴리라인으로 경로 표시
 * - 둘 다 없으면 직선으로 연결
 * - useSegmentColors가 true면 각 구간마다 다른 색상 사용
 * - 도보 구간(walking)은 항상 주황색으로 표시 (useSegmentColors와 관계없이)
 * - 숙소로 가는 경로는 숙소 마커와 동일한 색상(#a855f7)으로 표시
 * - 숙소에서 출발하는 경로는 목적지 구간별 색상 사용
 * - 도착지로 가는 경로는 하늘색(#06b6d4)으로 표시
 * - 여러 경로가 겹칠 때 오프셋을 적용하여 나란히 표시
 * - 선택된 경로는 더 두껍고 불투명하게, 비선택 경로는 더 얇고 투명하게 표시
 */
export function RealRoutePolyline({
  segments,
  strokeWeight = 4,
  strokeOpacity = 0.8,
  useSegmentColors = false,
  selectedSegmentIndex,
  enableOffset = true,
}: RealRoutePolylineProps) {
  // 오프셋 계산 (여러 경로가 겹칠 때 나란히 표시)
  const offsets = React.useMemo(() => {
    if (!enableOffset || segments.length <= 1) {
      return segments.map(() => 0);
    }
    return calculateRouteOffsets(segments.length, 0); // 12미터 간격
  }, [segments.length, enableOffset]);

  return (
    <>
      {segments.map((segment, index) => {
        // 구간별 색상 또는 이동 수단별 색상
        // 우선순위: 숙소로 가는 경로 > 도착지 경로 > 구간별 색상 > 이동 수단별 색상
        const strokeColor = segment.isToAccommodation
          ? ACCOMMODATION_COLOR
          : segment.isToDestination
            ? DESTINATION_COLOR
            : useSegmentColors
              ? getSegmentColor(segment.segmentIndex ?? index)
              : TRANSPORT_COLORS[segment.transportMode];

        // 선택된 경로는 더 두껍고 불투명하게, 비선택 경로는 더 얇고 투명하게
        const isSelected =
          selectedSegmentIndex !== undefined && index === selectedSegmentIndex;
        const actualStrokeWeight = isSelected ? strokeWeight + 2 : strokeWeight;
        const actualStrokeOpacity = isSelected
          ? Math.min(strokeOpacity + 0.2, 1)
          : strokeOpacity * 0.9;
        const actualZIndex = isSelected ? 100 + index : index + 1;

        if (segment.encodedPath) {
          // 실제 경로 (인코딩된 폴리라인)
          let path = decodePolylineUtil(segment.encodedPath);

          // 오프셋 적용
          if (enableOffset && offsets[index] !== 0 && path.length >= 2) {
            path = offsetPolyline(path, offsets[index]);
          }

          return (
            <RoutePolyline
              key={`route-${index}`}
              path={path}
              strokeColor={strokeColor}
              strokeWeight={actualStrokeWeight}
              strokeOpacity={actualStrokeOpacity}
              strokeStyle="solid"
              zIndex={actualZIndex}
            />
          );
        } else if (segment.path && segment.path.length > 1) {
          // 좌표 배열로 경로 표시
          let path = segment.path;

          // 오프셋 적용
          if (enableOffset && offsets[index] !== 0) {
            path = offsetPolyline(path, offsets[index]);
          }

          return (
            <RoutePolyline
              key={`route-${index}`}
              path={path}
              strokeColor={strokeColor}
              strokeWeight={actualStrokeWeight}
              strokeOpacity={actualStrokeOpacity}
              strokeStyle="solid"
              zIndex={actualZIndex}
            />
          );
        } else {
          // 직선 연결 (폴백)
          // 도보 구간은 실선, 그 외는 점선으로 표시
          const isWalkingFallback = segment.transportMode === "walking";
          let path = [segment.from, segment.to];

          // 오프셋 적용 (직선 경로에도 적용)
          if (enableOffset && offsets[index] !== 0) {
            path = offsetPolyline(path, offsets[index]);
          }

          return (
            <RoutePolyline
              key={`route-${index}`}
              path={path}
              strokeColor={strokeColor}
              strokeWeight={
                isWalkingFallback ? actualStrokeWeight : actualStrokeWeight - 1
              }
              strokeOpacity={actualStrokeOpacity}
              strokeStyle={isWalkingFallback ? "solid" : "shortdash"}
              zIndex={actualZIndex}
            />
          );
        }
      })}
    </>
  );
}

export type {
  RoutePolylineProps,
  RouteSegmentData,
  MultiRoutePolylineProps,
  DirectRoutePolylineProps,
  RealRoutePolylineProps,
};
