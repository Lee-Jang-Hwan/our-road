"use server";

import { auth } from "@clerk/nextjs/server";
import { searchPlacesSchema, type SearchPlacesInput } from "@/lib/schemas";
import type { PlaceSearchResult } from "@/types";
import {
  type KakaoKeywordSearchResponse,
  convertKakaoPlaceToSearchResult,
} from "@/types/kakao";
import { searchByAddress, type AddressSearchResult } from "@/lib/api/kakao";

/**
 * 통합 검색 결과 타입
 */
export type LocationSearchResult = PlaceSearchResult & {
  resultType: "place" | "address";
  addressInfo?: {
    roadAddress?: string;
    jibunAddress?: string;
    zoneNo?: string;
  };
};

/**
 * 위치 검색 결과
 */
export interface SearchLocationsResult {
  success: boolean;
  data?: {
    locations: LocationSearchResult[];
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
 * AddressSearchResult를 LocationSearchResult로 변환
 */
function convertAddressToLocationResult(
  address: AddressSearchResult
): LocationSearchResult {
  return {
    id: `addr_${address.coordinate.lng}_${address.coordinate.lat}`,
    name: address.roadAddress?.addressName || address.addressName,
    category: "주소",
    address: address.addressName,
    roadAddress:
      address.roadAddress?.addressName || address.addressName,
    coordinate: address.coordinate,
    resultType: "address",
    addressInfo: {
      roadAddress: address.roadAddress?.addressName,
      jibunAddress: address.address?.addressName,
      zoneNo: address.roadAddress?.zoneNo,
    },
  };
}

/**
 * 통합 위치 검색 Server Action (장소 + 주소)
 *
 * Kakao 키워드 검색 API와 주소 검색 API를 동시에 사용하여
 * 장소와 주소를 모두 검색합니다.
 *
 * @param input - 검색 조건
 * @returns 검색 결과 목록 (장소 + 주소) 또는 에러
 *
 * @example
 * ```tsx
 * const result = await searchLocations({
 *   query: "서울시 강남구 테헤란로 152",
 *   page: 1,
 *   size: 15,
 * });
 * ```
 */
export async function searchLocations(
  input: SearchPlacesInput
): Promise<SearchLocationsResult> {
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

    // 4. 키워드 검색과 주소 검색을 병렬로 실행
    const [keywordResponse, addressResponse] = await Promise.allSettled([
      // 키워드 검색
      (async () => {
        const params = new URLSearchParams({
          query,
          page: String(page),
          size: String(size),
        });

        if (x !== undefined && y !== undefined) {
          params.append("x", String(x));
          params.append("y", String(y));
          if (radius !== undefined) {
            params.append("radius", String(radius));
          }
        }

        const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
          },
          next: {
            revalidate: 60,
          },
        });

        if (!response.ok) {
          throw new Error(`Keyword search failed: ${response.status}`);
        }

        return response.json() as Promise<KakaoKeywordSearchResponse>;
      })(),

      // 주소 검색
      searchByAddress({
        query,
        page,
        size: Math.min(5, size), // 주소 검색은 최대 5개만
      }),
    ]);

    // 5. 결과 병합
    const locations: LocationSearchResult[] = [];

    // 키워드 검색 결과 추가
    if (keywordResponse.status === "fulfilled") {
      const keywordData = keywordResponse.value;
      const places = keywordData.documents.map((doc) => ({
        ...convertKakaoPlaceToSearchResult(doc),
        resultType: "place" as const,
      }));
      locations.push(...places);
    } else {
      console.warn("키워드 검색 실패:", keywordResponse.reason);
    }

    // 주소 검색 결과 추가
    if (addressResponse.status === "fulfilled") {
      const addressData = addressResponse.value;
      const addresses = addressData.results.map(convertAddressToLocationResult);
      locations.push(...addresses);
    } else {
      console.warn("주소 검색 실패:", addressResponse.reason);
    }

    // 6. 둘 다 실패한 경우 에러 반환
    if (locations.length === 0) {
      return {
        success: false,
        error: "검색 결과가 없습니다.",
      };
    }

    // 7. 메타 정보 계산
    const keywordMeta =
      keywordResponse.status === "fulfilled"
        ? keywordResponse.value.meta
        : { total_count: 0, pageable_count: 0, is_end: true };

    const addressMeta =
      addressResponse.status === "fulfilled"
        ? addressResponse.value.meta
        : { totalCount: 0, pageableCount: 0, isEnd: true };

    return {
      success: true,
      data: {
        locations,
        meta: {
          totalCount: keywordMeta.total_count + addressMeta.totalCount,
          pageableCount:
            keywordMeta.pageable_count + addressMeta.pageableCount,
          isEnd: keywordMeta.is_end && addressMeta.isEnd,
          currentPage: page,
        },
      },
    };
  } catch (error) {
    console.error("위치 검색 중 예외 발생:", error);
    return {
      success: false,
      error: "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 위치 자동완성 검색 (디바운스와 함께 사용)
 *
 * searchLocations와 동일하지만 더 적은 결과를 반환합니다.
 *
 * @param query - 검색어
 * @param centerLat - 중심 위도 (선택)
 * @param centerLng - 중심 경도 (선택)
 * @returns 검색 결과 목록 또는 에러
 */
export async function autocompleteLocation(
  query: string,
  centerLat?: number,
  centerLng?: number
): Promise<SearchLocationsResult> {
  return searchLocations({
    query,
    x: centerLng,
    y: centerLat,
    page: 1,
    size: 10, // 자동완성은 장소 10개 + 주소 5개
  });
}
