// ============================================
// Map Components (지도 관련 UI 컴포넌트)
// ============================================

// 카카오 맵 래퍼
export {
  KakaoMap,
  useKakaoMap,
  useMapResize,
  useMapBounds,
  kakao,
} from "./kakao-map";
export type { KakaoMapProps } from "./kakao-map";

// 장소 마커
export {
  PlaceMarkers,
  SingleMarker,
  placesToMarkers,
} from "./place-markers";
export type { MarkerData, PlaceMarkersProps, SingleMarkerProps } from "./place-markers";

// 경로 폴리라인
export {
  RoutePolyline,
  MultiRoutePolyline,
  DirectRoutePolyline,
} from "./route-polyline";
export type {
  RoutePolylineProps,
  RouteSegmentData,
  MultiRoutePolylineProps,
  DirectRoutePolylineProps,
} from "./route-polyline";

// 정보창
export {
  InfoWindow,
  PlaceInfoWindow,
  SimpleInfoWindow,
  NavigationInfoWindow,
} from "./info-window";
export type {
  InfoWindowProps,
  PlaceInfoWindowProps,
  SimpleInfoWindowProps,
  NavigationInfoWindowProps,
} from "./info-window";

// 현재 위치
export {
  CurrentLocationMarker,
  CurrentLocationTracker,
  useCurrentLocation,
} from "./current-location";
export type {
  CurrentLocationMarkerProps,
  UseCurrentLocationOptions,
  CurrentLocationTrackerProps,
} from "./current-location";

// 맵 컨트롤
export {
  MapControls,
  ZoomControl,
  CurrentLocationControl,
  MapTypeControl,
  FitBoundsControl,
  MapControlButton,
  MapControlGroup,
} from "./map-controls";
export type {
  MapControlsProps,
  CurrentLocationControlProps,
  FitBoundsControlProps,
  MapControlButtonProps,
  MapControlGroupProps,
} from "./map-controls";
