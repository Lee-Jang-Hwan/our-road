"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { LuChevronLeft } from "react-icons/lu";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TripFormWizard } from "@/components/trip/trip-form-wizard";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { useTripDraft } from "@/hooks/use-trip-draft";
import { getTrip, updateTrip } from "@/actions/trips";
import type { CreateTripInput } from "@/lib/schemas";
import type { Trip } from "@/types";

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

/**
 * Trip 타입을 CreateTripInput 타입으로 변환
 */
function convertTripToCreateInput(trip: Trip): CreateTripInput {
  console.group("🔍 [Edit Page] convertTripToCreateInput");
  console.log("DB에서 가져온 trip 객체:", trip);
  console.log(
    "trip.dailyStartTime:",
    trip.dailyStartTime,
    "타입:",
    typeof trip.dailyStartTime,
  );
  console.log(
    "trip.dailyEndTime:",
    trip.dailyEndTime,
    "타입:",
    typeof trip.dailyEndTime,
  );

  // HH:mm:ss 형식을 HH:mm 형식으로 변환하는 헬퍼 함수
  const formatTime = (time: string | null | undefined): string => {
    if (!time) return "10:00"; // 기본값
    // HH:mm:ss 또는 HH:mm 형식 모두 처리
    return time.substring(0, 5);
  };

  const result = {
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    origin: trip.origin,
    destination: trip.destination,
    dailyStartTime: formatTime(trip.dailyStartTime) || "10:00",
    dailyEndTime: formatTime(trip.dailyEndTime) || "22:00",
    transportModes: trip.transportModes,
    accommodations: trip.accommodations || [],
  };

  console.log("변환된 CreateTripInput:", result);
  console.log("result.dailyStartTime:", result.dailyStartTime);
  console.log("result.dailyEndTime:", result.dailyEndTime);
  console.groupEnd();

  return result;
}

interface EditTripPageProps {
  params: Promise<{ tripId: string }>;
}

export default function EditTripPage({ params }: EditTripPageProps) {
  const { tripId } = use(params);
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState<CreateTripInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { saveTripInfo } = useTripDraft();

  // DB에서 여행 데이터 로드
  useEffect(() => {
    async function loadTrip() {
      if (!userLoaded || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const result = await getTrip(tripId);

      console.group("🔍 [Edit Page] loadTrip");
      console.log("getTrip 결과:", result);
      if (result.success && result.data) {
        console.log("result.data:", result.data);
        const createInput = convertTripToCreateInput(result.data);
        console.log("setInitialData 호출 전, createInput:", createInput);
        setInitialData(createInput);
        console.log("setInitialData 호출 완료");
      } else {
        console.error("getTrip 실패:", result.error);
        setError(result.error || "여행 정보를 불러오는데 실패했습니다.");
      }
      console.groupEnd();

      setIsLoading(false);
    }

    loadTrip();
  }, [tripId, user, userLoaded]);

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      router.push(`/plan/${tripId}`);
    }
  };

  const handleSubmit = async (data: CreateTripInput) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Server Action으로 여행 수정
      const result = await updateTrip(tripId, data);

      if (!result.success) {
        showErrorToast(result.error || "여행 수정에 실패했습니다.");
        return;
      }

      // sessionStorage에도 저장 (장소 추가 시 사용)
      saveTripInfo(data, tripId);
      showSuccessToast("여행이 수정되었습니다!");
      router.push(`/plan/${tripId}`);
    } catch (error) {
      console.error("여행 수정 실패:", error);
      showErrorToast("여행 수정에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userLoaded || isLoading) {
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

  if (error || !initialData) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[calc(100dvh-64px)] px-4 gap-4">
        <p className="text-muted-foreground">
          {error || "여행 정보를 불러올 수 없습니다."}
        </p>
        <Button
          onClick={() => router.push(`/plan/${tripId}`)}
          className="touch-target"
        >
          돌아가기
        </Button>
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
        <h1 className="font-semibold text-lg">여행 수정하기</h1>
      </header>

      {/* 폼 */}
      <div className="flex-1 px-4 py-6">
        <TripFormWizard
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          onSubmit={handleSubmit}
          initialData={initialData}
          isLoading={isSubmitting}
          submitButtonText="여행 수정하기"
        />
      </div>
    </main>
  );
}
