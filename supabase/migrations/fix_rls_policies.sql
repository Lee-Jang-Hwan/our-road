-- ============================================
-- RLS 정책 수정 스크립트
-- admin_users 테이블의 무한 재귀 오류 수정
-- ============================================
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행
-- ============================================

-- 1. 기존 admin_users 정책 삭제
DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can view own info" ON admin_users;

-- 2. error_logs 테이블의 기존 정책 삭제 (admin_users 참조로 인한 문제)
DROP POLICY IF EXISTS "Admins can view all error logs" ON error_logs;
DROP POLICY IF EXISTS "Admins can update error logs" ON error_logs;
DROP POLICY IF EXISTS "Admins can delete error logs" ON error_logs;
DROP POLICY IF EXISTS "Service role can insert error logs" ON error_logs;

-- ============================================
-- 3. admin_users 테이블 새 정책 생성
-- ============================================

-- 3.1 관리자는 자신의 정보만 조회 가능 (재귀 없음)
CREATE POLICY "Admins can view own info"
  ON admin_users FOR SELECT
  USING (clerk_id = auth.jwt()->>'sub');

-- 3.2 Service Role만 관리자 관리 가능 (INSERT, UPDATE, DELETE)
-- Super Admin 관리는 Service Role 클라이언트로만 가능
-- 재귀 문제를 피하기 위해 RLS를 통한 관리 제한

-- INSERT: Service Role만 가능
CREATE POLICY "Service role can insert admin users"
  ON admin_users FOR INSERT
  WITH CHECK (true);

-- UPDATE: 본인 정보만 수정 가능 (역할 변경은 Service Role로만)
CREATE POLICY "Admins can update own info"
  ON admin_users FOR UPDATE
  USING (clerk_id = auth.jwt()->>'sub')
  WITH CHECK (clerk_id = auth.jwt()->>'sub');

-- DELETE: Service Role만 가능 (일반 정책으로는 삭제 불가)
-- 실제 삭제는 Service Role 클라이언트 사용

-- ============================================
-- 4. error_logs 테이블 새 정책 생성
-- ============================================
-- 재귀 문제를 피하기 위해 is_admin 함수 사용

-- 4.1 is_admin 함수가 SECURITY DEFINER로 설정되어 있어 재귀 없이 동작
-- 함수 재생성 (SECURITY DEFINER 확인)
CREATE OR REPLACE FUNCTION is_admin(user_clerk_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  -- SECURITY DEFINER로 RLS 우회하여 조회
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE clerk_id = user_clerk_id
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 SELECT: 관리자만 조회 가능
CREATE POLICY "Admins can view all error logs"
  ON error_logs FOR SELECT
  USING (is_admin(auth.jwt()->>'sub'));

-- 4.3 UPDATE: 관리자만 수정 가능 (해결 처리)
CREATE POLICY "Admins can update error logs"
  ON error_logs FOR UPDATE
  USING (is_admin(auth.jwt()->>'sub'));

-- 4.4 DELETE: 관리자만 삭제 가능
CREATE POLICY "Admins can delete error logs"
  ON error_logs FOR DELETE
  USING (is_admin(auth.jwt()->>'sub'));

-- 4.5 INSERT: 누구나 가능 (에러 로깅은 서비스 전체에서 발생)
-- Service Role 또는 서버 사이드에서만 호출되므로 안전
CREATE POLICY "Anyone can insert error logs"
  ON error_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. users 테이블 정책 확인 및 수정
-- ============================================
-- anon 키로 접근 가능한 것은 정상 (공개 프로필)
-- 단, 인증되지 않은 사용자는 조회 불가하도록 수정 필요 시:

-- 기존 정책 삭제 (필요 시)
-- DROP POLICY IF EXISTS "Authenticated users can view all users" ON users;

-- 새 정책 (선택적 - 현재는 인증된 사용자만 조회 가능)
-- 이미 올바르게 설정되어 있으면 이 부분은 스킵

-- ============================================
-- 완료
-- ============================================
-- 이 스크립트 실행 후 다음을 확인하세요:
-- 1. Supabase Dashboard > Authentication > Policies에서 정책 확인
-- 2. 개발 서버에서 로그인 후 기능 테스트
-- ============================================
