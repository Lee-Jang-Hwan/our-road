'use client';

// ============================================
// Route Statistics Dashboard Component
// ============================================

import { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { TripOutput, Waypoint } from '@/types';
import { getDayColor, STATUS_COLORS } from '@/lib/utils/route-colors';

interface RouteStatisticsProps {
  tripOutput: TripOutput;
  waypoints: Waypoint[];
  dailyMaxMinutes?: number;
}

export default function RouteStatistics({
  tripOutput,
  waypoints,
  dailyMaxMinutes,
}: RouteStatisticsProps) {
  // Calculate daily time distribution
  const dailyTimeData = useMemo(() => {
    return tripOutput.dayPlans.map((dayPlan, index) => {
      // Calculate total time for this day
      let totalMinutes = 0;
      let travelMinutes = 0;
      let stayMinutes = 0;

      // Find all segments for this day
      const daySegments = tripOutput.segmentCosts.filter((segment) =>
        dayPlan.waypointOrder.includes(segment.key.fromId) ||
        dayPlan.waypointOrder.includes(segment.key.toId)
      );

      // Sum travel time
      travelMinutes = daySegments.reduce((sum, seg) => sum + (seg.durationMinutes || 0), 0);

      // Sum stay time
      dayPlan.waypointOrder.forEach((wpId) => {
        const wp = waypoints.find((w) => w.id === wpId);
        if (wp?.stayMinutes) {
          stayMinutes += wp.stayMinutes;
        }
      });

      totalMinutes = travelMinutes + stayMinutes;

      const dayColor = getDayColor(index);
      let status: 'normal' | 'warning' | 'error' = 'normal';

      if (dailyMaxMinutes) {
        if (totalMinutes > dailyMaxMinutes * 1.1) {
          status = 'error';
        } else if (totalMinutes > dailyMaxMinutes) {
          status = 'warning';
        }
      }

      return {
        day: `Day ${dayPlan.dayIndex}`,
        totalMinutes,
        travelMinutes,
        stayMinutes,
        color: dayColor.primary,
        status,
      };
    });
  }, [tripOutput, waypoints, dailyMaxMinutes]);

  // Calculate distance data
  const distanceData = useMemo(() => {
    return tripOutput.dayPlans.map((dayPlan, index) => {
      const daySegments = tripOutput.segmentCosts.filter((segment) =>
        dayPlan.waypointOrder.includes(segment.key.fromId) ||
        dayPlan.waypointOrder.includes(segment.key.toId)
      );

      const totalDistance = daySegments.reduce((sum, seg) => sum + (seg.distanceMeters || 0), 0);

      return {
        day: `Day ${dayPlan.dayIndex}`,
        distanceKm: Math.round(totalDistance / 1000 * 10) / 10,
      };
    });
  }, [tripOutput]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalTime = dailyTimeData.reduce((sum, d) => sum + d.totalMinutes, 0);
    const totalDistance = distanceData.reduce((sum, d) => sum + d.distanceKm, 0);
    const totalTransfers = tripOutput.segmentCosts.reduce(
      (sum, seg) => sum + (seg.transfers || 0),
      0
    );
    const avgTransfers = tripOutput.segmentCosts.length > 0
      ? totalTransfers / tripOutput.segmentCosts.length
      : 0;

    return {
      totalTime: Math.round(totalTime),
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalSegments: tripOutput.segmentCosts.length,
      avgTransfers: Math.round(avgTransfers * 10) / 10,
    };
  }, [dailyTimeData, distanceData, tripOutput.segmentCosts]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="총 이동 시간"
          value={`${Math.floor(summaryStats.totalTime / 60)}h ${summaryStats.totalTime % 60}m`}
          icon="⏱️"
        />
        <StatCard
          label="총 이동 거리"
          value={`${summaryStats.totalDistance}km`}
          icon="📍"
        />
        <StatCard
          label="총 구간 수"
          value={`${summaryStats.totalSegments}개`}
          icon="🚇"
        />
        <StatCard
          label="평균 환승"
          value={`${summaryStats.avgTransfers}회`}
          icon="🔄"
        />
      </div>

      {/* Daily Time Distribution Chart */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">일일 시간 분포</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={dailyTimeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis label={{ value: '분', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-3 border rounded shadow-lg">
                    <p className="font-semibold">{data.day}</p>
                    <p className="text-sm">총: {data.totalMinutes}분</p>
                    <p className="text-sm text-blue-600">이동: {data.travelMinutes}분</p>
                    <p className="text-sm text-green-600">체류: {data.stayMinutes}분</p>
                    {dailyMaxMinutes && (
                      <p className="text-sm text-gray-500">제한: {dailyMaxMinutes}분</p>
                    )}
                  </div>
                );
              }}
            />
            <Bar dataKey="totalMinutes" radius={[8, 8, 0, 0]}>
              {dailyTimeData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.status === 'error'
                      ? STATUS_COLORS.error
                      : entry.status === 'warning'
                        ? STATUS_COLORS.warning
                        : entry.color
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Distance Chart */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">일일 이동 거리</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={distanceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis label={{ value: 'km', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="distanceKm"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{icon}</span>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
