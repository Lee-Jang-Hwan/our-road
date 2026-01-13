"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  LuMapPin,
  LuCalendar,
  LuEllipsisVertical,
  LuTrash2,
  LuLoader,
  LuMap,
} from "react-icons/lu";
import { Car, Footprints, Map, Plane, Route, TrainFront } from "lucide-react";

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
import type { TripListItem, TripStatus, TransportMode } from "@/types";
import { calculateTripDuration } from "@/types/trip";

/**
 * 상태별 배지 스타일 (세분화된 작성 중 상태)
 */
function getStatusBadge(status: TripStatus, placeCount: number) {
  switch (status) {
    case "draft": {
      // 작성 중 세분화
      if (placeCount === 0) {
        return (
          <Badge className="text-xs bg-gray-100 text-gray-600 border-gray-300">
            기본 정보만 입력
          </Badge>
        );
      } else if (placeCount <= 2) {
        return (
          <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-300">
            장소 {placeCount}개 추가됨
          </Badge>
        );
      } else {
        return (
          <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-300">
            최적화 준비 완료 ({placeCount}개)
          </Badge>
        );
      }
    }

    case "optimizing":
      return (
        <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
          최적화 중
        </Badge>
      );

    case "optimized":
      return (
        <Badge className="text-xs text-[rgb(49,130,247)] border-[rgba(49,130,247,0.3)] bg-[rgba(49,130,247,0.12)]">
          최적화 완료
        </Badge>
      );

    case "completed":
      return (
        <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-300">
          여행 완료
        </Badge>
      );

    default:
      return null;
  }
}

/**
 * 날짜 포맷 (YYYY-MM-DD -> M/D)
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return "방금 전";
  }

  if (diffMins < 60) {
    return `${diffMins}분 전`;
  }

  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return `${diffHours}시간 전`;
  }

  if (
    diffDays === 1 ||
    (diffHours < 48 && date.getDate() === now.getDate() - 1)
  ) {
    const hours = date.getHours().toString().padStart(2, "0");
    const mins = date.getMinutes().toString().padStart(2, "0");
    return `어제 ${hours}:${mins}`;
  }

  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");

  if (date.getFullYear() === now.getFullYear()) {
    return `${month}월 ${day}일 ${hours}:${mins}`;
  }

  return `${date.getFullYear()}.${month}.${day}`;
}
function TransportIcon({ modes }: { modes: TransportMode[] }) {
  if (modes.length === 1) {
    if (modes.includes("walking")) return <Footprints className="h-4 w-4" />;
    if (modes.includes("public")) return <TrainFront className="h-4 w-4" />;
    if (modes.includes("car")) return <Car className="h-4 w-4" />;
  }
  return <Route className="h-4 w-4" />;
}

/**
 * 이동수단 텍스트
 */
function getTransportModeText(modes: TransportMode[]): string {
  const labels: string[] = [];
  if (modes.includes("walking")) labels.push("도보");
  if (modes.includes("public")) labels.push("대중교통");
  if (modes.includes("car")) labels.push("자동차");
  return labels.join(" + ");
}
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
        <div className="space-y-2">
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
                  {getStatusBadge(trip.status, trip.placeCount)}
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
                  <span>장소 {trip.placeCount}개</span>
                </div>

                {/* 이동수단 */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TransportIcon modes={trip.transportModes} />
                  <span>{getTransportModeText(trip.transportModes)}</span>
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

          {/* 마지막 수정 시간 - 카드 맨 아래 오른쪽 */}
          <div className="text-right pr-1">
            <span className="text-xs text-muted-foreground/70">
              {formatRelativeTime(trip.updatedAt)}
            </span>
          </div>
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
      <header className="flex items-center justify-between px-4 py-1 border-b">
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
        showSuccessToast("여행이 삭제되었습니다.");
      } else {
        showErrorToast(result.error || "삭제에 실패했습니다.");
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
        <p className="text-muted-foreground">Please sign in.</p>
        <Link href="/sign-in">
          <Button className="touch-target">Sign in</Button>
        </Link>
      </main>
    );
  }

  // 에러 상태
  if (error && trips.length === 0) {
    return (
      <main className="flex flex-col min-h-[calc(100dvh-64px)]">
        <header className="flex items-center justify-between px-4 py-1 border-b">
          <h1 className="font-semibold text-lg">내 여행</h1>
        </header>
        <ErrorState type="generic" description={error} onRetry={loadTrips} />
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-1 border-b">
        <h1 className="font-semibold text-lg flex items-center gap-2">
          내 여행
          <Map className="w-5 h-5 text-black" />
        </h1>
        <Link href="/plan" className="group">
          <Button
            className="
              relative overflow-hidden touch-target
              bg-[var(--primary)]
              text-[var(--primary-foreground)] font-semibold text-sm
              px-4 py-2 rounded-full
              shadow-lg shadow-[rgba(49,130,247,0.3)]
              hover:shadow-xl hover:shadow-[rgba(49,130,247,0.4)] hover:opacity-95
              hover:scale-105 active:scale-95
              active:opacity-90 transition-all duration-300 ease-out
              border-0
            "
          >
            {/* 컨텐츠 */}
            <span className="relative flex items-center gap-1.5">
              <span className="animate-[pulse_2s_ease-in-out_infinite]">
                새 여행
              </span>
              <Plane className="w-4 h-4 animate-[float_3s_ease-in-out_infinite] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
            </span>
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
