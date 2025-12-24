# OurRoad 개발 TODO

> PRD 기반 체계적인 개발 태스크 목록
> **순서**: 백엔드 → 프론트엔드 → 마케팅

---

## 목차

1. [Phase 0: 프로젝트 초기 설정](#phase-0-프로젝트-초기-설정)
2. [백엔드 (Backend)](#백엔드-backend)
3. [프론트엔드 (Frontend)](#프론트엔드-frontend)
4. [마케팅 (Marketing)](#마케팅-marketing)
5. [마일스톤](#마일스톤)

---

## Phase 0: 프로젝트 초기 설정

### 환경 설정

- [x] Next.js 15.5.7 + React 19 프로젝트 설정
- [x] Clerk 인증 설정 (한국어 로컬라이제이션 포함)
- [x] Supabase 연동 설정
- [x] Tailwind CSS v4 설정
- [x] ESLint 설정
- [x] `.env` 파일 업데이트
  - [x] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - [x] `CLERK_SECRET_KEY`
  - [x] `NEXT_PUBLIC_SUPABASE_URL`
  - [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [x] `SUPABASE_SERVICE_ROLE_KEY`
  - [x] `NEXT_PUBLIC_KAKAO_MAP_KEY` - Kakao Maps JavaScript 키 (템플릿 추가됨)
  - [x] `KAKAO_REST_API_KEY` - Kakao Local API 키 (템플릿 추가됨)
  - [x] `KAKAO_MOBILITY_KEY` - Kakao Mobility API 키 (템플릿 추가됨)
  - [x] `ODSAY_API_KEY` - ODsay 대중교통 API 키 (템플릿 추가됨)
- [x] `.env.example` 파일 생성 (API 키 발급 가이드 포함)
- [x] Git 브랜치 전략 확정 (`docs/GIT_STRATEGY.md`)

### Supabase 클라이언트 설정

> 파일: `lib/supabase/`

- [x] `lib/supabase/clerk-client.ts` - Client Component용 (useClerkSupabaseClient hook)
- [x] `lib/supabase/server.ts` - Server Component/Server Action용
- [x] `lib/supabase/service-role.ts` - 관리자 권한 작업용
- [x] `lib/supabase/client.ts` - 인증 불필요한 공개 데이터용
- [x] `lib/utils.ts` - 공통 유틸리티 (cn 함수)

### 사용자 동기화 (Clerk → Supabase)

- [x] `hooks/use-sync-user.ts` - 사용자 동기화 훅
- [x] `components/providers/sync-user-provider.tsx` - 자동 동기화 Provider
- [x] `app/api/sync-user/route.ts` - 동기화 API 라우트

### 타입 정의 (공용)

> 파일: `types/`

- [x] `types/index.ts` - 공용 export
- [x] `types/trip.ts` - Trip, TripStatus 타입
- [x] `types/place.ts` - Place, Coordinate, PlaceCategory 타입
- [x] `types/route.ts` - RouteSegment, TransportMode 타입
- [x] `types/schedule.ts` - FixedSchedule, ScheduleItem, DailyItinerary 타입
- [x] `types/optimize.ts` - OptimizeRequest, OptimizeResult, OptimizeOptions 타입
- [x] `types/admin.ts` - ErrorLog, ErrorSeverity, AdminUser, AdminRole 타입
- [x] `types/kakao.ts` - Kakao API 응답 타입
- [x] `types/odsay.ts` - ODsay API 응답 타입

---

## 백엔드 (Backend)

### Phase 1: 데이터베이스 설정

> 파일: `supabase/migrations/`

#### 테이블 생성

- [x] `schema.sql` - 통합 스키마 파일 생성
  - [x] PostGIS 확장 활성화
  - [x] users 테이블 생성 (Clerk 동기화용)
  - [x] trips 테이블 생성
    - [x] daily_start_time, daily_end_time 컬럼 포함 (기본 10:00, 22:00)
    - [x] 제약조건 (날짜 검증, 최대 30일)
  - [x] trip_places 테이블 생성
    - [x] estimated_duration 컬럼 (30~720분, CHECK 제약)
    - [x] 30분 단위 제약조건
  - [x] trip_fixed_schedules 테이블 생성
  - [x] trip_itineraries 테이블 생성
    - [x] schedule JSONB 컬럼 (상세 일정 배열)
  - [x] error_logs 테이블 생성
    - [x] 인덱스 생성 (resolved, severity, created_at, error_code)
  - [x] admin_users 테이블 생성

#### RLS 정책 설정

- [x] users 테이블 RLS 정책
- [x] trips 테이블 RLS 정책 (사용자별 접근 제어)
- [x] trip_places 테이블 RLS 정책
- [x] trip_fixed_schedules 테이블 RLS 정책
- [x] trip_itineraries 테이블 RLS 정책
- [x] error_logs 테이블 RLS 정책 (관리자 전용)
- [x] admin_users 테이블 RLS 정책 (super_admin만 관리)

#### Storage 버킷

- [x] uploads 버킷 생성 (비공개, 50MB 제한)
- [x] trip-images 버킷 생성 (공개, 10MB 제한)
- [x] Storage RLS 정책 설정

#### 유틸리티 함수

- [x] `is_admin()` - 관리자 여부 확인
- [x] `is_super_admin()` - Super Admin 여부 확인
- [x] `is_trip_owner()` - 여행 소유자 확인
- [x] `calculate_trip_days()` - 여행 일수 계산
- [x] `format_duration()` - 체류 시간 포맷
- [x] `update_updated_at_column()` - 트리거 함수

### Phase 2: Zod 스키마 정의

> 파일: `lib/schemas/`

- [x] coordinateSchema - 좌표 검증 (lat: -90~90, lng: -180~180)
- [x] placeSchema - 장소 검증
- [x] fixedScheduleSchema - 고정 일정 검증 (시작 < 종료 시간)
- [x] createTripSchema - 여행 생성 검증 (최대 30일)
- [x] optimizeRequestSchema - 최적화 요청 검증
- [x] durationSchema - 체류 시간 검증 (30분~12시간, 30분 단위)
- [x] timeSchema - 시간 검증 (HH:mm 형식)
- [x] createErrorLogSchema - 에러 로그 생성 검증
- [x] resolveErrorLogSchema - 에러 로그 해결 검증
- [x] errorLogFilterSchema - 에러 로그 필터 검증

### Phase 3: 여행 CRUD Server Actions

> 파일: `actions/trips/`

- [x] `create-trip.ts` - 여행 생성
  - [x] Zod 스키마 검증
  - [x] daily_start_time, daily_end_time 기본값 설정
- [x] `get-trip.ts` - 단일 여행 조회
- [x] `get-trips.ts` - 여행 목록 조회 (사용자별)
- [x] `update-trip.ts` - 여행 수정
- [x] `delete-trip.ts` - 여행 삭제 (CASCADE)

### Phase 4: 장소 관리 Server Actions

> 파일: `actions/places/`

- [ ] `add-place.ts` - 장소 추가
  - [ ] estimated_duration 검증 (30~720분)
- [ ] `remove-place.ts` - 장소 삭제
- [ ] `update-place.ts` - 장소 수정 (체류시간 등)
- [ ] `reorder-places.ts` - 장소 순서 변경
- [ ] `get-places.ts` - 여행별 장소 목록
- [ ] `search-places.ts` - 장소 검색 (Kakao Local API)
- [ ] `get-nearby.ts` - 주변 추천 (Kakao 카테고리 검색)

### Phase 5: 고정 일정 Server Actions

> 파일: `actions/schedules/`

- [ ] `add-fixed-schedule.ts` - 고정 일정 추가
- [ ] `update-fixed-schedule.ts` - 고정 일정 수정
- [ ] `delete-fixed-schedule.ts` - 고정 일정 삭제
- [ ] `get-fixed-schedules.ts` - 여행별 고정 일정 목록

### Phase 6: 외부 API 클라이언트

> 파일: `lib/api/`

#### Kakao API

- [ ] `lib/api/kakao.ts`
  - [ ] 키워드 검색 (`/v2/local/search/keyword.json`)
  - [ ] 카테고리 검색 (`/v2/local/search/category.json`)
  - [ ] 좌표→주소 변환 (`/v2/local/geo/coord2address.json`)
  - [ ] 자동차 경로 조회 (Kakao Mobility API)
  - [ ] 재시도 로직 (3회, 지수 백오프)

#### ODsay API

- [ ] `lib/api/odsay.ts`
  - [ ] 대중교통 경로 조회 (`/v1/api/searchPubTransPathT`)
  - [ ] 환승 정보 파싱
  - [ ] 재시도 로직

### Phase 7: 최적화 엔진

> 파일: `lib/optimize/`

#### 핵심 알고리즘

- [ ] `lib/optimize/types.ts` - 최적화 관련 타입 정의
- [ ] `lib/optimize/distance-matrix.ts` - 거리 행렬 계산
  - [ ] Haversine 공식 (직선거리)
  - [ ] API 기반 실제 거리 (선택)
- [ ] `lib/optimize/nearest-neighbor.ts` - Nearest Neighbor 알고리즘
  - [ ] O(n²) 시간 복잡도
  - [ ] 초기 경로 생성
- [ ] `lib/optimize/two-opt.ts` - 2-opt 개선 알고리즘
  - [ ] 최대 100회 반복
  - [ ] 개선율 5~10% 목표
- [ ] `lib/optimize/daily-distributor.ts` - 일자별 분배 로직
  - [ ] 일일 최대 480분 (8시간) 제한
  - [ ] daily_start_time, daily_end_time 반영
- [ ] `lib/optimize/constraint-handler.ts` - 고정 일정 제약 처리
  - [ ] 시간 창 제약 (Time Windows)
  - [ ] 충돌 감지 및 에러 반환
- [ ] `lib/optimize/index.ts` - 통합 export

#### 유틸리티

- [ ] `lib/utils/haversine.ts` - Haversine 거리 계산
- [ ] `lib/utils/retry.ts` - 재시도 유틸리티 (지수 백오프)

### Phase 8: 경로 조회 Server Actions

> 파일: `actions/routes/`

- [ ] `get-car-route.ts` - 자동차 경로 조회 (Kakao Mobility)
- [ ] `get-transit-route.ts` - 대중교통 경로 조회 (ODsay)
- [ ] `get-walking-route.ts` - 도보 경로 조회
- [ ] **중요**: 선호 수단으로만 조회 (자동 전환 없음)
- [ ] 경로 없음 시 RouteNotFoundError 반환

### Phase 9: 최적화 실행 Server Actions

> 파일: `actions/optimize/`

- [ ] `optimize-route.ts` - 경로 최적화 실행
  - [ ] 1. 거리 행렬 계산
  - [ ] 2. Nearest Neighbor 초기 경로
  - [ ] 3. 2-opt 개선
  - [ ] 4. 고정 일정 반영
  - [ ] 5. 일자별 분배
  - [ ] 6. 구간 이동 정보 조회
- [ ] `save-itinerary.ts` - 최적화 결과 저장
- [ ] `calculate-distance.ts` - 거리 행렬 계산 (단독 호출용)
- [ ] `distribute-days.ts` - 일자별 분배 (단독 호출용)

### Phase 10: 일정 조회/수정 Server Actions

> 파일: `actions/itinerary/`

- [ ] `get-itinerary.ts` - 최적화 결과 조회
- [ ] `update-itinerary.ts` - 결과 수동 수정
- [ ] 결과 캐싱 로직 구현

### Phase 11: 관리자 기능 Server Actions

> 파일: `actions/admin/`

- [ ] `get-error-logs.ts` - 에러 로그 목록 조회
  - [ ] 필터링 (resolved, severity, errorCode, source, 기간)
  - [ ] 페이지네이션 (기본 50건)
- [ ] `resolve-error-log.ts` - 에러 로그 해결 처리
  - [ ] resolved_at, resolved_by 자동 기록
  - [ ] resolution_note 저장
- [ ] `delete-error-log.ts` - 에러 로그 삭제
  - [ ] 해결된 항목만 삭제 가능
- [ ] `log-error.ts` - 에러 로그 기록 (서비스 내부용)

---

## 프론트엔드 (Frontend)

### Phase 1: 전역 레이아웃 설정

> **중요**: 모바일 최적화 고정형 레이아웃 (375px~430px)

- [x] `app/layout.tsx` - RootLayout 설정
  - [x] ClerkProvider 적용
  - [x] SyncUserProvider 적용
- [ ] 전역 컨테이너 CSS 설정
  ```css
  .app-container {
    width: 100%;
    max-width: 430px;
    margin: 0 auto;
    min-height: 100vh;
  }
  ```
- [ ] 데스크톱 배경색 구분 (회색)
- [ ] 모바일 Safe Area 대응 (env())

### Phase 2: shadcn 컴포넌트 설치

- [x] `button` - 버튼 컴포넌트
- [x] `input` - 입력 컴포넌트
- [x] `form` - 폼 컴포넌트
- [x] `label` - 라벨 컴포넌트
- [x] `dialog` - 다이얼로그 컴포넌트
- [x] `accordion` - 아코디언 컴포넌트
- [x] `textarea` - 텍스트에어리어 컴포넌트
- [ ] `pnpx shadcn@latest add calendar`
- [ ] `pnpx shadcn@latest add popover`
- [ ] `pnpx shadcn@latest add command`
- [ ] `pnpx shadcn@latest add card`
- [ ] `pnpx shadcn@latest add tabs`
- [ ] `pnpx shadcn@latest add badge`
- [ ] `pnpx shadcn@latest add skeleton`
- [ ] `pnpx shadcn@latest add select`
- [ ] `pnpx shadcn@latest add slider`
- [ ] `pnpx shadcn@latest add toast`
- [ ] `pnpx shadcn@latest add sheet`
- [ ] `pnpx shadcn@latest add table`

### Phase 3: 여행 관련 UI 컴포넌트

> 파일: `components/trip/`

- [ ] `trip-form.tsx` - 여행 기본 정보 폼
- [ ] `date-picker.tsx` - 날짜 선택 (시작일/종료일)
- [ ] `location-input.tsx` - 출발지/도착지 입력
  - [ ] Kakao 자동완성 연동
  - [ ] 현재 위치 버튼
  - [ ] **시작 시간 드롭다운** (기본 10:00)
  - [ ] **도착 시간 드롭다운** (기본 22:00)
- [ ] `transport-selector.tsx` - 이동수단 선택
  - [ ] 도보+대중교통 / 차량 옵션

### Phase 4: 장소 관련 UI 컴포넌트

> 파일: `components/places/`

- [ ] `place-search.tsx` - 장소 검색 입력창
  - [ ] debounce 적용 (300ms)
  - [ ] Kakao 키워드 검색 연동
- [ ] `place-card.tsx` - 장소 카드
  - [ ] 이미지, 이름, 카테고리 표시
  - [ ] **체류 시간 드롭다운** (30분~12시간, 30분 단위)
- [ ] `place-list.tsx` - 선택된 장소 리스트
  - [ ] 드래그 앤 드롭 순서 변경
  - [ ] 스와이프 삭제
- [ ] `nearby-recommendations.tsx` - 주변 추천 모달
  - [ ] 카테고리별 필터 (음식점, 카페, 관광명소)
  - [ ] 반경 500m~1km

### Phase 5: 일정 관련 UI 컴포넌트

> 파일: `components/schedule/`

- [ ] `fixed-schedule-form.tsx` - 고정 일정 입력 폼
  - [ ] 장소 선택
  - [ ] 시작/종료 시간 입력
- [ ] `schedule-timeline.tsx` - 일정 타임라인 뷰

### Phase 6: 일정표 UI 컴포넌트 (일자별 탭)

> 파일: `components/itinerary/`
> **중요**: 일자별 탭 네비게이션 방식

- [ ] `day-tabs.tsx` - 일자별 탭 네비게이션
  - [ ] 탭 표시: "1일차\n12/24" 형식
  - [ ] 활성 탭 인디케이터
  - [ ] **좌우 스와이프로 일자 전환**
  - [ ] 상단 고정 (sticky)
- [ ] `day-content.tsx` - 일자별 일정 내용
  - [ ] 장소 타임라인 표시
- [ ] `schedule-item.tsx` - 개별 일정 항목
  - [ ] 장소명 + 시간 + 체류시간
  - [ ] 고정 일정 배경색 구분
- [ ] `route-segment.tsx` - 구간별 이동 정보
  - [ ] 이동수단 아이콘
  - [ ] 소요시간, 거리
- [ ] `day-summary.tsx` - 일자별 요약
  - [ ] 총 이동거리/시간
  - [ ] 장소 수, 체류시간
- [ ] `itinerary-export.tsx` - 내보내기 (링크 복사, 이미지)

### Phase 7: 지도 관련 UI 컴포넌트

> 파일: `components/map/`

- [ ] `kakao-map.tsx` - 카카오 맵 래퍼
  - [ ] SDK 동적 로드
- [ ] `place-markers.tsx` - 장소 마커 표시
  - [ ] 번호 표시
- [ ] `route-polyline.tsx` - 경로 폴리라인
- [ ] `info-window.tsx` - 마커 클릭 정보창
- [ ] `current-location.tsx` - 현재 위치 표시
- [ ] `map-controls.tsx` - 줌/현재위치 컨트롤

### Phase 8: 관리자 UI 컴포넌트

> 파일: `components/admin/`

- [ ] `error-log-table.tsx` - 에러 로그 테이블
  - [ ] 컬럼: 발생 시간, 에러 코드, 메시지, 심각도, 상태
  - [ ] 페이지네이션
- [ ] `error-log-filter.tsx` - 에러 로그 필터
  - [ ] 해결 상태, 심각도, 에러 코드, 기간
- [ ] `error-log-detail.tsx` - 에러 로그 상세 모달
  - [ ] 스택 트레이스, 컨텍스트 표시
- [ ] `resolve-dialog.tsx` - 해결 처리 다이얼로그
  - [ ] 해결 메모 입력
- [ ] `admin-sidebar.tsx` - 관리자 사이드바

### Phase 9: 커스텀 훅

> 파일: `hooks/`

- [x] `use-sync-user.ts` - Clerk→Supabase 사용자 동기화
- [ ] `use-kakao-map.ts` - 맵 인스턴스 관리
- [ ] `use-geolocation.ts` - 현재 위치 추적
- [ ] `use-debounce.ts` - 디바운스 훅
- [ ] `use-swipe.ts` - 스와이프 제스처 훅

### Phase 10: 페이지 구현

> 파일: `app/`

#### 기존 페이지

- [x] `app/page.tsx` - 메인 페이지 (임시)
- [x] `app/layout.tsx` - 루트 레이아웃
- [x] `app/globals.css` - 전역 스타일
- [x] `app/auth-test/page.tsx` - 인증 테스트 페이지
- [x] `app/storage-test/page.tsx` - 스토리지 테스트 페이지

#### 메인/인증 페이지

- [ ] `app/page.tsx` - 랜딩 페이지 (리뉴얼)
  - [ ] 모바일 고정형 레이아웃 적용
- [ ] `app/(auth)/sign-in/[[...sign-in]]/page.tsx` - 로그인
- [ ] `app/(auth)/sign-up/[[...sign-up]]/page.tsx` - 회원가입

#### 여행 계획 페이지

- [ ] `app/plan/page.tsx` - 새 여행 시작
- [ ] `app/plan/[tripId]/page.tsx` - 여행 편집 메인
- [ ] `app/plan/[tripId]/places/page.tsx` - 장소 관리
  - [ ] 장소 검색 및 추가
  - [ ] 체류 시간 선택 (30분~12시간)
- [ ] `app/plan/[tripId]/schedule/page.tsx` - 고정 일정 설정
- [ ] `app/plan/[tripId]/result/page.tsx` - 최적화 결과
  - [ ] **일자별 탭 네비게이션**
  - [ ] 스와이프로 일자 전환

#### 마이페이지

- [ ] `app/my/page.tsx` - 저장된 여행 목록
- [ ] `app/my/trips/[tripId]/page.tsx` - 저장된 여행 상세

#### 네비게이션 페이지

- [ ] `app/navigate/[tripId]/page.tsx` - 실시간 네비게이션
  - [ ] 현재 위치 표시
  - [ ] 다음 목적지 경로 하이라이트
  - [ ] Kakao 앱 연동 버튼

#### 관리자 페이지

- [ ] `app/admin/page.tsx` - 관리자 대시보드
- [ ] `app/admin/error-logs/page.tsx` - 에러 로그 관리
  - [ ] 필터링, 페이지네이션
  - [ ] 해결 처리, 삭제 기능

### Phase 11: UX 완성도

- [ ] 모바일 고정형 레이아웃 전체 적용 확인
- [ ] 터치 타겟 검증 (최소 44px, 권장 48px)
- [ ] 로딩 스켈레톤 적용
- [ ] 에러 상태 UI
- [ ] 빈 상태 UI
- [ ] 토스트 알림 시스템
- [ ] 풀다운 새로고침 (Pull-to-refresh)
- [ ] 스와이프 제스처 힌트

---

## 마케팅 (Marketing)

### Phase 1: 브랜드 아이덴티티

> 파일: `marketing/brand/`

- [ ] 브랜드 가이드라인 문서 작성
  - [ ] 로고 디자인 (다크/라이트 버전)
  - [ ] 브랜드 컬러 팔레트
  - [ ] 폰트 가이드 (Pretendard)
  - [ ] 로고 사용 가이드
- [ ] 브랜드 에셋 준비
  - [ ] 로고 SVG/PNG (다양한 크기)
  - [x] 파비콘 (`app/favicon.ico`)
  - [ ] OG 이미지 (1200x630) (`public/og-image.png`)
  - [ ] 앱 아이콘 (`public/icons/`)

### Phase 2: Instagram 마케팅

> 파일: `marketing/instagram/`

#### 계정 설정

- [ ] 비즈니스 계정 생성 (@ourroad_kr)
- [ ] 프로필 설정 (이미지, 바이오, 링크)
- [ ] 하이라이트 카테고리 기획
  - [ ] 서비스 소개
  - [ ] 사용법
  - [ ] 여행 팁
  - [ ] 사용자 후기

#### 콘텐츠 템플릿

- [ ] 피드 포스트 템플릿 (1080x1080)
  - [ ] 기능 소개
  - [ ] 여행지 추천
  - [ ] 팁 카드
- [ ] 스토리 템플릿 (1080x1920)
  - [ ] 질문/투표
  - [ ] 카운트다운
- [ ] 릴스 썸네일 템플릿

#### 콘텐츠 캘린더

- [ ] `marketing/instagram/calendar.md` 작성
- [ ] Week 1 (티저): 브랜드 소개, 문제 제기
- [ ] Week 2 (기대감): 기능 힌트, 개발 비하인드
- [ ] Week 3 (본격 홍보): 핵심 기능 소개
- [ ] Week 4 (런칭): 카운트다운, 런칭 발표

#### 해시태그 전략

- [ ] `marketing/instagram/hashtags.md` 작성
- [ ] 메인: #아워로드 #OurRoad #여행동선
- [ ] 기능: #여행계획 #여행일정 #동선최적화
- [ ] 감성: #여행스타그램 #국내여행

### Phase 3: Twitter/X 마케팅

> 파일: `marketing/twitter/`

- [ ] 계정 생성 (@ourroad_kr)
- [ ] 프로필/헤더 이미지 제작
- [ ] 런칭 스레드 기획 (10-15 트윗)
- [ ] 콘텐츠 캘린더 작성

### Phase 4: YouTube 마케팅

> 파일: `marketing/youtube/`

- [ ] 채널 생성 및 설정
- [ ] 서비스 소개 영상 (2분)
  - [ ] 스크립트
  - [ ] 스토리보드
  - [ ] 촬영/편집
- [ ] 튜토리얼 시리즈 (각 3-5분)
  - [ ] EP1: 여행 만들기
  - [ ] EP2: 장소 추가하기
  - [ ] EP3: 일정 최적화하기
  - [ ] EP4: 결과 확인 및 활용
- [ ] Shorts 콘텐츠 (30초)

### Phase 5: 블로그/SEO

> 파일: `marketing/blog/`

#### SEO 전략

- [ ] 키워드 리서치
  - [ ] 주요: 여행 동선, 여행 계획, 여행 일정 짜기
  - [ ] 롱테일 키워드 목록 (30개 이상)
- [ ] 기술적 SEO
  - [ ] 메타 태그 최적화
  - [ ] 구조화된 데이터 (Schema.org)
  - [ ] `app/sitemap.ts` 설정
  - [ ] `app/robots.ts` 설정

#### 블로그 포스트 기획

- [ ] 런칭 전: "효율적인 여행 동선 짜는 5가지 방법"
- [ ] 런칭 전: "여행 계획, 왜 항상 실패할까?"
- [ ] 런칭 후: "OurRoad 완벽 가이드"
- [ ] 시리즈: 지역별 여행 가이드 (서울, 부산, 제주)

### Phase 6: 런칭 캠페인

> 파일: `marketing/launch/`

#### 타임라인

- [ ] D-30: 마케팅 채널 계정 생성, 에셋 완성
- [ ] D-14: 티저 캠페인 시작
- [ ] D-7: 본격 홍보 (기능 미리보기)
- [ ] D-Day: 런칭 발표 (모든 채널)
- [ ] D+7: 사용자 피드백 수집, 후속 콘텐츠

#### 프레스킷

- [ ] 서비스 소개서 (1페이지 PDF)
- [ ] 스크린샷 에셋 (고해상도)
- [ ] 로고 패키지
- [ ] 팀 소개 및 연락처

### Phase 7: 마케팅 분석

> 파일: `marketing/analytics/`

- [ ] Google Analytics 4 설정
- [ ] UTM 파라미터 체계 수립
  ```
  utm_source: instagram, twitter, youtube, blog
  utm_medium: social, organic, referral
  utm_campaign: launch, feature-x, tip-series
  ```
- [ ] 전환 이벤트 정의
  - [ ] 회원가입
  - [ ] 여행 생성
  - [ ] 최적화 완료
  - [ ] 일정 저장
- [ ] 주간 리포트 템플릿 작성

---

## 마일스톤

| 마일스톤 | 목표 | 주요 완료 항목 | 상태 |
|---------|------|--------------|------|
| **M0** | 프로젝트 초기화 | Next.js, Clerk, Supabase 연동, DB 스키마 | ✅ 완료 |
| **M1** | MVP 입력 기능 | 여행 생성, 장소 추가, 지도 표시 | 🔄 진행중 |
| **M2** | 최적화 엔진 | TSP 알고리즘, 일자 분배, 경로 조회 | ⏳ 대기 |
| **M3** | 결과 & 저장 | 일정표 UI (일자별 탭), 마이페이지, 저장 기능 | ⏳ 대기 |
| **M4** | 네비게이션 | 현재 위치, 경로 안내, 앱 연동 | ⏳ 대기 |
| **M5** | 관리자 기능 | 에러 로그 관리 페이지 | ⏳ 대기 |
| **M6** | 마케팅 준비 | 브랜드 에셋, SNS 계정, 콘텐츠 제작 | ⏳ 대기 |
| **M7** | 런칭 | 서비스 오픈, 런칭 캠페인, 모니터링 | ⏳ 대기 |

---

## 진행 상황 요약

### 완료된 항목 (✅)

- **인프라**: Next.js 15, React 19, Clerk 인증, Supabase 연동, Tailwind CSS v4
- **DB**: 전체 스키마 생성 (7개 테이블 + RLS + Storage + 유틸리티 함수)
- **Supabase 클라이언트**: 4종 (clerk-client, server, service-role, client)
- **사용자 동기화**: Clerk → Supabase 자동 동기화 구현
- **UI 컴포넌트**: shadcn 기본 컴포넌트 7개 설치

### 다음 단계 (🔄)

1. Kakao/ODsay API 키 등록
2. TypeScript 타입 정의
3. Zod 스키마 정의
4. 여행 CRUD Server Actions 구현

---

## 참고 링크

### 개발 문서

- [PRD 문서](./PRD.md)

### 외부 API

- [Kakao Developers](https://developers.kakao.com)
- [Kakao Maps API](https://apis.map.kakao.com/web/documentation/)
- [Kakao Mobility API](https://developers.kakaomobility.com)
- [ODsay LAB](https://lab.odsay.com)

### 인프라

- [Supabase Dashboard](https://supabase.com/dashboard)
- [Clerk Dashboard](https://dashboard.clerk.dev)
- [Vercel Dashboard](https://vercel.com/dashboard)

### 마케팅 도구

- [Canva](https://www.canva.com)
- [Later](https://later.com)
- [Google Analytics](https://analytics.google.com)
