// ============================================
// Admin Zod Schema (관리자/에러 로그 스키마)
// ============================================

import { z } from "zod";
import { dateSchema, paginationSchema, uuidSchema } from "./common";

/**
 * 에러 심각도 스키마
 */
export const errorSeveritySchema = z.enum([
  "info",
  "warning",
  "error",
  "critical",
]);

/**
 * 관리자 역할 스키마
 */
export const adminRoleSchema = z.enum(["admin", "super_admin"]);

/**
 * 에러 로그 생성 스키마
 */
export const createErrorLogSchema = z.object({
  errorCode: z
    .string()
    .min(1, "에러 코드는 필수입니다")
    .max(50, "에러 코드는 50자 이하여야 합니다"),
  errorMessage: z
    .string()
    .min(1, "에러 메시지는 필수입니다")
    .max(500, "에러 메시지는 500자 이하여야 합니다"),
  errorStack: z
    .string()
    .max(5000, "스택 트레이스는 5000자 이하여야 합니다")
    .optional(),
  context: z.record(z.unknown()).optional(),
  severity: errorSeveritySchema.default("error"),
  source: z
    .string()
    .min(1, "발생 위치는 필수입니다")
    .max(100, "발생 위치는 100자 이하여야 합니다"),
});

/**
 * 에러 로그 해결 스키마
 */
export const resolveErrorLogSchema = z.object({
  id: uuidSchema,
  resolutionNote: z
    .string()
    .max(500, "해결 메모는 500자 이하여야 합니다")
    .optional(),
});

/**
 * 에러 로그 필터 스키마
 */
export const errorLogFilterSchema = z
  .object({
    resolved: z.boolean().optional(),
    severity: errorSeveritySchema.optional(),
    errorCode: z.string().max(50).optional(),
    source: z.string().max(100).optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  .merge(paginationSchema);

/**
 * 에러 로그 삭제 스키마 (단일)
 */
export const deleteErrorLogSchema = z.object({
  id: uuidSchema,
});

/**
 * 에러 로그 일괄 삭제 스키마
 */
export const bulkDeleteErrorLogSchema = z.object({
  ids: z
    .array(uuidSchema)
    .min(1, "최소 1개 이상의 에러 로그를 선택해주세요")
    .max(100, "최대 100개까지 삭제할 수 있습니다"),
});

/**
 * 관리자 사용자 생성 스키마
 */
export const createAdminUserSchema = z.object({
  clerkId: z.string().min(1, "Clerk ID는 필수입니다"),
  role: adminRoleSchema.default("admin"),
});

/**
 * 관리자 사용자 수정 스키마
 */
export const updateAdminUserSchema = z.object({
  role: adminRoleSchema,
});

/**
 * 관리자 사용자 삭제 스키마
 */
export const deleteAdminUserSchema = z.object({
  clerkId: z.string().min(1, "Clerk ID는 필수입니다"),
});

/**
 * 스키마 타입 추론
 */
export type ErrorSeverityInput = z.infer<typeof errorSeveritySchema>;
export type AdminRoleInput = z.infer<typeof adminRoleSchema>;
export type CreateErrorLogInput = z.infer<typeof createErrorLogSchema>;
export type ResolveErrorLogInput = z.infer<typeof resolveErrorLogSchema>;
export type ErrorLogFilterInput = z.infer<typeof errorLogFilterSchema>;
export type DeleteErrorLogInput = z.infer<typeof deleteErrorLogSchema>;
export type BulkDeleteErrorLogInput = z.infer<typeof bulkDeleteErrorLogSchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
export type DeleteAdminUserInput = z.infer<typeof deleteAdminUserSchema>;
