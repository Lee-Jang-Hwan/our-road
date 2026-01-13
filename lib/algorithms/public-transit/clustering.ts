// ============================================
// Balanced Clustering (Public Transit Algorithm)
// ============================================

import type { Cluster, Waypoint, LatLng } from "@/types";
import { calculateCentroid, calculateDistance } from "../utils/geo";

interface ClusterBuilder {
  seed: Waypoint;
  waypoints: Waypoint[];
}

export function selectDistributedSeeds(
  waypoints: Waypoint[],
  k: number
): Waypoint[] {
  if (waypoints.length === 0 || k <= 0) {
    return [];
  }

  const centroid = calculateCentroid(waypoints.map((wp) => wp.coord));
  const seeds: Waypoint[] = [];

  const first = [...waypoints].sort(
    (a, b) =>
      calculateDistance(b.coord, centroid) -
      calculateDistance(a.coord, centroid)
  )[0];
  seeds.push(first);

  while (seeds.length < k) {
    let nextSeed: Waypoint | null = null;
    let maxDistance = -Infinity;

    for (const waypoint of waypoints) {
      const nearestDistance = Math.min(
        ...seeds.map((seed) => calculateDistance(seed.coord, waypoint.coord))
      );

      if (nearestDistance > maxDistance) {
        maxDistance = nearestDistance;
        nextSeed = waypoint;
      }
    }

    if (!nextSeed) break;
    if (!seeds.find((seed) => seed.id === nextSeed.id)) {
      seeds.push(nextSeed);
    } else {
      break;
    }
  }

  return seeds.slice(0, k);
}

export function initializeClusters(seeds: Waypoint[]): ClusterBuilder[] {
  return seeds.map((seed) => ({
    seed,
    waypoints: [seed],
  }));
}

export function findNearestCluster(
  clusters: ClusterBuilder[],
  waypoint: Waypoint,
  maxCapacity: number
): ClusterBuilder {
  let nearest: ClusterBuilder | null = null;
  let nearestDistance = Infinity;

  for (const cluster of clusters) {
    if (cluster.waypoints.length >= maxCapacity) {
      continue;
    }
    const distance = calculateDistance(cluster.seed.coord, waypoint.coord);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = cluster;
    }
  }

  if (nearest) {
    return nearest;
  }

  return clusters.reduce((best, cluster) => {
    const distance = calculateDistance(cluster.seed.coord, waypoint.coord);
    if (!best) return cluster;
    const bestDistance = calculateDistance(best.seed.coord, waypoint.coord);
    return distance < bestDistance ? cluster : best;
  }, clusters[0]);
}

export function balanceClusterSizes(
  clusters: ClusterBuilder[],
  targetPerDay: number
): void {
  const maxIterations = 100;
  const flexibilityRange = 0.4; // Allow ±40% from target

  const maxSize = Math.ceil(targetPerDay * (1 + flexibilityRange));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    clusters.sort((a, b) => b.waypoints.length - a.waypoints.length);

    const largest = clusters[0];
    const smallest = clusters[clusters.length - 1];

    const sizeDiff = largest.waypoints.length - smallest.waypoints.length;

    // Stop if balanced enough OR largest is within acceptable range
    if (sizeDiff <= 1 || largest.waypoints.length <= maxSize) {
      break;
    }

    // Only force balancing if largest exceeds max threshold significantly
    if (largest.waypoints.length <= maxSize + 1) {
      break;
    }

    const smallestCentroid = calculateCentroid(
      smallest.waypoints.map((wp) => wp.coord)
    );

    // Find movable waypoints (not seed, not fixed, not dayLocked)
    const movableWaypoints = largest.waypoints.filter(
      (wp) => wp.id !== largest.seed.id && !wp.isFixed && !wp.dayLock
    );

    if (movableWaypoints.length === 0) {
      break;
    }

    const candidate = movableWaypoints
      .map((wp) => ({
        wp,
        distance: calculateDistance(wp.coord, smallestCentroid),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (!candidate) {
      break;
    }

    // Only move if it doesn't create a huge detour
    const largestCentroid = calculateCentroid(largest.waypoints.map((wp) => wp.coord));
    const distanceFromLargest = calculateDistance(candidate.wp.coord, largestCentroid);

    // Don't move if it's >3x closer to current cluster
    if (candidate.distance > distanceFromLargest * 3) {
      break;
    }

    largest.waypoints = largest.waypoints.filter(
      (wp) => wp.id !== candidate.wp.id
    );
    smallest.waypoints.push(candidate.wp);
  }
}

export function ensureFixedWaypointsIncluded(
  clusters: ClusterBuilder[],
  fixedIds: string[],
  allWaypoints: Waypoint[]
): void {
  const assignedIds = new Set(
    clusters.flatMap((cluster) => cluster.waypoints.map((wp) => wp.id))
  );

  for (const fixedId of fixedIds) {
    if (assignedIds.has(fixedId)) continue;

    // Find from original waypoints, not from already assigned ones
    const fixedWaypoint = allWaypoints.find((wp) => wp.id === fixedId);
    if (!fixedWaypoint) continue;

    const target = findNearestCluster(clusters, fixedWaypoint, Infinity);
    target.waypoints.push(fixedWaypoint);
    assignedIds.add(fixedId);
  }
}

export function balancedClustering(params: {
  waypoints: Waypoint[];
  N: number;
  targetPerDay: number;
  fixedIds: string[];
}): Cluster[] {
  const { waypoints, N, targetPerDay, fixedIds } = params;

  if (waypoints.length === 0) {
    throw new Error("Cannot cluster empty waypoints");
  }

  if (N <= 0) {
    throw new Error("Number of days must be positive");
  }

  // fixedDate가 있는 waypoint는 클러스터링에서 제외
  // (이들은 나중에 올바른 날짜의 클러스터에 강제 배정됨)
  const waypointsToCluster = waypoints.filter(
    (wp) => !(wp.isFixed && wp.fixedDate)
  );

  // 고정 일정이 모두 제외되어 클러스터링할 waypoint가 없는 경우 처리
  if (waypointsToCluster.length === 0) {
    // 모든 waypoint가 고정 일정인 경우, 빈 클러스터들을 반환
    // (고정 일정은 나중에 assignFixedWaypointsToClusters에서 배정됨)
    return Array.from({ length: N }, (_, index) => ({
      clusterId: `cluster-${index + 1}`,
      dayIndex: index + 1,
      waypointIds: [],
      centroid: { lat: 0, lng: 0 }, // 임시 값, 나중에 재계산됨
    }));
  }

  const actualDays = Math.min(N, waypointsToCluster.length);
  const seeds = selectDistributedSeeds(waypointsToCluster, actualDays);

  if (seeds.length === 0) {
    throw new Error("Failed to select seeds for clustering");
  }

  const clusters = initializeClusters(seeds);

  // Assign waypoints to clusters (fixedDate가 없는 waypoint만)
  for (const waypoint of waypointsToCluster) {
    if (seeds.find((seed) => seed.id === waypoint.id)) {
      continue;
    }
    const nearest = findNearestCluster(clusters, waypoint, targetPerDay);
    nearest.waypoints.push(waypoint);
  }

  balanceClusterSizes(clusters, targetPerDay);
  // fixedDate가 없는 고정 일정만 ensureFixedWaypointsIncluded에서 처리
  // (fixedDate가 있는 것은 나중에 assignFixedWaypointsToClusters에서 처리)
  const fixedIdsWithoutDate = fixedIds.filter((id) => {
    const wp = waypoints.find((w) => w.id === id);
    return wp && !wp.fixedDate;
  });
  ensureFixedWaypointsIncluded(clusters, fixedIdsWithoutDate, waypoints);

  // Filter out empty clusters
  const nonEmptyClusters = clusters.filter((c) => c.waypoints.length > 0);

  if (nonEmptyClusters.length === 0) {
    throw new Error("All clusters are empty after balancing");
  }

  return nonEmptyClusters.map((cluster, index) => ({
    clusterId: `cluster-${index + 1}`,
    dayIndex: index + 1,
    waypointIds: cluster.waypoints.map((wp) => wp.id),
    centroid: calculateCentroid(cluster.waypoints.map((wp) => wp.coord)),
  }));
}

const DEFAULT_STAY_MINUTES = 60;
const DEFAULT_K_FOR_RADIUS = 3;
const DEFAULT_RADIUS_MULTIPLIER = 1.2;
const DEFAULT_MINUTES_PER_KM = 5;
const SIZE_OVERFLOW_PENALTY = 5;
const MINUTES_OVERFLOW_PENALTY = 1;

export interface Zone {
  zoneId: string;
  waypointIds: string[];
  centroid: LatLng;
  estimatedMinutes: number;
  hasFixed: boolean;
  fixedDayIndex?: number;
}

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = Array.from({ length: size }, () => 0);
  }

  find(index: number): number {
    if (this.parent[index] !== index) {
      this.parent[index] = this.find(this.parent[index]);
    }
    return this.parent[index];
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;

    if (this.rank[rootA] < this.rank[rootB]) {
      this.parent[rootA] = rootB;
      return;
    }

    if (this.rank[rootA] > this.rank[rootB]) {
      this.parent[rootB] = rootA;
      return;
    }

    this.parent[rootB] = rootA;
    this.rank[rootA] += 1;
  }
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function estimateRadiusMeters(
  waypoints: Waypoint[],
  kForRadius: number,
  radiusMultiplier: number
): number {
  if (waypoints.length <= 1) return 0;

  const k = Math.max(1, Math.floor(kForRadius));
  const distances: number[] = [];

  for (let i = 0; i < waypoints.length; i++) {
    const current = waypoints[i];
    const neighborDistances: number[] = [];
    for (let j = 0; j < waypoints.length; j++) {
      if (i === j) continue;
      const other = waypoints[j];
      neighborDistances.push(calculateDistance(current.coord, other.coord));
    }
    neighborDistances.sort((a, b) => a - b);
    const index = Math.min(k - 1, neighborDistances.length - 1);
    if (index >= 0) {
      distances.push(neighborDistances[index]);
    }
  }

  const median = calculateMedian(distances);
  if (!Number.isFinite(median) || median <= 0) return 0;
  return median * radiusMultiplier;
}

function buildZoneFromIds(
  zoneId: string,
  waypointIds: string[],
  waypointMap: Map<string, Waypoint>
): Zone {
  const coords: LatLng[] = [];
  let estimatedMinutes = 0;
  let hasFixed = false;

  for (const id of waypointIds) {
    const waypoint = waypointMap.get(id);
    if (!waypoint) continue;
    coords.push(waypoint.coord);
    estimatedMinutes += waypoint.stayMinutes ?? DEFAULT_STAY_MINUTES;
    hasFixed = hasFixed || waypoint.isFixed || waypoint.fixedDate !== undefined;
  }

  const centroid =
    coords.length > 0 ? calculateCentroid(coords) : { lat: 0, lng: 0 };

  return {
    zoneId,
    waypointIds,
    centroid,
    estimatedMinutes,
    hasFixed,
  };
}

export function buildZones(params: {
  waypoints: Waypoint[];
  kForRadius?: number;
  radiusMultiplier?: number;
}): Zone[] {
  const {
    waypoints,
    kForRadius = DEFAULT_K_FOR_RADIUS,
    radiusMultiplier = DEFAULT_RADIUS_MULTIPLIER,
  } = params;

  if (waypoints.length === 0) return [];

  const radius = estimateRadiusMeters(waypoints, kForRadius, radiusMultiplier);
  const waypointMap = new Map<string, Waypoint>(
    waypoints.map((wp) => [wp.id, wp])
  );

  if (radius <= 0) {
    return [
      buildZoneFromIds(
        "zone-1",
        waypoints.map((wp) => wp.id),
        waypointMap
      ),
    ];
  }

  const uf = new UnionFind(waypoints.length);

  for (let i = 0; i < waypoints.length; i++) {
    for (let j = i + 1; j < waypoints.length; j++) {
      const distance = calculateDistance(
        waypoints[i].coord,
        waypoints[j].coord
      );
      if (distance <= radius) {
        uf.union(i, j);
      }
    }
  }

  const groups = new Map<number, string[]>();
  for (let i = 0; i < waypoints.length; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(waypoints[i].id);
  }

  let index = 0;
  const zones: Zone[] = [];
  for (const waypointIds of groups.values()) {
    index += 1;
    zones.push(buildZoneFromIds(`zone-${index}`, waypointIds, waypointMap));
  }

  return zones;
}

function splitZoneByFixedDay(
  zone: Zone,
  waypointMap: Map<string, Waypoint>,
  fixedDayById: Map<string, number>
): Zone[] {
  const dayGroups = new Map<number, string[]>();
  const unfixedIds: string[] = [];

  for (const id of zone.waypointIds) {
    const fixedDay = fixedDayById.get(id);
    if (fixedDay === undefined) {
      unfixedIds.push(id);
      continue;
    }
    if (!dayGroups.has(fixedDay)) {
      dayGroups.set(fixedDay, []);
    }
    dayGroups.get(fixedDay)!.push(id);
  }

  if (dayGroups.size === 0) {
    return [zone];
  }

  if (dayGroups.size === 1) {
    const [[dayIndex, ids]] = Array.from(dayGroups.entries());
    const combinedIds = unfixedIds.length > 0 ? [...ids, ...unfixedIds] : ids;
    const updated = buildZoneFromIds(zone.zoneId, combinedIds, waypointMap);
    updated.fixedDayIndex = dayIndex;
    return [updated];
  }

  const result: Zone[] = [];
  for (const [dayIndex, ids] of dayGroups.entries()) {
    const split = buildZoneFromIds(
      `${zone.zoneId}-fixed-${dayIndex + 1}`,
      ids,
      waypointMap
    );
    split.fixedDayIndex = dayIndex;
    result.push(split);
  }

  if (unfixedIds.length > 0) {
    result.push(
      buildZoneFromIds(`${zone.zoneId}-free`, unfixedIds, waypointMap)
    );
  }

  return result;
}

export function splitZoneIfOverLimit(params: {
  zone: Zone;
  waypointMap: Map<string, Waypoint>;
  dailyMaxMinutes?: number;
  maxSize: number;
}): Zone[] {
  const { zone, waypointMap, dailyMaxMinutes, maxSize } = params;
  const size = zone.waypointIds.length;
  const sizeLimit = Math.max(1, Math.floor(maxSize));

  const needsSplit =
    size > sizeLimit ||
    (dailyMaxMinutes !== undefined &&
      dailyMaxMinutes > 0 &&
      zone.estimatedMinutes > dailyMaxMinutes);

  if (!needsSplit) {
    return [zone];
  }

  const coords = zone.waypointIds
    .map((id) => waypointMap.get(id))
    .filter((wp): wp is Waypoint => wp !== undefined)
    .map((wp) => wp.coord);

  const latRange =
    coords.length > 0
      ? Math.max(...coords.map((c) => c.lat)) -
        Math.min(...coords.map((c) => c.lat))
      : 0;
  const lngRange =
    coords.length > 0
      ? Math.max(...coords.map((c) => c.lng)) -
        Math.min(...coords.map((c) => c.lng))
      : 0;
  const axis: "lat" | "lng" = latRange >= lngRange ? "lat" : "lng";

  const sortedIds = [...zone.waypointIds].sort((a, b) => {
    const aCoord = waypointMap.get(a)?.coord;
    const bCoord = waypointMap.get(b)?.coord;
    if (!aCoord || !bCoord) return 0;
    return axis === "lat" ? aCoord.lat - bCoord.lat : aCoord.lng - bCoord.lng;
  });

  const minutesLimit =
    dailyMaxMinutes && dailyMaxMinutes > 0 ? dailyMaxMinutes : undefined;

  const sizeBuckets = Math.ceil(size / sizeLimit);
  const minutesBuckets = minutesLimit
    ? Math.ceil(zone.estimatedMinutes / minutesLimit)
    : 1;
  const bucketCount = Math.max(2, sizeBuckets, minutesBuckets);

  const chunks: Zone[] = [];
  const chunkSize = Math.ceil(sortedIds.length / bucketCount);
  let cursor = 0;

  for (let i = 0; i < bucketCount; i++) {
    const slice = sortedIds.slice(cursor, cursor + chunkSize);
    if (slice.length === 0) break;
    cursor += chunkSize;
    chunks.push(buildZoneFromIds(`${zone.zoneId}-part-${i + 1}`, slice, waypointMap));
  }

  return chunks.length > 0 ? chunks : [zone];
}

export function assignZonesToDays(params: {
  zones: Zone[];
  days: number;
  anchors: Array<{ start?: LatLng; end?: LatLng }>;
  targetPerDay: number;
  dailyMaxMinutes?: number;
}): Zone[][] {
  const { zones, days, anchors, targetPerDay, dailyMaxMinutes } = params;
  const dayZones: Zone[][] = Array.from({ length: days }, () => []);
  const daySizes = Array.from({ length: days }, () => 0);
  const dayMinutes = Array.from({ length: days }, () => 0);

  const fixedZones: Zone[] = [];
  const flexibleZones: Zone[] = [];

  for (const zone of zones) {
    if (
      zone.fixedDayIndex !== undefined &&
      zone.fixedDayIndex >= 0 &&
      zone.fixedDayIndex < days
    ) {
      fixedZones.push(zone);
    } else {
      flexibleZones.push(zone);
    }
  }

  for (const zone of fixedZones) {
    const dayIndex = zone.fixedDayIndex!;
    dayZones[dayIndex].push(zone);
    daySizes[dayIndex] += zone.waypointIds.length;
    dayMinutes[dayIndex] += zone.estimatedMinutes;
  }

  const sortedZones = [...flexibleZones].sort(
    (a, b) => b.estimatedMinutes - a.estimatedMinutes
  );

  for (const zone of sortedZones) {
    let bestDay = 0;
    let bestScore = Infinity;

    for (let dayIndex = 0; dayIndex < days; dayIndex++) {
      const anchor = anchors[dayIndex];
      const distanceCost = calculateAnchorCost(zone.centroid, anchor);
      const sizeOverflow = Math.max(
        0,
        daySizes[dayIndex] + zone.waypointIds.length - targetPerDay
      );
      const minutesOverflow =
        dailyMaxMinutes && dailyMaxMinutes > 0
          ? Math.max(
              0,
              dayMinutes[dayIndex] + zone.estimatedMinutes - dailyMaxMinutes
            )
          : 0;
      const score =
        distanceCost +
        sizeOverflow * SIZE_OVERFLOW_PENALTY +
        minutesOverflow * MINUTES_OVERFLOW_PENALTY;

      if (score < bestScore) {
        bestScore = score;
        bestDay = dayIndex;
      }
    }

    dayZones[bestDay].push(zone);
    daySizes[bestDay] += zone.waypointIds.length;
    dayMinutes[bestDay] += zone.estimatedMinutes;
  }

  return dayZones;
}

function calculateAnchorCost(
  centroid: LatLng,
  anchor?: { start?: LatLng; end?: LatLng }
): number {
  if (!anchor) return 0;
  let cost = 0;
  if (anchor.start) {
    cost += calculateDistance(centroid, anchor.start);
  }
  if (anchor.end) {
    cost += calculateDistance(centroid, anchor.end);
  }
  const distanceKm = cost / 1000;
  return distanceKm * DEFAULT_MINUTES_PER_KM;
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function buildFixedDayById(
  waypoints: Waypoint[],
  tripStartDate?: string
): Map<string, number> {
  const map = new Map<string, number>();
  const startDate = tripStartDate ? parseLocalDate(tripStartDate) : undefined;

  for (const waypoint of waypoints) {
    if (waypoint.dayLock) {
      map.set(waypoint.id, waypoint.dayLock - 1);
      continue;
    }

    if (waypoint.fixedDate && startDate) {
      const fixedDate = parseLocalDate(waypoint.fixedDate);
      const dayIndex = Math.floor(
        (fixedDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (dayIndex >= 0) {
        map.set(waypoint.id, dayIndex);
      }
    }
  }

  return map;
}

function buildClustersFromDayZones(
  dayZones: Zone[][],
  waypointMap: Map<string, Waypoint>
): Cluster[] {
  return dayZones
    .map((zones, index) => {
      const waypointIds = zones.flatMap((zone) => zone.waypointIds);
      const coords = waypointIds
        .map((id) => waypointMap.get(id))
        .filter((wp): wp is Waypoint => wp !== undefined)
        .map((wp) => wp.coord);
      const centroid =
        coords.length > 0 ? calculateCentroid(coords) : { lat: 0, lng: 0 };
      return {
        clusterId: `cluster-${index + 1}`,
        dayIndex: index + 1,
        waypointIds,
        centroid,
      };
    })
    .filter((cluster) => cluster.waypointIds.length > 0);
}

export function zoneClustering(params: {
  waypoints: Waypoint[];
  N: number;
  targetPerDay: number;
  fixedIds: string[];
  tripStartDate?: string;
  dailyMaxMinutes?: number;
  anchors: Array<{ start?: LatLng; end?: LatLng }>;
}): Cluster[] {
  const {
    waypoints,
    N,
    targetPerDay,
    fixedIds,
    tripStartDate,
    dailyMaxMinutes,
    anchors,
  } = params;
  const debugEnabled = process.env.PUBLIC_TRANSIT_DEBUG === "1";
  const logDebug = (message: string, data?: unknown) => {
    if (!debugEnabled) return;
    if (data === undefined) {
      console.log(`[zoneClustering] ${message}`);
      return;
    }
    console.log(`[zoneClustering] ${message}`, data);
  };

  if (waypoints.length === 0) {
    throw new Error("Cannot cluster empty waypoints");
  }

  if (N <= 0) {
    throw new Error("Number of days must be positive");
  }

  const actualDays = Math.min(N, waypoints.length);
  const fixedDayById = buildFixedDayById(waypoints, tripStartDate);
  const fixedIdSet = new Set(fixedIds);
  const waypointMap = new Map<string, Waypoint>(
    waypoints.map((wp) => [wp.id, wp])
  );

  let zones = buildZones({ waypoints });
  zones = zones.map((zone) => ({
    ...zone,
    hasFixed:
      zone.hasFixed ||
      zone.waypointIds.some((waypointId) => fixedIdSet.has(waypointId)),
  }));
  zones = zones.flatMap((zone) =>
    splitZoneByFixedDay(zone, waypointMap, fixedDayById)
  );
  zones = zones.flatMap((zone) =>
    splitZoneIfOverLimit({
      zone,
      waypointMap,
      dailyMaxMinutes,
      maxSize: Math.ceil(targetPerDay * 1.5),
    })
  );
  logDebug(
    "zones",
    zones.map((zone) => ({
      id: zone.zoneId,
      size: zone.waypointIds.length,
      estimatedMinutes: Math.round(zone.estimatedMinutes),
      hasFixed: zone.hasFixed,
      fixedDayIndex: zone.fixedDayIndex,
    }))
  );

  const dayAnchors = Array.from({ length: actualDays }, (_, index) => {
    return anchors[index] ?? {};
  });

  const dayZones = assignZonesToDays({
    zones,
    days: actualDays,
    anchors: dayAnchors,
    targetPerDay,
    dailyMaxMinutes,
  });
  logDebug(
    "day assignment",
    dayZones.map((day, index) => ({
      dayIndex: index + 1,
      zoneIds: day.map((zone) => zone.zoneId),
      waypointCount: day.reduce(
        (sum, zone) => sum + zone.waypointIds.length,
        0
      ),
      estimatedMinutes: Math.round(
        day.reduce((sum, zone) => sum + zone.estimatedMinutes, 0)
      ),
    }))
  );

  return buildClustersFromDayZones(dayZones, waypointMap);
}
