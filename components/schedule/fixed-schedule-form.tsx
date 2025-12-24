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
import { Input } from "@/components/ui/input";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  createFixedScheduleSchema,
  generateTimeOptions,
  type CreateFixedScheduleInput,
} from "@/lib/schemas";
import type { Place } from "@/types/place";
import type { FixedSchedule } from "@/types/schedule";

// 시간 옵션 (00:00 ~ 23:30, 30분 단위)
const timeOptions = generateTimeOptions(0, 24);

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
      endTime: existingSchedule?.endTime || "12:00",
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
    const dateStr = format(date, "yyyy-MM-dd");
    return dateStr < tripDates.startDate || dateStr > tripDates.endDate;
  };

  // 선택된 날짜를 Date 객체로 변환
  const parseDate = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    return new Date(dateStr);
  };

  // 시작 시간이 종료 시간보다 늦은지 확인
  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");
  const isTimeInvalid = startTime >= endTime;

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
                      {place.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 날짜 선택 */}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>날짜</FormLabel>
              <Popover>
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
                        format(new Date(field.value), "yyyy년 M월 d일 (E)", {
                          locale: ko,
                        })
                      ) : (
                        <span>날짜를 선택하세요</span>
                      )}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseDate(field.value)}
                    onSelect={(date) =>
                      field.onChange(date ? format(date, "yyyy-MM-dd") : "")
                    }
                    disabled={isDateDisabled}
                    locale={ko}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 시간 선택 */}
        <div className="grid grid-cols-2 gap-3">
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

          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>종료 시간</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger
                      className={cn(
                        "touch-target",
                        isTimeInvalid && "border-destructive"
                      )}
                    >
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
        </div>

        {isTimeInvalid && (
          <p className="text-sm text-destructive">
            종료 시간은 시작 시간보다 늦어야 합니다
          </p>
        )}

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
            disabled={isLoading || isTimeInvalid}
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

  // 모바일 감지
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 모바일: Sheet
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
        <SheetContent side="bottom" className="h-auto max-h-[90vh]">
          <SheetHeader>
            <SheetTitle>
              {isEditMode ? "고정 일정 수정" : "고정 일정 추가"}
            </SheetTitle>
            <SheetDescription>
              특정 시간에 반드시 방문해야 하는 일정을 설정하세요
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 pb-4">
            <FixedScheduleForm onCancel={onCancel} {...props} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // 데스크톱: Dialog
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-md">
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
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 추가 클래스 */
  className?: string;
}

export function FixedScheduleCard({
  schedule,
  placeName,
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
          {format(new Date(schedule.date), "M월 d일")} {schedule.startTime} -{" "}
          {schedule.endTime}
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
