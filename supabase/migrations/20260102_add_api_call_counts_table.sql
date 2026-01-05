-- API 호출 횟수 추적 테이블
-- 일일 API 호출 제한을 관리하기 위한 테이블

CREATE TABLE IF NOT EXISTS api_call_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 유니크 제약: API 이름 + 날짜 조합은 고유해야 함
  CONSTRAINT unique_api_date UNIQUE (api_name, date)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_api_call_counts_api_date
  ON api_call_counts(api_name, date);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_api_call_counts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_api_call_counts_updated_at ON api_call_counts;
CREATE TRIGGER trigger_api_call_counts_updated_at
  BEFORE UPDATE ON api_call_counts
  FOR EACH ROW
  EXECUTE FUNCTION update_api_call_counts_updated_at();

-- API 호출 횟수 증가 함수 (UPSERT)
CREATE OR REPLACE FUNCTION increment_api_call_count(
  p_api_name TEXT,
  p_date DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  INSERT INTO api_call_counts (api_name, date, call_count)
  VALUES (p_api_name, p_date, 1)
  ON CONFLICT (api_name, date)
  DO UPDATE SET call_count = api_call_counts.call_count + 1
  RETURNING call_count INTO v_new_count;

  RETURN v_new_count;
END;
$$ LANGUAGE plpgsql;

-- RLS 비활성화 (서비스 역할로만 접근)
ALTER TABLE api_call_counts DISABLE ROW LEVEL SECURITY;

-- 테이블 코멘트
COMMENT ON TABLE api_call_counts IS 'API 호출 횟수 추적 테이블 (일일 제한 관리)';
COMMENT ON COLUMN api_call_counts.api_name IS 'API 이름 (odsay, tmap, kakao_mobility 등)';
COMMENT ON COLUMN api_call_counts.date IS '호출 날짜';
COMMENT ON COLUMN api_call_counts.call_count IS '해당 날짜의 호출 횟수';
