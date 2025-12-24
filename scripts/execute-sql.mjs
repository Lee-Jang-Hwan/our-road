/**
 * Supabase Management API를 사용하여 SQL 실행
 *
 * 사용법: node scripts/execute-sql.mjs
 */

import https from 'https';

const PROJECT_REF = 'qkmruxvjerttftzinvsg';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_82de5d0dc9052a0110dcb41ad1493ea4073966da';

const sql = `
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
`;

async function executeSQL() {
  const postData = JSON.stringify({ query: sql });

  const options = {
    hostname: 'api.supabase.com',
    path: `/v1/projects/${PROJECT_REF}/database/query`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('SQL executed successfully!');
          try {
            console.log('Response:', JSON.parse(data));
          } catch {
            console.log('Response:', data);
          }
          resolve(data);
        } else {
          console.error('Error:', data);
          reject(new Error(data));
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

console.log('Executing SQL to fix RLS policies...');
console.log('Project:', PROJECT_REF);
console.log('');

executeSQL()
  .then(() => console.log('\nDone!'))
  .catch((e) => console.error('\nFailed:', e.message));
