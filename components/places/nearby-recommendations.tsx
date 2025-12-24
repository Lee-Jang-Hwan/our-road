"use client";

import * as React from "react";
import {
  Utensils,
  Coffee,
  Camera,
  ShoppingBag,
  Loader2,
  MapPin,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaceCardCompact } from "./place-card";
import type { Place, Coordinate, PlaceCategory } from "@/types/place";

// 카테고리 정의
interface CategoryOption {
  value: PlaceCategory;
  label: string;
  icon: React.ReactNode;
  kakaoCode: string; // Kakao API 카테고리 코드
}

const categories: CategoryOption[] = [
  {
    value: "restaurant",
    label: "음식점",
    icon: <Utensils className="h-4 w-4" />,
    kakaoCode: "FD6",
  },
  {
    value: "cafe",
    label: "카페",
    icon: <Coffee className="h-4 w-4" />,
    kakaoCode: "CE7",
  },
  {
    value: "tourist_attraction",
    label: "관광명소",
    icon: <Camera className="h-4 w-4" />,
    kakaoCode: "AT4",
  },
  {
    value: "shopping",
    label: "쇼핑",
    icon: <ShoppingBag className="h-4 w-4" />,
    kakaoCode: "MT1",
  },
];

// 반경 옵션 (미터)
const radiusOptions = [500, 750, 1000];

interface NearbyRecommendationsProps {
  /** 모달 열림 상태 */
  open: boolean;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 기준 좌표 */
  coordinate: Coordinate;
  /** 장소 추가 핸들러 */
  onAddPlace: (place: Place) => void;
  /** 이미 추가된 장소 ID 목록 */
  addedPlaceIds?: string[];
  /** 추가 클래스 */
  className?: string;
}

export function NearbyRecommendations({
  open,
  onClose,
  coordinate,
  onAddPlace,
  addedPlaceIds = [],
  className,
}: NearbyRecommendationsProps) {
  const [selectedCategory, setSelectedCategory] =
    React.useState<PlaceCategory>("restaurant");
  const [radius, setRadius] = React.useState(500);
  const [places, setPlaces] = React.useState<Place[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // 카테고리 또는 반경 변경 시 검색
  React.useEffect(() => {
    if (!open) return;

    const fetchNearbyPlaces = async () => {
      setIsLoading(true);
      try {
        const category = categories.find((c) => c.value === selectedCategory);
        if (!category) return;

        // TODO: Server Action 연동 (actions/places/get-nearby.ts)
        const response = await fetch(
          `/api/places/nearby?lat=${coordinate.lat}&lng=${coordinate.lng}&radius=${radius}&category=${category.kakaoCode}`
        );

        if (response.ok) {
          const data = await response.json();
          setPlaces(data.results || []);
        } else {
          setPlaces([]);
        }
      } catch (error) {
        console.error("주변 장소 검색 실패:", error);
        setPlaces([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNearbyPlaces();
  }, [open, selectedCategory, radius, coordinate]);

  // 장소 추가 핸들러
  const handleAddPlace = (place: Place) => {
    onAddPlace(place);
  };

  // 이미 추가된 장소인지 확인
  const isPlaceAdded = (placeId: string) => addedPlaceIds.includes(placeId);

  // 모바일에서는 Sheet, 데스크톱에서는 Dialog 사용
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  const content = (
    <div className="space-y-4">
      {/* 카테고리 탭 */}
      <Tabs
        value={selectedCategory}
        onValueChange={(v) => setSelectedCategory(v as PlaceCategory)}
      >
        <TabsList className="w-full grid grid-cols-4">
          {categories.map((category) => (
            <TabsTrigger
              key={category.value}
              value={category.value}
              className="gap-1.5 text-xs"
            >
              {category.icon}
              <span className="hidden sm:inline">{category.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 반경 슬라이더 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">검색 반경</span>
          <Badge variant="secondary">{radius}m</Badge>
        </div>
        <Slider
          value={[radius]}
          onValueChange={(values) => setRadius(values[0])}
          min={500}
          max={1000}
          step={250}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>500m</span>
          <span>750m</span>
          <span>1km</span>
        </div>
      </div>

      {/* 검색 결과 */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          // 로딩 스켈레톤
          [...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : places.length === 0 ? (
          // 빈 상태
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              주변에 {categories.find((c) => c.value === selectedCategory)?.label}이(가) 없습니다
            </p>
          </div>
        ) : (
          // 결과 목록
          places.map((place) => (
            <PlaceCardCompact
              key={place.id}
              place={place}
              showAddButton={!isPlaceAdded(place.id)}
              onAdd={() => handleAddPlace(place)}
            />
          ))
        )}
      </div>

      {/* 결과 수 */}
      {!isLoading && places.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {places.length}개의 장소를 찾았습니다
        </p>
      )}
    </div>
  );

  // 모바일: Sheet (하단에서 올라옴)
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent side="bottom" className={cn("h-[80vh]", className)}>
          <SheetHeader className="text-left">
            <SheetTitle>주변 추천</SheetTitle>
            <SheetDescription>
              현재 위치 주변의 장소를 탐색하세요
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  // 데스크톱: Dialog
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className={cn("max-w-md", className)}>
        <DialogHeader>
          <DialogTitle>주변 추천</DialogTitle>
          <DialogDescription>
            현재 위치 주변의 장소를 탐색하세요
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

interface NearbyButtonProps {
  /** 클릭 핸들러 */
  onClick: () => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export function NearbyButton({
  onClick,
  disabled = false,
  className,
}: NearbyButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn("gap-2", className)}
    >
      <MapPin className="h-4 w-4" />
      주변 추천
    </Button>
  );
}
