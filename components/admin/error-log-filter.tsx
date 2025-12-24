"use client";

import * as React from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon, Filter, RotateCcw, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import type { ErrorSeverity, ErrorLogFilter } from "@/types/admin";

// ============================================
// Types
// ============================================

interface ErrorLogFilterProps {
  /** 현재 필터 값 */
  value: ErrorLogFilter;
  /** 필터 변경 핸들러 */
  onChange: (filter: ErrorLogFilter) => void;
  /** 에러 코드 목록 (선택 옵션) */
  errorCodes?: string[];
  /** 발생 위치 목록 (선택 옵션) */
  sources?: string[];
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 클래스명 */
  className?: string;
}

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

// ============================================
// Constants
// ============================================

const SEVERITY_OPTIONS: { value: ErrorSeverity; label: string }[] = [
  { value: "info", label: "정보" },
  { value: "warning", label: "경고" },
  { value: "error", label: "에러" },
  { value: "critical", label: "치명적" },
];

const RESOLVED_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "unresolved", label: "미해결" },
  { value: "resolved", label: "해결됨" },
];

// ============================================
// Helper Components
// ============================================

/**
 * 필터 칩 컴포넌트
 */
function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <Badge
      variant="secondary"
      className="gap-1 pr-1"
    >
      {label}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
      >
        <X className="size-3" />
        <span className="sr-only">제거</span>
      </button>
    </Badge>
  );
}

/**
 * 날짜 범위 선택 컴포넌트
 */
function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: {
  startDate?: string;
  endDate?: string;
  onStartDateChange: (date?: string) => void;
  onEndDateChange: (date?: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium">기간</Label>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-32 justify-start text-left font-normal",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 size-4" />
              {startDate
                ? format(new Date(startDate), "yyyy.MM.dd", { locale: ko })
                : "시작일"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate ? new Date(startDate) : undefined}
              onSelect={(date) =>
                onStartDateChange(date ? format(date, "yyyy-MM-dd") : undefined)
              }
              locale={ko}
              disabled={(date) =>
                date > new Date() ||
                (endDate ? date > new Date(endDate) : false)
              }
            />
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground">~</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-32 justify-start text-left font-normal",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 size-4" />
              {endDate
                ? format(new Date(endDate), "yyyy.MM.dd", { locale: ko })
                : "종료일"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate ? new Date(endDate) : undefined}
              onSelect={(date) =>
                onEndDateChange(date ? format(date, "yyyy-MM-dd") : undefined)
              }
              locale={ko}
              disabled={(date) =>
                date > new Date() ||
                (startDate ? date < new Date(startDate) : false)
              }
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

/**
 * 에러 로그 필터 컴포넌트
 *
 * 에러 로그 목록 필터링을 위한 UI를 제공합니다.
 * 해결 상태, 심각도, 에러 코드, 발생 위치, 기간으로 필터링할 수 있습니다.
 *
 * @example
 * ```tsx
 * const [filter, setFilter] = useState<ErrorLogFilter>({});
 *
 * <ErrorLogFilter
 *   value={filter}
 *   onChange={setFilter}
 *   errorCodes={["ROUTE_NOT_FOUND", "API_RATE_LIMIT"]}
 *   sources={["api/odsay", "optimize/distance-matrix"]}
 * />
 * ```
 */
export function ErrorLogFilter({
  value,
  onChange,
  errorCodes = [],
  sources = [],
  isLoading = false,
  className,
}: ErrorLogFilterProps) {
  // 필터 값 업데이트 헬퍼
  const updateFilter = (updates: Partial<ErrorLogFilter>) => {
    onChange({ ...value, ...updates });
  };

  // 필터 초기화
  const resetFilter = () => {
    onChange({});
  };

  // 활성 필터 개수 계산
  const activeFilterCount = [
    value.resolved !== undefined,
    value.severity,
    value.errorCode,
    value.source,
    value.startDate,
    value.endDate,
  ].filter(Boolean).length;

  // 해결 상태 값 변환
  const resolvedValue =
    value.resolved === undefined
      ? "all"
      : value.resolved
      ? "resolved"
      : "unresolved";

  const handleResolvedChange = (val: string) => {
    if (val === "all") {
      updateFilter({ resolved: undefined });
    } else {
      updateFilter({ resolved: val === "resolved" });
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 데스크톱 필터 (인라인) */}
      <div className="hidden items-end gap-4 md:flex">
        {/* 해결 상태 */}
        <div className="grid gap-2">
          <Label className="text-sm font-medium">상태</Label>
          <Select
            value={resolvedValue}
            onValueChange={handleResolvedChange}
            disabled={isLoading}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              {RESOLVED_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 심각도 */}
        <div className="grid gap-2">
          <Label className="text-sm font-medium">심각도</Label>
          <Select
            value={value.severity || "all"}
            onValueChange={(val) =>
              updateFilter({
                severity: val === "all" ? undefined : (val as ErrorSeverity),
              })
            }
            disabled={isLoading}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="심각도" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {SEVERITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 에러 코드 */}
        {errorCodes.length > 0 && (
          <div className="grid gap-2">
            <Label className="text-sm font-medium">에러 코드</Label>
            <Select
              value={value.errorCode || "all"}
              onValueChange={(val) =>
                updateFilter({
                  errorCode: val === "all" ? undefined : val,
                })
              }
              disabled={isLoading}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="에러 코드" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {errorCodes.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 발생 위치 */}
        {sources.length > 0 && (
          <div className="grid gap-2">
            <Label className="text-sm font-medium">발생 위치</Label>
            <Select
              value={value.source || "all"}
              onValueChange={(val) =>
                updateFilter({
                  source: val === "all" ? undefined : val,
                })
              }
              disabled={isLoading}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="발생 위치" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 기간 */}
        <DateRangeFilter
          startDate={value.startDate}
          endDate={value.endDate}
          onStartDateChange={(date) => updateFilter({ startDate: date })}
          onEndDateChange={(date) => updateFilter({ endDate: date })}
        />

        {/* 초기화 버튼 */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilter}
            disabled={isLoading}
          >
            <RotateCcw className="mr-1 size-4" />
            초기화
          </Button>
        )}
      </div>

      {/* 모바일 필터 (시트) */}
      <div className="flex items-center gap-2 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="relative">
              <Filter className="mr-2 size-4" />
              필터
              {activeFilterCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-2 size-5 justify-center rounded-full p-0 text-xs"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle>필터</SheetTitle>
              <SheetDescription>
                에러 로그를 필터링할 조건을 선택하세요.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              {/* 해결 상태 */}
              <div className="grid gap-2">
                <Label className="text-sm font-medium">상태</Label>
                <Select
                  value={resolvedValue}
                  onValueChange={handleResolvedChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOLVED_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 심각도 */}
              <div className="grid gap-2">
                <Label className="text-sm font-medium">심각도</Label>
                <Select
                  value={value.severity || "all"}
                  onValueChange={(val) =>
                    updateFilter({
                      severity:
                        val === "all" ? undefined : (val as ErrorSeverity),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="심각도 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {SEVERITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 에러 코드 */}
              {errorCodes.length > 0 && (
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">에러 코드</Label>
                  <Select
                    value={value.errorCode || "all"}
                    onValueChange={(val) =>
                      updateFilter({
                        errorCode: val === "all" ? undefined : val,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="에러 코드 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {errorCodes.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 발생 위치 */}
              {sources.length > 0 && (
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">발생 위치</Label>
                  <Select
                    value={value.source || "all"}
                    onValueChange={(val) =>
                      updateFilter({
                        source: val === "all" ? undefined : val,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="발생 위치 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {sources.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 기간 */}
              <DateRangeFilter
                startDate={value.startDate}
                endDate={value.endDate}
                onStartDateChange={(date) => updateFilter({ startDate: date })}
                onEndDateChange={(date) => updateFilter({ endDate: date })}
              />
            </div>
            <SheetFooter className="mt-6">
              <Button variant="outline" onClick={resetFilter} className="flex-1">
                <RotateCcw className="mr-2 size-4" />
                초기화
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* 빠른 필터 - 미해결만 보기 */}
        <Button
          variant={value.resolved === false ? "default" : "outline"}
          size="sm"
          onClick={() =>
            updateFilter({
              resolved: value.resolved === false ? undefined : false,
            })
          }
        >
          미해결만
        </Button>
      </div>

      {/* 활성 필터 칩 */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.resolved !== undefined && (
            <FilterChip
              label={value.resolved ? "해결됨" : "미해결"}
              onRemove={() => updateFilter({ resolved: undefined })}
            />
          )}
          {value.severity && (
            <FilterChip
              label={
                SEVERITY_OPTIONS.find((o) => o.value === value.severity)?.label ||
                value.severity
              }
              onRemove={() => updateFilter({ severity: undefined })}
            />
          )}
          {value.errorCode && (
            <FilterChip
              label={value.errorCode}
              onRemove={() => updateFilter({ errorCode: undefined })}
            />
          )}
          {value.source && (
            <FilterChip
              label={value.source}
              onRemove={() => updateFilter({ source: undefined })}
            />
          )}
          {(value.startDate || value.endDate) && (
            <FilterChip
              label={`${value.startDate || "..."} ~ ${value.endDate || "..."}`}
              onRemove={() =>
                updateFilter({ startDate: undefined, endDate: undefined })
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 간단한 검색 필터 컴포넌트
 */
export function ErrorLogSearchFilter({
  value,
  onChange,
  placeholder = "에러 코드 또는 메시지 검색...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

// Export helper components
export { FilterChip, DateRangeFilter };
