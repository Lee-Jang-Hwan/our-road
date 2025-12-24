"use client";

import * as React from "react";
import { useKakaoMap, kakao } from "./kakao-map";
import type { Coordinate } from "@/types/place";
import type { TransportMode } from "@/types/route";

interface RoutePolylineProps {
  /** 경로 좌표 배열 */
  path: Coordinate[];
  /** 이동 수단 (색상 결정) */
  transportMode?: TransportMode;
  /** 선 두께 */
  strokeWeight?: number;
  /** 선 색상 (커스텀) */
  strokeColor?: string;
  /** 선 투명도 (0-1) */
  strokeOpacity?: number;
  /** 선 스타일 */
  strokeStyle?: "solid" | "shortdash" | "shortdot" | "shortdashdot" | "dot" | "dash" | "dashdot" | "longdash" | "longdashdot";
  /** z-index */
  zIndex?: number;
}

// 이동 수단별 색상
const TRANSPORT_COLORS: Record<TransportMode, string> = {
  walking: "#f97316", // orange-500
  public: "#3b82f6",  // blue-500
  car: "#22c55e",     // green-500
};

/**
 * 경로 폴리라인 컴포넌트
 */
export function RoutePolyline({
  path,
  transportMode = "public",
  strokeWeight = 4,
  strokeColor,
  strokeOpacity = 0.8,
  strokeStyle = "solid",
  zIndex = 1,
}: RoutePolylineProps) {
  const { map, isReady } = useKakaoMap();
  const polylineRef = React.useRef<kakao.maps.Polyline | null>(null);

  React.useEffect(() => {
    if (!map || !isReady || path.length < 2) return;

    const linePath = path.map(
      (coord) => new kakao.maps.LatLng(coord.lat, coord.lng)
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
      polylineRef.current = new kakao.maps.Polyline({
        map,
        path: linePath,
        strokeWeight,
        strokeColor: color,
        strokeOpacity,
        strokeStyle,
        zIndex,
      });
    }
  }, [map, isReady, path, transportMode, strokeWeight, strokeColor, strokeOpacity, strokeStyle, zIndex]);

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
  const polylinesRef = React.useRef<Map<string, kakao.maps.Polyline>>(new Map());

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
        (coord) => new kakao.maps.LatLng(coord.lat, coord.lng)
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
        polyline = new kakao.maps.Polyline({
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
      strokeStyle="shortdash"
      strokeOpacity={0.6}
    />
  );
}

export type { RoutePolylineProps, RouteSegmentData, MultiRoutePolylineProps, DirectRoutePolylineProps };
