"use client";

import * as React from "react";
import {
  Share2,
  Link2,
  Image as ImageIcon,
  Download,
  Check,
  Copy,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ItineraryExportProps {
  /** 여행 ID */
  tripId: string;
  /** 여행 제목 */
  tripTitle: string;
  /** 공유 URL (옵션) */
  shareUrl?: string;
  /** 이미지 생성 핸들러 (옵션) */
  onGenerateImage?: () => Promise<string | null>;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 내보내기 컴포넌트
 * - 링크 복사
 * - 이미지 내보내기
 */
export function ItineraryExport({
  tripId,
  tripTitle,
  shareUrl,
  onGenerateImage,
  className,
}: ItineraryExportProps) {
  const [isCopied, setIsCopied] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // 현재 URL 또는 공유 URL 생성
  const getShareUrl = React.useCallback(() => {
    if (shareUrl) return shareUrl;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/trip/${tripId}`;
    }
    return "";
  }, [tripId, shareUrl]);

  // 링크 복사
  const handleCopyLink = React.useCallback(async () => {
    try {
      const url = getShareUrl();
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      toast.success("링크가 복사되었습니다");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("링크 복사에 실패했습니다");
    }
  }, [getShareUrl]);

  // 이미지 생성 및 다운로드
  const handleGenerateImage = React.useCallback(async () => {
    if (!onGenerateImage) {
      toast.error("이미지 생성을 지원하지 않습니다");
      return;
    }

    try {
      setIsGenerating(true);
      const imageUrl = await onGenerateImage();

      if (imageUrl) {
        // 이미지 다운로드
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `${tripTitle || "itinerary"}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("이미지가 다운로드되었습니다");
      }
    } catch {
      toast.error("이미지 생성에 실패했습니다");
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerateImage, tripTitle]);

  // Web Share API 지원 여부
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  // 네이티브 공유
  const handleNativeShare = React.useCallback(async () => {
    if (!canShare) return;

    try {
      await navigator.share({
        title: tripTitle || "여행 일정",
        text: `${tripTitle || "여행 일정"}을 확인해보세요!`,
        url: getShareUrl(),
      });
    } catch (error) {
      // 사용자가 취소한 경우 무시
      if ((error as Error).name !== "AbortError") {
        toast.error("공유에 실패했습니다");
      }
    }
  }, [canShare, tripTitle, getShareUrl]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <Share2 className="h-4 w-4" />
          <span>공유</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* 네이티브 공유 (모바일) */}
        {canShare && (
          <>
            <DropdownMenuItem onClick={handleNativeShare}>
              <Share2 className="h-4 w-4 mr-2" />
              공유하기
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* 링크 복사 */}
        <DropdownMenuItem onClick={handleCopyLink}>
          {isCopied ? (
            <Check className="h-4 w-4 mr-2 text-green-500" />
          ) : (
            <Link2 className="h-4 w-4 mr-2" />
          )}
          링크 복사
        </DropdownMenuItem>

        {/* 이미지 내보내기 */}
        {onGenerateImage && (
          <DropdownMenuItem
            onClick={handleGenerateImage}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4 mr-2" />
            )}
            이미지로 저장
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ExportButtonProps {
  /** 내보내기 타입 */
  type: "link" | "image";
  /** 클릭 핸들러 */
  onClick: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 완료 상태 */
  isDone?: boolean;
  /** 비활성화 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 단일 내보내기 버튼
 */
export function ExportButton({
  type,
  onClick,
  isLoading = false,
  isDone = false,
  disabled = false,
  className,
}: ExportButtonProps) {
  const config = {
    link: {
      icon: isDone ? Check : Copy,
      label: isDone ? "복사됨" : "링크 복사",
    },
    image: {
      icon: isLoading ? Loader2 : Download,
      label: isLoading ? "생성 중..." : "이미지 저장",
    },
  };

  const { icon: Icon, label } = config[type];

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn("gap-2", className)}
    >
      <Icon className={cn("h-4 w-4", isLoading && "animate-spin")} />
      <span>{label}</span>
    </Button>
  );
}

interface ShareDialogProps {
  /** 여행 제목 */
  tripTitle: string;
  /** 공유 URL */
  shareUrl: string;
  /** 트리거 버튼 (옵션) */
  trigger?: React.ReactNode;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 공유 다이얼로그
 */
export function ShareDialog({
  tripTitle,
  shareUrl,
  trigger,
  className,
}: ShareDialogProps) {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      toast.success("링크가 복사되었습니다");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("링크 복사에 실패했습니다");
    }
  }, [shareUrl]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className={cn("gap-2", className)}>
            <Share2 className="h-4 w-4" />
            공유
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>일정 공유하기</DialogTitle>
          <DialogDescription>
            아래 링크를 복사하여 {tripTitle}을(를) 공유하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 mt-4">
          <div className="flex-1 rounded-md border bg-muted px-3 py-2">
            <p className="text-sm truncate">{shareUrl}</p>
          </div>
          <Button onClick={handleCopy} size="sm" className="shrink-0">
            {isCopied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ExportActionsProps {
  /** 여행 ID */
  tripId: string;
  /** 여행 제목 */
  tripTitle: string;
  /** 공유 URL (옵션) */
  shareUrl?: string;
  /** 이미지 생성 핸들러 (옵션) */
  onGenerateImage?: () => Promise<string | null>;
  /** 레이아웃 방향 */
  direction?: "row" | "column";
  /** 추가 클래스 */
  className?: string;
}

/**
 * 내보내기 액션 버튼 그룹
 */
export function ExportActions({
  tripId,
  tripTitle,
  shareUrl,
  onGenerateImage,
  direction = "row",
  className,
}: ExportActionsProps) {
  const [isCopied, setIsCopied] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const getShareUrl = React.useCallback(() => {
    if (shareUrl) return shareUrl;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/trip/${tripId}`;
    }
    return "";
  }, [tripId, shareUrl]);

  const handleCopyLink = React.useCallback(async () => {
    try {
      const url = getShareUrl();
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      toast.success("링크가 복사되었습니다");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("링크 복사에 실패했습니다");
    }
  }, [getShareUrl]);

  const handleGenerateImage = React.useCallback(async () => {
    if (!onGenerateImage) return;

    try {
      setIsGenerating(true);
      const imageUrl = await onGenerateImage();

      if (imageUrl) {
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `${tripTitle || "itinerary"}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("이미지가 다운로드되었습니다");
      }
    } catch {
      toast.error("이미지 생성에 실패했습니다");
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerateImage, tripTitle]);

  return (
    <div
      className={cn(
        "flex gap-2",
        direction === "column" ? "flex-col" : "flex-row",
        className
      )}
    >
      <ExportButton
        type="link"
        onClick={handleCopyLink}
        isDone={isCopied}
      />
      {onGenerateImage && (
        <ExportButton
          type="image"
          onClick={handleGenerateImage}
          isLoading={isGenerating}
        />
      )}
    </div>
  );
}
