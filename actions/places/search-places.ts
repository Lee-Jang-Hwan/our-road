"use server";

import { auth } from "@clerk/nextjs/server";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";
import type { PlaceSearchResult } from "@/types";
import {
  type KakaoKeywordSearchResponse,
  convertKakaoPlaceToSearchResult,
} from "@/types/kakao";

/**
 * 장소 검색 결과
 */
export interface SearchPlacesResult {
  success: boolean;
  data?: {
    places: PlaceSearchResult[];
    meta: {
      totalCount: number;
      pageableCount: number;
      isEnd: boolean;
      currentPage: number;
    };
  };
  error?: string;
}

/**
 * Kakao REST API Key
 */
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

/**
 * 장소 검색 Server Action (Kakao Local API)
 *
 * Kakao 키워드 검색 API를 사용하여 장소를 검색합니다.
 *
 * @param input - 검색 조건
 * @returns 검색 결과 목록 또는 에러
 *
 * @example
 * ```tsx
 * const result = await searchPlaces({
 *   query: "경복궁",
 *   page: 1,
 *   size: 15,
 * });
 * ```
 */
export async function searchPlaces(
  input: SearchPlacesInput
): Promise<SearchPlacesResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. API 키 확인
    if (!KAKAO_REST_API_KEY) {
      console.error("KAKAO_REST_API_KEY가 설정되지 않았습니다.");
      return {
        success: false,
        error: "검색 서비스가 준비되지 않았습니다.",
      };
    }

    // 3. Zod 스키마 검증
    const validationResult = searchPlacesSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { query, x, y, radius, page, size } = validationResult.data;

    // 4. Kakao API 요청 URL 구성
    const params = new URLSearchParams({
      query,
      page: String(page),
      size: String(size),
    });

    // 중심 좌표가 있으면 추가 (x = 경도, y = 위도)
    if (x !== undefined && y !== undefined) {
      params.append("x", String(x));
      params.append("y", String(y));
      if (radius !== undefined) {
        params.append("radius", String(radius));
      }
    }

    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`;

    // 5. Kakao API 호출
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
      next: {
        revalidate: 60, // 1분 캐시
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Kakao API 오류:", response.status, errorText);

      if (response.status === 401) {
        return {
          success: false,
          error: "API 인증에 실패했습니다.",
        };
      }
      if (response.status === 429) {
        return {
          success: false,
          error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        };
      }

      return {
        success: false,
        error: "검색에 실패했습니다.",
      };
    }

    const data: KakaoKeywordSearchResponse = await response.json();

    // 6. 결과 변환
    const places = data.documents.map(convertKakaoPlaceToSearchResult);

    return {
      success: true,
      data: {
        places,
        meta: {
          totalCount: data.meta.total_count,
          pageableCount: data.meta.pageable_count,
          isEnd: data.meta.is_end,
          currentPage: page,
        },
      },
    };
  } catch (error) {
    console.error("장소 검색 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 장소 자동완성 검색 (디바운스와 함께 사용)
 *
 * searchPlaces와 동일하지만 더 적은 결과를 반환합니다.
 *
 * @param query - 검색어
 * @param centerLat - 중심 위도 (선택)
 * @param centerLng - 중심 경도 (선택)
 * @returns 검색 결과 목록 또는 에러
 */
export async function autocompletePlace(
  query: string,
  centerLat?: number,
  centerLng?: number
): Promise<SearchPlacesResult> {
  return searchPlaces({
    query,
    x: centerLng,
    y: centerLat,
    page: 1,
    size: 5, // 자동완성은 5개만
  });
}
