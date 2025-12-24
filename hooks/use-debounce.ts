"use client";

import * as React from "react";

/**
 * 디바운스된 값을 반환하는 훅
 *
 * 값이 변경된 후 지정된 지연 시간이 지나야 새 값을 반환합니다.
 * 연속적인 입력에서 마지막 값만 처리할 때 유용합니다.
 *
 * @param value - 디바운스할 값
 * @param delay - 지연 시간 (ms), 기본값 300ms
 * @returns 디바운스된 값
 *
 * @example
 * ```tsx
 * function SearchInput() {
 *   const [query, setQuery] = useState("");
 *   const debouncedQuery = useDebounce(query, 300);
 *
 *   useEffect(() => {
 *     if (debouncedQuery) {
 *       searchPlaces(debouncedQuery);
 *     }
 *   }, [debouncedQuery]);
 *
 *   return (
 *     <input
 *       value={query}
 *       onChange={(e) => setQuery(e.target.value)}
 *       placeholder="장소 검색..."
 *     />
 *   );
 * }
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 디바운스된 콜백 함수를 반환하는 훅
 *
 * 콜백이 호출된 후 지정된 지연 시간 동안 추가 호출이 없으면 실행됩니다.
 * 연속적인 이벤트에서 마지막 호출만 실행할 때 유용합니다.
 *
 * @param callback - 디바운스할 콜백 함수
 * @param delay - 지연 시간 (ms), 기본값 300ms
 * @returns 디바운스된 콜백 함수
 *
 * @example
 * ```tsx
 * function AutoSaveForm() {
 *   const [content, setContent] = useState("");
 *
 *   const debouncedSave = useDebouncedCallback(
 *     (value: string) => {
 *       saveToServer(value);
 *     },
 *     1000
 *   );
 *
 *   const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
 *     const value = e.target.value;
 *     setContent(value);
 *     debouncedSave(value);
 *   };
 *
 *   return <textarea value={content} onChange={handleChange} />;
 * }
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const callbackRef = React.useRef(callback);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 항상 최신 콜백을 참조
  React.useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 컴포넌트 언마운트 시 타이머 정리
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = React.useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  return debouncedCallback;
}

/**
 * 디바운스된 상태를 관리하는 훅
 *
 * 즉시 업데이트되는 값과 디바운스된 값을 함께 제공합니다.
 * 입력 필드에서 즉각적인 UI 반응과 지연된 API 호출을 동시에 처리할 때 유용합니다.
 *
 * @param initialValue - 초기값
 * @param delay - 지연 시간 (ms), 기본값 300ms
 * @returns [즉시값, 디바운스값, setter] 튜플
 *
 * @example
 * ```tsx
 * function SearchWithResults() {
 *   const [query, debouncedQuery, setQuery] = useDebouncedState("", 300);
 *   const [results, setResults] = useState([]);
 *
 *   useEffect(() => {
 *     if (debouncedQuery) {
 *       fetchResults(debouncedQuery).then(setResults);
 *     }
 *   }, [debouncedQuery]);
 *
 *   return (
 *     <div>
 *       <input
 *         value={query} // 즉시 반영
 *         onChange={(e) => setQuery(e.target.value)}
 *       />
 *       {query !== debouncedQuery && <span>검색 중...</span>}
 *       <ul>
 *         {results.map(r => <li key={r.id}>{r.name}</li>)}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300
): [T, T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = React.useState<T>(initialValue);
  const debouncedValue = useDebounce(value, delay);

  return [value, debouncedValue, setValue];
}

/**
 * 취소 가능한 디바운스 콜백 훅
 *
 * 디바운스된 콜백과 함께 즉시 실행 및 취소 기능을 제공합니다.
 *
 * @param callback - 디바운스할 콜백 함수
 * @param delay - 지연 시간 (ms), 기본값 300ms
 * @returns { debouncedFn, cancel, flush } 객체
 *
 * @example
 * ```tsx
 * function SearchWithCancel() {
 *   const { debouncedFn: search, cancel, flush } = useDebouncedCallbackWithControl(
 *     (query: string) => fetchResults(query),
 *     500
 *   );
 *
 *   return (
 *     <div>
 *       <input onChange={(e) => search(e.target.value)} />
 *       <button onClick={cancel}>취소</button>
 *       <button onClick={flush}>즉시 검색</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDebouncedCallbackWithControl<
  T extends (...args: unknown[]) => unknown
>(
  callback: T,
  delay: number = 300
): {
  debouncedFn: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
  isPending: boolean;
} {
  const callbackRef = React.useRef(callback);
  const argsRef = React.useRef<Parameters<T> | undefined>(undefined);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [isPending, setIsPending] = React.useState(false);

  // 항상 최신 콜백을 참조
  React.useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 컴포넌트 언마운트 시 타이머 정리
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const cancel = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
      setIsPending(false);
    }
  }, []);

  const flush = React.useCallback(() => {
    if (timeoutRef.current && argsRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
      callbackRef.current(...argsRef.current);
      setIsPending(false);
    }
  }, []);

  const debouncedFn = React.useCallback(
    (...args: Parameters<T>) => {
      argsRef.current = args;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setIsPending(true);

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        timeoutRef.current = undefined;
        setIsPending(false);
      }, delay);
    },
    [delay]
  );

  return { debouncedFn, cancel, flush, isPending };
}

/**
 * 스로틀된 값을 반환하는 훅
 *
 * 지정된 간격 내에서 첫 번째 값만 반환합니다.
 * 연속적인 이벤트에서 일정 간격으로 처리할 때 유용합니다.
 *
 * @param value - 스로틀할 값
 * @param interval - 간격 (ms), 기본값 300ms
 * @returns 스로틀된 값
 *
 * @example
 * ```tsx
 * function ScrollTracker() {
 *   const [scrollY, setScrollY] = useState(0);
 *   const throttledScrollY = useThrottle(scrollY, 100);
 *
 *   useEffect(() => {
 *     const handleScroll = () => setScrollY(window.scrollY);
 *     window.addEventListener("scroll", handleScroll);
 *     return () => window.removeEventListener("scroll", handleScroll);
 *   }, []);
 *
 *   useEffect(() => {
 *     // 100ms마다 한 번씩만 실행
 *     trackScrollPosition(throttledScrollY);
 *   }, [throttledScrollY]);
 *
 *   return <div>Scroll: {throttledScrollY}px</div>;
 * }
 * ```
 */
export function useThrottle<T>(value: T, interval: number = 300): T {
  const [throttledValue, setThrottledValue] = React.useState<T>(value);
  const lastUpdated = React.useRef<number>(Date.now());

  React.useEffect(() => {
    const now = Date.now();

    if (now - lastUpdated.current >= interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - lastUpdated.current));

      return () => clearTimeout(timer);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * 스로틀된 콜백 함수를 반환하는 훅
 *
 * 지정된 간격 내에서 첫 번째 호출만 실행됩니다.
 *
 * @param callback - 스로틀할 콜백 함수
 * @param interval - 간격 (ms), 기본값 300ms
 * @returns 스로틀된 콜백 함수
 *
 * @example
 * ```tsx
 * function ResizeHandler() {
 *   const throttledResize = useThrottledCallback(
 *     (width: number, height: number) => {
 *       updateLayout(width, height);
 *     },
 *     200
 *   );
 *
 *   useEffect(() => {
 *     const handleResize = () => {
 *       throttledResize(window.innerWidth, window.innerHeight);
 *     };
 *     window.addEventListener("resize", handleResize);
 *     return () => window.removeEventListener("resize", handleResize);
 *   }, [throttledResize]);
 *
 *   return <div>Resize me!</div>;
 * }
 * ```
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number = 300
): (...args: Parameters<T>) => void {
  const callbackRef = React.useRef(callback);
  const lastCalledRef = React.useRef<number>(0);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 항상 최신 콜백을 참조
  React.useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 컴포넌트 언마운트 시 타이머 정리
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const throttledCallback = React.useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCalledRef.current;

      if (timeSinceLastCall >= interval) {
        lastCalledRef.current = now;
        callbackRef.current(...args);
      } else {
        // 마지막 호출 예약 (trailing)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          lastCalledRef.current = Date.now();
          callbackRef.current(...args);
        }, interval - timeSinceLastCall);
      }
    },
    [interval]
  );

  return throttledCallback;
}
