"use server";

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createErrorLogSchema } from "@/lib/schemas";
import type { ErrorSeverity, ErrorLog, ErrorLogRow } from "@/types/admin";

// ============================================
// Types
// ============================================

/**
 * 에러 로그 생성 입력
 */
export interface LogErrorInput {
  /** 에러 코드 (예: 'ROUTE_NOT_FOUND', 'API_RATE_LIMIT') */
  errorCode: string;
  /** 에러 메시지 */
  errorMessage: string;
  /** 스택 트레이스 */
  errorStack?: string;
  /** 추가 컨텍스트 (trip_id, place_id, user_id 등) */
  context?: Record<string, unknown>;
  /** 심각도 (기본: 'error') */
  severity?: ErrorSeverity;
  /** 발생 위치 (예: 'optimize/distance-matrix', 'api/odsay') */
  source: string;
}

/**
 * 에러 로그 생성 결과
 */
export interface LogErrorResult {
  success: boolean;
  data?: ErrorLog;
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * ErrorLogRow를 ErrorLog로 변환
 */
function rowToErrorLog(row: ErrorLogRow): ErrorLog {
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

// ============================================
// Server Actions
// ============================================

/**
 * 에러 로그 기록 Server Action (서비스 내부용)
 *
 * 서비스에서 발생한 에러를 DB에 기록합니다.
 * Service Role 권한을 사용하므로 인증 없이 호출 가능합니다.
 *
 * @param input - 에러 로그 데이터
 * @returns 생성된 에러 로그
 *
 * @example
 * ```tsx
 * // API 호출 실패 시 로깅
 * try {
 *   await fetchODsayRoute(origin, destination);
 * } catch (error) {
 *   await logError({
 *     errorCode: "API_TIMEOUT",
 *     errorMessage: error.message,
 *     errorStack: error.stack,
 *     context: { origin, destination },
 *     severity: "error",
 *     source: "api/odsay",
 *   });
 * }
 * ```
 */
export async function logError(input: LogErrorInput): Promise<LogErrorResult> {
  try {
    // 1. 입력 검증
    const validated = createErrorLogSchema.safeParse(input);
    if (!validated.success) {
      console.error("에러 로그 입력 검증 실패:", validated.error.errors);
      return {
        success: false,
        error:
          validated.error.errors[0]?.message || "입력값이 올바르지 않습니다.",
      };
    }

    const { errorCode, errorMessage, errorStack, context, severity, source } =
      validated.data;

    // 2. Service Role 클라이언트 생성 (RLS 우회)
    const supabase = getServiceRoleClient();

    // 3. 에러 로그 생성
    const { data, error } = await supabase
      .from("error_logs")
      .insert({
        error_code: errorCode,
        error_message: errorMessage,
        error_stack: errorStack || null,
        context: context || null,
        severity: severity || "error",
        source,
        resolved: false,
      })
      .select()
      .single();

    if (error) {
      console.error("에러 로그 저장 오류:", error);
      return {
        success: false,
        error: "에러 로그 저장에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: rowToErrorLog(data as ErrorLogRow),
    };
  } catch (error) {
    // 에러 로깅 자체에서 오류 발생 시 콘솔에만 출력
    console.error("에러 로그 기록 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 간편 에러 로그 기록 함수
 *
 * 자주 사용되는 에러 유형을 간편하게 로깅합니다.
 *
 * @param errorCode - 에러 코드
 * @param message - 에러 메시지
 * @param source - 발생 위치
 * @param context - 추가 컨텍스트
 */
export async function logErrorSimple(
  errorCode: string,
  message: string,
  source: string,
  context?: Record<string, unknown>
): Promise<void> {
  await logError({
    errorCode,
    errorMessage: message,
    source,
    context,
    severity: "error",
  });
}

/**
 * API 에러 로깅 헬퍼
 *
 * 외부 API 호출 실패를 로깅합니다.
 *
 * @param apiName - API 이름 (예: 'kakao', 'odsay')
 * @param endpoint - API 엔드포인트
 * @param error - 발생한 에러
 * @param context - 추가 컨텍스트
 */
export async function logApiError(
  apiName: string,
  endpoint: string,
  error: Error | unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  await logError({
    errorCode: "API_ERROR",
    errorMessage: `${apiName} API 호출 실패: ${errorObj.message}`,
    errorStack: errorObj.stack,
    source: `api/${apiName}`,
    context: {
      endpoint,
      ...context,
    },
    severity: "error",
  });
}

/**
 * API 타임아웃 로깅 헬퍼
 *
 * API 타임아웃을 로깅합니다.
 *
 * @param apiName - API 이름
 * @param endpoint - API 엔드포인트
 * @param timeoutMs - 타임아웃 시간 (ms)
 * @param context - 추가 컨텍스트
 */
export async function logApiTimeout(
  apiName: string,
  endpoint: string,
  timeoutMs: number,
  context?: Record<string, unknown>
): Promise<void> {
  await logError({
    errorCode: "TIMEOUT",
    errorMessage: `${apiName} API 타임아웃 (${timeoutMs}ms 초과)`,
    source: `api/${apiName}`,
    context: {
      endpoint,
      timeoutMs,
      ...context,
    },
    severity: "warning",
  });
}

/**
 * API Rate Limit 로깅 헬퍼
 *
 * API Rate Limit 초과를 로깅합니다.
 *
 * @param apiName - API 이름
 * @param endpoint - API 엔드포인트
 * @param context - 추가 컨텍스트
 */
export async function logApiRateLimit(
  apiName: string,
  endpoint: string,
  context?: Record<string, unknown>
): Promise<void> {
  await logError({
    errorCode: "API_RATE_LIMIT",
    errorMessage: `${apiName} API Rate Limit 초과`,
    source: `api/${apiName}`,
    context: {
      endpoint,
      ...context,
    },
    severity: "warning",
  });
}

/**
 * 최적화 에러 로깅 헬퍼
 *
 * 경로 최적화 관련 에러를 로깅합니다.
 *
 * @param errorCode - 에러 코드
 * @param message - 에러 메시지
 * @param module - 최적화 모듈명
 * @param context - 추가 컨텍스트 (tripId 등)
 */
export async function logOptimizeError(
  errorCode: string,
  message: string,
  module: string,
  context?: Record<string, unknown>
): Promise<void> {
  await logError({
    errorCode,
    errorMessage: message,
    source: `optimize/${module}`,
    context,
    severity: "error",
  });
}

/**
 * 데이터베이스 에러 로깅 헬퍼
 *
 * Supabase 데이터베이스 오류를 로깅합니다.
 *
 * @param operation - DB 작업 (select, insert, update, delete)
 * @param table - 테이블명
 * @param error - Supabase 에러 객체
 * @param context - 추가 컨텍스트
 */
export async function logDatabaseError(
  operation: string,
  table: string,
  error: { code?: string; message: string },
  context?: Record<string, unknown>
): Promise<void> {
  await logError({
    errorCode: "DATABASE_ERROR",
    errorMessage: `DB ${operation} 실패 (${table}): ${error.message}`,
    source: `db/${table}`,
    context: {
      operation,
      table,
      dbErrorCode: error.code,
      ...context,
    },
    severity: "error",
  });
}

/**
 * 검증 에러 로깅 헬퍼
 *
 * 입력 데이터 검증 실패를 로깅합니다.
 *
 * @param field - 검증 실패한 필드
 * @param message - 검증 에러 메시지
 * @param source - 발생 위치
 * @param context - 추가 컨텍스트
 */
export async function logValidationError(
  field: string,
  message: string,
  source: string,
  context?: Record<string, unknown>
): Promise<void> {
  await logError({
    errorCode: "VALIDATION_ERROR",
    errorMessage: `검증 실패 (${field}): ${message}`,
    source,
    context: {
      field,
      ...context,
    },
    severity: "info",
  });
}

/**
 * Critical 에러 로깅 헬퍼
 *
 * 치명적인 에러를 로깅합니다.
 * 즉시 확인이 필요한 심각한 오류에 사용합니다.
 *
 * @param errorCode - 에러 코드
 * @param message - 에러 메시지
 * @param source - 발생 위치
 * @param error - 원본 에러 객체
 * @param context - 추가 컨텍스트
 */
export async function logCriticalError(
  errorCode: string,
  message: string,
  source: string,
  error?: Error | unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const errorObj =
    error instanceof Error ? error : error ? new Error(String(error)) : undefined;

  await logError({
    errorCode,
    errorMessage: message,
    errorStack: errorObj?.stack,
    source,
    context: {
      ...context,
      timestamp: new Date().toISOString(),
    },
    severity: "critical",
  });
}
