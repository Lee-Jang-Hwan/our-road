"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DateRangePicker } from "./date-picker";
import { LocationPairInput } from "./location-input";
import { TransportSelector } from "./transport-selector";
import { createTripSchema, type CreateTripInput } from "@/lib/schemas";
import type { TripLocation } from "@/types/trip";
import type { TransportMode } from "@/types/route";

interface TripFormProps {
  /** 폼 제출 핸들러 */
  onSubmit: (data: CreateTripInput) => Promise<void>;
  /** 초기 데이터 (수정 모드) */
  initialData?: Partial<CreateTripInput>;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 제출 버튼 텍스트 */
  submitText?: string;
  /** 취소 핸들러 */
  onCancel?: () => void;
  /** 추가 클래스 */
  className?: string;
}

export function TripForm({
  onSubmit,
  initialData,
  isLoading = false,
  submitText = "여행 만들기",
  onCancel,
  className,
}: TripFormProps) {
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
    },
  });

  const handleSubmit = async (data: CreateTripInput) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error("폼 제출 오류:", error);
    }
  };

  // 날짜 문자열을 Date 객체로 변환
  const parseDate = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date;
  };

  // Date 객체를 날짜 문자열로 변환
  const formatDate = (date: Date | undefined): string => {
    if (!date) return "";
    return format(date, "yyyy-MM-dd");
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-6", className)}
      >
        {/* 여행 제목 */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>여행 제목</FormLabel>
              <FormControl>
                <Input
                  placeholder="예: 제주도 3박 4일 여행"
                  {...field}
                  className="touch-target"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 날짜 선택 */}
        <div className="space-y-2">
          <FormLabel>여행 기간</FormLabel>
          <DateRangePicker
            startDate={parseDate(form.watch("startDate"))}
            endDate={parseDate(form.watch("endDate"))}
            onStartDateChange={(date) =>
              form.setValue("startDate", formatDate(date), {
                shouldValidate: true,
              })
            }
            onEndDateChange={(date) =>
              form.setValue("endDate", formatDate(date), {
                shouldValidate: true,
              })
            }
            maxDays={30}
          />
          {form.formState.errors.startDate && (
            <p className="text-sm font-medium text-destructive">
              {form.formState.errors.startDate.message}
            </p>
          )}
          {form.formState.errors.endDate && (
            <p className="text-sm font-medium text-destructive">
              {form.formState.errors.endDate.message}
            </p>
          )}
        </div>

        {/* 출발지/도착지 */}
        <div className="space-y-2">
          <FormLabel>출발지 / 도착지</FormLabel>
          <LocationPairInput
            origin={form.watch("origin") as TripLocation | undefined}
            destination={form.watch("destination") as TripLocation | undefined}
            onOriginChange={(location) =>
              form.setValue("origin", location as TripLocation, {
                shouldValidate: true,
              })
            }
            onDestinationChange={(location) =>
              form.setValue("destination", location as TripLocation, {
                shouldValidate: true,
              })
            }
            startTime={form.watch("dailyStartTime")}
            endTime={form.watch("dailyEndTime")}
            onStartTimeChange={(time) =>
              form.setValue("dailyStartTime", time, { shouldValidate: true })
            }
            onEndTimeChange={(time) =>
              form.setValue("dailyEndTime", time, { shouldValidate: true })
            }
          />
          {form.formState.errors.origin && (
            <p className="text-sm font-medium text-destructive">
              {form.formState.errors.origin.message}
            </p>
          )}
          {form.formState.errors.destination && (
            <p className="text-sm font-medium text-destructive">
              {form.formState.errors.destination.message}
            </p>
          )}
          {form.formState.errors.dailyEndTime && (
            <p className="text-sm font-medium text-destructive">
              {form.formState.errors.dailyEndTime.message}
            </p>
          )}
        </div>

        {/* 이동 수단 */}
        <FormField
          control={form.control}
          name="transportModes"
          render={({ field }) => (
            <FormItem>
              <TransportSelector
                value={field.value}
                onChange={(modes) =>
                  field.onChange(modes as TransportMode[])
                }
                label="이동 수단"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 버튼 영역 */}
        <div className="flex gap-3 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 touch-target"
            >
              취소
            </Button>
          )}
          <Button
            type="submit"
            disabled={isLoading}
            className={cn("touch-target", onCancel ? "flex-1" : "w-full")}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                처리 중...
              </>
            ) : (
              submitText
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface TripFormSummaryProps {
  title: string;
  startDate: string;
  endDate: string;
  origin?: TripLocation;
  destination?: TripLocation;
  transportModes: TransportMode[];
  className?: string;
}

export function TripFormSummary({
  title,
  startDate,
  endDate,
  origin,
  destination,
  transportModes,
  className,
}: TripFormSummaryProps) {
  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "M월 d일");
  };

  const getDays = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const nights = days - 1;
    return nights > 0 ? `${nights}박 ${days}일` : "당일치기";
  };

  return (
    <div className={cn("space-y-3 p-4 bg-muted/50 rounded-lg", className)}>
      <h3 className="font-semibold text-lg">{title}</h3>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          {formatDisplayDate(startDate)} ~ {formatDisplayDate(endDate)} (
          {getDays()})
        </p>
        {origin && destination && (
          <p>
            {origin.name} → {destination.name}
          </p>
        )}
        <p>
          이동수단:{" "}
          {transportModes
            .map((m) => (m === "public" ? "대중교통" : "자동차"))
            .join(", ")}
        </p>
      </div>
    </div>
  );
}
