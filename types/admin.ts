// ============================================
// Admin Types (관리자/에러 로그 관련 타입)
// ============================================

/**
 * 에러 심각도
 */
export type ErrorSeverity = "info" | "warning" | "error" | "critical";

/**
 * 에러 로그
 */
export interface ErrorLog {
  /** UUID */
  id: string;
  /** 에러 코드 (예: 'ROUTE_NOT_FOUND', 'API_RATE_LIMIT') */
  errorCode: string;
  /** 에러 메시지 */
  errorMessage: string;
  /** 스택 트레이스 */
  errorStack?: string;
  /** 추가 컨텍스트 (trip_id, place_id, user_id 등) */
  context?: Record<string, unknown>;
  /** 심각도 */
  severity: ErrorSeverity;
  /** 발생 위치 (예: 'optimize/distance-matrix', 'api/odsay') */
  source: string;
  /** 해결 여부 */
  resolved: boolean;
  /** 해결 시간 */
  resolvedAt?: string;
  /** 해결한 관리자 ID */
  resolvedBy?: string;
  /** 해결 메모 */
  resolutionNote?: string;
  /** 생성일시 */
  createdAt: string;
  /** 수정일시 */
  updatedAt: string;
}

/**
 * 에러 로그 생성 시 필요한 데이터
 */
export interface CreateErrorLogData {
  errorCode: string;
  errorMessage: string;
  errorStack?: string;
  context?: Record<string, unknown>;
  severity?: ErrorSeverity;
  source: string;
}

/**
 * 에러 로그 해결 처리 데이터
 */
export interface ResolveErrorLogData {
  id: string;
  resolutionNote?: string;
}

/**
 * 에러 로그 필터
 */
export interface ErrorLogFilter {
  /** 해결 상태 */
  resolved?: boolean;
  /** 심각도 */
  severity?: ErrorSeverity;
  /** 에러 코드 */
  errorCode?: string;
  /** 발생 위치 */
  source?: string;
  /** 시작일 */
  startDate?: string;
  /** 종료일 */
  endDate?: string;
  /** 조회 개수 (기본: 50) */
  limit?: number;
  /** 오프셋 (기본: 0) */
  offset?: number;
}

/**
 * Supabase error_logs 테이블 Row 타입
 */
export interface ErrorLogRow {
  id: string;
  error_code: string;
  error_message: string;
  error_stack: string | null;
  context: Record<string, unknown> | null;
  severity: ErrorSeverity;
  source: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 관리자 역할
 */
export type AdminRole = "admin" | "super_admin";

/**
 * 관리자 사용자
 */
export interface AdminUser {
  /** UUID */
  id: string;
  /** Clerk User ID */
  clerkId: string;
  /** 관리자 역할 */
  role: AdminRole;
  /** 생성일시 */
  createdAt: string;
}

/**
 * Supabase admin_users 테이블 Row 타입
 */
export interface AdminUserRow {
  id: string;
  clerk_id: string;
  role: AdminRole;
  created_at: string;
}

/**
 * 에러 로그 목록 조회 결과
 */
export interface ErrorLogListResult {
  /** 에러 로그 목록 */
  data: ErrorLog[];
  /** 총 개수 */
  total: number;
  /** 현재 페이지 */
  page: number;
  /** 페이지당 개수 */
  pageSize: number;
  /** 전체 페이지 수 */
  totalPages: number;
}

/**
 * 에러 통계
 */
export interface ErrorStatistics {
  /** 총 에러 수 */
  totalErrors: number;
  /** 미해결 에러 수 */
  unresolvedErrors: number;
  /** 심각도별 에러 수 */
  bySeverity: Record<ErrorSeverity, number>;
  /** 에러 코드별 에러 수 */
  byErrorCode: Record<string, number>;
  /** 발생 위치별 에러 수 */
  bySource: Record<string, number>;
  /** 최근 24시간 에러 수 */
  last24Hours: number;
  /** 최근 7일 에러 수 */
  last7Days: number;
}

/**
 * ErrorLogRow를 ErrorLog로 변환하는 헬퍼 함수
 */
export function convertErrorLogRowToErrorLog(row: ErrorLogRow): ErrorLog {
  return {
    id: row.id,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    errorStack: row.error_stack ?? undefined,
    context: row.context ?? undefined,
    severity: row.severity,
    source: row.source,
    resolved: row.resolved,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    resolutionNote: row.resolution_note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * AdminUserRow를 AdminUser로 변환하는 헬퍼 함수
 */
export function convertAdminUserRowToAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    clerkId: row.clerk_id,
    role: row.role,
    createdAt: row.created_at,
  };
}

/**
 * 에러 심각도 표시 정보
 */
export const ERROR_SEVERITY_INFO: Record<
  ErrorSeverity,
  { label: string; color: string; emoji: string }
> = {
  info: { label: "정보", color: "blue", emoji: "ℹ️" },
  warning: { label: "경고", color: "yellow", emoji: "⚠️" },
  error: { label: "에러", color: "red", emoji: "🔴" },
  critical: { label: "치명적", color: "purple", emoji: "🚨" },
};

/**
 * 일반적인 에러 코드 목록
 */
export const COMMON_ERROR_CODES = [
  "ROUTE_NOT_FOUND",
  "API_RATE_LIMIT",
  "TIMEOUT",
  "INVALID_COORDINATES",
  "FIXED_SCHEDULE_CONFLICT",
  "DATABASE_ERROR",
  "AUTHENTICATION_ERROR",
  "VALIDATION_ERROR",
  "UNKNOWN",
] as const;

export type CommonErrorCode = (typeof COMMON_ERROR_CODES)[number];
