"use client";

import * as React from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  /** 선택된 날짜 */
  value?: Date;
  /** 날짜 변경 핸들러 */
  onChange: (date: Date | undefined) => void;
  /** 플레이스홀더 텍스트 */
  placeholder?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 선택 불가능한 날짜 (기본: 오늘 이전) */
  disabledDates?: (date: Date) => boolean;
  /** 최소 선택 가능 날짜 */
  minDate?: Date;
  /** 최대 선택 가능 날짜 */
  maxDate?: Date;
  /** 추가 클래스 */
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "날짜 선택",
  disabled = false,
  disabledDates,
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // 기본 비활성화 로직: 오늘 이전 날짜
  const defaultDisabledDates = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) return true;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;

    return false;
  };

  const handleSelect = (date: Date | undefined) => {
    onChange(date);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal touch-target",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            format(value, "yyyy년 M월 d일 (E)", { locale: ko })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          disabled={disabledDates || defaultDisabledDates}
          locale={ko}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

interface DateRangePickerProps {
  /** 시작일 */
  startDate?: Date;
  /** 종료일 */
  endDate?: Date;
  /** 시작일 변경 핸들러 */
  onStartDateChange: (date: Date | undefined) => void;
  /** 종료일 변경 핸들러 */
  onEndDateChange: (date: Date | undefined) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 최대 여행 기간 (일) */
  maxDays?: number;
  /** 시작일 에러 메시지 */
  startDateError?: string;
  /** 종료일 에러 메시지 */
  endDateError?: string;
  /** 추가 클래스 */
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabled = false,
  maxDays = 30,
  startDateError,
  endDateError,
  className,
}: DateRangePickerProps) {
  // 종료일 최소/최대 날짜 계산
  const endDateMin = startDate ? new Date(startDate) : undefined;
  const endDateMax = startDate
    ? new Date(startDate.getTime() + (maxDays - 1) * 24 * 60 * 60 * 1000)
    : undefined;

  // 시작일이 변경되면 종료일 검증
  const handleStartDateChange = (date: Date | undefined) => {
    onStartDateChange(date);

    // 종료일이 시작일보다 이전이면 초기화
    if (date && endDate && endDate < date) {
      onEndDateChange(undefined);
    }

    // 종료일이 최대 기간을 초과하면 초기화
    if (date && endDate) {
      const diffDays = Math.ceil(
        (endDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays >= maxDays) {
        onEndDateChange(undefined);
      }
    }
  };

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:gap-2", className)}>
      <div className="flex-1">
        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
          시작일
        </label>
        <DatePicker
          value={startDate}
          onChange={handleStartDateChange}
          placeholder="시작일 선택"
          disabled={disabled}
        />
        {startDateError && (
          <p className="text-sm font-medium text-destructive mt-1">
            {startDateError}
          </p>
        )}
      </div>
      <div className="flex-1">
        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
          종료일
        </label>
        <DatePicker
          value={endDate}
          onChange={onEndDateChange}
          placeholder="종료일 선택"
          disabled={disabled || !startDate}
          minDate={endDateMin}
          maxDate={endDateMax}
        />
        {endDateError && (
          <p className="text-sm font-medium text-destructive mt-1">
            {endDateError}
          </p>
        )}
      </div>
    </div>
  );
}
