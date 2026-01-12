# 프로젝트 전체 워크플로우

이 문서는 OurRoad 프로젝트의 전체 워크플로우를 Mermaid 플로우차트로 시각화합니다.

## 1. 사용자 인증 및 초기화

```mermaid
flowchart TD
    A[사용자 접속] --> B{로그인 상태?}
    B -->|미로그인| C[Clerk 로그인 페이지]
    B -->|로그인됨| D[SyncUserProvider 실행]
    C --> E[로그인 완료]
    E --> D
    D --> F[Clerk 사용자 정보 확인]
    F --> G{Supabase users 테이블에 존재?}
    G -->|없음| H[API: /api/sync-user 호출]
    G -->|있음| I[인증 완료]
    H --> J[Supabase users 테이블에 동기화]
    J --> I
    I --> K[메인 페이지 접근]
```

## 2. 여행 생성 워크플로우

```mermaid
flowchart TD
    A[랜딩 페이지] --> B[새 여행 만들기 클릭]
    B --> C[/plan 페이지]
    C --> D[TripFormWizard 컴포넌트]
    D --> E[Step 1: 기본 정보 입력]
    E --> E1[여행 제목]
    E --> E2[시작일/종료일]
    E --> E3[출발지/도착지 검색]
    E --> E4[일일 시작/종료 시간]
    E --> E5[이동수단 선택]
    E1 --> F[Step 2: 확인]
    E2 --> F
    E3 --> F
    E4 --> F
    E5 --> F
    F --> G[TripConfirmDialog]
    G --> H{확인?}
    H -->|취소| D
    H -->|확인| I[createTrip Server Action]
    I --> J[Supabase trips 테이블 INSERT]
    J --> K{성공?}
    K -->|실패| L[에러 토스트]
    K -->|성공| M[여행 ID 반환]
    L --> D
    M --> N[/plan/tripId 페이지로 이동]
```

## 3. 장소 추가 워크플로우

```mermaid
flowchart TD
    A[/plan/tripId 페이지] --> B[장소 추가 카드 클릭]
    B --> C[/plan/tripId/places 페이지]
    C --> D{초기 로드}
    D --> E[DB에서 장소 조회]
    E --> F{장소 있음?}
    F -->|있음| G[장소 목록 표시]
    F -->|없음| H[sessionStorage에서 조회]
    H --> I{있음?}
    I -->|있음| G
    I -->|없음| J[빈 목록 표시]
    G --> K[장소 추가 버튼 클릭]
    J --> K
    K --> L[PlaceSearch Sheet 열림]
    L --> M[Kakao Local API 검색]
    M --> N[검색 결과 표시]
    N --> O[장소 선택]
    O --> P[addPlace Server Action]
    P --> Q[Supabase trip_places 테이블 INSERT]
    Q --> R{성공?}
    R -->|실패| S[에러 토스트]
    R -->|성공| T[로컬 상태 업데이트]
    S --> L
    T --> U[장소 목록에 추가]
    U --> V[체류 시간 설정 가능]
    V --> W[저장 완료 버튼]
    W --> X[updateTrip: status = 'optimizing']
    X --> Y[/plan/tripId로 돌아가기]
```

## 4. 고정 일정 설정 워크플로우 (선택)

```mermaid
flowchart TD
    A[/plan/tripId 페이지] --> B[고정 일정 설정 카드 클릭]
    B --> C[/plan/tripId/schedule 페이지]
    C --> D[고정 일정 목록 표시]
    D --> E[고정 일정 추가 버튼]
    E --> F[FixedScheduleForm]
    F --> G[장소 선택]
    G --> H[날짜 선택]
    H --> I[시작/종료 시간 입력]
    I --> J[저장]
    J --> K[addFixedSchedule Server Action]
    K --> L[Supabase trip_fixed_schedules INSERT]
    L --> M{성공?}
    M -->|실패| N[에러 토스트]
    M -->|성공| O[목록 업데이트]
    N --> F
    O --> P[일정 타임라인 표시]
```

## 5. 최적화 실행 워크플로우

```mermaid
flowchart TD
    A[/plan/tripId 페이지] --> B[일정 최적화하기 버튼]
    B --> C[updateTrip: status = 'optimizing']
    C --> D[/my/trips/tripId 페이지로 이동]
    D --> E{자동 최적화 조건}
    E -->|status = draft/optimizing| F[optimizeRoute Server Action 호출]
    E -->|status = optimized| G[기존 일정 표시]
    F --> H[1. 인증 확인]
    H --> I[2. 입력 검증]
    I --> J[3. 여행/장소/고정일정 조회]
    J --> K{이동수단?}
    K -->|대중교통| L[optimizePublicTransitRoute]
    K -->|차량/도보| M[createDistanceMatrix]
    L --> N[ODsay API 호출]
    M --> O[Kakao Mobility API 호출]
    N --> P[거리 행렬 생성]
    O --> P
    P --> Q[nearestNeighborWithEndpoints]
    Q --> R[twoOptWithEndpoints]
    R --> S[distributeToDaily]
    S --> T[일자별 분배]
    T --> U[createDailyItinerary]
    U --> V[각 구간 이동 정보 조회]
    V --> W[DailyItinerary 생성]
    W --> X[saveItinerary Server Action]
    X --> Y[Supabase trip_itineraries INSERT]
    Y --> Z[updateTrip: status = 'optimized']
    Z --> AA[일정 표시]
    AA --> AB[지도 경로 표시]
    AB --> AC[일자별 탭 네비게이션]
```

## 6. 최적화 알고리즘 상세 플로우

```mermaid
flowchart TD
    A[최적화 시작] --> B[노드 맵 생성]
    B --> B1[출발지 노드]
    B --> B2[도착지 노드]
    B --> B3[숙소 노드들]
    B --> B4[장소 노드들]
    B1 --> C[거리 행렬 계산]
    B2 --> C
    B3 --> C
    B4 --> C
    C --> D{이동수단}
    D -->|대중교통| E[ODsay API 병렬 호출]
    D -->|차량| F[Kakao Mobility API 병렬 호출]
    D -->|도보| G[Haversine 거리 계산]
    E --> H[거리 행렬 완성]
    F --> H
    G --> H
    H --> I[Nearest Neighbor 초기 경로]
    I --> J[2-opt 개선 알고리즘]
    J --> K{개선됨?}
    K -->|예| J
    K -->|아니오| L[고정 일정 제약 적용]
    L --> M[일자별 분배]
    M --> N{일일 시간 초과?}
    N -->|예| O[누락 장소 경고]
    N -->|아니오| P[각 일자별 DailyItinerary 생성]
    O --> P
    P --> Q[출발지→첫장소 이동 정보]
    Q --> R[장소간 이동 정보]
    R --> S[마지막장소→도착지 이동 정보]
    S --> T[최적화 완료]
```

## 7. 일정 표시 및 네비게이션 워크플로우

```mermaid
flowchart TD
    A[/my/trips/tripId 페이지] --> B[여행 상세 로드]
    B --> C{일정 있음?}
    C -->|없음| D[최적화 안내]
    C -->|있음| E[일자별 탭 생성]
    E --> F[DayTabsContainer]
    F --> G[선택된 일자 표시]
    G --> H[DayContentPanel]
    H --> I[일정 타임라인]
    I --> J[각 장소별 ScheduleItem]
    J --> K[도착 시간]
    J --> L[체류 시간]
    J --> M[출발 시간]
    J --> N[다음 장소 이동 정보]
    N --> O[KakaoMap 컴포넌트]
    O --> P[경로 폴리라인 표시]
    P --> Q[장소 마커 표시]
    Q --> R[출발지/도착지 마커]
    R --> S[스와이프 제스처]
    S --> T{좌우 스와이프}
    T -->|왼쪽| U[다음 일자]
    T -->|오른쪽| V[이전 일자]
    U --> G
    V --> G
    G --> W[네비게이션 버튼]
    W --> X[/navigate/tripId 페이지]
```

## 8. 공유 워크플로우

```mermaid
flowchart TD
    A[/my/trips/tripId 페이지] --> B[공유 버튼 클릭]
    B --> C{Web Share API 지원?}
    C -->|지원| D[navigator.share 호출]
    C -->|미지원| E[URL 클립보드 복사]
    D --> F[공유 완료]
    E --> F
    F --> G[공유 링크: /share/tripId]
    G --> H[다른 사용자 접근]
    H --> I[getSharedTrip Server Action]
    I --> J[공개 여행 정보 조회]
    J --> K{일정 있음?}
    K -->|있음| L[일정 표시]
    K -->|없음| M[일정 없음 안내]
    L --> N[읽기 전용 모드]
    M --> N
    N --> O[회원가입 CTA]
```

## 9. 에러 처리 워크플로우

```mermaid
flowchart TD
    A[API 호출/서버 액션] --> B{성공?}
    B -->|성공| C[정상 처리]
    B -->|실패| D{에러 타입}
    D -->|인증 에러| E[로그인 페이지로 리다이렉트]
    D -->|검증 에러| F[에러 메시지 토스트]
    D -->|API 에러| G[logError Server Action]
    D -->|네트워크 에러| H[재시도 로직]
    G --> I[Supabase error_logs INSERT]
    I --> J[관리자 알림]
    H --> K{재시도 횟수 < 3?}
    K -->|예| L[지수 백오프 대기]
    L --> A
    K -->|아니오| M[최종 실패 처리]
    M --> F
    F --> N[사용자에게 에러 표시]
```

## 10. 관리자 에러 로그 관리 워크플로우

```mermaid
flowchart TD
    A[관리자 로그인] --> B{admin_users 테이블 확인}
    B -->|권한 있음| C[/admin/error-logs 페이지]
    B -->|권한 없음| D[접근 거부]
    C --> E[에러 로그 목록 조회]
    E --> F[필터링 옵션]
    F --> F1[해결 상태]
    F --> F2[심각도]
    F --> F3[에러 코드]
    F --> F4[발생 위치]
    F --> F5[기간]
    F1 --> G[필터 적용]
    F2 --> G
    F3 --> G
    F4 --> G
    F5 --> G
    G --> H[필터된 로그 표시]
    H --> I[에러 상세 보기]
    I --> J[스택 트레이스 확인]
    J --> K[해결 처리]
    K --> L[resolveErrorLog Server Action]
    L --> M[해결 메모 입력]
    M --> N[error_logs UPDATE]
    N --> O[해결 완료 표시]
    H --> P[삭제]
    P --> Q{해결됨?}
    Q -->|예| R[deleteErrorLog Server Action]
    Q -->|아니오| S[삭제 불가 안내]
    R --> T[error_logs DELETE]
```

## 11. 전체 시스템 아키텍처 플로우

```mermaid
flowchart TB
    subgraph "Client (Next.js App Router)"
        A[React Components]
        B[Server Actions]
        C[Client Hooks]
    end

    subgraph "Authentication"
        D[Clerk]
        E[SyncUserProvider]
    end

    subgraph "Database (Supabase)"
        F[PostgreSQL]
        G[RLS Policies]
        H[Storage]
    end

    subgraph "External APIs"
        I[Kakao Maps API]
        J[Kakao Local API]
        K[Kakao Mobility API]
        L[ODsay API]
    end

    subgraph "Optimization Engine"
        M[Distance Matrix]
        N[Nearest Neighbor]
        O[2-opt Algorithm]
        P[Daily Distributor]
    end

    A --> B
    A --> C
    B --> D
    B --> F
    D --> E
    E --> F
    A --> I
    B --> J
    B --> K
    B --> L
    B --> M
    M --> N
    N --> O
    O --> P
    P --> F
    F --> G
    B --> H
```

## 12. 데이터 흐름 다이어그램

```mermaid
flowchart LR
    A[사용자 입력] --> B[Server Action]
    B --> C[Zod 검증]
    C --> D{검증 통과?}
    D -->|아니오| E[에러 반환]
    D -->|예| F[Supabase 클라이언트]
    F --> G[RLS 정책 확인]
    G --> H{권한 있음?}
    H -->|아니오| I[접근 거부]
    H -->|예| J[DB 쿼리 실행]
    J --> K[결과 반환]
    K --> L[캐시 무효화]
    L --> M[UI 업데이트]
    E --> M
    I --> M
```

## 주요 상태 전이

```mermaid
stateDiagram-v2
    [*] --> draft: 여행 생성
    draft --> optimizing: 최적화 시작
    optimizing --> optimized: 최적화 완료
    optimized --> draft: 장소 추가/수정
    optimized --> completed: 여행 완료
    completed --> [*]

    note right of draft
        기본 정보만 입력
        또는 장소 추가 중
    end note

    note right of optimizing
        최적화 알고리즘 실행 중
    end note

    note right of optimized
        일정 생성 완료
        저장 및 표시 가능
    end note
```

## 주요 컴포넌트 상호작용

```mermaid
graph TB
    A[TripFormWizard] --> B[createTrip]
    C[PlaceSearch] --> D[Kakao Local API]
    C --> E[addPlace]
    F[OptimizeButton] --> G[optimizeRoute]
    G --> H[Distance Matrix]
    G --> I[Nearest Neighbor]
    G --> J[2-opt]
    G --> K[Daily Distributor]
    K --> L[saveItinerary]
    M[DayTabsContainer] --> N[DayContentPanel]
    N --> O[ScheduleItem]
    P[KakaoMap] --> Q[RealRoutePolyline]
    P --> R[PlaceMarkers]
    S[ErrorLogTable] --> T[getErrorLogs]
    T --> U[resolveErrorLog]
```

---

이 문서는 프로젝트의 전체 워크플로우를 시각화하여 개발자들이 시스템의 동작 방식을 이해하는 데 도움을 줍니다.
