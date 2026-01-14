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
 * ?筌뤾쑵留??紐껋춨 ??????源녿데????レ뒭筌??꾩룄?ｈ굢?몄뿉???븐슧留??
 * @param encoded - ?筌뤾쑵留??紐껋춨 ??????源녿데 ??쒖굣???
 * @returns ??レ뒭筌??꾩룄?ｈ굢?
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
  /** ?롪퍔?δ빳???レ뒭筌??꾩룄?ｈ굢?*/
  path?: Coordinate[];
  /** ?筌뤾쑵留??紐껋춨 ??????源녿데 ??쒖굣???(Google Polyline Algorithm) */
  encodedPath?: string;
  /** ???????濡ル펺 (??源껊쭜 ?롪퍒??? */
  transportMode?: TransportMode;
  /** ???????*/
  strokeWeight?: number;
  /** ????源껊쭜 (??ｋ걠???) */
  strokeColor?: string;
  /** ????筌??(0-1) */
  strokeOpacity?: number;
  /** ???????*/
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

// ???????濡ル펺????源껊쭜
const TRANSPORT_COLORS: Record<TransportMode, string> = {
  walking: "#f97316", // orange-500
  public: "#1d4ed8", // blue-700 (??嶺뚯쉳?들뇡?移?
  car: "#22c55e", // green-500
};

// ???덇틬 嶺뚮씭?녽뜮???源껊쭜 (place-markers.tsx?? ???됰뎄)
const ACCOMMODATION_COLOR = "#a855f7"; // purple-500

// ?熬곣뫕而⑴춯?뼿 ?롪퍔?δ빳???源껊쭜 (??濡ル츓??
const DESTINATION_COLOR = "#06b6d4"; // cyan-500 (????⑥쥓由?뇦?

/**
 * ?롪퍔?δ빳???????源녿데 ???샑???怨뺣콦
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
  const polylineRef = React.useRef<any>(null);

  // ?筌뤾쑵留??紐껋춨 ?롪퍔?δ빳?귥쾸? ???깅さ嶺???븐슧留?? ?熬곣뫀鍮띸춯?path ????
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
      // ?リ옇?????????源녿데 ???낆몥??袁⑤콦
      polylineRef.current.setPath(linePath);
      polylineRef.current.setOptions({
        strokeWeight,
        strokeColor: color,
        strokeOpacity,
        strokeStyle,
        zIndex,
      });
    } else {
      // ????????源녿데 ??諛댁뎽
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
  /** ??뚮뜆??ID */
  id: string;
  /** ?롪퍔?δ빳???レ뒭筌?*/
  path: Coordinate[];
  /** ???????濡ル펺 */
  transportMode: TransportMode;
}

interface MultiRoutePolylineProps {
  /** ?롪퍔?δ빳???뚮뜆???꾩룄?ｈ굢?*/
  segments: RouteSegmentData[];
  /** ??ルㅎ臾????뚮뜆??ID */
  selectedSegmentId?: string;
  /** ??뚮뜆????????筌뤾퍓援??*/
  onSegmentClick?: (segmentId: string) => void;
}

/**
 * ???긱돡 ?롪퍔?δ빳???뚮뜆????????源녿데 ???샑???怨뺣콦
 */
export function MultiRoutePolyline({
  segments,
  selectedSegmentId,
}: MultiRoutePolylineProps) {
  const { map, isReady } = useKakaoMap();
  const polylinesRef = React.useRef<Map<string, any>>(new Map());

  React.useEffect(() => {
    if (!map || !isReady) return;

    const currentPolylines = polylinesRef.current;
    const newSegmentIds = new Set(segments.map((s) => s.id));

    // ?リ옇?????????源녿데 繞?????怨대쭜 ???⑸츎 ????蹂ㅽ깴
    currentPolylines.forEach((polyline, id) => {
      if (!newSegmentIds.has(id)) {
        polyline.setMap(null);
        currentPolylines.delete(id);
      }
    });

    // ??????源녿데 ??諛댁뎽 ???裕????낆몥??袁⑤콦
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
  /** ?怨쀫츊?뚯궪彛? */
  origin: Coordinate;
  /** ?熬곣뫕而⑴춯?뼿 */
  destination: Coordinate;
  /** ?롪퍔???嶺뚯솘? ?꾩룄?ｈ굢?*/
  waypoints?: Coordinate[];
  /** ???????濡ル펺 */
  transportMode?: TransportMode;
  /** 嶺뚯쉳??땻???⑤슡??(???깆젷 ?롪퍔?δ빳????? */
  straight?: boolean;
  /** ??ｋ걠??? ????源껊쭜 */
  strokeColor?: string;
}

/**
 * ?怨쀫츊?뚯궪彛?-?롪퍔???嶺뚯솘?-?熬곣뫕而⑴춯?뼿????⑤슡???濡ル츎 ?띠룄??????????源녿데
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
    // ???깆젷 ?롪퍔?δ빳?API???????怨룻뒍 ??濡ル츎 ?롪퍔???
    // ?????類ｋ츎 ??貫???嶺뚯쉳??땻??怨쀬Ŧ ??⑤슡??
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
// Real Route Polyline (???깆젷 ?롪퍔?δ빳???戮?뻣)
// ============================================

interface RealRoutePolylineProps {
  /** ?롪퍔?δ빳???뚮뜆???꾩룄?ｈ굢?- path ???裕?encodedPath?띠럾? ???깅さ嶺????깆젷 ?롪퍔?δ빳? ??怨몃さ嶺?嶺뚯쉳??땻?*/
  segments: Array<{
    from: Coordinate;
    to: Coordinate;
    path?: Coordinate[];
    encodedPath?: string;
    transportMode: TransportMode;
    segmentIndex?: number;
    /** ???덇틬???띠럾????롪퍔?δ빳???? */
    isToAccommodation?: boolean;
    /** ???덇틬??????怨쀫츊???濡ル츎 ?롪퍔?δ빳???? */
    isFromAccommodation?: boolean;
    /** ?熬곣뫕而⑴춯?뼿???띠럾????롪퍔?δ빳???? */
    isToDestination?: boolean;
  }>;
  /** ???????*/
  strokeWeight?: number;
  /** ????筌??*/
  strokeOpacity?: number;
  /** ??뚮뜆?®솻???源껊쭜 ??????? (true嶺?????뚮뜆?®춯?얜쐞?????섎???源껊쭜) */
  useSegmentColors?: boolean;
  /** ??ルㅎ臾????뚮뜆???筌뤾퍓???(?????????釉띾쐡??듭춻??뽯┃????戮?뻣) */
  selectedSegmentIndex?: number;
  /** ???덈뒆????⑤챷????? (?リ옇???泥? true) */
  enableOffset?: boolean;
}

/**
 * ???깆젷 ?롪퍔?δ빳???????源녿데 ???샑???怨뺣콦
 * - path ?꾩룄?ｈ굢?????깅さ嶺???レ뒭筌??꾩룄?ｈ굢?몄뿉??롪퍔?δ빳???戮?뻣
 * - encodedPath?띠럾? ???깅さ嶺??筌뤾쑵留??紐껋춨 ??????源녿데??怨쀬Ŧ ?롪퍔?δ빳???戮?뻣
 * - ??????怨몃さ嶺?嶺뚯쉳??땻??怨쀬Ŧ ??⑤슡??
 * - useSegmentColors?띠럾? true嶺?????뚮뜆?®춯?얜쐞?????섎???源껊쭜 ????
 * - ?熬곣뫀沅???뚮뜆??walking)?? ??疫??낅슣????源녿さ????戮?뻣 (useSegmentColors?? ??㉱??ｌ뫒驪??
 * - ???덇틬???띠럾????롪퍔?δ빳?????덇틬 嶺뚮씭?녽뜮?? ???됰뎄????源껊쭜(#a855f7)??怨쀬Ŧ ??戮?뻣
 * - ???덇틬??????怨쀫츊???濡ル츎 ?롪퍔?δ빳??嶺뚮ㅄ維??쇱?? ??뚮뜆?®솻???源껊쭜 ????
 * - ?熬곣뫕而⑴춯?뼿???띠럾????롪퍔?δ빳????濡ル츓??#06b6d4)??怨쀬Ŧ ??戮?뻣
 * - ?????롪퍔?δ빳?귥쾸? ?롪퍓????????덈뒆???諭???⑤챷???琉우뿰 ???????戮?뻣
 * - ??ルㅎ臾???롪퍔?δ빳???????????釉띾쐡??듭춻??뽯┃?? ???닺땻???롪퍔?δ빳??????類Β???筌???우벟 ??戮?뻣
 */
export const RealRoutePolyline = React.memo(function RealRoutePolyline({
  segments,
  strokeWeight = 4,
  strokeOpacity = 0.8,
  useSegmentColors = false,
  selectedSegmentIndex,
  enableOffset = true,
}: RealRoutePolylineProps) {
  const getSegmentKey = React.useCallback(
    (from: Coordinate, to: Coordinate) =>
      `${from.lat.toFixed(5)},${from.lng.toFixed(5)}|${to.lat.toFixed(5)},${to.lng.toFixed(5)}`,
    [],
  );

  const detailedSegmentKeys = React.useMemo(() => {
    const keys = new Set<string>();
    segments.forEach((segment) => {
      if (segment.encodedPath || (segment.path && segment.path.length > 1)) {
        keys.add(getSegmentKey(segment.from, segment.to));
      }
    });
    return keys;
  }, [segments, getSegmentKey]);

  
  const offsets = React.useMemo(() => {
    if (!enableOffset || segments.length <= 1) {
      return segments.map(() => 0);
    }
    return calculateRouteOffsets(segments.length, 0); // 12亦껋꼶梨멱땻??띠룄?①댆?
  }, [segments, enableOffset]);

  return (
    <>
      {segments.map((segment, index) => {
        // ??뚮뜆?®솻???源껊쭜 ???裕????????濡ル펺????源껊쭜
        // ??⑥ろ맖??戮곕쭊: ???덇틬???띠럾????롪퍔?δ빳?> ?熬곣뫕而⑴춯?뼿 ?롪퍔?δ빳?> ??뚮뜆?®솻???源껊쭜 > ???????濡ル펺????源껊쭜
        const strokeColor = segment.isToAccommodation
          ? ACCOMMODATION_COLOR
          : segment.isToDestination
            ? DESTINATION_COLOR
            : useSegmentColors
              ? getSegmentColor(segment.segmentIndex ?? index)
              : TRANSPORT_COLORS[segment.transportMode];

        // ??ルㅎ臾???롪퍔?δ빳???????????釉띾쐡??듭춻??뽯┃?? ???닺땻???롪퍔?δ빳??????類Β???筌???우벟
        const isSelected =
          selectedSegmentIndex !== undefined && index === selectedSegmentIndex;
        const actualStrokeWeight = isSelected ? strokeWeight + 2 : strokeWeight;
        const actualStrokeOpacity = isSelected
          ? Math.min(strokeOpacity + 0.2, 1)
          : strokeOpacity * 0.9;
        const actualZIndex = isSelected ? 100 + index : index + 1;

        if (segment.encodedPath) {
          // ???깆젷 ?롪퍔?δ빳?(?筌뤾쑵留??紐껋춨 ??????源녿데)
          let path = decodePolylineUtil(segment.encodedPath);

          // ???덈뒆????⑤챷??
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
          // ??レ뒭筌??꾩룄?ｈ굢?몄뿉??롪퍔?δ빳???戮?뻣
          let path = segment.path;

          // ???덈뒆????⑤챷??
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
          // 嶺뚯쉳??땻???⑤슡??(???揶?
          // ?熬곣뫀沅???뚮뜆??? ???⑦맖, ???筌뤾퍓裕???????怨쀬Ŧ ??戮?뻣
          const isWalkingFallback = segment.transportMode === "walking";
          if (detailedSegmentKeys.has(getSegmentKey(segment.from, segment.to))) {
            return null;
          }
          let path = [segment.from, segment.to];

          // ???덈뒆????⑤챷??(嶺뚯쉳??땻??롪퍔?δ빳???利???⑤챷??
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
}, (prevProps, nextProps) => {
  // segments 배열이 변경되었는지 확인
  if (prevProps.segments.length !== nextProps.segments.length) {
    return false;
  }
  
  // props 비교
  if (
    prevProps.strokeWeight !== nextProps.strokeWeight ||
    prevProps.strokeOpacity !== nextProps.strokeOpacity ||
    prevProps.useSegmentColors !== nextProps.useSegmentColors
  ) {
    return false;
  }
  
  // 각 segment의 주요 속성 비교
  for (let i = 0; i < prevProps.segments.length; i++) {
    const prev = prevProps.segments[i];
    const next = nextProps.segments[i];
    
    if (
      prev.from.lat !== next.from.lat ||
      prev.from.lng !== next.from.lng ||
      prev.to.lat !== next.to.lat ||
      prev.to.lng !== next.to.lng ||
      prev.encodedPath !== next.encodedPath ||
      prev.path?.length !== next.path?.length ||
      prev.transportMode !== next.transportMode
    ) {
      return false;
    }
  }
  
  return true;
});

export type {
  RoutePolylineProps,
  RouteSegmentData,
  MultiRoutePolylineProps,
  DirectRoutePolylineProps,
  RealRoutePolylineProps,
};
