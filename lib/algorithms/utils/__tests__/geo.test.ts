import { calculateDistance, calculateCentroid } from '../geo';
import type { LatLng } from '@/types';

describe('geo utilities', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const pointA: LatLng = { lat: 37.5665, lng: 126.978 }; // Seoul City Hall
      const pointB: LatLng = { lat: 37.5511, lng: 126.9882 }; // Gangnam Station

      const distance = calculateDistance(pointA, pointB);

      // Expected distance: approximately 1.9 km
      expect(distance).toBeGreaterThan(1500);
      expect(distance).toBeLessThan(2500);
    });

    it('should return 0 for same points', () => {
      const point: LatLng = { lat: 37.5665, lng: 126.978 };
      const distance = calculateDistance(point, point);

      expect(distance).toBe(0);
    });

    it('should handle coordinates at different hemispheres', () => {
      const point1: LatLng = { lat: 40.7128, lng: -74.006 }; // New York
      const point2: LatLng = { lat: -33.8688, lng: 151.2093 }; // Sydney

      const distance = calculateDistance(point1, point2);

      // Expected distance: approximately 16,000 km
      expect(distance).toBeGreaterThan(15000000);
      expect(distance).toBeLessThan(17000000);
    });
  });

  describe('calculateCentroid', () => {
    it('should calculate centroid of multiple points', () => {
      const points: LatLng[] = [
        { lat: 37.5, lng: 127.0 },
        { lat: 37.6, lng: 127.1 },
        { lat: 37.4, lng: 126.9 },
      ];

      const centroid = calculateCentroid(points);

      expect(centroid.lat).toBeCloseTo(37.5, 1);
      expect(centroid.lng).toBeCloseTo(127.0, 1);
    });

    it('should return the point itself for single point', () => {
      const points: LatLng[] = [{ lat: 37.5665, lng: 126.978 }];

      const centroid = calculateCentroid(points);

      expect(centroid.lat).toBe(37.5665);
      expect(centroid.lng).toBe(126.978);
    });

    it('should throw error for empty array', () => {
      const points: LatLng[] = [];

      expect(() => calculateCentroid(points)).toThrow('Cannot calculate centroid of empty points array');
    });
  });
});
