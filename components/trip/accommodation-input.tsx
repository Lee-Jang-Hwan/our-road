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
import { LocationInput } from "./location-input";
import { generateTimeOptions } from "@/lib/schemas";
import type { CreateTripInput } from "@/lib/schemas";
import type { TripLocation } from "@/types/trip";

interface AccommodationInputProps {
  /** 숙소 인덱스 */
  index: number;
  /** 삭제 핸들러 */
  onRemove: () => void;
  /** 여행 시작일 */
  tripStartDate?: string;
  /** 여행 종료일 */
  tripEndDate?: string;
  /** 추가 클래스 */
  className?: string;
}

// 시간 옵션 생성 (00:00 ~ 23:30)
const timeOptions = generateTimeOptions(0, 24);

export function AccommodationInput({
  index,
  onRemove,
  tripStartDate,
  tripEndDate,
  className,
}: AccommodationInputProps) {
  const form = useFormContext<CreateTripInput>();
  const fieldName = `accommodations.${index}` as const;
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  const startDateValue = form.watch(`${fieldName}.startDate`);
  const endDateValue = form.watch(`${fieldName}.endDate`);

  const selectedRange: DateRange | undefined =
    startDateValue || endDateValue
      ? {
          from: startDateValue ? new Date(startDateValue) : undefined,
          to: endDateValue ? new Date(endDateValue) : undefined,
        }
      : undefined;

  // 여행 기간 내에서만 선택 가능
  const disabledDates = (date: Date) => {
    if (!tripStartDate || !tripEndDate) return false;
    const start = new Date(tripStartDate);
    const end = new Date(tripEndDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date < start || date > end;
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      form.setValue(`${fieldName}.startDate`, format(range.from, "yyyy-MM-dd"), {
        shouldValidate: true,
      });
    }
    if (range?.to) {
      form.setValue(`${fieldName}.endDate`, format(range.to, "yyyy-MM-dd"), {
        shouldValidate: true,
      });
      // 시작일과 종료일 모두 선택되면 캘린더 닫기
      if (range.from) {
        setCalendarOpen(false);
      }
    } else if (range?.from && !range?.to) {
      // 시작일만 선택된 경우 종료일도 같은 날짜로 임시 설정
      form.setValue(`${fieldName}.endDate`, format(range.from, "yyyy-MM-dd"), {
        shouldValidate: true,
      });
    }
  };

  return (
    <div
      className={cn(
        "p-4 border rounded-lg space-y-3 bg-muted/30",
        className
      )}
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
                !selectedRange?.from && "text-muted-foreground"
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
                  format(selectedRange.from, "yyyy년 M월 d일 (E)", { locale: ko })
                )
              ) : (
                <span>체크인 ~ 체크아웃 날짜 선택</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={selectedRange}
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
          value={form.watch(`${fieldName}.location`) as TripLocation | undefined}
          onChange={(location) => {
            if (location === undefined) {
              // undefined일 때 필드를 명시적으로 초기화
              form.setValue(`${fieldName}.location`, undefined as unknown as TripLocation, {
                shouldValidate: true,
              });
            } else {
              form.setValue(`${fieldName}.location`, location, {
                shouldValidate: true,
              });
            }
          }}
          placeholder="숙소 검색 (호텔, 펜션 등)"
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
