// ============================================
// Within Cluster Ordering
// ============================================

import type { Cluster, Waypoint, LatLng } from "@/types";
import { calculateDirectionVector, calculateDistance, projectOntoAxis } from "../utils/geo";
import { doSegmentsIntersect } from "../utils/route-analysis";

export function calculateAxis(centroid: LatLng, endAnchor: LatLng) {
  return calculateDirectionVector(centroid, endAnchor);
}

/**
 * 시간(HH:MM)을 분으로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function orderWithinClusterOneDirection(params: {
  cluster: Cluster;
  startAnchor: LatLng;
  endAnchor: LatLng;
  waypoints: Map<string, Waypoint>;
}): string[] {
  const { cluster, startAnchor, endAnchor, waypoints } = params;
  const waypointList = cluster.waypointIds
    .map((id) => waypoints.get(id))
    .filter((wp): wp is Waypoint => Boolean(wp));

  if (waypointList.length <= 1) {
    return waypointList.map((wp) => wp.id);
  }

  // 고정 시간이 있는 경유지와 없는 경유지 분리
  const fixedTimeWaypoints = waypointList.filter(
    (wp) => wp.isFixed && wp.fixedStartTime
  );
  const flexibleWaypoints = waypointList.filter(
    (wp) => !wp.isFixed || !wp.fixedStartTime
  );

  // 고정 시간 경유지를 시간 순으로 정렬
  fixedTimeWaypoints.sort((a, b) => {
    const timeA = a.fixedStartTime ? timeToMinutes(a.fixedStartTime) : 0;
    const timeB = b.fixedStartTime ? timeToMinutes(b.fixedStartTime) : 0;
    return timeA - timeB;
  });

  // 유연한 경유지는 기존 로직으로 정렬
  const axis = calculateDirectionVector(startAnchor, endAnchor);
  const projected = flexibleWaypoints.map((wp) => ({
    wp,
    id: wp.id,
    projection: projectOntoAxis(wp.coord, axis),
    distanceToStart: calculateDistance(wp.coord, startAnchor),
    distanceToEnd: calculateDistance(wp.coord, endAnchor),
  }));

  const EPS = 1e-6;
  projected.sort((a, b) => {
    if (Math.abs(a.projection - b.projection) < EPS) {
      return a.distanceToStart - b.distanceToStart;
    }
    return a.projection - b.projection;
  });

  // 간단한 전략: 고정 시간 경유지를 시간 순서대로 배치하고,
  // 유연한 경유지들을 그 사이사이에 최적으로 배치
  // (복잡한 최적화는 향후 개선)
  
  if (fixedTimeWaypoints.length === 0) {
    // 고정 시간이 없으면 기존 로직
    const orderedIds = projected.map((item) => item.id);
    return minimize2OptCrossing(orderedIds, waypoints);
  }

  // 고정 시간이 있는 경우: 시간 순서를 우선하되, 
  // 유연한 경유지들을 거리 기준으로 삽입
  const result: string[] = [];
  let flexIndex = 0;

  for (let i = 0; i < fixedTimeWaypoints.length; i++) {
    const fixedWp = fixedTimeWaypoints[i];
    
    // 현재 고정 경유지 이전에 방문 가능한 유연한 경유지들 추가
    // (간단하게 거리 기준으로 판단)
    while (flexIndex < projected.length) {
      const flexWp = projected[flexIndex].wp;
      const distToFixed = calculateDistance(flexWp.coord, fixedWp.coord);
      
      // 다음 고정 경유지가 있는지 확인
      const nextFixed = fixedTimeWaypoints[i + 1];
      if (nextFixed) {
        const distToNext = calculateDistance(flexWp.coord, nextFixed.coord);
        // 다음 고정 지점에 더 가까우면 나중에 추가
        if (distToNext < distToFixed) {
          break;
        }
      }
      
      result.push(flexWp.id);
      flexIndex++;
    }
    
    // 고정 경유지 추가
    result.push(fixedWp.id);
  }

  // 남은 유연한 경유지들 추가
  while (flexIndex < projected.length) {
    result.push(projected[flexIndex].id);
    flexIndex++;
  }

  console.log(
    `[orderWithinCluster] Fixed time waypoints: ${fixedTimeWaypoints.length}, Flexible: ${flexibleWaypoints.length}`
  );

  return minimize2OptCrossing(result, waypoints);
}

export function minimize2OptCrossing(
  order: string[],
  waypoints: Map<string, Waypoint>
): string[] {
  const route = [...order];
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  // 고정 시간이 있는 경유지의 인덱스를 추적
  const fixedTimeIndices = new Set<number>();
  route.forEach((id, idx) => {
    const wp = waypoints.get(id);
    if (wp?.isFixed && wp.fixedStartTime) {
      fixedTimeIndices.add(idx);
    }
  });

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations += 1;

    for (let i = 0; i < route.length - 3; i++) {
      for (let j = i + 2; j < route.length - 1; j++) {
        // 고정 시간 경유지가 포함된 구간은 순서 변경 금지
        let hasFixedInRange = false;
        for (let k = i + 1; k <= j; k++) {
          if (fixedTimeIndices.has(k)) {
            hasFixedInRange = true;
            break;
          }
        }
        if (hasFixedInRange) continue;

        const a1 = waypoints.get(route[i]);
        const a2 = waypoints.get(route[i + 1]);
        const b1 = waypoints.get(route[j]);
        const b2 = waypoints.get(route[j + 1]);

        if (!a1 || !a2 || !b1 || !b2) continue;
        if (doSegmentsIntersect(a1.coord, a2.coord, b1.coord, b2.coord)) {
          const reversed = route
            .slice(i + 1, j + 1)
            .reverse();
          route.splice(i + 1, j - i, ...reversed);
          improved = true;
        }
      }
    }
  }

  return route;
}
