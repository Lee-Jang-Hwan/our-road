import { detectAnomalousSegments, applyLocalFixes } from '../anomaly-detection';
import type { SegmentCost, DayPlan } from '@/types';

describe('anomaly-detection', () => {
  describe('detectAnomalousSegments', () => {
    it('should detect long duration segments', () => {
      const segmentCosts: SegmentCost[] = [
        {
          key: { fromId: 'wp1', toId: 'wp2' },
          durationMinutes: 30, // Exceeds 20 min threshold
          distanceMeters: 5000,
        },
      ];

      const warnings = detectAnomalousSegments(segmentCosts);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('LONG_DURATION');
    });

    it('should detect too many transfers', () => {
      const segmentCosts: SegmentCost[] = [
        {
          key: { fromId: 'wp1', toId: 'wp2' },
          durationMinutes: 15,
          distanceMeters: 3000,
          transfers: 3, // Exceeds 2 transfers threshold
        },
      ];

      const warnings = detectAnomalousSegments(segmentCosts);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('TOO_MANY_TRANSFERS');
    });

    it('should detect long wait time', () => {
      const segmentCosts: SegmentCost[] = [
        {
          key: { fromId: 'wp1', toId: 'wp2' },
          durationMinutes: 15,
          distanceMeters: 3000,
          waitTimeMinutes: 10, // Exceeds 8 min threshold
        },
      ];

      const warnings = detectAnomalousSegments(segmentCosts);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('LONG_WAIT_TIME');
    });

    it('should detect multiple anomalies in same segment', () => {
      const segmentCosts: SegmentCost[] = [
        {
          key: { fromId: 'wp1', toId: 'wp2' },
          durationMinutes: 25,
          distanceMeters: 5000,
          transfers: 3,
          waitTimeMinutes: 10,
        },
      ];

      const warnings = detectAnomalousSegments(segmentCosts);

      expect(warnings.length).toBeGreaterThan(1);
    });

    it('should return empty array for normal segments', () => {
      const segmentCosts: SegmentCost[] = [
        {
          key: { fromId: 'wp1', toId: 'wp2' },
          durationMinutes: 10,
          distanceMeters: 2000,
          transfers: 1,
        },
      ];

      const warnings = detectAnomalousSegments(segmentCosts);

      expect(warnings).toHaveLength(0);
    });
  });

  describe('applyLocalFixes', () => {
    it('should handle empty warnings array', () => {
      const dayPlans: DayPlan[] = [
        {
          dayIndex: 0,
          waypointOrder: ['wp1', 'wp2'],
          excludedWaypointIds: [],
        },
      ];

      // Should not throw
      expect(() => applyLocalFixes(dayPlans, [])).not.toThrow();
    });

    it('should log warnings and suggestions', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const dayPlans: DayPlan[] = [
        {
          dayIndex: 0,
          waypointOrder: ['wp1', 'wp2'],
          excludedWaypointIds: [],
        },
      ];

      const warnings = [
        {
          type: 'LONG_DURATION' as const,
          segment: {
            key: { fromId: 'wp1', toId: 'wp2' },
            durationMinutes: 30,
            distanceMeters: 5000,
          },
          suggestion: 'Consider alternative route',
        },
      ];

      applyLocalFixes(dayPlans, warnings);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
