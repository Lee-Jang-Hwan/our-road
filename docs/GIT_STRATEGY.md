# Git 브랜치 전략

> OurRoad 프로젝트 Git 워크플로우 가이드

---

## 브랜치 구조

```
main (production)
 │
 └── develop (development)
      │
      ├── feature/xxx (기능 개발)
      ├── fix/xxx (버그 수정)
      ├── refactor/xxx (리팩토링)
      └── docs/xxx (문서 작업)
```

---

## 브랜치 설명

### 주요 브랜치

| 브랜치 | 용도 | 배포 환경 |
|--------|------|----------|
| `main` | 프로덕션 릴리즈 | Production (Vercel) |
| `develop` | 개발 통합 | Preview (Vercel) |

### 작업 브랜치

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `feature/` | 새 기능 개발 | `feature/trip-create` |
| `fix/` | 버그 수정 | `fix/auth-redirect` |
| `refactor/` | 코드 리팩토링 | `refactor/optimize-engine` |
| `docs/` | 문서 작업 | `docs/api-guide` |
| `hotfix/` | 긴급 수정 (main에서 분기) | `hotfix/critical-bug` |

---

## 워크플로우

### 1. 기능 개발

```bash
# 1. develop에서 feature 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b feature/trip-create

# 2. 작업 진행 및 커밋
git add .
git commit -m "feat: 여행 생성 폼 구현"

# 3. 원격 저장소에 푸시
git push origin feature/trip-create

# 4. Pull Request 생성 (feature → develop)
# GitHub/GitLab에서 PR 생성

# 5. 코드 리뷰 후 머지
# Squash and Merge 권장

# 6. 로컬 브랜치 정리
git checkout develop
git pull origin develop
git branch -d feature/trip-create
```

### 2. 버그 수정

```bash
git checkout develop
git checkout -b fix/auth-redirect

# 수정 후
git commit -m "fix: 로그인 후 리다이렉트 오류 수정"
git push origin fix/auth-redirect
# PR 생성 → 머지
```

### 3. 긴급 수정 (Hotfix)

```bash
# main에서 직접 분기
git checkout main
git checkout -b hotfix/critical-bug

# 수정 후
git commit -m "hotfix: 결제 오류 긴급 수정"
git push origin hotfix/critical-bug

# PR 생성 → main으로 머지
# 이후 develop에도 머지 필요
git checkout develop
git merge main
git push origin develop
```

### 4. 릴리즈

```bash
# develop을 main으로 머지
git checkout main
git pull origin main
git merge develop
git push origin main

# 태그 생성 (선택)
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

---

## 커밋 컨벤션

### 커밋 메시지 형식

```
<type>: <description>

[optional body]

[optional footer]
```

### 타입 (Type)

| 타입 | 설명 | 예시 |
|------|------|------|
| `feat` | 새 기능 | `feat: 장소 검색 기능 추가` |
| `fix` | 버그 수정 | `fix: 날짜 선택 오류 수정` |
| `refactor` | 리팩토링 | `refactor: 최적화 엔진 구조 개선` |
| `style` | 코드 스타일 | `style: 포맷팅 적용` |
| `docs` | 문서 | `docs: API 문서 업데이트` |
| `test` | 테스트 | `test: 경로 조회 테스트 추가` |
| `chore` | 기타 | `chore: 의존성 업데이트` |
| `perf` | 성능 개선 | `perf: 이미지 로딩 최적화` |

### 예시

```bash
# 기능 추가
git commit -m "feat: 여행 생성 Server Action 구현"

# 버그 수정
git commit -m "fix: RLS 정책 오류로 인한 조회 실패 수정"

# 리팩토링
git commit -m "refactor: Kakao API 클라이언트 에러 처리 개선"

# 문서
git commit -m "docs: TODO.md 진행 상황 업데이트"
```

---

## Pull Request 규칙

### PR 제목

```
[TYPE] 간단한 설명
```

예시:
- `[FEAT] 여행 생성 기능 구현`
- `[FIX] 로그인 리다이렉트 오류 수정`
- `[REFACTOR] 최적화 엔진 구조 개선`

### PR 본문 템플릿

```markdown
## 변경 사항
- 변경 내용 1
- 변경 내용 2

## 관련 이슈
- Closes #123

## 테스트
- [ ] 로컬 테스트 완료
- [ ] 빌드 성공 확인

## 스크린샷 (UI 변경 시)
[스크린샷 첨부]
```

### 머지 규칙

1. **최소 1명 리뷰 승인** 필요 (솔로 프로젝트 시 생략 가능)
2. **CI 통과** 필수 (빌드, 린트)
3. **Squash and Merge** 권장 (커밋 히스토리 정리)
4. **머지 후 브랜치 삭제**

---

## .gitignore

```gitignore
# dependencies
node_modules
.pnpm-store

# next.js
.next
out

# environment
.env
.env.local
.env.*.local

# vercel
.vercel

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.idea
.vscode
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# misc
*.log
```

---

## 브랜치 보호 규칙 (GitHub 설정)

### main 브랜치

- [ ] Require pull request reviews before merging
- [ ] Require status checks to pass before merging
- [ ] Require branches to be up to date before merging
- [ ] Include administrators

### develop 브랜치

- [ ] Require status checks to pass before merging

---

## 버전 태깅

### 시맨틱 버전

```
v{MAJOR}.{MINOR}.{PATCH}
```

| 버전 | 변경 시점 |
|------|----------|
| MAJOR | 하위 호환성 없는 변경 |
| MINOR | 하위 호환성 있는 기능 추가 |
| PATCH | 버그 수정 |

### 예시

```bash
# 버전 태그 생성
git tag -a v1.0.0 -m "Initial release"
git tag -a v1.1.0 -m "Added optimization engine"
git tag -a v1.1.1 -m "Fixed route calculation bug"

# 태그 푸시
git push origin v1.0.0
```

---

## 권장 Git 설정

```bash
# 사용자 설정
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# 기본 브랜치 이름
git config --global init.defaultBranch main

# Pull 전략 (rebase 권장)
git config --global pull.rebase true

# 자동 정리
git config --global fetch.prune true
```
