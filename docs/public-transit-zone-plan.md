# 대중교통 구역(Zone) 기반 분배 설계안

## 목표
- 동일 구역(근접 장소)을 같은 날에 묶어 불필요한 구역 간 이동을 최소화한다.
- 균등 분배보다 공간 응집도를 우선하며, 일정 불균형은 허용 범위 내에서 수용한다.
- 기존 파이프라인(일자별 경로 생성, API 호출 구조)은 최대한 유지한다.

## 현재 문제 요약 (현 코드 기준)
- `selectDistributedSeeds`가 구역 밀도와 무관하게 시드를 분산 배치한다.
- `findNearestCluster`가 `targetPerDay`를 하드 캡으로 적용해 구역 분산이 발생한다.
- `balanceClusterSizes`가 균등 분배를 우선하며 구역 응집도를 희생한다.

## 제안: Zone 우선 분배 알고리즘

### 핵심 아이디어
1) 공간적으로 가까운 장소를 먼저 Zone으로 묶는다.
2) Zone을 일자에 배치한다. (균등 분배는 소프트)
3) 하루에 불가능한 Zone만 내부에서 분할한다. (구역 간 섞기 금지)

### 단계별 상세

#### 1) Zone 생성 (Union-Find + Grid Index)
- 입력: `Waypoint[]`
- 출력: `Zone[]` (zoneId, waypointIds, centroid, totalDurationEstimate)

절차:
- 반경 R 추정: kNN 거리(예: k=3)의 중앙값 * 계수.
- Grid index: cell size = R
- 각 waypoint의 인접 cell을 탐색하여 `distance <= R`이면 union.
- 연결 요소가 Zone.

#### 2) Zone 분할 (필요 시)
- 조건: Zone의 추정 소요 시간이 `dailyMaxMinutes`를 확실히 초과하거나,
  size가 상한(예: targetPerDay * 1.5)을 크게 넘는 경우.
- 방법: Zone 내부에서만 분할 (k-means 또는 BFS 기반).
- 금지: 다른 Zone과 섞기.

#### 3) Zone → Day 배치 (그리디)
- 고정 일정 Zone은 해당 날짜에 고정 배치.
- 나머지는 day별 score 최소화:
  - score = 거리비용 + 과부하 페널티
  - 거리비용: dayAnchor(출발/숙소) ↔ zone centroid
  - 과부하 페널티는 소프트 (균등분배 강제 X)

#### 4) Cluster 생성
- Day별 Zone의 waypointIds를 합쳐 Cluster 생성.
- 기존 `orderClustersOneDirection`, `generateDayPlans`와 연동.

## 엣지 케이스 대응
- 고정 일정이 있는 Zone: 해당 day 고정 배치.
- outlier: 단독 Zone으로 유지 (불필요한 섞기 금지).
- 일수 > 장소 수: 빈 날 허용.
- 대중교통 특성: 거리 기반 R은 과도 확장 금지 (kNN 기반 추정).

## 성능
- O(n)~O(n log n)
- 기존 BalancedClustering 대비 구조 단순, 예측 가능성 증가.

## 코드 변경 위치
- `lib/algorithms/public-transit/clustering.ts`
  - `balancedClustering`를 대체할 `zoneClustering` 추가 또는 교체
- `lib/algorithms/public-transit/index.ts`
  - `balancedClustering` 호출을 `zoneClustering`으로 교체
  - 고정 일정 적용 로직은 유지

## 검증 시나리오
- A구역 4 + B구역 2 / 2일 → [A4], [B2]
- 고정 일정 + Zone 충돌 → 고정 일정 우선
- 큰 Zone → Zone 내부 분할
- outlier 1개 → 단독 Zone 유지

## 코드 설계(요약)

### 파일 구조
- `lib/algorithms/public-transit/clustering.ts`
  - `zoneClustering`, `buildZones`, `splitZoneIfOverLimit`, `assignZonesToDays`
- `lib/algorithms/public-transit/index.ts`
  - `balancedClustering` 호출을 `zoneClustering`으로 교체
- (선택) 타입 분리: `types` 내 `Zone` 정의

### 타입
```ts
export interface Zone {
  zoneId: string;
  waypointIds: string[];
  centroid: { lat: number; lng: number };
  estimatedMinutes: number;
  hasFixed: boolean;
  fixedDayIndex?: number;
}
```

### 함수 시그니처
```ts
export function buildZones(params: {
  waypoints: Waypoint[];
  kForRadius?: number;
  radiusMultiplier?: number;
}): Zone[];

export function splitZoneIfOverLimit(params: {
  zone: Zone;
  waypointMap: Map<string, Waypoint>;
  dailyMaxMinutes?: number;
  maxSize: number;
}): Zone[];

export function assignZonesToDays(params: {
  zones: Zone[];
  days: number;
  anchors: Array<{ start?: LatLng; end?: LatLng }>;
  targetPerDay: number;
  dailyMaxMinutes?: number;
}): Zone[][];

export function zoneClustering(params: {
  waypoints: Waypoint[];
  N: number;
  targetPerDay: number;
  fixedIds: string[];
  tripStartDate?: string;
  dailyMaxMinutes?: number;
  anchors: Array<{ start?: LatLng; end?: LatLng }>;
}): Cluster[];
```

### 연동 포인트
- `generatePublicTransitRoute`에서 `balancedClustering` → `zoneClustering`
- day anchor 생성 규칙
  - day1 start: origin
  - last day end: destination
  - middle days: 숙소 기반 (있을 경우)

