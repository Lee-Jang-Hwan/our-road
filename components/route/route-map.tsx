'use client';

// ============================================
// Route Map Component (Kakao Maps)
// ============================================

import { useEffect, useRef, useState, useMemo } from 'react';
import { useAtom } from 'jotai';
import type { TripOutput, Waypoint, LatLng as AppLatLng } from '@/types';
import { mapViewAtom, selectedDayAtom, selectedWaypointAtom } from '@/lib/states/route-view-atoms';
import { getDayColor, MARKER_COLORS } from '@/lib/utils/route-colors';
import { KakaoMap } from '@/components/map/kakao-map';
import { PlaceMarkers } from '@/components/map/place-markers';
import { RealRoutePolyline } from '@/components/map/route-polyline';
import { getSegmentColor } from '@/lib/utils';
import type { Coordinate } from '@/types/place';

interface RouteMapProps {
  tripOutput: TripOutput;
  waypoints: Waypoint[];
}

export default function RouteMap({ tripOutput, waypoints }: RouteMapProps) {
  const [mapView, setMapView] = useAtom(mapViewAtom);
  const [selectedDay] = useAtom(selectedDayAtom);
  const [selectedWaypoint] = useAtom(selectedWaypointAtom);

  // Get waypoint by ID
  const getWaypointById = (id: string) => {
    return waypoints.find((wp) => wp.id === id);
  };

  // Get selected day plan
  const selectedDayPlan = useMemo(() => {
    if (selectedDay === null) return null;
    return tripOutput.dayPlans.find((plan) => plan.dayIndex === selectedDay);
  }, [tripOutput, selectedDay]);

  // Calculate map center
  const mapCenter = useMemo<Coordinate>(() => {
    const allCoords: Coordinate[] = [];

    if (selectedDayPlan) {
      // Only show selected day waypoints
      selectedDayPlan.waypointOrder.forEach((wpId) => {
        const wp = getWaypointById(wpId);
        if (wp) {
          allCoords.push(wp.coord);
        }
      });
    } else {
      // Show all waypoints
      waypoints.forEach((wp) => {
        allCoords.push(wp.coord);
      });
    }

    if (allCoords.length === 0) {
      return { lat: 37.5665, lng: 126.978 }; // Seoul City Hall
    }

    const sumLat = allCoords.reduce((sum, c) => sum + c.lat, 0);
    const sumLng = allCoords.reduce((sum, c) => sum + c.lng, 0);
    return {
      lat: sumLat / allCoords.length,
      lng: sumLng / allCoords.length,
    };
  }, [waypoints, selectedDayPlan]);

  // Get current day markers
  const currentDayMarkers = useMemo(() => {
    const markers: Array<{
      id: string;
      coordinate: Coordinate;
      order: number;
      name: string;
      isFixed: boolean;
      clickable: boolean;
      color: string;
    }> = [];

    if (selectedDayPlan) {
      // Only show selected day
      selectedDayPlan.waypointOrder.forEach((wpId, index) => {
        const wp = getWaypointById(wpId);
        if (wp) {
          markers.push({
            id: wp.id,
            coordinate: wp.coord,
            order: index + 1,
            name: wp.name,
            isFixed: wp.isFixed || false,
            clickable: true,
            color: getSegmentColor(index),
          });
        }
      });
    } else {
      // Show all days with different colors
      tripOutput.dayPlans.forEach((dayPlan, dayIndex) => {
        const dayColor = getDayColor(dayIndex);
        dayPlan.waypointOrder.forEach((wpId, wpIndex) => {
          const wp = getWaypointById(wpId);
          if (wp) {
            markers.push({
              id: wp.id,
              coordinate: wp.coord,
              order: wpIndex + 1,
              name: wp.name,
              isFixed: wp.isFixed || false,
              clickable: true,
              color: dayColor.primary,
            });
          }
        });
      });
    }

    return markers;
  }, [tripOutput, waypoints, selectedDayPlan]);

  // Get route segments for polylines
  const routeSegments = useMemo(() => {
    const segments: Array<{
      from: Coordinate;
      to: Coordinate;
      encodedPath?: string;
      transportMode: 'walking' | 'public' | 'car';
      segmentIndex: number;
    }> = [];

    const daysToShow = selectedDayPlan ? [selectedDayPlan] : tripOutput.dayPlans;

    daysToShow.forEach((dayPlan, dayIndex) => {
      const waypointOrder = dayPlan.waypointOrder;

      // Find segments for this day
      for (let i = 0; i < waypointOrder.length; i++) {
        const fromId = i === 0 ? '__start__' : waypointOrder[i - 1];
        const toId = waypointOrder[i];

        // Find segment cost
        const segmentCost = tripOutput.segmentCosts.find(
          (seg) => seg.key.fromId === fromId && seg.key.toId === toId
        );

        if (segmentCost) {
          const fromWp = i === 0 ? getWaypointById(toId) : getWaypointById(fromId);
          const toWp = getWaypointById(toId);

          if (fromWp && toWp) {
            const from = i === 0 ? fromWp.coord : fromWp.coord;
            const to = toWp.coord;

            segments.push({
              from,
              to,
              encodedPath: undefined, // polyline is array of coords in our mock data
              transportMode: segmentCost.transitDetails ? 'public' : 'walking',
              segmentIndex: selectedDayPlan ? i : dayIndex * 10 + i,
            });

            // Convert polyline array to encoded path or just use coordinates
            if (segmentCost.polyline && Array.isArray(segmentCost.polyline)) {
              // For now, we'll render direct lines
              // In real implementation, this would be encoded polyline string
            }
          }
        }

        // Segments between waypoints
        if (i < waypointOrder.length - 1) {
          const fromWp = getWaypointById(waypointOrder[i]);
          const toWp = getWaypointById(waypointOrder[i + 1]);

          const segmentCost = tripOutput.segmentCosts.find(
            (seg) => seg.key.fromId === waypointOrder[i] && seg.key.toId === waypointOrder[i + 1]
          );

          if (fromWp && toWp && segmentCost) {
            segments.push({
              from: fromWp.coord,
              to: toWp.coord,
              encodedPath: undefined,
              transportMode: segmentCost.transitDetails ? 'public' : 'walking',
              segmentIndex: selectedDayPlan ? i + 1 : dayIndex * 10 + i + 1,
            });
          }
        }
      }
    });

    return segments;
  }, [tripOutput, waypoints, selectedDayPlan]);

  return (
    <div className="relative w-full h-full">
      <KakaoMap
        center={mapCenter}
        level={mapView.level}
        className="w-full h-full rounded-lg"
      >
        {/* Route polylines */}
        {routeSegments.length > 0 && (
          <RealRoutePolyline
            segments={routeSegments}
            strokeWeight={5}
            strokeOpacity={0.9}
            useSegmentColors={selectedDayPlan !== null}
          />
        )}

        {/* Waypoint markers */}
        {currentDayMarkers.length > 0 && (
          <PlaceMarkers markers={currentDayMarkers} size="md" />
        )}
      </KakaoMap>

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2 space-y-2 z-10">
        <button
          onClick={() => setMapView({ ...mapView, level: Math.max(1, mapView.level - 1) })}
          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-lg font-bold"
        >
          +
        </button>
        <button
          onClick={() => setMapView({ ...mapView, level: Math.min(14, mapView.level + 1) })}
          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-lg font-bold"
        >
          −
        </button>
      </div>
    </div>
  );
}
