"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ErrorLogTable,
  ErrorLogTableCompact,
  ErrorLogFilter,
  ErrorLogDetail,
  ResolveDialog,
  BulkResolveDialog,
  DeleteConfirmDialog,
  BulkDeleteConfirmDialog,
} from "@/components/admin";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  getErrorLogs,
  getErrorCodes,
  getErrorSources,
  resolveErrorLog,
  bulkResolveErrorLogs,
  unresolveErrorLog,
  deleteErrorLog,
  bulkDeleteErrorLogs,
} from "@/actions/admin";
import type {
  ErrorLog,
  ErrorLogListResult,
  ErrorLogFilter as ErrorLogFilterType,
} from "@/types/admin";

/**
 * 에러 로그 관리 페이지
 *
 * 에러 로그 목록을 조회하고 필터링, 해결 처리, 삭제 등의 기능을 제공합니다.
 */
export default function ErrorLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // 상태 관리
  const [data, setData] = React.useState<ErrorLogListResult>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<ErrorLogFilterType>({});
  const [errorCodes, setErrorCodes] = React.useState<string[]>([]);
  const [sources, setSources] = React.useState<string[]>([]);

  // 선택 관련 상태
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // 모달 상태
  const [detailLog, setDetailLog] = React.useState<ErrorLog | null>(null);
  const [resolveLog, setResolveLog] = React.useState<ErrorLog | null>(null);
  const [deleteLog, setDeleteLog] = React.useState<ErrorLog | null>(null);
  const [showBulkResolve, setShowBulkResolve] = React.useState(false);
  const [showBulkDelete, setShowBulkDelete] = React.useState(false);

  // 처리 중 상태
  const [isProcessing, setIsProcessing] = React.useState(false);

  // URL 파라미터에서 하이라이트 ID 확인
  const highlightId = searchParams.get("highlight");

  // 필터 옵션 로드
  React.useEffect(() => {
    async function loadFilterOptions() {
      const [codesResult, sourcesResult] = await Promise.all([
        getErrorCodes(),
        getErrorSources(),
      ]);

      if (codesResult.success && codesResult.data) {
        setErrorCodes(codesResult.data);
      }
      if (sourcesResult.success && sourcesResult.data) {
        setSources(sourcesResult.data);
      }
    }

    loadFilterOptions();
  }, []);

  // 데이터 로드 함수
  const loadData = React.useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const limit = 20;
        const offset = (page - 1) * limit;

        const result = await getErrorLogs({
          ...filter,
          limit,
          offset,
        });

        if (result.success && result.data) {
          setData(result.data);
        } else {
          toast.error(result.error ?? "에러 로그를 불러오지 못했습니다.");
        }
      } catch (error) {
        console.error("데이터 로드 오류:", error);
        toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    [filter]
  );

  // 초기 로드 및 필터 변경 시 재로드
  React.useEffect(() => {
    loadData(1);
  }, [loadData]);

  // 하이라이트된 에러가 있으면 상세 보기
  React.useEffect(() => {
    if (highlightId && data.data.length > 0) {
      const log = data.data.find((l) => l.id === highlightId);
      if (log) {
        setDetailLog(log);
        // URL에서 highlight 파라미터 제거
        router.replace("/admin/error-logs", { scroll: false });
      }
    }
  }, [highlightId, data.data, router]);

  // 페이지 변경
  const handlePageChange = (page: number) => {
    loadData(page);
    setSelectedIds([]);
  };

  // 새로고침
  const handleRefresh = () => {
    loadData(data.page);
    setSelectedIds([]);
  };

  // 해결 처리
  const handleResolve = async (id: string, note?: string) => {
    setIsProcessing(true);
    try {
      const result = await resolveErrorLog({ id, resolutionNote: note });
      if (result.success) {
        toast.success("에러를 해결 처리했습니다.");
        setResolveLog(null);
        setDetailLog(null);
        handleRefresh();
      } else {
        toast.error(result.error ?? "해결 처리에 실패했습니다.");
      }
    } catch (error) {
      console.error("해결 처리 오류:", error);
      toast.error("해결 처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 일괄 해결 처리
  const handleBulkResolve = async (ids: string[], note?: string) => {
    setIsProcessing(true);
    try {
      const result = await bulkResolveErrorLogs({ ids, resolutionNote: note });
      if (result.success) {
        toast.success(`${result.data?.resolvedCount ?? ids.length}건의 에러를 해결 처리했습니다.`);
        setShowBulkResolve(false);
        setSelectedIds([]);
        handleRefresh();
      } else {
        toast.error(result.error ?? "일괄 해결 처리에 실패했습니다.");
      }
    } catch (error) {
      console.error("일괄 해결 처리 오류:", error);
      toast.error("일괄 해결 처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 해결 취소
  const handleUnresolve = async (log: ErrorLog) => {
    setIsProcessing(true);
    try {
      const result = await unresolveErrorLog(log.id);
      if (result.success) {
        toast.success("해결 상태를 취소했습니다.");
        setDetailLog(null);
        handleRefresh();
      } else {
        toast.error(result.error ?? "해결 취소에 실패했습니다.");
      }
    } catch (error) {
      console.error("해결 취소 오류:", error);
      toast.error("해결 취소 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!deleteLog) return;

    setIsProcessing(true);
    try {
      const result = await deleteErrorLog(deleteLog.id);
      if (result.success) {
        toast.success("에러 로그를 삭제했습니다.");
        setDeleteLog(null);
        setDetailLog(null);
        handleRefresh();
      } else {
        toast.error(result.error ?? "삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("삭제 오류:", error);
      toast.error("삭제 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      const result = await bulkDeleteErrorLogs(selectedIds);
      if (result.success) {
        toast.success(`${result.data?.deletedCount ?? selectedIds.length}건의 에러 로그를 삭제했습니다.`);
        setShowBulkDelete(false);
        setSelectedIds([]);
        handleRefresh();
      } else {
        toast.error(result.error ?? "일괄 삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("일괄 삭제 오류:", error);
      toast.error("일괄 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 선택된 항목 중 해결된 항목 수
  const selectedResolvedCount = React.useMemo(() => {
    return selectedIds.filter((id) => {
      const log = data.data.find((l) => l.id === id);
      return log?.resolved;
    }).length;
  }, [selectedIds, data.data]);

  // 선택된 항목 중 미해결 항목 수
  const selectedUnresolvedCount = selectedIds.length - selectedResolvedCount;

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">에러 로그</h1>
        <p className="text-muted-foreground mt-1">
          서비스에서 발생한 에러를 확인하고 관리합니다.
        </p>
      </div>

      {/* 필터 */}
      <div className="mb-6">
        <ErrorLogFilter
          value={filter}
          onChange={setFilter}
          errorCodes={errorCodes}
          sources={sources}
          isLoading={isLoading}
        />
      </div>

      {/* 선택 작업 버튼 */}
      {selectedIds.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            {selectedIds.length}건 선택됨
          </span>
          <div className="ml-auto flex gap-2">
            {selectedUnresolvedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkResolve(true)}
              >
                <CheckCircle2 className="mr-1 size-4" />
                일괄 해결 ({selectedUnresolvedCount})
              </Button>
            )}
            {selectedResolvedCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDelete(true)}
              >
                <Trash2 className="mr-1 size-4" />
                일괄 삭제 ({selectedResolvedCount})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 테이블 */}
      {isDesktop ? (
        <ErrorLogTable
          data={data}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onPageChange={handlePageChange}
          onViewDetail={setDetailLog}
          onResolve={setResolveLog}
          onUnresolve={handleUnresolve}
          onDelete={setDeleteLog}
          onRefresh={handleRefresh}
        />
      ) : (
        <ErrorLogTableCompact
          data={data}
          isLoading={isLoading}
          onViewDetail={setDetailLog}
          onPageChange={handlePageChange}
        />
      )}

      {/* 상세 모달 */}
      <ErrorLogDetail
        log={detailLog}
        open={!!detailLog}
        onOpenChange={(open) => !open && setDetailLog(null)}
        onResolve={() => {
          if (detailLog) {
            setResolveLog(detailLog);
          }
        }}
        onUnresolve={() => {
          if (detailLog) {
            handleUnresolve(detailLog);
          }
        }}
        onDelete={() => {
          if (detailLog) {
            setDeleteLog(detailLog);
          }
        }}
      />

      {/* 해결 다이얼로그 */}
      <ResolveDialog
        log={resolveLog}
        open={!!resolveLog}
        onOpenChange={(open) => !open && setResolveLog(null)}
        onResolve={handleResolve}
        isLoading={isProcessing}
      />

      {/* 일괄 해결 다이얼로그 */}
      <BulkResolveDialog
        ids={selectedIds.filter((id) => {
          const log = data.data.find((l) => l.id === id);
          return !log?.resolved;
        })}
        open={showBulkResolve}
        onOpenChange={setShowBulkResolve}
        onResolve={handleBulkResolve}
        isLoading={isProcessing}
      />

      {/* 삭제 확인 다이얼로그 */}
      <DeleteConfirmDialog
        log={deleteLog}
        open={!!deleteLog}
        onOpenChange={(open) => !open && setDeleteLog(null)}
        onConfirm={handleDelete}
        isLoading={isProcessing}
      />

      {/* 일괄 삭제 확인 다이얼로그 */}
      <BulkDeleteConfirmDialog
        count={selectedResolvedCount}
        open={showBulkDelete}
        onOpenChange={setShowBulkDelete}
        onConfirm={handleBulkDelete}
        isLoading={isProcessing}
      />
    </div>
  );
}
