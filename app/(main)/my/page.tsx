"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  LuPlus,
  LuMapPin,
  LuCalendar,
  LuEllipsisVertical,
  LuTrash2,
  LuLoader,
  LuMap,
  LuChevronLeft,
} from "react-icons/lu";

import { useSafeBack } from "@/hooks/use-safe-back";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  TripCardSkeleton,
  EmptyState,
  ErrorState,
  PullToRefresh,
} from "@/components/ux";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

import { getTripList } from "@/actions/trips/get-trips";
import { deleteTrip } from "@/actions/trips/delete-trip";
import type { TripListItem, TripStatus } from "@/types";
import { calculateTripDuration } from "@/types/trip";

/**
 * 상태별 배지 스타일
 */
function getStatusBadge(status: TripStatus) {
  switch (status) {
    case "draft":
      return (
        <Badge variant="secondary" className="text-xs">
          작성 중
        </Badge>
      );
    case "optimizing":
      return (
        <Badge
          variant="secondary"
          className="text-xs bg-yellow-100 text-yellow-800"
        >
          최적화 중
        </Badge>
      );
    case "optimized":
      return (
        <Badge variant="default" className="text-xs">
          최적화 완료
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline" className="text-xs">
          완료
        </Badge>
      );
    default:
      return null;
  }
}

/**
 * 날짜 포맷 (YYYY-MM-DD → M월 D일)
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 여행 카드 컴포넌트
 */
function TripCard({
  trip,
  onDelete,
  onView,
}: {
  trip: TripListItem;
  onDelete: () => void;
  onView: () => void;
}) {
  const duration = calculateTripDuration(trip.startDate, trip.endDate);

  return (
    <Card className="py-0 overflow-hidden hover:bg-muted active:bg-muted/90">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <button
            onClick={onView}
            className="flex-1 text-left focus:outline-none touch-target no-tap-highlight"
          >
            <div className="space-y-2">
              {/* 제목 + 상태 */}
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base line-clamp-1">
                  {trip.title}
                </h3>
                {getStatusBadge(trip.status)}
              </div>

              {/* 날짜 정보 */}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <LuCalendar className="w-4 h-4 shrink-0" />
                <span>
                  {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                </span>
                <span className="text-xs">({duration.displayText})</span>
              </div>

              {/* 장소 수 */}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <LuMapPin className="w-4 h-4 shrink-0" />
                <span>장소 {trip.placeCount}곳</span>
              </div>
            </div>
          </button>

          {/* 메뉴 버튼 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 -mt-1 -mr-2 touch-target"
              >
                <LuEllipsisVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView} className="touch-target">
                <LuMap className="w-4 h-4 mr-2" />
                상세 보기
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive touch-target"
              >
                <LuTrash2 className="w-4 h-4 mr-2" />
                삭제하기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 로딩 스켈레톤 컴포넌트
 */
function LoadingSkeleton() {
  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="font-semibold text-lg">내 여행</h1>
        <Skeleton className="w-10 h-10 rounded-lg" />
      </header>

      {/* 스켈레톤 리스트 */}
      <div className="flex-1 px-4 py-4 space-y-3">
        <TripCardSkeleton />
        <TripCardSkeleton />
        <TripCardSkeleton />
      </div>
    </main>
  );
}

export default function MyTripsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const handleBack = useSafeBack("/");
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<TripListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  // 여행 목록 로드
  const loadTrips = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    const result = await getTripList({ limit: 50 });

    if (result.success && result.data) {
      setTrips(result.data);
    } else {
      setError(result.error || "여행 목록을 불러오는데 실패했습니다.");
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (isLoaded && user) {
      loadTrips();
    } else if (isLoaded && !user) {
      setIsLoading(false);
    }
  }, [user, isLoaded, loadTrips]);

  // 새로고침 핸들러 (Pull-to-refresh)
  const handleRefresh = useCallback(async () => {
    await loadTrips();
  }, [loadTrips]);

  // 삭제 확인 다이얼로그 열기
  const handleDeleteClick = (trip: TripListItem) => {
    setTripToDelete(trip);
    setDeleteDialogOpen(true);
  };

  // 삭제 실행
  const handleDeleteConfirm = () => {
    if (!tripToDelete) return;

    startTransition(async () => {
      const result = await deleteTrip(tripToDelete.id);

      if (result.success) {
        setTrips((prev) => prev.filter((t) => t.id !== tripToDelete.id));
        setDeleteDialogOpen(false);
        setTripToDelete(null);
        showSuccessToast("여행이 삭제되었습니다");
      } else {
        showErrorToast(result.error || "삭제에 실패했습니다");
      }
    });
  };

  // 로딩 중
  if (!isLoaded || isLoading) {
    return <LoadingSkeleton />;
  }

  // 미로그인 상태
  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[calc(100dvh-64px)] px-4 gap-4">
        <p className="text-muted-foreground">로그인이 필요합니다</p>
        <Link href="/sign-in">
          <Button className="touch-target">로그인하기</Button>
        </Link>
      </main>
    );
  }

  // 에러 상태
  if (error && trips.length === 0) {
    return (
      <main className="flex flex-col min-h-[calc(100dvh-64px)]">
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <h1 className="font-semibold text-lg">내 여행</h1>
        </header>
        <ErrorState type="generic" description={error} onRetry={loadTrips} />
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="touch-target"
            onClick={handleBack}
          >
            <LuChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-lg">내 여행</h1>
        </div>
        <Link href="/plan">
          <Button size="icon" variant="ghost" className="touch-target">
            <LuPlus className="w-5 h-5" />
          </Button>
        </Link>
      </header>

      {/* 여행 목록 with Pull-to-refresh */}
      <PullToRefresh onRefresh={handleRefresh} className="flex-1">
        <div className="px-4 py-4">
          {trips.length === 0 ? (
            <EmptyState type="trips" onAction={() => router.push("/plan")} />
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onView={() => router.push(`/my/trips/${trip.id}`)}
                  onDelete={() => handleDeleteClick(trip)}
                />
              ))}
            </div>
          )}
        </div>
      </PullToRefresh>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>여행 삭제</DialogTitle>
            <DialogDescription>
              &quot;{tripToDelete?.title}&quot; 여행을 삭제하시겠습니까?
              <br />
              삭제된 여행은 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isPending}
              className="touch-target"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isPending}
              className="touch-target"
            >
              {isPending ? (
                <>
                  <LuLoader className="w-4 h-4 mr-2 animate-spin" />
                  삭제 중...
                </>
              ) : (
                "삭제"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
