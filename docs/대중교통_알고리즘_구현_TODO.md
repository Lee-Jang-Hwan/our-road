# 대중교통 알고리즘 구현 TODO

> 기반 문서: [대중교통_알고리즘_설계서.md](./대중교통_알고리즘_설계서.md)

---

## 📋 전체 구현 로드맵

### Phase 1: 핵심 기능 (MVP) - 우선순위 높음
### Phase 2: 안정화 - 우선순위 중간
### Phase 3: 고도화 - 우선순위 낮음

---

# Phase 1: 핵심 기능 (MVP)

## 1. 프로젝트 구조 설정

- [x] **디렉토리 구조 생성**
  - [x] `lib/algorithms/` - 알고리즘 핵심 로직
  - [x] `lib/algorithms/public-transit/` - 대중교통 전용
  - [x] `types/route.ts` - 경로 관련 타입 정의
  - [x] `actions/route/` - Server Actions

- [x] **타입 정의 파일 작성** (`types/route.ts`)
  - [x] `LatLng` interface
  - [x] `Waypoint` interface
  - [x] `TripInput` interface
  - [x] `Cluster` interface
  - [x] `DayPlan` interface
  - [x] `SegmentCost` interface
  - [x] `TripOutput` interface
  - [x] `TripMode` type ('OPEN' | 'LOOP')
  - [x] Zod validation schemas

---

## 2. 유틸리티 함수 구현

### 2.1 좌표 계산 유틸리티 (`lib/algorithms/utils/geo.ts`)

- [x] **거리 계산**
  - [x] `calculateDistance(a: LatLng, b: LatLng): number`
    - [x] Haversine formula 사용
    - [x] 단위: 미터

- [x] **중심점 계산**
  - [x] `calculateCentroid(points: LatLng[]): LatLng`
    - [x] 평균 위도/경도 계산
    - [ ] 가중 중심점 옵션 (향후)

- [x] **벡터 연산**
  - [x] `calculateDirectionVector(from: LatLng, to: LatLng): Vector2D`
  - [x] `dotProduct(v1: Vector2D, v2: Vector2D): number`
  - [x] `projectOntoAxis(point: LatLng, axis: Vector2D): number`

### 2.2 경로 분석 유틸리티 (`lib/algorithms/utils/route-analysis.ts`)

- [x] **되돌아감 계산**
  - [x] `calculateBacktracking(route: string[], waypoints: Map<string, Waypoint>): number`
    - [x] 진행 방향 축 추출
    - [x] 각 구간의 역행 정도 합산

- [x] **교차 계산**
  - [x] `calculateCrossing(route: string[], waypoints: Map<string, Waypoint>): number`
    - [x] 모든 선분 쌍 검사
    - [x] Line segment intersection 알고리즘

- [x] **선분 교차 검사**
  - [x] `doSegmentsIntersect(a1: LatLng, a2: LatLng, b1: LatLng, b2: LatLng): boolean`

---

## 3. 전처리 (Preprocessing)

### 3.1 입력 검증 및 정제 (`lib/algorithms/public-transit/preprocess.ts`)

- [x] **`preprocessWaypoints(waypoints: Waypoint[]): Waypoint[]`**
  - [x] 좌표 누락/비정상 값 제거
    - [x] lat: -90 ~ 90
    - [x] lng: -180 ~ 180
  - [x] 중복 좌표 병합
    - [x] 거리 < 10m인 경우 같은 지점으로 간주
    - [x] 이름은 " / "로 연결
  - [x] ID는 입력값 유지 (별도 정규화 불필요)

- [x] **`determineTripMode(lodging?: LatLng, start?: LatLng, end?: LatLng): TripMode`**
  - [x] 숙소 있으면 'LOOP'
  - [x] 출발=도착이면 'LOOP'
  - [x] 그 외 'OPEN'

---

## 4. 구역 자동 분할 (Clustering)

### 4.1 시드 선택 (`lib/algorithms/public-transit/clustering.ts`)

- [x] **`selectDistributedSeeds(waypoints: Waypoint[], k: number): Waypoint[]`**
  - [x] 첫 번째 시드: 전체 중심점에서 가장 먼 점 선택
  - [x] 나머지 시드: 기존 시드들로부터 가장 먼 점 순차 선택 (k-means++ 방식)
  - [x] 반환: k개의 대표 waypoint

### 4.2 클러스터 초기화 및 할당

- [x] **`initializeClusters(seeds: Waypoint[]): ClusterBuilder[]`**
  - [x] 각 시드를 중심으로 빈 클러스터 생성
  - [x] 시드는 초기 클러스터에 포함

- [x] **`findNearestCluster(clusters: ClusterBuilder[], wp: Waypoint, maxCapacity: number): ClusterBuilder`**
  - [x] 각 클러스터 중심과의 거리 계산
  - [x] 가장 가까운 클러스터가 용량 초과 시 다음 가까운 곳으로
  - [x] 모두 초과 시 가장 가까운 곳에 강제 할당

### 4.3 균형화 스왑

- [x] **`balanceClusterSizes(clusters: ClusterBuilder[], targetPerDay: number): void`**
  - [x] 클러스터를 크기순으로 정렬
  - [x] 가장 큰 클러스터와 가장 작은 클러스터 간 균형화:
    - [x] 가장 큰 클러스터에서 가장 작은 클러스터 중심에 가까운 지점 선택
    - [x] 가장 작은 클러스터로 이동
    - [x] 크기 차이 <= 1 또는 largest <= targetPerDay이면 중단
  - [x] 최대 반복 횟수: 100

### 4.4 필수 경유지 보호

- [x] **`ensureFixedWaypointsIncluded(clusters: ClusterBuilder[], fixedIds: string[]): void`**
  - [x] 모든 필수 경유지가 클러스터에 포함되었는지 확인
  - [x] 제외된 필수 경유지 있으면 가장 가까운 클러스터에 강제 추가

### 4.5 메인 함수

- [x] **`balancedClustering(params): Cluster[]`**
  - [x] 위 모든 단계 통합
  - [x] 각 클러스터의 centroid 계산
  - [x] Cluster 인터페이스로 변환하여 반환

---

## 5. 구역 순서 결정 (Cluster Ordering)

### 5.1 구현 (`lib/algorithms/public-transit/cluster-ordering.ts`)

- [x] **`chooseEndAnchor(lodging?: LatLng, clusters: Cluster[], days: number): LatLng`**
  - [x] 숙소 있으면 숙소 반환
  - [x] 없으면:
    - [x] 모든 클러스터의 centroid 평균 계산
    - [x] 평균점과 가장 먼 클러스터의 centroid를 end anchor로 추정

- [x] **`resolveDayEndAnchor(params): LatLng`**
  - [x] dayIndex, orderedClusters, endAnchor, input을 받아 일자별 end anchor 결정
  - [x] 숙소가 있으면 모든 일자 end anchor = 숙소
  - [x] 숙소가 없고 end가 있으면 마지막 날 end anchor = end
  - [x] 그 외 일자는 다음 날 클러스터 centroid 사용
  - [x] 마지막 날에 end가 없으면 start 또는 endAnchor로 대체

- [x] **`orderClustersOneDirection(clusters: Cluster[], endAnchor: LatLng): Cluster[]`**
  - [x] endAnchor와의 거리로 1차 정렬 (오름차순)
  - [x] `smoothClusterOrder()` 호출하여 로컬 최적화

- [x] **`smoothClusterOrder(sorted: Cluster[], endAnchor: LatLng): Cluster[]`**
  - [x] 2-opt 기반 클러스터 순서 최적화:
    - [x] 모든 (i, j) 쌍에 대해 스왑 시도
    - [x] 거리 비용이 감소하면 적용
  - [x] 최대 5회 반복

- [x] **`validateMonotonicProgression(orderedClusters: Cluster[], endAnchor: LatLng): boolean`**
  - [x] 진행 방향 벡터 계산
  - [x] 각 구간의 내적이 양수인지 확인
  - [x] 검증 로직 완료 (현재 로그 출력은 구현되어 있지 않음)

---

## 6. 구역 내 순서 결정 (Within-Cluster Ordering)

### 6.1 구현 (`lib/algorithms/public-transit/within-cluster-ordering.ts`)

- [x] **`calculateAxis(centroid: LatLng, endAnchor: LatLng): Vector2D`**
  - [x] centroid → endAnchor 방향 벡터 정규화

- [x] **`orderWithinClusterOneDirection(params): string[]`**
  - [x] 진행 축 계산
  - [x] 각 waypoint를 축에 투영
  - [x] 투영 값으로 정렬
  - [x] 동일 투영값이면 end anchor에 더 가까운 waypoint를 뒤로 배치
  - [x] `minimize2OptCrossing()` 호출

- [x] **`minimize2OptCrossing(order: string[], waypoints: Map<string, Waypoint>): string[]`**
  - [x] 2-opt 알고리즘:
    - [x] 모든 (i, j) 쌍에 대해 순서 역전 시도
    - [x] 교차 수 감소하면 적용
  - [x] 최대 50회 반복 또는 개선 없을 때까지

---

## 7. 일일 계획 생성 (Day Plan Generation)

### 7.1 메인 로직 (`lib/algorithms/public-transit/day-plan.ts`)

- [x] **`generateDayPlans(orderedClusters: Cluster[], waypoints: Map<string, Waypoint>, endAnchor: LatLng): DayPlan[]`**
  - [x] 각 클러스터를 일차에 매핑
  - [x] `resolveDayEndAnchor()`로 일자별 end anchor 산정
  - [x] `orderWithinClusterOneDirection()` 호출하여 방문 순서 결정
  - [x] DayPlan 배열 반환

---

## 8. 복잡도 기반 제외 (Optional)

### 8.1 구현 (`lib/algorithms/public-transit/complexity-removal.ts`)

- [x] **`exceedsDailyLimitProxy(dayPlans: DayPlan[], dailyMaxMinutes: number): boolean`**
  - [x] 거리 기반 시간 추정 (proxy):
    - [x] 구간 거리 합산
    - [x] 거리 × 5분/km (보수적 추정)
  - [x] 추정 시간 > dailyMaxMinutes이면 true

- [x] **`calculateComplexityImpact(waypoint: Waypoint, currentRoute: string[], waypoints: Map<string, Waypoint>): number`**
  - [x] 해당 지점 포함/제외 시 되돌아감 계산
  - [x] 해당 지점 포함/제외 시 교차 계산
  - [x] 영향도 = ALPHA × Δ되돌아감 + BETA × Δ교차

- [x] **`selectWorstComplexityPoint(dayPlans: DayPlan[], fixedIds: string[]): string | null`**
  - [x] 모든 비필수 경유지의 복잡도 영향 계산
  - [x] 가장 높은 점 반환
  - [x] 없으면 null

- [x] **`removeWaypoint(dayPlans: DayPlan[], waypointId: string): void`**
  - [x] 해당 경유지를 excludedWaypointIds에 추가
  - [x] waypointOrder에서 제거

### 8.2 가중치 기반 제외 로직 확장 (docs/가중치기반경유지제외로직.md)

- [x] **경유지 타입 분류 규칙 추가**
  - [x] `isFixed` / `dayLock` 속성으로 분류
  - [x] 제거 후보는 `isFixed=false` & `dayLock` 없는 경유지만 허용

- [x] **경유지 중요도/체류시간 입력 확장**
  - [x] `Waypoint`에 `importance`(1~5) 추가
  - [x] `Waypoint`에 `stayMinutes`(분) 추가
  - [x] Zod 스키마 업데이트

- [x] **가중치 상수 정의**
  - [x] `ALPHA_BACKTRACKING`
  - [x] `BETA_CROSSING`
  - [x] `GAMMA_TIME`
  - [x] `DELTA_DISTANCE`
  - [x] `EPSILON_IMPORTANCE`
  - [x] `ZETA_STAYTIME`

- [x] **제거 점수 계산 함수 설계**
  - [x] 점수식: `(α×Backtracking) + (β×Crossing) + (γ×ΔTime) + (δ×ΔDist) - (ε×Importance) - (ζ×StayTime)`
  - [x] `Prev -> Target -> Next` vs `Prev -> Next`로 ΔTime/ΔDist 계산
  - [x] backtracking delta: 벡터 내적 기반 각도 페널티
  - [x] crossing delta: 교차 수 비교

- [x] **제거 루프 정책**
  - [x] `isFixed`/`dayLock` 있는 경유지는 제거 대상에서 제외
  - [x] 후보 없음 시 루프 중단 (null 반환)
  - [x] 제거 단계는 Haversine proxy 사용, 최종 API 호출

### 8.3 API 기준 시간 초과 후 재최적화 (재호출 포함)

- [ ] **API 결과 기반 초과 판단**
  - [ ] segmentCosts로 day별 실제 소요시간 합산
  - [ ] `dailyMaxMinutes` 초과 day만 제외 로직 발동

- [ ] **제거 수량 계산 및 일괄 제거**
  - [ ] 초과분(분) 대비 ΔTime 기여도가 큰 후보부터 N개 선정
  - [ ] 1회 제거 후 API 재호출로 검증
  - [ ] 반복 상한 3회

- [ ] **API 과다 호출 방지**
  - [ ] 동일 segment 캐시 재사용
  - [ ] 변경된 구간만 재호출
  - [ ] 개선 없음(초과 감소 실패) 시 중단

---

## 9. API 호출 (Routing API Integration)

### 9.1 구간 추출 (`lib/algorithms/public-transit/api-caller.ts`)

- [x] **`extractSegments(dayPlans: DayPlan[], start: LatLng, end?: LatLng, lodging?: LatLng): SegmentKey[]`**
  - [x] Day 1: start → 첫 경유지
  - [x] 각 일차: 경유지 간 구간
  - [x] 마지막 경유지 → lodging or end
  - [x] Day 2~: (lodging or 이전 마지막) → 첫 경유지

### 9.2 API 호출 (ODsay 또는 대중교통 API)

- [x] **`callRoutingAPIForSegments(segments: SegmentKey[], waypoints: Map<string, Waypoint>): Promise<SegmentCost[]>`**
  - [x] 각 구간에 대해 API 호출
  - [x] 배치 처리 (batchSize: 3) - Rate Limit 고려
  - [x] 실패한 구간은 거리 기반 대체 시간으로 fallback
  - [ ] 실패 시 재시도 로직 (최대 3회) - 향후 개선

- [x] **API 연동 상세**
  - [x] ODsay API 클라이언트 설정
  - [x] 환경변수: `ODSAY_API_KEY`
  - [x] 응답 파싱: duration, distance, transfers, polyline
  - [x] Rate Limiting: 배치 크기 3으로 제어

---

## 10. 비정상 구간 감지 및 처리

### 10.1 감지 (`lib/algorithms/public-transit/anomaly-detection.ts`)

- [x] **`detectAnomalousSegments(segmentCosts: SegmentCost[]): Warning[]`**
  - [x] 각 구간 검사:
    - [x] duration > 20분
    - [x] transfers > 2회
    - [x] waitTime > 8분 (API에서 제공 시)
  - [x] 경고 배열 반환

### 10.2 처리

- [x] **`applyLocalFixes(dayPlans: DayPlan[], warnings: Warning[]): void`**
  - [x] Placeholder 구현 (현재는 경고만 로깅)
  - [ ] Phase 2에서 실제 로컬 수정 로직 구현 예정

---

## 11. 최종 출력 생성

### 11.1 구현 (`lib/algorithms/public-transit/output-builder.ts`)

- [x] **`buildOutput(dayPlans: DayPlan[], segmentCosts: SegmentCost[], clusters: Cluster[], mode: TripMode): TripOutput`**
  - [x] TripOutput 인터페이스에 맞춰 데이터 조합
  - [x] clusters, dayPlans, segmentCosts 반환
  - [ ] 전체 통계 계산 (향후 개선):
    - [ ] 총 이동 시간
    - [ ] 총 거리
    - [ ] 일일 평균 시간

---

## 12. 메인 함수 통합

### 12.1 최상위 함수 (`lib/algorithms/public-transit/index.ts`)

- [x] **`generatePublicTransitRoute(input: TripInput): Promise<TripOutput>`**
  - [x] 위 모든 단계 통합 완료
  - [x] 기본 에러 핸들링 (Server Action에서 처리)
  - [ ] 고급 에러 핸들링 (Phase 2):
    - [ ] 입력 검증 실패 상세 처리
    - [ ] 클러스터링 실패 처리
    - [ ] API 호출 실패 복구
  - [ ] 로깅 추가 (개발 환경)

---

## 13. Server Action 구현

### 13.1 라우트 생성 액션 (`actions/route/generate-route.ts`)

- [x] **`generateRoute(input: TripInputInput)`**
  - [x] 인증 확인 (Clerk)
  - [x] 입력 검증 (Zod)
  - [x] `generatePublicTransitRoute()` 호출
  - [x] 에러 핸들링 및 결과 반환
  - [ ] 결과를 Supabase에 저장 (선택, 향후 구현)

---

# Phase 2: 안정화

## 14. 비정상 구간 국소 수정

- [ ] **`applyLocalFixes()` 실제 구현**
  - [ ] 긴 구간: 중간 경유지 자동 추가 (Google Places API)
  - [ ] 환승 과다: 인접 경유지와 순서 스왑
  - [ ] 전체 시간 초과: 복잡도 기반 제외 재실행

## 15. API 실패 처리 고도화

- [x] **Fallback 메커니즘**
  - [x] 거리 기반 대체 시간 계산 (5분/km)
- [ ] **Exponential Backoff 재시도** (향후 구현)
- [ ] **Circuit Breaker 패턴** (향후 구현)
- [ ] **거리 기반 대체 시간 정교화** (향후 개선)
  - [ ] 도보 속도: 4km/h
  - [ ] 대중교통 평균: 20km/h
  - [ ] 환승/대기 추정: +5분

## 16. 테스트 작성

### 16.1 Unit Tests

- [ ] 좌표 계산 유틸리티 테스트
- [ ] 클러스터링 알고리즘 테스트
- [ ] 순서 결정 로직 테스트
- [ ] 복잡도 계산 테스트

### 16.2 Integration Tests

- [ ] 전체 플로우 테스트 (모의 API)
- [ ] Edge Cases:
  - [ ] N > M (일수 > 장소)
  - [ ] 극단적 좌표 분산
  - [ ] 필수 경유지 과다

## 17. 성능 최적화

- [ ] **메모이제이션**
  - [ ] 거리 계산 캐싱
  - [ ] 중심점 계산 캐싱

- [ ] **병렬 처리**
  - [ ] API 호출 동시성 제어 (p-limit)
  - [ ] 클러스터 내 순서 결정 병렬화

---

# Phase 3: 고도화

## 18. 사용자 선호도 반영

- [ ] **가중치 조정 UI**
  - [ ] 되돌아감 민감도 슬라이더
  - [ ] 교차 민감도 슬라이더
  - [ ] 구역 응집도 우선순위

- [ ] **프리셋**
  - [ ] "초행자 모드": 교차/되돌아감 최소
  - [ ] "시간 우선 모드": 직관 점수 약간 완화
  - [ ] "구역 중심 모드": 클러스터 응집도 최대

## 19. 실시간 정보 통합

- [ ] **실시간 배차 정보**
  - [ ] ODsay 실시간 API 활용
  - [ ] 대기 시간 동적 업데이트

- [ ] **교통 상황 반영**
  - [ ] 출발 시간대별 혼잡도
  - [ ] 주말/평일 구분

## 20. 시각화 개선

- [ ] **지도 렌더링**
  - [ ] 구역별 색상 구분
  - [ ] 일차별 필터링
  - [ ] Polyline 애니메이션

- [ ] **통계 대시보드**
  - [ ] 일일 시간 분포 차트
  - [ ] 구역 간 이동 거리 시각화
  - [ ] 직관 점수 그래프

---

# 체크리스트 요약

## 🔴 Critical (Phase 1 - MVP)
- [x] 타입 정의 및 Zod 스키마
- [x] 전처리 및 입력 검증
- [x] 구역 자동 분할 (balancedClustering)
- [x] 구역 순서 결정 (orderClustersOneDirection)
- [x] 구역 내 순서 결정 (orderWithinClusterOneDirection)
- [x] API 호출 (구간만)
- [x] 메인 함수 통합
- [x] Server Action 구현

## 🟡 Important (Phase 2 - 안정화)
- [x] 비정상 구간 감지
- [x] 복잡도 기반 제외 (시간 제한 대응)
- [ ] 가중치 기반 경유지 제외 로직 (중요도/체류시간/Δ시간·거리)
- [ ] API 기준 시간 초과 후 재최적화 (재호출, 3회 제한)
- [ ] API 실패 처리 및 재시도
- [ ] Unit/Integration 테스트
- [ ] 성능 최적화

## 🟢 Nice-to-Have (Phase 3 - 고도화)
- [ ] 사용자 선호도 반영
- [ ] 실시간 정보 통합
- [ ] 시각화 개선

---

# 개발 가이드

## 코딩 컨벤션

- **파일명**: kebab-case (예: `cluster-ordering.ts`)
- **함수명**: camelCase
- **타입/인터페이스**: PascalCase
- **상수**: UPPER_SNAKE_CASE

## 에러 핸들링

```typescript
class RouteGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RouteGenerationError';
  }
}

// 사용 예
throw new RouteGenerationError(
  'Clustering failed',
  'CLUSTERING_FAILED',
  { waypointCount: waypoints.length }
);
```

## 로깅

```typescript
// 개발 환경에서만 상세 로그
if (process.env.NODE_ENV === 'development') {
  console.log('[Clustering]', { clusters, targetPerDay });
}

// 프로덕션에서는 에러만
console.error('[RouteGeneration]', error);
```

## 성능 측정

```typescript
const start = performance.now();
// ... 작업 수행
const duration = performance.now() - start;
console.log(`[Performance] ${functionName}: ${duration.toFixed(2)}ms`);
```

---

# 다음 단계

1. **Phase 1 시작**: 타입 정의부터 차근차근 구현
2. **작은 단위로 테스트**: 각 함수를 독립적으로 검증
3. **실제 데이터로 검증**: 서울 여행 10개 장소 3일 일정으로 테스트
4. **피드백 반영**: 사용자 테스트 후 알고리즘 파라미터 튜닝

**우선순위**: Phase 1의 항목들을 순서대로 구현하는 것이 목표입니다.
