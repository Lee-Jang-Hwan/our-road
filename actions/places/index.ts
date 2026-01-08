// ============================================
// Place Server Actions - 공용 Export
// ============================================

// Create
export { addPlace } from "./add-place";
export type { AddPlaceResult } from "./add-place";

// Read (List)
export { getPlaces, getPlace, getPlaceCount } from "./get-places";
export type { GetPlacesResult, GetPlaceResult } from "./get-places";

// Update
export { updatePlace, updatePlaceDuration } from "./update-place";
export type { UpdatePlaceResult } from "./update-place";

// Delete
export { removePlace, removePlaces } from "./remove-place";
export type { RemovePlaceResult } from "./remove-place";

// Reorder
export { reorderPlaces, movePlaceToIndex } from "./reorder-places";
export type { ReorderPlacesResult } from "./reorder-places";

// Search (Kakao API)
export { searchPlaces, autocompletePlace } from "./search-places";
export type { SearchPlacesResult } from "./search-places";

// Search Locations (Kakao API - 장소 + 주소 통합 검색)
export { searchLocations, autocompleteLocation } from "./search-locations";
export type {
  SearchLocationsResult,
  LocationSearchResult,
} from "./search-locations";

// Nearby (Kakao Category Search)
export { getNearby, getNearbyMultiCategory } from "./get-nearby";
export type { GetNearbyResult } from "./get-nearby";
