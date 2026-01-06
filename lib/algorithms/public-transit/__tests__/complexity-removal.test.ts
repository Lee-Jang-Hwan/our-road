import {
  exceedsDailyLimitProxy,
  calculateComplexityImpact,
  selectWorstComplexityPoint,
  removeWaypoint,
  calculateActualDailyTimes,
  identifyOverloadedDays,
} from '../complexity-removal';
import type { DayPlan, Waypoint, SegmentCost } from '@/types';

describe('complexity-removal', () => {
  const createMockWaypoints = (): Map<string, Waypoint> => {
    const waypoints = new Map<string, Waypoint>();
    waypoints.set('wp1', {
      id: 'wp1',
      name: 'Waypoint 1',
      coord: { lat: 37.5665, lng: 126.978 },
      isFixed: false,
    });
    waypoints.set('wp2', {
      id: 'wp2',
      name: 'Waypoint 2',
      coord: { lat: 37.5, lng: 127.0 },
      isFixed: false,
    });
    waypoints.set('wp3', {
      id: 'wp3',
      name: 'Waypoint 3',
      coord: { lat: 37.6, lng: 127.1 },
      isFixed: true,
    });
    return waypoints;
  };

  describe('exceedsDailyLimitProxy', () => {
    it('should detect when daily limit is exceeded', () => {
      const dayPlans: DayPlan[] = [
        {
          dayIndex: 0,
          waypointOrder: ['wp1', 'wp2'],
          excludedWaypointIds: [],
        },
      ];
      const waypoints = createMockWaypoints();
      const dailyMaxMinutes = 10; // Very low limit

      const exceeds = exceedsDailyLimitProxy(dayPlans, dailyMaxMinutes, waypoints);

      expect(exceeds).toBe(true);
    });

    it('should return false when within daily limit', () => {
      const dayPlans: DayPlan[] = [
        {
          dayIndex: 0,
          waypointOrder: ['wp1', 'wp2'],
          excludedWaypointIds: [],
        },
      ];
      const waypoints = createMockWaypoints();
      const dailyMaxMinutes = 1000; // Very high limit

      const exceeds = exceedsDailyLimitProxy(dayPlans, dailyMaxMinutes, waypoints);

      expect(exceeds).toBe(false);
    });
  });

  describe('calculateComplexityImpact', () => {
    it('should calculate complexity impact for a waypoint', () => {
      const waypoint: Waypoint = {
        id: 'wp2',
        name: 'Waypoint 2',
        coord: { lat: 37.5, lng: 127.0 },
        isFixed: false,
        importance: 3,
        stayMinutes: 60,
      };
      const route = ['wp1', 'wp2', 'wp3'];
      const waypoints = createMockWaypoints();

      const impact = calculateComplexityImpact(waypoint, route, waypoints);

      expect(typeof impact).toBe('number');
    });

    it('should return 0 for waypoint not in route', () => {
      const waypoint: Waypoint = {
        id: 'wp4',
        name: 'Waypoint 4',
        coord: { lat: 37.7, lng: 127.2 },
        isFixed: false,
      };
      const route = ['wp1', 'wp2', 'wp3'];
      const waypoints = createMockWaypoints();

      const impact = calculateComplexityImpact(waypoint, route, waypoints);

      expect(impact).toBe(0);
    });
  });

  describe('selectWorstComplexityPoint', () => {
    it('should select the waypoint with highest complexity impact', () => {
      const dayPlans: DayPlan[] = [
        {
          dayIndex: 0,
          waypointOrder: ['wp1', 'wp2', 'wp3'],
          excludedWaypointIds: [],
        },
      ];
      const fixedIds = ['wp3'];
      const waypoints = createMockWaypoints();

      const worstId = selectWorstComplexityPoint(dayPlans, fixedIds, waypoints);

      expect(worstId).toBeTruthy();
      expect(worstId).not.toBe('wp3'); // Fixed waypoint should not be selected
    });

    it('should return null when no removable waypoints exist', () => {
      const dayPlans: DayPlan[] = [
        {
          dayIndex: 0,
          waypointOrder: ['wp3'], // Only fixed waypoint
          excludedWaypointIds: [],
        },
      ];
      const fixedIds = ['wp3'];
      const waypoints = createMockWaypoints();

      const worstId = selectWorstComplexityPoint(dayPlans, fixedIds, waypoints);

      expect(worstId).toBeNull();
    });
  });

  describe('removeWaypoint', () => {
    it('should remove waypoint from day plan', () => {
      const dayPlans: DayPlan[] = [
        {
          dayIndex: 0,
          waypointOrder: ['wp1', 'wp2', 'wp3'],
          excludedWaypointIds: [],
        },
      ];

      removeWaypoint(dayPlans, 'wp2');

      expect(dayPlans[0].waypointOrder).not.toContain('wp2');
      expect(dayPlans[0].excludedWaypointIds).toContain('wp2');
    });

    it('should handle removing non-existent waypoint', () => {
      const dayPlans: DayPlan[] = [
        {
          dayIndex: 0,
          waypointOrder: ['wp1', 'wp3'],
          excludedWaypointIds: [],
        },
      ];

      removeWaypoint(dayPlans, 'wp2');

      expect(dayPlans[0].waypointOrder).toEqual(['wp1', 'wp3']);
    });
  });

  describe('calculateActualDailyTimes', () => {
    it('should calculate actual daily times from segment costs', () => {
      const dayPlans: DayPlan[] = [
        {
          dayIndex: 0,
          waypointOrder: ['wp1', 'wp2'],
          excludedWaypointIds: [],
        },
      ];
      const segmentCosts: SegmentCost[] = [
        {
          key: { fromId: '__start__', toId: 'wp1' },
          durationMinutes: 10,
          distanceMeters: 1000,
        },
        {
          key: { fromId: 'wp1', toId: 'wp2' },
          durationMinutes: 15,
          distanceMeters: 1500,
        },
        {
          key: { fromId: 'wp2', toId: '__end__' },
          durationMinutes: 10,
          distanceMeters: 1000,
        },
      ];
      const waypoints = createMockWaypoints();

      const dayTimeInfos = calculateActualDailyTimes(dayPlans, segmentCosts, waypoints);

      expect(dayTimeInfos).toHaveLength(1);
      expect(dayTimeInfos[0].totalMinutes).toBeGreaterThan(0);
    });
  });

  describe('identifyOverloadedDays', () => {
    it('should identify days that exceed the daily limit', () => {
      const dayTimeInfos = [
        { dayIndex: 0, totalMinutes: 500, exceedMinutes: 0 },
        { dayIndex: 1, totalMinutes: 700, exceedMinutes: 0 },
      ];
      const dailyMaxMinutes = 600;

      const overloaded = identifyOverloadedDays(dayTimeInfos, dailyMaxMinutes);

      expect(overloaded).toHaveLength(1);
      expect(overloaded[0].dayIndex).toBe(1);
      expect(overloaded[0].exceedMinutes).toBe(100);
    });

    it('should return empty array when all days are within limit', () => {
      const dayTimeInfos = [
        { dayIndex: 0, totalMinutes: 400, exceedMinutes: 0 },
        { dayIndex: 1, totalMinutes: 500, exceedMinutes: 0 },
      ];
      const dailyMaxMinutes = 600;

      const overloaded = identifyOverloadedDays(dayTimeInfos, dailyMaxMinutes);

      expect(overloaded).toHaveLength(0);
    });
  });
});
