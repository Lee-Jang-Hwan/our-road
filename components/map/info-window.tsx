"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Clock, MapPin, Navigation } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useKakaoMap } from "./kakao-map";
import type { Coordinate } from "@/types/place";

interface InfoWindowProps {
  /** 표시할 좌표 */
  coordinate: Coordinate;
  /** 열림 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 컨텐츠 */
  children: React.ReactNode;
  /** x 앵커 (0-1, 기본 0.5 = 중앙) */
  xAnchor?: number;
  /** y 앵커 (0-1, 기본 0 = 상단) */
  yAnchor?: number;
  /** z-index */
  zIndex?: number;
}

/**
 * 맵 위 정보창 컴포넌트 (CustomOverlay 기반)
 */
export function InfoWindow({
  coordinate,
  isOpen,
  onClose,
  children,
  xAnchor = 0.5,
  yAnchor = 0,
  zIndex = 10,
}: InfoWindowProps) {
  const { map, isReady } = useKakaoMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlayRef = React.useRef<any>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // 컨테이너 생성
  React.useEffect(() => {
    if (!containerRef.current) {
      containerRef.current = document.createElement("div");
    }
  }, []);

  // CustomOverlay 관리
  React.useEffect(() => {
    if (!map || !isReady || !containerRef.current) return;

    if (isOpen) {
      const position = new window.kakao.maps.LatLng(coordinate.lat, coordinate.lng);

      if (overlayRef.current) {
        overlayRef.current.setPosition(position);
        overlayRef.current.setMap(map);
      } else {
        overlayRef.current = new window.kakao.maps.CustomOverlay({
          map,
          position,
          content: containerRef.current,
          xAnchor,
          yAnchor,
          zIndex,
          clickable: true,
        });
      }
    } else {
      overlayRef.current?.setMap(null);
    }
  }, [map, isReady, isOpen, coordinate, xAnchor, yAnchor, zIndex]);

  // cleanup
  React.useEffect(() => {
    return () => {
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
    };
  }, []);

  if (!containerRef.current || !isOpen) return null;

  return createPortal(
    <div
      className="relative bg-background border rounded-lg shadow-lg p-3 min-w-[200px] max-w-[280px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 닫기 버튼 */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm"
        onClick={onClose}
      >
        <X className="h-3 w-3" />
      </Button>

      {children}

      {/* 말풍선 화살표 */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-background" />
    </div>,
    containerRef.current
  );
}

interface PlaceInfoWindowProps {
  /** 좌표 */
  coordinate: Coordinate;
  /** 열림 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 장소 정보 */
  place: {
    name: string;
    address?: string;
    duration?: number;
    order?: number;
    isFixed?: boolean;
  };
  /** 액션 버튼들 */
  actions?: React.ReactNode;
}

/**
 * 장소 정보창 컴포넌트
 */
export function PlaceInfoWindow({
  coordinate,
  isOpen,
  onClose,
  place,
  actions,
}: PlaceInfoWindowProps) {
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };

  return (
    <InfoWindow
      coordinate={coordinate}
      isOpen={isOpen}
      onClose={onClose}
      yAnchor={1.2}
    >
      <div className="space-y-2">
        {/* 헤더 */}
        <div className="flex items-start gap-2">
          {place.order && (
            <span
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0",
                place.isFixed
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {place.order}
            </span>
          )}
          <div className="min-w-0">
            <h4 className="font-semibold text-sm truncate">{place.name}</h4>
            {place.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{place.address}</span>
              </p>
            )}
          </div>
        </div>

        {/* 체류 시간 */}
        {place.duration && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>체류 {formatDuration(place.duration)}</span>
          </div>
        )}

        {/* 액션 버튼들 */}
        {actions && <div className="pt-1 border-t">{actions}</div>}
      </div>
    </InfoWindow>
  );
}

interface SimpleInfoWindowProps {
  /** 좌표 */
  coordinate: Coordinate;
  /** 열림 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 제목 */
  title: string;
  /** 설명 (옵션) */
  description?: string;
}

/**
 * 간단한 정보창 컴포넌트
 */
export function SimpleInfoWindow({
  coordinate,
  isOpen,
  onClose,
  title,
  description,
}: SimpleInfoWindowProps) {
  return (
    <InfoWindow
      coordinate={coordinate}
      isOpen={isOpen}
      onClose={onClose}
      yAnchor={1.2}
    >
      <div>
        <h4 className="font-semibold text-sm">{title}</h4>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </InfoWindow>
  );
}

interface NavigationInfoWindowProps {
  /** 좌표 */
  coordinate: Coordinate;
  /** 열림 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 장소명 */
  placeName: string;
}

/**
 * 네비게이션 연결 정보창
 */
export function NavigationInfoWindow({
  coordinate,
  isOpen,
  onClose,
  placeName,
}: NavigationInfoWindowProps) {
  const openKakaoMap = () => {
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(placeName)},${coordinate.lat},${coordinate.lng}`;
    window.open(url, "_blank");
  };

  const openNaverMap = () => {
    const url = `https://map.naver.com/v5/directions/-/-/-/transit?c=${coordinate.lng},${coordinate.lat},15,0,0,0,dh`;
    window.open(url, "_blank");
  };

  return (
    <InfoWindow
      coordinate={coordinate}
      isOpen={isOpen}
      onClose={onClose}
      yAnchor={1.2}
    >
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">{placeName}</h4>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={openKakaoMap}
          >
            <Navigation className="h-3 w-3 mr-1" />
            카카오맵
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={openNaverMap}
          >
            <Navigation className="h-3 w-3 mr-1" />
            네이버맵
          </Button>
        </div>
      </div>
    </InfoWindow>
  );
}

export type { InfoWindowProps, PlaceInfoWindowProps, SimpleInfoWindowProps, NavigationInfoWindowProps };
