"use client";

import * as React from "react";
import { useKakaoMap } from "./kakao-map";
import type { Coordinate } from "@/types/place";
import type { TransportMode } from "@/types/route";
import { getSegmentColor } from "@/lib/utils";

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
  public: "#3b82f6", // blue-500
  car: "#22c55e", // green-500
};

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
      console.log("    📍 Polyline 디코딩:", decoded.length, "개 좌표");
      return decoded;
    }
    console.log("    📍 Path 사용:", path?.length || 0, "개 좌표");
    return path || [];
  }, [encodedPath, path]);

  React.useEffect(() => {
    console.log("    🗺️ RoutePolyline useEffect:", {
      hasMap: !!map,
      isReady,
      actualPathLength: actualPath.length,
      transportMode,
      strokeColor,
    });

    if (!map || !isReady || actualPath.length < 2) {
      console.log("    ⚠️ 조건 미충족, polyline 그리지 않음");
      return;
    }

    const linePath = actualPath.map(
      (coord) => new window.kakao.maps.LatLng(coord.lat, coord.lng),
    );

    const color = strokeColor || TRANSPORT_COLORS[transportMode];

    if (polylineRef.current) {
      // 기존 폴리라인 업데이트
      console.log("    ✏️ 기존 polyline 업데이트", { color, strokeWeight });
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
      console.log("    ✨ 새 polyline 생성", {
        color,
        strokeWeight,
        pathLength: linePath.length,
      });
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
  }>;
  /** 선 두께 */
  strokeWeight?: number;
  /** 선 투명도 */
  strokeOpacity?: number;
  /** 구간별 색상 사용 여부 (true면 각 구간마다 다른 색상) */
  useSegmentColors?: boolean;
}

/**
 * 실제 경로 폴리라인 컴포넌트
 * - path 배열이 있으면 좌표 배열로 경로 표시
 * - encodedPath가 있으면 인코딩된 폴리라인으로 경로 표시
 * - 둘 다 없으면 직선으로 연결
 * - useSegmentColors가 true면 각 구간마다 다른 색상 사용
 */
export function RealRoutePolyline({
  segments,
  strokeWeight = 4,
  strokeOpacity = 0.8,
  useSegmentColors = false,
}: RealRoutePolylineProps) {
  console.group("🖼️ [RealRoutePolyline 렌더링]");
  console.log("받은 segments:", segments.length);
  console.log("useSegmentColors:", useSegmentColors);

  return (
    <>
      {segments.map((segment, index) => {
        // 구간별 색상 또는 이동 수단별 색상
        const strokeColor = useSegmentColors
          ? getSegmentColor(segment.segmentIndex ?? index)
          : TRANSPORT_COLORS[segment.transportMode];

        console.log(`  Segment ${index}:`, {
          transportMode: segment.transportMode,
          hasEncodedPath: !!segment.encodedPath,
          hasPath: !!segment.path,
          pathLength: segment.path?.length,
          strokeColor,
        });

        if (segment.encodedPath) {
          // 실제 경로 (인코딩된 폴리라인)
          console.log(`    → encodedPath 사용`);
          return (
            <RoutePolyline
              key={`route-${index}`}
              encodedPath={segment.encodedPath}
              strokeColor={strokeColor}
              strokeWeight={strokeWeight}
              strokeOpacity={strokeOpacity}
              strokeStyle="solid"
              zIndex={index + 1}
            />
          );
        } else if (segment.path && segment.path.length > 1) {
          // 좌표 배열로 경로 표시
          console.log(`    → path 사용 (${segment.path.length}개 좌표)`);
          return (
            <RoutePolyline
              key={`route-${index}`}
              path={segment.path}
              strokeColor={strokeColor}
              strokeWeight={strokeWeight}
              strokeOpacity={strokeOpacity}
              strokeStyle="solid"
              zIndex={index + 1}
            />
          );
        } else {
          // 직선 연결 (폴백)
          console.log(`    → 직선 연결 (폴백)`);
          return (
            <RoutePolyline
              key={`route-${index}`}
              path={[segment.from, segment.to]}
              strokeColor={strokeColor}
              strokeWeight={strokeWeight}
              strokeOpacity={strokeOpacity}
              strokeStyle="shortdash"
              zIndex={index + 1}
            />
          );
        }
      })}
      {console.groupEnd()}
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
