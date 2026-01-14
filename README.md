![배너이미지](https://github.com/user-attachments/assets/88b79e58-6fa3-4095-97a6-2b038990af8e)
# 🗺️ RootUs (루트어스)
> **대중교통·도보·자동차까지 계산해, 스트레스가 줄어드는 여행 동선 설계 서비스** > "여행 계획은 쉽게, 동선은 최적으로"

<br/>

## 📖 프로젝트 소개
**RootUs**는 복잡한 여행 계획의 스트레스를 줄여주는 **AI 기반 여행 일정 최적화 서비스**입니다.  
단순한 직선 거리가 아닌, **대중교통, 자동차, 도보** 등 실제 이동 수단을 고려하여 가장 효율적인 방문 순서와 일정표를 자동으로 생성합니다.

### 📅 프로젝트 기간
202X.XX.XX ~ 202X.XX.XX (예정)

<br/>

## 😎 Members

| **이장환** | **천준범** | **손민** |
| :---: | :---: | :---: |
| <img src="https://avatars.githubusercontent.com/placeholder" width="100px" /> | <img src="https://avatars.githubusercontent.com/placeholder" width="100px" /> | <img src="https://avatars.githubusercontent.com/placeholder" width="100px" /> |
| **Full Stack** | **Full Stack** | **Full Stack** |
| [@GithubID](https://github.com/) | [@GithubID](https://github.com/) | [@GithubID](https://github.com/) |
| dlwkdghks0807@gmail.com | wnsqja2209@gmail.com | dkrhd200197@gmail.com |

<br/>

## ✨ 주요 기능

#### 🏠 홈 & 마이페이지
- **직관적인 랜딩**: 서비스의 핵심 가치를 전달하고 **Clerk** 기반의 소셜 로그인으로 빠르게 시작할 수 있습니다.
- **여행 관리**: '내 여행 리스트'에서 지난 여행을 조회하고, 새로운 여행을 손쉽게 생성할 수 있습니다.

#### 📝 여행 생성 프로세스
- **상세 설정**: 여행 제목, 기간, 주요 이동 수단(대중교통/자동차)을 선택합니다.
- **장소 및 숙소**: 출발지/도착지뿐만 아니라 숙소(체크인/아웃) 정보까지 고려하여 동선을 짭니다.
- **장소 추가**: 검색을 통해 여행지를 추가하고, 각 장소별 **체류 시간**을 설정하여 현실적인 일정을 만듭니다.

#### 🧩 일정 최적화 (Core Feature)
- **AI 경로 생성**: 선택한 장소와 이동 수단을 분석하여 최적의 경로를 **폴리라인**으로 지도에 시각화합니다.
- **상세 정보 제공**: 각 구간별 이동 시간, 대중교통 환승 정보, 도보 경로 등을 상세히 안내합니다.
- **공유 기능**: 완성된 여행 일정을 친구들에게 링크로 공유할 수 있습니다.

#### 🛠️ 유연한 일정 수정
- **자동 경로 변경**: 일정이 삭제되거나 체류 시간이 변경되면 AI가 즉시 경로를 재최적화합니다.
- **수동 경로 변경**: **Drag & Drop**으로 사용자가 직접 방문 순서를 바꿀 수 있으며, 이에 맞춰 구간 정보가 다시 계산됩니다.

<br/>

## 🌐 서비스 아키텍처
![아키텍처](https://placeholder.com/architecture.png)
<br/>

## 🛠 Tech Stack

#### Common & Environment
<img src="https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=next.js&logoColor=white"> <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black"> <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"> <img src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white">

#### Frontend
<img src="https://img.shields.io/badge/Jotai-000000?style=for-the-badge&logo=ghost&logoColor=white"> <img src="https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white"> <img src="https://img.shields.io/badge/React_Hook_Form-EC5990?style=for-the-badge&logo=reacthookform&logoColor=white"> <img src="https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white">
<br/>
<img src="https://img.shields.io/badge/Recharts-22B5BF?style=for-the-badge&logo=chart.js&logoColor=white"> <img src="https://img.shields.io/badge/dnd--kit-000000?style=for-the-badge&logo=dnd&logoColor=white"> <img src="https://img.shields.io/badge/Kakao_Maps_SDK-FFCD00?style=for-the-badge&logo=kakao&logoColor=black">

#### Backend & Infra
<img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white"> <img src="https://img.shields.io/badge/Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white"> <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white"> <img src="https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white">

#### External APIs
<img src="https://img.shields.io/badge/Kakao_Mobility-FFCD00?style=for-the-badge&logo=kakao&logoColor=black"> <img src="https://img.shields.io/badge/ODsay_Lab-PubTrans-blue?style=for-the-badge"> <img src="https://img.shields.io/badge/TMap_API-ED1C24?style=for-the-badge">

<br/>

## 🔧 기술적 의사결정 (Technical Decisions)

| 구분 | 기술 스택 | 도입 이유 |
| :--- | :--- | :--- |
| **Framework** | **Next.js 15 (App Router)** | [cite_start]Server Actions를 중심으로 라우팅과 데이터 로직을 통합하여 복잡도를 낮추고 최신 React 기능을 활용하기 위함[cite: 381]. |
| **State** | **Jotai** | [cite_start]Redux 등의 복잡한 보일러플레이트 없이 원자(Atom) 단위로 가볍고 단순하게 전역 상태를 관리하기 위해 선택[cite: 386]. |
| **DB/Auth** | **Supabase & Clerk** | [cite_start]인증(Clerk)과 데이터베이스/스토리지(Supabase)를 분리하여 운영 부담을 줄이고, 한국어 로컬라이징 및 안정적인 세션 관리를 적용[cite: 381, 388]. |
| **Stability** | **Rate Limiter & Circuit Breaker** | [cite_start]외부 API(Kakao, ODsay 등) 호출 비용을 제어하고, 장애 발생 시 시스템 전체로 전파되는 것을 막기 위함[cite: 388]. |

<br/>

## 🚨 트러블 슈팅 (Troubleshooting)

### 1. 도시간 대중교통 라벨링 우선순위 문제 [FE]
- **문제 상황**: '고속/시외버스' 구간임에도 단순히 '대중교통'으로만 표시되거나, 정보가 불명확하여 사용자가 혼동을 겪음.
- [cite_start]**원인**: 기존 로직이 단순히 `TrafficType`만을 체크하고, 우선순위(Priority) 설정이 없어 기본 라벨로 폴백(Fallback)되는 경우가 많았음[cite: 395].
- [cite_start]**해결**: `열차 > 고속시외 > 지하철 > 버스` 순으로 우선순위를 정립하고, `lane.name` 데이터 유무를 확인하는 방어 로직을 추가하여 정확한 교통수단 명칭이 표시되도록 개선[cite: 400, 401].

### 2. 클러스터링 시 고정 경유지 누락 현상 [Algorithm]
- **문제 상황**: 여행 경로 최적화 알고리즘 수행 중, 사용자가 반드시 방문하겠다고 고정한 '필수 경유지'가 클러스터에서 제외되는 버그 발생.
- [cite_start]**원인**: 고정 경유지를 탐색하는 함수가 생성 중인(미완성) 클러스터 내부에서만 검색을 시도하여 데이터를 찾지 못함[cite: 437].
- [cite_start]**해결**: 함수 로직을 수정하여 클러스터링 결과가 아닌 **원본 전체 경유지 리스트(All Waypoints)**에서 고정 경유지를 직접 조회해 강제로 포함시키도록 변경[cite: 439].

### 3. 외부 경로 API 불안정 대응 [Infra]
- **문제 상황**: 외부 API (Kakao, ODsay) 호출 시 429(Too Many Requests)나 서버 에러로 인해 경로 계산이 실패하고 서비스가 중단됨.
- [cite_start]**해결**: **지수 백오프(Exponential Backoff)** 기반의 재시도 로직을 도입하고, 모든 재시도 실패 시 미리 정의된 Fallback 비용 계산 로직을 수행하여 서비스 안정성을 확보[cite: 472].

---

### 📂 Folder Structure
```bash
RootUs
├── app
│   ├── (routes)
│   ├── api
│   └── layout.tsx
├── components
│   ├── ui (shadcn)
│   └── map
├── hooks
├── lib
│   ├── algorithms
│   └── utils
└── ...
