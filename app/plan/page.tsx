"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { LuChevronLeft } from "react-icons/lu";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TripFormWizard } from "@/components/trip/trip-form-wizard";
import { TripConfirmDialog } from "@/components/trip/trip-confirm-dialog";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { useTripDraft } from "@/hooks/use-trip-draft";
import { createTrip } from "@/actions/trips";
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
  const [currentStep, setCurrentStep] = useState(1);
  const { saveTripInfo } = useTripDraft();

  // 확인 다이얼로그 상태
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] =
    useState<CreateTripInput | null>(null);

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      router.push("/");
    }
  };

  const handleSubmit = async (data: CreateTripInput) => {
    if (!user) return;

    // 먼저 확인 다이얼로그를 엽니다
    setPendingSubmitData(data);
    setIsConfirmDialogOpen(true);
  };

  // 실제 submit 처리
  const handleConfirmSubmit = async () => {
    if (!user || !pendingSubmitData) return;

    setIsConfirmDialogOpen(false);
    setIsSubmitting(true);

    try {
      // Server Action으로 여행 생성
      const result = await createTrip(pendingSubmitData);

      if (!result.success || !result.data) {
        showErrorToast(result.error || "여행 생성에 실패했습니다.");
        return;
      }

      // sessionStorage에도 저장 (장소 추가 시 사용)
      saveTripInfo(pendingSubmitData, result.data.id);
      showSuccessToast("여행이 생성되었습니다!");
      router.push(`/plan/${result.data.id}`);
    } catch (error) {
      console.error("여행 생성 실패:", error);
      showErrorToast("여행 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
      setPendingSubmitData(null);
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
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 touch-target"
          onClick={handleBack}
        >
          <LuChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-semibold text-lg">새 여행 만들기</h1>
      </header>

      {/* 폼 */}
      <div className="flex-1 px-4 py-6">
        <TripFormWizard
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        />
      </div>

      {/* 확인 다이얼로그 */}
      <TripConfirmDialog
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        data={pendingSubmitData}
        onConfirm={handleConfirmSubmit}
        isLoading={isSubmitting}
      />
    </main>
  );
}
