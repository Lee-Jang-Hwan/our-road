// ============================================
// Route View State Management (Jotai)
// ============================================

import { atom } from 'jotai';

// Selected day filter (null = all days)
export const selectedDayAtom = atom<number | null>(null);

// Active tab in the info panel
export type RouteViewTab = 'details' | 'statistics' | 'settings';
export const activeTabAtom = atom<RouteViewTab>('details');

// Map center and zoom level
export interface MapView {
  center: { lat: number; lng: number };
  level: number; // Kakao Map zoom level (1-14)
}

export const mapViewAtom = atom<MapView>({
  center: { lat: 37.5665, lng: 126.978 }, // Default: Seoul City Hall
  level: 7,
});

// Selected waypoint ID (for highlighting)
export const selectedWaypointAtom = atom<string | null>(null);

// Animation state
export const isAnimatingAtom = atom<boolean>(false);
