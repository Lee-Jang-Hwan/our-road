import { preprocessWaypoints, determineTripMode } from '../preprocess';
import type { Waypoint, LatLng } from '@/types';

describe('preprocess', () => {
  describe('preprocessWaypoints', () => {
    it('should remove waypoints with invalid coordinates', () => {
      const waypoints: Waypoint[] = [
        {
          id: '1',
          name: 'Valid Point',
          coord: { lat: 37.5665, lng: 126.978 },
          isFixed: false,
        },
        {
          id: '2',
          name: 'Invalid Lat',
          coord: { lat: 91, lng: 126.978 },
          isFixed: false,
        },
        {
          id: '3',
          name: 'Invalid Lng',
          coord: { lat: 37.5665, lng: -181 },
          isFixed: false,
        },
      ];

      const result = preprocessWaypoints(waypoints);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should merge duplicate waypoints within 10m', () => {
      const waypoints: Waypoint[] = [
        {
          id: '1',
          name: 'Point A',
          coord: { lat: 37.5665, lng: 126.978 },
          isFixed: false,
        },
        {
          id: '2',
          name: 'Point B',
          coord: { lat: 37.56651, lng: 126.97801 }, // Very close to Point A
          isFixed: false,
        },
        {
          id: '3',
          name: 'Point C',
          coord: { lat: 37.5, lng: 127.0 }, // Far from others
          isFixed: false,
        },
      ];

      const result = preprocessWaypoints(waypoints);

      expect(result.length).toBeLessThan(waypoints.length);
      expect(result.some((wp) => wp.name.includes(' / '))).toBe(true);
    });

    it('should preserve all waypoints if they are far apart', () => {
      const waypoints: Waypoint[] = [
        {
          id: '1',
          name: 'Point A',
          coord: { lat: 37.5665, lng: 126.978 },
          isFixed: false,
        },
        {
          id: '2',
          name: 'Point B',
          coord: { lat: 37.5, lng: 127.0 },
          isFixed: false,
        },
        {
          id: '3',
          name: 'Point C',
          coord: { lat: 37.6, lng: 127.1 },
          isFixed: false,
        },
      ];

      const result = preprocessWaypoints(waypoints);

      expect(result).toHaveLength(3);
    });
  });

  describe('determineTripMode', () => {
    it('should return LOOP when lodging is provided', () => {
      const lodging: LatLng = { lat: 37.5665, lng: 126.978 };

      const mode = determineTripMode(lodging);

      expect(mode).toBe('LOOP');
    });

    it('should return LOOP when start equals end', () => {
      const start: LatLng = { lat: 37.5665, lng: 126.978 };
      const end: LatLng = { lat: 37.5665, lng: 126.978 };

      const mode = determineTripMode(undefined, start, end);

      expect(mode).toBe('LOOP');
    });

    it('should return OPEN when start and end are different', () => {
      const start: LatLng = { lat: 37.5665, lng: 126.978 };
      const end: LatLng = { lat: 37.5, lng: 127.0 };

      const mode = determineTripMode(undefined, start, end);

      expect(mode).toBe('OPEN');
    });

    it('should return OPEN when no lodging and no end', () => {
      const start: LatLng = { lat: 37.5665, lng: 126.978 };

      const mode = determineTripMode(undefined, start);

      expect(mode).toBe('OPEN');
    });
  });
});
