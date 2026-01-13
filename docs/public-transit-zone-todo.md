# 대중교통 Zone 기반 분배 구현 TODO

## 0. 준비
- [ ] 기존 `balancedClustering` 사용 위치 확인
- [ ] 기존 일정 생성/고정 일정 흐름 재검토

## 1. Zone 생성 모듈 추가
- [ ] `clustering.ts`에 `buildZones` 유틸 추가
  - [ ] kNN 거리 기반 반경 R 추정
  - [ ] grid index 생성
  - [ ] Union-Find 구현
- [ ] `Zone` 타입 정의 (파일 위치 선택: `types` 또는 clustering 내부)

## 2. Zone 분할 로직
- [ ] `splitZoneIfOverLimit(zone, dailyMaxMinutes, targetPerDay)` 구현
- [ ] 분할 기준과 계수 상수 정의
- [ ] Zone 내부 분할만 허용

## 3. Zone → Day 배치
- [ ] 고정 일정 Zone 식별 및 고정 배치
- [ ] `assignZonesToDays` 그리디 구현
  - [ ] score = 거리비용 + 과부하 페널티
  - [ ] dayAnchor(출발/숙소/도착) 고려

## 4. 클러스터 생성
- [ ] day별 Zone을 합쳐 `Cluster[]` 생성
- [ ] 기존 `assignFixedWaypointsToClusters`/`validateFixedWaypointAssignments` 연동

## 5. 파이프라인 연결
- [ ] `generatePublicTransitRoute`에서 `balancedClustering` → `zoneClustering`
- [ ] 기존 `orderClustersOneDirection`, `generateDayPlans` 그대로 사용

## 6. 검증/테스트
- [ ] A4/B2 케이스 확인
- [ ] 고정 일정 + Zone 충돌 확인
- [ ] 큰 Zone 분할 시나리오 확인
- [ ] outlier 처리 확인

## 7. 정리
- [ ] 필요 없는 `balancedClustering` 제거 또는 deprecated 처리
- [ ] README/문서 업데이트

## 8. 코드 설계 반영
- [ ] `Zone` 타입 추가 (clustering 내부 또는 types 분리)
- [ ] `buildZones` 구현 (kNN 기반 R 추정 + grid index + union-find)
- [ ] `splitZoneIfOverLimit` 구현 (Zone 내부 분할만 허용)
- [ ] `assignZonesToDays` 구현 (고정 Zone 우선 + score 기반 배치)
- [ ] `zoneClustering` 엔트리 구현
- [ ] `generatePublicTransitRoute`에서 `zoneClustering` 호출로 교체
- [ ] day anchor 생성 규칙 반영 (origin/숙소/destination)

