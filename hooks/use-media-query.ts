"use client";

import * as React from "react";

/**
 * 미디어 쿼리 훅
 *
 * 지정된 미디어 쿼리의 매칭 여부를 반환합니다.
 * SSR 환경에서는 false를 반환하며, 클라이언트에서 hydration 후 실제 값을 반환합니다.
 *
 * @param query - CSS 미디어 쿼리 문자열
 * @returns 미디어 쿼리 매칭 여부
 *
 * @example
 * ```tsx
 * // 데스크톱 감지
 * const isDesktop = useMediaQuery("(min-width: 768px)");
 *
 * // 다크 모드 선호 감지
 * const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
 *
 * // 모바일 감지
 * const isMobile = useMediaQuery("(max-width: 639px)");
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    // 초기값 설정
    setMatches(mediaQuery.matches);

    // 변경 감지 핸들러
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // 이벤트 리스너 등록
    mediaQuery.addEventListener("change", handleChange);

    // 클린업
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

/**
 * 모바일 여부 감지 훅
 *
 * @returns 모바일 기기 여부 (639px 이하)
 */
export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 640px)");
}

/**
 * 데스크톱 여부 감지 훅
 *
 * @returns 데스크톱 여부 (768px 이상)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}

/**
 * 터치 디바이스 여부 감지 훅
 *
 * @returns 터치 디바이스 여부
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    setIsTouch(
      "ontouchstart" in window ||
        navigator.maxTouchPoints > 0
    );
  }, []);

  return isTouch;
}

/**
 * Reduced Motion 선호 감지 훅
 *
 * @returns 움직임 축소 선호 여부
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
