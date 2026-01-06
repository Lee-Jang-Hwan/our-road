/**
 * 개발 환경에서 API 호출을 로깅하는 유틸리티
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * API 호출 로깅
 */
export function logApiCall(
  method: string,
  url: string,
  options?: RequestInit,
  response?: Response,
  duration?: number
) {
  if (!isDevelopment) return;

  const timestamp = new Date().toISOString();
  const logGroup = `[API Call] ${timestamp}`;

  console.group(logGroup);
  console.log('📍 Method:', method);
  console.log('🔗 URL:', url);
  
  if (options?.headers) {
    // 민감한 정보는 마스킹
    const headers = { ...options.headers };
    if ('Authorization' in headers) {
      headers.Authorization = '***';
    }
    console.log('📋 Headers:', headers);
  }
  
  if (options?.body) {
    try {
      const body = typeof options.body === 'string' 
        ? JSON.parse(options.body) 
        : options.body;
      console.log('📦 Request Body:', body);
    } catch {
      console.log('📦 Request Body:', options.body);
    }
  }

  if (response) {
    console.log('✅ Status:', response.status, response.statusText);
    console.log('⏱️ Duration:', duration ? `${duration}ms` : 'N/A');
  }
  
  console.groupEnd();
}

/**
 * API 에러 로깅
 */
export function logApiError(
  method: string,
  url: string,
  error: Error | unknown,
  duration?: number
) {
  if (!isDevelopment) return;

  const timestamp = new Date().toISOString();
  const logGroup = `[API Error] ${timestamp}`;

  console.group(logGroup);
  console.error('❌ Method:', method);
  console.error('🔗 URL:', url);
  console.error('💥 Error:', error);
  if (duration) {
    console.error('⏱️ Duration:', `${duration}ms`);
  }
  console.groupEnd();
}

/**
 * 재시도 로깅
 */
export function logRetry(attempt: number, maxRetries: number) {
  if (!isDevelopment) return;
  console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries + 1}`);
}





