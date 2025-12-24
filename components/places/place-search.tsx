"use client";

import * as React from "react";
import { Search, Loader2, MapPin, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchPlaces } from "@/actions/places/search-places";
import type { PlaceSearchResult } from "@/types/place";

interface PlaceSearchProps {
  /** 검색 결과 선택 핸들러 */
  onSelect: (place: PlaceSearchResult) => void;
  /** 플레이스홀더 */
  placeholder?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 자동 포커스 */
  autoFocus?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export function PlaceSearch({
  onSelect,
  placeholder = "장소명 또는 주소로 검색",
  disabled = false,
  autoFocus = false,
  className,
}: PlaceSearchProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // 검색 디바운스 처리 (300ms) - Server Action 사용
  React.useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        // Server Action 호출
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
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // 검색 결과 선택
  const handleSelect = (result: PlaceSearchResult) => {
    onSelect(result);
    setQuery("");
    setResults([]);
  };

  // 검색어 초기화
  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError(null);
    inputRef.current?.focus();
  };

  const showResults = query.length >= 2;

  return (
    <div className={cn("relative flex flex-col", className)}>
      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className="pl-10 pr-10 touch-target"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={handleClear}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* 검색 결과 - 인라인으로 표시 (모바일 친화적) */}
      {showResults && (
        <div className="mt-2 rounded-md border bg-popover shadow-md max-h-[50vh] overflow-auto">
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
                      className="cursor-pointer py-3 px-3"
                    >
                      <MapPin className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium truncate">
                          {result.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {result.roadAddress || result.address}
                        </span>
                        {result.category && (
                          <span className="text-xs text-primary/70 mt-0.5">
                            {result.category}
                          </span>
                        )}
                      </div>
                      {result.distance && (
                        <span className="ml-2 text-xs text-muted-foreground shrink-0">
                          {result.distance >= 1000
                            ? `${(result.distance / 1000).toFixed(1)}km`
                            : `${result.distance}m`}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}

      {/* 검색 안내 */}
      {!showResults && !query && (
        <p className="mt-2 text-xs text-muted-foreground">
          2글자 이상 입력하면 검색됩니다
        </p>
      )}
    </div>
  );
}

interface PlaceSearchInputProps {
  /** 검색어 */
  value: string;
  /** 검색어 변경 핸들러 */
  onChange: (value: string) => void;
  /** 검색 실행 핸들러 */
  onSearch?: () => void;
  /** 플레이스홀더 */
  placeholder?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export function PlaceSearchInput({
  value,
  onChange,
  onSearch,
  placeholder = "장소 검색",
  disabled = false,
  isLoading = false,
  className,
}: PlaceSearchInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onSearch) {
      e.preventDefault();
      onSearch();
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-10 pr-10 touch-target"
      />
      {isLoading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
