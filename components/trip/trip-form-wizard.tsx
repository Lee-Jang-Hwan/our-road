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
  /** 현재 스텝 */
  currentStep?: number;
  /** 스텝 변경 핸들러 */
  onStepChange?: (step: number) => void;
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
  /** 제출 버튼 텍스트 */
  submitButtonText?: string;
}

type SlideDirection = "forward" | "backward";

export function TripFormWizard({
  currentStep: externalCurrentStep,
  onStepChange,
  onSubmit,
  initialData,
  isLoading = false,
  onCancel,
  className,
  submitButtonText = "여행 만들기",
}: TripFormWizardProps) {
  const [internalCurrentStep, setInternalCurrentStep] = React.useState(1);
  const [direction, setDirection] = React.useState<SlideDirection>("forward");
  const [isAnimating, setIsAnimating] = React.useState(false);

  // 외부에서 currentStep을 제어하는 경우 외부 값 사용, 아니면 내부 상태 사용
  const currentStep = externalCurrentStep ?? internalCurrentStep;
  const setCurrentStep = onStepChange ?? setInternalCurrentStep;

  const form = useForm<CreateTripInput>({
    resolver: zodResolver(createTripSchema),
    defaultValues: (() => {
      console.group("🔍 [TripFormWizard] useForm defaultValues");
      console.log("initialData:", initialData);
      console.log(
        "initialData?.dailyStartTime:",
        initialData?.dailyStartTime,
        "타입:",
        typeof initialData?.dailyStartTime,
      );
      console.log(
        "initialData?.dailyEndTime:",
        initialData?.dailyEndTime,
        "타입:",
        typeof initialData?.dailyEndTime,
      );

      const defaultValues = {
        title: initialData?.title || "",
        startDate: initialData?.startDate || "",
        endDate: initialData?.endDate || "",
        origin: initialData?.origin || undefined,
        destination: initialData?.destination || undefined,
        dailyStartTime: initialData?.dailyStartTime || "10:00",
        dailyEndTime: initialData?.dailyEndTime || "22:00",
        transportModes: initialData?.transportModes || ["public"],
        accommodations: initialData?.accommodations || [],
      };

      console.log("설정된 defaultValues:", defaultValues);
      console.log(
        "defaultValues.dailyStartTime:",
        defaultValues.dailyStartTime,
      );
      console.log("defaultValues.dailyEndTime:", defaultValues.dailyEndTime);
      console.groupEnd();

      return defaultValues;
    })(),
  });

  // initialData가 변경될 때 폼 값 업데이트
  React.useEffect(() => {
    console.group("🔍 [TripFormWizard] useEffect - initialData 변경");
    console.log("initialData:", initialData);
    if (initialData) {
      console.log(
        "initialData.dailyStartTime:",
        initialData.dailyStartTime,
        "타입:",
        typeof initialData.dailyStartTime,
      );
      console.log(
        "initialData.dailyEndTime:",
        initialData.dailyEndTime,
        "타입:",
        typeof initialData.dailyEndTime,
      );

      const resetData = {
        title: initialData.title || "",
        startDate: initialData.startDate || "",
        endDate: initialData.endDate || "",
        origin: initialData.origin || undefined,
        destination: initialData.destination || undefined,
        dailyStartTime: initialData.dailyStartTime || "10:00",
        dailyEndTime: initialData.dailyEndTime || "22:00",
        transportModes: initialData.transportModes || ["public"],
        accommodations: initialData.accommodations || [],
      };

      console.log("form.reset 호출 전, resetData:", resetData);
      console.log("resetData.dailyStartTime:", resetData.dailyStartTime);
      console.log("resetData.dailyEndTime:", resetData.dailyEndTime);

      form.reset(resetData);

      // reset 후 폼 값 확인
      setTimeout(() => {
        const currentValues = form.getValues();
        console.log("form.reset 호출 후, 현재 폼 값:", currentValues);
        console.log("현재 dailyStartTime:", currentValues.dailyStartTime);
        console.log("현재 dailyEndTime:", currentValues.dailyEndTime);
      }, 0);
    } else {
      console.log("initialData가 없습니다 (null 또는 undefined)");
    }
    console.groupEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]); // form은 안정적이므로 의도적으로 제외

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
    currentStep === 2 && "hidden",
  );

  // Step 2 애니메이션 클래스
  const step2Classes = cn(
    "transition-all duration-300 ease-out",
    currentStep === 2 && !isAnimating && "translate-x-0 opacity-100",
    currentStep === 2 &&
      isAnimating &&
      direction === "backward" &&
      "translate-x-full opacity-0",
    currentStep === 1 && "hidden",
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
              currentStep >= 1 ? "bg-primary" : "bg-muted",
            )}
          />
          <div
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              currentStep >= 2 ? "bg-primary" : "bg-muted",
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
              submitButtonText={submitButtonText}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
