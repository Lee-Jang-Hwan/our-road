"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Coordinate } from "@/types/place";

// 카카오 맵 타입 선언
declare global {
  interface Window {
    kakao: typeof kakao;
  }
}

/* eslint-disable @typescript-eslint/no-namespace */
declare namespace kakao {
  namespace maps {
    class Map {
      constructor(container: HTMLElement, options: MapOptions);
      setCenter(latlng: LatLng): void;
      getCenter(): LatLng;
      setLevel(level: number, options?: { animate?: boolean }): void;
      getLevel(): number;
      setBounds(
        bounds: LatLngBounds,
        paddingTop?: number,
        paddingRight?: number,
        paddingBottom?: number,
        paddingLeft?: number,
      ): void;
      getBounds(): LatLngBounds;
      panTo(latlng: LatLng): void;
      relayout(): void;
      addControl(
        control: MapTypeControl | ZoomControl,
        position: ControlPosition,
      ): void;
      removeControl(control: MapTypeControl | ZoomControl): void;
      setMapTypeId(mapTypeId: MapTypeId): void;
    }

    interface MapOptions {
      center: LatLng;
      level?: number;
      mapTypeId?: MapTypeId;
      draggable?: boolean;
      scrollwheel?: boolean;
      disableDoubleClick?: boolean;
      disableDoubleClickZoom?: boolean;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      getLat(): number;
      getLng(): number;
    }

    class LatLngBounds {
      constructor(sw?: LatLng, ne?: LatLng);
      extend(latlng: LatLng): void;
      getSouthWest(): LatLng;
      getNorthEast(): LatLng;
      isEmpty(): boolean;
    }

    class Marker {
      constructor(options: MarkerOptions);
      setMap(map: Map | null): void;
      getMap(): Map | null;
      setPosition(position: LatLng): void;
      getPosition(): LatLng;
      setImage(image: MarkerImage): void;
      setZIndex(zIndex: number): void;
    }

    interface MarkerOptions {
      map?: Map;
      position: LatLng;
      image?: MarkerImage;
      title?: string;
      clickable?: boolean;
      zIndex?: number;
    }

    class MarkerImage {
      constructor(src: string, size: Size, options?: MarkerImageOptions);
    }

    interface MarkerImageOptions {
      offset?: Point;
      alt?: string;
      shape?: string;
      coords?: string;
    }

    class Size {
      constructor(width: number, height: number);
    }

    class Point {
      constructor(x: number, y: number);
    }

    class InfoWindow {
      constructor(options: InfoWindowOptions);
      open(map: Map, marker?: Marker): void;
      close(): void;
      setContent(content: string | HTMLElement): void;
      setPosition(position: LatLng): void;
      getContent(): string;
    }

    interface InfoWindowOptions {
      content?: string | HTMLElement;
      position?: LatLng;
      removable?: boolean;
      zIndex?: number;
    }

    class CustomOverlay {
      constructor(options: CustomOverlayOptions);
      setMap(map: Map | null): void;
      getMap(): Map | null;
      setPosition(position: LatLng): void;
      setContent(content: string | HTMLElement): void;
      setZIndex(zIndex: number): void;
    }

    interface CustomOverlayOptions {
      map?: Map;
      position: LatLng;
      content: string | HTMLElement;
      xAnchor?: number;
      yAnchor?: number;
      zIndex?: number;
      clickable?: boolean;
    }

    class Polyline {
      constructor(options: PolylineOptions);
      setMap(map: Map | null): void;
      getMap(): Map | null;
      setPath(path: LatLng[]): void;
      getPath(): LatLng[];
      setOptions(options: Partial<PolylineOptions>): void;
    }

    interface PolylineOptions {
      map?: Map;
      path: LatLng[];
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeStyle?: string;
      zIndex?: number;
    }

    class Circle {
      constructor(options: CircleOptions);
      setMap(map: Map | null): void;
    }

    interface CircleOptions {
      map?: Map;
      center: LatLng;
      radius: number;
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeStyle?: string;
      fillColor?: string;
      fillOpacity?: number;
      zIndex?: number;
    }

    class MapTypeControl {}
    class ZoomControl {}

    enum ControlPosition {
      TOP = 1,
      TOPLEFT = 2,
      TOPRIGHT = 3,
      BOTTOMLEFT = 4,
      LEFT = 5,
      RIGHT = 6,
      BOTTOMRIGHT = 7,
    }

    enum MapTypeId {
      ROADMAP = 1,
      SKYVIEW = 2,
      HYBRID = 3,
    }

    namespace event {
      function addListener(
        target: object,
        type: string,
        handler: (...args: unknown[]) => void,
      ): void;
      function removeListener(
        target: object,
        type: string,
        handler: (...args: unknown[]) => void,
      ): void;
      function trigger(target: object, type: string, data?: unknown): void;
    }

    function load(callback: () => void): void;
  }
}

// SDK 로드 상태
let isLoading = false;
let isLoaded = false;
const loadCallbacks: (() => void)[] = [];

/**
 * 카카오 맵 SDK를 동적으로 로드합니다.
 */
function loadKakaoMapSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 이미 로드된 경우
    if (isLoaded && window.kakao?.maps) {
      resolve();
      return;
    }

    // 로드 중인 경우 콜백 등록
    if (isLoading) {
      loadCallbacks.push(resolve);
      return;
    }

    // API 키 확인
    const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!apiKey) {
      reject(new Error("NEXT_PUBLIC_KAKAO_MAP_KEY가 설정되지 않았습니다."));
      return;
    }

    isLoading = true;

    // 스크립트 생성
    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
    script.async = true;

    script.onload = () => {
      window.kakao.maps.load(() => {
        isLoaded = true;
        isLoading = false;
        resolve();
        loadCallbacks.forEach((cb) => cb());
        loadCallbacks.length = 0;
      });
    };

    script.onerror = () => {
      isLoading = false;
      reject(new Error("카카오 맵 SDK 로드에 실패했습니다."));
    };

    document.head.appendChild(script);
  });
}

// 맵 컨텍스트
interface KakaoMapContextValue {
  map: kakao.maps.Map | null;
  isReady: boolean;
}

const KakaoMapContext = React.createContext<KakaoMapContextValue>({
  map: null,
  isReady: false,
});

/**
 * 카카오 맵 인스턴스에 접근하는 훅
 */
export function useKakaoMap() {
  const context = React.useContext(KakaoMapContext);
  if (!context) {
    throw new Error("useKakaoMap must be used within a KakaoMapProvider");
  }
  return context;
}

interface KakaoMapProps {
  /** 초기 중심 좌표 */
  center?: Coordinate;
  /** 초기 줌 레벨 (1-14, 작을수록 확대) */
  level?: number;
  /** 맵 타입 */
  mapType?: "roadmap" | "skyview" | "hybrid";
  /** 드래그 활성화 */
  draggable?: boolean;
  /** 스크롤 줌 활성화 */
  scrollwheel?: boolean;
  /** 더블클릭 줌 비활성화 */
  disableDoubleClickZoom?: boolean;
  /** 맵 준비 완료 콜백 */
  onReady?: (map: kakao.maps.Map) => void;
  /** 중심 변경 콜백 */
  onCenterChanged?: (center: Coordinate) => void;
  /** 줌 레벨 변경 콜백 */
  onZoomChanged?: (level: number) => void;
  /** 클릭 콜백 */
  onClick?: (coordinate: Coordinate) => void;
  /** 자식 컴포넌트 (마커, 폴리라인 등) */
  children?: React.ReactNode;
  /** 추가 클래스 */
  className?: string;
}

// 서울 시청 좌표 (기본값)
const DEFAULT_CENTER: Coordinate = { lat: 37.5665, lng: 126.978 };
const DEFAULT_LEVEL = 3;

/**
 * 카카오 맵 래퍼 컴포넌트
 */
export function KakaoMap({
  center = DEFAULT_CENTER,
  level = DEFAULT_LEVEL,
  mapType = "roadmap",
  draggable = true,
  scrollwheel = true,
  disableDoubleClickZoom = false,
  onReady,
  onCenterChanged,
  onZoomChanged,
  onClick,
  children,
  className,
}: KakaoMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<kakao.maps.Map | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 콜백을 ref로 저장하여 의존성 경고 해결
  const onReadyRef = React.useRef(onReady);
  const onCenterChangedRef = React.useRef(onCenterChanged);
  const onZoomChangedRef = React.useRef(onZoomChanged);
  const onClickRef = React.useRef(onClick);

  React.useEffect(() => {
    onReadyRef.current = onReady;
    onCenterChangedRef.current = onCenterChanged;
    onZoomChangedRef.current = onZoomChanged;
    onClickRef.current = onClick;
  }, [onReady, onCenterChanged, onZoomChanged, onClick]);

  // SDK 로드 및 맵 초기화
  React.useEffect(() => {
    let mounted = true;

    async function initMap() {
      try {
        await loadKakaoMapSdk();

        if (!mounted || !containerRef.current) return;

        const mapTypeId = {
          roadmap: kakao.maps.MapTypeId.ROADMAP,
          skyview: kakao.maps.MapTypeId.SKYVIEW,
          hybrid: kakao.maps.MapTypeId.HYBRID,
        }[mapType];

        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level,
          mapTypeId,
          draggable,
          scrollwheel,
          disableDoubleClickZoom,
        });

        mapRef.current = map;
        setIsReady(true);
        onReadyRef.current?.(map);

        // 이벤트 리스너 등록
        if (onCenterChangedRef.current) {
          kakao.maps.event.addListener(map, "center_changed", () => {
            const latlng = map.getCenter();
            onCenterChangedRef.current?.({
              lat: latlng.getLat(),
              lng: latlng.getLng(),
            });
          });
        }

        if (onZoomChangedRef.current) {
          kakao.maps.event.addListener(map, "zoom_changed", () => {
            onZoomChangedRef.current?.(map.getLevel());
          });
        }

        if (onClickRef.current) {
          kakao.maps.event.addListener(
            map,
            "click",
            (mouseEvent: { latLng: kakao.maps.LatLng }) => {
              const latlng = mouseEvent.latLng;
              onClickRef.current?.({
                lat: latlng.getLat(),
                lng: latlng.getLng(),
              });
            },
          );
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "맵 초기화 실패");
        }
      }
    }

    initMap();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 중심 좌표 업데이트 (마커가 맵 상단에 오도록 조정)
  React.useEffect(() => {
    if (mapRef.current && isReady) {
      // 맵의 bounds를 가져와서 높이 계산
      const bounds = mapRef.current.getBounds();
      const sw = bounds.getSouthWest(); // 남서쪽 모서리
      const ne = bounds.getNorthEast(); // 북동쪽 모서리
      const mapHeight = ne.getLat() - sw.getLat(); // 맵의 위도 범위 (높이)

      // 마커가 맵의 상단에 오도록 중심을 조정
      // 맵의 상단은 중심보다 mapHeight/2만큼 위에 있음
      // 마커가 상단에 오려면 중심을 마커보다 mapHeight/2 * 0.8 정도 아래로 설정
      // (0.8은 여유 공간을 위한 계수)
      const adjustedLat = center.lat - mapHeight * 0.2;

      mapRef.current.panTo(new kakao.maps.LatLng(adjustedLat, center.lng));
    }
  }, [center.lat, center.lng, isReady]);

  // 줌 레벨 업데이트
  React.useEffect(() => {
    if (mapRef.current && isReady) {
      mapRef.current.setLevel(level, { animate: true });
    }
  }, [level, isReady]);

  // 맵 타입 업데이트
  React.useEffect(() => {
    if (mapRef.current && isReady) {
      const mapTypeId = {
        roadmap: kakao.maps.MapTypeId.ROADMAP,
        skyview: kakao.maps.MapTypeId.SKYVIEW,
        hybrid: kakao.maps.MapTypeId.HYBRID,
      }[mapType];
      mapRef.current.setMapTypeId(mapTypeId);
    }
  }, [mapType, isReady]);

  // 에러 표시
  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
      >
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <KakaoMapContext.Provider value={{ map: mapRef.current, isReady }}>
      <div
        className={cn("relative overflow-hidden", className)}
        style={{
          clipPath: "inset(0)",
          contain: "strict",
          isolation: "isolate",
        }}
      >
        {/* 맵 컨테이너 */}
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full"
          style={{ clipPath: "inset(0)" }}
        />

        {/* 로딩 오버레이 */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* 자식 컴포넌트 (맵이 준비된 후에만 렌더링) */}
        {isReady && children}
      </div>
    </KakaoMapContext.Provider>
  );
}

/**
 * 맵 리사이즈 훅 (컨테이너 크기 변경 시 호출)
 */
export function useMapResize() {
  const { map, isReady } = useKakaoMap();

  const relayout = React.useCallback(() => {
    if (map && isReady) {
      map.relayout();
    }
  }, [map, isReady]);

  return relayout;
}

/**
 * 맵 바운드 설정 훅
 */
export function useMapBounds() {
  const { map, isReady } = useKakaoMap();

  const setBounds = React.useCallback(
    (coordinates: Coordinate[], padding = 50) => {
      if (!map || !isReady || coordinates.length === 0) return;

      const bounds = new kakao.maps.LatLngBounds();
      coordinates.forEach((coord) => {
        bounds.extend(new kakao.maps.LatLng(coord.lat, coord.lng));
      });

      map.setBounds(bounds, padding, padding, padding, padding);
    },
    [map, isReady],
  );

  return setBounds;
}

// 타입 export
export type { KakaoMapProps };
