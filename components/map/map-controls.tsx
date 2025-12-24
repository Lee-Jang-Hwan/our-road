"use client";

import * as React from "react";
import {
  Plus,
  Minus,
  Locate,
  Maximize2,
  Map as MapIcon,
  Satellite,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useKakaoMap, kakao } from "./kakao-map";
import { useCurrentLocation } from "./current-location";
import type { Coordinate } from "@/types/place";

interface MapControlsProps {
  /** 줌 컨트롤 표시 */
  showZoom?: boolean;
  /** 현재 위치 버튼 표시 */
  showCurrentLocation?: boolean;
  /** 맵 타입 토글 표시 */
  showMapType?: boolean;
  /** 전체 보기 버튼 표시 */
  showFitBounds?: boolean;
  /** 전체 보기 클릭 핸들러 */
  onFitBounds?: () => void;
  /** 현재 위치 이동 콜백 */
  onCurrentLocation?: (coordinate: Coordinate) => void;
  /** 컨트롤 위치 */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** 추가 클래스 */
  className?: string;
}

/**
 * 맵 컨트롤 버튼 그룹
 */
export function MapControls({
  showZoom = true,
  showCurrentLocation = true,
  showMapType = false,
  showFitBounds = false,
  onFitBounds,
  onCurrentLocation,
  position = "bottom-right",
  className,
}: MapControlsProps) {
  const positionClasses = {
    "top-left": "top-3 left-3",
    "top-right": "top-3 right-3",
    "bottom-left": "bottom-3 left-3",
    "bottom-right": "bottom-3 right-3",
  };

  return (
    <div
      className={cn(
        "absolute z-10 flex flex-col gap-2",
        positionClasses[position],
        className
      )}
    >
      {/* 줌 컨트롤 */}
      {showZoom && <ZoomControl />}

      {/* 맵 타입 토글 */}
      {showMapType && <MapTypeControl />}

      {/* 현재 위치 */}
      {showCurrentLocation && (
        <CurrentLocationControl onLocationFound={onCurrentLocation} />
      )}

      {/* 전체 보기 */}
      {showFitBounds && onFitBounds && (
        <FitBoundsControl onClick={onFitBounds} />
      )}
    </div>
  );
}

/**
 * 줌 컨트롤
 */
export function ZoomControl({ className }: { className?: string }) {
  const { map, isReady } = useKakaoMap();

  const handleZoomIn = () => {
    if (!map || !isReady) return;
    const currentLevel = map.getLevel();
    if (currentLevel > 1) {
      map.setLevel(currentLevel - 1, { animate: true });
    }
  };

  const handleZoomOut = () => {
    if (!map || !isReady) return;
    const currentLevel = map.getLevel();
    if (currentLevel < 14) {
      map.setLevel(currentLevel + 1, { animate: true });
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-background shadow-sm overflow-hidden",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-none border-b"
        onClick={handleZoomIn}
        disabled={!isReady}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-none"
        onClick={handleZoomOut}
        disabled={!isReady}
      >
        <Minus className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface CurrentLocationControlProps {
  onLocationFound?: (coordinate: Coordinate) => void;
  className?: string;
}

/**
 * 현재 위치 버튼
 */
export function CurrentLocationControl({
  onLocationFound,
  className,
}: CurrentLocationControlProps) {
  const { map, isReady } = useKakaoMap();
  const { isSupported } = useCurrentLocation({
    enabled: false, // 버튼 클릭 시에만 활성화
  });

  const [isLocating, setIsLocating] = React.useState(false);

  const handleClick = () => {
    if (!navigator.geolocation || !map || !isReady) return;

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinate: Coordinate = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        map.panTo(new kakao.maps.LatLng(coordinate.lat, coordinate.lng));
        onLocationFound?.(coordinate);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  if (!isSupported) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("h-9 w-9 bg-background shadow-sm", className)}
      onClick={handleClick}
      disabled={!isReady || isLocating}
    >
      {isLocating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Locate className="h-4 w-4" />
      )}
    </Button>
  );
}

/**
 * 맵 타입 토글 (로드맵/위성)
 */
export function MapTypeControl({ className }: { className?: string }) {
  const { map, isReady } = useKakaoMap();
  const [isSatellite, setIsSatellite] = React.useState(false);

  const handleToggle = () => {
    if (!map || !isReady) return;

    const newType = isSatellite
      ? kakao.maps.MapTypeId.ROADMAP
      : kakao.maps.MapTypeId.HYBRID;

    map.setMapTypeId(newType);
    setIsSatellite(!isSatellite);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("h-9 w-9 bg-background shadow-sm", className)}
      onClick={handleToggle}
      disabled={!isReady}
    >
      {isSatellite ? (
        <MapIcon className="h-4 w-4" />
      ) : (
        <Satellite className="h-4 w-4" />
      )}
    </Button>
  );
}

interface FitBoundsControlProps {
  onClick: () => void;
  className?: string;
}

/**
 * 전체 보기 버튼
 */
export function FitBoundsControl({ onClick, className }: FitBoundsControlProps) {
  const { isReady } = useKakaoMap();

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("h-9 w-9 bg-background shadow-sm", className)}
      onClick={onClick}
      disabled={!isReady}
    >
      <Maximize2 className="h-4 w-4" />
    </Button>
  );
}

interface MapControlButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}

/**
 * 커스텀 맵 컨트롤 버튼
 */
export function MapControlButton({
  icon,
  onClick,
  disabled = false,
  active = false,
  className,
}: MapControlButtonProps) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="icon"
      className={cn("h-9 w-9 bg-background shadow-sm", className)}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </Button>
  );
}

interface MapControlGroupProps {
  children: React.ReactNode;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  className?: string;
}

/**
 * 맵 컨트롤 그룹 래퍼
 */
export function MapControlGroup({
  children,
  position = "bottom-right",
  className,
}: MapControlGroupProps) {
  const positionClasses = {
    "top-left": "top-3 left-3",
    "top-right": "top-3 right-3",
    "bottom-left": "bottom-3 left-3",
    "bottom-right": "bottom-3 right-3",
  };

  return (
    <div
      className={cn(
        "absolute z-10 flex flex-col gap-2",
        positionClasses[position],
        className
      )}
    >
      {children}
    </div>
  );
}

export type { MapControlsProps, CurrentLocationControlProps, FitBoundsControlProps, MapControlButtonProps, MapControlGroupProps };
