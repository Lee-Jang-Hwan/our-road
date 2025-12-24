// ============================================
// Admin Server Actions - 관리자 기능 통합 Export
// ============================================

/**
 * @fileoverview
 * 관리자 기능 관련 Server Actions 모듈입니다.
 *
 * ## 주요 기능
 *
 * ### 1. 에러 로그 조회 (get-error-logs.ts)
 * - 에러 로그 목록 조회 (필터링, 페이지네이션)
 * - 단일 에러 로그 조회
 * - 에러 통계 조회
 * - 에러 코드/발생 위치 목록 조회 (필터 UI용)
 *
 * ### 2. 에러 로그 해결 (resolve-error-log.ts)
 * - 에러 로그 해결 처리 (resolved_at, resolved_by 자동 기록)
 * - 일괄 해결 처리
 * - 해결 취소
 * - 해결 메모 수정
 *
 * ### 3. 에러 로그 삭제 (delete-error-log.ts)
 * - 에러 로그 삭제 (해결된 항목만)
 * - 일괄 삭제
 * - 해결된 로그 전체 삭제 (Super Admin)
 * - 오래된 로그 정리 (Super Admin)
 *
 * ### 4. 에러 로그 기록 (log-error.ts)
 * - 서비스 내부에서 에러 로깅
 * - 다양한 헬퍼 함수 제공 (API, DB, 최적화 등)
 *
 * ## 권한 체계
 *
 * - **admin**: 조회, 해결, 삭제 (해결된 항목만)
 * - **super_admin**: 전체 삭제, 오래된 로그 정리 추가 권한
 * - **서비스 내부**: log-error.ts는 Service Role 사용 (인증 불필요)
 *
 * ## 사용 예시
 *
 * ```typescript
 * import {
 *   // 조회
 *   getErrorLogs,
 *   getErrorLog,
 *   getErrorStatistics,
 *   getErrorCodes,
 *   getErrorSources,
 *   // 해결
 *   resolveErrorLog,
 *   bulkResolveErrorLogs,
 *   unresolveErrorLog,
 *   updateResolutionNote,
 *   // 삭제
 *   deleteErrorLog,
 *   bulkDeleteErrorLogs,
 *   deleteAllResolvedLogs,
 *   cleanupOldResolvedLogs,
 *   // 로깅
 *   logError,
 *   logApiError,
 *   logOptimizeError,
 *   logDatabaseError,
 * } from "@/actions/admin";
 *
 * // 1. 미해결 에러 목록 조회
 * const logs = await getErrorLogs({ resolved: false, limit: 20 });
 *
 * // 2. 에러 해결 처리
 * await resolveErrorLog({
 *   id: "error-uuid",
 *   resolutionNote: "API 키 갱신으로 해결됨",
 * });
 *
 * // 3. 해결된 에러 삭제
 * await deleteErrorLog("error-uuid");
 *
 * // 4. 서비스에서 에러 로깅
 * await logApiError("odsay", "/searchPubTransPath", error, {
 *   origin: { lat: 37.5, lng: 127.0 },
 *   destination: { lat: 37.6, lng: 127.1 },
 * });
 * ```
 */

// ============================================
// Get Error Logs (에러 로그 조회)
// ============================================

export {
  getErrorLogs,
  getErrorLog,
  getErrorStatistics,
  getErrorCodes,
  getErrorSources,
} from "./get-error-logs";

export type {
  ErrorLogFilterInput,
  GetErrorLogsResult,
  GetErrorLogResult,
  GetErrorStatisticsResult,
} from "./get-error-logs";

// ============================================
// Resolve Error Log (에러 로그 해결)
// ============================================

export {
  resolveErrorLog,
  bulkResolveErrorLogs,
  unresolveErrorLog,
  updateResolutionNote,
} from "./resolve-error-log";

export type {
  ResolveErrorLogInput,
  ResolveErrorLogResult,
  BulkResolveInput,
  BulkResolveResult,
  UnresolveErrorLogResult,
} from "./resolve-error-log";

// ============================================
// Delete Error Log (에러 로그 삭제)
// ============================================

export {
  deleteErrorLog,
  bulkDeleteErrorLogs,
  deleteAllResolvedLogs,
  cleanupOldResolvedLogs,
} from "./delete-error-log";

export type {
  DeleteErrorLogResult,
  BulkDeleteResult,
  CleanupResult,
} from "./delete-error-log";

// ============================================
// Log Error (에러 로그 기록)
// ============================================

export {
  logError,
  logErrorSimple,
  logApiError,
  logApiTimeout,
  logApiRateLimit,
  logOptimizeError,
  logDatabaseError,
  logValidationError,
  logCriticalError,
} from "./log-error";

export type { LogErrorInput, LogErrorResult } from "./log-error";
