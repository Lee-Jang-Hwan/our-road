// ============================================
// 2-opt Improvement Algorithm (2-opt 개선 알고리즘)
// ============================================

import type { DistanceMatrix, TwoOptResult } from "@/types/optimize";
import type { OptimizeConfig, TwoOptSwap } from "./types";
import { createDistanceMatrixGetter } from "./distance-matrix";
import { calculateCost } from "@/types/optimize";

// ============================================
// Types
// ============================================

/**
 * 2-opt 알고리즘 옵션
 */
export interface TwoOptOptions {
  /** 최대 반복 횟수 (기본: 100) */
  maxIterations?: number;
  /** 개선 없을 때 조기 종료 횟수 (기본: 20) */
  noImprovementLimit?: number;
  /** 최소 개선율 임계값 (기본: 0.001 = 0.1%) */
  minImprovementThreshold?: number;
  /** 고정 시작 인덱스 (이 인덱스 이전은 스왑하지 않음) */
  fixedStartIndex?: number;
  /** 고정 끝 인덱스 (이 인덱스 이후는 스왑하지 않음) */
  fixedEndIndex?: number;
  /** 진행 콜백 */
  onProgress?: (iteration: number, currentCost: number, improvement: number) => void;
}

const DEFAULT_TWO_OPT_OPTIONS: Required<
  Omit<TwoOptOptions, "onProgress" | "fixedStartIndex" | "fixedEndIndex">
> = {
  maxIterations: 100,
  noImprovementLimit: 20,
  minImprovementThreshold: 0.001,
};

// ============================================
// Core Algorithm
// ============================================

/**
 * 경로의 일부를 역순으로 뒤집는다
 *
 * @param route - 경로 배열
 * @param i - 시작 인덱스
 * @param j - 끝 인덱스
 * @returns 새 경로 배열
 */
function reverseSegment(route: string[], i: number, j: number): string[] {
  const newRoute = [...route];
  while (i < j) {
    [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
    i++;
    j--;
  }
  return newRoute;
}

/**
 * 2-opt 스왑의 비용 개선량 계산
 *
 * 2-opt는 두 엣지를 제거하고 다시 연결하는 방식:
 * 기존: ...→A→B→...→C→D→...
 * 변경: ...→A→C→...→B→D→...
 *
 * 개선량 = (기존 비용) - (새 비용)
 *        = d(A,B) + d(C,D) - d(A,C) - d(B,D)
 *
 * @param route - 현재 경로
 * @param i - 첫 번째 엣지의 시작 인덱스
 * @param j - 두 번째 엣지의 끝 인덱스
 * @param getCost - 비용 조회 함수
 * @returns 개선량 (양수면 개선됨)
 */
function calculateSwapImprovement(
  route: string[],
  i: number,
  j: number,
  getCost: (from: string, to: string) => number
): number {
  // 기존 엣지: (i, i+1) and (j, j+1)
  // 새 엣지: (i, j) and (i+1, j+1)

  const a = route[i];
  const b = route[i + 1];
  const c = route[j];
  const d = j + 1 < route.length ? route[j + 1] : null;

  // 기존 비용
  const oldCost1 = getCost(a, b);
  const oldCost2 = d ? getCost(c, d) : 0;

  // 새 비용
  const newCost1 = getCost(a, c);
  const newCost2 = d ? getCost(b, d) : 0;

  return oldCost1 + oldCost2 - newCost1 - newCost2;
}

/**
 * 경로의 총 비용 계산
 */
function calculateTotalCost(
  route: string[],
  getCost: (from: string, to: string) => number
): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += getCost(route[i], route[i + 1]);
  }
  return total;
}

/**
 * 2-opt 개선 알고리즘
 *
 * 초기 경로를 반복적으로 개선하여 더 짧은 경로를 찾습니다.
 * 각 반복에서 두 엣지를 교환하여 경로를 개선합니다.
 *
 * - 시간 복잡도: O(n² × iterations)
 * - 공간 복잡도: O(n)
 * - 최적해 보장: X (지역 최적해)
 * - 적합한 용도: Nearest Neighbor 결과 개선
 *
 * @param initialRoute - 초기 경로 (장소 ID 배열)
 * @param distanceMatrix - 거리 행렬
 * @param config - 최적화 설정
 * @param options - 2-opt 옵션
 * @returns 개선된 경로 결과
 *
 * @example
 * ```ts
 * const result = twoOpt(
 *   ["origin", "place1", "place2", "place3", "destination"],
 *   distanceMatrix,
 *   { timeWeight: 1.0, distanceWeight: 0.1 },
 *   { maxIterations: 100 }
 * );
 * console.log(result.improvementPercentage); // "5.2%"
 * ```
 */
export function twoOpt(
  initialRoute: string[],
  distanceMatrix: DistanceMatrix,
  config: Pick<OptimizeConfig, "timeWeight" | "distanceWeight">,
  options: TwoOptOptions = {}
): TwoOptResult {
  const opts = { ...DEFAULT_TWO_OPT_OPTIONS, ...options };
  const getDistance = createDistanceMatrixGetter(distanceMatrix);

  // 비용 함수 생성
  const getCost = (from: string, to: string): number => {
    const entry = getDistance(from, to);
    if (!entry) return Infinity;
    return calculateCost({
      travelTime: entry.duration,
      travelDistance: entry.distance,
      timeWeight: config.timeWeight,
      distanceWeight: config.distanceWeight,
    });
  };

  // 초기 비용 계산
  const initialCost = calculateTotalCost(initialRoute, getCost);

  // 경로가 너무 짧으면 개선할 필요 없음
  if (initialRoute.length < 4) {
    return {
      route: initialRoute,
      initialCost,
      finalCost: initialCost,
      improvementPercentage: 0,
      iterations: 0,
    };
  }

  // 스왑 범위 결정
  const startIdx = opts.fixedStartIndex ?? 0;
  const endIdx = opts.fixedEndIndex ?? initialRoute.length - 1;

  let bestRoute = [...initialRoute];
  let bestCost = initialCost;
  let noImprovementCount = 0;
  let iteration = 0;

  // 반복 개선
  for (iteration = 0; iteration < opts.maxIterations; iteration++) {
    let improved = false;
    let bestSwap: TwoOptSwap | null = null;

    // 모든 가능한 2-opt 스왑 탐색
    for (let i = startIdx; i < endIdx - 1; i++) {
      for (let j = i + 2; j <= endIdx; j++) {
        // 시작점이나 끝점을 건드리면 안 됨
        if (i === startIdx && opts.fixedStartIndex !== undefined) continue;
        if (j === endIdx && opts.fixedEndIndex !== undefined) continue;

        const improvement = calculateSwapImprovement(bestRoute, i, j, getCost);

        if (improvement > 0 && (!bestSwap || improvement > bestSwap.improvement)) {
          bestSwap = { i, j, improvement };
        }
      }
    }

    // 최적의 스왑 적용
    if (bestSwap && bestSwap.improvement > opts.minImprovementThreshold * bestCost) {
      bestRoute = reverseSegment(bestRoute, bestSwap.i + 1, bestSwap.j);
      bestCost -= bestSwap.improvement;
      improved = true;
      noImprovementCount = 0;

      opts.onProgress?.(
        iteration,
        bestCost,
        (initialCost - bestCost) / initialCost * 100
      );
    }

    // 개선 없으면 카운터 증가
    if (!improved) {
      noImprovementCount++;
      if (noImprovementCount >= opts.noImprovementLimit) {
        break;
      }
    }
  }

  const finalCost = calculateTotalCost(bestRoute, getCost);
  const improvementPercentage =
    initialCost > 0
      ? ((initialCost - finalCost) / initialCost) * 100
      : 0;

  return {
    route: bestRoute,
    initialCost,
    finalCost,
    improvementPercentage: Math.round(improvementPercentage * 100) / 100,
    iterations: iteration + 1,
  };
}

/**
 * 출발지/도착지 고정 2-opt 알고리즘
 *
 * 출발지(첫 번째)와 도착지(마지막)는 고정하고
 * 중간 경로만 최적화합니다.
 *
 * @param initialRoute - 초기 경로 (출발지 → ... → 도착지)
 * @param distanceMatrix - 거리 행렬
 * @param config - 최적화 설정
 * @param options - 2-opt 옵션
 * @returns 개선된 경로 결과
 */
export function twoOptWithEndpoints(
  initialRoute: string[],
  distanceMatrix: DistanceMatrix,
  config: Pick<OptimizeConfig, "timeWeight" | "distanceWeight">,
  options: TwoOptOptions = {}
): TwoOptResult {
  return twoOpt(initialRoute, distanceMatrix, config, {
    ...options,
    fixedStartIndex: 0,
    fixedEndIndex: initialRoute.length - 1,
  });
}

/**
 * 반복적 2-opt (여러 번 실행하여 더 좋은 결과 선택)
 *
 * @param initialRoute - 초기 경로
 * @param distanceMatrix - 거리 행렬
 * @param config - 최적화 설정
 * @param runs - 실행 횟수 (기본: 3)
 * @param options - 2-opt 옵션
 * @returns 최적 결과
 */
export function iteratedTwoOpt(
  initialRoute: string[],
  distanceMatrix: DistanceMatrix,
  config: Pick<OptimizeConfig, "timeWeight" | "distanceWeight">,
  runs: number = 3,
  options: TwoOptOptions = {}
): TwoOptResult {
  let bestResult: TwoOptResult | null = null;

  for (let i = 0; i < runs; i++) {
    // 약간 다른 시작점으로 시도 (첫 번째 이후)
    let startRoute = initialRoute;
    if (i > 0 && initialRoute.length > 3) {
      // 랜덤하게 두 지점 스왑하여 다른 시작점 생성
      const swapIdx1 = 1 + Math.floor(Math.random() * (initialRoute.length - 2));
      const swapIdx2 = 1 + Math.floor(Math.random() * (initialRoute.length - 2));
      startRoute = [...initialRoute];
      [startRoute[swapIdx1], startRoute[swapIdx2]] = [
        startRoute[swapIdx2],
        startRoute[swapIdx1],
      ];
    }

    const result = twoOpt(startRoute, distanceMatrix, config, options);

    if (!bestResult || result.finalCost < bestResult.finalCost) {
      bestResult = result;
    }
  }

  return bestResult!;
}

/**
 * 2-opt 개선 가능성 추정
 *
 * 전체 탐색 없이 랜덤 샘플링으로 개선 가능성을 빠르게 추정합니다.
 *
 * @param route - 경로
 * @param distanceMatrix - 거리 행렬
 * @param config - 최적화 설정
 * @param sampleSize - 샘플 크기 (기본: 20)
 * @returns 예상 개선율 (%)
 */
export function estimateImprovementPotential(
  route: string[],
  distanceMatrix: DistanceMatrix,
  config: Pick<OptimizeConfig, "timeWeight" | "distanceWeight">,
  sampleSize: number = 20
): number {
  if (route.length < 4) return 0;

  const getDistance = createDistanceMatrixGetter(distanceMatrix);
  const getCost = (from: string, to: string): number => {
    const entry = getDistance(from, to);
    if (!entry) return Infinity;
    return calculateCost({
      travelTime: entry.duration,
      travelDistance: entry.distance,
      timeWeight: config.timeWeight,
      distanceWeight: config.distanceWeight,
    });
  };

  let totalImprovement = 0;
  let validSamples = 0;

  for (let s = 0; s < sampleSize; s++) {
    // 랜덤 i, j 선택
    const i = 1 + Math.floor(Math.random() * (route.length - 3));
    const j = i + 1 + Math.floor(Math.random() * (route.length - i - 2));

    if (j < route.length - 1) {
      const improvement = calculateSwapImprovement(route, i, j, getCost);
      if (improvement > 0) {
        totalImprovement += improvement;
      }
      validSamples++;
    }
  }

  if (validSamples === 0) return 0;

  const currentCost = calculateTotalCost(route, getCost);
  const avgImprovement = totalImprovement / validSamples;

  // 예상 개선율 (보수적 추정)
  return Math.min((avgImprovement / currentCost) * 100 * 5, 50);
}
