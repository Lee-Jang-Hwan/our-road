// ============================================
// API Rate Limiter (API 호출 횟수 제한)
// ============================================

import { createClient } from "@supabase/supabase-js";
import { logRateLimit } from "@/lib/utils/api-logger";

// ============================================
// Configuration
// ============================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * API별 일일 호출 제한
 */
export const API_DAILY_LIMITS: Record<string, number> = {
  odsay: 990,
  tmap: 10000,
  kakao_mobility: 300000,
};

/**
 * Rate Limiter 에러
 */
export class RateLimitError extends Error {
  constructor(
    public readonly apiName: string,
    public readonly currentCount: number,
    public readonly dailyLimit: number
  ) {
    super(
      `${apiName} API 일일 호출 한도(${dailyLimit}회)를 초과했습니다. 현재: ${currentCount}회`
    );
    this.name = "RateLimitError";
  }
}

// ============================================
// In-Memory Cache (서버 재시작 시 리셋됨)
// ============================================

interface ApiCallCache {
  count: number;
  date: string;
  lastUpdated: number;
}

const callCache = new Map<string, ApiCallCache>();

/**
 * 오늘 날짜 문자열 (YYYY-MM-DD)
 */
function getTodayString(): string {
  const now = new Date();
  // 한국 시간 기준으로 날짜 계산
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  return kstDate.toISOString().split("T")[0];
}

/**
 * 캐시 키 생성
 */
function getCacheKey(apiName: string): string {
  return `${apiName}:${getTodayString()}`;
}

// ============================================
// Supabase Functions
// ============================================

/**
 * Supabase 클라이언트 생성 (서비스 역할)
 */
function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * DB에서 오늘의 API 호출 횟수 조회
 */
async function getApiCallCountFromDB(apiName: string): Promise<number> {
  const supabase = getSupabaseClient();
  const today = getTodayString();

  const { data, error } = await supabase
    .from("api_call_counts")
    .select("call_count")
    .eq("api_name", apiName)
    .eq("date", today)
    .single();

  if (error) {
    // 레코드가 없는 경우
    if (error.code === "PGRST116") {
      return 0;
    }
    console.error("[RateLimiter] DB 조회 오류:", error);
    return 0;
  }

  return data?.call_count ?? 0;
}

/**
 * DB에 API 호출 횟수 증가
 */
async function incrementApiCallCountInDB(apiName: string): Promise<number> {
  const supabase = getSupabaseClient();
  const today = getTodayString();

  // UPSERT 사용: 있으면 증가, 없으면 생성
  const { data, error } = await supabase.rpc("increment_api_call_count", {
    p_api_name: apiName,
    p_date: today,
  });

  if (error) {
    console.error("[RateLimiter] DB 증가 오류:", error);
    throw error;
  }

  return data ?? 0;
}

// ============================================
// Rate Limiter Functions
// ============================================

/**
 * API 호출 전 제한 확인
 *
 * @param apiName - API 이름 (odsay, tmap 등)
 * @throws RateLimitError - 일일 제한 초과 시
 *
 * @example
 * ```ts
 * await checkRateLimit("odsay"); // 제한 초과 시 에러 발생
 * // API 호출 진행
 * ```
 */
export async function checkRateLimit(apiName: string): Promise<void> {
  const limit = API_DAILY_LIMITS[apiName];

  if (!limit) {
    // 제한 설정이 없으면 통과
    return;
  }

  const cacheKey = getCacheKey(apiName);
  const cached = callCache.get(cacheKey);
  const today = getTodayString();

  // 캐시가 유효하고 1분 이내면 캐시 사용
  if (cached && cached.date === today && Date.now() - cached.lastUpdated < 60000) {
    if (cached.count >= limit) {
      throw new RateLimitError(apiName, cached.count, limit);
    }
    return;
  }

  // DB에서 조회
  const currentCount = await getApiCallCountFromDB(apiName);

  // 캐시 업데이트
  callCache.set(cacheKey, {
    count: currentCount,
    date: today,
    lastUpdated: Date.now(),
  });

  if (currentCount >= limit) {
    throw new RateLimitError(apiName, currentCount, limit);
  }
}

/**
 * API 호출 성공 후 카운트 증가
 *
 * @param apiName - API 이름
 * @returns 증가 후 현재 카운트
 *
 * @example
 * ```ts
 * await checkRateLimit("odsay");
 * const result = await callODsayApi(...);
 * await incrementApiCallCount("odsay");
 * ```
 */
export async function incrementApiCallCount(apiName: string): Promise<number> {
  const cacheKey = getCacheKey(apiName);
  const today = getTodayString();

  try {
    const newCount = await incrementApiCallCountInDB(apiName);

    // 캐시 업데이트
    callCache.set(cacheKey, {
      count: newCount,
      date: today,
      lastUpdated: Date.now(),
    });

    // Rate limit 로깅
    const limit = API_DAILY_LIMITS[apiName] || 0;
    const remaining = Math.max(0, limit - newCount);
    logRateLimit(apiName, newCount, limit, remaining);

    return newCount;
  } catch (error) {
    // DB 오류 시 캐시만 증가
    const cached = callCache.get(cacheKey);
    if (cached && cached.date === today) {
      cached.count++;
      cached.lastUpdated = Date.now();

      // Rate limit 로깅
      const limit = API_DAILY_LIMITS[apiName] || 0;
      const remaining = Math.max(0, limit - cached.count);
      logRateLimit(apiName, cached.count, limit, remaining);

      return cached.count;
    }

    // 새 캐시 생성
    callCache.set(cacheKey, {
      count: 1,
      date: today,
      lastUpdated: Date.now(),
    });
    return 1;
  }
}

/**
 * 현재 API 호출 횟수 조회
 *
 * @param apiName - API 이름
 * @returns 현재 호출 횟수
 */
export async function getApiCallCount(apiName: string): Promise<number> {
  const cacheKey = getCacheKey(apiName);
  const cached = callCache.get(cacheKey);
  const today = getTodayString();

  // 캐시가 유효하면 캐시 반환
  if (cached && cached.date === today) {
    return cached.count;
  }

  // DB에서 조회
  const count = await getApiCallCountFromDB(apiName);

  // 캐시 업데이트
  callCache.set(cacheKey, {
    count,
    date: today,
    lastUpdated: Date.now(),
  });

  return count;
}

/**
 * API 호출 남은 횟수 조회
 *
 * @param apiName - API 이름
 * @returns 남은 호출 횟수
 */
export async function getRemainingApiCalls(apiName: string): Promise<number> {
  const limit = API_DAILY_LIMITS[apiName];
  if (!limit) return Infinity;

  const currentCount = await getApiCallCount(apiName);
  return Math.max(0, limit - currentCount);
}

/**
 * Rate limit을 적용한 API 호출 래퍼
 *
 * @param apiName - API 이름
 * @param apiCall - 실제 API 호출 함수
 * @returns API 호출 결과
 *
 * @example
 * ```ts
 * const result = await withRateLimit("odsay", () =>
 *   searchTransitRoute(options)
 * );
 * ```
 */
export async function withRateLimit<T>(
  apiName: string,
  apiCall: () => Promise<T>
): Promise<T> {
  await checkRateLimit(apiName);

  const result = await apiCall();

  // 호출 성공 시 카운트 증가 (비동기로 처리)
  incrementApiCallCount(apiName).catch((err) => {
    console.error("[RateLimiter] 카운트 증가 실패:", err);
  });

  return result;
}
