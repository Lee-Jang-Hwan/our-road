"use client";

import * as React from "react";
import { useKakaoMap } from "./kakao-map";
import type { Coordinate } from "@/types/place";

interface CurrentLocationMarkerProps {
  /** 현재 위치 좌표 */
  coordinate: Coordinate;
  /** 정확도 반경 표시 (미터) */
  accuracy?: number;
  /** 마커 클릭 핸들러 */
  onClick?: () => void;
  /** 펄스 애니메이션 */
  pulse?: boolean;
}

/**
 * 현재 위치 마커 SVG 생성
 */
function createCurrentLocationMarkerSvg(pulse: boolean): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      ${pulse ? `
        <circle cx="20" cy="20" r="18" fill="#3b82f6" opacity="0.2">
          <animate attributeName="r" from="12" to="18" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      ` : ""}
      <circle cx="20" cy="20" r="12" fill="#3b82f6" stroke="white" stroke-width="3"/>
      <circle cx="20" cy="20" r="5" fill="white"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

/**
 * 현재 위치 마커 컴포넌트
 */
export function CurrentLocationMarker({
  coordinate,
  accuracy,
  onClick,
  pulse = true,
}: CurrentLocationMarkerProps) {
  const { map, isReady } = useKakaoMap();
  const markerRef = React.useRef<any>(null);
  const circleRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (!map || !isReady) return;

    const position = new window.kakao.maps.LatLng(coordinate.lat, coordinate.lng);

    // 마커 이미지 생성
    const imageSrc = createCurrentLocationMarkerSvg(pulse);
    const imageSize = new window.kakao.maps.Size(40, 40);
    const imageOption = { offset: new window.kakao.maps.Point(20, 20) };
    const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);

    if (markerRef.current) {
      markerRef.current.setPosition(position);
      markerRef.current.setImage(markerImage);
    } else {
      markerRef.current = new window.kakao.maps.Marker({
        map,
        position,
        image: markerImage,
        clickable: !!onClick,
        zIndex: 200,
      });

      if (onClick) {
        window.kakao.maps.event.addListener(markerRef.current, "click", onClick);
      }
    }

    // 정확도 원 표시
    if (accuracy && accuracy > 0) {
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }

      circleRef.current = new window.kakao.maps.Circle({
        map,
        center: position,
        radius: accuracy,
        strokeWeight: 1,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.3,
        strokeStyle: "solid",
        fillColor: "#3b82f6",
        fillOpacity: 0.1,
        zIndex: 1,
      });
    }
  }, [map, isReady, coordinate, accuracy, pulse, onClick]);

  // cleanup
  React.useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, []);

  return null;
}

interface UseCurrentLocationOptions {
  /** 위치 추적 활성화 */
  enabled?: boolean;
  /** 높은 정확도 사용 */
  enableHighAccuracy?: boolean;
  /** 위치 캐시 최대 수명 (밀리초) */
  maximumAge?: number;
  /** 타임아웃 (밀리초) */
  timeout?: number;
  /** 위치 변경 시 콜백 */
  onLocationChange?: (coordinate: Coordinate, accuracy: number) => void;
  /** 에러 콜백 */
  onError?: (error: GeolocationPositionError) => void;
}

interface CurrentLocationState {
  coordinate: Coordinate | null;
  accuracy: number | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * 현재 위치 추적 훅
 */
export function useCurrentLocation(options: UseCurrentLocationOptions = {}) {
  const {
    enabled = true,
    enableHighAccuracy = true,
    maximumAge = 30000,
    timeout = 10000,
    onLocationChange,
    onError,
  } = options;

  const [state, setState] = React.useState<CurrentLocationState>({
    coordinate: null,
    accuracy: null,
    isLoading: false,
    error: null,
  });

  const watchIdRef = React.useRef<number | null>(null);

  // 콜백을 ref로 저장하여 의존성 배열 문제 방지
  const onLocationChangeRef = React.useRef(onLocationChange);
  const onErrorRef = React.useRef(onError);

  // 콜백 ref 업데이트
  React.useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // 현재 위치 1회 조회
  const getCurrentLocation = React.useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "이 브라우저는 위치 서비스를 지원하지 않습니다.",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinate: Coordinate = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const accuracy = position.coords.accuracy;

        setState({
          coordinate,
          accuracy,
          isLoading: false,
          error: null,
        });

        onLocationChangeRef.current?.(coordinate, accuracy);
      },
      (error) => {
        const errorMessage = getGeolocationErrorMessage(error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        onErrorRef.current?.(error);
      },
      {
        enableHighAccuracy,
        maximumAge,
        timeout,
      }
    );
  }, [enableHighAccuracy, maximumAge, timeout]);

  // 위치 추적 시작/중지
  React.useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    // 초기 로딩 상태 설정은 한 번만
    setState((prev) => {
      if (prev.isLoading) return prev;
      return { ...prev, isLoading: true };
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coordinate: Coordinate = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const accuracy = position.coords.accuracy;

        setState({
          coordinate,
          accuracy,
          isLoading: false,
          error: null,
        });

        onLocationChangeRef.current?.(coordinate, accuracy);
      },
      (error) => {
        const errorMessage = getGeolocationErrorMessage(error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        onErrorRef.current?.(error);
      },
      {
        enableHighAccuracy,
        maximumAge,
        timeout,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, enableHighAccuracy, maximumAge, timeout]);

  return {
    ...state,
    getCurrentLocation,
    isSupported: typeof navigator !== "undefined" && !!navigator.geolocation,
  };
}

/**
 * Geolocation 에러 메시지 변환
 */
function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "위치 권한이 거부되었습니다.";
    case error.POSITION_UNAVAILABLE:
      return "위치 정보를 사용할 수 없습니다.";
    case error.TIMEOUT:
      return "위치 조회 시간이 초과되었습니다.";
    default:
      return "위치를 가져오는 중 오류가 발생했습니다.";
  }
}

interface CurrentLocationTrackerProps {
  /** 추적 활성화 */
  enabled?: boolean;
  /** 정확도 원 표시 */
  showAccuracy?: boolean;
  /** 펄스 애니메이션 */
  pulse?: boolean;
  /** 맵 중심으로 이동 */
  followLocation?: boolean;
  /** 클릭 핸들러 */
  onClick?: (coordinate: Coordinate) => void;
}

/**
 * 현재 위치 추적 및 표시 컴포넌트 (통합)
 */
export function CurrentLocationTracker({
  enabled = true,
  showAccuracy = true,
  pulse = true,
  followLocation = false,
  onClick,
}: CurrentLocationTrackerProps) {
  const { map, isReady } = useKakaoMap();

  const { coordinate, accuracy } = useCurrentLocation({
    enabled,
    onLocationChange: (coord) => {
      if (followLocation && map && isReady) {
        map.panTo(new window.kakao.maps.LatLng(coord.lat, coord.lng));
      }
    },
  });

  if (!coordinate) return null;

  return (
    <CurrentLocationMarker
      coordinate={coordinate}
      accuracy={showAccuracy ? (accuracy ?? undefined) : undefined}
      pulse={pulse}
      onClick={onClick ? () => onClick(coordinate) : undefined}
    />
  );
}

export type { CurrentLocationMarkerProps, UseCurrentLocationOptions, CurrentLocationTrackerProps };
