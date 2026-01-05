"use client";

import * as React from "react";
import { MapPin, Navigation, Loader2, X, Clock, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TripLocation } from "@/types/trip";
import type { PlaceSearchResult } from "@/types/place";
import { generateTimeOptions } from "@/lib/schemas";
import { searchPlaces } from "@/actions/places";

interface LocationInputProps {
  /** 선택된 위치 */
  value?: TripLocation;
  /** 위치 변경 핸들러 */
  onChange: (location: TripLocation | undefined) => void;
  /** 플레이스홀더 */
  placeholder?: string;
  /** 레이블 */
  label?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 시간 선택 표시 여부 */
  showTimeSelect?: boolean;
  /** 선택된 시간 */
  time?: string;
  /** 시간 변경 핸들러 */
  onTimeChange?: (time: string) => void;
  /** 시간 레이블 */
  timeLabel?: string;
  /** 기본 시간 */
  defaultTime?: string;
  /** 추가 클래스 */
  className?: string;
}

// 시간 옵션 생성 (06:00 ~ 23:30)
const timeOptions = generateTimeOptions(6, 24);

export function LocationInput({
  value,
  onChange,
  placeholder = "장소 검색",
  label,
  disabled = false,
  showTimeSelect = false,
  time,
  onTimeChange,
  timeLabel = "시간",
  defaultTime = "10:00",
  className,
}: LocationInputProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isGettingLocation, setIsGettingLocation] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 검색 실행 함수
  const handleSearch = React.useCallback(async () => {
    if (query.length < 2) {
      setError("2글자 이상 입력해주세요");
      return;
    }

    setIsSearching(true);
    setError(null);
    setOpen(true);

    try {
      const result = await searchPlaces({ query, page: 1, size: 10 });
      if (result.success && result.data) {
        setResults(result.data.places);
      } else {
        setResults([]);
        if (result.error) {
          setError(result.error);
        }
      }
    } catch (err) {
      console.error("장소 검색 실패:", err);
      setResults([]);
      setError("검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  // Enter 키 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  // 현재 위치 가져오기
  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 위치 서비스를 지원하지 않습니다.");
      return;
    }

    setIsGettingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        }
      );

      const { latitude, longitude } = position.coords;

      // TODO: 좌표 → 주소 변환 (Kakao API 사용)
      // 임시로 좌표 기반 위치 설정
      onChange({
        name: "현재 위치",
        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        lat: latitude,
        lng: longitude,
      });
    } catch (error) {
      console.error("위치 가져오기 실패:", error);
      alert("현재 위치를 가져올 수 없습니다. 위치 권한을 확인해주세요.");
    } finally {
      setIsGettingLocation(false);
    }
  };

  // 검색 결과 선택
  const handleSelect = (result: PlaceSearchResult) => {
    onChange({
      name: result.name,
      address: result.roadAddress || result.address,
      lat: result.coordinate.lat,
      lng: result.coordinate.lng,
    });
    setOpen(false);
    setQuery("");
    setResults([]);
    setError(null);
  };

  // 선택 초기화
  const handleClear = () => {
    onChange(undefined);
    setQuery("");
    setResults([]);
    setError(null);
    // 검색 입력 모드로 유지하여 사용자가 바로 다시 검색할 수 있도록 함
    // value가 undefined가 되면 자동으로 검색 입력 UI가 표시됨
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}

      <div className="flex gap-2">
        {/* 장소 검색 - 선택된 위치 표시 또는 검색 입력 */}
        {value && !open ? (
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => setOpen(true)}
            className={cn(
              "flex-1 justify-start text-left font-normal touch-target"
            )}
          >
            <MapPin className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{value.name}</span>
            <X
              className="ml-auto h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          </Button>
        ) : (
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="pl-10 pr-10 touch-target"
              />
              {query && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X
                    className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={handleClear}
                  />
                </div>
              )}
            </div>
            <Button
              type="button"
              size="icon"
              onClick={handleSearch}
              disabled={disabled || isSearching || query.length < 2}
              className="shrink-0 touch-target"
              title="검색"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        {/* 현재 위치 버튼 */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || isGettingLocation}
          onClick={handleGetCurrentLocation}
          className="touch-target shrink-0"
          title="현재 위치"
        >
          {isGettingLocation ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 검색 결과 - 인라인으로 표시 (모바일 친화적) */}
      {open && (
        <div className="rounded-md border bg-popover shadow-md max-h-[40vh] overflow-auto">
          <Command shouldFilter={false}>
            <CommandList className="max-h-none">
              {isSearching ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  검색 중...
                </div>
              ) : error ? (
                <div className="py-6 text-center text-sm text-destructive">
                  {error}
                </div>
              ) : results.length === 0 ? (
                <CommandEmpty className="py-6 text-center text-sm">
                  검색 결과가 없습니다
                </CommandEmpty>
              ) : (
                <CommandGroup heading={`검색 결과 (${results.length}건)`}>
                  {results.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result)}
                      className="cursor-pointer py-3"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{result.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {result.roadAddress || result.address}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}

      {/* 선택된 위치 주소 표시 */}
      {value && (
        <p className="text-xs text-muted-foreground truncate pl-1">
          {value.address}
        </p>
      )}

      {/* 시간 선택 */}
      {showTimeSelect && (
        <div className="flex items-center gap-2 pt-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{timeLabel}</span>
          <Select
            value={time || defaultTime}
            onValueChange={onTimeChange}
            disabled={disabled}
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
      )}
    </div>
  );
}

interface LocationPairInputProps {
  /** 출발지 */
  origin?: TripLocation;
  /** 도착지 */
  destination?: TripLocation;
  /** 출발지 변경 핸들러 */
  onOriginChange: (location: TripLocation | undefined) => void;
  /** 도착지 변경 핸들러 */
  onDestinationChange: (location: TripLocation | undefined) => void;
  /** 시작 시간 */
  startTime?: string;
  /** 종료 시간 */
  endTime?: string;
  /** 시작 시간 변경 핸들러 */
  onStartTimeChange?: (time: string) => void;
  /** 종료 시간 변경 핸들러 */
  onEndTimeChange?: (time: string) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export function LocationPairInput({
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  startTime = "10:00",
  endTime = "22:00",
  onStartTimeChange,
  onEndTimeChange,
  disabled = false,
  className,
}: LocationPairInputProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <LocationInput
        value={origin}
        onChange={onOriginChange}
        label="출발지"
        placeholder="출발지 검색"
        disabled={disabled}
        showTimeSelect={!!onStartTimeChange}
        time={startTime}
        onTimeChange={onStartTimeChange}
        timeLabel="일과 시작"
        defaultTime="10:00"
      />

      <LocationInput
        value={destination}
        onChange={onDestinationChange}
        label="도착지"
        placeholder="도착지 검색"
        disabled={disabled}
        showTimeSelect={!!onEndTimeChange}
        time={endTime}
        onTimeChange={onEndTimeChange}
        timeLabel="일과 종료"
        defaultTime="22:00"
      />
    </div>
  );
}
