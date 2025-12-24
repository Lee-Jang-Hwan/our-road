// ============================================
// Zod Schemas - 공용 Export
// ============================================

// ============================================
// Common Schemas (공통)
// ============================================
export {
  timeSchema,
  dateSchema,
  durationSchema,
  prioritySchema,
  uuidSchema,
  paginationSchema,
  generateDurationOptions,
  generateTimeOptions,
} from "./common";

// ============================================
// Coordinate Schemas (좌표)
// ============================================
export {
  coordinateSchema,
  koreaCoordinateSchema,
  isValidCoordinate,
  isKoreaCoordinate,
} from "./coordinate";
export type { CoordinateInput } from "./coordinate";

// ============================================
// Place Schemas (장소)
// ============================================
export {
  placeCategorySchema,
  placeSchema,
  createPlaceSchema,
  updatePlaceSchema,
  reorderPlacesSchema,
  searchPlacesSchema,
  nearbyPlacesSchema,
} from "./place";
export type {
  PlaceInput,
  CreatePlaceInput,
  UpdatePlaceInput,
  ReorderPlacesInput,
  SearchPlacesInput,
  NearbyPlacesInput,
} from "./place";

// ============================================
// Schedule Schemas (일정)
// ============================================
export {
  fixedScheduleSchema,
  createFixedScheduleSchema,
  updateFixedScheduleSchema,
  scheduleItemSchema,
  dailyItinerarySchema,
} from "./schedule";
export type {
  FixedScheduleInput,
  CreateFixedScheduleInput,
  UpdateFixedScheduleInput,
  ScheduleItemInput,
  DailyItineraryInput,
} from "./schedule";

// ============================================
// Trip Schemas (여행)
// ============================================
export {
  tripStatusSchema,
  transportModeSchema,
  tripLocationSchema,
  createTripSchema,
  updateTripSchema,
  tripListFilterSchema,
  tripIdParamSchema,
} from "./trip";
export type {
  TripStatusInput,
  TransportModeInput,
  TripLocationInput,
  CreateTripInput,
  UpdateTripInput,
  TripListFilterInput,
} from "./trip";

// ============================================
// Optimize Schemas (최적화)
// ============================================
export {
  optimizeAlgorithmSchema,
  optimizeOptionsSchema,
  optimizeRequestSchema,
  simpleOptimizeRequestSchema,
  calculateDistanceSchema,
  distributeByDaySchema,
} from "./optimize";
export type {
  OptimizeAlgorithmInput,
  OptimizeOptionsInput,
  OptimizeRequestInput,
  SimpleOptimizeRequestInput,
  CalculateDistanceInput,
  DistributeByDayInput,
} from "./optimize";

// ============================================
// Route Schemas (경로 조회)
// ============================================
export {
  routePrioritySchema,
  baseRouteSchema,
  carRouteSchema,
  transitRouteSchema,
  walkingRouteSchema,
  routeQuerySchema,
} from "./route";
export type {
  RoutePriorityInput,
  BaseRouteInput,
  CarRouteInput,
  TransitRouteInput,
  WalkingRouteInput,
  RouteQueryInput,
} from "./route";

// ============================================
// Admin Schemas (관리자)
// ============================================
export {
  errorSeveritySchema,
  adminRoleSchema,
  createErrorLogSchema,
  resolveErrorLogSchema,
  errorLogFilterSchema,
  deleteErrorLogSchema,
  bulkDeleteErrorLogSchema,
  createAdminUserSchema,
  updateAdminUserSchema,
  deleteAdminUserSchema,
} from "./admin";
export type {
  ErrorSeverityInput,
  AdminRoleInput,
  CreateErrorLogInput,
  ResolveErrorLogInput,
  ErrorLogFilterInput,
  DeleteErrorLogInput,
  BulkDeleteErrorLogInput,
  CreateAdminUserInput,
  UpdateAdminUserInput,
  DeleteAdminUserInput,
} from "./admin";
