"use server";

import { auth } from "@clerk/nextjs/server";
import { nearbyPlacesSchema, type NearbyPlacesInput } from "@/lib/schemas";
import type { PlaceSearchResult, PlaceCategory } from "@/types";
import {
  type KakaoCategorySearchResponse,
  type KakaoCategoryCode,
  convertKakaoPlaceToSearchResult,
} from "@/types/kakao";

/**
 * 주변 장소 검색 결과
 */
export interface GetNearbyResult {
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
 * PlaceCategory를 Kakao 카테고리 코드로 변환
 */
function convertToKakaoCategory(
  category: PlaceCategory
): KakaoCategoryCode | null {
  const categoryMap: Record<PlaceCategory, KakaoCategoryCode | null> = {
    tourist_attraction: "AT4", // 관광명소
    restaurant: "FD6", // 음식점
    cafe: "CE7", // 카페
    shopping: "MT1", // 대형마트 (쇼핑 대표)
    accommodation: "AD5", // 숙박
    entertainment: "CT1", // 문화시설
    culture: "CT1", // 문화시설
    nature: "AT4", // 관광명소 (자연 포함)
    other: null, // 기타는 카테고리 없이 검색
  };
  return categoryMap[category];
}

/**
 * 주변 장소 추천 Server Action (Kakao 카테고리 검색)
 *
 * 특정 좌표 주변의 장소를 카테고리별로 검색합니다.
 *
 * @param input - 검색 조건
 * @returns 검색 결과 목록 또는 에러
 *
 * @example
 * ```tsx
 * const result = await getNearby({
 *   lat: 37.5796,
 *   lng: 126.9770,
 *   category: "restaurant",
 *   radius: 500, // 500m
 * });
 * ```
 */
export async function getNearby(
  input: NearbyPlacesInput
): Promise<GetNearbyResult> {
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
    const validationResult = nearbyPlacesSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { lat, lng, category, radius, page, size } = validationResult.data;

    // 4. 카테고리 변환
    const kakaoCategory = category
      ? convertToKakaoCategory(category)
      : null;

    // 카테고리가 없으면 기본적으로 음식점 + 카페 + 관광명소를 순차 검색
    // 여기서는 단일 카테고리만 지원하고, 프론트엔드에서 여러 카테고리 호출
    if (!kakaoCategory && category) {
      return {
        success: false,
        error: "지원하지 않는 카테고리입니다.",
      };
    }

    // 5. Kakao API 요청 URL 구성
    // 카테고리가 없으면 키워드 검색 대신 에러 반환
    if (!kakaoCategory) {
      return {
        success: false,
        error: "카테고리를 선택해주세요.",
      };
    }

    const params = new URLSearchParams({
      category_group_code: kakaoCategory,
      x: String(lng), // 경도
      y: String(lat), // 위도
      radius: String(radius),
      page: String(page),
      size: String(size),
      sort: "distance", // 거리순 정렬
    });

    const url = `https://dapi.kakao.com/v2/local/search/category.json?${params.toString()}`;

    // 6. Kakao API 호출
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
      next: {
        revalidate: 300, // 5분 캐시 (주변 정보는 자주 변하지 않음)
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
        error: "주변 검색에 실패했습니다.",
      };
    }

    const data: KakaoCategorySearchResponse = await response.json();

    // 7. 결과 변환
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
    console.error("주변 장소 검색 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 여러 카테고리의 주변 장소 일괄 검색
 *
 * @param lat - 위도
 * @param lng - 경도
 * @param radius - 검색 반경 (미터)
 * @param categories - 검색할 카테고리 배열
 * @returns 카테고리별 검색 결과
 */
export async function getNearbyMultiCategory(
  lat: number,
  lng: number,
  radius: number = 500,
  categories: PlaceCategory[] = ["restaurant", "cafe", "tourist_attraction"]
): Promise<{
  success: boolean;
  data?: Record<PlaceCategory, PlaceSearchResult[]>;
  error?: string;
}> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }

    // 2. 병렬로 각 카테고리 검색
    const results = await Promise.all(
      categories.map((category) =>
        getNearby({
          lat,
          lng,
          radius,
          category,
          page: 1,
          size: 5, // 카테고리당 5개씩
        })
      )
    );

    // 3. 결과 매핑
    const data: Record<PlaceCategory, PlaceSearchResult[]> = {} as Record<
      PlaceCategory,
      PlaceSearchResult[]
    >;

    categories.forEach((category, index) => {
      const result = results[index];
      data[category] = result.success ? result.data?.places ?? [] : [];
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("다중 카테고리 주변 검색 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}
