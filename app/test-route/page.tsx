'use client';

// ============================================
// Test Route Visualization Page
// ============================================

import { useState } from 'react';
import Link from 'next/link';
import { LuChevronLeft } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import RouteView from '@/components/route/route-view';
import type { TripOutput, Waypoint } from '@/types';

// Mock data for testing with public transit routes
const mockWaypoints: Waypoint[] = [
  { id: 'wp1', name: '경복궁', coord: { lat: 37.5796, lng: 126.9770 }, isFixed: false, importance: 5, stayMinutes: 90 },
  { id: 'wp2', name: '북촌한옥마을', coord: { lat: 37.5824, lng: 126.9850 }, isFixed: false, importance: 4, stayMinutes: 60 },
  { id: 'wp3', name: '인사동', coord: { lat: 37.5718, lng: 126.9852 }, isFixed: false, importance: 4, stayMinutes: 60 },
  { id: 'wp4', name: '명동', coord: { lat: 37.5636, lng: 126.9826 }, isFixed: true, importance: 5, stayMinutes: 120 },
  { id: 'wp5', name: '남산타워', coord: { lat: 37.5512, lng: 126.9882 }, isFixed: false, importance: 5, stayMinutes: 90 },
  { id: 'wp6', name: '홍대입구', coord: { lat: 37.5563, lng: 126.9229 }, isFixed: false, importance: 4, stayMinutes: 90 },
  { id: 'wp7', name: '이태원', coord: { lat: 37.5345, lng: 126.9946 }, isFixed: false, importance: 3, stayMinutes: 60 },
  { id: 'wp8', name: '강남역', coord: { lat: 37.4979, lng: 127.0276 }, isFixed: false, importance: 4, stayMinutes: 90 },
  { id: 'wp9', name: '코엑스', coord: { lat: 37.5115, lng: 127.0595 }, isFixed: false, importance: 4, stayMinutes: 120 },
];

// Mock polyline data (encoded) for subway routes
const mockTripOutput: TripOutput = {
  tripId: 'test-trip-1',
  mode: 'OPEN',
  clusters: [
    {
      id: 1,
      waypointIds: ['wp1', 'wp2', 'wp3', 'wp4'],
      centroid: { lat: 37.5693, lng: 126.9825 },
    },
    {
      id: 2,
      waypointIds: ['wp5', 'wp6', 'wp7'],
      centroid: { lat: 37.5473, lng: 126.9686 },
    },
    {
      id: 3,
      waypointIds: ['wp8', 'wp9'],
      centroid: { lat: 37.5047, lng: 127.0436 },
    },
  ],
  dayPlans: [
    {
      dayIndex: 1,
      waypointOrder: ['wp1', 'wp2', 'wp3', 'wp4'],
      excludedWaypointIds: [],
    },
    {
      dayIndex: 2,
      waypointOrder: ['wp5', 'wp6', 'wp7'],
      excludedWaypointIds: [],
    },
    {
      dayIndex: 3,
      waypointOrder: ['wp8', 'wp9'],
      excludedWaypointIds: [],
    },
  ],
  segmentCosts: [
    // Day 1 - 경복궁 주변 (지하철 3호선 + 도보)
    {
      key: { fromId: '__start__', toId: 'wp1' },
      durationMinutes: 10,
      distanceMeters: 2000,
      polyline: [
        { lat: 37.5796, lng: 126.9770 },
        { lat: 37.5800, lng: 126.9775 },
        { lat: 37.5796, lng: 126.9770 }
      ]
    },
    {
      key: { fromId: 'wp1', toId: 'wp2' },
      durationMinutes: 12,
      distanceMeters: 1500,
      transfers: 0,
      polyline: [
        { lat: 37.5796, lng: 126.9770 },
        { lat: 37.5810, lng: 126.9800 },
        { lat: 37.5824, lng: 126.9850 }
      ],
      transitDetails: {
        transportMode: 'subway',
        lineName: '3호선',
        startStation: '경복궁역',
        endStation: '안국역',
        stationCount: 1
      }
    },
    {
      key: { fromId: 'wp2', toId: 'wp3' },
      durationMinutes: 15,
      distanceMeters: 2000,
      transfers: 1,
      polyline: [
        { lat: 37.5824, lng: 126.9850 },
        { lat: 37.5780, lng: 126.9860 },
        { lat: 37.5750, lng: 126.9855 },
        { lat: 37.5718, lng: 126.9852 }
      ],
      transitDetails: {
        transportMode: 'subway',
        lineName: '3호선 → 1호선',
        startStation: '안국역',
        endStation: '종각역',
        stationCount: 2
      }
    },
    {
      key: { fromId: 'wp3', toId: 'wp4' },
      durationMinutes: 10,
      distanceMeters: 1200,
      transfers: 0,
      polyline: [
        { lat: 37.5718, lng: 126.9852 },
        { lat: 37.5680, lng: 126.9840 },
        { lat: 37.5650, lng: 126.9830 },
        { lat: 37.5636, lng: 126.9826 }
      ],
      transitDetails: {
        transportMode: 'subway',
        lineName: '1호선',
        startStation: '종각역',
        endStation: '을지로입구역',
        stationCount: 1
      }
    },

    // Day 2 - 명동 → 홍대 (지하철 4호선, 2호선)
    {
      key: { fromId: 'wp4', toId: 'wp5' },
      durationMinutes: 18,
      distanceMeters: 2500,
      transfers: 1,
      polyline: [
        { lat: 37.5636, lng: 126.9826 },
        { lat: 37.5600, lng: 126.9850 },
        { lat: 37.5560, lng: 126.9870 },
        { lat: 37.5512, lng: 126.9882 }
      ],
      transitDetails: {
        transportMode: 'subway',
        lineName: '4호선',
        startStation: '명동역',
        endStation: '회현역',
        stationCount: 2
      }
    },
    {
      key: { fromId: 'wp5', toId: 'wp6' },
      durationMinutes: 25,
      distanceMeters: 7000,
      transfers: 1,
      polyline: [
        { lat: 37.5512, lng: 126.9882 },
        { lat: 37.5500, lng: 126.9750 },
        { lat: 37.5520, lng: 126.9600 },
        { lat: 37.5540, lng: 126.9450 },
        { lat: 37.5563, lng: 126.9229 }
      ],
      transitDetails: {
        transportMode: 'subway',
        lineName: '4호선 → 2호선',
        startStation: '회현역',
        endStation: '홍대입구역',
        stationCount: 8
      }
    },
    {
      key: { fromId: 'wp6', toId: 'wp7' },
      durationMinutes: 20,
      distanceMeters: 6000,
      transfers: 1,
      polyline: [
        { lat: 37.5563, lng: 126.9229 },
        { lat: 37.5540, lng: 126.9400 },
        { lat: 37.5480, lng: 126.9700 },
        { lat: 37.5345, lng: 126.9946 }
      ],
      transitDetails: {
        transportMode: 'subway',
        lineName: '2호선 → 6호선',
        startStation: '홍대입구역',
        endStation: '이태원역',
        stationCount: 7
      }
    },

    // Day 3 - 강남 (지하철 2호선, 분당선)
    {
      key: { fromId: 'wp7', toId: 'wp8' },
      durationMinutes: 22,
      distanceMeters: 6500,
      transfers: 1,
      polyline: [
        { lat: 37.5345, lng: 126.9946 },
        { lat: 37.5200, lng: 127.0100 },
        { lat: 37.5100, lng: 127.0200 },
        { lat: 37.4979, lng: 127.0276 }
      ],
      transitDetails: {
        transportMode: 'subway',
        lineName: '6호선 → 2호선',
        startStation: '이태원역',
        endStation: '강남역',
        stationCount: 9
      }
    },
    {
      key: { fromId: 'wp8', toId: 'wp9' },
      durationMinutes: 12,
      distanceMeters: 3500,
      transfers: 0,
      polyline: [
        { lat: 37.4979, lng: 127.0276 },
        { lat: 37.5050, lng: 127.0400 },
        { lat: 37.5100, lng: 127.0550 },
        { lat: 37.5115, lng: 127.0595 }
      ],
      transitDetails: {
        transportMode: 'subway',
        lineName: '분당선',
        startStation: '강남역',
        endStation: '삼성역',
        stationCount: 1
      }
    },
    {
      key: { fromId: 'wp9', toId: '__end__' },
      durationMinutes: 15,
      distanceMeters: 2000,
      polyline: [
        { lat: 37.5115, lng: 127.0595 },
        { lat: 37.5120, lng: 127.0600 },
        { lat: 37.5115, lng: 127.0595 }
      ]
    },
  ],
};

export default function TestRoutePage() {
  const [showData, setShowData] = useState(false);

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <Link href="/">
          <Button variant="ghost" size="icon" className="shrink-0">
            <LuChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="font-semibold text-lg flex-1">경로 시각화 데모</h1>
        <button
          onClick={() => setShowData(!showData)}
          className="text-sm text-blue-600 hover:underline"
        >
          {showData ? '숨기기' : '데이터'}
        </button>
      </header>

      {/* Mock Data Display */}
      {showData && (
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="bg-background rounded-lg p-3">
            <h3 className="font-semibold text-sm mb-2">Mock Data</h3>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
              {JSON.stringify({ waypoints: mockWaypoints.length, segments: mockTripOutput.segmentCosts.length }, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Route Visualization */}
      <div className="flex-1 overflow-hidden">
        <RouteView
          tripOutput={mockTripOutput}
          waypoints={mockWaypoints}
          dailyMaxMinutes={480} // 8 hours
        />
      </div>
    </main>
  );
}
