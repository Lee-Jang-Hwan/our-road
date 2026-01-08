"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { DateRangePicker } from "./date-picker";
import { TransportSelector } from "./transport-selector";
import type { CreateTripInput } from "@/lib/schemas";
import type { TransportMode } from "@/types/route";

interface TripFormStep1Props {
  /** 다음 버튼 핸들러 */
  onNext: () => void;
  /** 취소 핸들러 */
  onCancel?: () => void;
}

export function TripFormStep1({ onNext, onCancel }: TripFormStep1Props) {
  const form = useFormContext<CreateTripInput>();

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
    <div className="space-y-6">
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
          startDateError={form.formState.errors.startDate?.message}
          endDateError={form.formState.errors.endDate?.message}
        />
      </div>

      {/* 이동 수단 */}
      <FormField
        control={form.control}
        name="transportModes"
        render={({ field }) => (
          <FormItem>
            <TransportSelector
              value={field.value}
              onChange={(modes) => field.onChange(modes as TransportMode[])}
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
            className="flex-1 touch-target"
          >
            취소
          </Button>
        )}
        <Button
          type="button"
          onClick={onNext}
          className="flex-1 touch-target"
        >
          다음
        </Button>
      </div>
    </div>
  );
}
