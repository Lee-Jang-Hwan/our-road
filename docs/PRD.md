# PRD: 여행 동선 최적화 서비스 (OurRoad)

## 1. 개요

### 1.1 서비스 정의
사용자가 여행 정보(기간, 장소, 이동수단, 고정일정)를 입력하면 **최적화된 방문 순서, 일자별 배치, 구간별 이동방법**이 포함된 일정표를 자동 생성하는 웹 서비스

### 1.2 핵심 가치
- **자동 동선 생성**: 사용자가 코스를 직접 짜는 것이 아니라, 입력만 하면 자동 생성
- **최적화 엔진**: 테마 또는 최단거리 기반 알고리즘으로 효율적인 동선 제공
- **실행 가능한 일정표**: 저장 리스트를 실제 따라갈 수 있는 일정으로 변환

### 1.3 타겟 사용자
- 여행 계획에 시간을 들이기 어려운 직장인
- 효율적인 동선을 원하는 여행자
- 다수의 장소를 제한된 시간 내 방문해야 하는 사용자

---

## 2. 기술 스택

### 2.1 기존 스택 (유지)
| 카테고리 | 기술 | 버전 |
|---------|------|------|
| Framework | Next.js (App Router) | 15.5.7 |
| React | React | 19 |
| 인증 | Clerk | 최신 |
| DB | Supabase (PostgreSQL) | 최신 |
| 스타일링 | Tailwind CSS v4 | 4.x |
| UI | shadcn/ui | - |
| 폼 | react-hook-form + Zod | - |

### 2.2 추가 기술
| 카테고리 | 기술 | 용도 |
|---------|------|------|
| 지도 | Kakao Maps JavaScript API | 지도 표시, 마커, 폴리라인, 현재 위치 |
| 장소 검색 | Kakao Local API | 키워드/카테고리 검색, 좌표 변환 |
| 자동차 경로 | Kakao Mobility API | 자동차 길찾기, 다중 경유지 (최대 30개) |
| 대중교통 경로 | ODsay API | 대중교통 길찾기, 환승 정보, 시간표 |
| 공간 데이터 | Supabase PostGIS | 좌표 저장, 거리 계산, 주변 검색 |

### 2.3 UI/UX 설계 원칙

#### 모바일 최적화 고정형 레이아웃 (Mobile-First Fixed Layout)

본 서비스는 **반응형이 아닌 모바일 최적화 고정형 레이아웃**으로 설계합니다.

| 항목 | 설계 방침 |
|-----|----------|
| 기준 해상도 | **375px** (iPhone SE/12/13 mini 기준) |
| 최대 너비 | **430px** (대형 스마트폰 대응) |
| 레이아웃 방식 | 고정형 (Fixed Width), 중앙 정렬 |
| 데스크톱 표시 | 모바일 레이아웃 중앙에 표시 (좌우 여백) |

**설계 근거**:
1. **타겟 사용 환경**: 여행 중 이동하면서 확인하는 서비스 특성상 모바일 사용이 95% 이상 예상
2. **일관된 UX**: 모든 화면에서 동일한 레이아웃으로 학습 비용 최소화
3. **개발 효율성**: 하나의 레이아웃만 관리하여 버그 및 유지보수 비용 절감
4. **터치 최적화**: 모바일 전용 설계로 터치 타겟, 스와이프 등 최적화 가능

**레이아웃 구조**:
```
┌──────────────────────────────────────┐
│          Desktop Browser             │
│  ┌─────────────────────────────┐     │
│  │                             │     │
│  │     Mobile Layout (375px)   │     │
│  │                             │     │
│  │     중앙 정렬, 고정 너비      │     │
│  │                             │     │
│  └─────────────────────────────┘     │
│           좌우 여백 (회색)            │
└──────────────────────────────────────┘
```

**CSS 구현 가이드**:
```css
/* 전역 컨테이너 */
.app-container {
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  min-height: 100vh;
  background: white;
}

/* 데스크톱에서 배경색 구분 */
@media (min-width: 431px) {
  body {
    background: #f5f5f5;
  }
}
```

#### 모바일 가독성 및 편의성 가이드라인

**터치 타겟 (Touch Targets)**:
| 요소 | 최소 크기 | 권장 크기 | 간격 |
|-----|----------|----------|-----|
| 버튼 | 44px × 44px | 48px × 48px | 8px 이상 |
| 리스트 항목 | 높이 48px | 높이 56px | - |
| 탭 | 높이 44px | 높이 48px | - |
| 체크박스/라디오 | 24px × 24px | 28px × 28px | 12px |

**타이포그래피**:
| 용도 | 크기 | 굵기 | 행간 |
|-----|-----|-----|-----|
| 페이지 제목 | 24px | Bold (700) | 1.3 |
| 섹션 제목 | 18px | SemiBold (600) | 1.4 |
| 본문 | 16px | Regular (400) | 1.5 |
| 보조 텍스트 | 14px | Regular (400) | 1.4 |
| 캡션/라벨 | 12px | Medium (500) | 1.3 |

**여백 시스템 (Spacing)**:
```
4px  - 아이콘과 텍스트 사이
8px  - 관련 요소 간격
12px - 그룹 내 요소 간격
16px - 섹션 내 여백 (padding)
20px - 카드/컨테이너 내부 여백
24px - 섹션 간 간격
32px - 주요 섹션 구분
```

**색상 대비**:
- 텍스트와 배경 대비율 최소 **4.5:1** (WCAG AA 기준)
- 중요 액션 버튼은 **7:1** 이상 권장
- 비활성화 상태도 **3:1** 이상 유지

**스크롤 및 제스처**:
- 세로 스크롤 기본, 가로 스크롤은 캐러셀에만 사용
- 풀다운 새로고침(Pull-to-refresh) 지원
- 스와이프 삭제는 명확한 시각적 힌트 제공

---

## 3. 기능 명세

### 3.1 입력 기능 (사용자 → 시스템)

#### 3.1.1 여행 기간 선택
- **UI**: 캘린더 컴포넌트 (시작일/종료일 선택)
- **제약**: 최소 1일 ~ 최대 30일
- **저장**: `trips.start_date`, `trips.end_date`

#### 3.1.2 출발지/도착지 설정
- **UI**: 주소 검색 입력 폼 (Kakao Local API 연동)
- **기능**: 자동완성, 현재 위치 버튼
- **출발지 시작 시간**: 드롭다운으로 선택 (기본값: 10:00)
- **도착지 도착 시간**: 드롭다운으로 선택 (기본값: 22:00)
- **저장**: `trips.origin`, `trips.destination` (좌표 + 주소), `trips.daily_start_time`, `trips.daily_end_time`

#### 3.1.3 방문 장소 추가
- **UI**: 검색창 + 장소 리스트
- **기능**:
  - Kakao 키워드 검색
  - 검색 결과에서 선택 → 리스트 추가
  - 드래그 앤 드롭으로 우선순위 조정 (선택사항)
  - **체류 시간 드롭다운 선택**: 30분 ~ 12시간 (30분 단위)
    - 옵션: 30분, 1시간, 1시간 30분, 2시간, ..., 12시간
    - 기본값: 1시간
- **제약**: 최소 2개 ~ 최대 30개
- **저장**: `trip_places` 테이블

#### 3.1.4 주변 추천 장소
- **UI**: 선택한 장소 옆 "주변 추천" 버튼
- **기능**:
  - Kakao 카테고리 검색 (음식점, 카페, 관광명소 등)
  - 반경 500m~1km 내 장소 표시
  - 클릭 시 방문 리스트에 추가
- **구현**: Kakao Local API `categorySearch`

#### 3.1.5 이동수단 선택
- **UI**: 라디오 버튼 또는 체크박스
- **옵션**:
  - [ ] 도보 + 대중교통
  - [ ] 차량
- **복수 선택 시**: 구간별로 최적 수단 자동 선택
- **저장**: `trips.transport_mode` (배열)
- **중요**: 사용자가 선택한 이동 수단만 사용 (자동 전환 없음)

#### 3.1.6 고정 일정 입력
- **UI**: 장소 선택 + 시간 입력 폼
- **형식**: 장소 + 시작시간 + 종료시간
- **예시**: "롯데월드 / 14:00~18:00"
- **저장**: `trip_fixed_schedules` 테이블

---

### 3.2 출력 기능 (시스템 → 사용자)

#### 3.2.1 일정표 생성 (일자별 탭 네비게이션)

모바일 최적화를 위해 **일자별 탭 방식**으로 결과를 표시합니다.

**UI 구조**:
```
┌─────────────────────────────────────┐
│  ← 서울 여행 2박3일                  │
├─────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐            │
│ │1일차│ │2일차│ │3일차│  ← 탭 네비게이션
│ │12/24│ │12/25│ │12/26│            │
│ └──●──┘ └─────┘ └─────┘            │
├─────────────────────────────────────┤
│                                     │
│  📍 서울역 (출발)          10:00    │
│     │                               │
│     │ 🚇 지하철 25분 (2.3km)        │
│     ▼                               │
│  📍 경복궁                 10:25    │
│     체류 2시간                      │
│     │                               │
│     │ 🚶 도보 15분 (0.8km)          │
│     ▼                               │
│  📍 북촌한옥마을           12:40    │
│     체류 1시간 30분                 │
│     │                               │
│    ...                              │
│                                     │
├─────────────────────────────────────┤
│  📊 1일차 요약                      │
│  총 이동: 12.5km | 이동시간: 2시간   │
│  장소: 6개 | 체류시간: 8시간         │
└─────────────────────────────────────┘
```

**탭 네비게이션 설계**:

| 기능 | 설명 |
|-----|-----|
| 탭 표시 | 일차 + 날짜 (예: "1일차\n12/24") |
| 활성 탭 | 하단 인디케이터 또는 배경색 구분 |
| 스와이프 | 좌우 스와이프로 일자 전환 가능 |
| 고정 헤더 | 탭은 상단 고정, 일정 내용만 스크롤 |
| 빠른 이동 | 탭 길게 누르면 전체 일정 미니맵 표시 |

**내용 표시**:
- 장소명 + 예상 체류 시간
- 구간별 이동 정보 (거리, 시간, 수단, 아이콘)
- 하루 총 이동 거리/시간 (하단 요약)
- 고정 일정은 배경색으로 구분

**일정표 예시 (텍스트)**:
```
[1일차 - 2025.01.15]
━━━━━━━━━━━━━━━━━━━━
10:00  출발지 (서울역)
       ↓ 지하철 25분
10:25  경복궁 (체류 2시간)
       ↓ 도보 15분
12:40  북촌한옥마을 (체류 1.5시간)
       ↓ 버스 20분
...
```

#### 3.2.2 지도 경로 표시
- **기능**:
  - 전체 경로 폴리라인 표시
  - 장소별 마커 (번호 표시)
  - 클릭 시 상세 정보 팝업
- **구현**: Kakao Maps JavaScript API

#### 3.2.3 구간별 네비게이션
- **기능**:
  - 현재 위치 표시 (Geolocation API)
  - 다음 목적지까지 경로 하이라이트
  - "네비게이션 시작" 버튼 → Kakao 앱 연동 또는 웹 네비

#### 3.2.4 일정 저장 및 공유
- **저장**: 마이페이지에서 저장된 일정 목록 확인
- **공유**: 링크 복사, 이미지 내보내기 (선택)

---

### 3.3 관리자 기능

#### 3.3.1 에러 로그 관리 페이지 (`/admin/error-logs`)

시스템 운영 중 발생하는 에러를 추적하고 관리하기 위한 관리자 전용 페이지입니다.

**접근 권한**:
- `admin_users` 테이블에 등록된 사용자만 접근 가능
- Clerk 미들웨어에서 관리자 권한 검증

**기능**:
1. **에러 로그 목록 조회**
   - 테이블 형태로 에러 로그 표시
   - 컬럼: 발생 시간, 에러 코드, 메시지 요약, 심각도, 발생 위치, 해결 상태
   - 페이지네이션 지원 (기본 50건)

2. **필터링**
   - 해결 상태별: 미해결 / 해결됨 / 전체
   - 심각도별: info / warning / error / critical
   - 에러 코드별: ROUTE_NOT_FOUND, API_RATE_LIMIT 등
   - 발생 위치별: optimize/*, api/*, routes/* 등
   - 기간별: 시작일 ~ 종료일

3. **에러 상세 보기**
   - 모달 또는 사이드 패널로 상세 정보 표시
   - 전체 에러 메시지, 스택 트레이스, 컨텍스트 정보
   - 관련 trip_id, place_id, user_id 등 메타데이터

4. **해결 처리**
   - "해결 완료" 버튼 클릭 시 해결 처리 다이얼로그
   - 해결 메모 입력 (선택사항)
   - 해결 시간 및 해결한 관리자 ID 자동 기록

5. **삭제 기능**
   - 해결된 에러 로그만 삭제 가능
   - 개별 삭제 또는 일괄 삭제 (체크박스 선택)
   - 삭제 전 확인 다이얼로그 표시

**UI 예시**:
```
┌─────────────────────────────────────────────────────────────────┐
│ 에러 로그 관리                              [미해결] [전체]     │
├─────────────────────────────────────────────────────────────────┤
│ 필터: [심각도 ▼] [에러코드 ▼] [발생위치 ▼] [기간: __ ~ __]    │
├─────────────────────────────────────────────────────────────────┤
│ □ 발생시간        에러코드         메시지      심각도  상태    │
│ ─────────────────────────────────────────────────────────────── │
│ □ 12/23 14:32    ROUTE_NOT_FOUND  경로를 찾... 🔴error [해결]  │
│ □ 12/23 14:15    API_RATE_LIMIT   할당량 초... 🟠warning [해결] │
│ □ 12/23 13:58    TIMEOUT          시간 초과... 🔴error  [상세] │
│ ☑ 12/22 18:42    ROUTE_NOT_FOUND  경로를 찾... ✅해결됨 [삭제] │
├─────────────────────────────────────────────────────────────────┤
│ [선택 항목 삭제]                    1-50 / 128건    [< 1 2 3 >] │
└─────────────────────────────────────────────────────────────────┘
```

**에러 기록 시점**:
- API 호출 실패 (Kakao, ODsay)
- 경로 조회 실패
- 최적화 시간 초과
- 좌표 유효성 검증 실패
- 고정 일정 충돌 감지
- 기타 예상치 못한 런타임 에러

---

### 3.4 최적화 알고리즘

#### 3.4.1 문제 분류

본 서비스의 핵심 문제는 **Traveling Salesman Problem (TSP)**의 변형입니다:

| 제약 유형 | 설명 |
|----------|------|
| 시작/종료점 고정 | 출발지와 도착지가 동일하지 않을 수 있음 |
| 시간 창 제약 (Time Windows) | 고정 일정이 있는 장소는 특정 시간에 방문 필수 |
| 일일 시간 제한 | 하루 최대 활동 시간 제한 (기본 8시간) |
| 다중 날짜 분배 | 여러 날에 걸쳐 장소 방문을 분배 |

이러한 특성으로 인해 **Time-Windowed Vehicle Routing Problem (TWVRP)**에 더 가깝습니다.

#### 3.4.2 목적 함수 (Objective Function)

**총 이동 비용 최소화:**

$$
\min Z = \sum_{d=1}^{D} \sum_{i=0}^{n_d} \sum_{j=0}^{n_d} c_{ij} \cdot x_{ij}^d
$$

**이동 비용 계산:**

$$
c_{ij} = \alpha \cdot t_{ij} + \beta \cdot d_{ij}
$$

- $t_{ij}$: 이동 시간 (분)
- $d_{ij}$: 이동 거리 (km)
- $\alpha$: 시간 가중치 (기본: 1.0)
- $\beta$: 거리 가중치 (기본: 0.1)

#### 3.4.3 제약 조건 (Constraints)

1. **모든 장소 방문**: 각 장소는 정확히 한 번 방문
2. **흐름 보존**: 들어오는 경로 수 = 나가는 경로 수
3. **일일 시간 제한**: 하루 최대 480분 (8시간)
4. **고정 일정**: 지정된 시간 창 내 방문 필수
5. **시간 순서**: 도착 시간이 논리적으로 연속

#### 3.4.4 알고리즘 선정 (Trade-off Analysis)

| 알고리즘 | 시간 복잡도 | 해 품질 | 실시간 적합성 |
|---------|------------|--------|--------------|
| Brute Force | O(n!) | 최적해 | ❌ (10개 초과 불가) |
| Dynamic Programming | O(n² · 2ⁿ) | 최적해 | ❌ (20개 초과 불가) |
| **Nearest Neighbor** | **O(n²)** | 근사해 | **✅** |
| **2-opt Improvement** | **O(n²)** per iter | 개선해 | **✅** |
| Genetic Algorithm | O(g · p · n) | 준최적해 | ⚠️ (튜닝 필요) |

**선정: Nearest Neighbor + 2-opt Hybrid**
- 30개 장소 기준 1초 미만 처리
- 평균적으로 최적해의 5~10% 이내 근사
- 직관적인 로직으로 디버깅 용이

#### 3.4.5 알고리즘 흐름

```typescript
// 최적화 파이프라인
1. 모든 장소 간 거리 행렬 계산 (Kakao API 또는 좌표 기반)
2. Nearest Neighbor로 초기 경로 생성
3. 2-opt로 경로 개선 (최대 100회 반복)
4. 고정 일정 제약 조건 반영
5. 일자별 분배 (일일 8시간 제한)
6. 각 구간 이동 정보 조회 (선호 수단만 사용)
```

#### 3.4.6 일자 최적화
- **기준**: 하루 이동 거리/시간 제한 (기본 8시간)
- **알고리즘**:
  1. 순서 최적화된 리스트를 순회
  2. 누적 시간이 제한 초과 시 다음 날로 분리
  3. 고정 일정 날짜 우선 배치

#### 3.4.7 이동방법 최적화
- **원칙**: 사용자가 선택한 이동 수단만 사용
- **로직** (복수 선택 시):
  - 거리 < 1km: 도보 우선
  - 거리 1~3km: 대중교통 vs 도보 비교
  - 거리 > 3km: 대중교통 또는 차량
- **API 호출**:
  - 도보+대중교통: ODsay API
  - 차량: Kakao Mobility API
- **실패 시**: 에러 반환 (자동 수단 전환 없음)

#### 3.4.8 제약조건 최적화
- **고정 일정 처리**:
  1. 고정 일정 시간대 블록 설정
  2. 해당 날짜에 고정 일정 우선 배치
  3. 고정 일정 전후로 다른 장소 배치

---

## 4. 데이터 모델

### 4.1 새로운 테이블

```sql
-- 여행 계획
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_id),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  origin JSONB NOT NULL,          -- {name, address, lat, lng}
  destination JSONB NOT NULL,      -- {name, address, lat, lng}
  daily_start_time TIME DEFAULT '10:00', -- 하루 시작 시간 (기본 10:00)
  daily_end_time TIME DEFAULT '22:00',   -- 하루 종료 시간 (기본 22:00)
  transport_mode TEXT[] NOT NULL,  -- ['public', 'car']
  status TEXT DEFAULT 'draft',     -- draft, optimizing, optimized, completed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 방문 장소
CREATE TABLE trip_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  category TEXT,                   -- 음식점, 관광지 등
  kakao_place_id TEXT,
  priority INT,                    -- 사용자 우선순위 (선택)
  estimated_duration INT NOT NULL DEFAULT 60, -- 예상 체류 시간 (분) - 30~720분 (30분 단위)
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_duration CHECK (estimated_duration >= 30 AND estimated_duration <= 720)
);

-- 고정 일정
CREATE TABLE trip_fixed_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_id UUID REFERENCES trip_places(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 최적화된 일정
CREATE TABLE trip_itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number INT NOT NULL,         -- 1일차, 2일차...
  date DATE NOT NULL,
  schedule JSONB NOT NULL,         -- 상세 일정 배열
  total_distance INT,              -- 총 거리 (m)
  total_duration INT,              -- 총 시간 (분)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- schedule JSONB 구조 예시:
-- [
--   {
--     "order": 1,
--     "place_id": "uuid",
--     "place_name": "경복궁",
--     "arrival_time": "09:30",
--     "departure_time": "11:30",
--     "duration": 120,
--     "is_fixed": false,
--     "transport_to_next": {
--       "mode": "subway",
--       "distance": 2500,
--       "duration": 25,
--       "description": "3호선 안국역 → 을지로3가역",
--       "fare": 1400
--     }
--   }
-- ]

-- 에러 로그 (관리자용)
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_code TEXT NOT NULL,              -- 에러 코드 (예: 'ROUTE_NOT_FOUND', 'API_RATE_LIMIT')
  error_message TEXT NOT NULL,           -- 에러 메시지
  error_stack TEXT,                      -- 스택 트레이스 (선택)
  context JSONB,                         -- 추가 컨텍스트 (trip_id, place_id, user_id 등)
  severity TEXT NOT NULL DEFAULT 'error', -- 심각도: 'info', 'warning', 'error', 'critical'
  source TEXT NOT NULL,                  -- 발생 위치 (예: 'optimize/distance-matrix', 'api/odsay')
  resolved BOOLEAN DEFAULT false,        -- 해결 여부
  resolved_at TIMESTAMPTZ,               -- 해결 시간
  resolved_by TEXT,                      -- 해결한 관리자 ID
  resolution_note TEXT,                  -- 해결 메모
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 에러 로그 인덱스 (조회 성능 최적화)
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_error_code ON error_logs(error_code);

-- 관리자 사용자 테이블 (관리자 권한 확인용)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL UNIQUE REFERENCES users(clerk_id),
  role TEXT NOT NULL DEFAULT 'admin',    -- 'admin', 'super_admin'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 RLS 정책

```sql
-- trips 테이블
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trips"
  ON trips FOR SELECT
  USING (auth.jwt()->>'sub' = user_id);

CREATE POLICY "Users can create own trips"
  ON trips FOR INSERT
  WITH CHECK (auth.jwt()->>'sub' = user_id);

CREATE POLICY "Users can update own trips"
  ON trips FOR UPDATE
  USING (auth.jwt()->>'sub' = user_id);

CREATE POLICY "Users can delete own trips"
  ON trips FOR DELETE
  USING (auth.jwt()->>'sub' = user_id);

-- trip_places, trip_fixed_schedules, trip_itineraries도 동일 패턴

-- error_logs 테이블 (관리자 전용)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all error logs"
  ON error_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.clerk_id = auth.jwt()->>'sub'
    )
  );

CREATE POLICY "Admins can update error logs"
  ON error_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.clerk_id = auth.jwt()->>'sub'
    )
  );

CREATE POLICY "Admins can delete error logs"
  ON error_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.clerk_id = auth.jwt()->>'sub'
    )
  );

CREATE POLICY "Service role can insert error logs"
  ON error_logs FOR INSERT
  WITH CHECK (true);  -- service_role만 INSERT 가능 (RLS bypass)

-- admin_users 테이블
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage admin users"
  ON admin_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.clerk_id = auth.jwt()->>'sub'
        AND admin_users.role = 'super_admin'
    )
  );
```

---

## 5. TypeScript 타입 정의

### 5.1 Core Domain Types

```typescript
// ============================================
// 📍 장소 관련 타입
// ============================================

/** 좌표 정보 */
interface Coordinate {
  lat: number;   // 위도 (-90 ~ 90)
  lng: number;   // 경도 (-180 ~ 180)
}

/** 장소 기본 정보 */
interface Place {
  id: string;                    // UUID
  name: string;                  // 장소명
  address: string;               // 주소
  coordinate: Coordinate;        // 좌표
  category?: PlaceCategory;      // 카테고리
  kakaoPlaceId?: string;         // Kakao Place ID (연동용)
  estimatedDuration: number;     // 예상 체류 시간 (분) - 사용자 입력
  priority?: number;             // 사용자 우선순위
}

/** 장소 카테고리 */
type PlaceCategory =
  | 'tourist_attraction'  // 관광지
  | 'restaurant'          // 음식점
  | 'cafe'                // 카페
  | 'shopping'            // 쇼핑
  | 'accommodation'       // 숙박
  | 'entertainment'       // 엔터테인먼트
  | 'culture'             // 문화시설
  | 'nature'              // 자연/공원
  | 'other';              // 기타

// ============================================
// 🚗 이동 관련 타입
// ============================================

/** 이동 수단 */
type TransportMode = 'walking' | 'public' | 'car';

/** 구간 이동 정보 */
interface RouteSegment {
  mode: TransportMode;           // 이동 수단
  distance: number;              // 거리 (미터)
  duration: number;              // 소요 시간 (분)
  description?: string;          // 설명 (예: "3호선 안국역 → 을지로3가역")
  polyline?: string;             // 경로 폴리라인 (지도 표시용)
  fare?: number;                 // 요금 (원)
}

// ============================================
// 📅 일정 관련 타입
// ============================================

/** 고정 일정 */
interface FixedSchedule {
  id: string;
  placeId: string;               // 연결된 장소 ID
  date: string;                  // 날짜 (YYYY-MM-DD)
  startTime: string;             // 시작 시간 (HH:mm)
  endTime: string;               // 종료 시간 (HH:mm)
  note?: string;                 // 메모
}

/** 일정 항목 (최적화 결과) */
interface ScheduleItem {
  order: number;                 // 방문 순서
  placeId: string;               // 장소 ID
  placeName: string;             // 장소명
  arrivalTime: string;           // 도착 시간 (HH:mm)
  departureTime: string;         // 출발 시간 (HH:mm)
  duration: number;              // 체류 시간 (분)
  transportToNext?: RouteSegment; // 다음 장소까지 이동 정보
  isFixed: boolean;              // 고정 일정 여부
}

/** 일자별 일정 */
interface DailyItinerary {
  dayNumber: number;             // 일차 (1, 2, 3...)
  date: string;                  // 날짜 (YYYY-MM-DD)
  schedule: ScheduleItem[];      // 일정 항목 배열
  totalDistance: number;         // 총 이동 거리 (미터)
  totalDuration: number;         // 총 소요 시간 (분)
  startTime: string;             // 일과 시작 시간
  endTime: string;               // 일과 종료 시간
}

// ============================================
// 🎒 여행 계획 타입
// ============================================

/** 여행 계획 상태 */
type TripStatus = 'draft' | 'optimizing' | 'optimized' | 'completed';

/** 여행 계획 */
interface Trip {
  id: string;
  userId: string;                // Clerk User ID
  title: string;                 // 여행 제목
  startDate: string;             // 시작일 (YYYY-MM-DD)
  endDate: string;               // 종료일 (YYYY-MM-DD)
  origin: Place;                 // 출발지
  destination: Place;            // 도착지
  dailyStartTime: string;        // 하루 시작 시간 (HH:mm, 기본 10:00)
  dailyEndTime: string;          // 하루 종료 시간 (HH:mm, 기본 22:00)
  transportModes: TransportMode[]; // 선택한 이동 수단
  status: TripStatus;            // 상태
  places: Place[];               // 방문 장소 목록
  fixedSchedules: FixedSchedule[]; // 고정 일정
  itinerary?: DailyItinerary[];  // 최적화된 일정 (결과)
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 🛠️ 관리자/에러 로그 타입
// ============================================

/** 에러 심각도 */
type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

/** 에러 로그 */
interface ErrorLog {
  id: string;
  errorCode: string;             // 에러 코드
  errorMessage: string;          // 에러 메시지
  errorStack?: string;           // 스택 트레이스
  context?: Record<string, unknown>; // 추가 컨텍스트
  severity: ErrorSeverity;       // 심각도
  source: string;                // 발생 위치
  resolved: boolean;             // 해결 여부
  resolvedAt?: string;           // 해결 시간
  resolvedBy?: string;           // 해결한 관리자 ID
  resolutionNote?: string;       // 해결 메모
  createdAt: string;
  updatedAt: string;
}

/** 관리자 역할 */
type AdminRole = 'admin' | 'super_admin';

/** 관리자 사용자 */
interface AdminUser {
  id: string;
  clerkId: string;               // Clerk User ID
  role: AdminRole;               // 관리자 역할
  createdAt: string;
}
```

### 5.2 Algorithm Types

```typescript
// ============================================
// 🔄 최적화 엔진 Input/Output
// ============================================

/** 최적화 요청 */
interface OptimizeRequest {
  tripId: string;
  places: Place[];
  origin: Coordinate;
  destination: Coordinate;
  transportModes: TransportMode[];
  fixedSchedules: FixedSchedule[];
  options: OptimizeOptions;
}

/** 최적화 옵션 */
interface OptimizeOptions {
  maxDailyMinutes: number;       // 일일 최대 활동 시간 (기본: 480)
  startHour: number;             // 하루 시작 시간 (기본: 9)
  endHour: number;               // 하루 종료 시간 (기본: 21)
  algorithm: 'nearest_neighbor' | 'genetic' | 'simulated_annealing';
  improvementIterations: number; // 2-opt 반복 횟수 (기본: 100)
  timeWeight: number;            // 시간 가중치 α (기본: 1.0)
  distanceWeight: number;        // 거리 가중치 β (기본: 0.1)
}

/** 최적화 결과 */
interface OptimizeResult {
  success: boolean;
  tripId: string;
  itinerary: DailyItinerary[];
  statistics: OptimizeStatistics;
  errors?: OptimizeError[];
}

/** 최적화 통계 */
interface OptimizeStatistics {
  totalPlaces: number;           // 총 장소 수
  totalDays: number;             // 총 일수
  totalDistance: number;         // 총 이동 거리 (km)
  totalDuration: number;         // 총 이동 시간 (분)
  averageDailyDistance: number;  // 일평균 이동 거리
  optimizationTimeMs: number;    // 최적화 소요 시간 (ms)
  improvementPercentage: number; // 초기 대비 개선율 (%)
}

/** 최적화 오류 */
interface OptimizeError {
  code: OptimizeErrorCode;
  message: string;
  placeId?: string;
  details?: Record<string, unknown>;
}

type OptimizeErrorCode =
  | 'INVALID_COORDINATES'
  | 'API_RATE_LIMIT'
  | 'ROUTE_NOT_FOUND'
  | 'FIXED_SCHEDULE_CONFLICT'
  | 'TIMEOUT'
  | 'UNKNOWN';

// ============================================
// 📊 거리 행렬 타입
// ============================================

/** 거리 행렬 */
interface DistanceMatrix {
  places: string[];              // 장소 ID 배열 (행/열 인덱스 매핑)
  distances: number[][];         // 거리 (미터)
  durations: number[][];         // 시간 (분)
  modes: TransportMode[][];      // 각 구간 이동 수단
}
```

### 5.3 Zod Validation Schemas

```typescript
import { z } from 'zod';

// 좌표 검증
export const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// 장소 검증
export const placeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(200),
  coordinate: coordinateSchema,
  category: z.enum([
    'tourist_attraction', 'restaurant', 'cafe', 'shopping',
    'accommodation', 'entertainment', 'culture', 'nature', 'other'
  ]).optional(),
  kakaoPlaceId: z.string().optional(),
  estimatedDuration: z.number().positive(), // 사용자가 직접 제공
  priority: z.number().int().min(1).max(100).optional(),
});

// 고정 일정 검증
export const fixedScheduleSchema = z.object({
  id: z.string().uuid(),
  placeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  note: z.string().max(200).optional(),
}).refine(
  (data) => data.startTime < data.endTime,
  { message: '종료 시간은 시작 시간 이후여야 합니다' }
);

// 여행 생성 검증
export const createTripSchema = z.object({
  title: z.string().min(1).max(50),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  origin: placeSchema,
  destination: placeSchema,
  transportModes: z.array(z.enum(['walking', 'public', 'car'])).min(1),
}).refine(
  (data) => data.startDate <= data.endDate,
  { message: '종료일은 시작일 이후여야 합니다' }
).refine(
  (data) => {
    const diffDays = (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  },
  { message: '여행 기간은 최대 30일입니다' }
);

// 최적화 요청 검증
export const optimizeRequestSchema = z.object({
  tripId: z.string().uuid(),
  places: z.array(placeSchema).min(2).max(30),
  origin: coordinateSchema,
  destination: coordinateSchema,
  transportModes: z.array(z.enum(['walking', 'public', 'car'])).min(1),
  fixedSchedules: z.array(fixedScheduleSchema),
  options: z.object({
    maxDailyMinutes: z.number().min(120).max(720).default(480),
    startHour: z.number().min(0).max(23).default(9),
    endHour: z.number().min(0).max(23).default(21),
    algorithm: z.enum(['nearest_neighbor', 'genetic', 'simulated_annealing']).default('nearest_neighbor'),
    improvementIterations: z.number().min(10).max(1000).default(100),
    timeWeight: z.number().min(0).max(10).default(1.0),
    distanceWeight: z.number().min(0).max(10).default(0.1),
  }),
});

// 체류 시간 검증 (30분 ~ 12시간, 30분 단위)
export const durationSchema = z.number()
  .min(30, '최소 30분 이상이어야 합니다')
  .max(720, '최대 12시간까지 가능합니다')
  .refine(
    (val) => val % 30 === 0,
    { message: '30분 단위로 선택해주세요' }
  );

// 시간 검증 (HH:mm 형식)
export const timeSchema = z.string()
  .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '올바른 시간 형식이 아닙니다');

// 에러 로그 생성 검증
export const createErrorLogSchema = z.object({
  errorCode: z.string().min(1).max(50),
  errorMessage: z.string().min(1).max(500),
  errorStack: z.string().max(5000).optional(),
  context: z.record(z.unknown()).optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).default('error'),
  source: z.string().min(1).max(100),
});

// 에러 로그 해결 검증
export const resolveErrorLogSchema = z.object({
  id: z.string().uuid(),
  resolutionNote: z.string().max(500).optional(),
});

// 에러 로그 필터 검증
export const errorLogFilterSchema = z.object({
  resolved: z.boolean().optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  errorCode: z.string().optional(),
  source: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});
```

---

## 6. API 설계

### 6.1 외부 API

#### Kakao Maps JavaScript API
- **용도**: 지도 렌더링, 마커, 폴리라인
- **키 발급**: [Kakao Developers](https://developers.kakao.com)
- **환경변수**: `NEXT_PUBLIC_KAKAO_MAP_KEY`

#### Kakao Local API
- **용도**: 장소 검색, 좌표 변환
- **엔드포인트**:
  - `GET /v2/local/search/keyword.json` - 키워드 검색
  - `GET /v2/local/search/category.json` - 카테고리 검색
  - `GET /v2/local/geo/coord2address.json` - 좌표 → 주소
- **환경변수**: `KAKAO_REST_API_KEY`

#### Kakao Mobility API
- **용도**: 자동차 경로 검색
- **엔드포인트**:
  - `POST /v1/waypoints/directions` - 다중 경유지 경로
- **제약**: 최대 30개 경유지, 총 거리 1,500km 미만
- **환경변수**: `KAKAO_MOBILITY_KEY`

#### ODsay API
- **용도**: 대중교통 경로 검색
- **엔드포인트**:
  - `GET /v1/api/searchPubTransPathT` - 대중교통 경로
- **제공 정보**: 환승 정보, 요금, 시간표
- **키 발급**: [ODsay LAB](https://lab.odsay.com)
- **환경변수**: `ODSAY_API_KEY`

### 6.2 Server Actions

```
actions/
├── trips/
│   ├── create-trip.ts         # 여행 생성
│   ├── update-trip.ts         # 여행 수정
│   ├── delete-trip.ts         # 여행 삭제
│   └── get-trips.ts           # 여행 목록 조회
├── places/
│   ├── search-places.ts       # 장소 검색 (Kakao)
│   ├── add-place.ts           # 장소 추가
│   ├── remove-place.ts        # 장소 제거
│   └── get-nearby.ts          # 주변 추천 (Kakao 카테고리)
├── optimize/
│   ├── optimize-route.ts      # 경로 최적화 실행
│   ├── calculate-distance.ts  # 거리 행렬 계산
│   └── distribute-days.ts     # 일자별 분배
├── routes/
│   ├── get-car-route.ts       # 자동차 경로 (Kakao)
│   └── get-transit-route.ts   # 대중교통 경로 (ODsay)
└── admin/
    ├── get-error-logs.ts      # 에러 로그 목록 조회 (필터/페이지네이션)
    ├── resolve-error-log.ts   # 에러 로그 해결 처리
    ├── delete-error-log.ts    # 에러 로그 삭제 (해결된 항목만)
    └── log-error.ts           # 에러 로그 기록 (서비스 내부용)
```

---

## 7. 프로젝트 구조

### 7.1 라우팅 (App Router)

```
app/
├── page.tsx                      # 랜딩 페이지
├── (auth)/
│   ├── sign-in/[[...sign-in]]/page.tsx
│   └── sign-up/[[...sign-up]]/page.tsx
├── plan/
│   ├── page.tsx                  # 새 여행 계획 시작
│   ├── [tripId]/
│   │   ├── page.tsx              # 여행 계획 편집
│   │   ├── places/page.tsx       # 장소 추가/관리
│   │   ├── schedule/page.tsx     # 고정 일정 설정
│   │   └── result/page.tsx       # 최적화 결과 확인
├── my/
│   ├── page.tsx                  # 마이페이지 (저장된 여행 목록)
│   └── trips/[tripId]/page.tsx   # 저장된 여행 상세
├── admin/
│   ├── page.tsx                  # 관리자 대시보드
│   └── error-logs/page.tsx       # 에러 로그 관리 페이지
└── navigate/
    └── [tripId]/page.tsx         # 실시간 네비게이션
```

### 7.2 라이브러리 구조

```
lib/
├── optimize/
│   ├── types.ts                 # 최적화 관련 타입 정의
│   ├── schemas.ts               # Zod 스키마
│   ├── nearest-neighbor.ts      # Nearest Neighbor 알고리즘
│   ├── two-opt.ts               # 2-opt 개선 알고리즘
│   ├── daily-distributor.ts     # 일자별 분배 로직
│   ├── constraint-handler.ts    # 고정 일정 제약 처리
│   ├── distance-matrix.ts       # 거리 행렬 생성
│   └── index.ts                 # 통합 export
├── api/
│   ├── kakao.ts                 # Kakao API 클라이언트
│   └── odsay.ts                 # ODsay API 클라이언트
└── utils/
    ├── retry.ts                 # 재시도 유틸리티
    └── haversine.ts             # 거리 계산 유틸리티
```

### 7.3 UI 컴포넌트

```
components/
├── trip/
│   ├── trip-form.tsx             # 여행 기본 정보 폼
│   ├── date-picker.tsx           # 날짜 선택
│   ├── location-input.tsx        # 출발지/도착지 입력
│   └── transport-selector.tsx    # 이동수단 선택
├── places/
│   ├── place-search.tsx          # 장소 검색
│   ├── place-list.tsx            # 장소 리스트
│   ├── place-card.tsx            # 장소 카드
│   └── nearby-recommendations.tsx # 주변 추천
├── schedule/
│   ├── fixed-schedule-form.tsx   # 고정 일정 입력
│   └── schedule-timeline.tsx     # 일정 타임라인
├── map/
│   ├── kakao-map.tsx             # 카카오 맵 래퍼
│   ├── route-polyline.tsx        # 경로 표시
│   ├── place-markers.tsx         # 장소 마커
│   └── current-location.tsx      # 현재 위치
├── itinerary/
│   ├── day-tabs.tsx              # 일자별 탭 네비게이션
│   ├── day-content.tsx           # 일자별 일정 내용
│   ├── schedule-item.tsx         # 개별 일정 항목 (장소 + 시간)
│   ├── route-segment.tsx         # 구간별 이동 정보
│   ├── day-summary.tsx           # 일자별 요약 (총 이동거리/시간)
│   └── itinerary-export.tsx      # 내보내기
├── admin/
│   ├── error-log-table.tsx       # 에러 로그 테이블
│   ├── error-log-filter.tsx      # 에러 로그 필터
│   ├── error-log-detail.tsx      # 에러 로그 상세 모달
│   ├── resolve-dialog.tsx        # 해결 처리 다이얼로그
│   └── admin-sidebar.tsx         # 관리자 사이드바
└── ui/                           # shadcn 컴포넌트 (기존)
```

---

## 8. 예외 처리 전략

### 8.1 예외 상황 매트릭스

| 시나리오 | 발생 조건 | 대응 전략 | 사용자 메시지 |
|---------|----------|----------|-------------|
| API 호출 실패 | 네트워크 오류, 서버 다운 | 3회 재시도 (지수 백오프) | "잠시 후 다시 시도해주세요" |
| API Rate Limit | 일일 할당량 초과 | 캐시 데이터 사용, 관리자 알림 | "서비스 이용량이 많습니다" |
| 경로 없음 | 선택한 수단으로 경로 불가 | **에러 반환 (자동 전환 없음)** | "해당 구간의 경로를 찾을 수 없습니다" |
| 연산 시간 초과 | 장소 30개 + 복잡한 제약 | 2-opt 반복 조기 종료 | "대략적인 일정이 생성되었습니다" |
| 좌표 오류 | 잘못된 위/경도 값 | 요청 거부, 재입력 요청 | "위치 정보가 올바르지 않습니다" |
| 고정 일정 충돌 | 같은 시간에 2개 이상 고정 | 충돌 안내, 수정 요청 | "일정이 겹칩니다. 수정해주세요" |
| 일일 시간 초과 | 고정 일정만으로 8시간 초과 | 일일 제한 확장 또는 경고 | "하루 일정이 너무 많습니다" |

### 8.2 경로 조회 원칙

```typescript
/**
 * 경로 조회 - 선호 수단으로만 시도
 *
 * 설계 원칙: 사용자가 선택한 이동 수단을 존중합니다.
 * 대중교통을 선택했는데 자동차 경로를 제공하면 사용자 경험을 해칩니다.
 * 경로를 찾을 수 없는 경우, 명확한 에러를 반환하여 사용자가 직접 판단하도록 합니다.
 */
async function getRoute(
  from: Coordinate,
  to: Coordinate,
  mode: TransportMode
): Promise<RouteSegment> {
  const result = await fetchRouteFromAPI(from, to, mode);

  if (!result) {
    throw new RouteNotFoundError(
      `${getModeDisplayName(mode)} 경로를 찾을 수 없습니다`,
      { from, to, mode }
    );
  }

  return result;
}
```

### 8.3 시스템 한계

| 항목 | 현재 한계 | 이유 |
|-----|----------|-----|
| 최대 장소 수 | 30개 | Kakao Mobility API 제한 |
| 최대 여행 기간 | 30일 | UX 복잡도 증가 |
| 최적해 보장 | 불가능 | NP-Hard 문제 |
| 실시간 교통 반영 | 미지원 | API 비용 |
| 오프라인 모드 | 미지원 | 캐싱 구현 필요 |

---

## 9. 구현 순서

### Phase 1: 기반 구축
1. 환경변수 설정 (Kakao, ODsay API 키)
2. Supabase 스키마 마이그레이션 (trips, trip_places 등)
3. PostGIS 확장 활성화
4. Kakao Maps 컴포넌트 기본 설정
5. TypeScript 타입 및 Zod 스키마 정의

### Phase 2: 입력 기능
1. 여행 생성 폼 (기간, 출발지/도착지)
2. 장소 검색 및 추가 기능 (체류 시간 입력 포함)
3. 주변 추천 장소 기능
4. 이동수단 선택
5. 고정 일정 입력

### Phase 3: 최적화 엔진
1. 거리 행렬 계산 로직 (`lib/optimize/distance-matrix.ts`)
2. Nearest Neighbor 알고리즘 구현 (`lib/optimize/nearest-neighbor.ts`)
3. 2-opt 개선 알고리즘 구현 (`lib/optimize/two-opt.ts`)
4. 일자별 분배 로직 (`lib/optimize/daily-distributor.ts`)
5. 고정 일정 제약 조건 처리 (`lib/optimize/constraint-handler.ts`)
6. 이동수단별 경로 조회 (Kakao/ODsay)

### Phase 4: 결과 표시
1. 일정표 UI (일자별 카드)
2. 지도 경로 표시 (폴리라인, 마커)
3. 구간별 이동 정보 표시
4. 일정 저장 기능

### Phase 5: 마이페이지 & 네비게이션
1. 저장된 여행 목록
2. 여행 상세 보기
3. 현재 위치 표시 기능
4. 간단 네비게이션 (Kakao 앱 연동)

### Phase 6: 완성도
1. 모바일 고정형 레이아웃 적용 (375px~430px)
2. 에러 핸들링 강화 (예외 처리 전략 적용)
3. 로딩 상태 UX 개선
4. 성능 최적화
5. 터치 최적화 (터치 타겟, 스와이프 제스처)

---

## 10. 환경변수

```bash
# .env.local (추가)

# Kakao API
NEXT_PUBLIC_KAKAO_MAP_KEY=        # JavaScript 키 (지도)
KAKAO_REST_API_KEY=               # REST API 키 (검색)
KAKAO_MOBILITY_KEY=               # Mobility API 키 (경로)

# ODsay API
ODSAY_API_KEY=                    # 대중교통 API 키
```

---

## 11. 주요 제약사항 및 리스크

### 11.1 API 제한
| API | 무료 할당량 | 대응 방안 |
|-----|-----------|----------|
| Kakao Maps | 무제한 (사용량 모니터링) | - |
| Kakao Mobility | 일 10,000건 | 캐싱, 요청 최적화 |
| ODsay | 일 1,000건 (기본) | 캐싱, 유료 전환 고려 |

### 11.2 기술적 리스크
- **경로 최적화 정확도**: TSP 근사 알고리즘은 최적해 보장 불가 → 2-opt 개선으로 품질 향상
- **API 응답 지연**: 다수 경로 조회 시 지연 → 병렬 요청, 결과 캐싱
- **실시간 위치 정확도**: GPS 오차 → 허용 오차 범위 설정

### 11.3 UX 고려사항
- 최적화 처리 중 로딩 UX (예상 시간 표시)
- **모바일 고정형 레이아웃**: 375px~430px 기준 설계 (반응형 아님)
- **일자별 탭 네비게이션**: 스와이프로 일자 전환, 고정 헤더
- 터치 타겟 최소 44px, 권장 48px 이상
- 오프라인 지원 (저장된 일정 캐싱 - 향후)

---

## 12. 성공 지표

- 여행 계획 생성 완료율 > 70%
- 평균 장소 추가 수 > 5개
- 최적화 결과 만족도 > 4.0/5.0
- 재방문율 > 30%

---

## 13. 성능 벤치마크 예상

| 장소 수 | NN 시간 | 2-opt 시간 | 총 시간 | 메모리 |
|--------|---------|-----------|--------|--------|
| 5개 | < 1ms | < 10ms | ~50ms | ~1MB |
| 10개 | ~2ms | ~50ms | ~200ms | ~2MB |
| 20개 | ~5ms | ~200ms | ~1s | ~5MB |
| 30개 | ~10ms | ~500ms | ~3s | ~10MB |

*실제 성능은 API 응답 시간에 크게 좌우됩니다.*

---

## 부록: 참고 링크

- [Kakao Maps API 문서](https://apis.map.kakao.com/web/documentation/)
- [Kakao Developers](https://developers.kakao.com)
- [Kakao Mobility API](https://developers.kakaomobility.com)
- [ODsay LAB](https://lab.odsay.com)
- [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis)
- [Clerk 문서](https://clerk.com/docs)
