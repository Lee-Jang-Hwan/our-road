// ============================================
// Route Types (이동 관련 타입)
// ============================================

/**
 * 이동 수단
 */
export type TransportMode = "walking" | "public" | "car";

/**
 * 대중교통 상세 모드
 */
export type PublicTransportMode =
  | "subway" // 지하철
  | "bus" // 버스
  | "train" // 기차
  | "express_bus" // 고속버스
  | "intercity_bus" // 시외버스
  | "ferry"; // 페리

/**
 * 대중교통 노선 정보
 */
export interface TransitLane {
  /** 노선명 (예: "2호선", "472") */
  name: string;
  /** 버스 번호 (버스인 경우) */
  busNo?: string;
  /** 버스 유형명 (버스인 경우, 예: "간선", "지선") */
  busType?: string;
  /** 지하철 노선 코드 (지하철인 경우) */
  subwayCode?: number;
  /** 노선 색상 (hex) */
  lineColor?: string;
}

/**
 * 대중교통 하위 구간 정보
 */
export interface TransitSubPath {
  /** 구간 타입 (1: 지하철, 2: 버스, 3: 도보) */
  trafficType: 1 | 2 | 3;
  /** 거리 (미터) */
  distance: number;
  /** 소요 시간 (분) */
  sectionTime: number;
  /** 정류장/역 수 */
  stationCount?: number;
  /** 출발 정류장/역 이름 */
  startName?: string;
  /** 출발 좌표 */
  startCoord?: { lat: number; lng: number };
  /** 도착 정류장/역 이름 */
  endName?: string;
  /** 도착 좌표 */
  endCoord?: { lat: number; lng: number };
  /** 노선 정보 */
  lane?: TransitLane;
  /** 방면 정보 (지하철) */
  way?: string;
  /** 경유 정류장/역 좌표 배열 (폴리라인 생성용) */
  passStopCoords?: Array<{ lat: number; lng: number }>;
}

/**
 * 대중교통 상세 정보
 */
export interface TransitDetails {
  /** 총 요금 (원) */
  totalFare: number;
  /** 환승 횟수 */
  transferCount: number;
  /** 도보 시간 (분) */
  walkingTime: number;
  /** 도보 거리 (미터) */
  walkingDistance: number;
  /** 상세 구간 정보 */
  subPaths: TransitSubPath[];
}

/**
 * 구간 이동 정보
 */
export interface RouteSegment {
  /** 이동 수단 */
  mode: TransportMode;
  /** 거리 (미터) */
  distance: number;
  /** 소요 시간 (분) */
  duration: number;
  /** 설명 (예: "3호선 안국역 → 을지로3가역") */
  description?: string;
  /** 경로 폴리라인 (지도 표시용) */
  polyline?: string;
  /** 요금 (원) */
  fare?: number;
  /** 대중교통 상세 정보 (public 모드일 때) */
  transitDetails?: TransitDetails;
}

/**
 * 대중교통 상세 구간 정보
 */
export interface TransitSegment {
  /** 대중교통 상세 모드 */
  mode: PublicTransportMode;
  /** 노선명 (예: "3호선", "272번 버스") */
  lineName?: string;
  /** 출발 정류장/역 */
  startStation: string;
  /** 도착 정류장/역 */
  endStation: string;
  /** 정류장/역 수 */
  stationCount?: number;
  /** 소요 시간 (분) */
  duration: number;
  /** 거리 (미터) */
  distance?: number;
}

/**
 * 대중교통 환승 정보 포함 경로
 */
export interface TransitRoute {
  /** 총 소요 시간 (분) */
  totalDuration: number;
  /** 총 거리 (미터) */
  totalDistance: number;
  /** 총 요금 (원) */
  totalFare: number;
  /** 환승 횟수 */
  transferCount: number;
  /** 상세 구간 정보 */
  segments: (RouteSegment | TransitSegment)[];
  /** 도보 시간 (분) */
  walkingTime: number;
  /** 도보 거리 (미터) */
  walkingDistance: number;
}

/**
 * 자동차 경로 정보
 */
export interface CarRoute {
  /** 총 소요 시간 (분) */
  totalDuration: number;
  /** 총 거리 (미터) */
  totalDistance: number;
  /** 예상 톨비 (원) */
  tollFare?: number;
  /** 예상 유류비 (원) */
  fuelCost?: number;
  /** 경로 폴리라인 */
  polyline?: string;
  /** 경로 요약 */
  summary?: string;
}

/**
 * 도보 경로 정보
 */
export interface WalkingRoute {
  /** 총 소요 시간 (분) */
  totalDuration: number;
  /** 총 거리 (미터) */
  totalDistance: number;
  /** 경로 폴리라인 */
  polyline?: string;
}

/**
 * 경로 조회 결과 통합 타입
 */
export type RouteResult = TransitRoute | CarRoute | WalkingRoute;

/**
 * 경로 조회 옵션
 */
export interface RouteOptions {
  /** 선호 이동 수단 */
  preferredMode: TransportMode;
  /** 출발 시간 (HH:mm) - 대중교통 시간표 조회용 */
  departureTime?: string;
  /** 우선 기준: 시간 우선 / 거리 우선 / 요금 우선 */
  priority?: "time" | "distance" | "fare";
}

/**
 * 경로 조회 실패 시 에러
 */
export interface RouteError {
  code: "ROUTE_NOT_FOUND" | "API_ERROR" | "INVALID_COORDINATES" | "TIMEOUT";
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// Public Transit Algorithm Types
// ============================================

export type TripMode = "OPEN" | "LOOP";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Waypoint {
  id: string;
  name: string;
  coord: LatLng;
  isFixed: boolean;
  dayLock?: number;
  importance?: number;
  stayMinutes?: number;
  fixedDate?: string; // "YYYY-MM-DD" format
  fixedStartTime?: string; // "HH:mm" format
}

export interface TripInput {
  tripId?: string;
  days: number;
  start: LatLng;
  end?: LatLng;
  lodging?: LatLng;
  dailyMaxMinutes?: number;
  waypoints: Waypoint[];
}

export interface Cluster {
  clusterId: string;
  dayIndex?: number;
  waypointIds: string[];
  centroid: LatLng;
}

export interface DayPlan {
  dayIndex: number;
  waypointOrder: string[];
  excludedWaypointIds: string[];
}

export interface SegmentKey {
  fromId: string;
  toId: string;
}

export interface SegmentCost {
  key: SegmentKey;
  durationMinutes: number;
  distanceMeters?: number;
  transfers?: number;
  waitTimeMinutes?: number;
  polyline?: string | LatLng[]; // String for encoded polyline or array of coordinates
  transitDetails?: {
    transportMode: 'subway' | 'bus' | 'walking';
    lineName?: string;
    startStation?: string;
    endStation?: string;
    stationCount?: number;
  };
}

export interface TripOutput {
  tripId: string;
  mode: TripMode;
  clusters: Cluster[];
  dayPlans: DayPlan[];
  segmentCosts: SegmentCost[];
}
