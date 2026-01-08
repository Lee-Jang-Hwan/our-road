"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CreateTripInput } from "@/lib/schemas";

interface TripConfirmDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 다이얼로그 상태 변경 핸들러 */
  onOpenChange: (open: boolean) => void;
  /** 확인할 여행 데이터 */
  data: CreateTripInput | null;
  /** 확인 버튼 클릭 핸들러 */
  onConfirm: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
}

/**
 * 날짜를 한국어 형식으로 포맷팅
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[date.getDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

/**
 * 이동 수단을 한국어로 변환
 */
function formatTransportMode(mode: string): string {
  const modeMap: Record<string, string> = {
    walking: "도보",
    public: "대중교통",
    car: "자동차",
  };
  return modeMap[mode] || mode;
}

/**
 * 두 날짜 사이의 일수 계산
 */
function calculateDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * 숙박 기간의 합 계산
 */
function calculateTotalAccommodationDays(
  accommodations: CreateTripInput["accommodations"]
): number {
  if (!accommodations || accommodations.length === 0) return 0;

  return accommodations.reduce((total, acc) => {
    if (acc.startDate && acc.endDate) {
      return total + calculateDaysBetween(acc.startDate, acc.endDate);
    }
    return total;
  }, 0);
}

/**
 * 숙박 기간 검증
 * 숙소가 없을 때는 경고 표시 안 함 (숙소는 선택사항)
 */
function validateAccommodationPeriod(
  startDate: string,
  endDate: string,
  accommodations: CreateTripInput["accommodations"]
): { isValid: boolean; message?: string } {
  // 숙소가 없으면 검증하지 않음
  if (!accommodations || accommodations.length === 0) {
    return { isValid: true };
  }

  const tripDays = calculateDaysBetween(startDate, endDate);
  const accommodationDays = calculateTotalAccommodationDays(accommodations);

  if (accommodationDays !== tripDays) {
    return {
      isValid: false,
      message: `숙박 기간의 합(${accommodationDays}일)이 여행 기간(${tripDays}일)과 일치하지 않습니다.`,
    };
  }

  return { isValid: true };
}

export function TripConfirmDialog({
  open,
  onOpenChange,
  data,
  onConfirm,
  isLoading = false,
}: TripConfirmDialogProps) {
  const accommodationValidation = data
    ? validateAccommodationPeriod(
        data.startDate,
        data.endDate,
        data.accommodations
      )
    : { isValid: true };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>여행 정보 확인</DialogTitle>
          <DialogDescription>
            입력하신 정보를 다시 한 번 확인해주세요.
          </DialogDescription>
        </DialogHeader>

        {data && (
          <div className="space-y-4 py-4">
            {/* 1. 여행 기간 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                여행 기간
              </div>
              <div className="text-base">
                {formatDate(data.startDate)} ~ {formatDate(data.endDate)}
              </div>
            </div>

            {/* 2. 이동 수단 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                이동 수단
              </div>
              <div className="flex flex-wrap gap-2">
                {data.transportModes.map((mode) => (
                  <span
                    key={mode}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary"
                  >
                    {formatTransportMode(mode)}
                  </span>
                ))}
              </div>
            </div>

            {/* 3. 숙소 정보 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                숙소 정보
              </div>
              {data.accommodations && data.accommodations.length > 0 ? (
                <div className="space-y-3">
                  {data.accommodations.map((acc, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg border bg-muted/50 space-y-1"
                    >
                      <div className="text-sm font-medium">
                        {acc.location?.name || "숙소명 미입력"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {acc.location?.address || "주소 미입력"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        숙박 기간: {formatDate(acc.startDate)} ~{" "}
                        {formatDate(acc.endDate)} (
                        {calculateDaysBetween(acc.startDate, acc.endDate)}일)
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  숙소 정보가 없습니다.
                </div>
              )}

              {/* 숙박 기간 경고 */}
              {!accommodationValidation.isValid && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {accommodationValidation.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "처리 중..." : "확인"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
