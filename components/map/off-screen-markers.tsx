"use client";

import * as React from "react";
import { useKakaoMap } from "./kakao-map";
import type { Coordinate } from "@/types/place";

interface MarkerInfo {
  id: string;
  coordinate: Coordinate;
  order: number;
  name?: string;
}

interface OffScreenMarkersProps {
  /** 마커 정보 배열 */
  markers: MarkerInfo[];
  /** 마커 클릭 시 해당 위치로 이동할지 여부 */
  panOnClick?: boolean;
}

interface OffScreenMarker {
  id: string;
  order: number;
  name?: string;
  direction: "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  coordinate: Coordinate;
  angle: number;
}

/**
 * 지도 영역 밖의 마커 위치를 화살표로 표시하는 컴포넌트
 */
export function OffScreenMarkers({ markers, panOnClick = true }: OffScreenMarkersProps) {
  const { map, isReady } = useKakaoMap();
  const [offScreenMarkers, setOffScreenMarkers] = React.useState<OffScreenMarker[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 맵 경계 변경 시 영역 밖 마커 계산
  React.useEffect(() => {
    if (!map || !isReady) return;

    const updateOffScreenMarkers = () => {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const center = map.getCenter();

      const centerLat = center.getLat();
      const centerLng = center.getLng();

      const offScreen: OffScreenMarker[] = [];

      markers.forEach((marker) => {
        const { lat, lng } = marker.coordinate;

        // 맵 영역 내에 있는지 확인
        const isInBounds =
          lat >= sw.getLat() &&
          lat <= ne.getLat() &&
          lng >= sw.getLng() &&
          lng <= ne.getLng();

        if (!isInBounds) {
          // 방향 계산
          const isTop = lat > ne.getLat();
          const isBottom = lat < sw.getLat();
          const isLeft = lng < sw.getLng();
          const isRight = lng > ne.getLng();

          let direction: OffScreenMarker["direction"];
          if (isTop && isLeft) direction = "top-left";
          else if (isTop && isRight) direction = "top-right";
          else if (isBottom && isLeft) direction = "bottom-left";
          else if (isBottom && isRight) direction = "bottom-right";
          else if (isTop) direction = "top";
          else if (isBottom) direction = "bottom";
          else if (isLeft) direction = "left";
          else direction = "right";

          // 중심점으로부터의 각도 계산
          const angle = Math.atan2(lat - centerLat, lng - centerLng) * (180 / Math.PI);

          offScreen.push({
            id: marker.id,
            order: marker.order,
            name: marker.name,
            direction,
            coordinate: marker.coordinate,
            angle,
          });
        }
      });

      setOffScreenMarkers(offScreen);
    };

    // 초기 계산
    updateOffScreenMarkers();

    // 이벤트 리스너 등록
    window.kakao.maps.event.addListener(map, "bounds_changed", updateOffScreenMarkers);
    window.kakao.maps.event.addListener(map, "zoom_changed", updateOffScreenMarkers);
    window.kakao.maps.event.addListener(map, "center_changed", updateOffScreenMarkers);

    return () => {
      window.kakao.maps.event.removeListener(map, "bounds_changed", updateOffScreenMarkers);
      window.kakao.maps.event.removeListener(map, "zoom_changed", updateOffScreenMarkers);
      window.kakao.maps.event.removeListener(map, "center_changed", updateOffScreenMarkers);
    };
  }, [map, isReady, markers]);

  // 마커 클릭 핸들러
  const handleMarkerClick = (marker: OffScreenMarker) => {
    if (!map || !panOnClick) return;
    map.panTo(new window.kakao.maps.LatLng(marker.coordinate.lat, marker.coordinate.lng));
  };

  if (offScreenMarkers.length === 0) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {offScreenMarkers.map((marker) => (
        <OffScreenIndicator
          key={marker.id}
          marker={marker}
          onClick={() => handleMarkerClick(marker)}
        />
      ))}
    </div>
  );
}

interface OffScreenIndicatorProps {
  marker: OffScreenMarker;
  onClick: () => void;
}

function OffScreenIndicator({ marker, onClick }: OffScreenIndicatorProps) {
  const { direction, order, angle } = marker;

  // 방향별 위치 스타일
  const positionStyles: Record<string, React.CSSProperties> = {
    top: { top: 8, left: "50%", transform: "translateX(-50%)" },
    bottom: { bottom: 8, left: "50%", transform: "translateX(-50%)" },
    left: { left: 8, top: "50%", transform: "translateY(-50%)" },
    right: { right: 8, top: "50%", transform: "translateY(-50%)" },
    "top-left": { top: 8, left: 8 },
    "top-right": { top: 8, right: 8 },
    "bottom-left": { bottom: 8, left: 8 },
    "bottom-right": { bottom: 8, right: 8 },
  };

  // 방향별 화살표 회전 각도
  const arrowRotation: Record<string, number> = {
    top: -90,
    bottom: 90,
    left: 180,
    right: 0,
    "top-left": -135,
    "top-right": -45,
    "bottom-left": 135,
    "bottom-right": 45,
  };

  return (
    <button
      onClick={onClick}
      className="absolute pointer-events-auto flex items-center gap-1 bg-primary text-primary-foreground px-2 py-1.5 rounded-full shadow-lg hover:bg-primary/90 transition-colors cursor-pointer"
      style={positionStyles[direction]}
      title={marker.name || `${order}번 장소로 이동`}
    >
      {/* 순서 번호 */}
      <span className="text-xs font-bold min-w-[16px] text-center">{order}</span>

      {/* 방향 화살표 */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: `rotate(${arrowRotation[direction]}deg)` }}
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/**
 * 모든 마커가 보이도록 맵을 조정하는 버튼 컴포넌트
 */
interface FitBoundsButtonProps {
  markers: MarkerInfo[];
  className?: string;
}

export function FitBoundsButton({ markers, className }: FitBoundsButtonProps) {
  const { map, isReady } = useKakaoMap();

  const handleFitBounds = () => {
    if (!map || !isReady || markers.length === 0) return;

    const bounds = new window.kakao.maps.LatLngBounds();
    markers.forEach((marker) => {
      bounds.extend(new window.kakao.maps.LatLng(marker.coordinate.lat, marker.coordinate.lng));
    });

    map.setBounds(bounds, 50, 50, 50, 50);
  };

  if (markers.length <= 1) return null;

  return (
    <button
      onClick={handleFitBounds}
      className={`absolute bottom-3 right-3 z-10 bg-white text-gray-700 p-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors ${className || ""}`}
      title="모든 장소 보기"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    </button>
  );
}

export type { MarkerInfo, OffScreenMarkersProps };
