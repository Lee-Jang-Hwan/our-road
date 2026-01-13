"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Trash2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LocationInput } from "./location-input";
import { generateTimeOptions } from "@/lib/schemas";
import type { CreateTripInput } from "@/lib/schemas";
import type { TripLocation } from "@/types/trip";

interface AccommodationInputProps {
  /** 숙소 인덱스 */
  index: number;
  /** 삭제 핸들러 */
  onRemove: () => void;
  /** 추가 클래스 */
  className?: string;
}

// 시간 옵션 생성 (00:00 ~ 23:30)
const timeOptions = generateTimeOptions(0, 24);

export function AccommodationInput({
  index,
  onRemove,
  className,
}: AccommodationInputProps) {
  const form = useFormContext<CreateTripInput>();
  const fieldName = `accommodations.${index}` as const;
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(
    undefined,
  );

  const startDateValue = form.watch(`${fieldName}.startDate`);
  const endDateValue = form.watch(`${fieldName}.endDate`);
  const checkInDurationValue = form.watch(
    `${fieldName}.checkInDurationMin`,
  );

  // 현재 폼의 여행 기간을 직접 참조
  const currentTripStartDate = form.watch("startDate");
  const currentTripEndDate = form.watch("endDate");

  // 날짜 문자열을 로컬 날짜로 파싱 (타임존 문제 방지)
  const parseLocalDate = React.useCallback((dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, []);

  // 여행 기간이 변경되었을 때 숙소 날짜를 자동으로 조정
  React.useEffect(() => {
    if (!currentTripStartDate || !currentTripEndDate) return;
    if (!startDateValue && !endDateValue) return; // 숙소 날짜가 없으면 조정 불필요

    const tripStart = parseLocalDate(currentTripStartDate);
    const tripEnd = parseLocalDate(currentTripEndDate);
    tripStart.setHours(0, 0, 0, 0);
    tripEnd.setHours(23, 59, 59, 999);

    let needsUpdate = false;
    let newStartDate = startDateValue;
    let newEndDate = endDateValue;

    // 시작일이 여행 기간을 벗어나면 조정
    if (startDateValue) {
      const start = parseLocalDate(startDateValue);
      if (start < tripStart || start > tripEnd) {
        newStartDate = currentTripStartDate;
        needsUpdate = true;
      }
    }

    // 종료일이 여행 기간을 벗어나면 조정
    if (endDateValue) {
      const end = parseLocalDate(endDateValue);
      if (end < tripStart || end > tripEnd) {
        newEndDate = currentTripEndDate;
        needsUpdate = true;
      }
    }

    // 시작일이 종료일보다 늦으면 조정
    if (newStartDate && newEndDate) {
      const start = parseLocalDate(newStartDate);
      const end = parseLocalDate(newEndDate);
      if (start > end) {
        newEndDate = newStartDate;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      if (newStartDate) {
        form.setValue(`${fieldName}.startDate`, newStartDate, {
          shouldValidate: true,
        });
      }
      if (newEndDate) {
        form.setValue(`${fieldName}.endDate`, newEndDate, {
          shouldValidate: true,
        });
      }
    }
  }, [
    currentTripStartDate,
    currentTripEndDate,
    fieldName,
    form,
    startDateValue,
    endDateValue,
    parseLocalDate,
  ]);

  const selectedRange: DateRange | undefined =
    startDateValue || endDateValue
      ? {
          from: startDateValue ? parseLocalDate(startDateValue) : undefined,
          to: endDateValue ? parseLocalDate(endDateValue) : undefined,
        }
      : undefined;

  // 캘린더가 열릴 때 기존 선택을 초기화
  React.useEffect(() => {
    if (calendarOpen) {
      setTempRange(undefined);
    }
  }, [calendarOpen]);

  // 여행 기간 내에서만 선택 가능 (현재 폼의 여행 기간 사용)
  const disabledDates = (date: Date) => {
    if (!currentTripStartDate || !currentTripEndDate) return false;
    const start = parseLocalDate(currentTripStartDate);
    const end = parseLocalDate(currentTripEndDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date < start || date > end;
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setTempRange(range); // 임시 상태 업데이트

    if (range?.from) {
      form.setValue(
        `${fieldName}.startDate`,
        format(range.from, "yyyy-MM-dd"),
        {
          shouldValidate: true,
        },
      );
    }
    if (range?.to) {
      form.setValue(`${fieldName}.endDate`, format(range.to, "yyyy-MM-dd"), {
        shouldValidate: true,
      });
      // 시작일과 종료일 모두 선택되면 캘린더 닫기
      if (range.from && range.from.getTime() !== range.to.getTime()) {
        setCalendarOpen(false);
      }
    }
  };

  return (
    <div
      className={cn("p-4 border rounded-lg space-y-3 bg-muted/30", className)}
    >
      {/* 헤더: 숙소 번호 + 삭제 버튼 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">숙소 {index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 날짜 범위 선택 */}
      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground">숙박 기간</label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !selectedRange?.from && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedRange?.from ? (
                selectedRange.to &&
                selectedRange.from.getTime() !== selectedRange.to.getTime() ? (
                  <>
                    {format(selectedRange.from, "M월 d일 (E)", { locale: ko })}
                    {" ~ "}
                    {format(selectedRange.to, "M월 d일 (E)", { locale: ko })}
                  </>
                ) : (
                  format(selectedRange.from, "yyyy년 M월 d일 (E)", {
                    locale: ko,
                  })
                )
              ) : (
                <span>체크인 ~ 체크아웃 날짜 선택</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={handleDateRangeSelect}
              disabled={disabledDates}
              locale={ko}
              numberOfMonths={2}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* 숙소 위치 검색 */}
      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground">숙소 위치</label>
        <LocationInput
          value={
            form.watch(`${fieldName}.location`) as TripLocation | undefined
          }
          onChange={(location) => {
            if (location === undefined) {
              // undefined일 때 필드를 명시적으로 초기화
              form.setValue(
                `${fieldName}.location`,
                undefined as unknown as TripLocation,
                {
                  shouldValidate: true,
                },
              );
            } else {
              form.setValue(`${fieldName}.location`, location, {
                shouldValidate: true,
              });
            }
          }}
          placeholder="숙소 검색"
        />
      </div>

      {/* 체크인/체크아웃 시간 */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            체크인
          </span>
          <Select
            value={form.watch(`${fieldName}.checkInTime`) || "15:00"}
            onValueChange={(value) =>
              form.setValue(`${fieldName}.checkInTime`, value)
            }
          >
            <SelectTrigger className="w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            체류(분)
          </span>
          <Input
            type="number"
            min={0}
            max={180}
            step={5}
            value={checkInDurationValue ?? 30}
            onChange={(event) => {
              const rawValue = event.target.value;
              const nextValue =
                rawValue === "" ? 30 : Number(rawValue);
              form.setValue(
                `${fieldName}.checkInDurationMin`,
                Number.isNaN(nextValue) ? 30 : nextValue,
                { shouldValidate: true },
              );
            }}
            className="w-20 h-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            체크아웃
          </span>
          <Select
            value={form.watch(`${fieldName}.checkOutTime`) || "11:00"}
            onValueChange={(value) =>
              form.setValue(`${fieldName}.checkOutTime`, value)
            }
          >
            <SelectTrigger className="w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
