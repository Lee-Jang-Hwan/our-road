'use client';

// ============================================
// Route Map Component (Kakao Maps)
// ============================================

import { useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import type { TripOutput, LatLng as AppLatLng } from '@/types';
import { mapViewAtom, selectedDayAtom, selectedWaypointAtom } from '@/lib/states/route-view-atoms';
import { getDayColor, MARKER_COLORS } from '@/lib/utils/route-colors';

interface RouteMapProps {
  tripOutput: TripOutput;
}

export default function RouteMap({ tripOutput }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [mapView, setMapView] = useAtom(mapViewAtom);
  const [selectedDay] = useAtom(selectedDayAtom);
  const [selectedWaypoint] = useAtom(selectedWaypointAtom);

  // Load Kakao Maps SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const script = document.querySelector('script[src*="dapi.kakao.com"]');
    if (!script) {
      console.error('Kakao Maps script not found');
      return;
    }

    const loadMap = () => {
      if (!window.kakao || !window.kakao.maps) {
        console.error('Kakao Maps SDK not loaded');
        return;
      }

      window.kakao.maps.load(() => {
        setIsLoaded(true);
      });
    };

    if (window.kakao && window.kakao.maps) {
      loadMap();
    } else {
      script.addEventListener('load', loadMap);
      return () => script.removeEventListener('load', loadMap);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return;

    const center = new window.kakao.maps.LatLng(
      mapView.center.lat,
      mapView.center.lng
    );

    const mapInstance = new window.kakao.maps.Map(mapRef.current, {
      center,
      level: mapView.level,
    });

    setMap(mapInstance);
  }, [isLoaded, map, mapView]);

  // Render markers and polylines
  useEffect(() => {
    if (!map || !tripOutput) return;

    const markers: Marker[] = [];
    const polylines: Polyline[] = [];

    // Get all waypoints
    const waypointMap = new Map<string, AppLatLng>();
    tripOutput.dayPlans.forEach((day) => {
      day.waypointOrder.forEach((wpId) => {
        // Find waypoint in original input (would need to be passed as prop)
        // For now, skip implementation
      });
    });

    // Draw polylines for each day
    tripOutput.dayPlans.forEach((dayPlan, dayIndex) => {
      if (selectedDay !== null && selectedDay !== dayPlan.dayIndex) {
        return; // Skip if day filter is active and doesn't match
      }

      const dayColor = getDayColor(dayIndex);

      // Find segments for this day
      const daySegments = tripOutput.segmentCosts.filter((segment) => {
        // Match segments to day (would need better matching logic)
        return dayPlan.waypointOrder.includes(segment.key.fromId) ||
               dayPlan.waypointOrder.includes(segment.key.toId);
      });

      // Draw polylines
      daySegments.forEach((segment) => {
        if (segment.polyline && segment.polyline.length > 0) {
          const path = segment.polyline.map(
            (coord) => new window.kakao.maps.LatLng(coord.lat, coord.lng)
          );

          const polyline = new window.kakao.maps.Polyline({
            path,
            strokeWeight: 5,
            strokeColor: dayColor.primary,
            strokeOpacity: 0.7,
            strokeStyle: 'solid',
            zIndex: 1,
          });

          polyline.setMap(map);
          polylines.push(polyline);
        }
      });
    });

    // Cleanup
    return () => {
      markers.forEach((marker) => marker.setMap(null));
      polylines.forEach((polyline) => polyline.setMap(null));
    };
  }, [map, tripOutput, selectedDay]);

  // Auto-fit bounds
  useEffect(() => {
    if (!map || !tripOutput) return;

    const bounds = new window.kakao.maps.LatLngBounds();
    let hasPoints = false;

    tripOutput.clusters.forEach((cluster) => {
      bounds.extend(
        new window.kakao.maps.LatLng(cluster.centroid.lat, cluster.centroid.lng)
      );
      hasPoints = true;
    });

    if (hasPoints) {
      map.setBounds(bounds, 50, 50, 50, 50); // 50px padding
    }
  }, [map, tripOutput]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <p className="text-gray-500">지도를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg" />

      {/* Day filter controls */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2 space-y-2">
        <button
          onClick={() => setMapView({ ...mapView, level: Math.max(1, mapView.level - 1) })}
          className="w-full px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
        >
          +
        </button>
        <button
          onClick={() => setMapView({ ...mapView, level: Math.min(14, mapView.level + 1) })}
          className="w-full px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
        >
          -
        </button>
      </div>
    </div>
  );
}
