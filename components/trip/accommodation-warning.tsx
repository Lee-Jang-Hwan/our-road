"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, MapPin } from "lucide-react";
import { LuHotel } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DailyAccommodation } from "@/types/accommodation";

interface AccommodationWarningProps {
  tripId: string;
  startDate: string;
  endDate: string;
  accommodations?: DailyAccommodation[];
  lastPlaceName?: string;
  /** 모바일 여부 (Dialog 사용) */
  isMobile?: boolean;
  /** 버튼 표시 여부 */
  showButton?: boolean;
  className?: string;
}

/**
 * 숙소 누락 날짜를 확인하는 함수
 */
function getMissingAccommodationDates(
  startDate: string,
  endDate: string,
  accommodations?: DailyAccommodation[]
): string[] {
  if (!accommodations || accommodations.length === 0) {
    const missingDates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const nights = Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    for (let i = 0; i < nights; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      missingDates.push(date.toISOString().split("T")[0]);
    }
    return missingDates;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const nights = Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  const requiredDates = new Set<string>();
  for (let i = 0; i < nights; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    requiredDates.add(date.toISOString().split("T")[0]);
  }

  accommodations.forEach((acc) => {
    const accStart = new Date(acc.startDate);
    const accEnd = new Date(acc.endDate);
    const accNights = Math.floor(
      (accEnd.getTime() - accStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    for (let i = 0; i < accNights; i++) {
      const date = new Date(accStart);
      date.setDate(accStart.getDate() + i);
      requiredDates.delete(date.toISOString().split("T")[0]);
    }
  });

  return Array.from(requiredDates).sort();
}

/**
 * 날짜를 "M월 D일" 형식으로 포맷
 */
function formatDateKorean(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 숙소 누락 경고 컴포넌트
 */
export function AccommodationWarning({
  tripId,
  startDate,
  endDate,
  accommodations,
  lastPlaceName,
  isMobile = false,
  showButton = true,
  className = "",
}: AccommodationWarningProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const missingDates = getMissingAccommodationDates(
    startDate,
    endDate,
    accommodations
  );

  if (missingDates.length === 0) {
    return null;
  }

  // 연속된 날짜를 그룹화
  const groups: string[][] = [];
  let currentGroup: string[] = [missingDates[0]];

  for (let i = 1; i < missingDates.length; i++) {
    const prevDate = new Date(missingDates[i - 1]);
    const currDate = new Date(missingDates[i]);
    const diff =
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      currentGroup.push(missingDates[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [missingDates[i]];
    }
  }
  groups.push(currentGroup);

  // 디테일 내용
  const detailContent = (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium mb-2">숙소가 설정되지 않은 날짜:</p>
        <div className="space-y-1">
          {groups.map((group, idx) => {
            if (group.length === 1) {
              return (
                <p key={idx} className="text-sm text-muted-foreground">
                  • {formatDateKorean(group[0])}
                </p>
              );
            } else {
              return (
                <p key={idx} className="text-sm text-muted-foreground">
                  • {formatDateKorean(group[0])} ~{" "}
                  {formatDateKorean(group[group.length - 1])}
                </p>
              );
            }
          })}
        </div>
      </div>

      {lastPlaceName && (
        <div className="pt-2 border-t">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {lastPlaceName}
              </span>{" "}
              근처 숙소를 찾아보시는 것을 추천합니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // 모바일: Dialog 사용
  if (isMobile) {
    return (
      <>
        <div
          className={`flex items-center justify-between gap-3 px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}
        >
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
            <span className="text-sm font-medium text-yellow-800">
              숙소 설정이 필요합니다
            </span>
          </button>
          {showButton && (
            <Link href={`/plan/${tripId}/edit`}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-white hover:bg-yellow-50 shrink-0"
              >
                <LuHotel className="w-3.5 h-3.5 mr-1.5" />
                설정하기
              </Button>
            </Link>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                숙소 설정이 필요합니다
              </DialogTitle>
              <DialogDescription className="sr-only">
                숙소가 설정되지 않은 날짜 정보
              </DialogDescription>
            </DialogHeader>
            {detailContent}
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1"
              >
                닫기
              </Button>
              <Link href={`/plan/${tripId}/edit`} className="flex-1">
                <Button className="w-full">
                  <LuHotel className="w-4 h-4 mr-2" />
                  숙소 설정하기
                </Button>
              </Link>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // 데스크톱: Popover 사용 (호버)
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <div
          className={`flex items-center justify-between gap-3 px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors ${className}`}
          onMouseEnter={() => setPopoverOpen(true)}
          onMouseLeave={() => setPopoverOpen(false)}
        >
          <div className="flex items-center gap-2 flex-1">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
            <span className="text-sm font-medium text-yellow-800">
              숙소 설정이 필요합니다
            </span>
          </div>
          {showButton && (
            <Link href={`/plan/${tripId}/edit`} onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-white hover:bg-yellow-50 shrink-0"
              >
                <LuHotel className="w-3.5 h-3.5 mr-1.5" />
                설정하기
              </Button>
            </Link>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        align="start"
        onMouseEnter={() => setPopoverOpen(true)}
        onMouseLeave={() => setPopoverOpen(false)}
      >
        <div className="space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            숙소 설정이 필요합니다
          </h4>
          {detailContent}
        </div>
      </PopoverContent>
    </Popover>
  );
}

