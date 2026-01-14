# 일정 편집 모드 구현 가이드

이 문서는 `.cursor/design/itinerary-edit-mode.md` 설계 문서를 바탕으로 일정 편집 모드 기능을 바이브코딩 원칙에 따라 구현하기 위한 단계별 가이드입니다.

## 📋 목차

1. [현재 코드베이스 분석](#현재-코드베이스-분석)
2. [바이브코딩 주의사항 (AI 혼동 방지)](#바이브코딩-주의사항-ai-혼동-방지)
3. [구현 순서 (우선순위별)](#구현-순서-우선순위별)
4. [단계별 상세 작업](#단계별-상세-작업)
5. [참고 파일 및 리소스](#참고-파일-및-리소스)

---

## 현재 코드베이스 분석

### ✅ 이미 구현된 기능

- `DayContentPanel`, `DayContent`, `ScheduleItem` 컴포넌트 존재
- `getItinerary`, `updateDayItinerary`, `reorderScheduleItems`, `moveScheduleItem` Server Actions 존재
- `ScheduleItem`에 `draggable` prop이 있으나 실제 드래그 기능은 미구현
- 일정 표시는 `/my/trips/[tripId]` 페이지에서 `DayTabsContainer`로 일차별 탭 표시

### ✅ 구현 완료된 기능

- 드래그 앤 드롭 라이브러리 (`@dnd-kit`) 설치 완료
- 편집 모드 토글 UI 구현 완료
- 드래그 앤 드롭 기능 구현 완료
- 일차 간 이동 기능 구현 완료
- 자동 저장 (debounce) 구현 완료
- 시간 재계산 로직 구현 완료
- 경로 재계산 기능 구현 완료
- 편집 모드 전용 UI 컴포넌트들 구현 완료
- 장소 삭제 기능 구현 완료
- 에러 처리 및 검증 로직 구현 완료

### ❌ 아직 구현되지 않은 기능 (선택적)

- 체류 시간 변경 기능 (선택적 기능)

---

## 바이브코딩 주의사항 (AI 혼동 방지)

### ⚠️ 중요: 기존 코드와의 충돌 방지

**절대 하지 말아야 할 것:**

- ❌ 기존 `DayContentPanel`, `DayContent`, `ScheduleItem` 컴포넌트를 수정하여 편집 모드 기능 추가
- ❌ 읽기 모드와 편집 모드를 같은 컴포넌트에서 조건부로 처리
- ❌ 기존 Server Actions를 수정하여 편집 모드 전용 로직 추가

**올바른 접근:**

- ✅ 편집 모드는 **완전히 별도의 컴포넌트**로 구현 (`ItineraryEditView`, `DraggableScheduleItem` 등)
- ✅ 읽기 모드와 편집 모드는 **조건부 렌더링**으로 분리
- ✅ 기존 Server Actions는 그대로 사용하고, 필요시 새로운 Action 추가

### ⚠️ 파일 상단 문서화 필수

**모든 새로 생성하는 파일의 첫 100줄 이내에 반드시 포함:**

```typescript
/**
 * @file [파일명]
 * @description [파일의 기능과 목적]
 *
 * [주요 기능 설명]
 * 1. [기능 1]
 * 2. [기능 2]
 *
 * 핵심 구현 로직:
 * - [로직 설명]
 *
 * @dependencies
 * - [의존성 1]
 * - [의존성 2]
 *
 * @see {@link [관련 파일 경로]} - [설명]
 */
```

### ⚠️ 타입 정의 시 주의사항

- 기존 타입(`ScheduleItem`, `DailyItinerary`)을 **절대 수정하지 않음**
- 새로운 타입은 기존 타입을 **확장(extend)**하는 방식으로 작성
- 타입 이름은 명확하게 구분 (예: `EditState`, `DraggableScheduleItem`)

### ⚠️ 드래그 앤 드롭 구현 시 주의사항

- `@dnd-kit`의 `DndContext`는 **최상위에 하나만** 존재해야 함
- 드래그 항목 ID 형식은 **일관되게** 유지: `day-{dayNumber}-place-{placeId}`
- 일차 간 이동과 일차 내 이동을 **명확히 구분**하여 처리

### ⚠️ 자동 저장 구현 시 주의사항

- Debounce 타이머는 **반드시 cleanup** (useEffect return)
- 저장 실패 시 **재시도 로직** 구현
- 저장 상태는 **명확하게** 표시 (saving, saved, error)

### ⚠️ 시간 재계산 로직 주의사항

- 기존 `transportToNext` 정보를 **최대한 재사용**
- `dayOrigin`, `dayDestination` 처리 **반드시 포함**
- `dailyStartTime`, `dailyEndTime` 고려

### ⚠️ 경로 재계산 주의사항

- **순서는 유지**하고 경로 정보만 업데이트 (최적화 알고리즘 재실행 아님)
- 차량 모드: 거리 행렬에서 **즉시 조회** (API 호출 0회 가능)
- 대중교통 모드: 동일한 구간은 **시간 관계없이 재사용**

### ⚠️ 상태 관리 주의사항

- 편집 모드 진입 시 **원본 일정 반드시 백업**
- 편집 중인 일정과 원본 일정을 **명확히 분리**하여 관리
- 편집 모드 종료 시 변경사항 확인 (선택적)

---

## 구현 순서 (우선순위별)

### 🎯 1단계: 핵심 기능 (MVP) - 필수

1. 환경 설정 (라이브러리 설치)
2. 타입 정의
3. 편집 모드 토글 버튼
4. 편집 모드 전용 일정 뷰 (기본 구조)
5. 드래그 앤 드롭 기본 로직
6. 메인 페이지 통합
7. 자동 저장 기본 로직

### 🎯 2단계: 시간 재계산 - 필수

8. 시간 재계산 유틸리티 함수
9. 장소 삭제 기능

### 🎯 3단계: 경로 재계산 - 중요

10. 경로 정보 재사용 함수
11. 경로 재계산 Server Action
12. 경로 재계산 버튼

### 🎯 4단계: 선택적 기능

13. 체류 시간 변경
14. 성능 최적화

### 🎯 5단계: 마무리

15. 에러 처리 및 검증
16. 테스트 및 검증
17. 문서화 및 정리

---

## 단계별 상세 작업

## Step 1: 환경 설정

### 작업 1.1: 드래그 앤 드롭 라이브러리 설치

**파일:** `package.json`

**작업:**

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**확인사항:**

- [x] 설치 완료 확인
- [x] React 19 호환성 확인
- [x] 버전 기록

**예상 시간:** 5분

---

## Step 2: 타입 정의

### 작업 2.1: 편집 상태 타입 추가

**파일:** `types/schedule.ts`

**⚠️ 주의:** 기존 타입을 수정하지 않고 **파일 끝에 추가**

**작업:**

```typescript
/**
 * 편집 모드 상태 관리 타입
 */
export interface EditState {
  isEditing: boolean;
  originalItinerary: DailyItinerary[];
  editedItinerary: DailyItinerary[];
  saveStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt?: Date;
  changes: {
    moved: Array<{
      placeId: string;
      fromDay: number;
      fromOrder: number;
      toDay: number;
      toOrder: number;
    }>;
    added: Array<{
      placeId: string;
      day: number;
      order: number;
    }>;
    deleted: string[];
    durationChanged: Array<{
      placeId: string;
      oldDuration: number;
      newDuration: number;
    }>;
    fixedScheduleChanged: boolean;
  };
}

/**
 * 드래그 항목 ID 형식
 * 형식: day-{dayNumber}-place-{placeId}
 */
export type DragItemId = `day-${number}-place-${string}`;

/**
 * 드롭 존 ID 형식
 * 형식: day-{dayNumber}-drop-{insertIndex}
 */
export type DropZoneId = `day-${number}-drop-${number}`;
```

**확인사항:**

- [x] 기존 타입과 충돌하지 않음
- [x] 타입 정의 완료

**예상 시간:** 10분

---

## Step 3: 시간 재계산 유틸리티

### 작업 3.1: 시간 재계산 함수 생성

**파일:** `lib/optimize/recalculate-time.ts` (새 파일)

**⚠️ 주의:**

- 기존 `lib/optimize/` 디렉토리 구조 확인 후 생성
- 기존 최적화 로직과 충돌하지 않도록 주의
- 파일 상단에 반드시 문서화 주석 추가

**작업:**

```typescript
/**
 * @file recalculate-time.ts
 * @description 일정 시간 재계산 유틸리티 함수
 *
 * 편집 모드에서 장소 순서가 변경되었을 때, 기존 이동 시간 데이터를 재사용하여
 * 새로운 도착/출발 시간을 계산합니다.
 *
 * 주요 기능:
 * 1. 각 일차별로 순회하며 시간 재계산
 * 2. dayOrigin 또는 첫 장소부터 시작
 * 3. 각 장소의 도착 시간 = 이전 장소 출발 시간 + 이동 시간
 * 4. 출발 시간 = 도착 시간 + 체류 시간
 * 5. dailyStartTime, dailyEndTime 업데이트
 *
 * 핵심 구현 로직:
 * - 기존 transportToNext 정보를 최대한 재사용
 * - dayOrigin, dayDestination 처리 포함
 * - dailyStartTime, dailyEndTime 고려
 *
 * @dependencies
 * - @/types/schedule: DailyItinerary, ScheduleItem, RouteSegment
 * - @/lib/optimize: normalizeTime (시간 포맷팅)
 *
 * @see {@link .cursor/design/itinerary-edit-mode.md} - 설계 문서
 */

import type {
  DailyItinerary,
  ScheduleItem,
  RouteSegment,
} from "@/types/schedule";
import { normalizeTime } from "@/lib/optimize";

/**
 * 일정 시간 재계산
 *
 * @param itineraries - 재계산할 일정 배열
 * @param dailyStartTime - 일과 시작 시간 (HH:mm, 기본값: "10:00")
 * @param dailyEndTime - 일과 종료 시간 (HH:mm, 기본값: "22:00")
 * @returns 시간이 재계산된 일정 배열
 */
export function recalculateItineraryTimes(
  itineraries: DailyItinerary[],
  dailyStartTime: string = "10:00",
  dailyEndTime: string = "22:00",
): DailyItinerary[] {
  // ✅ 구현 완료
  // 1. 각 일차별로 순회
  // 2. dayOrigin 또는 첫 장소부터 시작
  // 3. 각 장소의 도착 시간 = 이전 장소 출발 시간 + 이동 시간
  // 4. 출발 시간 = 도착 시간 + 체류 시간
  // 5. dailyStartTime, dailyEndTime 업데이트

  return itineraries;
}
```

**확인사항:**

- [x] 파일 생성 및 기본 구조 작성
- [x] 함수 시그니처 정의
- [x] TODO 주석으로 구현 계획 명시
- [x] 함수 구현 완료

**예상 시간:** 1시간

**참고:**

- `lib/optimize/` 디렉토리의 기존 파일들 확인
- `normalizeTime` 함수 활용 방법 확인

### 작업 3.2: 경로 정보 재사용 함수 (차량 모드)

**파일:** `lib/optimize/reuse-route-info.ts` (새 파일)

**⚠️ 주의:**

- 거리 행렬 데이터 구조 확인 필요
- 최적화 시 생성된 거리 행렬이 어디에 저장되는지 확인

**작업:**

```typescript
/**
 * @file reuse-route-info.ts
 * @description 경로 정보 재사용 유틸리티 함수
 *
 * 편집 모드에서 순서 변경 시, 기존에 조회한 경로 정보를 재사용하여
 * API 호출을 최소화합니다.
 *
 * 주요 기능:
 * 1. 차량 모드: 거리 행렬에서 경로 정보 조회
 * 2. 대중교통 모드: trip_itineraries 테이블에서 기존 경로 정보 검색
 *
 * @dependencies
 * - @/types/schedule: RouteSegment
 * - @/types/route: RouteSegment
 */

import type { RouteSegment } from "@/types/route";

/**
 * 거리 행렬에서 경로 정보 조회 (차량 모드)
 *
 * @param placeId1 - 출발지 장소 ID
 * @param placeId2 - 도착지 장소 ID
 * @param distanceMatrix - 거리 행렬 (Map<string, Map<string, RouteSegment>>)
 * @returns 경로 정보 또는 null
 */
export function getRouteFromDistanceMatrix(
  placeId1: string,
  placeId2: string,
  distanceMatrix: Map<string, Map<string, RouteSegment>>,
): RouteSegment | null {
  // ✅ 구현 완료
  return distanceMatrix.get(placeId1)?.get(placeId2) ?? null;
}
```

**확인사항:**

- [x] 파일 생성
- [x] 함수 시그니처 정의
- [x] 함수 구현 완료

**예상 시간:** 30분

### 작업 3.3: 경로 정보 재사용 함수 (대중교통 모드)

**파일:** `lib/optimize/reuse-route-info.ts`

**⚠️ 주의:**

- 시간 관계없이 동일한 구간은 재사용 (API 한정량 절약)
- Supabase 쿼리 작성 시 RLS 정책 확인

**작업:**

```typescript
/**
 * trip_itineraries 테이블에서 기존 경로 정보 검색 (대중교통 모드)
 *
 * @param tripId - 여행 ID
 * @param fromPlaceId - 출발지 장소 ID
 * @param toPlaceId - 도착지 장소 ID
 * @returns 경로 정보 또는 null
 */
export async function getRouteFromStoredItinerary(
  tripId: string,
  fromPlaceId: string,
  toPlaceId: string,
): Promise<RouteSegment | null> {
  // ✅ 구현 완료
  // 1. Supabase 클라이언트 생성
  // 2. trip_itineraries 테이블에서 해당 구간 검색
  // 3. transportToNext에서 일치하는 구간 찾기
  // 4. RouteSegment 형식으로 변환하여 반환

  return null;
}
```

**확인사항:**

- [x] 함수 구현
- [x] Supabase 쿼리 테스트

**예상 시간:** 1시간

**참고:**

- `actions/itinerary/get-itinerary.ts` 참고
- Supabase 쿼리 작성 방법 확인

---

## Step 4: 경로 재계산 Server Action

### 작업 4.1: 경로 재계산 Action 생성

**파일:** `actions/itinerary/recalculate-routes.ts` (새 파일)

**⚠️ 주의:**

- 기존 `actions/itinerary/update-itinerary.ts`와의 중복 방지
- **순서는 유지**하고 경로 정보만 업데이트 (최적화 알고리즘 재실행 아님)
- 차량 모드와 대중교통 모드를 명확히 구분

**작업:**

```typescript
/**
 * @file recalculate-routes.ts
 * @description 경로 재계산 Server Action
 *
 * 편집 모드에서 사용자가 순서를 변경한 후, 실제 경로 정보를 다시 조회합니다.
 * 순서는 유지하고 경로 정보만 업데이트합니다. (최적화 알고리즘 재실행 아님)
 *
 * 주요 기능:
 * 1. 현재 Trip 정보 조회 (이동 수단 확인)
 * 2. 각 구간별로 재사용 가능 여부 판단
 * 3. 새로 생긴 구간만 API 호출
 * 4. 거리 행렬 업데이트 (차량 모드)
 * 5. transportToNext 업데이트
 * 6. 시간 재계산
 * 7. DB 저장
 *
 * @dependencies
 * - @clerk/nextjs/server: auth
 * - @/lib/supabase/server: createClerkSupabaseClient
 * - @/types/schedule: DailyItinerary
 * - @/actions/trips/get-trip: getTrip
 * - @/actions/routes/get-car-route: getCarRoute
 * - @/actions/routes/get-transit-route: getTransitRoute
 *
 * @see {@link .cursor/design/itinerary-edit-mode.md} - 설계 문서
 */

"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import type { DailyItinerary } from "@/types/schedule";
import { getTrip } from "@/actions/trips/get-trip";

export interface RecalculateRoutesInput {
  tripId: string;
  itineraries: DailyItinerary[];
}

export interface RecalculateRoutesResult {
  success: boolean;
  data?: DailyItinerary[];
  error?: string;
}

/**
 * 경로 재계산 Server Action
 *
 * @param input - 재계산할 일정 정보
 * @returns 재계산된 일정 또는 에러
 */
export async function recalculateRoutes(
  input: RecalculateRoutesInput,
): Promise<RecalculateRoutesResult> {
  // ✅ 구현 완료
  // 1. 인증 확인
  // 2. Trip 정보 조회 (이동 수단 확인)
  // 3. 각 구간별로 재사용 가능 여부 판단
  // 4. 새로 생긴 구간만 API 호출
  // 5. 거리 행렬 업데이트 (차량 모드)
  // 6. transportToNext 업데이트
  // 7. 시간 재계산
  // 8. DB 저장

  return {
    success: false,
    error: "Not implemented",
  };
}
```

**확인사항:**

- [x] 파일 생성 및 기본 구조 작성
- [x] 함수 시그니처 정의
- [x] 함수 구현 완료

**예상 시간:** 3시간

**참고:**

- `actions/routes/get-car-route.ts` 참고
- `actions/routes/get-transit-route.ts` 참고
- `actions/optimize/optimize-route.ts` 참고

### 작업 4.2: 거리 행렬 저장 전략 결정

**⚠️ 중요 결정 사항:**

거리 행렬 저장 위치를 결정해야 합니다:

1. **옵션 1: Supabase JSONB 필드 (trips 테이블)**

   - 장점: 영구 저장, 서버 재시작 시에도 유지
   - 단점: 테이블 구조 변경 필요

2. **옵션 2: 별도 테이블 생성**

   - 장점: 구조화된 저장, 쿼리 용이
   - 단점: 마이그레이션 필요

3. **옵션 3: 메모리 캐시 (서버 재시작 시 손실)**
   - 장점: 빠른 접근
   - 단점: 서버 재시작 시 손실

**권장:** 옵션 1 또는 2 (영구 저장 필요)

**작업:**

- [ ] 저장 위치 결정
- [ ] 선택한 방식으로 구현

**예상 시간:** 1시간

---

## Step 5: 자동 저장 로직

### 작업 5.1: 자동 저장 Hook 생성

**파일:** `hooks/use-auto-save-itinerary.ts` (새 파일)

**⚠️ 주의:**

- 기존 `hooks/use-trip-draft.ts`와의 충돌 방지
- Debounce 타이머는 **반드시 cleanup** (useEffect return)
- 에러 처리 및 재시도 로직 구현

**작업:**

```typescript
/**
 * @file use-auto-save-itinerary.ts
 * @description 일정 자동 저장 Hook
 *
 * 편집 모드에서 일정이 변경될 때마다 자동으로 저장하는 Hook입니다.
 * Debounce를 적용하여 불필요한 저장 요청을 최소화합니다.
 *
 * 주요 기능:
 * 1. 변경사항 감지 (deep comparison)
 * 2. Debounce (500ms)
 * 3. updateDayItinerary 호출 (각 일차별로)
 * 4. 저장 상태 관리 (saving, saved, error)
 *
 * 핵심 구현 로직:
 * - useEffect로 변경사항 감지
 * - setTimeout으로 Debounce 구현
 * - cleanup 함수로 타이머 정리 필수
 *
 * @dependencies
 * - react: useEffect, useState, useCallback
 * - @/actions/itinerary/update-itinerary: updateDayItinerary
 * - @/types/schedule: DailyItinerary
 *
 * @see {@link hooks/use-debounce.ts} - Debounce 유틸리티 (참고)
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { DailyItinerary } from "@/types/schedule";
import { updateDayItinerary } from "@/actions/itinerary/update-itinerary";

export interface UseAutoSaveItineraryResult {
  saveStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt?: Date;
  save: () => Promise<void>;
}

/**
 * 일정 자동 저장 Hook
 *
 * @param tripId - 여행 ID
 * @param itineraries - 저장할 일정 배열
 * @returns 저장 상태 및 저장 함수
 */
export function useAutoSaveItinerary(
  tripId: string,
  itineraries: DailyItinerary[],
): UseAutoSaveItineraryResult {
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousItinerariesRef = useRef<DailyItinerary[]>(itineraries);

  // ✅ 구현 완료
  // 1. 변경사항 감지 (deep comparison)
  // 2. Debounce (500ms)
  // 3. updateDayItinerary 호출 (각 일차별로)
  // 4. 저장 상태 관리
  // 5. cleanup 함수로 타이머 정리

  const save = useCallback(async () => {
    // ✅ 구현 완료
  }, [tripId, itineraries]);

  return {
    saveStatus,
    lastSavedAt,
    save,
  };
}
```

**확인사항:**

- [x] 파일 생성 및 기본 구조 작성
- [x] Debounce 로직 구현
- [x] cleanup 함수 구현
- [x] 변경사항 감지 로직 구현

**예상 시간:** 2시간

**참고:**

- `hooks/use-debounce.ts` 확인
- `actions/itinerary/update-itinerary.ts` 참고

### 작업 5.2: 변경사항 감지 로직

**파일:** `hooks/use-auto-save-itinerary.ts`

**작업:**

- [x] 변경사항 감지 함수 구현
  - [x] 순서 변경 감지
  - [x] 장소 추가/삭제 감지
  - [x] 체류 시간 변경 감지
  - [x] 일차 간 이동 감지

**예상 시간:** 1시간

---

## Step 6: 편집 모드 UI 컴포넌트

### 작업 6.1: 편집 모드 토글 버튼

**파일:** `components/itinerary/edit-mode-toggle.tsx` (새 파일)

**⚠️ 주의:**

- 기존 버튼 스타일과 일관성 유지
- `components/ui/button.tsx` 사용

**작업:**

```typescript
/**
 * @file edit-mode-toggle.tsx
 * @description 편집 모드 토글 버튼 컴포넌트
 *
 * 일정 편집 모드를 켜고 끄는 토글 버튼입니다.
 * 읽기 모드에서는 "편집 모드" 버튼을, 편집 모드에서는 "완료" / "취소" 버튼을 표시합니다.
 *
 * @dependencies
 * - react
 * - @/components/ui/button: Button
 * - lucide-react: 아이콘
 */

"use client";

import { Button } from "@/components/ui/button";
// TODO: 아이콘 import

interface EditModeToggleProps {
  isEditing: boolean;
  onToggle: () => void;
  onCancel?: () => void;
}

export function EditModeToggle({
  isEditing,
  onToggle,
  onCancel,
}: EditModeToggleProps) {
  // ✅ 구현 완료
  // 읽기 모드: "편집 모드" 버튼
  // 편집 모드: "완료" / "취소" 버튼

  return null;
}
```

**확인사항:**

- [ ] 파일 생성
- [ ] 컴포넌트 기본 구조 작성

**예상 시간:** 30분

**참고:**

- `components/ui/button.tsx` 사용
- `app/(main)/my/trips/[tripId]/page.tsx` 헤더 구조 확인

### 작업 6.2: 편집 모드 전용 일정 뷰

**파일:** `components/itinerary/itinerary-edit-view.tsx` (새 파일)

**⚠️ 주의:**

- 기존 `DayContentPanel`과의 충돌 방지
- 편집 모드일 때만 표시되도록 조건부 렌더링
- `DndContext`는 최상위에 하나만 존재

**작업:**

```typescript
/**
 * @file itinerary-edit-view.tsx
 * @description 편집 모드 전용 일정 뷰 컴포넌트
 *
 * 편집 모드에서 모든 일차의 일정을 세로로 나열하여 드래그 앤 드롭으로
 * 순서를 변경할 수 있게 하는 컴포넌트입니다.
 *
 * 주요 기능:
 * 1. 모든 일차를 세로로 나열
 * 2. 스크롤 가능한 영역
 * 3. 드래그 앤 드롭 지원
 * 4. 일차 간 이동 지원
 *
 * 구조:
 * - DndContext (최상위)
 *   - DayHeader (드래그 불가)
 *   - DraggableScheduleItem들
 *   - DropZone들
 *
 * @dependencies
 * - @dnd-kit/core: DndContext
 * - @dnd-kit/sortable: SortableContext
 * - react
 * - @/components/itinerary/day-header: DayHeader
 * - @/components/itinerary/draggable-schedule-item: DraggableScheduleItem
 * - @/components/itinerary/drop-zone: DropZone
 *
 * @see {@link .cursor/design/itinerary-edit-mode.md} - 설계 문서
 */

"use client";

import { DndContext } from "@dnd-kit/core";
import type { DailyItinerary, ScheduleItem } from "@/types/schedule";

interface ItineraryEditViewProps {
  itineraries: DailyItinerary[];
  onReorder: (dayNumber: number, newOrder: string[]) => void;
  onMove: (
    fromDay: number,
    toDay: number,
    placeId: string,
    toIndex: number,
  ) => void;
  onDelete: (dayNumber: number, placeId: string) => void;
}

export function ItineraryEditView({
  itineraries,
  onReorder,
  onMove,
  onDelete,
}: ItineraryEditViewProps) {
  // ✅ 구현 완료
  // 1. DndContext 설정
  // 2. 각 일차별로 DayHeader + DraggableScheduleItem들 렌더링
  // 3. DropZone 배치

  return <DndContext>{/* ✅ 구현 완료 */}</DndContext>;
}
```

**확인사항:**

- [x] 파일 생성 및 기본 구조 작성
- [x] DndContext 설정
- [x] 드래그 앤 드롭 로직 구현 완료

**예상 시간:** 2시간

**참고:**

- `@dnd-kit/core`의 `DndContext` 사용
- `components/itinerary/day-content.tsx` 참고

### 작업 6.3: 일차 헤더 컴포넌트

**파일:** `components/itinerary/day-header.tsx` (새 파일)

**⚠️ 주의:**

- 기존 `DayContentHeader`와의 구분
- **Sticky header가 아님** (일반 스크롤과 함께 이동)
- 드롭 존 역할 (일차 헤더 아래에 드롭 가능)

**작업:**

```typescript
/**
 * @file day-header.tsx
 * @description 편집 모드용 일차 헤더 컴포넌트
 *
 * 편집 모드에서 각 일차의 헤더를 표시하는 컴포넌트입니다.
 * 드래그 불가하며, 일반 스크롤 요소입니다.
 * 일차 헤더 아래에 드롭 가능한 드롭 존 역할도 합니다.
 *
 * @dependencies
 * - react
 * - @/types/schedule: DailyItinerary
 */

"use client";

interface DayHeaderProps {
  dayNumber: number;
  date: string;
  placeCount: number;
}

export function DayHeader({ dayNumber, date, placeCount }: DayHeaderProps) {
  // ✅ 구현 완료
  // 일차 정보 표시 (예: "📅 1일차 (2025-01-20 월요일)")

  return null;
}
```

**확인사항:**

- [ ] 파일 생성
- [ ] 컴포넌트 기본 구조 작성

**예상 시간:** 30분

**참고:**

- `components/itinerary/day-content.tsx`의 `DayContentHeader` 참고
- Sticky header가 아님을 명확히

### 작업 6.4: 드래그 가능한 일정 항목

**파일:** `components/itinerary/draggable-schedule-item.tsx` (새 파일)

**⚠️ 주의:**

- 기존 `ScheduleItem` 컴포넌트와의 통합 방안 고려
- 편집 모드에서만 삭제 버튼 표시
- 드래그 중 시각적 피드백 (opacity 0.5, shadow)

**작업:**

```typescript
/**
 * @file draggable-schedule-item.tsx
 * @description 드래그 가능한 일정 항목 컴포넌트
 *
 * 편집 모드에서 드래그 앤 드롭으로 순서를 변경할 수 있는 일정 항목입니다.
 * 기존 ScheduleItem의 기능을 확장하여 드래그 기능을 추가했습니다.
 *
 * 주요 기능:
 * 1. @dnd-kit/sortable의 useSortable 사용
 * 2. 드래그 핸들
 * 3. 삭제 버튼 (편집 모드에서만)
 * 4. 체류 시간 편집 (선택적)
 *
 * @dependencies
 * - @dnd-kit/sortable: useSortable
 * - @dnd-kit/core: useDraggable
 * - react
 * - @/components/itinerary/schedule-item: ScheduleItem (참고)
 * - @/types/schedule: ScheduleItem
 */

"use client";

import { useSortable } from "@dnd-kit/sortable";
import type { ScheduleItem } from "@/types/schedule";

interface DraggableScheduleItemProps {
  item: ScheduleItem;
  dayNumber: number;
  onDelete?: () => void;
  onDurationChange?: (duration: number) => void;
}

export function DraggableScheduleItem({
  item,
  dayNumber,
  onDelete,
  onDurationChange,
}: DraggableScheduleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `day-${dayNumber}-place-${item.placeId}`,
  });

  // ✅ 구현 완료
  // 1. 드래그 핸들 추가
  // 2. 삭제 버튼 추가 (편집 모드에서만)
  // 3. 드래그 중 시각적 피드백

  return null;
}
```

**확인사항:**

- [x] 파일 생성 및 기본 구조 작성
- [x] useSortable 설정
- [x] 드래그 핸들 및 삭제 버튼 구현 완료

**예상 시간:** 2시간

**참고:**

- `components/itinerary/schedule-item.tsx` 참고
- `@dnd-kit/sortable` 문서 참고

### 작업 6.5: 드롭 존 컴포넌트

**파일:** `components/itinerary/drop-zone.tsx` (새 파일)

**⚠️ 주의:**

- 드래그 중일 때만 표시
- 장소 사이 또는 일차 헤더 아래 위치

**작업:**

```typescript
/**
 * @file drop-zone.tsx
 * @description 드롭 존 컴포넌트
 *
 * 편집 모드에서 드래그 중일 때 드롭 가능한 위치를 시각적으로 표시하는 컴포넌트입니다.
 *
 * @dependencies
 * - react
 * - @dnd-kit/core: useDroppable
 */

"use client";

import { useDroppable } from "@dnd-kit/core";

interface DropZoneProps {
  dayNumber: number;
  insertIndex: number;
  isActive: boolean;
}

export function DropZone({ dayNumber, insertIndex, isActive }: DropZoneProps) {
  const { setNodeRef } = useDroppable({
    id: `day-${dayNumber}-drop-${insertIndex}`,
  });

  // ✅ 구현 완료
  // 드롭 가능 위치 시각적 표시 (회색 점선 박스)

  return null;
}
```

**확인사항:**

- [x] 파일 생성 및 기본 구조 작성
- [x] useDroppable 설정
- [x] 드롭 존 시각적 표시 구현 완료

**예상 시간:** 1시간

### 작업 6.6: 편집 모드 툴바

**파일:** `components/itinerary/edit-mode-toolbar.tsx` (새 파일)

**⚠️ 주의:**

- 하단 고정 (sticky bottom)
- 자동 저장 상태 명확히 표시

**작업:**

```typescript
/**
 * @file edit-mode-toolbar.tsx
 * @description 편집 모드 툴바 컴포넌트
 *
 * 편집 모드 하단에 표시되는 툴바입니다.
 * 편집 종료, 경로 재계산 버튼과 자동 저장 상태를 표시합니다.
 *
 * @dependencies
 * - react
 * - @/components/ui/button: Button
 */

"use client";

import { Button } from "@/components/ui/button";

interface EditModeToolbarProps {
  onExit: () => void;
  onRecalculate: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  isRecalculating: boolean;
}

export function EditModeToolbar({
  onExit,
  onRecalculate,
  saveStatus,
  isRecalculating,
}: EditModeToolbarProps) {
  // ✅ 구현 완료
  // 1. "편집 종료" 버튼
  // 2. "경로 재계산" 버튼
  // 3. 자동 저장 상태 표시 (저장 중/저장됨/에러)

  return null;
}
```

**확인사항:**

- [x] 파일 생성 및 기본 구조 작성
- [x] 툴바 구현 완료
- [x] 경로 재계산 버튼 구현 완료

**예상 시간:** 1시간

**참고:**

- `components/ui/button.tsx` 사용
- `app/(main)/my/trips/[tripId]/page.tsx` 하단 버튼 영역 참고

---

## Step 7: 드래그 앤 드롭 로직

### 작업 7.1: 드래그 앤 드롭 컨텍스트 설정

**파일:** `components/itinerary/itinerary-edit-view.tsx`

**⚠️ 주의:**

- `DndContext`는 최상위에 하나만 존재
- 일차 간 이동 지원
- 자동 스크롤 (드래그가 화면 끝에 가까우면)

**작업:**

- [x] `DndContext` 설정
  - [x] `sensors`: 마우스, 터치 지원
  - [x] `collisionDetection`: 커스텀 또는 기본
  - [x] `onDragStart`: 드래그 시작 핸들러
  - [x] `onDragOver`: 드래그 중 핸들러
  - [x] `onDragEnd`: 드롭 핸들러

**예상 시간:** 1시간

**참고:**

- `@dnd-kit/core` 문서 참고
- `@dnd-kit/sortable`의 `closestCenter` 또는 커스텀 collision detection

### 작업 7.2: 드래그 시작 핸들러

**파일:** `components/itinerary/itinerary-edit-view.tsx`

**작업:**

- [x] `onDragStart` 구현
  - [x] 드래그 중인 항목 ID 파싱
  - [x] 드래그 중인 항목 상태 업데이트
  - [x] 원래 위치에 플레이스홀더 표시

**예상 시간:** 30분

### 작업 7.3: 드래그 중 핸들러

**파일:** `components/itinerary/itinerary-edit-view.tsx`

**작업:**

- [x] `onDragOver` 구현
  - [x] 드롭 가능 위치 감지
  - [x] 드롭 존 하이라이트
  - [x] 자동 스크롤 (드래그가 화면 끝에 가까우면)

**예상 시간:** 1시간

**참고:**

- 자동 스크롤: `@dnd-kit/core`의 `useSensor` 또는 직접 구현

### 작업 7.4: 드롭 핸들러

**파일:** `components/itinerary/itinerary-edit-view.tsx`

**⚠️ 주의:**

- 같은 일차 내: `reorderScheduleItems` 사용
- 다른 일차: `moveScheduleItem` 사용
- 시간 재계산 트리거
- 자동 저장 트리거

**작업:**

- [x] `onDragEnd` 구현
  - [x] 드롭 위치 파싱
  - [x] 같은 일차 내: 순서 변경
  - [x] 다른 일차: 일차 간 이동
  - [x] 시간 재계산 트리거
  - [x] 자동 저장 트리거

**예상 시간:** 2시간

**참고:**

- `reorderScheduleItems` Server Action 사용
- `moveScheduleItem` Server Action 사용

---

## Step 8: 메인 페이지 통합

### 작업 8.1: 편집 모드 상태 추가

**파일:** `app/(main)/my/trips/[tripId]/page.tsx`

**⚠️ 주의:**

- 기존 기능과의 충돌 방지
- 편집 모드 진입 시 원본 일정 반드시 백업

**작업:**

- [x] `useState<boolean>`로 `isEditMode` 상태 추가
- [x] 편집 모드 진입 시 원본 일정 백업 (`originalItinerary`)
- [x] 편집 모드 종료 시 변경사항 확인 (선택적)

**예상 시간:** 30분

### 작업 8.2: 편집 모드 토글 버튼 추가

**파일:** `app/(main)/my/trips/[tripId]/page.tsx`

**작업:**

- [x] 헤더 영역에 `EditModeToggle` 컴포넌트 추가
- [x] 기존 헤더 구조 확인 후 적절한 위치에 배치
- [x] 토글 핸들러 연결

**예상 시간:** 30분

**참고:**

- 기존 헤더 구조: `app/(main)/my/trips/[tripId]/page.tsx` 확인

### 작업 8.3: 조건부 렌더링 구현

**파일:** `app/(main)/my/trips/[tripId]/page.tsx`

**⚠️ 중요:**

- 편집 모드와 읽기 모드를 명확히 분리
- 기존 `DayTabsContainer` + `DayContentPanel`은 읽기 모드에서만 사용

**작업:**

- [x] 편집 모드: `ItineraryEditView` 표시
- [x] 읽기 모드: 기존 `DayTabsContainer` + `DayContentPanel` 표시
- [x] 조건부 렌더링 로직 추가

**예상 시간:** 30분

### 작업 8.4: 하단 버튼 영역 수정

**파일:** `app/(main)/my/trips/[tripId]/page.tsx`

**작업:**

- [x] 편집 모드: `EditModeToolbar` 표시
- [x] 읽기 모드: 기존 버튼 표시
- [x] 조건부 렌더링 로직 추가

**예상 시간:** 30분

### 작업 8.5: 자동 저장 Hook 통합

**파일:** `app/(main)/my/trips/[tripId]/page.tsx`

**작업:**

- [x] `useAutoSaveItinerary` Hook 사용
- [x] 편집 중인 일정 상태와 연결
- [x] 저장 상태 표시

**예상 시간:** 30분

### 작업 8.6: 드래그 앤 드롭 이벤트 핸들러 연결

**파일:** `app/(main)/my/trips/[tripId]/page.tsx`

**작업:**

- [x] 순서 변경 핸들러: `reorderScheduleItems` 호출
- [x] 일차 간 이동 핸들러: `moveScheduleItem` 호출
- [x] 시간 재계산 트리거
- [x] 자동 저장 트리거

**예상 시간:** 1시간

---

## Step 9: 장소 관리 기능

### 작업 9.1: 장소 삭제 기능

**파일:** `components/itinerary/draggable-schedule-item.tsx`

**⚠️ 주의:**

- 일차별 최소 1개 장소 확인
- 삭제 후 순서 재할당

**작업:**

- [x] 삭제 버튼 추가 (편집 모드에서만 표시)
- [x] 삭제 확인 다이얼로그
- [x] `deleteScheduleItem` Server Action 호출
- [x] 시간 재계산 및 자동 저장

**예상 시간:** 1시간

**참고:**

- `actions/itinerary/update-itinerary.ts`의 `deleteScheduleItem` 사용

### 작업 9.2: 체류 시간 변경 기능 (선택적)

**파일:** `components/itinerary/draggable-schedule-item.tsx`

**작업:**

- [x] 체류 시간 편집 UI 추가
  - 옵션 2: 다이얼로그 (구현 완료)
- [x] 30분 단위 제한
- [x] `updateScheduleItem` Server Action 호출
- [x] 시간 재계산 및 자동 저장

**예상 시간:** 2시간

**참고:**

- `actions/itinerary/update-itinerary.ts`의 `updateScheduleItem` 사용
- 일과 시간 범위 검증

---

## Step 10: 경로 재계산 기능

### 작업 10.1: 경로 재계산 버튼 구현

**파일:** `components/itinerary/edit-mode-toolbar.tsx`

**⚠️ 주의:**

- 순서는 유지하고 경로 정보만 업데이트
- 최적화 알고리즘 재실행이 아님을 명확히 표시

**작업:**

- [x] "경로 재계산" 버튼 추가
- [x] 클릭 시 `recalculateRoutes` Server Action 호출
- [x] 로딩 상태 표시
- [x] 완료 후 일정 업데이트

**예상 시간:** 1시간

---

## Step 11: 에러 처리 및 검증

### 작업 11.1: 검증 로직 구현

**파일:** `lib/optimize/validate-itinerary.ts` (새 파일, 선택적)

**작업:**

- [x] 일차별 최소 1개 장소 확인
- [x] 고정 일정 시간 충돌 확인
- [x] 일과 시간 범위 확인
- [x] 체류 시간 유효성 검증 (30분 단위, 30~720분)

**예상 시간:** 1시간

### 작업 11.2: 에러 처리

**파일:** 각 컴포넌트 및 Hook

**작업:**

- [x] 저장 실패 시 에러 토스트
- [x] 경로 재계산 실패 시 에러 처리
- [x] 일부 구간 API 호출 실패 시 처리 방안
- [x] 네트워크 에러 처리

**예상 시간:** 1시간

### 작업 11.3: 사용자 피드백

**파일:** 각 컴포넌트

**작업:**

- [x] 저장 중: "저장 중..." 표시
- [x] 저장 완료: "저장됨" 표시 (2초 후 사라짐)
- [x] 저장 실패: 에러 토스트
- [x] 경로 재계산 중: 로딩 표시

**예상 시간:** 30분

**참고:**

- `lib/toast.ts` 사용

---

## 참고 파일 및 리소스

### 수정할 파일

- `app/(main)/my/trips/[tripId]/page.tsx` - 메인 페이지 통합

### 새로 생성할 파일

- `types/schedule.ts` - 타입 추가 (기존 파일 수정)
- `lib/optimize/recalculate-time.ts` - 시간 재계산 로직
- `lib/optimize/reuse-route-info.ts` - 경로 정보 재사용
- `actions/itinerary/recalculate-routes.ts` - 경로 재계산 Action
- `hooks/use-auto-save-itinerary.ts` - 자동 저장 Hook
- `components/itinerary/edit-mode-toggle.tsx` - 편집 모드 토글
- `components/itinerary/itinerary-edit-view.tsx` - 편집 모드 뷰
- `components/itinerary/day-header.tsx` - 일차 헤더
- `components/itinerary/draggable-schedule-item.tsx` - 드래그 가능한 항목
- `components/itinerary/drop-zone.tsx` - 드롭 존
- `components/itinerary/edit-mode-toolbar.tsx` - 편집 모드 툴바

### 참고할 기존 파일

- `components/itinerary/day-content.tsx` - 일정 표시 구조
- `components/itinerary/schedule-item.tsx` - 일정 항목 컴포넌트
- `actions/itinerary/update-itinerary.ts` - 일정 업데이트 로직
- `app/(main)/my/trips/[tripId]/page.tsx` - 메인 페이지 구조
- `hooks/use-debounce.ts` - Debounce 유틸리티

### 라이브러리 문서

- `@dnd-kit/core`: https://docs.dndkit.com/
- `@dnd-kit/sortable`: https://docs.dndkit.com/presets/sortable

---

## 진행 상황 추적

### 전체 진행률

- [x] Step 1: 환경 설정
- [x] Step 2: 타입 정의
- [x] Step 3: 시간 재계산 유틸리티
- [x] Step 4: 경로 재계산 Server Action
- [x] Step 5: 자동 저장 로직
- [x] Step 6: 편집 모드 UI 컴포넌트
- [x] Step 7: 드래그 앤 드롭 로직
- [x] Step 8: 메인 페이지 통합
- [x] Step 9: 장소 관리 기능 (장소 삭제 완료, 체류 시간 변경 기능 구현 완료)
- [x] Step 10: 경로 재계산 기능
- [x] Step 11: 에러 처리 및 검증

---

## 업데이트 이력

- 2025-01-XX: 통합 문서 작성 (체크리스트 + TODO 통합)
- 2025-01-XX: Step 1-11 구현 완료 (체류 시간 변경 기능 제외, 선택적 기능)
- 2025-01-XX: 수정 사항 반영
  - 차량 모드 거리 행렬 재사용 구현 (기존 일정의 transportToNext 재사용)
  - 자동 저장 Hook에 편집 모드 체크 추가
  - 체류 시간 변경 기능 구현 완료 (다이얼로그 방식)
