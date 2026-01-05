import { generatePublicTransitRoute } from '../index';
import type { TripInput, Waypoint } from '@/types';

// Mock p-limit to avoid ESM issues in Jest
jest.mock('p-limit', () => {
  return jest.fn(() => (fn: any) => fn());
});

// Mock the API caller
jest.mock('../api-caller', () => ({
  ...jest.requireActual('../api-caller'),
  callRoutingAPIForSegments: jest.fn(async (segments) => {
    return segments.map((seg: any) => ({
      key: seg.key,
      durationMinutes: 15,
      distanceMeters: 3000,
      transfers: 1,
    }));
  }),
}));

describe('Public Transit Algorithm Integration Tests', () => {
  const createMockWaypoints = (count: number): Waypoint[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `wp${i + 1}`,
      name: `Waypoint ${i + 1}`,
      coord: {
        lat: 37.5 + (i * 0.01),
        lng: 127.0 + (i * 0.01),
      },
      isFixed: false,
    }));
  };

  describe('Full Flow Tests', () => {
    it('should generate route for basic input', async () => {
      const input: TripInput = {
        tripId: 'test-trip-1',
        days: 3,
        start: { lat: 37.5665, lng: 126.978 },
        waypoints: createMockWaypoints(9),
      };

      const result = await generatePublicTransitRoute(input);

      expect(result).toBeDefined();
      expect(result.tripId).toBe('test-trip-1');
      expect(result.mode).toBe('OPEN');
      expect(result.clusters).toHaveLength(3);
      expect(result.dayPlans).toHaveLength(3);
      expect(result.segmentCosts.length).toBeGreaterThan(0);
    });

    it('should handle LOOP mode with lodging', async () => {
      const input: TripInput = {
        tripId: 'test-trip-2',
        days: 2,
        start: { lat: 37.5665, lng: 126.978 },
        lodging: { lat: 37.5500, lng: 127.000 },
        waypoints: createMockWaypoints(6),
      };

      const result = await generatePublicTransitRoute(input);

      expect(result.mode).toBe('LOOP');
      expect(result.dayPlans).toHaveLength(2);
    });

    it('should handle fixed waypoints', async () => {
      const waypoints = createMockWaypoints(9);
      waypoints[0].isFixed = true;
      waypoints[5].isFixed = true;

      const input: TripInput = {
        tripId: 'test-trip-3',
        days: 3,
        start: { lat: 37.5665, lng: 126.978 },
        waypoints,
      };

      const result = await generatePublicTransitRoute(input);

      // Fixed waypoints should be included in the route
      const allWaypointIds = result.dayPlans.flatMap(day => day.waypointOrder);
      expect(allWaypointIds).toContain('wp1');
      expect(allWaypointIds).toContain('wp6');
    });

    it('should handle daily time limit', async () => {
      const input: TripInput = {
        tripId: 'test-trip-4',
        days: 2,
        start: { lat: 37.5665, lng: 126.978 },
        waypoints: createMockWaypoints(10),
        dailyMaxMinutes: 60, // Very low limit
      };

      const result = await generatePublicTransitRoute(input);

      // Some waypoints should be excluded due to time limit
      const totalWaypoints = result.dayPlans.reduce(
        (sum, day) => sum + day.waypointOrder.length,
        0
      );
      expect(totalWaypoints).toBeLessThan(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle case where days > waypoints (N > M)', async () => {
      const input: TripInput = {
        tripId: 'test-edge-1',
        days: 5,
        start: { lat: 37.5665, lng: 126.978 },
        waypoints: createMockWaypoints(3),
      };

      const result = await generatePublicTransitRoute(input);

      // Should create clusters even if days > waypoints
      expect(result.clusters.length).toBeLessThanOrEqual(3);
      expect(result.dayPlans.length).toBeLessThanOrEqual(3);
    });

    it('should handle extreme coordinate dispersion', async () => {
      const waypoints: Waypoint[] = [
        { id: 'wp1', name: 'Seoul', coord: { lat: 37.5665, lng: 126.978 }, isFixed: false },
        { id: 'wp2', name: 'Busan', coord: { lat: 35.1796, lng: 129.0756 }, isFixed: false },
        { id: 'wp3', name: 'Jeju', coord: { lat: 33.4996, lng: 126.5312 }, isFixed: false },
        { id: 'wp4', name: 'Gangneung', coord: { lat: 37.7519, lng: 128.8761 }, isFixed: false },
      ];

      const input: TripInput = {
        tripId: 'test-edge-2',
        days: 2,
        start: { lat: 37.5665, lng: 126.978 },
        waypoints,
      };

      const result = await generatePublicTransitRoute(input);

      expect(result.clusters).toHaveLength(2);
      expect(result.dayPlans).toHaveLength(2);
    });

    it('should handle many fixed waypoints', async () => {
      const waypoints = createMockWaypoints(10);
      waypoints.forEach((wp, i) => {
        if (i < 7) wp.isFixed = true;
      });

      const input: TripInput = {
        tripId: 'test-edge-3',
        days: 3,
        start: { lat: 37.5665, lng: 126.978 },
        waypoints,
        dailyMaxMinutes: 300,
      };

      const result = await generatePublicTransitRoute(input);

      // All fixed waypoints should be included
      const allWaypointIds = result.dayPlans.flatMap(day => day.waypointOrder);
      const fixedIds = waypoints.filter(wp => wp.isFixed).map(wp => wp.id);
      fixedIds.forEach(id => {
        expect(allWaypointIds).toContain(id);
      });
    });

    it('should handle single waypoint', async () => {
      const input: TripInput = {
        tripId: 'test-edge-4',
        days: 1,
        start: { lat: 37.5665, lng: 126.978 },
        waypoints: createMockWaypoints(1),
      };

      const result = await generatePublicTransitRoute(input);

      expect(result.clusters).toHaveLength(1);
      expect(result.dayPlans).toHaveLength(1);
      expect(result.dayPlans[0].waypointOrder).toHaveLength(1);
    });

    it('should handle waypoints with importance and stayMinutes', async () => {
      const waypoints = createMockWaypoints(6);
      waypoints[0].importance = 5;
      waypoints[0].stayMinutes = 120;
      waypoints[1].importance = 1;
      waypoints[1].stayMinutes = 30;

      const input: TripInput = {
        tripId: 'test-edge-5',
        days: 2,
        start: { lat: 37.5665, lng: 126.978 },
        waypoints,
        dailyMaxMinutes: 200,
      };

      const result = await generatePublicTransitRoute(input);

      const allWaypointIds = result.dayPlans.flatMap(day => day.waypointOrder);

      // High importance waypoint should be prioritized
      if (allWaypointIds.length < 6) {
        expect(allWaypointIds).toContain('wp1'); // High importance
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid input', async () => {
      const input = {
        tripId: 'test-error-1',
        days: 0,
        start: { lat: 37.5665, lng: 126.978 },
        waypoints: [],
      } as TripInput;

      await expect(generatePublicTransitRoute(input)).rejects.toThrow();
    });

    it('should throw error for missing start coordinates', async () => {
      const input = {
        tripId: 'test-error-2',
        days: 2,
        waypoints: createMockWaypoints(4),
      } as any;

      await expect(generatePublicTransitRoute(input)).rejects.toThrow();
    });

    it('should handle empty waypoints after preprocessing', async () => {
      const invalidWaypoints: Waypoint[] = [
        { id: 'wp1', name: 'Invalid', coord: { lat: 91, lng: 126.978 }, isFixed: false },
        { id: 'wp2', name: 'Invalid', coord: { lat: 37.5665, lng: -181 }, isFixed: false },
      ];

      const input: TripInput = {
        tripId: 'test-error-3',
        days: 2,
        start: { lat: 37.5665, lng: 126.978 },
        waypoints: invalidWaypoints,
      };

      await expect(generatePublicTransitRoute(input)).rejects.toThrow('No valid waypoints');
    });
  });
});
