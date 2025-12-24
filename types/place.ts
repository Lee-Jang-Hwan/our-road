// ============================================
// Place Types (장소 관련 타입)
// ============================================

/**
 * 좌표 정보
 */
export interface Coordinate {
  /** 위도 (-90 ~ 90) */
  lat: number;
  /** 경도 (-180 ~ 180) */
  lng: number;
}

/**
 * 장소 카테고리
 */
export type PlaceCategory =
  | "tourist_attraction" // 관광지
  | "restaurant" // 음식점
  | "cafe" // 카페
  | "shopping" // 쇼핑
  | "accommodation" // 숙박
  | "entertainment" // 엔터테인먼트
  | "culture" // 문화시설
  | "nature" // 자연/공원
  | "other"; // 기타

/**
 * 장소 기본 정보
 */
export interface Place {
  /** UUID */
  id: string;
  /** 장소명 */
  name: string;
  /** 주소 */
  address: string;
  /** 좌표 */
  coordinate: Coordinate;
  /** 카테고리 */
  category?: PlaceCategory;
  /** Kakao Place ID (연동용) */
  kakaoPlaceId?: string;
  /** 예상 체류 시간 (분) - 30분~720분, 30분 단위 */
  estimatedDuration: number;
  /** 사용자 우선순위 (1~100, 낮을수록 높은 우선순위) */
  priority?: number;
}

/**
 * 장소 생성 시 필요한 데이터
 */
export interface CreatePlaceData {
  tripId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: PlaceCategory;
  kakaoPlaceId?: string;
  estimatedDuration?: number;
  priority?: number;
}

/**
 * 장소 업데이트 시 필요한 데이터
 */
export interface UpdatePlaceData {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  category?: PlaceCategory;
  estimatedDuration?: number;
  priority?: number;
}

/**
 * Supabase trip_places 테이블 Row 타입
 */
export interface TripPlaceRow {
  id: string;
  trip_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: PlaceCategory | null;
  kakao_place_id: string | null;
  priority: number | null;
  estimated_duration: number;
  created_at: string;
}

/**
 * 장소 검색 결과 (Kakao API 기반)
 */
export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string;
  roadAddress?: string;
  coordinate: Coordinate;
  category?: string;
  categoryCode?: string;
  phone?: string;
  distance?: number;
}
