"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CircleAlert,
  TriangleAlert,
  WifiOff,
  ServerOff,
  RefreshCw,
  ChevronLeft,
  House,
  Bug,
} from "lucide-react";

export type ErrorType =
  | "generic"
  | "network"
  | "server"
  | "notFound"
  | "permission"
  | "validation"
  | "custom";

interface ErrorConfig {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
}

const errorConfigs: Record<Exclude<ErrorType, "custom">, ErrorConfig> = {
  generic: {
    icon: <CircleAlert className="w-8 h-8" />,
    title: "오류가 발생했습니다",
    description: "잠시 후 다시 시도해주세요",
    actionLabel: "다시 시도",
  },
  network: {
    icon: <WifiOff className="w-8 h-8" />,
    title: "네트워크 연결 오류",
    description: "인터넷 연결을 확인하고 다시 시도해주세요",
    actionLabel: "다시 시도",
  },
  server: {
    icon: <ServerOff className="w-8 h-8" />,
    title: "서버 오류",
    description: "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요",
    actionLabel: "다시 시도",
  },
  notFound: {
    icon: <TriangleAlert className="w-8 h-8" />,
    title: "페이지를 찾을 수 없습니다",
    description: "요청하신 페이지가 존재하지 않거나 삭제되었습니다",
    actionLabel: "홈으로 이동",
  },
  permission: {
    icon: <CircleAlert className="w-8 h-8" />,
    title: "접근 권한이 없습니다",
    description: "이 페이지에 접근할 권한이 없습니다",
    actionLabel: "돌아가기",
  },
  validation: {
    icon: <Bug className="w-8 h-8" />,
    title: "입력값이 올바르지 않습니다",
    description: "입력한 내용을 확인하고 다시 시도해주세요",
  },
};

interface ErrorStateProps {
  /** 미리 정의된 에러 타입 */
  type?: ErrorType;
  /** 커스텀 아이콘 */
  icon?: ReactNode;
  /** 에러 제목 */
  title?: string;
  /** 에러 설명 */
  description?: string;
  /** 상세 에러 메시지 (개발자용, 숨겨진 상태로 표시) */
  errorDetail?: string;
  /** 액션 버튼 라벨 */
  actionLabel?: string;
  /** 액션 버튼 클릭 핸들러 */
  onAction?: () => void;
  /** 뒤로가기 핸들러 */
  onBack?: () => void;
  /** 홈으로 이동 핸들러 */
  onHome?: () => void;
  /** 재시도 핸들러 */
  onRetry?: () => void;
  /** 추가 className */
  className?: string;
  /** 풀스크린 모드 */
  fullScreen?: boolean;
}

/**
 * 에러 상태 UI 컴포넌트 (풀페이지)
 * 페이지 로드 실패 등 전체 화면에 에러를 표시
 */
export function ErrorState({
  type = "generic",
  icon,
  title,
  description,
  errorDetail,
  actionLabel,
  onAction,
  onBack,
  onHome,
  onRetry,
  className,
  fullScreen = false,
}: ErrorStateProps) {
  const config = type !== "custom" ? errorConfigs[type] : null;

  const displayIcon = icon ?? config?.icon;
  const displayTitle = title ?? config?.title ?? "오류가 발생했습니다";
  const displayDescription = description ?? config?.description;
  const displayActionLabel = actionLabel ?? config?.actionLabel;

  // 메인 액션 결정
  const handleMainAction = () => {
    if (onAction) {
      onAction();
    } else if (onRetry) {
      onRetry();
    } else if (type === "notFound" && onHome) {
      onHome();
    } else if (type === "permission" && onBack) {
      onBack();
    }
  };

  const showMainAction = onAction || onRetry || (type === "notFound" && onHome) || (type === "permission" && onBack);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-4",
        fullScreen ? "min-h-[100dvh]" : "py-16",
        className
      )}
    >
      {displayIcon && (
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6 text-destructive">
          {displayIcon}
        </div>
      )}

      <h2 className="font-bold text-xl mb-3">{displayTitle}</h2>

      {displayDescription && (
        <p className="text-muted-foreground text-sm max-w-[300px] mb-6">
          {displayDescription}
        </p>
      )}

      {/* 에러 상세 (개발 모드 표시) */}
      {errorDetail && process.env.NODE_ENV === "development" && (
        <details className="mb-6 w-full max-w-[300px] text-left">
          <summary className="text-xs text-muted-foreground cursor-pointer">
            에러 상세 보기
          </summary>
          <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto">
            {errorDetail}
          </pre>
        </details>
      )}

      <div className="flex flex-col gap-3 w-full max-w-[200px]">
        {showMainAction && displayActionLabel && (
          <Button onClick={handleMainAction} className="w-full touch-target">
            {(onRetry || type === "generic" || type === "network" || type === "server") && (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {type === "notFound" && <House className="w-4 h-4 mr-2" />}
            {type === "permission" && <ChevronLeft className="w-4 h-4 mr-2" />}
            {displayActionLabel}
          </Button>
        )}

        {/* 보조 액션 버튼들 */}
        {onBack && type !== "permission" && (
          <Button variant="outline" onClick={onBack} className="w-full touch-target">
            <LuChevronLeft className="w-4 h-4 mr-2" />
            돌아가기
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * 인라인 에러 알림 컴포넌트
 * 폼 하단이나 카드 내부에 표시하는 에러 메시지
 */
export function ErrorAlert({
  title,
  description,
  onRetry,
  onDismiss,
  className,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={cn("relative", className)}>
      <LuAlertCircle className="h-4 w-4" />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="flex items-start justify-between gap-2">
        <span>{description}</span>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="shrink-0 -mr-2 -my-1"
          >
            <LuRefreshCw className="w-3 h-3 mr-1" />
            재시도
          </Button>
        )}
      </AlertDescription>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-destructive hover:opacity-70"
          aria-label="닫기"
        >
          ×
        </button>
      )}
    </Alert>
  );
}

/**
 * 간단한 인라인 에러 메시지
 */
export function ErrorMessage({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-destructive py-2",
        className
      )}
    >
      <LuAlertCircle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/**
 * 에러 바운더리 폴백 컴포넌트
 */
export function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <ErrorState
      type="generic"
      title="예기치 않은 오류가 발생했습니다"
      description="페이지를 새로고침하거나 잠시 후 다시 시도해주세요"
      errorDetail={error.message}
      onRetry={resetErrorBoundary}
      actionLabel="다시 시도"
      fullScreen
    />
  );
}
