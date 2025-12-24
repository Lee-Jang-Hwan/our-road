"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { resolveErrorLogSchema } from "@/lib/schemas";
import type { ErrorLog, ErrorLogRow } from "@/types/admin";

// ============================================
// Types
// ============================================

/**
 * 에러 로그 해결 입력
 */
export interface ResolveErrorLogInput {
  id: string;
  resolutionNote?: string;
}

/**
 * 에러 로그 해결 결과
 */
export interface ResolveErrorLogResult {
  success: boolean;
  data?: ErrorLog;
  error?: string;
}

/**
 * 일괄 해결 입력
 */
export interface BulkResolveInput {
  ids: string[];
  resolutionNote?: string;
}

/**
 * 일괄 해결 결과
 */
export interface BulkResolveResult {
  success: boolean;
  data?: {
    resolvedCount: number;
  };
  error?: string;
}

/**
 * 해결 취소 결과
 */
export interface UnresolveErrorLogResult {
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

/**
 * UUID 형식 검증
 */
function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
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
 * 에러 로그 해결 처리 Server Action
 *
 * 에러 로그를 해결 상태로 변경하고 해결 정보를 기록합니다.
 * resolved_at, resolved_by가 자동으로 기록됩니다.
 *
 * @param input - 해결 처리 정보
 * @returns 업데이트된 에러 로그
 *
 * @example
 * ```tsx
 * const result = await resolveErrorLog({
 *   id: "error-uuid",
 *   resolutionNote: "API 키 갱신으로 해결됨",
 * });
 * if (result.success) {
 *   console.log("에러가 해결되었습니다.");
 * }
 * ```
 */
export async function resolveErrorLog(
  input: ResolveErrorLogInput
): Promise<ResolveErrorLogResult> {
  try {
    // 1. 관리자 권한 확인
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: adminCheck.error,
      };
    }

    // 2. 입력 검증
    const validated = resolveErrorLogSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || "입력값이 올바르지 않습니다.",
      };
    }

    const { id, resolutionNote } = validated.data;

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 에러 로그 존재 및 상태 확인
    const { data: existingLog, error: fetchError } = await supabase
      .from("error_logs")
      .select("resolved")
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return {
          success: false,
          error: "에러 로그를 찾을 수 없습니다.",
        };
      }
      console.error("에러 로그 조회 오류:", fetchError);
      return {
        success: false,
        error: "에러 로그 조회에 실패했습니다.",
      };
    }

    if (existingLog.resolved) {
      return {
        success: false,
        error: "이미 해결된 에러 로그입니다.",
      };
    }

    // 5. 해결 처리
    const { data, error: updateError } = await supabase
      .from("error_logs")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: adminCheck.userId,
        resolution_note: resolutionNote || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("에러 로그 해결 처리 오류:", updateError);
      return {
        success: false,
        error: "에러 로그 해결 처리에 실패했습니다.",
      };
    }

    // 6. 캐시 무효화
    revalidatePath("/admin");
    revalidatePath("/admin/error-logs");

    return {
      success: true,
      data: rowToErrorLog(data as ErrorLogRow),
    };
  } catch (error) {
    console.error("에러 로그 해결 처리 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 에러 로그 일괄 해결 처리 Server Action
 *
 * 여러 에러 로그를 한 번에 해결 처리합니다.
 *
 * @param input - 일괄 해결 정보
 * @returns 해결된 개수
 *
 * @example
 * ```tsx
 * const result = await bulkResolveErrorLogs({
 *   ids: ["error-1", "error-2", "error-3"],
 *   resolutionNote: "정기 점검으로 일괄 해결",
 * });
 * if (result.success) {
 *   console.log(`${result.data.resolvedCount}건 해결됨`);
 * }
 * ```
 */
export async function bulkResolveErrorLogs(
  input: BulkResolveInput
): Promise<BulkResolveResult> {
  try {
    // 1. 관리자 권한 확인
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: adminCheck.error,
      };
    }

    const { ids, resolutionNote } = input;

    // 2. 입력 검증
    if (!ids || ids.length === 0) {
      return {
        success: false,
        error: "해결할 에러 로그를 선택해주세요.",
      };
    }

    if (ids.length > 100) {
      return {
        success: false,
        error: "한 번에 최대 100개까지 해결할 수 있습니다.",
      };
    }

    // UUID 형식 검증
    for (const id of ids) {
      if (!isValidUUID(id)) {
        return {
          success: false,
          error: `올바르지 않은 에러 로그 ID: ${id}`,
        };
      }
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 일괄 해결 처리 (미해결 상태인 것만)
    const { data, error: updateError } = await supabase
      .from("error_logs")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: adminCheck.userId,
        resolution_note: resolutionNote || null,
      })
      .in("id", ids)
      .eq("resolved", false)
      .select("id");

    if (updateError) {
      console.error("에러 로그 일괄 해결 오류:", updateError);
      return {
        success: false,
        error: "에러 로그 일괄 해결에 실패했습니다.",
      };
    }

    // 5. 캐시 무효화
    revalidatePath("/admin");
    revalidatePath("/admin/error-logs");

    return {
      success: true,
      data: {
        resolvedCount: data?.length ?? 0,
      },
    };
  } catch (error) {
    console.error("에러 로그 일괄 해결 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 에러 로그 해결 취소 Server Action
 *
 * 해결된 에러 로그를 미해결 상태로 되돌립니다.
 *
 * @param id - 에러 로그 ID
 * @returns 업데이트된 에러 로그
 *
 * @example
 * ```tsx
 * const result = await unresolveErrorLog("error-uuid");
 * if (result.success) {
 *   console.log("해결이 취소되었습니다.");
 * }
 * ```
 */
export async function unresolveErrorLog(
  id: string
): Promise<UnresolveErrorLogResult> {
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
    if (!isValidUUID(id)) {
      return {
        success: false,
        error: "올바르지 않은 에러 로그 ID입니다.",
      };
    }

    // 3. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 4. 에러 로그 존재 및 상태 확인
    const { data: existingLog, error: fetchError } = await supabase
      .from("error_logs")
      .select("resolved")
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return {
          success: false,
          error: "에러 로그를 찾을 수 없습니다.",
        };
      }
      console.error("에러 로그 조회 오류:", fetchError);
      return {
        success: false,
        error: "에러 로그 조회에 실패했습니다.",
      };
    }

    if (!existingLog.resolved) {
      return {
        success: false,
        error: "아직 해결되지 않은 에러 로그입니다.",
      };
    }

    // 5. 해결 취소
    const { data, error: updateError } = await supabase
      .from("error_logs")
      .update({
        resolved: false,
        resolved_at: null,
        resolved_by: null,
        resolution_note: null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("에러 로그 해결 취소 오류:", updateError);
      return {
        success: false,
        error: "에러 로그 해결 취소에 실패했습니다.",
      };
    }

    // 6. 캐시 무효화
    revalidatePath("/admin");
    revalidatePath("/admin/error-logs");

    return {
      success: true,
      data: rowToErrorLog(data as ErrorLogRow),
    };
  } catch (error) {
    console.error("에러 로그 해결 취소 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 해결 메모 수정 Server Action
 *
 * 이미 해결된 에러 로그의 해결 메모를 수정합니다.
 *
 * @param id - 에러 로그 ID
 * @param resolutionNote - 새로운 해결 메모
 * @returns 업데이트된 에러 로그
 */
export async function updateResolutionNote(
  id: string,
  resolutionNote: string
): Promise<ResolveErrorLogResult> {
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
    if (!isValidUUID(id)) {
      return {
        success: false,
        error: "올바르지 않은 에러 로그 ID입니다.",
      };
    }

    // 3. 메모 길이 검증
    if (resolutionNote.length > 500) {
      return {
        success: false,
        error: "해결 메모는 500자 이하여야 합니다.",
      };
    }

    // 4. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 5. 에러 로그 존재 및 상태 확인
    const { data: existingLog, error: fetchError } = await supabase
      .from("error_logs")
      .select("resolved")
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return {
          success: false,
          error: "에러 로그를 찾을 수 없습니다.",
        };
      }
      console.error("에러 로그 조회 오류:", fetchError);
      return {
        success: false,
        error: "에러 로그 조회에 실패했습니다.",
      };
    }

    if (!existingLog.resolved) {
      return {
        success: false,
        error: "해결된 에러 로그만 메모를 수정할 수 있습니다.",
      };
    }

    // 6. 메모 수정
    const { data, error: updateError } = await supabase
      .from("error_logs")
      .update({
        resolution_note: resolutionNote || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("해결 메모 수정 오류:", updateError);
      return {
        success: false,
        error: "해결 메모 수정에 실패했습니다.",
      };
    }

    // 7. 캐시 무효화
    revalidatePath("/admin");
    revalidatePath("/admin/error-logs");

    return {
      success: true,
      data: rowToErrorLog(data as ErrorLogRow),
    };
  } catch (error) {
    console.error("해결 메모 수정 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
