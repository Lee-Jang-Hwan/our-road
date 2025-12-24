"use client";

import * as React from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Info,
  MapPin,
  MessageSquare,
  User,
  XCircle,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ErrorLog, ErrorSeverity } from "@/types/admin";

// ============================================
// Types
// ============================================

interface ErrorLogDetailProps {
  /** 에러 로그 데이터 */
  log: ErrorLog | null;
  /** 열림 상태 */
  open: boolean;
  /** 닫기 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 해결 처리 핸들러 */
  onResolve?: () => void;
  /** 해결 취소 핸들러 */
  onUnresolve?: () => void;
  /** 삭제 핸들러 */
  onDelete?: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
}

// ============================================
// Helper Components
// ============================================

/**
 * 심각도 아이콘 컴포넌트
 */
function SeverityIcon({
  severity,
  className,
}: {
  severity: ErrorSeverity;
  className?: string;
}) {
  const config: Record<ErrorSeverity, { icon: React.ReactNode; color: string }> = {
    info: {
      icon: <Info className={cn("size-5", className)} />,
      color: "text-blue-500",
    },
    warning: {
      icon: <AlertTriangle className={cn("size-5", className)} />,
      color: "text-yellow-500",
    },
    error: {
      icon: <AlertCircle className={cn("size-5", className)} />,
      color: "text-red-500",
    },
    critical: {
      icon: <XCircle className={cn("size-5", className)} />,
      color: "text-purple-500",
    },
  };

  const { icon, color } = config[severity];

  return <span className={color}>{icon}</span>;
}

/**
 * 정보 행 컴포넌트
 */
function InfoRow({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="flex-1">
        <p className="text-muted-foreground text-sm">{label}</p>
        <div className="mt-0.5 font-medium">{value}</div>
      </div>
    </div>
  );
}

/**
 * 코드 블록 컴포넌트
 */
function CodeBlock({
  title,
  content,
  className,
}: {
  title: string;
  content: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("복사 실패:", err);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">{title}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleCopy}
        >
          <Copy className="size-3" />
          {copied ? "복사됨" : "복사"}
        </Button>
      </div>
      <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
        <code className="whitespace-pre-wrap break-all">{content}</code>
      </pre>
    </div>
  );
}

/**
 * 컨텍스트 표시 컴포넌트
 */
function ContextDisplay({
  context,
}: {
  context: Record<string, unknown>;
}) {
  const entries = Object.entries(context);

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">추가 컨텍스트가 없습니다.</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {key}
          </Badge>
          <span className="text-sm break-all">
            {typeof value === "object"
              ? JSON.stringify(value, null, 2)
              : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 로딩 스켈레톤
 */
function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// ============================================
// Main Content Component
// ============================================

function ErrorLogDetailContent({
  log,
  isLoading,
  onResolve,
  onUnresolve,
  onDelete,
}: Omit<ErrorLogDetailProps, "open" | "onOpenChange">) {
  if (isLoading || !log) {
    return <DetailSkeleton />;
  }

  const severityLabels: Record<ErrorSeverity, string> = {
    info: "정보",
    warning: "경고",
    error: "에러",
    critical: "치명적",
  };

  return (
    <div className="space-y-6">
      {/* 헤더 영역 */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            log.severity === "info" && "bg-blue-100 dark:bg-blue-900/30",
            log.severity === "warning" && "bg-yellow-100 dark:bg-yellow-900/30",
            log.severity === "error" && "bg-red-100 dark:bg-red-900/30",
            log.severity === "critical" && "bg-purple-100 dark:bg-purple-900/30"
          )}
        >
          <SeverityIcon severity={log.severity} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-lg font-semibold">{log.errorCode}</h3>
            <Badge
              variant={log.resolved ? "default" : "secondary"}
              className="gap-1"
            >
              {log.resolved ? (
                <>
                  <CheckCircle2 className="size-3" />
                  해결됨
                </>
              ) : (
                <>
                  <AlertCircle className="size-3" />
                  미해결
                </>
              )}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {severityLabels[log.severity]} • {log.source}
          </p>
        </div>
      </div>

      {/* 에러 메시지 */}
      <div className="rounded-lg border p-4">
        <p className="text-muted-foreground mb-1 text-sm">에러 메시지</p>
        <p className="font-medium">{log.errorMessage}</p>
      </div>

      {/* 기본 정보 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoRow
          icon={<Clock className="size-4" />}
          label="발생 시간"
          value={format(new Date(log.createdAt), "yyyy년 M월 d일 HH:mm:ss", {
            locale: ko,
          })}
        />
        <InfoRow
          icon={<MapPin className="size-4" />}
          label="발생 위치"
          value={log.source}
        />
      </div>

      {/* 해결 정보 (해결된 경우) */}
      {log.resolved && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
            <span className="font-medium text-green-700 dark:text-green-300">
              해결 정보
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {log.resolvedAt && (
              <InfoRow
                icon={<Clock className="size-4" />}
                label="해결 시간"
                value={format(
                  new Date(log.resolvedAt),
                  "yyyy년 M월 d일 HH:mm",
                  { locale: ko }
                )}
              />
            )}
            {log.resolvedBy && (
              <InfoRow
                icon={<User className="size-4" />}
                label="해결자"
                value={log.resolvedBy}
              />
            )}
          </div>
          {log.resolutionNote && (
            <div className="mt-3">
              <InfoRow
                icon={<MessageSquare className="size-4" />}
                label="해결 메모"
                value={log.resolutionNote}
              />
            </div>
          )}
        </div>
      )}

      {/* 스택 트레이스 */}
      {log.errorStack && (
        <CodeBlock title="스택 트레이스" content={log.errorStack} />
      )}

      {/* 컨텍스트 */}
      {log.context && Object.keys(log.context).length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <Code2 className="size-4" />
            추가 컨텍스트
          </p>
          <div className="rounded-lg border p-4">
            <ContextDisplay context={log.context} />
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:justify-end">
        {log.resolved ? (
          <>
            <Button variant="outline" onClick={onUnresolve}>
              해결 취소
            </Button>
            <Button variant="destructive" onClick={onDelete}>
              삭제
            </Button>
          </>
        ) : (
          <Button onClick={onResolve}>해결 처리</Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

/**
 * 에러 로그 상세 모달 컴포넌트
 *
 * 에러 로그의 상세 정보를 모달(데스크톱) 또는 시트(모바일)로 표시합니다.
 * 스택 트레이스, 컨텍스트 정보, 해결 정보 등을 확인할 수 있습니다.
 *
 * @example
 * ```tsx
 * const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);
 *
 * <ErrorLogDetail
 *   log={selectedLog}
 *   open={!!selectedLog}
 *   onOpenChange={(open) => !open && setSelectedLog(null)}
 *   onResolve={() => handleResolve(selectedLog!.id)}
 *   onDelete={() => handleDelete(selectedLog!.id)}
 * />
 * ```
 */
export function ErrorLogDetail({
  log,
  open,
  onOpenChange,
  onResolve,
  onUnresolve,
  onDelete,
  isLoading,
}: ErrorLogDetailProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const content = (
    <ErrorLogDetailContent
      log={log}
      isLoading={isLoading}
      onResolve={onResolve}
      onUnresolve={onUnresolve}
      onDelete={onDelete}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>에러 로그 상세</DialogTitle>
            <DialogDescription>
              에러 로그의 상세 정보를 확인합니다.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>에러 로그 상세</SheetTitle>
          <SheetDescription>
            에러 로그의 상세 정보를 확인합니다.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">{content}</div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * 간단한 에러 로그 상세 카드 컴포넌트
 */
export function ErrorLogDetailCard({
  log,
  className,
}: {
  log: ErrorLog;
  className?: string;
}) {
  const severityLabels: Record<ErrorSeverity, string> = {
    info: "정보",
    warning: "경고",
    error: "에러",
    critical: "치명적",
  };

  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <div className="mb-3 flex items-center gap-3">
        <SeverityIcon severity={log.severity} />
        <div>
          <p className="font-mono font-medium">{log.errorCode}</p>
          <p className="text-muted-foreground text-sm">
            {severityLabels[log.severity]} • {log.source}
          </p>
        </div>
        <Badge
          variant={log.resolved ? "default" : "secondary"}
          className="ml-auto"
        >
          {log.resolved ? "해결됨" : "미해결"}
        </Badge>
      </div>
      <p className="mb-2 text-sm">{log.errorMessage}</p>
      <p className="text-muted-foreground text-xs">
        {format(new Date(log.createdAt), "yyyy.MM.dd HH:mm", { locale: ko })}
      </p>
    </div>
  );
}

// Export helper components
export { SeverityIcon, InfoRow, CodeBlock, ContextDisplay };
