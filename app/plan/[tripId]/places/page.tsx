"use client";

import { use, useState } from "react";
import Link from "next/link";
import { LuChevronLeft, LuPlus } from "react-icons/lu";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { PlaceSearch } from "@/components/places/place-search";
import { PlaceList, PlaceListHeader } from "@/components/places/place-list";
import type { Place, PlaceSearchResult } from "@/types/place";

interface PlacesPageProps {
  params: Promise<{ tripId: string }>;
}

// 체류 시간 옵션 (분 단위)
const DURATION_OPTIONS = [
  { value: 30, label: "30분" },
  { value: 60, label: "1시간" },
  { value: 90, label: "1시간 30분" },
  { value: 120, label: "2시간" },
  { value: 180, label: "3시간" },
  { value: 240, label: "4시간" },
  { value: 360, label: "6시간" },
  { value: 480, label: "8시간" },
  { value: 720, label: "12시간" },
];

export default function PlacesPage({ params }: PlacesPageProps) {
  const { tripId } = use(params);
  const [places, setPlaces] = useState<Place[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // 장소 검색 결과 선택
  const handlePlaceSelect = (result: PlaceSearchResult) => {
    const newPlace: Place = {
      id: result.id,
      name: result.name,
      address: result.roadAddress || result.address,
      coordinate: result.coordinate,
      category: undefined,
      kakaoPlaceId: result.id,
      estimatedDuration: 60, // 기본 1시간
    };

    setPlaces((prev) => [...prev, newPlace]);
    setIsSearchOpen(false);
  };

  // 체류 시간 변경
  const handleDurationChange = (placeId: string, duration: number) => {
    setPlaces((prev) =>
      prev.map((place) =>
        place.id === placeId ? { ...place, estimatedDuration: duration } : place
      )
    );
  };

  // 장소 삭제
  const handleDelete = (placeId: string) => {
    setPlaces((prev) => prev.filter((place) => place.id !== placeId));
  };

  // 순서 변경
  const handleReorder = (placeIds: string[]) => {
    const reordered = placeIds
      .map((id) => places.find((p) => p.id === id))
      .filter((p): p is Place => p !== undefined);
    setPlaces(reordered);
  };

  // 전체 삭제
  const handleClearAll = () => {
    if (confirm("모든 장소를 삭제하시겠습니까?")) {
      setPlaces([]);
    }
  };

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <Link href={`/plan/${tripId}`}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <LuChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="font-semibold text-lg flex-1">장소 관리</h1>
        <Button
          size="sm"
          onClick={() => setIsSearchOpen(true)}
        >
          <LuPlus className="w-4 h-4 mr-1" />
          추가
        </Button>
      </header>

      {/* 장소 목록 */}
      <div className="flex-1 px-4 py-4">
        <PlaceListHeader
          count={places.length}
          onClearAll={places.length > 0 ? handleClearAll : undefined}
        />

        <PlaceList
          places={places}
          onDurationChange={handleDurationChange}
          onDelete={handleDelete}
          onReorder={handleReorder}
          onAddClick={() => setIsSearchOpen(true)}
          emptyMessage="방문하고 싶은 장소를 추가해보세요"
        />
      </div>

      {/* 하단 버튼 */}
      {places.length > 0 && (
        <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
          <Link href={`/plan/${tripId}`}>
            <Button className="w-full h-12">
              {places.length}개 장소 저장하기
            </Button>
          </Link>
        </div>
      )}

      {/* 장소 검색 Sheet */}
      <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>장소 검색</SheetTitle>
            <SheetDescription>
              방문하고 싶은 장소를 검색해서 추가하세요
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            <PlaceSearch
              onSelect={handlePlaceSelect}
              placeholder="장소명 또는 주소로 검색"
              autoFocus
            />
          </div>

          {/* 체류 시간 안내 */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">체류 시간 설정</h4>
            <p className="text-xs text-muted-foreground">
              추가된 장소의 체류 시간은 목록에서 변경할 수 있습니다.
              <br />
              30분부터 12시간까지 설정 가능합니다.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {DURATION_OPTIONS.slice(0, 5).map((option) => (
                <span
                  key={option.value}
                  className="px-2 py-1 text-xs bg-background rounded border"
                >
                  {option.label}
                </span>
              ))}
              <span className="px-2 py-1 text-xs text-muted-foreground">
                ...
              </span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
