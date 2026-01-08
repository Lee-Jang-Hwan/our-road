"use client";

import * as React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Loader2, ChevronLeft, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormLabel } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationInput } from "./location-input";
import { AccommodationInput } from "./accommodation-input";
import { generateTimeOptions } from "@/lib/schemas";
import type { CreateTripInput } from "@/lib/schemas";
import type { TripLocation } from "@/types/trip";

// 시간 옵션 생성 (06:00 ~ 23:30)
const timeOptions = generateTimeOptions(6, 24);

interface TripFormStep2Props {
  /** 이전 버튼 핸들러 */
  onBack: () => void;
  /** 숙박 일수 */
  nights: number;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 제출 버튼 텍스트 */
  submitButtonText?: string;
}

export function TripFormStep2({
  onBack,
  nights,
  isLoading,
  submitButtonText = "여행 만들기",
}: TripFormStep2Props) {
  const form = useFormContext<CreateTripInput>();

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "accommodations",
  });

  const startDateValue = form.watch("startDate");
  const endDateValue = form.watch("endDate");
  const originValue = form.watch("origin") as TripLocation | undefined;
  const destinationValue = form.watch("destination") as
    | TripLocation
    | undefined;

  // 도착지를 출발지와 동일하게 설정하는 상태
  const [sameAsOrigin, setSameAsOrigin] = React.useState(false);

  // 출발지와 동일 체크박스 변경 시
  const handleSameAsOriginChange = (checked: boolean) => {
    setSameAsOrigin(checked);
    if (checked && originValue) {
      form.setValue("destination", originValue, { shouldValidate: true });
    } else if (!checked) {
      form.setValue("destination", undefined as unknown as TripLocation, {
        shouldValidate: true,
      });
    }
  };

  // 출발지 변경 시 도착지도 동기화
  React.useEffect(() => {
    if (!sameAsOrigin || !originValue) return;

    const isSame =
      destinationValue?.name === originValue.name &&
      destinationValue?.address === originValue.address &&
      destinationValue?.lat === originValue.lat &&
      destinationValue?.lng === originValue.lng;

    if (!isSame) {
      form.setValue("destination", originValue, { shouldValidate: true });
    }
  }, [sameAsOrigin, originValue, destinationValue, form]);

  // 숙소 추가
  const handleAddAccommodation = () => {
    append({
      startDate: startDateValue || "",
      endDate: endDateValue || "",
      location: undefined as unknown as TripLocation,
      checkInTime: "15:00",
      checkOutTime: "11:00",
    });
  };

  return (
    <div className="space-y-6">
      {/* 출발지 - 여행 시작 장소 */}
      <div className="space-y-2">
        <FormLabel>여행 시작 (출발지)</FormLabel>
        <p className="text-xs text-muted-foreground -mt-1">
          여행을 시작하는 장소와 출발 시간을 설정하세요
        </p>
        <LocationInput
          value={form.watch("origin") as TripLocation | undefined}
          onChange={(location) => {
            if (location === undefined) {
              form.setValue("origin", undefined as unknown as TripLocation, {
                shouldValidate: true,
              });
            } else {
              form.setValue("origin", location, {
                shouldValidate: true,
              });
            }
          }}
          placeholder="출발 장소 검색 (예: 집, 공항)"
          showTimeSelect
          time={form.watch("dailyStartTime")}
          onTimeChange={(time) => form.setValue("dailyStartTime", time)}
          timeLabel="출발 시간"
          defaultTime="10:00"
        />
        {form.formState.errors.origin && (
          <p className="text-sm font-medium text-destructive">
            {form.formState.errors.origin.message}
          </p>
        )}
      </div>

      {/* 숙소 섹션 (1박 이상일 때만 표시) */}
      {nights > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <FormLabel>숙소 (선택)</FormLabel>
              <p className="text-xs text-muted-foreground mt-0.5">
                여행 중 숙박할 장소를 추가하세요
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddAccommodation}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              숙소 추가
            </Button>
          </div>

          {/* 추가된 숙소 목록 */}
          {fields.length > 0 && (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <AccommodationInput
                  key={field.id}
                  index={index}
                  onRemove={() => remove(index)}
                  tripStartDate={startDateValue}
                  tripEndDate={endDateValue}
                />
              ))}
            </div>
          )}

          {/* 숙소가 없을 때 안내 */}
          {fields.length === 0 && (
            <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
              아직 추가된 숙소가 없습니다.
              <br />
              숙소 추가 버튼을 눌러 숙박 정보를 입력하세요.
            </div>
          )}
        </div>
      )}

      {/* 도착지 - 여행 마지막 도착 장소 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <FormLabel>여행 종료 (도착지)</FormLabel>
          <div className="flex items-center gap-2">
            <Checkbox
              id="sameAsOrigin"
              checked={sameAsOrigin}
              onCheckedChange={handleSameAsOriginChange}
              disabled={!originValue}
            />
            <label
              htmlFor="sameAsOrigin"
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              출발지와 동일
            </label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          여행을 마치는 최종 도착 장소와 시간을 설정하세요
        </p>
        {sameAsOrigin ? (
          <div className="p-3 border rounded-lg bg-muted/30">
            <p className="text-sm">
              {originValue?.name ?? "출발지를 먼저 선택해주세요"}
            </p>
            {originValue?.address && (
              <p className="text-xs text-muted-foreground mt-1">
                {originValue.address}
              </p>
            )}
          </div>
        ) : (
          <LocationInput
            value={form.watch("destination") as TripLocation | undefined}
            onChange={(location) => {
              if (location === undefined) {
                form.setValue(
                  "destination",
                  undefined as unknown as TripLocation,
                  {
                    shouldValidate: true,
                  },
                );
              } else {
                form.setValue("destination", location, {
                  shouldValidate: true,
                });
              }
            }}
            placeholder="최종 도착 장소 검색 (예: 집, 공항)"
          />
        )}
        {/* 도착 시간 */}
        <div className="flex items-center gap-2 pt-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">도착 시간</span>
          <Select
            value={form.watch("dailyEndTime") || "22:00"}
            onValueChange={(time) => form.setValue("dailyEndTime", time)}
          >
            <SelectTrigger className="w-24 h-9">
              <SelectValue placeholder="시간" />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

      {/* 버튼 영역 */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="touch-target"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          이전
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 touch-target"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              처리 중...
            </>
          ) : (
            submitButtonText
          )}
        </Button>
      </div>
    </div>
  );
}
