"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { cn } from "@/lib/utils";
import { Form } from "@/components/ui/form";
import { TripFormStep1 } from "./trip-form-step1";
import { TripFormStep2 } from "./trip-form-step2";
import { createTripSchema, type CreateTripInput } from "@/lib/schemas";

interface TripFormWizardProps {
  /** 폼 제출 핸들러 */
  onSubmit: (data: CreateTripInput) => Promise<void>;
  /** 초기 데이터 (수정 모드) */
  initialData?: Partial<CreateTripInput>;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 취소 핸들러 */
  onCancel?: () => void;
  /** 추가 클래스 */
  className?: string;
}

type SlideDirection = "forward" | "backward";

export function TripFormWizard({
  onSubmit,
  initialData,
  isLoading = false,
  onCancel,
  className,
}: TripFormWizardProps) {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [direction, setDirection] = React.useState<SlideDirection>("forward");
  const [isAnimating, setIsAnimating] = React.useState(false);

  const form = useForm<CreateTripInput>({
    resolver: zodResolver(createTripSchema),
    defaultValues: {
      title: initialData?.title || "",
      startDate: initialData?.startDate || "",
      endDate: initialData?.endDate || "",
      origin: initialData?.origin || undefined,
      destination: initialData?.destination || undefined,
      dailyStartTime: initialData?.dailyStartTime || "10:00",
      dailyEndTime: initialData?.dailyEndTime || "22:00",
      transportModes: initialData?.transportModes || ["public"],
      accommodations: initialData?.accommodations || [],
    },
  });

  // 다음 페이지로 이동
  const handleNext = async () => {
    // Step 1 필드 유효성 검사
    const isValid = await form.trigger([
      "title",
      "startDate",
      "endDate",
      "transportModes",
    ]);
    if (!isValid) return;

    setDirection("forward");
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(2);
      setIsAnimating(false);
    }, 300);
  };

  // 이전 페이지로 이동
  const handleBack = () => {
    setDirection("backward");
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(1);
      setIsAnimating(false);
    }, 300);
  };

  // 폼 제출
  const handleSubmit = async (data: CreateTripInput) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error("폼 제출 오류:", error);
    }
  };

  // 숙박 일수 계산
  const startDateValue = form.watch("startDate");
  const endDateValue = form.watch("endDate");
  const nights = React.useMemo(() => {
    if (!startDateValue || !endDateValue) return 0;
    const startDate = new Date(startDateValue);
    const endDate = new Date(endDateValue);
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }, [startDateValue, endDateValue]);

  // Step 1 애니메이션 클래스
  const step1Classes = cn(
    "transition-all duration-300 ease-out",
    currentStep === 1 && !isAnimating && "translate-x-0 opacity-100",
    currentStep === 1 &&
      isAnimating &&
      direction === "forward" &&
      "-translate-x-full opacity-0",
    currentStep === 2 && "hidden"
  );

  // Step 2 애니메이션 클래스
  const step2Classes = cn(
    "transition-all duration-300 ease-out",
    currentStep === 2 && !isAnimating && "translate-x-0 opacity-100",
    currentStep === 2 &&
      isAnimating &&
      direction === "backward" &&
      "translate-x-full opacity-0",
    currentStep === 1 && "hidden"
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("relative overflow-hidden", className)}
      >
        {/* 진행 표시 */}
        <div className="flex gap-2 mb-6">
          <div
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              currentStep >= 1 ? "bg-primary" : "bg-muted"
            )}
          />
          <div
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              currentStep >= 2 ? "bg-primary" : "bg-muted"
            )}
          />
        </div>

        {/* 페이지 컨테이너 */}
        <div className="relative">
          {/* Step 1 */}
          <div className={step1Classes}>
            <TripFormStep1 onNext={handleNext} onCancel={onCancel} />
          </div>

          {/* Step 2 */}
          <div className={step2Classes}>
            <TripFormStep2
              onBack={handleBack}
              nights={nights}
              isLoading={isLoading}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
