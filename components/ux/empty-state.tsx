"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import {
  MapPin,
  Calendar,
  Search,
  FileText,
  Map,
  CircleAlert,
  Plus,
  RefreshCw,
} from "lucide-react";

export type EmptyStateType =
  | "trips"
  | "places"
  | "schedules"
  | "search"
  | "itinerary"
  | "error"
  | "custom";

interface EmptyStateConfig {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: ReactNode;
}

const defaultConfigs: Record<Exclude<EmptyStateType, "custom">, EmptyStateConfig> = {
  trips: {
    icon: <Map className="w-8 h-8" />,
    title: "저장된 여행이 없습니다",
    description: "새 여행을 만들어 일정을 계획해보세요",
    actionLabel: "새 여행 만들기",
    actionIcon: <Plus className="w-4 h-4" />,
  },
  places: {
    icon: <MapPin className="w-8 h-8" />,
    title: "추가된 장소가 없습니다",
    description: "방문할 장소를 검색하여 추가해보세요",
    actionLabel: "장소 검색",
    actionIcon: <Search className="w-4 h-4" />,
  },
  schedules: {
    icon: <Calendar className="w-8 h-8" />,
    title: "고정 일정이 없습니다",
    description: "식사 시간, 숙소 체크인 등 고정된 일정을 추가해보세요",
    actionLabel: "일정 추가",
    actionIcon: <Plus className="w-4 h-4" />,
  },
  search: {
    icon: <Search className="w-8 h-8" />,
    title: "검색 결과가 없습니다",
    description: "다른 키워드로 검색해보세요",
  },
  itinerary: {
    icon: <FileText className="w-8 h-8" />,
    title: "최적화된 일정이 없습니다",
    description: "장소를 추가하고 일정을 최적화해보세요",
    actionLabel: "일정 최적화",
  },
  error: {
    icon: <CircleAlert className="w-8 h-8" />,
    title: "오류가 발생했습니다",
    description: "잠시 후 다시 시도해주세요",
    actionLabel: "다시 시도",
    actionIcon: <RefreshCw className="w-4 h-4" />,
  },
};

interface EmptyStateProps {
  /** 미리 정의된 빈 상태 타입 */
  type?: EmptyStateType;
  /** 커스텀 아이콘 */
  icon?: ReactNode;
  /** 제목 */
  title?: string;
  /** 설명 */
  description?: string;
  /** 액션 버튼 라벨 */
  actionLabel?: string;
  /** 액션 버튼 아이콘 */
  actionIcon?: ReactNode;
  /** 액션 버튼 클릭 핸들러 */
  onAction?: () => void;
  /** 액션 버튼 variant */
  actionVariant?: VariantProps<typeof buttonVariants>["variant"];
  /** 추가 className */
  className?: string;
  /** 자식 요소 (추가 버튼 등) */
  children?: ReactNode;
  /** 컴팩트 모드 (패딩 감소) */
  compact?: boolean;
}

/**
 * 빈 상태 UI 컴포넌트
 * 데이터가 없을 때 사용자에게 안내하는 UI
 */
export function EmptyState({
  type = "custom",
  icon,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  actionVariant = "default",
  className,
  children,
  compact = false,
}: EmptyStateProps) {
  const config = type !== "custom" ? defaultConfigs[type] : null;

  const displayIcon = icon ?? config?.icon;
  const displayTitle = title ?? config?.title ?? "데이터가 없습니다";
  const displayDescription = description ?? config?.description;
  const displayActionLabel = actionLabel ?? config?.actionLabel;
  const displayActionIcon = actionIcon ?? config?.actionIcon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-4",
        className
      )}
    >
      {displayIcon && (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
          {displayIcon}
        </div>
      )}

      <h3 className="font-semibold text-lg mb-2">{displayTitle}</h3>

      {displayDescription && (
        <p className="text-muted-foreground text-sm max-w-[280px] mb-6">
          {displayDescription}
        </p>
      )}

      {displayActionLabel && onAction && (
        <Button onClick={onAction} variant={actionVariant}>
          {displayActionIcon}
          {displayActionLabel}
        </Button>
      )}

      {children}
    </div>
  );
}

/**
 * 간단한 인라인 빈 상태 (리스트 내부 등)
 */
export function EmptyStateInline({
  icon,
  message,
  className,
}: {
  icon?: ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 py-4 px-3 text-sm text-muted-foreground",
        className
      )}
    >
      {icon || <Search className="w-4 h-4 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}
