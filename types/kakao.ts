// ============================================
// Kakao API Types (카카오 API 응답 타입)
// ============================================

// ============================================
// Kakao Local API (장소 검색)
// ============================================

/**
 * Kakao Local API 공통 메타 정보
 */
export interface KakaoLocalMeta {
  /** 현재 페이지 번호 */
  pageable_count: number;
  /** 전체 결과 수 */
  total_count: number;
  /** 마지막 페이지 여부 */
  is_end: boolean;
  /** 동일 주소에 대한 장소 정보 (주소 검색 시) */
  same_name?: {
    region: string[];
    keyword: string;
    selected_region: string;
  };
}

/**
 * Kakao 키워드 검색 결과 문서 (장소)
 */
export interface KakaoPlaceDocument {
  /** 장소 ID */
  id: string;
  /** 장소명 */
  place_name: string;
  /** 카테고리 이름 (예: "음식점 > 한식") */
  category_name: string;
  /** 카테고리 그룹 코드 */
  category_group_code: KakaoCategoryCode;
  /** 카테고리 그룹명 */
  category_group_name: string;
  /** 전화번호 */
  phone: string;
  /** 지번 주소 */
  address_name: string;
  /** 도로명 주소 */
  road_address_name: string;
  /** 경도 (X) */
  x: string;
  /** 위도 (Y) */
  y: string;
  /** 장소 상세 페이지 URL */
  place_url: string;
  /** 중심 좌표까지의 거리 (미터) */
  distance?: string;
}

/**
 * Kakao 카테고리 그룹 코드
 */
export type KakaoCategoryCode =
  | "MT1" // 대형마트
  | "CS2" // 편의점
  | "PS3" // 어린이집, 유치원
  | "SC4" // 학교
  | "AC5" // 학원
  | "PK6" // 주차장
  | "OL7" // 주유소, 충전소
  | "SW8" // 지하철역
  | "BK9" // 은행
  | "CT1" // 문화시설
  | "AG2" // 중개업소
  | "PO3" // 공공기관
  | "AT4" // 관광명소
  | "AD5" // 숙박
  | "FD6" // 음식점
  | "CE7" // 카페
  | "HP8" // 병원
  | "PM9"; // 약국

/**
 * Kakao 키워드 검색 응답
 */
export interface KakaoKeywordSearchResponse {
  meta: KakaoLocalMeta;
  documents: KakaoPlaceDocument[];
}

/**
 * Kakao 카테고리 검색 응답
 */
export interface KakaoCategorySearchResponse {
  meta: KakaoLocalMeta;
  documents: KakaoPlaceDocument[];
}

/**
 * Kakao 좌표 → 주소 변환 결과 문서
 */
export interface KakaoAddressDocument {
  /** 도로명 주소 정보 */
  road_address: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    road_name: string;
    underground_yn: string;
    main_building_no: string;
    sub_building_no: string;
    building_name: string;
    zone_no: string;
  } | null;
  /** 지번 주소 정보 */
  address: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    mountain_yn: string;
    main_address_no: string;
    sub_address_no: string;
  };
}

/**
 * Kakao 좌표 → 주소 변환 응답
 */
export interface KakaoCoord2AddressResponse {
  meta: {
    total_count: number;
  };
  documents: KakaoAddressDocument[];
}

/**
 * Kakao 주소 검색 결과 문서
 */
export interface KakaoSearchAddressDocument {
  address_name: string;
  address_type: "REGION" | "ROAD" | "REGION_ADDR" | "ROAD_ADDR";
  x: string;
  y: string;
  address?: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    region_3depth_h_name: string;
    h_code: string;
    b_code: string;
    mountain_yn: string;
    main_address_no: string;
    sub_address_no: string;
    x: string;
    y: string;
  };
  road_address?: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    road_name: string;
    underground_yn: string;
    main_building_no: string;
    sub_building_no: string;
    building_name: string;
    zone_no: string;
    x: string;
    y: string;
  };
}

/**
 * Kakao 주소 검색 응답
 */
export interface KakaoSearchAddressResponse {
  meta: KakaoLocalMeta;
  documents: KakaoSearchAddressDocument[];
}

// ============================================
// Kakao Mobility API (경로 탐색)
// ============================================

/**
 * Kakao Mobility 경로 요청 (다중 경유지)
 */
export interface KakaoDirectionsRequest {
  /** 출발지 (lng,lat) */
  origin: {
    x: number;
    y: number;
  };
  /** 도착지 (lng,lat) */
  destination: {
    x: number;
    y: number;
  };
  /** 경유지 목록 (최대 30개) */
  waypoints?: Array<{
    name?: string;
    x: number;
    y: number;
  }>;
  /** 우선 순위 (RECOMMEND, TIME, DISTANCE) */
  priority?: "RECOMMEND" | "TIME" | "DISTANCE";
  /** 차량 유형 */
  car_fuel?: "GASOLINE" | "DIESEL" | "LPG";
  /** 차량 하이패스 유무 */
  car_hipass?: boolean;
  /** 대안 경로 제공 여부 */
  alternatives?: boolean;
  /** 도로 이벤트 제공 여부 */
  road_details?: boolean;
}

/**
 * Kakao Mobility 경로 응답
 */
export interface KakaoDirectionsResponse {
  /** 경로 ID */
  trans_id: string;
  /** 경로 목록 */
  routes: KakaoRoute[];
}

/**
 * Kakao 경로 정보
 */
export interface KakaoRoute {
  /** 결과 코드 */
  result_code: number;
  /** 결과 메시지 */
  result_msg: string;
  /** 경로 요약 정보 */
  summary: {
    /** 출발지 정보 */
    origin: {
      name: string;
      x: number;
      y: number;
    };
    /** 도착지 정보 */
    destination: {
      name: string;
      x: number;
      y: number;
    };
    /** 경유지 목록 */
    waypoints?: Array<{
      name: string;
      x: number;
      y: number;
    }>;
    /** 우선 순위 */
    priority: string;
    /** 예상 요금 */
    fare: {
      /** 택시 요금 */
      taxi: number;
      /** 톨비 */
      toll: number;
    };
    /** 총 거리 (미터) */
    distance: number;
    /** 총 소요 시간 (초) */
    duration: number;
  };
  /** 구간 정보 */
  sections: KakaoRouteSection[];
}

/**
 * Kakao 경로 구간 정보
 */
export interface KakaoRouteSection {
  /** 거리 (미터) */
  distance: number;
  /** 소요 시간 (초) */
  duration: number;
  /** 경계 박스 */
  bound: {
    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;
  };
  /** 도로 정보 */
  roads: KakaoRoad[];
  /** 안내 정보 */
  guides: KakaoGuide[];
}

/**
 * Kakao 도로 정보
 */
export interface KakaoRoad {
  /** 도로명 */
  name: string;
  /** 거리 (미터) */
  distance: number;
  /** 소요 시간 (초) */
  duration: number;
  /** 교통 상황 */
  traffic_speed: number;
  /** 교통 상태 (0: 미확인, 1: 원활, 2: 서행, 3: 정체) */
  traffic_state: number;
  /** 좌표 목록 [lng, lat, lng, lat, ...] */
  vertexes: number[];
}

/**
 * Kakao 안내 정보
 */
export interface KakaoGuide {
  /** 안내 이름 */
  name: string;
  /** 좌표 */
  x: number;
  y: number;
  /** 거리 (미터) */
  distance: number;
  /** 소요 시간 (초) */
  duration: number;
  /** 안내 타입 */
  type: number;
  /** 안내 코드 */
  guidance: string;
  /** 도로명 */
  road_index: number;
}

// ============================================
// Helper Types
// ============================================

/**
 * Kakao API 에러 응답
 */
export interface KakaoApiError {
  errorType: string;
  message: string;
}

/**
 * Kakao 카테고리 코드 매핑
 */
export const KAKAO_CATEGORY_MAP: Record<KakaoCategoryCode, string> = {
  MT1: "대형마트",
  CS2: "편의점",
  PS3: "어린이집/유치원",
  SC4: "학교",
  AC5: "학원",
  PK6: "주차장",
  OL7: "주유소/충전소",
  SW8: "지하철역",
  BK9: "은행",
  CT1: "문화시설",
  AG2: "중개업소",
  PO3: "공공기관",
  AT4: "관광명소",
  AD5: "숙박",
  FD6: "음식점",
  CE7: "카페",
  HP8: "병원",
  PM9: "약국",
};

/**
 * Kakao PlaceDocument를 PlaceSearchResult로 변환하는 헬퍼 함수
 */
export function convertKakaoPlaceToSearchResult(
  doc: KakaoPlaceDocument
): import("./place").PlaceSearchResult {
  return {
    id: doc.id,
    name: doc.place_name,
    address: doc.address_name,
    roadAddress: doc.road_address_name || undefined,
    coordinate: {
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
    },
    category: doc.category_name,
    categoryCode: doc.category_group_code,
    phone: doc.phone || undefined,
    distance: doc.distance ? parseInt(doc.distance) : undefined,
  };
}
