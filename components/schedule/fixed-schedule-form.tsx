"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  CalendarIcon,
  Clock,
  MapPin,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  createFixedScheduleSchema,
  generateTimeOptions,
  type CreateFixedScheduleInput,
} from "@/lib/schemas";
import type { Place } from "@/types/place";
import type { FixedSchedule } from "@/types/schedule";

// 시간 옵션 (06:00 ~ 23:30, 30분 단위)
const timeOptions = generateTimeOptions(6, 24);

// 체류 시간을 포맷팅
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}시간 ${mins}분`;
  } else if (hours > 0) {
    return `${hours}시간`;
  }
  return `${mins}분`;
}

interface FixedScheduleFormProps {
  /** 여행 ID */
  tripId: string;
  /** 선택 가능한 장소 목록 */
  places: Place[];
  /** 여행 기간 (시작일, 종료일) */
  tripDates: { startDate: string; endDate: string };
  /** 기존 고정 일정 (수정 모드) */
  existingSchedule?: FixedSchedule;
  /** 폼 제출 핸들러 */
  onSubmit: (data: CreateFixedScheduleInput) => Promise<void>;
  /** 삭제 핸들러 (수정 모드) */
  onDelete?: () => Promise<void>;
  /** 취소 핸들러 */
  onCancel: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 에러 메시지 */
  error?: string;
  /** 추가 클래스 */
  className?: string;
}

export function FixedScheduleForm({
  tripId,
  places,
  tripDates,
  existingSchedule,
  onSubmit,
  onDelete,
  onCancel,
  isLoading = false,
  error,
  className,
}: FixedScheduleFormProps) {
  const isEditMode = !!existingSchedule;

  const form = useForm<CreateFixedScheduleInput>({
    resolver: zodResolver(createFixedScheduleSchema),
    defaultValues: {
      tripId,
      placeId: existingSchedule?.placeId || "",
      date: existingSchedule?.date || "",
      startTime: existingSchedule?.startTime || "10:00",
      note: existingSchedule?.note || "",
    },
  });

  const handleSubmit = async (data: CreateFixedScheduleInput) => {
    try {
      await onSubmit(data);
    } catch (err) {
      console.error("고정 일정 저장 실패:", err);
    }
  };

  // 여행 기간 내 날짜만 선택 가능
  const isDateDisabled = (date: Date) => {
    const parseTripDate = (dateStr: string): Date | undefined => {
      if (!dateStr) return undefined;
      const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
      if (!year || !month || !day) return undefined;
      return new Date(year, month - 1, day);
    };

    const startDate = parseTripDate(tripDates.startDate);
    const endDate = parseTripDate(tripDates.endDate);

    if (!startDate || !endDate) {
      return false;
    }

    const startDay = new Date(startDate);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(endDate);
    endDay.setHours(23, 59, 59, 999);

    return date < startDay || date > endDay;
  };

  // 선택된 날짜를 Date 객체로 변환 (로컬 타임존 기준)
  const parseDate = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return undefined;
    return new Date(year, month - 1, day);
  };

  // 선택된 장소의 체류 시간 가져오기
  const selectedPlaceId = form.watch("placeId");
  const selectedPlace = places.find((p) => p.id === selectedPlaceId);

  // 날짜 선택 Popover 상태 (최상위에서 관리)
  const [dateOpen, setDateOpen] = React.useState(false);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-4", className)}
      >
        {/* 에러 표시 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 장소 선택 */}
        <FormField
          control={form.control}
          name="placeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>장소</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="touch-target">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="장소를 선택하세요" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {places.map((place) => (
                    <SelectItem key={place.id} value={place.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{place.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({formatDuration(place.estimatedDuration)})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
              {selectedPlace && (
                <p className="text-xs text-muted-foreground">
                  체류 시간: {formatDuration(selectedPlace.estimatedDuration)}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* 날짜 선택 */}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => {
            const isDatesLoaded = !!(tripDates.startDate && tripDates.endDate);

            return (
              <FormItem>
                <FormLabel>날짜</FormLabel>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal touch-target",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? (
                          format(
                            parseDate(field.value) || new Date(),
                            "yyyy년 M월 d일 (E)",
                            { locale: ko },
                          )
                        ) : (
                          <span>날짜를 선택하세요</span>
                        )}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={parseDate(field.value)}
                      onSelect={(date) => {
                        field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                        setDateOpen(false);
                      }}
                      disabled={isDateDisabled}
                      locale={ko}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
                {!isDatesLoaded && (
                  <p className="text-xs text-muted-foreground">
                    여행 기간 정보를 불러오지 못해, 전체 날짜에서 선택할 수 있어요.
                  </p>
                )}
              </FormItem>
            );
          }}
        />

        {/* 시작 시간 선택 */}
        <FormField
          control={form.control}
          name="startTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>시작 시간</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className="touch-target">
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {timeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 메모 */}
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>메모 (선택)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="예약 정보, 주의사항 등"
                  className="resize-none"
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 버튼 영역 */}
        <div className="flex gap-3 pt-2">
          {isEditMode && onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={isLoading}
              className="touch-target"
            >
              삭제
            </Button>
          )}
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="touch-target"
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="touch-target"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : isEditMode ? (
              "수정"
            ) : (
              "추가"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface FixedScheduleDialogProps
  extends Omit<FixedScheduleFormProps, "className"> {
  /** 다이얼로그 열림 상태 */
  open: boolean;
}

export function FixedScheduleDialog({
  open,
  onCancel,
  ...props
}: FixedScheduleDialogProps) {
  const isEditMode = !!props.existingSchedule;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-md w-[90vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "고정 일정 수정" : "고정 일정 추가"}
          </DialogTitle>
          <DialogDescription>
            특정 시간에 반드시 방문해야 하는 일정을 설정하세요
          </DialogDescription>
        </DialogHeader>
        <FixedScheduleForm onCancel={onCancel} {...props} />
      </DialogContent>
    </Dialog>
  );
}

interface FixedScheduleCardProps {
  /** 고정 일정 */
  schedule: FixedSchedule;
  /** 장소명 */
  placeName: string;
  /** 체류 시간 (분) */
  duration?: number;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 추가 클래스 */
  className?: string;
}

export function FixedScheduleCard({
  schedule,
  placeName,
  duration,
  onClick,
  className,
}: FixedScheduleCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/20",
        onClick && "cursor-pointer hover:bg-primary/10",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
        <Clock className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{placeName}</span>
          <span className="text-xs text-primary font-medium">고정</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {(() => {
            // YYYY-MM-DD 형식을 로컬 타임존 기준으로 파싱
            const [year, month, day] = schedule.date.split("-").map(Number);
            const date = new Date(year, month - 1, day);
            return format(date, "M월 d일");
          })()} {schedule.startTime}
          {duration && ` (${formatDuration(duration)})`}
        </div>
        {schedule.note && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {schedule.note}
          </p>
        )}
      </div>
    </div>
  );
}
