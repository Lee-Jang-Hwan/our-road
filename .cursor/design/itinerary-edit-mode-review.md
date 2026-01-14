# 일정 편집 모드 구현 검토 보고서

**검토 일자**: 2025-01-XX  
**검토 범위**: `.cursor/design/itinerary-edit-mode-implementation.md`에 체크된 모든 항목

---

## 📊 전체 요약

### ✅ 잘 구현된 부분
- 타입 정의 (EditState, DragItemId, DropZoneId)
- 시간 재계산 로직 (`recalculateItineraryTimes`)
- 편집 모드 UI 컴포넌트들 (기본 구조)
- 드래그 앤 드롭 기본 로직
- 자동 저장 Hook (기본 구조)
- 검증 로직 (`validateItinerary`)

### ⚠️ 문제가 있는 부분
1. **차량 모드 거리 행렬 재사용 미구현** (중요)
2. **자동 저장 Hook이 편집 모드 외부에서도 작동** (중요)
3. **드래그 앤 드롭 일차 간 이동 로직 복잡도** (보통)
4. **경로 재계산에서 차량 모드 최적화 부족** (보통)

---

## 🔍 상세 분석

### 1. 타입 정의 (Step 2) ✅

**상태**: 완전 구현됨

**파일**: `types/schedule.ts`

**확인 사항**:
- ✅ `EditState` 인터페이스 정의 완료
- ✅ `DragItemId` 타입 정의 완료
- ✅ `DropZoneId` 타입 정의 완료
- ✅ 기존 타입과 충돌 없음

**결론**: 문제 없음

---

### 2. 시간 재계산 유틸리티 (Step 3) ✅

**상태**: 완전 구현됨

**파일**: `lib/optimize/recalculate-time.ts`

**확인 사항**:
- ✅ 각 일차별로 순회하며 시간 재계산
- ✅ `dayOrigin` 처리 포함 (`transportFromOrigin` 고려)
- ✅ `dayDestination` 처리 포함 (`transportToDestination` 고려)
- ✅ `dailyStartTime`, `dailyEndTime` 고려
- ✅ 총 이동 거리/시간 재계산
- ✅ 총 체류 시간 계산

**결론**: 문서 요구사항을 모두 충족하며 잘 구현됨

---

### 3. 경로 정보 재사용 함수 (Step 3.2, 3.3) ⚠️

**상태**: 부분 구현됨 (차량 모드 재사용 미구현)

**파일**: `lib/optimize/reuse-route-info.ts`

#### 3.1 차량 모드: 거리 행렬 재사용 ⚠️

**문제점**:
- ✅ `getRouteFromDistanceMatrix` 함수는 구현되어 있음
- ❌ **하지만 `recalculate-routes.ts`에서 실제로 사용되지 않음**
- ❌ 차량 모드에서도 매번 API 호출을 하고 있음

**현재 코드** (`actions/itinerary/recalculate-routes.ts:145-164`):
```typescript
if (transportMode === "car") {
  // 차량 모드: Kakao Mobility API
  const carRouteResult = await getCarRoute({
    origin: fromCoord,
    destination: toCoord,
    priority: "TIME",
  });
  // ... API 호출만 하고 있음
}
```

**문제**: 거리 행렬이 어디에 저장되어 있는지 확인이 필요하며, 재사용 로직이 전혀 없음

**권장 사항**:
1. 거리 행렬 저장 위치 확인 (DB 또는 메모리)
2. `getRouteFromDistanceMatrix` 함수를 실제로 호출하도록 수정
3. 거리 행렬에 없는 구간만 API 호출

#### 3.2 대중교통 모드: 저장된 일정에서 재사용 ✅

**상태**: 잘 구현됨

**확인 사항**:
- ✅ `getRouteFromStoredItinerary` 함수 구현 완료
- ✅ `recalculate-routes.ts`에서 실제로 사용됨
- ✅ Supabase 쿼리로 기존 경로 정보 검색
- ✅ 시간 관계없이 동일 구간 재사용

**결론**: 대중교통 모드는 잘 구현됨

---

### 4. 경로 재계산 Server Action (Step 4) ⚠️

**상태**: 부분 구현됨 (차량 모드 최적화 부족)

**파일**: `actions/itinerary/recalculate-routes.ts`

**확인 사항**:
- ✅ 인증 확인
- ✅ Trip 정보 조회
- ✅ 대중교통 모드: 저장된 경로 재사용
- ⚠️ 차량 모드: 거리 행렬 재사용 없음 (매번 API 호출)
- ✅ 시간 재계산 호출
- ✅ DB 저장

**문제점**:
1. **차량 모드에서 거리 행렬 재사용이 전혀 없음**
   - 문서에는 "차량 모드: 거리 행렬에서 즉시 조회 (API 호출 0회 가능)"라고 되어 있으나
   - 실제로는 모든 구간에 대해 API 호출을 하고 있음

2. **거리 행렬 저장 전략이 결정되지 않음**
   - 문서 Step 4.2에서 "거리 행렬 저장 위치 결정"이 체크되어 있으나
   - 실제 구현에서는 거리 행렬을 사용하지 않음

**권장 사항**:
1. 거리 행렬 저장 위치 결정 (옵션 1 또는 2 권장)
2. 차량 모드에서 거리 행렬 재사용 로직 추가
3. 거리 행렬에 없는 구간만 API 호출

---

### 5. 자동 저장 로직 (Step 5) ⚠️

**상태**: 기본 구현됨 (편집 모드 체크 부족)

**파일**: `hooks/use-auto-save-itinerary.ts`

**확인 사항**:
- ✅ 변경사항 감지 (deep comparison)
- ✅ Debounce (500ms)
- ✅ cleanup 함수 구현
- ✅ 저장 상태 관리
- ⚠️ **편집 모드가 아닐 때도 작동할 수 있음**

**문제점**:
1. **편집 모드 체크 없음**
   - Hook이 `isEditMode` 상태를 받지 않음
   - 편집 모드가 아닐 때도 자동 저장이 트리거될 수 있음

**현재 사용** (`app/(main)/my/trips/[tripId]/page.tsx:1058`):
```typescript
const { saveStatus } = useAutoSaveItinerary(tripId, editedItineraries);
```

**문제**: `isEditMode`가 `false`일 때도 `editedItineraries`가 변경되면 자동 저장이 실행됨

**권장 사항**:
1. Hook에 `isEditMode` 파라미터 추가
2. 편집 모드가 아닐 때는 자동 저장 비활성화

---

### 6. 편집 모드 UI 컴포넌트 (Step 6) ✅

**상태**: 대부분 잘 구현됨

#### 6.1 편집 모드 토글 버튼 ✅
**파일**: `components/itinerary/edit-mode-toggle.tsx`
- ✅ 구현 완료
- ✅ 읽기 모드/편집 모드 UI 구분

#### 6.2 편집 모드 전용 일정 뷰 ✅
**파일**: `components/itinerary/itinerary-edit-view.tsx`
- ✅ DndContext 설정 완료
- ✅ 드래그 앤 드롭 기본 로직 구현
- ✅ 일차 간 이동 지원

#### 6.3 일차 헤더 컴포넌트 ✅
**파일**: `components/itinerary/day-header.tsx`
- ✅ 구현 완료
- ✅ 일차 정보 표시

#### 6.4 드래그 가능한 일정 항목 ✅
**파일**: `components/itinerary/draggable-schedule-item.tsx`
- ✅ useSortable 설정 완료
- ✅ 드래그 핸들 구현
- ✅ 삭제 버튼 구현
- ✅ 드래그 중 시각적 피드백

#### 6.5 드롭 존 컴포넌트 ✅
**파일**: `components/itinerary/drop-zone.tsx`
- ✅ useDroppable 설정 완료
- ✅ 드롭 가능 위치 시각적 표시

#### 6.6 편집 모드 툴바 ✅
**파일**: `components/itinerary/edit-mode-toolbar.tsx`
- ✅ 구현 완료
- ✅ 저장 상태 표시
- ✅ 경로 재계산 버튼

**결론**: UI 컴포넌트는 모두 잘 구현됨

---

### 7. 드래그 앤 드롭 로직 (Step 7) ⚠️

**상태**: 기본 구현됨 (일차 간 이동 로직 복잡)

**파일**: `components/itinerary/itinerary-edit-view.tsx`

**확인 사항**:
- ✅ DndContext 설정
- ✅ sensors 설정 (마우스, 터치, 키보드)
- ✅ onDragStart 핸들러
- ✅ onDragEnd 핸들러
- ⚠️ 일차 간 이동 로직이 복잡함

**문제점**:
1. **일차 간 이동 로직 복잡도**
   - `handleDragEnd`에서 드롭 위치 파싱이 복잡함
   - 드롭 존 ID와 장소 ID를 모두 처리해야 함
   - 버그 가능성이 있음

**현재 로직** (`itinerary-edit-view.tsx:93-162`):
```typescript
// 같은 일차 내 이동
if (overIdStr.startsWith(`day-${fromDay}-place-`)) {
  // ...
}
// 다른 일차로 이동 (드롭 존)
else if (overIdStr.startsWith(`day-`) && overIdStr.includes("-drop-")) {
  // ...
}
// 다른 일차의 특정 장소 앞/뒤로 이동
else if (overIdStr.startsWith(`day-`) && overIdStr.includes("-place-")) {
  // ...
}
```

**권장 사항**:
1. 로직 단순화 고려
2. 테스트 케이스 추가 (특히 일차 간 이동)

---

### 8. 메인 페이지 통합 (Step 8) ⚠️

**상태**: 기본 구현됨 (일부 문제 있음)

**파일**: `app/(main)/my/trips/[tripId]/page.tsx`

**확인 사항**:
- ✅ 편집 모드 상태 추가
- ✅ 편집 모드 토글 버튼 추가
- ✅ 조건부 렌더링 구현
- ✅ 자동 저장 Hook 통합
- ⚠️ 자동 저장이 편집 모드 외부에서도 작동

**문제점**:
1. **자동 저장 Hook이 편집 모드 체크 없이 사용됨**
   - `useAutoSaveItinerary(tripId, editedItineraries)` 호출
   - `isEditMode`가 `false`일 때도 작동할 수 있음

**권장 사항**:
1. 편집 모드일 때만 자동 저장 Hook 사용
2. 또는 Hook 내부에서 편집 모드 체크 추가

---

### 9. 장소 관리 기능 (Step 9) ✅

**상태**: 기본 기능 구현됨

**확인 사항**:
- ✅ 장소 삭제 기능 구현
- ✅ 일차별 최소 1개 장소 확인
- ✅ 삭제 확인 다이얼로그
- ⚠️ 체류 시간 변경 기능 미구현 (선택적 기능)

**결론**: 필수 기능은 구현됨, 선택적 기능은 문서대로 미구현

---

### 10. 경로 재계산 기능 (Step 10) ⚠️

**상태**: 부분 구현됨

**확인 사항**:
- ✅ 경로 재계산 버튼 구현
- ✅ `recalculateRoutes` Server Action 호출
- ✅ 로딩 상태 표시
- ⚠️ 차량 모드 최적화 부족

**결론**: 기본 기능은 구현되었으나 차량 모드 최적화 필요

---

### 11. 에러 처리 및 검증 (Step 11) ✅

**상태**: 잘 구현됨

**파일**: `lib/optimize/validate-itinerary.ts`

**확인 사항**:
- ✅ 일차별 최소 1개 장소 확인
- ✅ 일과 시간 범위 확인
- ✅ 체류 시간 유효성 검증
- ✅ 에러 메시지 명확함

**결론**: 잘 구현됨

---

## 🎯 우선순위별 수정 사항

### 🔴 높은 우선순위

1. **차량 모드 거리 행렬 재사용 구현**
   - 파일: `actions/itinerary/recalculate-routes.ts`
   - 거리 행렬 저장 위치 결정 필요
   - `getRouteFromDistanceMatrix` 함수 활용
   - 예상 시간: 2-3시간

2. **자동 저장 Hook 편집 모드 체크 추가**
   - 파일: `hooks/use-auto-save-itinerary.ts` 또는 `app/(main)/my/trips/[tripId]/page.tsx`
   - 편집 모드가 아닐 때 자동 저장 비활성화
   - 예상 시간: 30분

### 🟡 중간 우선순위

3. **드래그 앤 드롭 일차 간 이동 로직 개선**
   - 파일: `components/itinerary/itinerary-edit-view.tsx`
   - 로직 단순화 및 테스트 추가
   - 예상 시간: 1-2시간

4. **거리 행렬 저장 전략 결정 및 구현**
   - 문서 Step 4.2 참고
   - 옵션 1 또는 2 선택 후 구현
   - 예상 시간: 2-3시간

### 🟢 낮은 우선순위

5. **체류 시간 변경 기능 구현** (선택적)
   - 문서에서 선택적 기능으로 명시됨
   - 필요 시 구현
   - 예상 시간: 2시간

---

## 📝 결론

전체적으로 구현은 잘 되어 있으나, 다음 사항들이 개선이 필요합니다:

1. **차량 모드 최적화**: 거리 행렬 재사용이 전혀 구현되지 않아 API 호출이 불필요하게 많음
2. **자동 저장 로직**: 편집 모드가 아닐 때도 작동할 수 있어 불필요한 저장 발생 가능
3. **드래그 앤 드롭 로직**: 일차 간 이동 로직이 복잡하여 버그 가능성 있음

대부분의 기능은 문서대로 잘 구현되어 있으며, 위의 문제점들을 수정하면 완성도가 크게 향상될 것입니다.

---

## ✅ 수정 완료 (2025-01-XX)

### 1. 차량 모드 거리 행렬 재사용 구현 ✅
- **수정 내용**: 차량 모드에서도 `getRouteFromStoredItinerary` 함수를 사용하여 기존 일정의 `transportToNext` 정보를 재사용하도록 수정
- **파일**: `actions/itinerary/recalculate-routes.ts`
- **효과**: 차량 모드에서도 기존 경로 정보를 재사용하여 API 호출 최소화

### 2. 자동 저장 Hook 편집 모드 체크 추가 ✅
- **수정 내용**: `useAutoSaveItinerary` Hook에 `isEditMode` 파라미터 추가, 편집 모드가 아닐 때는 자동 저장 비활성화
- **파일**: `hooks/use-auto-save-itinerary.ts`, `app/(main)/my/trips/[tripId]/page.tsx`
- **효과**: 편집 모드가 아닐 때 불필요한 저장 방지

### 3. 체류 시간 변경 기능 구현 ✅
- **수정 내용**: 다이얼로그 방식으로 체류 시간 편집 UI 추가, 30분 단위 제한, `updateScheduleItem` 호출, 시간 재계산 및 자동 저장
- **파일**: `components/itinerary/draggable-schedule-item.tsx`, `components/itinerary/itinerary-edit-view.tsx`, `app/(main)/my/trips/[tripId]/page.tsx`
- **효과**: 사용자가 편집 모드에서 체류 시간을 쉽게 변경할 수 있음

