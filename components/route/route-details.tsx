'use client';

// ============================================
// Route Details Component (Timeline View)
// ============================================

import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Clock, Navigation } from 'lucide-react';
import type { TripOutput, Waypoint } from '@/types';
import { getDayColor } from '@/lib/utils/route-colors';

interface RouteDetailsProps {
  tripOutput: TripOutput;
  waypoints: Waypoint[];
}

export default function RouteDetails({ tripOutput, waypoints }: RouteDetailsProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(
    new Set(tripOutput.dayPlans.map((_, i) => i))
  );

  const toggleDay = (dayIndex: number) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(dayIndex)) {
      newExpanded.delete(dayIndex);
    } else {
      newExpanded.add(dayIndex);
    }
    setExpandedDays(newExpanded);
  };

  const getWaypointById = (id: string) => {
    return waypoints.find((wp) => wp.id === id);
  };

  const getSegmentInfo = (fromId: string, toId: string) => {
    return tripOutput.segmentCosts.find(
      (seg) => seg.key.fromId === fromId && seg.key.toId === toId
    );
  };

  return (
    <div className="space-y-4">
      {tripOutput.dayPlans.map((dayPlan, dayIndex) => {
        const dayColor = getDayColor(dayIndex);
        const isExpanded = expandedDays.has(dayIndex);

        // Calculate day total time
        const daySegments = tripOutput.segmentCosts.filter((segment) =>
          dayPlan.waypointOrder.includes(segment.key.fromId) ||
          dayPlan.waypointOrder.includes(segment.key.toId)
        );
        const travelMinutes = daySegments.reduce((sum, seg) => sum + (seg.durationMinutes || 0), 0);
        const stayMinutes = dayPlan.waypointOrder.reduce((sum, wpId) => {
          const wp = getWaypointById(wpId);
          return sum + (wp?.stayMinutes || 0);
        }, 0);
        const totalMinutes = travelMinutes + stayMinutes;

        return (
          <div key={dayPlan.dayIndex} className="bg-white rounded-lg shadow overflow-hidden">
            {/* Day Header */}
            <button
              onClick={() => toggleDay(dayIndex)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              style={{ borderLeft: `4px solid ${dayColor.primary}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: dayColor.primary }}
                >
                  {dayPlan.dayIndex}
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Day {dayPlan.dayIndex}</h3>
                  <p className="text-sm text-gray-600">
                    {dayPlan.waypointOrder.length}개 경유지 · {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
                  </p>
                </div>
              </div>
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {/* Day Timeline */}
            {isExpanded && (
              <div className="p-4 pt-0">
                <div className="relative pl-8 space-y-6">
                  {/* Vertical line */}
                  <div
                    className="absolute left-3 top-0 bottom-0 w-0.5"
                    style={{ backgroundColor: dayColor.light }}
                  />

                  {dayPlan.waypointOrder.map((wpId, wpIndex) => {
                    const waypoint = getWaypointById(wpId);
                    if (!waypoint) return null;

                    const isLast = wpIndex === dayPlan.waypointOrder.length - 1;
                    const nextWpId = !isLast ? dayPlan.waypointOrder[wpIndex + 1] : null;
                    const segment = nextWpId ? getSegmentInfo(wpId, nextWpId) : null;

                    return (
                      <div key={wpId}>
                        {/* Waypoint */}
                        <div className="relative">
                          {/* Dot */}
                          <div
                            className="absolute -left-[1.875rem] top-1 w-6 h-6 rounded-full border-4 border-white"
                            style={{ backgroundColor: dayColor.primary }}
                          />

                          {/* Waypoint Card */}
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <MapPin size={16} className="text-gray-600" />
                                  <h4 className="font-semibold">{waypoint.name}</h4>
                                  {waypoint.isFixed && (
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                      필수
                                    </span>
                                  )}
                                </div>
                                {waypoint.stayMinutes && (
                                  <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                                    <Clock size={14} />
                                    <span>체류 {waypoint.stayMinutes}분</span>
                                  </div>
                                )}
                                {waypoint.importance && (
                                  <div className="mt-1 text-sm text-gray-600">
                                    {'⭐'.repeat(waypoint.importance)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Segment (travel to next waypoint) */}
                        {segment && (
                          <div className="ml-3 my-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Navigation size={14} />
                              <span>{segment.durationMinutes || 0}분</span>
                              {segment.distanceMeters && (
                                <span>· {Math.round(segment.distanceMeters / 100) / 10}km</span>
                              )}
                              {segment.transfers !== undefined && segment.transfers > 0 && (
                                <span>· 환승 {segment.transfers}회</span>
                              )}
                            </div>
                            {/* Transit details - subPaths 표시 */}
                            {segment.transitDetails && segment.transitDetails.subPaths && (
                              <div className="mt-1 ml-5 space-y-1">
                                {segment.transitDetails.subPaths.map((subPath, idx) => (
                                  <div key={idx} className="text-xs flex items-center gap-1">
                                    {subPath.trafficType !== 3 && subPath.lane && (
                                      <>
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded">
                                          {subPath.lane.name || subPath.lane.busNo}
                                        </span>
                                        {subPath.startName && subPath.endName && (
                                          <span className="text-gray-600">
                                            {subPath.startName} → {subPath.endName}
                                          </span>
                                        )}
                                        {subPath.stationCount && (
                                          <span className="text-gray-600">
                                            ({subPath.stationCount}개 역)
                                          </span>
                                        )}
                                      </>
                                    )}
                                    {subPath.trafficType === 3 && (
                                      <span className="text-gray-500">
                                        도보 {Math.round(subPath.distance)}m ({subPath.sectionTime}분)
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          경로 공유하기
        </button>
        <button className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors">
          내보내기
        </button>
      </div>
    </div>
  );
}
