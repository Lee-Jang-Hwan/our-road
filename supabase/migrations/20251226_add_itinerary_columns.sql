-- ============================================
-- trip_itineraries 테이블에 누락된 컬럼 추가
-- ============================================
-- 생성일: 2025-12-26
-- 목적: 일정 저장 시 필요한 추가 필드 지원
-- ============================================

-- 1. 일별 시작/종료 시간 컬럼 추가
ALTER TABLE trip_itineraries
ADD COLUMN IF NOT EXISTS daily_start_time TIME,
ADD COLUMN IF NOT EXISTS daily_end_time TIME;

-- 2. 출발지에서 첫 장소까지의 이동 정보
ALTER TABLE trip_itineraries
ADD COLUMN IF NOT EXISTS transport_from_origin JSONB;

-- 3. 마지막 장소에서 도착지까지의 이동 정보
ALTER TABLE trip_itineraries
ADD COLUMN IF NOT EXISTS transport_to_destination JSONB;

-- 4. 컬럼 설명 추가 (옵션)
COMMENT ON COLUMN trip_itineraries.daily_start_time IS '해당 일의 시작 시간';
COMMENT ON COLUMN trip_itineraries.daily_end_time IS '해당 일의 종료 시간';
COMMENT ON COLUMN trip_itineraries.transport_from_origin IS '출발지에서 첫 장소까지의 이동 정보 (JSONB)';
COMMENT ON COLUMN trip_itineraries.transport_to_destination IS '마지막 장소에서 도착지까지의 이동 정보 (JSONB)';

-- ============================================
-- 마이그레이션 완료
-- ============================================
