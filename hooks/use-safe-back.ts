import { useRouter } from "next/navigation";

/**
 * 안전한 뒤로가기 Hook
 *
 * 브라우저 히스토리가 있으면 router.back()을 실행하고,
 * 히스토리가 없으면 지정된 fallback 경로로 이동합니다.
 *
 * @param fallbackPath - 히스토리가 없을 때 이동할 경로 (기본값: '/')
 * @returns 뒤로가기 핸들러 함수
 *
 * @example
 * ```tsx
 * const handleBack = useSafeBack('/my');
 * <Button onClick={handleBack}>뒤로가기</Button>
 * ```
 */
export function useSafeBack(fallbackPath: string = "/") {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackPath);
    }
  };

  return handleBack;
}
