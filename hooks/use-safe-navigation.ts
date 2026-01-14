"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * 안전한 네비게이션 Hook
 *
 * 중복 클릭을 방지하고 네비게이션 상태를 관리합니다.
 * useTransition을 사용하여 네비게이션을 처리하고,
 * 네비게이션 중에는 버튼을 비활성화합니다.
 *
 * @returns { navigate, isNavigating, isNavigatingTo } 객체
 * - navigate: 안전한 네비게이션 함수
 * - isNavigating: 네비게이션 중인지 여부
 * - isNavigatingTo: 특정 경로로 네비게이션 중인지 확인하는 함수
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   const { navigate, isNavigating, isNavigatingTo } = useSafeNavigation();
 *
 *   return (
 *     <div>
 *       <button
 *         onClick={() => navigate('/plan')}
 *         disabled={isNavigating}
 *       >
 *         {isNavigatingTo('/plan') ? '이동 중...' : '새 여행'}
 *       </button>
 *
 *       <button
 *         onClick={() => navigate(`/my/trips/${tripId}`)}
 *         disabled={isNavigating}
 *       >
 *         상세 보기
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSafeNavigation() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const navigate = useCallback(
    (path: string) => {
      // 이미 네비게이션 중이면 무시
      if (isPending || navigatingTo !== null) {
        return;
      }

      setNavigatingTo(path);
      startTransition(() => {
        router.push(path);
        // 페이지가 변경되면 컴포넌트가 언마운트되므로
        // 상태 초기화는 자동으로 처리됨
        // 네비게이션이 실패할 경우를 대비해 일정 시간 후 초기화
        setTimeout(() => {
          setNavigatingTo(null);
        }, 2000);
      });
    },
    [router, isPending, navigatingTo]
  );

  const isNavigatingTo = useCallback(
    (path: string) => {
      return navigatingTo === path;
    },
    [navigatingTo]
  );

  return {
    navigate,
    isNavigating: isPending || navigatingTo !== null,
    isNavigatingTo,
  };
}
