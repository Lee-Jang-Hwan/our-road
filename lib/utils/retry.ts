// ============================================
// Retry Utility (재시도 유틸리티)
// ============================================

/**
 * 재시도 설정 옵션
 */
export interface RetryOptions {
  /** 최대 재시도 횟수 (기본: 3) */
  maxRetries?: number;
  /** 기본 대기 시간 (ms, 기본: 1000) */
  baseDelay?: number;
  /** 최대 대기 시간 (ms, 기본: 10000) */
  maxDelay?: number;
  /** 지터 추가 여부 (기본: true) */
  jitter?: boolean;
  /** 재시도할 에러 판별 함수 */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** 재시도 전 콜백 */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * 기본 재시도 설정
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, "onRetry">> & {
  onRetry?: RetryOptions["onRetry"];
} = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  jitter: true,
  shouldRetry: () => true,
  onRetry: undefined,
};

/**
 * 지수 백오프 지연 시간 계산
 *
 * @param attempt - 현재 시도 횟수 (0부터 시작)
 * @param baseDelay - 기본 대기 시간 (ms)
 * @param maxDelay - 최대 대기 시간 (ms)
 * @param jitter - 지터 추가 여부
 * @returns 대기 시간 (ms)
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 10000,
  jitter: boolean = true
): number {
  // 지수 백오프: delay = baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // 지터 추가 (0~1초 랜덤)
  const jitterAmount = jitter ? Math.random() * 1000 : 0;

  // 최대 지연 시간 제한
  return Math.min(exponentialDelay + jitterAmount, maxDelay);
}

/**
 * 지연 함수
 *
 * @param ms - 대기 시간 (ms)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 재시도 래퍼 함수
 *
 * 지수 백오프를 사용하여 실패 시 자동으로 재시도합니다.
 *
 * @param fn - 실행할 비동기 함수
 * @param options - 재시도 옵션
 * @returns 함수 실행 결과
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   {
 *     maxRetries: 3,
 *     baseDelay: 1000,
 *     shouldRetry: (error) => error.message.includes('timeout'),
 *     onRetry: (error, attempt) => console.log(`Retry ${attempt}:`, error),
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 마지막 시도였거나, 재시도하면 안 되는 에러인 경우
      if (
        attempt >= config.maxRetries ||
        !config.shouldRetry(lastError, attempt)
      ) {
        throw lastError;
      }

      // 대기 시간 계산
      const waitTime = calculateBackoffDelay(
        attempt,
        config.baseDelay,
        config.maxDelay,
        config.jitter
      );

      // 재시도 콜백 호출
      config.onRetry?.(lastError, attempt + 1, waitTime);

      // 대기
      await delay(waitTime);
    }
  }

  // 여기에 도달하면 안 되지만, 타입 안전성을 위해
  throw lastError || new Error("Unknown retry error");
}

/**
 * HTTP 상태 코드 기반 재시도 판별 함수 생성
 *
 * @param retryableStatuses - 재시도할 상태 코드 배열
 * @returns shouldRetry 함수
 */
export function createHttpRetryChecker(
  retryableStatuses: number[] = [429, 500, 502, 503, 504]
): (error: Error) => boolean {
  return (error: Error) => {
    // fetch 에러에서 상태 코드 추출 시도
    const statusMatch = error.message.match(/\b(\d{3})\b/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      return retryableStatuses.includes(status);
    }

    // 네트워크 에러는 재시도
    if (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("timeout")
    ) {
      return true;
    }

    return false;
  };
}

/**
 * 재시도 가능한 fetch 함수
 *
 * @param url - 요청 URL
 * @param init - fetch 옵션
 * @param retryOptions - 재시도 옵션
 * @returns Response
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(url, init);

      // 4xx, 5xx 에러를 throw하여 재시도 로직으로 전달
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    },
    {
      shouldRetry: createHttpRetryChecker(),
      ...retryOptions,
    }
  );
}

/**
 * 병렬 작업을 배치로 나누어 실행 (rate limiting)
 *
 * @param items - 처리할 항목 배열
 * @param fn - 각 항목에 실행할 비동기 함수
 * @param batchSize - 동시 실행 개수 (기본: 5)
 * @param delayBetweenBatches - 배치 간 대기 시간 (ms, 기본: 500)
 * @returns 결과 배열
 */
export async function batchProcess<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  batchSize: number = 5,
  delayBetweenBatches: number = 500
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, idx) => fn(item, i + idx))
    );
    results.push(...batchResults);

    // 마지막 배치가 아니면 대기
    if (i + batchSize < items.length) {
      await delay(delayBetweenBatches);
    }
  }

  return results;
}

/**
 * 에러 발생 시 null 반환하는 래퍼
 *
 * @param fn - 실행할 비동기 함수
 * @returns 결과 또는 null
 */
export async function tryOrNull<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/**
 * 에러 발생 시 기본값 반환하는 래퍼
 *
 * @param fn - 실행할 비동기 함수
 * @param defaultValue - 에러 시 반환할 기본값
 * @returns 결과 또는 기본값
 */
export async function tryOrDefault<T>(
  fn: () => Promise<T>,
  defaultValue: T
): Promise<T> {
  try {
    return await fn();
  } catch {
    return defaultValue;
  }
}
