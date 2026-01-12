"use client";

import * as React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SnapPoint = "closed" | "middle" | "open";

interface DraggableBottomSheetProps {
  /** 바텀 시트 내용 */
  children: React.ReactNode;
  /** 초기 스냅 포인트 */
  initialSnapPoint?: SnapPoint;
  /** 스냅 포인트 변경 핸들러 */
  onSnapPointChange?: (snapPoint: SnapPoint) => void;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 바텀 시트 컴포넌트
 * - 3단계 스냅 포인트 (닫힘/중간/열림)
 * - 클릭으로 토글
 * - 화살표 아이콘으로 상태 표시
 */
export function DraggableBottomSheet({
  children,
  initialSnapPoint = "middle",
  onSnapPointChange,
  className,
}: DraggableBottomSheetProps) {
  const [snapPoint, setSnapPoint] = React.useState<SnapPoint>(initialSnapPoint);
  const [prevSnapPoint, setPrevSnapPoint] = React.useState<SnapPoint | null>(
    null,
  );
  const [currentHeight, setCurrentHeight] = React.useState(0);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  const contentRef = React.useRef<HTMLDivElement>(null);

  // 스냅 포인트 높이 계산
  const getSnapHeight = React.useCallback((point: SnapPoint): number => {
    if (typeof window === "undefined") return 0;

    const viewportHeight = window.innerHeight;

    switch (point) {
      case "closed":
        return viewportHeight * 0.05; // 최소 높이 (닫힘)
      case "middle":
        return viewportHeight * 0.35; // 중간 높이
      case "open":
        return viewportHeight * 0.7; // 최대 높이 (열림)
      default:
        return viewportHeight * 0.05;
    }
  }, []);

  // 현재 높이를 스냅 포인트로 설정
  const setHeightToSnapPoint = React.useCallback(
    (point: SnapPoint, animate = true) => {
      const targetHeight = getSnapHeight(point);
      setPrevSnapPoint(snapPoint); // 이전 상태 저장
      setSnapPoint(point);
      setCurrentHeight(targetHeight);
      setIsTransitioning(animate);
      onSnapPointChange?.(point);
    },
    [getSnapHeight, onSnapPointChange, snapPoint],
  );

  // 초기 높이 설정
  React.useEffect(() => {
    const height = getSnapHeight(initialSnapPoint);
    setCurrentHeight(height);
    setSnapPoint(initialSnapPoint);
  }, [initialSnapPoint, getSnapHeight]);

  // 클릭 핸들러: 스냅 포인트 토글
  // 순환 구조: middle(처음) → closed → middle → open → middle → ...
  const handleToggle = React.useCallback(() => {
    let nextSnapPoint: SnapPoint;

    if (snapPoint === "closed") {
      nextSnapPoint = "middle";
    } else if (snapPoint === "middle") {
      // 이전이 closed였다면 open으로, 그 외(초기 또는 open에서 온 경우)에는 closed로
      nextSnapPoint = prevSnapPoint === "closed" ? "open" : "closed";
    } else {
      // snapPoint === "open"
      nextSnapPoint = "middle";
    }

    setHeightToSnapPoint(nextSnapPoint, true);
  }, [snapPoint, prevSnapPoint, setHeightToSnapPoint]);

  // 애니메이션 종료 후 transition 플래그 해제
  React.useEffect(() => {
    if (!isTransitioning) return;

    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 300); // transition duration과 맞춤

    return () => clearTimeout(timer);
  }, [isTransitioning]);

  // 화살표 아이콘 결정
  // closed → 위 화살표, open → 아래 화살표
  // middle → 이전이 closed면 위 화살표(open으로), 그 외(초기 또는 open)면 아래 화살표(closed로)
  const ArrowIcon =
    snapPoint === "open" || (snapPoint === "middle" && prevSnapPoint !== "closed")
      ? ChevronDown
      : ChevronUp;

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 z-20 bg-background rounded-t-xl shadow-lg",
        "flex flex-col",
        className,
      )}
      style={{
        height: `${currentHeight}px`,
        transition: isTransitioning ? "height 0.3s ease-out" : "none",
      }}
    >
      {/* 토글 핸들 (화살표 아이콘) - sticky로 항상 상단에 고정 */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "sticky top-0 z-30 flex items-center justify-center py-2 touch-target",
          "select-none", // 텍스트 선택 방지
          "hover:bg-muted/50 active:bg-muted/70", // 클릭 피드백
          "transition-colors duration-150", // 부드러운 색상 전환
          "bg-background", // 배경색 명시 (sticky 시 필요)
          "border-b border-border/50", // 하단 경계선으로 구분
          "shadow-sm", // 그림자로 시각적 구분
          "cursor-pointer", // 포인터 커서
        )}
        style={{
          minHeight: "44px", // 터치 타겟 최소 크기
        }}
        aria-label={
          snapPoint === "closed"
            ? "일정 펼치기"
            : snapPoint === "middle"
              ? "일정 더 보기"
              : "일정 접기"
        }
      >
        <ArrowIcon
          className={cn(
            "w-5 h-5 text-muted-foreground transition-transform duration-300",
          )}
        />
      </button>

      {/* 내용 영역 */}
      <div ref={contentRef} className="flex-1 overflow-auto min-h-0">
        {children}
      </div>
    </div>
  );
}
