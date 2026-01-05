'use client';

// ============================================
// Test Route Visualization Page
// ============================================

import { useState } from 'react';
import RouteView from '@/components/route/route-view';
import type { TripOutput, Waypoint } from '@/types';

// Mock data for testing
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
    // Day 1
    { key: { fromId: '__start__', toId: 'wp1' }, durationMinutes: 10, distanceMeters: 2000 },
    { key: { fromId: 'wp1', toId: 'wp2' }, durationMinutes: 12, distanceMeters: 1500, transfers: 0 },
    { key: { fromId: 'wp2', toId: 'wp3' }, durationMinutes: 15, distanceMeters: 2000, transfers: 1 },
    { key: { fromId: 'wp3', toId: 'wp4' }, durationMinutes: 10, distanceMeters: 1200, transfers: 0 },

    // Day 2
    { key: { fromId: 'wp4', toId: 'wp5' }, durationMinutes: 18, distanceMeters: 2500, transfers: 1 },
    { key: { fromId: 'wp5', toId: 'wp6' }, durationMinutes: 25, distanceMeters: 7000, transfers: 1 },
    { key: { fromId: 'wp6', toId: 'wp7' }, durationMinutes: 20, distanceMeters: 6000, transfers: 1 },

    // Day 3
    { key: { fromId: 'wp7', toId: 'wp8' }, durationMinutes: 22, distanceMeters: 6500, transfers: 1 },
    { key: { fromId: 'wp8', toId: 'wp9' }, durationMinutes: 12, distanceMeters: 3500, transfers: 0 },
    { key: { fromId: 'wp9', toId: '__end__' }, durationMinutes: 15, distanceMeters: 2000 },
  ],
};

export default function TestRoutePage() {
  const [showData, setShowData] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">경로 시각화 테스트</h1>
          <p className="text-gray-600 mt-1">Phase 3 시각화 컴포넌트 데모</p>
          <button
            onClick={() => setShowData(!showData)}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            {showData ? '데이터 숨기기' : '데이터 보기'}
          </button>
        </div>
      </div>

      {/* Mock Data Display */}
      {showData && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Mock Data</h3>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-96">
              {JSON.stringify({ tripOutput: mockTripOutput, waypoints: mockWaypoints }, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Route Visualization */}
      <RouteView
        tripOutput={mockTripOutput}
        waypoints={mockWaypoints}
        dailyMaxMinutes={480} // 8 hours
      />
    </div>
  );
}
