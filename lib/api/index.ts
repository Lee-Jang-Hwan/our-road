// ============================================
// External API Clients - 공용 Export
// ============================================

// ============================================
// Kakao API
// ============================================
export {
  // Local API (장소 검색)
  searchByKeyword,
  searchByCategory,
  coordToAddress,
  searchMultipleKeywords,
  // Mobility API (자동차 경로)
  getCarRoute,
  getCarDuration,
  getCarDistance,
  // Error
  KakaoApiError,
  // Config (advanced)
  KAKAO_LOCAL_BASE_URL,
  KAKAO_MOBILITY_BASE_URL,
} from "./kakao";

export type {
  KeywordSearchOptions,
  CategorySearchOptions,
  AddressResult,
  CarRouteOptions,
} from "./kakao";

// ============================================
// ODsay API (대중교통)
// ============================================
export {
  // 경로 검색
  searchTransitRoute,
  getBestTransitRoute,
  getTransitDuration,
  getTransitFare,
  searchMultipleRoutes,
  // 유틸리티
  filterRoutesByType,
  sortRoutesByTransfer,
  sortRoutesByDuration,
  sortRoutesByFare,
  // Error
  ODsayApiError,
  // Config (advanced)
  ODSAY_BASE_URL,
} from "./odsay";

export type {
  TransitRouteOptions,
  TransitSearchResult,
} from "./odsay";
