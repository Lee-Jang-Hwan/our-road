"use client";

import { useState, useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  LuChevronLeft,
  LuChevronRight,
  LuChevronsLeftRight,
  LuArrowLeft,
  LuArrowRight,
  LuHand,
} from "react-icons/lu";

interface SwipeHintProps {
  /** 힌트 방향 */
  direction?: "left" | "right" | "both" | "horizontal";
  /** 힌트 텍스트 */
  text?: string;
  /** 표시 여부 */
  visible?: boolean;
  /** 자동 숨김 지연 시간 (ms), 0이면 자동 숨김 안함 */
  autoHideDelay?: number;
  /** 닫기 핸들러 */
  onDismiss?: () => void;
  /** 추가 className */
  className?: string;
  /** 스타일 변형 */
  variant?: "overlay" | "inline" | "floating";
}

/**
 * 스와이프 제스처 힌트 UI
 * 사용자에게 스와이프 가능함을 알려주는 시각적 힌트
 */
export function SwipeHint({
  direction = "horizontal",
  text,
  visible = true,
  autoHideDelay = 3000,
  onDismiss,
  className,
  variant = "overlay",
}: SwipeHintProps) {
  const [isVisible, setIsVisible] = useState(visible);

  // 자동 숨김
  useEffect(() => {
    setIsVisible(visible);

    if (visible && autoHideDelay > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [visible, autoHideDelay, onDismiss]);

  if (!isVisible) return null;

  const defaultTexts: Record<string, string> = {
    left: "왼쪽으로 스와이프",
    right: "오른쪽으로 스와이프",
    both: "좌우로 스와이프하세요",
    horizontal: "좌우로 스와이프하세요",
  };

  const displayText = text ?? defaultTexts[direction];

  const renderIcon = () => {
    switch (direction) {
      case "left":
        return <LuChevronLeft className="w-5 h-5" />;
      case "right":
        return <LuChevronRight className="w-5 h-5" />;
      default:
        return <LuChevronsLeftRight className="w-5 h-5" />;
    }
  };

  const baseClasses = "flex items-center gap-2 text-sm";

  if (variant === "overlay") {
    return (
      <div
        className={cn(
          "fixed inset-0 bg-black/50 flex items-center justify-center z-50",
          "animate-in fade-in duration-300",
          className
        )}
        onClick={() => {
          setIsVisible(false);
          onDismiss?.();
        }}
      >
        <div className="flex flex-col items-center gap-4 text-white">
          <div className="relative">
            {/* 손 아이콘 애니메이션 */}
            <div className="animate-swipe-hint">
              <LuHand className="w-12 h-12" />
            </div>
          </div>
          <p className="text-center font-medium">{displayText}</p>
          <p className="text-xs text-white/70">화면을 탭하여 닫기</p>
        </div>
      </div>
    );
  }

  if (variant === "floating") {
    return (
      <div
        className={cn(
          "absolute bottom-4 left-1/2 -translate-x-1/2",
          "bg-black/70 text-white px-4 py-2 rounded-full",
          "animate-in fade-in slide-in-from-bottom-2 duration-300",
          baseClasses,
          className
        )}
      >
        {renderIcon()}
        <span>{displayText}</span>
      </div>
    );
  }

  // inline variant
  return (
    <div
      className={cn(
        "py-3 px-4 bg-muted/50 rounded-lg text-muted-foreground",
        baseClasses,
        className
      )}
    >
      {renderIcon()}
      <span>{displayText}</span>
    </div>
  );
}

/**
 * 스와이프 인디케이터 (슬라이드 위치 표시)
 */
export function SwipeIndicator({
  total,
  current,
  className,
}: {
  total: number;
  current: number;
  className?: string;
}) {
  if (total <= 1) return null;

  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-200",
            index === current
              ? "w-4 bg-primary"
              : "bg-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

/**
 * 스와이프 네비게이션 화살표
 */
export function SwipeNavArrows({
  onPrevious,
  onNext,
  hasPrevious = true,
  hasNext = true,
  className,
}: {
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between pointer-events-none",
        className
      )}
    >
      <button
        onClick={onPrevious}
        disabled={!hasPrevious}
        className={cn(
          "p-2 rounded-full bg-background/80 backdrop-blur-sm shadow-md",
          "pointer-events-auto touch-target",
          "transition-opacity duration-200",
          !hasPrevious && "opacity-30"
        )}
        aria-label="이전"
      >
        <LuArrowLeft className="w-5 h-5" />
      </button>

      <button
        onClick={onNext}
        disabled={!hasNext}
        className={cn(
          "p-2 rounded-full bg-background/80 backdrop-blur-sm shadow-md",
          "pointer-events-auto touch-target",
          "transition-opacity duration-200",
          !hasNext && "opacity-30"
        )}
        aria-label="다음"
      >
        <LuArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

/**
 * 스와이프 가능한 컨테이너 데코레이터
 * 좌우 가장자리에 그라데이션 오버레이로 스와이프 가능함을 암시
 */
export function SwipeableContainer({
  children,
  showLeftGradient = false,
  showRightGradient = true,
  className,
}: {
  children: ReactNode;
  showLeftGradient?: boolean;
  showRightGradient?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {/* 왼쪽 그라데이션 */}
      {showLeftGradient && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
      )}

      {/* 오른쪽 그라데이션 */}
      {showRightGradient && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
      )}

      {children}
    </div>
  );
}

/**
 * 스와이프 삭제 힌트 (리스트 아이템용)
 */
export function SwipeDeleteHint({
  visible = true,
  className,
}: {
  visible?: boolean;
  className?: string;
}) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-2 px-3 bg-destructive/10 text-destructive rounded-lg text-sm",
        "animate-in fade-in duration-300",
        className
      )}
    >
      <LuChevronLeft className="w-4 h-4 animate-pulse" />
      <span>왼쪽으로 밀어서 삭제</span>
    </div>
  );
}
