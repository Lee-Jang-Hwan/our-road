/**
 * RLS 정책 수정 스크립트
 *
 * Supabase Dashboard에서 실행해야 할 SQL 문을 출력합니다.
 *
 * 사용법:
 * 1. 이 스크립트 실행: node scripts/apply-rls-fix.mjs
 * 2. 출력된 SQL을 복사
 * 3. Supabase Dashboard > SQL Editor에 붙여넣기 후 실행
 */

const sql = `
-- ============================================
-- RLS 정책 수정 스크립트
-- admin_users 테이블의 무한 재귀 오류 수정
-- ============================================

-- 1. 기존 admin_users 정책 삭제
DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can view own info" ON admin_users;

-- 2. error_logs 테이블의 기존 정책 삭제
DROP POLICY IF EXISTS "Admins can view all error logs" ON error_logs;
DROP POLICY IF EXISTS "Admins can update error logs" ON error_logs;
DROP POLICY IF EXISTS "Admins can delete error logs" ON error_logs;
DROP POLICY IF EXISTS "Service role can insert error logs" ON error_logs;

-- 3. is_admin 함수 재생성 (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION is_admin(user_clerk_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE clerk_id = user_clerk_id
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. admin_users 테이블 새 정책 생성
CREATE POLICY "Admins can view own info"
  ON admin_users FOR SELECT
  USING (clerk_id = auth.jwt()->>'sub');

CREATE POLICY "Service role can insert admin users"
  ON admin_users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update own info"
  ON admin_users FOR UPDATE
  USING (clerk_id = auth.jwt()->>'sub')
  WITH CHECK (clerk_id = auth.jwt()->>'sub');

-- 5. error_logs 테이블 새 정책 생성
CREATE POLICY "Admins can view all error logs"
  ON error_logs FOR SELECT
  USING (is_admin(auth.jwt()->>'sub'));

CREATE POLICY "Admins can update error logs"
  ON error_logs FOR UPDATE
  USING (is_admin(auth.jwt()->>'sub'));

CREATE POLICY "Admins can delete error logs"
  ON error_logs FOR DELETE
  USING (is_admin(auth.jwt()->>'sub'));

CREATE POLICY "Anyone can insert error logs"
  ON error_logs FOR INSERT
  WITH CHECK (true);

-- 완료
SELECT 'RLS policies updated successfully!' as message;
`;

console.log('========================================');
console.log('RLS 정책 수정 SQL');
console.log('========================================');
console.log('');
console.log('다음 SQL을 Supabase Dashboard > SQL Editor에서 실행하세요:');
console.log('https://supabase.com/dashboard/project/qkmruxvjerttftzinvsg/sql/new');
console.log('');
console.log('========================================');
console.log(sql);
console.log('========================================');
