// ============================================
// OurRoad Types - 공용 Export
// ============================================

// ============================================
// Place Types (장소 관련)
// ============================================
export type {
  Coordinate,
  PlaceCategory,
  Place,
  CreatePlaceData,
  UpdatePlaceData,
  TripPlaceRow,
  PlaceSearchResult,
} from "./place";

// ============================================
// Route Types (이동 관련)
// ============================================
export type {
  TransportMode,
  PublicTransportMode,
  TransitLane,
  TransitSubPath,
  TransitDetails,
  RouteSegment,
  TransitSegment,
  TransitRoute,
  CarRouteSegment,
  CarRoute,
  WalkingRoute,
  RouteResult,
  RouteOptions,
  RouteError,
  TripMode,
  LatLng,
  Waypoint,
  TripInput,
  Cluster,
  DayPlan,
  SegmentKey,
  SegmentCost,
  TripOutput,
} from "./route";

// ============================================
// Schedule Types (일정 관련)
// ============================================
export type {
  FixedSchedule,
  CreateFixedScheduleData,
  UpdateFixedScheduleData,
  TripFixedScheduleRow,
  ScheduleItem,
  DailyItinerary,
  TripItineraryRow,
  ScheduleItemRow,
  ItinerarySummary,
} from "./schedule";

// ============================================
// Trip Types (여행 계획 관련)
// ============================================
export type {
  TripStatus,
  TripLocation,
  Trip,
  TripWithDetails,
  CreateTripData,
  UpdateTripData,
  TripRow,
  TripListFilter,
  TripListItem,
  TripDuration,
  TripShare,
} from "./trip";

export { convertTripRowToTrip, calculateTripDuration } from "./trip";

// ============================================
// Optimize Types (최적화 관련)
// ============================================
export type {
  OptimizeAlgorithm,
  OptimizeOptions,
  OptimizeRequest,
  OptimizeErrorCode,
  OptimizeError,
  OptimizeStatistics,
  OptimizeResult,
  DistanceMatrix,
  OptimizeProgress,
  TwoOptResult,
  DayDistributionResult,
  ScheduleConflict,
  CostFunctionInput,
} from "./optimize";

export { DEFAULT_OPTIMIZE_OPTIONS, calculateCost } from "./optimize";

// ============================================
// Admin Types (관리자/에러 로그 관련)
// ============================================
export type {
  ErrorSeverity,
  ErrorLog,
  CreateErrorLogData,
  ResolveErrorLogData,
  ErrorLogFilter,
  ErrorLogRow,
  AdminRole,
  AdminUser,
  AdminUserRow,
  ErrorLogListResult,
  ErrorStatistics,
  CommonErrorCode,
} from "./admin";

export {
  convertErrorLogRowToErrorLog,
  convertAdminUserRowToAdminUser,
  ERROR_SEVERITY_INFO,
  COMMON_ERROR_CODES,
} from "./admin";

// ============================================
// Kakao API Types
// ============================================
export type {
  KakaoLocalMeta,
  KakaoPlaceDocument,
  KakaoCategoryCode,
  KakaoKeywordSearchResponse,
  KakaoCategorySearchResponse,
  KakaoAddressDocument,
  KakaoCoord2AddressResponse,
  KakaoSearchAddressDocument,
  KakaoSearchAddressResponse,
  KakaoDirectionsRequest,
  KakaoDirectionsResponse,
  KakaoRoute,
  KakaoRouteSection,
  KakaoRoad,
  KakaoGuide,
  KakaoApiError,
} from "./kakao";

export { KAKAO_CATEGORY_MAP, convertKakaoPlaceToSearchResult } from "./kakao";

// ============================================
// ODsay API Types
// ============================================
export type {
  ODsayResponse,
  ODsaySearchPathRequest,
  ODsaySearchPathResult,
  ODsayPath,
  ODsayPathInfo,
  ODsaySubPath,
  ODsayLane,
  ODsayStation,
  ODsayError,
  ODsayBusType,
  ODsaySubwayCode,
} from "./odsay";

export {
  ODSAY_BUS_TYPE_MAP,
  ODSAY_SUBWAY_LINE_MAP,
  convertODsaySubPathToSegment,
  convertODsayPathToTransitRoute,
} from "./odsay";
