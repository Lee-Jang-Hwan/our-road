"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { errorLogFilterSchema } from "@/lib/schemas";
import type {
  ErrorLog,
  ErrorLogRow,
  ErrorLogListResult,
  ErrorStatistics,
  ErrorSeverity,
  convertErrorLogRowToErrorLog,
} from "@/types/admin";

// ============================================
// Types
// ============================================

/**
 * 에러 로그 필터 입력
 */
export interface ErrorLogFilterInput {
  resolved?: boolean;
  severity?: ErrorSeverity;
  errorCode?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * 에러 로그 목록 조회 결과
 */
export interface GetErrorLogsResult {
  success: boolean;
  data?: ErrorLogListResult;
  error?: string;
}

/**
 * 단일 에러 로그 조회 결과
 */
export interface GetErrorLogResult {
  success: boolean;
  data?: ErrorLog;
  error?: string;
}

/**
 * 에러 통계 조회 결과
 */
export interface GetErrorStatisticsResult {
  success: boolean;
  data?: ErrorStatistics;
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

/**
 * 관리자 여부 확인
 */
async function checkAdminAccess(): Promise<{
  isAdmin: boolean;
  userId?: string;
  error?: string;
}> {
  const { userId } = await auth();
  if (!userId) {
    return { isAdmin: false, error: "로그인이 필요합니다." };
  }

  const supabase = createClerkSupabaseClient();

  const { data: adminUser, error } = await supabase
    .from("admin_users")
    .select("role")
    .eq("clerk_id", userId)
    .single();

  if (error || !adminUser) {
    return { isAdmin: false, userId, error: "관리자 권한이 필요합니다." };
  }

  return { isAdmin: true, userId };
}

// ============================================
// Server Actions
// ============================================

/**
 * 에러 로그 목록 조회 Server Action
 *
 * 필터링 및 페이지네이션을 지원하는 에러 로그 목록 조회입니다.
 * 관리자 권한이 필요합니다.
 *
 * @param filter - 필터 조건
 * @returns 에러 로그 목록 및 페이지네이션 정보
 *
 * @example
 * ```tsx
 * // 미해결 에러만 조회
 * const result = await getErrorLogs({ resolved: false });
 *
 * // critical 심각도만 조회
 * const result = await getErrorLogs({ severity: "critical" });
 *
 * // 페이지네이션
 * const result = await getErrorLogs({ limit: 20, offset: 40 });
 * ```
 */
export async function getErrorLogs(
  filter?: ErrorLogFilterInput
): Promise<GetErrorLogsResult> {
  try {
    // 1. 관리자 권한 확인
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: adminCheck.error,
      };
    }

    // 2. 필터 검증
    const validatedFilter = filter
      ? errorLogFilterSchema.safeParse(filter)
      : { success: true, data: {} as ErrorLogFilterInput };

    if (!validatedFilter.success) {
      return {
        success: false,
        error: "유효하지 않은 필터 조건입니다.",
      };
    }

    const {
      resolved,
      severity,
      errorCode,
      source,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = validatedFilter.data;

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 쿼리 빌드
    let query = supabase.from("error_logs").select("*", { count: "exact" });

    // 필터 적용
    if (resolved !== undefined) {
      query = query.eq("resolved", resolved);
    }
    if (severity) {
      query = query.eq("severity", severity);
    }
    if (errorCode) {
      query = query.eq("error_code", errorCode);
    }
    if (source) {
      query = query.ilike("source", `%${source}%`);
    }
    if (startDate) {
      query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
    }

    // 정렬 및 페이지네이션
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 5. 쿼리 실행
    const { data, count, error } = await query;

    if (error) {
      console.error("에러 로그 조회 오류:", error);
      return {
        success: false,
        error: "에러 로그 조회에 실패했습니다.",
      };
    }

    // 6. 결과 변환
    const errorLogs = (data as ErrorLogRow[]).map(rowToErrorLog);
    const total = count ?? 0;
    const pageSize = limit;
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        data: errorLogs,
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (error) {
    console.error("에러 로그 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 단일 에러 로그 조회 Server Action
 *
 * @param id - 에러 로그 ID
 * @returns 에러 로그 상세 정보
 */
export async function getErrorLog(id: string): Promise<GetErrorLogResult> {
  try {
    // 1. 관리자 권한 확인
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: adminCheck.error,
      };
    }

    // 2. UUID 검증
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return {
        success: false,
        error: "올바르지 않은 에러 로그 ID입니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 에러 로그 조회
    const { data, error } = await supabase
      .from("error_logs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return {
          success: false,
          error: "에러 로그를 찾을 수 없습니다.",
        };
      }
      console.error("에러 로그 조회 오류:", error);
      return {
        success: false,
        error: "에러 로그 조회에 실패했습니다.",
      };
    }

    return {
      success: true,
      data: rowToErrorLog(data as ErrorLogRow),
    };
  } catch (error) {
    console.error("에러 로그 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 에러 통계 조회 Server Action
 *
 * 에러 로그 전체 통계를 조회합니다.
 *
 * @returns 에러 통계 정보
 *
 * @example
 * ```tsx
 * const result = await getErrorStatistics();
 * if (result.success && result.data) {
 *   console.log(`총 ${result.data.totalErrors}건의 에러`);
 *   console.log(`미해결: ${result.data.unresolvedErrors}건`);
 * }
 * ```
 */
export async function getErrorStatistics(): Promise<GetErrorStatisticsResult> {
  try {
    // 1. 관리자 권한 확인
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: adminCheck.error,
      };
    }

    // 2. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 3. 기본 통계 조회 (병렬 처리)
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalResult,
      unresolvedResult,
      last24HoursResult,
      last7DaysResult,
      allLogsResult,
    ] = await Promise.all([
      supabase
        .from("error_logs")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("error_logs")
        .select("*", { count: "exact", head: true })
        .eq("resolved", false),
      supabase
        .from("error_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", last24Hours.toISOString()),
      supabase
        .from("error_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", last7Days.toISOString()),
      supabase
        .from("error_logs")
        .select("severity, error_code, source"),
    ]);

    // 4. 집계 계산
    const bySeverity: Record<ErrorSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };
    const byErrorCode: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    if (allLogsResult.data) {
      for (const log of allLogsResult.data) {
        // 심각도별 집계
        const severity = log.severity as ErrorSeverity;
        bySeverity[severity] = (bySeverity[severity] || 0) + 1;

        // 에러 코드별 집계
        const errorCode = log.error_code as string;
        byErrorCode[errorCode] = (byErrorCode[errorCode] || 0) + 1;

        // 발생 위치별 집계
        const source = log.source as string;
        bySource[source] = (bySource[source] || 0) + 1;
      }
    }

    return {
      success: true,
      data: {
        totalErrors: totalResult.count ?? 0,
        unresolvedErrors: unresolvedResult.count ?? 0,
        bySeverity,
        byErrorCode,
        bySource,
        last24Hours: last24HoursResult.count ?? 0,
        last7Days: last7DaysResult.count ?? 0,
      },
    };
  } catch (error) {
    console.error("에러 통계 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 에러 코드 목록 조회 Server Action
 *
 * 사용된 에러 코드 목록을 조회합니다 (필터 UI용).
 *
 * @returns 에러 코드 목록
 */
export async function getErrorCodes(): Promise<{
  success: boolean;
  data?: string[];
  error?: string;
}> {
  try {
    // 1. 관리자 권한 확인
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: adminCheck.error,
      };
    }

    // 2. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 3. 고유한 에러 코드 조회
    const { data, error } = await supabase
      .from("error_logs")
      .select("error_code")
      .order("error_code", { ascending: true });

    if (error) {
      console.error("에러 코드 조회 오류:", error);
      return {
        success: false,
        error: "에러 코드 조회에 실패했습니다.",
      };
    }

    // 중복 제거
    const uniqueCodes = [...new Set(data.map((d) => d.error_code))];

    return {
      success: true,
      data: uniqueCodes,
    };
  } catch (error) {
    console.error("에러 코드 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 발생 위치 목록 조회 Server Action
 *
 * 사용된 발생 위치 목록을 조회합니다 (필터 UI용).
 *
 * @returns 발생 위치 목록
 */
export async function getErrorSources(): Promise<{
  success: boolean;
  data?: string[];
  error?: string;
}> {
  try {
    // 1. 관리자 권한 확인
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: adminCheck.error,
      };
    }

    // 2. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 3. 고유한 발생 위치 조회
    const { data, error } = await supabase
      .from("error_logs")
      .select("source")
      .order("source", { ascending: true });

    if (error) {
      console.error("발생 위치 조회 오류:", error);
      return {
        success: false,
        error: "발생 위치 조회에 실패했습니다.",
      };
    }

    // 중복 제거
    const uniqueSources = [...new Set(data.map((d) => d.source))];

    return {
      success: true,
      data: uniqueSources,
    };
  } catch (error) {
    console.error("발생 위치 조회 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
