"use client";

import * as React from "react";
import { useKakaoMap } from "./kakao-map";
import type { Coordinate, Place } from "@/types/place";

interface MarkerData {
  /** 고유 ID */
  id: string;
  /** 좌표 */
  coordinate: Coordinate;
  /** 표시 순서 번호 (1부터 시작) */
  order?: number;
  /** 장소명 */
  name?: string;
  /** 고정 일정 여부 */
  isFixed?: boolean;
  /** 클릭 가능 여부 */
  clickable?: boolean;
  /** 커스텀 배경 색상 (hex 코드) */
  color?: string;
}

interface PlaceMarkersProps {
  /** 마커 데이터 배열 */
  markers: MarkerData[];
  /** 마커 클릭 핸들러 */
  onMarkerClick?: (markerId: string) => void;
  /** 선택된 마커 ID */
  selectedId?: string;
  /** 마커 크기 */
  size?: "sm" | "md" | "lg";
}

// 마커 크기 설정
const MARKER_SIZES = {
  sm: { width: 24, height: 28, fontSize: 10 },
  md: { width: 32, height: 38, fontSize: 12 },
  lg: { width: 40, height: 48, fontSize: 14 },
};

/**
 * 번호가 표시된 SVG 마커 이미지 생성
 * @param order - 표시할 순서 번호
 * @param isFixed - 고정 일정 여부
 * @param isSelected - 선택된 마커 여부
 * @param size - 마커 크기
 * @param customColor - 커스텀 배경 색상 (우선 적용)
 */
function createNumberedMarkerSvg(
  order: number,
  isFixed: boolean,
  isSelected: boolean,
  size: "sm" | "md" | "lg",
  customColor?: string,
): string {
  const { width, height, fontSize } = MARKER_SIZES[size];

  // 색상 우선순위: customColor > isFixed > isSelected > 기본(red)
  let bgColor: string;
  if (customColor) {
    bgColor = customColor;
  } else if (isFixed) {
    bgColor = "#7c3aed"; // violet-600
  } else if (isSelected) {
    bgColor = "#1d4ed8"; // blue-700 (더 진하게)
  } else {
    bgColor = "#ef4444"; // red-500
  }

  const strokeColor = isSelected ? "#1e3a8a" : "white"; // blue-800 (더 진하게)
  const strokeWidth = isSelected ? 3 : 2;
  // 선택된 마커는 더 선명하게, 그 외는 반투명
  const opacity = isSelected ? 1 : 0.9;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" opacity="${opacity}">
      <path d="${createMarkerPath(width, height)}" fill="${bgColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      <text x="${width / 2}" y="${height * 0.42}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="${fontSize}" font-weight="bold" font-family="system-ui, sans-serif">${order}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

/**
 * 마커 모양 SVG path 생성
 */
function createMarkerPath(width: number, height: number): string {
  const cx = width / 2;
  const r = width / 2 - 2;
  const tipHeight = height - width;

  return `M ${cx} ${height - 2}
          Q ${cx - r} ${height - tipHeight - r * 0.5} ${cx - r} ${r + 2}
          A ${r} ${r} 0 1 1 ${cx + r} ${r + 2}
          Q ${cx + r} ${height - tipHeight - r * 0.5} ${cx} ${height - 2}`;
}

/**
 * 장소 마커 컴포넌트
 */
export function PlaceMarkers({
  markers,
  onMarkerClick,
  selectedId,
  size = "md",
}: PlaceMarkersProps) {
  const { map, isReady } = useKakaoMap();
  const kakaoMarkersRef = React.useRef<Map<string, any>>(new Map());

  // 마커 생성 및 업데이트
  React.useEffect(() => {
    if (!map || !isReady) return;

    const currentMarkers = kakaoMarkersRef.current;
    const newMarkerIds = new Set(markers.map((m) => m.id));

    // 기존 마커 중 더 이상 없는 것 제거
    currentMarkers.forEach((marker, id) => {
      if (!newMarkerIds.has(id)) {
        marker.setMap(null);
        currentMarkers.delete(id);
      }
    });

    // 마커 생성 또는 업데이트
    markers.forEach((markerData) => {
      const {
        id,
        coordinate,
        order = 1,
        isFixed = false,
        clickable = true,
        color,
      } = markerData;
      const isSelected = id === selectedId;
      const position = new window.kakao.maps.LatLng(
        coordinate.lat,
        coordinate.lng,
      );

      // 마커 이미지 생성 (커스텀 색상 지원)
      const { width, height } = MARKER_SIZES[size];
      const imageSrc = createNumberedMarkerSvg(
        order,
        isFixed,
        isSelected,
        size,
        color,
      );
      const imageSize = new window.kakao.maps.Size(width, height);
      const imageOption = {
        offset: new window.kakao.maps.Point(width / 2, height),
      };
      const markerImage = new window.kakao.maps.MarkerImage(
        imageSrc,
        imageSize,
        imageOption,
      );

      let kakaoMarker = currentMarkers.get(id);

      if (kakaoMarker) {
        // 기존 마커 업데이트
        kakaoMarker.setPosition(position);
        kakaoMarker.setImage(markerImage);
        // 경유지 마커는 높은 zIndex로 설정하여 출발지/도착지/숙소 마커보다 앞에 표시
        kakaoMarker.setZIndex(isSelected ? 200 : 100 + order);
      } else {
        // 새 마커 생성
        kakaoMarker = new window.kakao.maps.Marker({
          map,
          position,
          image: markerImage,
          clickable,
          // 경유지 마커는 높은 zIndex로 설정하여 출발지/도착지/숙소 마커보다 앞에 표시
          zIndex: isSelected ? 200 : 100 + order,
        });

        // 클릭 이벤트
        if (clickable && onMarkerClick) {
          window.kakao.maps.event.addListener(kakaoMarker, "click", () => {
            onMarkerClick(id);
          });
        }

        currentMarkers.set(id, kakaoMarker);
      }
    });

    // 선택된 마커 zIndex 업데이트
    if (selectedId && currentMarkers.has(selectedId)) {
      currentMarkers.get(selectedId)?.setZIndex(200);
    }
  }, [map, isReady, markers, selectedId, size, onMarkerClick]);

  // cleanup
  React.useEffect(() => {
    const markers = kakaoMarkersRef.current;
    return () => {
      markers.forEach((marker) => {
        marker.setMap(null);
      });
      markers.clear();
    };
  }, []);

  return null;
}

interface SingleMarkerProps {
  /** 좌표 */
  coordinate: Coordinate;
  /** 마커 타입 */
  type?:
    | "default"
    | "origin"
    | "destination"
    | "current"
    | "accommodation"
    | "lastPlace";
  /** 클릭 핸들러 */
  onClick?: () => void;
}

/**
 * 단일 마커 컴포넌트 (출발지, 도착지, 현재 위치 등)
 */
export function SingleMarker({
  coordinate,
  type = "default",
  onClick,
}: SingleMarkerProps) {
  const { map, isReady } = useKakaoMap();
  const markerRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (!map || !isReady) return;

    const position = new window.kakao.maps.LatLng(
      coordinate.lat,
      coordinate.lng,
    );

    // 타입별 마커 이미지
    const imageSrc = createSpecialMarkerSvg(type);
    const imageSize = new window.kakao.maps.Size(32, 38);
    const imageOption = { offset: new window.kakao.maps.Point(16, 38) };
    const markerImage = new window.kakao.maps.MarkerImage(
      imageSrc,
      imageSize,
      imageOption,
    );

    if (markerRef.current) {
      markerRef.current.setPosition(position);
      markerRef.current.setImage(markerImage);
      // 출발지/도착지/숙소 마커는 낮은 zIndex로 설정하여 경유지 마커 뒤에 표시
      markerRef.current.setZIndex(type === "current" ? 200 : 1);
    } else {
      const marker = new window.kakao.maps.Marker({
        map,
        position,
        image: markerImage,
        clickable: !!onClick,
        // 출발지/도착지/숙소 마커는 낮은 zIndex로 설정하여 경유지 마커 뒤에 표시
        zIndex: type === "current" ? 200 : 1,
      });

      if (onClick) {
        window.kakao.maps.event.addListener(marker, "click", onClick);
      }

      markerRef.current = marker;
    }
  }, [map, isReady, coordinate, type, onClick]);

  // cleanup
  React.useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    };
  }, []);

  return null;
}

/**
 * 특수 마커 SVG 생성 (출발지, 도착지, 현재 위치, 숙소, 전날 마지막 장소)
 */
function createSpecialMarkerSvg(
  type:
    | "default"
    | "origin"
    | "destination"
    | "current"
    | "accommodation"
    | "waypoint"
    | "lastPlace",
): string {
  const colors = {
    default: { bg: "#6b7280", stroke: "white" },
    origin: { bg: "#06b6d4", stroke: "white" }, // cyan-500 (더 연하게)
    destination: { bg: "#06b6d4", stroke: "white" }, // cyan-500 (더 연하게)
    current: { bg: "#1d4ed8", stroke: "white" }, // blue-700 (더 진하게)
    accommodation: { bg: "#a855f7", stroke: "white" }, // 보라색
    waypoint: { bg: "#10b981", stroke: "white" }, // 초록색 (전날 경유지)
    lastPlace: { bg: "#64748b", stroke: "white" }, // 슬레이트 (전날 마지막 장소)
  };

  const icons = {
    default: "M16 8a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
    origin: "M16 6l6 12H10l6-12z", // 삼각형 (위로)
    destination: "M10 6h12v12H10z", // 사각형
    current:
      "M16 8a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM16 11a2 2 0 1 1 0 4 2 2 0 0 1 0-4z", // 도넛
    accommodation: "M16 6l8 8v6H8v-6l8-8zm-4 12h8v-4l-4-4-4 4v4z", // 집 아이콘
    waypoint: "M16 8a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", // 원 (경유지)
    lastPlace: "M16 8a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", // 원 (기본 마커)
  };

  const { bg, stroke } = colors[type];
  // 현재 위치 마커는 더 선명하게, 그 외는 반투명
  const opacity = type === "current" ? 1 : 0.9;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38" opacity="${opacity}">
      <path d="${createMarkerPath(32, 38)}" fill="${bg}" stroke="${stroke}" stroke-width="2"/>
      <path d="${icons[type]}" fill="white"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

/**
 * Place 배열을 MarkerData 배열로 변환하는 유틸리티
 */
export function placesToMarkers(
  places: Place[],
  fixedPlaceIds?: Set<string>,
): MarkerData[] {
  return places.map((place, index) => ({
    id: place.id,
    coordinate: place.coordinate,
    order: index + 1,
    name: place.name,
    isFixed: fixedPlaceIds?.has(place.id) ?? false,
    clickable: true,
  }));
}

export type { MarkerData, PlaceMarkersProps, SingleMarkerProps };
