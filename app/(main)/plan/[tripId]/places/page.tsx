"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { LuChevronLeft, LuPlus } from "react-icons/lu";
import { X } from "lucide-react";

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
import { useTripDraft } from "@/hooks/use-trip-draft";
import { useSafeBack } from "@/hooks/use-safe-back";
import {
  addPlace,
  removePlace,
  removePlaces,
  updatePlaceDuration,
  getPlaces,
  reorderPlaces,
} from "@/actions/places";
import { updateTrip } from "@/actions/trips/update-trip";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import type { Place, PlaceSearchResult } from "@/types/place";

interface PlacesPageProps {
  params: Promise<{ tripId: string }>;
}

export default function PlacesPage({ params }: PlacesPageProps) {
  const { tripId } = use(params);
  const { getDraftByTripId, savePlaces, isLoaded } = useTripDraft();
  const handleBack = useSafeBack(`/plan/${tripId}`);
  const [places, setPlaces] = useState<Place[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const placesListScrollRef = useRef<HTMLDivElement>(null);

  // DB?먯꽌 ?μ냼 濡쒕뱶
  const loadPlacesFromDB = useCallback(async () => {
    try {
      const result = await getPlaces(tripId);
      if (result.success && result.data) {
        setPlaces(result.data);
        savePlaces(result.data);
      }
    } catch (error) {
      console.error("?μ냼 濡쒕뱶 ?ㅽ뙣:", error);
    }
  }, [tripId, savePlaces]);

  // ????꾨즺 泥섎━
  const handleSaveComplete = async () => {
    try {
      await updateTrip(tripId, { status: "optimizing" });
      window.location.href = `/plan/${tripId}`;
    } catch (error) {
      console.error("????꾨즺 泥섎━ ?ㅽ뙣:", error);
      showErrorToast("오류가 발생했습니다.");
    }
  };
  // Initial load: fetch places from DB first
  useEffect(() => {
    if (!isLoaded || isInitialized) return;

    const init = async () => {
      // 癒쇱? DB?먯꽌 濡쒕뱶 ?쒕룄
      const result = await getPlaces(tripId);
      if (result.success && result.data && result.data.length > 0) {
        setPlaces(result.data);
        savePlaces(result.data);
      } else {
        // DB???놁쑝硫?sessionStorage?먯꽌 濡쒕뱶
        const draft = getDraftByTripId(tripId);
        if (draft?.places) {
          setPlaces(draft.places);
        }
      }
      setIsInitialized(true);
    };

    init();
  }, [tripId, getDraftByTripId, isLoaded, isInitialized, savePlaces]);
  // Place select handler
  const handlePlaceSelect = async (result: PlaceSearchResult) => {
    setIsLoading(true);
    try {
      const addResult = await addPlace({
        tripId,
        name: result.name,
        address: result.roadAddress || result.address,
        lat: result.coordinate.lat,
        lng: result.coordinate.lng,
        kakaoPlaceId: result.id,
        estimatedDuration: 60, // 湲곕낯 1?쒓컙
      });

      if (!addResult.success || !addResult.data) {
        showErrorToast(addResult.error || "장소 추가에 실패했습니다.");
        return;
      }

      // ?깃났 ??濡쒖뺄 ?곹깭 ?낅뜲?댄듃
      setPlaces((prev) => [...prev, addResult.data!]);
      savePlaces([...places, addResult.data]);
      // Sheet瑜??レ? ?딄퀬 怨꾩냽 ?댁뼱??(?곗냽 異붽? 媛??
      showSuccessToast(`'${result.name}' 장소가 추가되었습니다`);

      // ?μ냼 紐⑸줉 ?ㅽ겕濡ㅼ쓣 留??꾨옒濡??대룞
      setTimeout(() => {
        if (placesListScrollRef.current) {
          placesListScrollRef.current.scrollTop =
            placesListScrollRef.current.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error("?μ냼 異붽? ?ㅽ뙣:", error);
      showErrorToast("장소 추가에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };
  // Duration change handler
  const handleDurationChange = async (placeId: string, duration: number) => {
    // 利됱떆 UI ?낅뜲?댄듃
    setPlaces((prev) =>
      prev.map((place) =>
        place.id === placeId
          ? { ...place, estimatedDuration: duration }
          : place,
      ),
    );

    try {
      const result = await updatePlaceDuration(placeId, tripId, duration);
      if (!result.success) {
        showErrorToast(result.error || "체류 시간 변경에 실패했습니다.");
        // ?ㅽ뙣 ??濡ㅻ갚 (DB?먯꽌 ?ㅼ떆 濡쒕뱶)
        await loadPlacesFromDB();
      }
    } catch (error) {
      console.error("泥대쪟 ?쒓컙 蹂寃??ㅽ뙣:", error);
    }
  };

  // ?μ냼 ??젣 ??DB?먯꽌 ??젣
  const handleDelete = async (placeId: string) => {
    // 利됱떆 UI ?낅뜲?댄듃
    const prevPlaces = places;
    setPlaces((prev) => prev.filter((place) => place.id !== placeId));

    try {
      const result = await removePlace(placeId, tripId);
      if (!result.success) {
        showErrorToast(result.error || "장소 삭제에 실패했습니다.");
        // ?ㅽ뙣 ??濡ㅻ갚
        setPlaces(prevPlaces);
      }
    } catch (error) {
      console.error("?μ냼 ??젣 ?ㅽ뙣:", error);
      setPlaces(prevPlaces);
    }
  };
  // Reorder handler
  const handleReorder = async (placeIds: string[]) => {
    const reordered = placeIds
      .map((id) => places.find((p) => p.id === id))
      .filter((p): p is Place => p !== undefined);

    // 利됱떆 UI ?낅뜲?댄듃
    const prevPlaces = places;
    setPlaces(reordered);

    try {
      const result = await reorderPlaces({ tripId, placeIds });
      if (!result.success) {
        showErrorToast(result.error || "순서 변경에 실패했습니다.");
        // ?ㅽ뙣 ??濡ㅻ갚
        setPlaces(prevPlaces);
      }
    } catch (error) {
      console.error("?쒖꽌 蹂寃??ㅽ뙣:", error);
      setPlaces(prevPlaces);
    }
  };

  // ?꾩껜 ??젣 ??DB?먯꽌 ??젣
  const handleClearAll = async () => {
    if (!confirm("모든 장소를 삭제하시겠습니까?")) return;

    const prevPlaces = places;
    const placeIds = places.map((p) => p.id);

    // 利됱떆 UI ?낅뜲?댄듃
    setPlaces([]);

    try {
      const result = await removePlaces(placeIds, tripId);
      if (!result.success) {
        showErrorToast(result.error || "장소 삭제에 실패했습니다.");
        setPlaces(prevPlaces);
      } else {
        showSuccessToast("모든 장소가 삭제되었습니다.");
      }
    } catch (error) {
      console.error("?꾩껜 ??젣 ?ㅽ뙣:", error);
      setPlaces(prevPlaces);
    }
  };

  return (
    <main className="flex flex-col pb-10 min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-1 border-b">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleBack}
        >
          <LuChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-semibold text-lg flex-1">장소</h1>
        <Button
          size="sm"
          onClick={() => setIsSearchOpen(true)}
          disabled={isLoading}
        >
          <LuPlus className="w-4 h-4 mr-1" />
          추가
        </Button>
      </header>

      {/* ?μ냼 紐⑸줉 */}
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
          emptyMessage="아직 추가된 장소가 없습니다. 장소를 추가해주세요"
        />
      </div>

      {/* ?섎떒 踰꾪듉 */}
      {places.length > 0 && (
        <div className="sticky bottom-0 p-4 backdrop-blur-sm bg-background/80 border-t pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:static md:border-t-0 md:pt-4 md:pb-0">
          <Button className="w-full h-12" onClick={handleSaveComplete}>
            저장
          </Button>
        </div>
      )}

      {/* ?μ냼 寃??Sheet */}
      <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <SheetContent
          side="bottom"
          className="h-[80vh] flex flex-col max-w-md mx-auto px-8"
        >
                    <SheetHeader>
            <SheetTitle>장소 검색</SheetTitle>
            <SheetDescription>
              여행에 추가할 장소를 검색하세요.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 shrink-0">
            <PlaceSearch
              onSelect={handlePlaceSelect}
              placeholder="장소명 또는 주소로 검색"
              autoFocus
            />
          </div>

          {/* 異붽????μ냼 紐⑸줉 */}
          {places.length > 0 && (
            <div className="mt-6 flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3 shrink-0">
                                <h4 className="font-medium text-sm">선택된 장소 ({places.length}개)</h4>
              </div>
              <div
                ref={placesListScrollRef}
                className="flex-1 overflow-y-auto space-y-2 pr-2"
              >
                {places.map((place, index) => (
                  <div
                    key={place.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground shrink-0 w-6">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {place.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {place.address}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(place.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ?섎떒 ???踰꾪듉 */}
          {places.length > 0 && (
                        <div className="sticky bottom-0 mt-4 p-4 backdrop-blur-sm bg-background/80 border-t shrink-0">
              <Button
                className="w-full h-12"
                onClick={() => {
                  setIsSearchOpen(false);
                }}
              >
                완료
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}










