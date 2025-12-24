"use client";

import * as React from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  MoreHorizontal,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ErrorLog, ErrorSeverity, ErrorLogListResult } from "@/types/admin";

// ============================================
// Types
// ============================================

interface ErrorLogTableProps {
  /** 에러 로그 목록 */
  data: ErrorLogListResult;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 선택된 로그 ID 목록 */
  selectedIds?: string[];
  /** 선택 변경 핸들러 */
  onSelectionChange?: (ids: string[]) => void;
  /** 페이지 변경 핸들러 */
  onPageChange?: (page: number) => void;
  /** 상세 보기 핸들러 */
  onViewDetail?: (log: ErrorLog) => void;
  /** 해결 처리 핸들러 */
  onResolve?: (log: ErrorLog) => void;
  /** 해결 취소 핸들러 */
  onUnresolve?: (log: ErrorLog) => void;
  /** 삭제 핸들러 */
  onDelete?: (log: ErrorLog) => void;
  /** 새로고침 핸들러 */
  onRefresh?: () => void;
  /** 클래스명 */
  className?: string;
}

// ============================================
// Helper Components
// ============================================

/**
 * 심각도 배지 컴포넌트
 */
function SeverityBadge({ severity }: { severity: ErrorSeverity }) {
  const config: Record<
    ErrorSeverity,
    { icon: React.ReactNode; label: string; className: string }
  > = {
    info: {
      icon: <Info className="size-3" />,
      label: "정보",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    warning: {
      icon: <AlertTriangle className="size-3" />,
      label: "경고",
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    error: {
      icon: <AlertCircle className="size-3" />,
      label: "에러",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    critical: {
      icon: <XCircle className="size-3" />,
      label: "치명적",
      className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    },
  };

  const { icon, label, className } = config[severity];

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-transparent font-medium", className)}
    >
      {icon}
      {label}
    </Badge>
  );
}

/**
 * 상태 배지 컴포넌트
 */
function StatusBadge({ resolved }: { resolved: boolean }) {
  if (resolved) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      >
        <CheckCircle2 className="size-3" />
        해결됨
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 border-transparent bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
    >
      <AlertCircle className="size-3" />
      미해결
    </Badge>
  );
}

/**
 * 테이블 스켈레톤
 */
function ErrorLogTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

/**
 * 빈 상태 컴포넌트
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <CheckCircle2 className="text-muted-foreground mb-4 size-12" />
      <h3 className="text-lg font-medium">에러 로그가 없습니다</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        조건에 맞는 에러 로그가 없습니다.
      </p>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

/**
 * 에러 로그 테이블 컴포넌트
 *
 * 에러 로그 목록을 테이블 형태로 표시합니다.
 * 페이지네이션, 선택, 상세 보기, 해결/삭제 기능을 지원합니다.
 *
 * @example
 * ```tsx
 * <ErrorLogTable
 *   data={errorLogs}
 *   onViewDetail={(log) => setSelectedLog(log)}
 *   onResolve={(log) => handleResolve(log.id)}
 *   onPageChange={(page) => setCurrentPage(page)}
 * />
 * ```
 */
export function ErrorLogTable({
  data,
  isLoading = false,
  selectedIds = [],
  onSelectionChange,
  onPageChange,
  onViewDetail,
  onResolve,
  onUnresolve,
  onDelete,
  onRefresh,
  className,
}: ErrorLogTableProps) {
  const { data: logs, total, page, pageSize, totalPages } = data;

  // 전체 선택 토글
  const handleSelectAll = () => {
    if (!onSelectionChange) return;

    if (selectedIds.length === logs.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(logs.map((log) => log.id));
    }
  };

  // 개별 선택 토글
  const handleSelectOne = (id: string) => {
    if (!onSelectionChange) return;

    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  // 페이지 이동
  const goToPage = (newPage: number) => {
    if (onPageChange && newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("rounded-lg border", className)}>
        <ErrorLogTableSkeleton />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className={cn("rounded-lg border", className)}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 테이블 헤더 영역 */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          총 <span className="font-medium text-foreground">{total}</span>건
          {selectedIds.length > 0 && (
            <span className="ml-2">
              (<span className="font-medium text-foreground">{selectedIds.length}</span>건 선택)
            </span>
          )}
        </p>
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-1 size-4" />
            새로고침
          </Button>
        )}
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {onSelectionChange && (
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={logs.length > 0 && selectedIds.length === logs.length}
                    onChange={handleSelectAll}
                    className="size-4 rounded border-gray-300"
                  />
                </TableHead>
              )}
              <TableHead className="min-w-[140px]">발생 시간</TableHead>
              <TableHead className="min-w-[80px]">심각도</TableHead>
              <TableHead className="min-w-[120px]">에러 코드</TableHead>
              <TableHead className="min-w-[200px]">메시지</TableHead>
              <TableHead className="min-w-[120px]">발생 위치</TableHead>
              <TableHead className="min-w-[80px]">상태</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow
                key={log.id}
                className={cn(
                  "cursor-pointer",
                  selectedIds.includes(log.id) && "bg-muted/50"
                )}
                onClick={() => onViewDetail?.(log)}
              >
                {onSelectionChange && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(log.id)}
                      onChange={() => handleSelectOne(log.id)}
                      className="size-4 rounded border-gray-300"
                    />
                  </TableCell>
                )}
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(log.createdAt), "yyyy.MM.dd HH:mm", {
                    locale: ko,
                  })}
                </TableCell>
                <TableCell>
                  <SeverityBadge severity={log.severity} />
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {log.errorCode}
                </TableCell>
                <TableCell>
                  <span
                    className="line-clamp-1 max-w-[200px]"
                    title={log.errorMessage}
                  >
                    {log.errorMessage}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {log.source}
                </TableCell>
                <TableCell>
                  <StatusBadge resolved={log.resolved} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">메뉴 열기</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetail?.(log)}>
                        상세 보기
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {log.resolved ? (
                        <DropdownMenuItem onClick={() => onUnresolve?.(log)}>
                          해결 취소
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onResolve?.(log)}>
                          해결 처리
                        </DropdownMenuItem>
                      )}
                      {log.resolved && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete?.(log)}
                            className="text-destructive focus:text-destructive"
                          >
                            삭제
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {pageSize * (page - 1) + 1} -{" "}
            {Math.min(pageSize * page, total)} / {total}건
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">이전 페이지</span>
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? "default" : "outline"}
                  size="icon"
                  className="size-8"
                  onClick={() => goToPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">다음 페이지</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 컴팩트 에러 로그 테이블 (모바일용)
 */
export function ErrorLogTableCompact({
  data,
  isLoading,
  onViewDetail,
  onPageChange,
  className,
}: Omit<
  ErrorLogTableProps,
  "selectedIds" | "onSelectionChange" | "onResolve" | "onUnresolve" | "onDelete"
>) {
  const { data: logs, total, page, totalPages } = data;

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="mb-2 h-5 w-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-muted-foreground text-sm">
        총 <span className="font-medium text-foreground">{total}</span>건
      </p>

      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/50"
            onClick={() => onViewDetail?.(log)}
          >
            <div className="mb-2 flex items-center gap-2">
              <SeverityBadge severity={log.severity} />
              <StatusBadge resolved={log.resolved} />
              <span className="text-muted-foreground ml-auto text-xs">
                {format(new Date(log.createdAt), "MM.dd HH:mm", { locale: ko })}
              </span>
            </div>
            <p className="text-sm font-medium">{log.errorCode}</p>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
              {log.errorMessage}
            </p>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
          >
            <ChevronLeft className="mr-1 size-4" />
            이전
          </Button>
          <span className="text-muted-foreground text-sm">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(page + 1)}
          >
            다음
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Export helper components
export { SeverityBadge, StatusBadge, ErrorLogTableSkeleton };
