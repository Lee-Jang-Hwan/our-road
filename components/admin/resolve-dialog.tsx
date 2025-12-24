"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ErrorLog } from "@/types/admin";

// ============================================
// Types
// ============================================

interface ResolveDialogProps {
  /** 해결할 에러 로그 (null이면 다이얼로그 닫힘) */
  log: ErrorLog | null;
  /** 열림 상태 */
  open: boolean;
  /** 닫기 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 해결 처리 핸들러 */
  onResolve: (id: string, resolutionNote?: string) => Promise<void>;
  /** 로딩 상태 */
  isLoading?: boolean;
}

interface BulkResolveDialogProps {
  /** 해결할 에러 로그 ID 목록 */
  ids: string[];
  /** 열림 상태 */
  open: boolean;
  /** 닫기 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 일괄 해결 처리 핸들러 */
  onResolve: (ids: string[], resolutionNote?: string) => Promise<void>;
  /** 로딩 상태 */
  isLoading?: boolean;
}

// ============================================
// Main Component
// ============================================

/**
 * 에러 로그 해결 다이얼로그 컴포넌트
 *
 * 에러 로그를 해결 상태로 변경하고 해결 메모를 입력할 수 있는 다이얼로그입니다.
 * 모바일에서는 하단 시트로 표시됩니다.
 *
 * @example
 * ```tsx
 * const [resolveLog, setResolveLog] = useState<ErrorLog | null>(null);
 *
 * <ResolveDialog
 *   log={resolveLog}
 *   open={!!resolveLog}
 *   onOpenChange={(open) => !open && setResolveLog(null)}
 *   onResolve={async (id, note) => {
 *     await resolveErrorLog({ id, resolutionNote: note });
 *     setResolveLog(null);
 *   }}
 * />
 * ```
 */
export function ResolveDialog({
  log,
  open,
  onOpenChange,
  onResolve,
  isLoading = false,
}: ResolveDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [note, setNote] = React.useState("");

  // 다이얼로그가 열릴 때 메모 초기화
  React.useEffect(() => {
    if (open) {
      setNote("");
    }
  }, [open]);

  const handleResolve = async () => {
    if (!log) return;
    await onResolve(log.id, note.trim() || undefined);
  };

  const content = (
    <div className="space-y-4">
      {log && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="font-mono text-sm font-medium">{log.errorCode}</p>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
            {log.errorMessage}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="resolution-note">해결 메모 (선택)</Label>
        <Textarea
          id="resolution-note"
          placeholder="해결 방법이나 원인을 기록하세요..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          disabled={isLoading}
        />
        <p className="text-muted-foreground text-xs text-right">
          {note.length}/500
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isLoading}
      >
        취소
      </Button>
      <Button onClick={handleResolve} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            처리 중...
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 size-4" />
            해결 처리
          </>
        )}
      </Button>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>에러 해결 처리</DialogTitle>
            <DialogDescription>
              이 에러를 해결됨으로 표시합니다. 필요한 경우 해결 메모를 추가할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          {content}
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>에러 해결 처리</SheetTitle>
          <SheetDescription>
            이 에러를 해결됨으로 표시합니다.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">{content}</div>
        <SheetFooter className="mt-6">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * 일괄 해결 다이얼로그 컴포넌트
 *
 * 여러 에러 로그를 한 번에 해결 처리하는 다이얼로그입니다.
 *
 * @example
 * ```tsx
 * const [selectedIds, setSelectedIds] = useState<string[]>([]);
 * const [showBulkResolve, setShowBulkResolve] = useState(false);
 *
 * <BulkResolveDialog
 *   ids={selectedIds}
 *   open={showBulkResolve}
 *   onOpenChange={setShowBulkResolve}
 *   onResolve={async (ids, note) => {
 *     await bulkResolveErrorLogs({ ids, resolutionNote: note });
 *     setSelectedIds([]);
 *     setShowBulkResolve(false);
 *   }}
 * />
 * ```
 */
export function BulkResolveDialog({
  ids,
  open,
  onOpenChange,
  onResolve,
  isLoading = false,
}: BulkResolveDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [note, setNote] = React.useState("");

  // 다이얼로그가 열릴 때 메모 초기화
  React.useEffect(() => {
    if (open) {
      setNote("");
    }
  }, [open]);

  const handleResolve = async () => {
    if (ids.length === 0) return;
    await onResolve(ids, note.trim() || undefined);
  };

  const content = (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/50 p-4">
        <p className="font-medium">
          <span className="text-primary text-lg">{ids.length}</span>건의 에러를
          해결 처리합니다.
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          미해결 상태인 에러만 해결 처리됩니다.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bulk-resolution-note">해결 메모 (선택)</Label>
        <Textarea
          id="bulk-resolution-note"
          placeholder="일괄 해결 사유를 기록하세요..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          disabled={isLoading}
        />
        <p className="text-muted-foreground text-xs text-right">
          {note.length}/500
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isLoading}
      >
        취소
      </Button>
      <Button onClick={handleResolve} disabled={isLoading || ids.length === 0}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            처리 중...
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 size-4" />
            {ids.length}건 해결 처리
          </>
        )}
      </Button>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>일괄 해결 처리</DialogTitle>
            <DialogDescription>
              선택한 에러들을 한 번에 해결됨으로 표시합니다.
            </DialogDescription>
          </DialogHeader>
          {content}
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>일괄 해결 처리</SheetTitle>
          <SheetDescription>
            선택한 에러들을 한 번에 해결됨으로 표시합니다.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">{content}</div>
        <SheetFooter className="mt-6">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * 삭제 확인 다이얼로그 컴포넌트
 *
 * 에러 로그 삭제 전 확인을 요청하는 다이얼로그입니다.
 *
 * @example
 * ```tsx
 * <DeleteConfirmDialog
 *   log={selectedLog}
 *   open={showDelete}
 *   onOpenChange={setShowDelete}
 *   onConfirm={async () => {
 *     await deleteErrorLog(selectedLog!.id);
 *     setShowDelete(false);
 *   }}
 * />
 * ```
 */
export function DeleteConfirmDialog({
  log,
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: {
  log: ErrorLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const content = log && (
    <div className="rounded-lg border bg-muted/50 p-4">
      <p className="font-mono text-sm font-medium">{log.errorCode}</p>
      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
        {log.errorMessage}
      </p>
    </div>
  );

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isLoading}
      >
        취소
      </Button>
      <Button
        variant="destructive"
        onClick={onConfirm}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            삭제 중...
          </>
        ) : (
          "삭제"
        )}
      </Button>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>에러 로그 삭제</DialogTitle>
            <DialogDescription>
              이 에러 로그를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          {content}
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>에러 로그 삭제</SheetTitle>
          <SheetDescription>
            이 에러 로그를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">{content}</div>
        <SheetFooter className="mt-6">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * 일괄 삭제 확인 다이얼로그 컴포넌트
 */
export function BulkDeleteConfirmDialog({
  count,
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: {
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const content = (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p className="font-medium text-destructive">
        <span className="text-lg">{count}</span>건의 에러 로그를 삭제합니다.
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        해결된 에러 로그만 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
      </p>
    </div>
  );

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isLoading}
      >
        취소
      </Button>
      <Button
        variant="destructive"
        onClick={onConfirm}
        disabled={isLoading || count === 0}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            삭제 중...
          </>
        ) : (
          `${count}건 삭제`
        )}
      </Button>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>일괄 삭제</DialogTitle>
            <DialogDescription>
              선택한 에러 로그들을 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          {content}
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>일괄 삭제</SheetTitle>
          <SheetDescription>
            선택한 에러 로그들을 삭제하시겠습니까?
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">{content}</div>
        <SheetFooter className="mt-6">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
