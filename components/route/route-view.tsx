'use client';

// ============================================
// Main Route View Component (Responsive Layout)
// ============================================

import { useState } from 'react';
import type { TripOutput, Waypoint } from '@/types';
import RouteMap from './route-map';
import RouteStatistics from './route-statistics';
import RouteDetails from './route-details';
import { getDayColor } from '@/lib/utils/route-colors';

interface RouteViewProps {
  tripOutput: TripOutput;
  waypoints: Waypoint[];
  dailyMaxMinutes?: number;
}

export default function RouteView({
  tripOutput,
  waypoints,
  dailyMaxMinutes,
}: RouteViewProps) {
  const [activeTab, setActiveTab] = useState<'map' | 'details' | 'statistics'>('map');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-4 lg:p-4">
      {/* Map Section (Left - 60%) */}
      <div className="lg:w-[60%] h-[40vh] lg:h-full relative">
        <RouteMap tripOutput={tripOutput} waypoints={waypoints} />

        {/* Day Filter Pills */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg p-2 flex gap-2 z-[1000]">
          <button
            onClick={() => setSelectedDay(null)}
            className={`px-4 py-2 rounded-full transition-colors ${
              selectedDay === null
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {tripOutput.dayPlans.map((dayPlan, index) => {
            const dayColor = getDayColor(index);
            const isSelected = selectedDay === dayPlan.dayIndex;

            return (
              <button
                key={dayPlan.dayIndex}
                onClick={() => setSelectedDay(dayPlan.dayIndex)}
                className="px-4 py-2 rounded-full transition-colors font-semibold"
                style={{
                  backgroundColor: isSelected ? dayColor.primary : dayColor.light,
                  color: isSelected ? 'white' : dayColor.dark,
                }}
              >
                Day {dayPlan.dayIndex}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info Section (Right - 40%) */}
      <div className="lg:w-[40%] flex flex-col flex-1 lg:h-full overflow-hidden">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="flex border-b">
            <TabButton
              active={activeTab === 'details'}
              onClick={() => setActiveTab('details')}
              label="상세 정보"
            />
            <TabButton
              active={activeTab === 'statistics'}
              onClick={() => setActiveTab('statistics')}
              label="통계"
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' && (
            <RouteDetails tripOutput={tripOutput} waypoints={waypoints} />
          )}
          {activeTab === 'statistics' && (
            <RouteStatistics
              tripOutput={tripOutput}
              waypoints={waypoints}
              dailyMaxMinutes={dailyMaxMinutes}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-3 font-semibold transition-colors ${
        active
          ? 'text-blue-600 border-b-2 border-blue-600'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );
}
