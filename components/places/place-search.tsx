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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // 검색 디바운스 처리 (300ms)
  React.useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        // TODO: Server Action 연동 (actions/places/search-places.ts)
        const response = await fetch(
          `/api/places/search?query=${encodeURIComponent(query)}`
        );
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error("장소 검색 실패:", error);
        setResults([]);
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
    setOpen(false);
  };

  // 검색어 초기화
  const handleClear = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={open && query.length >= 2} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
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
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              <CommandEmpty>
                {isSearching
                  ? "검색 중..."
                  : query.length < 2
                    ? "2글자 이상 입력해주세요"
                    : "검색 결과가 없습니다"}
              </CommandEmpty>
              {results.length > 0 && (
                <CommandGroup heading="검색 결과">
                  {results.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result)}
                      className="cursor-pointer py-3"
                    >
                      <MapPin className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
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
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
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
        </PopoverContent>
      </Popover>
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
