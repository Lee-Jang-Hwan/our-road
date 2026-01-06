// ============================================
// API Logger Utility
// ============================================

/**
 * API 호출 로거
 * - 서버/클라이언트 모두에서 작동
 * - 브라우저 콘솔에서 색상으로 구분
 */

export type LogLevel = "info" | "success" | "warning" | "error";

interface ApiLogData {
  api: string;
  method?: string;
  url?: string;
  params?: Record<string, unknown>;
  duration?: number;
  status?: number;
  error?: unknown;
}

/**
 * API 호출 시작 로그
 */
export function logApiStart(api: string, data?: Partial<ApiLogData>): number {
  const startTime = Date.now();

  if (typeof window !== "undefined") {
    // 클라이언트 사이드 - 브라우저 콘솔
    console.log(
      `%c[API START] ${api}`,
      "color: #0066CC; font-weight: bold;",
      data
    );
  } else {
    // 서버 사이드
    console.log(`[API START] ${api}`, data);
  }

  return startTime;
}

/**
 * API 호출 성공 로그
 */
export function logApiSuccess(
  api: string,
  startTime: number,
  data?: Partial<ApiLogData>
): void {
  const duration = Date.now() - startTime;

  if (typeof window !== "undefined") {
    // 클라이언트 사이드
    console.log(
      `%c[API SUCCESS] ${api} (${duration}ms)`,
      "color: #00AA00; font-weight: bold;",
      data
    );
  } else {
    // 서버 사이드
    console.log(`[API SUCCESS] ${api} (${duration}ms)`, data);
  }
}

/**
 * API 호출 실패 로그
 */
export function logApiError(
  api: string,
  startTime: number,
  error: unknown,
  data?: Partial<ApiLogData>
): void {
  const duration = Date.now() - startTime;

  if (typeof window !== "undefined") {
    // 클라이언트 사이드
    console.error(
      `%c[API ERROR] ${api} (${duration}ms)`,
      "color: #CC0000; font-weight: bold;",
      error,
      data
    );
  } else {
    // 서버 사이드
    console.error(`[API ERROR] ${api} (${duration}ms)`, error, data);
  }
}

/**
 * API 호출 경고 로그
 */
export function logApiWarning(
  api: string,
  message: string,
  data?: Partial<ApiLogData>
): void {
  if (typeof window !== "undefined") {
    // 클라이언트 사이드
    console.warn(
      `%c[API WARNING] ${api}`,
      "color: #FF8800; font-weight: bold;",
      message,
      data
    );
  } else {
    // 서버 사이드
    console.warn(`[API WARNING] ${api}`, message, data);
  }
}

/**
 * Rate Limit 로그
 */
export function logRateLimit(
  api: string,
  used: number,
  limit: number,
  remaining: number
): void {
  const percentage = ((used / limit) * 100).toFixed(1);
  const color = used / limit > 0.8 ? "#CC0000" : used / limit > 0.5 ? "#FF8800" : "#00AA00";

  if (typeof window !== "undefined") {
    // 클라이언트 사이드
    console.log(
      `%c[RATE LIMIT] ${api}: ${used}/${limit} (${percentage}%, ${remaining} remaining)`,
      `color: ${color}; font-weight: bold;`
    );
  } else {
    // 서버 사이드
    console.log(`[RATE LIMIT] ${api}: ${used}/${limit} (${percentage}%, ${remaining} remaining)`);
  }
}

/**
 * Circuit Breaker 로그
 */
export function logCircuitBreaker(
  state: "CLOSED" | "OPEN" | "HALF_OPEN",
  failureCount: number,
  message?: string
): void {
  const color = state === "OPEN" ? "#CC0000" : state === "HALF_OPEN" ? "#FF8800" : "#00AA00";

  if (typeof window !== "undefined") {
    // 클라이언트 사이드
    console.log(
      `%c[CIRCUIT BREAKER] ${state} (failures: ${failureCount})`,
      `color: ${color}; font-weight: bold;`,
      message
    );
  } else {
    // 서버 사이드
    console.log(`[CIRCUIT BREAKER] ${state} (failures: ${failureCount})`, message);
  }
}

/**
 * API 통계 요약 로그
 */
export function logApiStats(stats: {
  api: string;
  totalCalls: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
}): void {
  const successRate = ((stats.successCount / stats.totalCalls) * 100).toFixed(1);

  if (typeof window !== "undefined") {
    // 클라이언트 사이드
    console.log(
      `%c[API STATS] ${stats.api}`,
      "color: #6600CC; font-weight: bold;",
      {
        총호출: stats.totalCalls,
        성공률: `${successRate}%`,
        평균응답시간: `${stats.avgDuration}ms`,
      }
    );
  } else {
    // 서버 사이드
    console.log(`[API STATS] ${stats.api}`, {
      총호출: stats.totalCalls,
      성공률: `${successRate}%`,
      평균응답시간: `${stats.avgDuration}ms`,
    });
  }
}
