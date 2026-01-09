// ============================================
// Segment Cache with LRU and Coordinate-based Keys
// ============================================

import type { SegmentCost, LatLng } from "@/types";

interface CacheEntry {
  data: SegmentCost;
  timestamp: number;
}

/**
 * LRU Cache for segment costs
 * - Coordinate-based keys (not ID-based) for cross-user sharing
 * - TTL (Time To Live) for automatic expiration
 * - Max size limit to prevent memory bloat
 */
class SegmentCache {
  private cache: Map<string, CacheEntry>;
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 5000, ttlMinutes = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Create cache key from coordinates
   * Uses 3 decimal places (~100m precision) for better cache hit rate
   */
  private createKey(from: LatLng, to: LatLng): string {
    const lat1 = from.lat.toFixed(3);
    const lng1 = from.lng.toFixed(3);
    const lat2 = to.lat.toFixed(3);
    const lng2 = to.lng.toFixed(3);
    return `${lat1},${lng1}:${lat2},${lng2}`;
  }

  /**
   * Get cached segment cost
   */
  get(from: LatLng, to: LatLng): SegmentCost | null {
    const key = this.createKey(from, to);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Set cached segment cost
   */
  set(from: LatLng, to: LatLng, value: SegmentCost): void {
    const key = this.createKey(from, to);

    // Evict oldest if at max size
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if segment is cached
   */
  has(from: LatLng, to: LatLng): boolean {
    return this.get(from, to) !== null;
  }

  /**
   * Clear all cached segments
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}

// Global cache instance
export const segmentCache = new SegmentCache(5000, 60); // 5000 segments, 60min TTL

// Cleanup every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    segmentCache.cleanup();
  }, 10 * 60 * 1000);
}
