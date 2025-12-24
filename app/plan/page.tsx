"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { LuChevronLeft } from "react-icons/lu";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TripForm } from "@/components/trip/trip-form";
import { showErrorToast } from "@/lib/toast";
import { useTripDraft } from "@/hooks/use-trip-draft";
import type { CreateTripInput } from "@/lib/schemas";

/**
 * 폼 로딩 스켈레톤
 */
function PageSkeleton() {
  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 스켈레톤 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="h-6 w-32" />
      </header>

      {/* 폼 스켈레톤 */}
      <div className="flex-1 px-4 py-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="h-10 flex-1 rounded-md" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="h-10 flex-1 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-md mt-4" />
      </div>
    </main>
  );
}

export default function NewTripPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { saveTripInfo } = useTripDraft();

  const handleSubmit = async (data: CreateTripInput) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // TODO: Server Action으로 여행 생성 후 실제 ID 사용
      // const trip = await createTrip(data);
      // router.push(`/plan/${trip.id}`);

      // 임시: 랜덤 ID 생성 후 sessionStorage에 데이터 저장
      const tempId = crypto.randomUUID();
      saveTripInfo(data, tempId);
      router.push(`/plan/${tempId}`);
    } catch (error) {
      console.error("여행 생성 실패:", error);
      showErrorToast("여행 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return <PageSkeleton />;
  }

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

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <Link href="/">
          <Button variant="ghost" size="icon" className="shrink-0 touch-target">
            <LuChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="font-semibold text-lg">새 여행 만들기</h1>
      </header>

      {/* 폼 */}
      <div className="flex-1 px-4 py-6">
        <TripForm
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
          submitText="여행 만들기"
        />
      </div>
    </main>
  );
}
