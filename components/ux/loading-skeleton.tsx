"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * 페이지 헤더 스켈레톤
 */
export function PageHeaderSkeleton({
  hasBackButton = true,
  hasAction = false,
  className,
}: {
  hasBackButton?: boolean;
  hasAction?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b",
        className
      )}
    >
      {hasBackButton && <Skeleton className="w-10 h-10 rounded-lg shrink-0" />}
      <Skeleton className="h-6 w-32" />
      {hasAction && <Skeleton className="w-10 h-10 rounded-lg shrink-0 ml-auto" />}
    </header>
  );
}

/**
 * 여행 카드 스켈레톤
 */
export function TripCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("py-0", className)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 장소 카드 스켈레톤
 */
export function PlaceCardSkeleton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 py-2", className)}>
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("py-0", className)}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
          </div>
          <Skeleton className="w-8 h-8 rounded shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 일정 타임라인 스켈레톤
 */
export function ScheduleTimelineSkeleton({
  itemCount = 3,
  className,
}: {
  itemCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index} className="flex gap-3">
          {/* 시간 영역 */}
          <div className="w-14 shrink-0">
            <Skeleton className="h-4 w-full" />
          </div>

          {/* 타임라인 라인 */}
          <div className="flex flex-col items-center">
            <Skeleton className="w-4 h-4 rounded-full" />
            {index < itemCount - 1 && (
              <Skeleton className="w-0.5 flex-1 my-1" />
            )}
          </div>

          {/* 내용 영역 */}
          <div className="flex-1 pb-4">
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2 mb-3" />
            {index < itemCount - 1 && (
              <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 검색 결과 리스트 스켈레톤
 */
export function SearchResultsSkeleton({
  itemCount = 5,
  className,
}: {
  itemCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-3">
          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 폼 스켈레톤
 */
export function FormSkeleton({
  fieldCount = 4,
  className,
}: {
  fieldCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: fieldCount }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <Skeleton className="h-10 w-full rounded-md mt-4" />
    </div>
  );
}

/**
 * 지도 스켈레톤
 */
export function MapSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-full h-full min-h-[200px] bg-muted rounded-lg overflow-hidden",
        className
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      {/* 그리드 오버레이 */}
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-px opacity-20">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="bg-border" />
        ))}
      </div>
    </div>
  );
}

/**
 * 일자별 탭 스켈레톤
 */
export function DayTabsSkeleton({
  dayCount = 3,
  className,
}: {
  dayCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 px-4 py-3 border-b overflow-x-auto", className)}>
      {Array.from({ length: dayCount }).map((_, index) => (
        <Skeleton
          key={index}
          className="w-16 h-14 rounded-lg shrink-0"
        />
      ))}
    </div>
  );
}

/**
 * 통계 카드 스켈레톤
 */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("py-0", className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 전체 페이지 로딩 스켈레톤
 */
export function PageLoadingSkeleton({
  hasHeader = true,
  headerProps,
  className,
}: {
  hasHeader?: boolean;
  headerProps?: Parameters<typeof PageHeaderSkeleton>[0];
  className?: string;
}) {
  return (
    <main className={cn("flex flex-col min-h-[calc(100dvh-64px)]", className)}>
      {hasHeader && <PageHeaderSkeleton {...headerProps} />}
      <div className="flex-1 px-4 py-4 space-y-4">
        <TripCardSkeleton />
        <TripCardSkeleton />
        <TripCardSkeleton />
      </div>
    </main>
  );
}

/**
 * 리스트 로딩 스켈레톤
 */
export function ListLoadingSkeleton({
  itemCount = 5,
  ItemSkeleton = PlaceCardSkeleton,
  className,
}: {
  itemCount?: number;
  ItemSkeleton?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <ItemSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * 인라인 로딩 인디케이터
 */
export function LoadingSpinner({
  size = "default",
  className,
}: {
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "w-4 h-4 border",
    default: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-2",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-primary border-t-transparent",
        sizeClasses[size],
        className
      )}
    />
  );
}

/**
 * 전체 화면 로딩 오버레이
 */
export function LoadingOverlay({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}
