"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { LuArrowDown, LuLoader2 } from "react-icons/lu";

interface PullToRefreshProps {
  /** 새로고침 핸들러 (비동기 함수) */
  onRefresh: () => Promise<void>;
  /** 자식 요소 */
  children: ReactNode;
  /** 새로고침 활성화 여부 */
  disabled?: boolean;
  /** 당기기 임계값 (px) */
  threshold?: number;
  /** 최대 당기기 거리 (px) */
  maxPull?: number;
  /** 당기는 중 표시할 텍스트 */
  pullText?: string;
  /** 놓으면 새로고침 표시할 텍스트 */
  releaseText?: string;
  /** 새로고침 중 표시할 텍스트 */
  refreshingText?: string;
  /** 추가 className */
  className?: string;
}

type RefreshState = "idle" | "pulling" | "ready" | "refreshing";

/**
 * 풀다운 새로고침 컴포넌트
 * 모바일에서 아래로 당겨서 새로고침하는 기능
 */
export function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
  threshold = 80,
  maxPull = 120,
  pullText = "아래로 당겨서 새로고침",
  releaseText = "놓으면 새로고침",
  refreshingText = "새로고침 중...",
  className,
}: PullToRefreshProps) {
  const [state, setState] = useState<RefreshState>("idle");
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const isScrolledToTopRef = useRef<boolean>(true);

  // 스크롤이 최상단인지 확인
  const checkScrollTop = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    // 스크롤 가능한 부모 요소 찾기
    let element: HTMLElement | null = container;
    while (element) {
      if (element.scrollTop > 0) {
        isScrolledToTopRef.current = false;
        return false;
      }
      element = element.parentElement;
    }
    isScrolledToTopRef.current = true;
    return true;
  }, []);

  // 터치 시작
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || state === "refreshing") return;

      checkScrollTop();
      if (!isScrolledToTopRef.current) return;

      startYRef.current = e.touches[0].clientY;
      currentYRef.current = e.touches[0].clientY;
    },
    [disabled, state, checkScrollTop]
  );

  // 터치 이동
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || state === "refreshing") return;
      if (!isScrolledToTopRef.current) return;

      currentYRef.current = e.touches[0].clientY;
      const distance = currentYRef.current - startYRef.current;

      // 아래로 당기는 경우만 처리
      if (distance > 0) {
        // 저항 효과 적용 (당길수록 저항이 커짐)
        const resistedDistance = Math.min(
          distance * 0.5,
          maxPull
        );
        setPullDistance(resistedDistance);

        if (resistedDistance >= threshold) {
          setState("ready");
        } else if (resistedDistance > 0) {
          setState("pulling");
        }

        // 스크롤 방지
        if (distance > 10) {
          e.preventDefault();
        }
      }
    },
    [disabled, state, threshold, maxPull]
  );

  // 터치 종료
  const handleTouchEnd = useCallback(async () => {
    if (disabled || state === "refreshing") return;

    if (state === "ready") {
      setState("refreshing");
      setPullDistance(threshold * 0.5); // 새로고침 중에는 고정 위치

      try {
        await onRefresh();
      } finally {
        setState("idle");
        setPullDistance(0);
      }
    } else {
      setState("idle");
      setPullDistance(0);
    }

    startYRef.current = 0;
    currentYRef.current = 0;
  }, [disabled, state, threshold, onRefresh]);

  // 풀 진행률 (0~1)
  const pullProgress = Math.min(pullDistance / threshold, 1);

  // 아이콘 회전 각도
  const iconRotation = pullProgress * 180;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 풀투리프레시 인디케이터 */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center transition-transform duration-200",
          state === "idle" && pullDistance === 0 && "-translate-y-full",
          "z-10"
        )}
        style={{
          height: `${Math.max(pullDistance, 0)}px`,
          top: 0,
        }}
      >
        <div className="flex flex-col items-center gap-1.5">
          {state === "refreshing" ? (
            <LuLoader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <LuArrowDown
              className={cn(
                "w-5 h-5 transition-transform duration-200",
                state === "ready" && "text-primary"
              )}
              style={{
                transform: `rotate(${iconRotation}deg)`,
              }}
            />
          )}
          <span className="text-xs text-muted-foreground">
            {state === "refreshing"
              ? refreshingText
              : state === "ready"
              ? releaseText
              : pullText}
          </span>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: `translateY(${pullDistance}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * usePullToRefresh 훅 - 커스텀 구현용
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}) {
  const [state, setState] = useState<RefreshState>("idle");
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef<number>(0);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || state === "refreshing") return;
      if (window.scrollY !== 0) return;
      startYRef.current = e.touches[0].clientY;
    },
    [disabled, state]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || state === "refreshing") return;
      if (window.scrollY !== 0) return;

      const distance = e.touches[0].clientY - startYRef.current;
      if (distance > 0) {
        const resistedDistance = distance * 0.5;
        setPullDistance(resistedDistance);
        setState(resistedDistance >= threshold ? "ready" : "pulling");
      }
    },
    [disabled, state, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (state === "ready") {
      setState("refreshing");
      try {
        await onRefresh();
      } finally {
        setState("idle");
        setPullDistance(0);
      }
    } else {
      setState("idle");
      setPullDistance(0);
    }
    startYRef.current = 0;
  }, [state, onRefresh]);

  useEffect(() => {
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    state,
    pullDistance,
    isRefreshing: state === "refreshing",
    isPulling: state === "pulling" || state === "ready",
    isReady: state === "ready",
  };
}
