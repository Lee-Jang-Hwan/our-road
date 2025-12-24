-- ============================================
-- OurRoad Database Schema
-- 여행 동선 최적화 서비스 데이터베이스
-- ============================================
-- 기반 문서: docs/PRD.md
-- 생성일: 2025-12-23
-- ============================================

-- ============================================
-- 1. Extensions 활성화
-- ============================================

-- PostGIS 확장 (공간 데이터 처리)
CREATE EXTENSION IF NOT EXISTS postgis;

-- UUID 생성 함수 (이미 활성화되어 있을 가능성 높음)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. 기존 테이블 존재 시 삭제 (개발 환경용)
-- ============================================
-- 주의: 프로덕션에서는 이 섹션을 실행하지 마세요!

-- DROP TABLE IF EXISTS admin_users CASCADE;
-- DROP TABLE IF EXISTS error_logs CASCADE;
-- DROP TABLE IF EXISTS trip_itineraries CASCADE;
-- DROP TABLE IF EXISTS trip_fixed_schedules CASCADE;
-- DROP TABLE IF EXISTS trip_places CASCADE;
-- DROP TABLE IF EXISTS trips CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 3. 테이블 생성
-- ============================================

-- --------------------------------------------
-- 3.0 users: Clerk 사용자 동기화 테이블
-- --------------------------------------------
-- Clerk 사용자 정보를 Supabase에 동기화하기 위한 기본 테이블
-- SyncUserProvider에서 자동으로 동기화됨
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- --------------------------------------------
-- 3.1 trips: 여행 계획
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- 출발지/도착지 (JSONB: {name, address, lat, lng})
  origin JSONB NOT NULL,
  destination JSONB NOT NULL,

  -- 일일 시작/종료 시간
  daily_start_time TIME DEFAULT '10:00',
  daily_end_time TIME DEFAULT '22:00',

  -- 이동 수단 배열 ['walking', 'public', 'car']
  transport_mode TEXT[] NOT NULL DEFAULT ARRAY['public'],

  -- 상태: draft, optimizing, optimized, completed
  status TEXT DEFAULT 'draft',

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 제약 조건
  CONSTRAINT valid_dates CHECK (start_date <= end_date),
  CONSTRAINT valid_daily_times CHECK (daily_start_time < daily_end_time),
  CONSTRAINT valid_duration CHECK (end_date - start_date <= 30),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'optimizing', 'optimized', 'completed'))
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------
-- 3.2 trip_places: 방문 장소
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS trip_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,

  -- 장소 정보
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,

  -- 카테고리 (tourist_attraction, restaurant, cafe, shopping, etc.)
  category TEXT,

  -- Kakao Place ID (외부 API 연동용)
  kakao_place_id TEXT,

  -- 사용자 우선순위 (1~100, 낮을수록 높은 우선순위)
  priority INT,

  -- 예상 체류 시간 (분) - 30분 ~ 720분 (12시간), 30분 단위
  estimated_duration INT NOT NULL DEFAULT 60,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now(),

  -- 제약 조건
  CONSTRAINT valid_lat CHECK (lat >= -90 AND lat <= 90),
  CONSTRAINT valid_lng CHECK (lng >= -180 AND lng <= 180),
  CONSTRAINT valid_duration CHECK (estimated_duration >= 30 AND estimated_duration <= 720),
  CONSTRAINT valid_duration_unit CHECK (estimated_duration % 30 = 0),
  CONSTRAINT valid_priority CHECK (priority IS NULL OR (priority >= 1 AND priority <= 100)),
  CONSTRAINT valid_category CHECK (
    category IS NULL OR category IN (
      'tourist_attraction', 'restaurant', 'cafe', 'shopping',
      'accommodation', 'entertainment', 'culture', 'nature', 'other'
    )
  )
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_trip_places_trip_id ON trip_places(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_places_category ON trip_places(category);
CREATE INDEX IF NOT EXISTS idx_trip_places_priority ON trip_places(priority);

-- PostGIS 공간 인덱스 (지리적 검색 최적화)
-- 주의: PostGIS 확장 필요
-- CREATE INDEX IF NOT EXISTS idx_trip_places_location
--   ON trip_places USING GIST (ST_MakePoint(lng, lat));

-- --------------------------------------------
-- 3.3 trip_fixed_schedules: 고정 일정
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS trip_fixed_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,

  -- 연결된 장소 (선택적)
  place_id UUID REFERENCES trip_places(id) ON DELETE SET NULL,

  -- 고정 일정 정보
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  note TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now(),

  -- 제약 조건
  CONSTRAINT valid_fixed_times CHECK (start_time < end_time)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_fixed_schedules_trip_id ON trip_fixed_schedules(trip_id);
CREATE INDEX IF NOT EXISTS idx_fixed_schedules_date ON trip_fixed_schedules(date);
CREATE INDEX IF NOT EXISTS idx_fixed_schedules_place_id ON trip_fixed_schedules(place_id);

-- --------------------------------------------
-- 3.4 trip_itineraries: 최적화된 일정
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS trip_itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,

  -- 일차 정보
  day_number INT NOT NULL,      -- 1일차, 2일차...
  date DATE NOT NULL,

  -- 상세 일정 (JSONB 배열)
  -- 구조:
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
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- 일별 통계
  total_distance INT,           -- 총 거리 (m)
  total_duration INT,           -- 총 이동 시간 (분)
  total_stay_duration INT,      -- 총 체류 시간 (분)
  place_count INT,              -- 장소 수

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now(),

  -- 유니크 제약 (trip당 day_number 중복 방지)
  CONSTRAINT unique_trip_day UNIQUE (trip_id, day_number),
  CONSTRAINT valid_day_number CHECK (day_number >= 1)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_itineraries_trip_id ON trip_itineraries(trip_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_date ON trip_itineraries(date);

-- --------------------------------------------
-- 3.5 error_logs: 에러 로그 (관리자용)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 에러 정보
  error_code TEXT NOT NULL,              -- 'ROUTE_NOT_FOUND', 'API_RATE_LIMIT', etc.
  error_message TEXT NOT NULL,           -- 에러 메시지
  error_stack TEXT,                      -- 스택 트레이스 (선택)

  -- 컨텍스트 (trip_id, place_id, user_id 등 메타데이터)
  context JSONB,

  -- 심각도: 'info', 'warning', 'error', 'critical'
  severity TEXT NOT NULL DEFAULT 'error',

  -- 발생 위치 (예: 'optimize/distance-matrix', 'api/odsay')
  source TEXT NOT NULL,

  -- 해결 상태
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,                      -- 해결한 관리자 clerk_id
  resolution_note TEXT,                  -- 해결 메모

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 제약 조건
  CONSTRAINT valid_severity CHECK (
    severity IN ('info', 'warning', 'error', 'critical')
  )
);

-- 인덱스 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_code ON error_logs(error_code);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER error_logs_updated_at
  BEFORE UPDATE ON error_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------
-- 3.6 admin_users: 관리자 사용자
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL UNIQUE REFERENCES users(clerk_id) ON DELETE CASCADE,

  -- 관리자 역할: 'admin', 'super_admin'
  role TEXT NOT NULL DEFAULT 'admin',

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now(),

  -- 제약 조건
  CONSTRAINT valid_admin_role CHECK (role IN ('admin', 'super_admin'))
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_admin_users_clerk_id ON admin_users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- ============================================
-- 4. Row Level Security (RLS) 정책
-- ============================================

-- --------------------------------------------
-- 4.1 trips 테이블 RLS
-- --------------------------------------------
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 여행만 조회 가능
CREATE POLICY "Users can view own trips"
  ON trips FOR SELECT
  USING (auth.jwt()->>'sub' = user_id);

-- INSERT: 본인 여행만 생성 가능
CREATE POLICY "Users can create own trips"
  ON trips FOR INSERT
  WITH CHECK (auth.jwt()->>'sub' = user_id);

-- UPDATE: 본인 여행만 수정 가능
CREATE POLICY "Users can update own trips"
  ON trips FOR UPDATE
  USING (auth.jwt()->>'sub' = user_id);

-- DELETE: 본인 여행만 삭제 가능
CREATE POLICY "Users can delete own trips"
  ON trips FOR DELETE
  USING (auth.jwt()->>'sub' = user_id);

-- --------------------------------------------
-- 4.2 trip_places 테이블 RLS
-- --------------------------------------------
ALTER TABLE trip_places ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 여행의 장소만 조회 가능
CREATE POLICY "Users can view own trip places"
  ON trip_places FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_places.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- INSERT: 본인 여행에만 장소 추가 가능
CREATE POLICY "Users can add places to own trips"
  ON trip_places FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_places.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- UPDATE: 본인 여행의 장소만 수정 가능
CREATE POLICY "Users can update own trip places"
  ON trip_places FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_places.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- DELETE: 본인 여행의 장소만 삭제 가능
CREATE POLICY "Users can delete own trip places"
  ON trip_places FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_places.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- --------------------------------------------
-- 4.3 trip_fixed_schedules 테이블 RLS
-- --------------------------------------------
ALTER TABLE trip_fixed_schedules ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 여행의 고정 일정만 조회 가능
CREATE POLICY "Users can view own fixed schedules"
  ON trip_fixed_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_fixed_schedules.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- INSERT: 본인 여행에만 고정 일정 추가 가능
CREATE POLICY "Users can add fixed schedules to own trips"
  ON trip_fixed_schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_fixed_schedules.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- UPDATE: 본인 여행의 고정 일정만 수정 가능
CREATE POLICY "Users can update own fixed schedules"
  ON trip_fixed_schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_fixed_schedules.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- DELETE: 본인 여행의 고정 일정만 삭제 가능
CREATE POLICY "Users can delete own fixed schedules"
  ON trip_fixed_schedules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_fixed_schedules.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- --------------------------------------------
-- 4.4 trip_itineraries 테이블 RLS
-- --------------------------------------------
ALTER TABLE trip_itineraries ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 여행의 일정만 조회 가능
CREATE POLICY "Users can view own itineraries"
  ON trip_itineraries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_itineraries.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- INSERT: 본인 여행에만 일정 추가 가능
CREATE POLICY "Users can add itineraries to own trips"
  ON trip_itineraries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_itineraries.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- UPDATE: 본인 여행의 일정만 수정 가능
CREATE POLICY "Users can update own itineraries"
  ON trip_itineraries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_itineraries.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- DELETE: 본인 여행의 일정만 삭제 가능
CREATE POLICY "Users can delete own itineraries"
  ON trip_itineraries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_itineraries.trip_id
        AND trips.user_id = auth.jwt()->>'sub'
    )
  );

-- --------------------------------------------
-- 4.5 error_logs 테이블 RLS (관리자 전용)
-- --------------------------------------------
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: 관리자만 조회 가능
CREATE POLICY "Admins can view all error logs"
  ON error_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.clerk_id = auth.jwt()->>'sub'
    )
  );

-- UPDATE: 관리자만 수정 가능 (해결 처리)
CREATE POLICY "Admins can update error logs"
  ON error_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.clerk_id = auth.jwt()->>'sub'
    )
  );

-- DELETE: 관리자만 삭제 가능
CREATE POLICY "Admins can delete error logs"
  ON error_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.clerk_id = auth.jwt()->>'sub'
    )
  );

-- INSERT: Service Role만 가능 (RLS bypass)
-- 일반 사용자는 직접 에러 로그를 생성할 수 없음
-- Server Action에서 service_role 클라이언트를 사용하여 생성
CREATE POLICY "Service role can insert error logs"
  ON error_logs FOR INSERT
  WITH CHECK (true);

-- --------------------------------------------
-- 4.6 admin_users 테이블 RLS
-- --------------------------------------------
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ALL: super_admin만 관리자 관리 가능
CREATE POLICY "Super admins can manage admin users"
  ON admin_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.clerk_id = auth.jwt()->>'sub'
        AND au.role = 'super_admin'
    )
  );

-- SELECT: 관리자는 자신의 정보 조회 가능
CREATE POLICY "Admins can view own info"
  ON admin_users FOR SELECT
  USING (clerk_id = auth.jwt()->>'sub');

-- --------------------------------------------
-- 4.7 users 테이블 RLS
-- --------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- SELECT: 인증된 사용자는 모든 사용자 조회 가능 (공개 프로필)
CREATE POLICY "Authenticated users can view all users"
  ON users FOR SELECT
  USING (auth.jwt() IS NOT NULL);

-- INSERT: Service Role만 가능 (Clerk 동기화 API에서 사용)
CREATE POLICY "Service role can insert users"
  ON users FOR INSERT
  WITH CHECK (true);

-- UPDATE: 본인 정보만 수정 가능
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.jwt()->>'sub' = clerk_id);

-- DELETE: 본인만 삭제 가능 (계정 탈퇴)
CREATE POLICY "Users can delete own account"
  ON users FOR DELETE
  USING (auth.jwt()->>'sub' = clerk_id);

-- ============================================
-- 5. Storage 버킷 설정
-- ============================================

-- 참고: Storage 버킷은 Supabase Dashboard에서 생성하거나
-- 아래 SQL을 사용하여 생성할 수 있습니다.

-- 5.1 uploads 버킷 생성 (이미 존재할 수 있음)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  false,
  52428800, -- 50MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 5.2 trip-images 버킷 생성 (여행 이미지용)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-images',
  'trip-images',
  true, -- 공개 접근 허용 (여행 공유 시)
  10485760, -- 10MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. Storage RLS 정책
-- ============================================

-- --------------------------------------------
-- 6.1 uploads 버킷 정책
-- --------------------------------------------

-- SELECT: 인증된 사용자만 자신의 파일 조회 가능
CREATE POLICY "Users can view own uploads"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'uploads'
    AND auth.jwt()->>'sub' = (storage.foldername(name))[1]
  );

-- INSERT: 인증된 사용자만 자신의 폴더에 업로드 가능
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads'
    AND auth.jwt()->>'sub' = (storage.foldername(name))[1]
  );

-- UPDATE: 인증된 사용자만 자신의 파일 업데이트 가능
CREATE POLICY "Users can update own uploads"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'uploads'
    AND auth.jwt()->>'sub' = (storage.foldername(name))[1]
  );

-- DELETE: 인증된 사용자만 자신의 파일 삭제 가능
CREATE POLICY "Users can delete own uploads"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'uploads'
    AND auth.jwt()->>'sub' = (storage.foldername(name))[1]
  );

-- --------------------------------------------
-- 6.2 trip-images 버킷 정책
-- --------------------------------------------

-- SELECT: 모든 사용자 조회 가능 (공개 버킷)
CREATE POLICY "Anyone can view trip images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trip-images');

-- INSERT: 인증된 사용자만 업로드 가능
CREATE POLICY "Authenticated users can upload trip images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trip-images'
    AND auth.jwt()->>'sub' IS NOT NULL
  );

-- UPDATE: 자신이 업로드한 이미지만 수정 가능
-- (폴더 구조: {clerk_user_id}/{trip_id}/{filename})
CREATE POLICY "Users can update own trip images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'trip-images'
    AND auth.jwt()->>'sub' = (storage.foldername(name))[1]
  );

-- DELETE: 자신이 업로드한 이미지만 삭제 가능
CREATE POLICY "Users can delete own trip images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'trip-images'
    AND auth.jwt()->>'sub' = (storage.foldername(name))[1]
  );

-- ============================================
-- 7. 유틸리티 함수
-- ============================================

-- 7.1 관리자 여부 확인 함수
CREATE OR REPLACE FUNCTION is_admin(user_clerk_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE clerk_id = user_clerk_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.2 Super Admin 여부 확인 함수
CREATE OR REPLACE FUNCTION is_super_admin(user_clerk_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE clerk_id = user_clerk_id
      AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.3 여행 소유자 확인 함수
CREATE OR REPLACE FUNCTION is_trip_owner(p_trip_id UUID, p_user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trips
    WHERE id = p_trip_id
      AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.4 여행 일수 계산 함수
CREATE OR REPLACE FUNCTION calculate_trip_days(p_start_date DATE, p_end_date DATE)
RETURNS INT AS $$
BEGIN
  RETURN (p_end_date - p_start_date) + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7.5 체류 시간 포맷 함수 (분 → "X시간 Y분")
CREATE OR REPLACE FUNCTION format_duration(minutes INT)
RETURNS TEXT AS $$
DECLARE
  hours INT;
  mins INT;
BEGIN
  hours := minutes / 60;
  mins := minutes % 60;

  IF hours > 0 AND mins > 0 THEN
    RETURN hours || '시간 ' || mins || '분';
  ELSIF hours > 0 THEN
    RETURN hours || '시간';
  ELSE
    RETURN mins || '분';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 8. 초기 데이터 (개발용)
-- ============================================
-- 주의: 프로덕션에서는 이 섹션을 실행하지 마세요!

-- 예시: 첫 번째 Super Admin 추가 (clerk_id는 실제 값으로 교체)
-- INSERT INTO admin_users (clerk_id, role)
-- VALUES ('user_XXXXXXXXXXXXX', 'super_admin')
-- ON CONFLICT (clerk_id) DO NOTHING;

-- ============================================
-- 스키마 생성 완료
-- ============================================
--
-- 생성된 테이블:
--   1. trips            - 여행 계획
--   2. trip_places      - 방문 장소
--   3. trip_fixed_schedules - 고정 일정
--   4. trip_itineraries - 최적화된 일정
--   5. error_logs       - 에러 로그 (관리자용)
--   6. admin_users      - 관리자 사용자
--
-- 생성된 Storage 버킷:
--   1. uploads          - 사용자 파일 (비공개)
--   2. trip-images      - 여행 이미지 (공개)
--
-- RLS 정책:
--   - 모든 테이블에 RLS 활성화
--   - 사용자별 데이터 접근 제어
--   - 관리자 전용 테이블 보호
--
-- 유틸리티 함수:
--   - is_admin()
--   - is_super_admin()
--   - is_trip_owner()
--   - calculate_trip_days()
--   - format_duration()
-- ============================================
