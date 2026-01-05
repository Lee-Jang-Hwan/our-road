// ============================================
// Enrich Transit Routes (?以묎탳??寃쎈줈 ?곸꽭 ?뺣낫 議고쉶)
// ============================================

/**
 * @fileoverview
 * 理쒖쟻???꾨즺 ??理쒖쥌 寃쎈줈????댁꽌留?ODsay API瑜??몄텧?섏뿬
 * ?以묎탳???곸꽭 ?뺣낫(?대━?쇱씤, ?섏듅 ?뺣낫, ?붽툑 ??瑜?異붽??⑸땲??
 *
 * ??紐⑤뱢? ODsay API ?몄텧 ?잛닔瑜?理쒖냼?뷀븯湲??꾪빐 ?ㅺ퀎?섏뿀?듬땲??
 * - 湲곗〈: n 횞 (n-1) ?몄텧 (紐⑤뱺 ?띿뿉 ???
 * - 媛쒖꽑: 理쒖쥌 寃쎈줈??n-1 援ш컙????댁꽌留??몄텧
 */

import type { Coordinate } from "@/types/place";
import type { TransportMode, TransitDetails } from "@/types/route";
import type { DistanceMatrix } from "@/types/optimize";
import { getBestTransitRouteWithDetails } from "@/lib/api/odsay";
import { getTmapWalkingRoute } from "@/lib/api/tmap";
import { haversineDistance, estimateDuration } from "@/lib/utils/haversine";
import { batchProcess, tryOrNull } from "@/lib/utils/retry";

// ============================================
// Types
// ============================================

/**
 * ?以묎탳???곸꽭 ?뺣낫瑜?議고쉶??援ш컙
 */
export interface TransitEnrichmentSegment {
  /** 異쒕컻吏 ID (嫄곕━ ?됰젹 ?몃뜳?ㅼ슜) */
  fromId: string;
  /** ?꾩갑吏 ID (嫄곕━ ?됰젹 ?몃뜳?ㅼ슜) */
  toId: string;
  mode?: TransportMode;
  /** 異쒕컻吏 醫뚰몴 */
  fromCoord: Coordinate;
  /** ?꾩갑吏 醫뚰몴 */
  toCoord: Coordinate;
}

/**
 * 議고쉶???以묎탳???곸꽭 ?뺣낫
 */
export interface EnrichedTransitRoute {
  /** 異쒕컻吏 ID */
  fromId: string;
  /** ?꾩갑吏 ID */
  toId: string;
  /** ?몄퐫?⑸맂 ?대━?쇱씤 */
  polyline?: string;
  /** ?以묎탳???곸꽭 ?뺣낫 (?섏듅, ?붽툑, ?몄꽑 ?? */
  transitDetails?: TransitDetails;
  /** ?ㅼ젣 嫄곕━ (誘명꽣) - ODsay 湲곗? */
  distance?: number;
  /** ?ㅼ젣 ?뚯슂?쒓컙 (遺? - ODsay 湲곗? */
  duration?: number;
}

// ============================================
// Main Function
// ============================================

/**
 * 理쒖쥌 寃쎈줈 援ш컙?ㅼ뿉 ???ODsay ?以묎탳???곸꽭 ?뺣낫 議고쉶
 *
 * @param segments - 議고쉶??援ш컙 諛곗뿴
 * @param options - ?듭뀡
 * @returns 援ш컙蹂??곸꽭 ?뺣낫 Map (key: `${fromId}:${toId}`)
 *
 * @example
 * ```ts
 * const segments = [
 *   { fromId: "origin", toId: "place1", fromCoord: {...}, toCoord: {...} },
 *   { fromId: "place1", toId: "place2", fromCoord: {...}, toCoord: {...} },
 * ];
 *
 * const enriched = await enrichTransitRoutes(segments);
 *
 * const detail = enriched.get("origin:place1");
 * console.log(detail?.transitDetails?.transferCount);
 * ```
 */
export async function enrichTransitRoutes(
  segments: TransitEnrichmentSegment[],
  options?: {
    /** 諛곗튂 ?ш린 (湲곕낯: 3) */
    batchSize?: number;
    /** 諛곗튂 媛??쒕젅??(湲곕낯: 500ms) */
    batchDelay?: number;
    /** 吏꾪뻾 肄쒕갚 */
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<Map<string, EnrichedTransitRoute>> {
  const { batchSize = 3, batchDelay = 500, onProgress } = options ?? {};
  const results = new Map<string, EnrichedTransitRoute>();
  const walkingThresholdMeters = 500;

  if (segments.length === 0) {
    return results;
  }

  let completed = 0;
  const total = segments.length;

  await batchProcess(
    segments,
    async (segment) => {
      const key = createSegmentKey(segment.fromId, segment.toId);
      const straightDistance = haversineDistance(
        segment.fromCoord,
        segment.toCoord
      );

      if (straightDistance <= walkingThresholdMeters) {
        const tmapRoute = await tryOrNull(() =>
          getTmapWalkingRoute(segment.fromCoord, segment.toCoord)
        );

        if (tmapRoute) {
          results.set(key, {
            fromId: segment.fromId,
            toId: segment.toId,
            mode: "walking",
            polyline: tmapRoute.polyline,
            distance: tmapRoute.totalDistance,
            duration: tmapRoute.totalDuration,
          });
        } else {
          results.set(key, {
            fromId: segment.fromId,
            toId: segment.toId,
            mode: "walking",
            distance: Math.round(straightDistance),
            duration: estimateDuration(straightDistance, "walking"),
          });
        }

        completed++;
        onProgress?.(completed, total);
        return;
      }

      const routeWithDetails = await tryOrNull(() =>
        getBestTransitRouteWithDetails(segment.fromCoord, segment.toCoord)
      );

      if (routeWithDetails) {
        results.set(key, {
          fromId: segment.fromId,
          toId: segment.toId,
          mode: "public",
          polyline: routeWithDetails.polyline,
          transitDetails: routeWithDetails.details,
          distance: routeWithDetails.totalDistance,
          duration: routeWithDetails.totalDuration,
        });
      } else {
        // 議고쉶 ?ㅽ뙣 ??湲곕낯 ?뺣낫留????
        results.set(key, {
          fromId: segment.fromId,
          toId: segment.toId,
          mode: "public",
        });
      }

      completed++;
      onProgress?.(completed, total);
    },
    batchSize,
    batchDelay
  );

  return results;
}

// ============================================
// Distance Matrix Integration
// ============================================

/**
 * 嫄곕━ ?됰젹???以묎탳???곸꽭 ?뺣낫 異붽?
 *
 * 理쒖쟻???꾨즺 ???ㅼ젣 ?ъ슜?섎뒗 援ш컙?먮쭔 ODsay ?뺣낫瑜?議고쉶?섏뿬
 * 嫄곕━ ?됰젹??polylines, transitDetails 諛곗뿴???낅뜲?댄듃?⑸땲??
 *
 * @param distanceMatrix - 嫄곕━ ?됰젹 (mutated)
 * @param segments - 議고쉶??援ш컙 諛곗뿴
 * @param options - ?듭뀡
 */
export async function enrichDistanceMatrixWithTransit(
  distanceMatrix: DistanceMatrix,
  segments: TransitEnrichmentSegment[],
  options?: {
    batchSize?: number;
    batchDelay?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<void> {
  if (segments.length === 0) {
    return;
  }

  // ODsay ?곸꽭 ?뺣낫 議고쉶
  const enrichedMap = await enrichTransitRoutes(segments, options);

  // ?몃뜳??留??앹꽦
  const indexMap = new Map<string, number>();
  distanceMatrix.places.forEach((id, idx) => indexMap.set(id, idx));

  // polylines, transitDetails 諛곗뿴???놁쑝硫?珥덇린??
  const n = distanceMatrix.places.length;
  if (!distanceMatrix.polylines) {
    distanceMatrix.polylines = Array.from({ length: n }, () =>
      Array(n).fill(null)
    );
  }
  if (!distanceMatrix.transitDetails) {
    distanceMatrix.transitDetails = Array.from({ length: n }, () =>
      Array(n).fill(null)
    );
  }

  // 寃곌낵瑜?嫄곕━ ?됰젹??諛섏쁺
  for (const segment of segments) {
    const key = createSegmentKey(segment.fromId, segment.toId);
    const enriched = enrichedMap.get(key);

    const fromIdx = indexMap.get(segment.fromId);
    const toIdx = indexMap.get(segment.toId);

    if (fromIdx === undefined || toIdx === undefined) {
      continue;
    }

    if (enriched) {
      // ?대━?쇱씤 ?낅뜲?댄듃
      if (enriched.polyline) {
        distanceMatrix.polylines[fromIdx][toIdx] = enriched.polyline;
      }

      if (enriched.mode) {
        distanceMatrix.modes[fromIdx][toIdx] = enriched.mode;
      }

      // ?以묎탳???곸꽭 ?뺣낫 ?낅뜲?댄듃
      if (enriched.transitDetails) {
        distanceMatrix.transitDetails[fromIdx][toIdx] = enriched.transitDetails;
      } else if (enriched.mode === "walking") {
        distanceMatrix.transitDetails[fromIdx][toIdx] = null;
      }

      // ODsay 湲곗? 嫄곕━/?쒓컙?쇰줈 ?낅뜲?댄듃 (???뺥솗)
      if (enriched.distance !== undefined) {
        distanceMatrix.distances[fromIdx][toIdx] = enriched.distance;
      }
      if (enriched.duration !== undefined) {
        distanceMatrix.durations[fromIdx][toIdx] = enriched.duration;
      }
    }
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * 援ш컙 ???앹꽦
 */
export function createSegmentKey(fromId: string, toId: string): string {
  return `${fromId}:${toId}`;
}

/**
 * ?쇱옄蹂?遺꾨같 寃곌낵?먯꽌 ?ㅼ젣 ?ъ슜?섎뒗 援ш컙 異붿텧
 *
 * @param days - ?쇱옄蹂??μ냼 ID 諛곗뿴
 * @param nodeMap - ?몃뱶 留?(ID -> 醫뚰몴)
 * @param originId - 異쒕컻吏 ID
 * @param destinationId - ?꾩갑吏 ID
 * @param getAccommodationForDate - ?좎쭨蹂??숈냼 ?몃뱶 議고쉶 ?⑥닔
 * @param dates - ?좎쭨 諛곗뿴
 * @returns 議고쉶??援ш컙 諛곗뿴
 */
export function extractRouteSegments(
  days: string[][],
  nodeMap: Map<string, { coordinate: Coordinate }>,
  originId: string,
  destinationId: string,
  getAccommodationForDate: (date: string) => { id: string; coordinate: Coordinate } | undefined,
  dates: string[]
): TransitEnrichmentSegment[] {
  const segments: TransitEnrichmentSegment[] = [];
  const addedKeys = new Set<string>();

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const dayPlaceIds = days[dayIdx];
    const date = dates[dayIdx];
    const isFirstDay = dayIdx === 0;
    const isLastDay = dayIdx === days.length - 1;

    // ?ㅼ젣 諛⑸Ц ?μ냼留??꾪꽣留?(異쒕컻吏/?꾩갑吏/?숈냼 ?쒖쇅)
    const actualPlaceIds = dayPlaceIds.filter(
      (id) =>
        id !== "__origin__" &&
        id !== "__destination__" &&
        !id.startsWith("__accommodation_")
    );

    if (actualPlaceIds.length === 0) {
      continue;
    }

    // ?쒖옉??寃곗젙
    let startId: string;
    if (isFirstDay) {
      startId = originId;
    } else {
      const prevDate = dates[dayIdx - 1];
      const prevAccom = getAccommodationForDate(prevDate);
      startId = prevAccom?.id ?? originId;
    }

    // ?쒖옉??-> 泥??μ냼
    const firstPlaceId = actualPlaceIds[0];
    const startNode = nodeMap.get(startId);
    const firstNode = nodeMap.get(firstPlaceId);

    if (startNode && firstNode) {
      const key = createSegmentKey(startId, firstPlaceId);
      if (!addedKeys.has(key)) {
        segments.push({
          fromId: startId,
          toId: firstPlaceId,
          fromCoord: startNode.coordinate,
          toCoord: firstNode.coordinate,
        });
        addedKeys.add(key);
      }
    }

    // ?μ냼 媛??대룞
    for (let i = 0; i < actualPlaceIds.length - 1; i++) {
      const fromId = actualPlaceIds[i];
      const toId = actualPlaceIds[i + 1];
      const fromNode = nodeMap.get(fromId);
      const toNode = nodeMap.get(toId);

      if (fromNode && toNode) {
        const key = createSegmentKey(fromId, toId);
        if (!addedKeys.has(key)) {
          segments.push({
            fromId,
            toId,
            fromCoord: fromNode.coordinate,
            toCoord: toNode.coordinate,
          });
          addedKeys.add(key);
        }
      }
    }

    // 留덉?留??μ냼 -> ?앹젏
    const lastPlaceId = actualPlaceIds[actualPlaceIds.length - 1];
    let endId: string;

    if (isLastDay) {
      endId = destinationId;
    } else {
      const todayAccom = getAccommodationForDate(date);
      if (todayAccom) {
        endId = todayAccom.id;
      } else {
        // ?숈냼媛 ?놁쑝硫??앹젏 ?대룞 ?놁쓬
        continue;
      }
    }

    const lastNode = nodeMap.get(lastPlaceId);
    const endNode = nodeMap.get(endId);

    if (lastNode && endNode) {
      const key = createSegmentKey(lastPlaceId, endId);
      if (!addedKeys.has(key)) {
        segments.push({
          fromId: lastPlaceId,
          toId: endId,
          fromCoord: lastNode.coordinate,
          toCoord: endNode.coordinate,
        });
        addedKeys.add(key);
      }
    }
  }

  return segments;
}

