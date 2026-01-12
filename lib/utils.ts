import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================
// 구간별 색상 팔레트
// ============================================

/** 구간별 색상 배열 (최대 10개 구간 지원, 순환) */
export const SEGMENT_COLORS = [
  "#ef4444", // red-500 (1번째 구간)
  "#22c55e", // green-500 (2번째 구간)
  "#eab308", // yellow-500 (3번째 구간)
  "#3b82f6", // blue-500   (4번째 구간)  
  "#f97316", // orange-500 (5번째 구간)
  "#14b8a6", // teal-500 (6번째 구간)
  "#ec4899", // pink-500 (7번째 구간)
  "#06b6d4", // cyan-500 (8번째 구간)
  "#6366f1", // indigo-500 (9번째 구간)
  "#8b5cf6", // violet-500 (10번째 구간)
  
] as const;

/**
 * 구간 인덱스에 해당하는 색상 반환
 * @param index 구간 인덱스 (0부터 시작)
 * @returns 색상 hex 코드
 */
export function getSegmentColor(index: number): string {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
}
