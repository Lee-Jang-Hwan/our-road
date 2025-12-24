"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";

// ============================================
// Types
// ============================================

/**
 * 에러 로그 삭제 결과
 */
export interface DeleteErrorLogResult {
  success: boolean;
  error?: string;
}

/**
 * 일괄 삭제 결과
 */
export interface BulkDeleteResult {
  success: boolean;
  data?: {
    deletedCount: number;
  };
  error?: string;
}

/**
 * 오래된 로그 정리 결과
 */
export interface CleanupResult {
  success: boolean;
  data?: {
    deletedCount: number;
  };
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

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
  isSuperAdmin: boolean;
  userId?: string;
  error?: string;
}> {
  const { userId } = await auth();
  if (!userId) {
    return { isAdmin: false, isSuperAdmin: false, error: "로그인이 필요합니다." };
  }

  const supabase = createClerkSupabaseClient();

  const { data: adminUser, error } = await supabase
    .from("admin_users")
    .select("role")
    .eq("clerk_id", userId)
    .single();

  if (error || !adminUser) {
    return {
      isAdmin: false,
      isSuperAdmin: false,
      userId,
      error: "관리자 권한이 필요합니다.",
    };
  }

  return {
    isAdmin: true,
    isSuperAdmin: adminUser.role === "super_admin",
    userId,
  };
}

// ============================================
// Server Actions
// ============================================

/**
 * 에러 로그 삭제 Server Action
 *
 * 해결된 에러 로그를 삭제합니다.
 * 미해결 에러 로그는 삭제할 수 없습니다.
 *
 * @param id - 에러 로그 ID
 * @returns 삭제 결과
 *
 * @example
 * ```tsx
 * const result = await deleteErrorLog("error-uuid");
 * if (result.success) {
 *   console.log("에러 로그가 삭제되었습니다.");
 * }
 * ```
 */
export async function deleteErrorLog(id: string): Promise<DeleteErrorLogResult> {
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

    // 5. 해결 상태 확인 (미해결 로그는 삭제 불가)
    if (!existingLog.resolved) {
      return {
        success: false,
        error: "해결된 에러 로그만 삭제할 수 있습니다. 먼저 해결 처리를 해주세요.",
      };
    }

    // 6. 삭제 실행
    const { error: deleteError } = await supabase
      .from("error_logs")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("에러 로그 삭제 오류:", deleteError);
      return {
        success: false,
        error: "에러 로그 삭제에 실패했습니다.",
      };
    }

    // 7. 캐시 무효화
    revalidatePath("/admin");
    revalidatePath("/admin/error-logs");

    return {
      success: true,
    };
  } catch (error) {
    console.error("에러 로그 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 에러 로그 일괄 삭제 Server Action
 *
 * 여러 에러 로그를 한 번에 삭제합니다.
 * 해결된 에러 로그만 삭제됩니다.
 *
 * @param ids - 에러 로그 ID 배열
 * @returns 삭제된 개수
 *
 * @example
 * ```tsx
 * const result = await bulkDeleteErrorLogs(["error-1", "error-2"]);
 * if (result.success) {
 *   console.log(`${result.data.deletedCount}건 삭제됨`);
 * }
 * ```
 */
export async function bulkDeleteErrorLogs(
  ids: string[]
): Promise<BulkDeleteResult> {
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
    if (!ids || ids.length === 0) {
      return {
        success: false,
        error: "삭제할 에러 로그를 선택해주세요.",
      };
    }

    if (ids.length > 100) {
      return {
        success: false,
        error: "한 번에 최대 100개까지 삭제할 수 있습니다.",
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

    // 4. 삭제 실행 (해결된 것만)
    const { data, error: deleteError } = await supabase
      .from("error_logs")
      .delete()
      .in("id", ids)
      .eq("resolved", true)
      .select("id");

    if (deleteError) {
      console.error("에러 로그 일괄 삭제 오류:", deleteError);
      return {
        success: false,
        error: "에러 로그 일괄 삭제에 실패했습니다.",
      };
    }

    // 5. 캐시 무효화
    revalidatePath("/admin");
    revalidatePath("/admin/error-logs");

    return {
      success: true,
      data: {
        deletedCount: data?.length ?? 0,
      },
    };
  } catch (error) {
    console.error("에러 로그 일괄 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 해결된 모든 에러 로그 삭제 Server Action
 *
 * 해결 상태인 모든 에러 로그를 삭제합니다.
 * Super Admin 권한이 필요합니다.
 *
 * @returns 삭제된 개수
 *
 * @example
 * ```tsx
 * const result = await deleteAllResolvedLogs();
 * if (result.success) {
 *   console.log(`${result.data.deletedCount}건 삭제됨`);
 * }
 * ```
 */
export async function deleteAllResolvedLogs(): Promise<BulkDeleteResult> {
  try {
    // 1. Super Admin 권한 확인
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.isSuperAdmin) {
      return {
        success: false,
        error: "Super Admin 권한이 필요합니다.",
      };
    }

    // 2. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 3. 해결된 로그 개수 확인
    const { count } = await supabase
      .from("error_logs")
      .select("*", { count: "exact", head: true })
      .eq("resolved", true);

    // 4. 삭제 실행
    const { error: deleteError } = await supabase
      .from("error_logs")
      .delete()
      .eq("resolved", true);

    if (deleteError) {
      console.error("해결된 로그 전체 삭제 오류:", deleteError);
      return {
        success: false,
        error: "해결된 로그 전체 삭제에 실패했습니다.",
      };
    }

    // 5. 캐시 무효화
    revalidatePath("/admin");
    revalidatePath("/admin/error-logs");

    return {
      success: true,
      data: {
        deletedCount: count ?? 0,
      },
    };
  } catch (error) {
    console.error("해결된 로그 전체 삭제 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 오래된 해결 로그 정리 Server Action
 *
 * 지정된 일수 이전에 해결된 에러 로그를 삭제합니다.
 * Super Admin 권한이 필요합니다.
 *
 * @param daysOld - 기준 일수 (기본: 30일)
 * @returns 삭제된 개수
 *
 * @example
 * ```tsx
 * // 30일 이전에 해결된 로그 삭제
 * const result = await cleanupOldResolvedLogs(30);
 * if (result.success) {
 *   console.log(`${result.data.deletedCount}건 정리됨`);
 * }
 * ```
 */
export async function cleanupOldResolvedLogs(
  daysOld: number = 30
): Promise<CleanupResult> {
  try {
    // 1. Super Admin 권한 확인
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.isSuperAdmin) {
      return {
        success: false,
        error: "Super Admin 권한이 필요합니다.",
      };
    }

    // 2. 입력 검증
    if (daysOld < 1 || daysOld > 365) {
      return {
        success: false,
        error: "기준 일수는 1~365일 사이여야 합니다.",
      };
    }

    // 3. 기준 날짜 계산
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // 4. Supabase 클라이언트 생성
    const supabase = createClerkSupabaseClient();

    // 5. 대상 로그 개수 확인
    const { count } = await supabase
      .from("error_logs")
      .select("*", { count: "exact", head: true })
      .eq("resolved", true)
      .lt("resolved_at", cutoffDate.toISOString());

    // 6. 삭제 실행
    const { error: deleteError } = await supabase
      .from("error_logs")
      .delete()
      .eq("resolved", true)
      .lt("resolved_at", cutoffDate.toISOString());

    if (deleteError) {
      console.error("오래된 로그 정리 오류:", deleteError);
      return {
        success: false,
        error: "오래된 로그 정리에 실패했습니다.",
      };
    }

    // 7. 캐시 무효화
    revalidatePath("/admin");
    revalidatePath("/admin/error-logs");

    return {
      success: true,
      data: {
        deletedCount: count ?? 0,
      },
    };
  } catch (error) {
    console.error("오래된 로그 정리 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
