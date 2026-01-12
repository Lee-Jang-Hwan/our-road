"use server";

import { auth } from "@clerk/nextjs/server";
import { carRouteSchema, type CarRouteInput } from "@/lib/schemas";
import type { CarRoute, Coordinate } from "@/types";

// ============================================
// Types
// ============================================

/**
 * 자동차 경로 조회 결과
 */
export interface GetCarRouteResult {
  success: boolean;
  data?: CarRoute;
  error?: {
    code: "ROUTE_NOT_FOUND" | "API_ERROR" | "INVALID_COORDINATES" | "TIMEOUT" | "AUTH_ERROR" | "VALIDATION_ERROR";
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================
// Configuration
// ============================================

const KAKAO_MOBILITY_KEY = process.env.KAKAO_MOBILITY_KEY;
const KAKAO_MOBILITY_BASE_URL = "https://apis-navi.kakaomobility.com/v1";

// ============================================
// Helper Functions
// ============================================

/**
 * 지수 백오프 지연 계산
 */
function calculateBackoffDelay(attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 10000;
  const delay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(delay + jitter, maxDelay);
}

/**
 * 지연 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 폴리라인 인코딩 (Google Polyline Algorithm)
 */
function encodePolyline(vertexes: number[]): string {
  if (vertexes.length < 2) return "";

  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (let i = 0; i < vertexes.length; i += 2) {
    const lng = vertexes[i];
    const lat = vertexes[i + 1];

    const dLat = Math.round((lat - prevLat) * 1e5);
    const dLng = Math.round((lng - prevLng) * 1e5);

    encoded += encodeNumber(dLat);
    encoded += encodeNumber(dLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

function encodeNumber(num: number): string {
  let sgnNum = num << 1;
  if (num < 0) {
    sgnNum = ~sgnNum;
  }

  let encoded = "";
  while (sgnNum >= 0x20) {
    encoded += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
    sgnNum >>= 5;
  }
  encoded += String.fromCharCode(sgnNum + 63);

  return encoded;
}

// ============================================
// Server Action
// ============================================

/**
 * 자동차 경로 조회 Server Action (Kakao Mobility API)
 *
 * 두 지점 간의 자동차 경로를 조회합니다.
 * **중요**: 자동차 경로로만 조회하며, 다른 수단으로 자동 전환하지 않습니다.
 * 경로가 없으면 ROUTE_NOT_FOUND 에러를 반환합니다.
 *
 * @param input - 경로 조회 조건
 * @returns 자동차 경로 정보 또는 에러
 *
 * @example
 * ```tsx
 * const result = await getCarRoute({
 *   origin: { lat: 37.5665, lng: 126.9780 },
 *   destination: { lat: 37.5796, lng: 126.9770 },
 *   priority: "TIME",
 * });
 * ```
 */
export async function getCarRoute(
  input: CarRouteInput
): Promise<GetCarRouteResult> {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "로그인이 필요합니다.",
        },
      };
    }

    // 2. API 키 확인
    if (!KAKAO_MOBILITY_KEY) {
      console.error("KAKAO_MOBILITY_KEY가 설정되지 않았습니다.");
      return {
        success: false,
        error: {
          code: "API_ERROR",
          message: "경로 조회 서비스가 준비되지 않았습니다.",
        },
      };
    }

    // 3. Zod 스키마 검증
    const validationResult = carRouteSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: errorMessage,
        },
      };
    }

    const { origin, destination, waypoints, priority, alternatives } =
      validationResult.data;

    // 4. Kakao Mobility API 요청 URL 구성
    const params = new URLSearchParams({
      origin: `${origin.lng},${origin.lat}`,
      destination: `${destination.lng},${destination.lat}`,
      priority: priority ?? "RECOMMEND",
      alternatives: String(alternatives ?? false),
    });

    // 경유지 추가
    if (waypoints && waypoints.length > 0) {
      const waypointsStr = waypoints
        .slice(0, 5)
        .map((wp: Coordinate) => `${wp.lng},${wp.lat}`)
        .join("|");
      params.append("waypoints", waypointsStr);
    }

    const url = `${KAKAO_MOBILITY_BASE_URL}/directions?${params.toString()}`;

    // 5. API 호출 (재시도 로직 포함)
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `KakaoAK ${KAKAO_MOBILITY_KEY}`,
            "Content-Type": "application/json",
          },
        });

        // 429 (Too Many Requests) - 재시도
        if (response.status === 429 && attempt < maxRetries) {
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = retryAfter
            ? parseInt(retryAfter) * 1000
            : calculateBackoffDelay(attempt);
          await delay(waitTime);
          continue;
        }

        // 5xx 에러 - 재시도
        if (response.status >= 500 && attempt < maxRetries) {
          await delay(calculateBackoffDelay(attempt));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Kakao Mobility API 오류:", response.status, errorText);

          if (response.status === 401) {
            return {
              success: false,
              error: {
                code: "API_ERROR",
                message: "API 인증에 실패했습니다.",
              },
            };
          }

          return {
            success: false,
            error: {
              code: "API_ERROR",
              message: "경로 조회에 실패했습니다.",
              details: { status: response.status },
            },
          };
        }

        const data = await response.json();

        // 개발 환경: API 응답 확인
        if (process.env.NODE_ENV === "development") {
          console.group("🚗 [Server Action] Kakao API 응답");
          console.log("출발지:", origin);
          console.log("도착지:", destination);
          console.log("API 응답:", JSON.stringify(data, null, 2));
          console.groupEnd();
        }

        // 경로가 없는 경우 - ROUTE_NOT_FOUND 반환 (다른 수단으로 전환하지 않음)
        if (!data.routes || data.routes.length === 0) {
          return {
            success: false,
            error: {
              code: "ROUTE_NOT_FOUND",
              message: "해당 경로를 찾을 수 없습니다. 출발지와 도착지를 확인해주세요.",
            },
          };
        }

        const route = data.routes[0];

        // 개발 환경: route.summary.fare 확인
        if (process.env.NODE_ENV === "development") {
          console.group("💰 [Server Action] 요금 정보");
          console.log("톨비:", route.summary.fare?.toll);
          console.log("택시 요금:", route.summary.fare?.taxi);
          console.log("fare 객체 전체:", JSON.stringify(route.summary.fare, null, 2));
          console.log("구간 수:", route.sections.length);
          console.groupEnd();
        }

        // 경로 탐색 실패
        if (route.result_code !== 0) {
          return {
            success: false,
            error: {
              code: "ROUTE_NOT_FOUND",
              message: route.result_msg || "경로를 찾을 수 없습니다.",
            },
          };
        }

        // 폴리라인 추출 및 구간별 정보 추출
        let polylinePoints: number[] = [];
        const segments: import("@/types/route").CarRouteSegment[] = [];
        const allGuides: import("@/types/route").RouteGuide[] = [];
        
        for (let sectionIndex = 0; sectionIndex < route.sections.length; sectionIndex++) {
          const section = route.sections[sectionIndex];
          
          // 구간별 폴리라인 추출
          let sectionPolylinePoints: number[] = [];
          for (const road of section.roads) {
            sectionPolylinePoints = sectionPolylinePoints.concat(road.vertexes);
            polylinePoints = polylinePoints.concat(road.vertexes);
          }
          
          // 구간별 통행료 추정 (거리 비율로 계산)
          const totalTollFare = route.summary.fare?.toll ?? 0;
          const segmentTollFare = route.summary.distance > 0
            ? Math.round((section.distance / route.summary.distance) * totalTollFare)
            : 0;
          
          // 구간 설명 생성
          let description: string | undefined;
          
          // 1. 주요 도로명 추출 (빈 문자열이 아닌 것만)
          const roadNames: string[] = section.roads
            .map(road => road.name)
            .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
          
          // 고유한 도로명만 사용 (중복 제거)
          const uniqueRoadNames = roadNames.length > 0 ? [...new Set(roadNames)] : [];
          
          if (uniqueRoadNames.length > 0) {
            if (uniqueRoadNames.length === 1) {
              description = uniqueRoadNames[0];
            } else if (uniqueRoadNames.length <= 5) {
              // 5개 이하면 모두 표시
              description = uniqueRoadNames.join(" → ");
            } else {
              // 5개 초과면 첫 3개, 중간 1개, 마지막 1개 표시 (총 5개)
              const firstThree = uniqueRoadNames.slice(0, 3);
              const middle = uniqueRoadNames[Math.floor(uniqueRoadNames.length / 2)];
              const last = uniqueRoadNames[uniqueRoadNames.length - 1];
              description = `${firstThree.join(" → ")} → ... → ${middle} → ... → ${last}`;
            }
          } else {
            // 2. 도로명이 없으면 안내 정보(guides) 활용
            const guideNames: string[] = section.guides
              ?.map(guide => guide.name)
              .filter((name): name is string => typeof name === "string" && name.trim().length > 0) || [];
            
            if (guideNames.length > 0) {
              // 첫 번째 안내 정보 사용 (IC, 톨게이트 등)
              description = guideNames[0];
            } else {
              // 3. 그것도 없으면 거리 기반으로 기본 설명
              if (section.distance < 100) {
                description = "단거리 구간";
              } else if (section.distance < 1000) {
                description = "일반 도로";
              } else {
                description = undefined; // 거리가 충분하면 설명 생략 가능
              }
            }
          }
          
          // 구간별 IC/톨게이트 안내 정보 추출
          const sectionGuides: import("@/types/route").RouteGuide[] = [];
          
          // 개발 환경: 구간별 guides 원본 확인
          if (process.env.NODE_ENV === "development") {
            console.group(`📍 [Server Action] Guides 추출 - 구간 ${sectionIndex}`);
            console.log("원본 guides:", JSON.stringify(section.guides, null, 2));
            console.log("guides 개수:", section.guides?.length ?? 0);
            console.groupEnd();
          }
          
          if (section.guides && section.guides.length > 0) {
            for (const guide of section.guides) {
              // IC나 톨게이트 관련 안내만 필터링 (type으로 구분 가능)
              // name에 "IC", "톨게이트", "TG" 등이 포함된 경우만 포함
              const guideName = guide.name || "";
              if (
                guideName.includes("IC") ||
                guideName.includes("톨게이트") ||
                guideName.includes("TG") ||
                guideName.includes("나들목") ||
                guideName.includes("분기점")
              ) {
                sectionGuides.push({
                  name: guide.name,
                  coord: { lat: guide.y, lng: guide.x },
                  distance: guide.distance,
                  duration: Math.round(guide.duration / 60), // 초 → 분
                  type: guide.type,
                  guidance: guide.guidance,
                });
                // 전체 경로의 guides에도 추가 (중복 제거)
                if (!allGuides.some(g => g.name === guide.name)) {
                  allGuides.push({
                    name: guide.name,
                    coord: { lat: guide.y, lng: guide.x },
                    distance: guide.distance,
                    duration: Math.round(guide.duration / 60),
                    type: guide.type,
                    guidance: guide.guidance,
                  });
                }
              }
            }
          }
          
          // 개발 환경: 필터링된 guides 및 allGuides 확인
          if (process.env.NODE_ENV === "development") {
            console.group(`✅ [Server Action] Guides 필터링 결과 - 구간 ${sectionIndex}`);
            console.log("필터링된 guides:", JSON.stringify(sectionGuides, null, 2));
            console.log("필터링된 guides 개수:", sectionGuides.length);
            console.log("전체 allGuides 개수:", allGuides.length);
            console.groupEnd();
          }
          
          segments.push({
            index: sectionIndex,
            distance: section.distance,
            duration: Math.round(section.duration / 60), // 초 → 분
            tollFare: segmentTollFare > 0 ? segmentTollFare : undefined,
            description,
            roadNames: uniqueRoadNames.length > 0 ? uniqueRoadNames : undefined, // 전체 도로명 배열 추가
            polyline: encodePolyline(sectionPolylinePoints),
            guides: sectionGuides.length > 0 ? sectionGuides : undefined,
          });
        }

        const polyline = encodePolyline(polylinePoints);

        // Guides 제한: 처음 IC와 끝 IC를 포함하여 최대 5개만 표시
        function limitGuides(guides: import("@/types/route").RouteGuide[], maxCount: number = 5): import("@/types/route").RouteGuide[] {
          if (guides.length <= maxCount) {
            return guides;
          }
          
          const result: import("@/types/route").RouteGuide[] = [];
          const indices = new Set<number>();
          
          // 첫 번째 IC (항상 포함)
          indices.add(0);
          
          // 중간 IC들 선택 (균등하게 분배)
          const middleCount = maxCount - 2; // 첫 번째와 마지막 제외
          if (middleCount > 0 && guides.length > 2) {
            for (let i = 1; i <= middleCount; i++) {
              const index = Math.floor((guides.length - 1) * i / (middleCount + 1));
              indices.add(index);
            }
          }
          
          // 마지막 IC (항상 포함)
          indices.add(guides.length - 1);
          
          // 인덱스 순서대로 정렬하여 결과 생성
          const sortedIndices = Array.from(indices).sort((a, b) => a - b);
          for (const index of sortedIndices) {
            result.push(guides[index]);
          }
          
          return result.slice(0, maxCount);
        }
        
        const limitedGuides = limitGuides(allGuides, 5);
        
        // 개발 환경: Guides 제한 로그
        if (process.env.NODE_ENV === "development" && allGuides.length > 5) {
          console.group("🔍 [Guides 제한] 최대 5개로 제한");
          console.log("원본 guides 개수:", allGuides.length);
          console.log("제한된 guides 개수:", limitedGuides.length);
          console.log("제한된 guides:", limitedGuides.map(g => g.name));
          console.groupEnd();
        }

        // 톨비 필터링: 도시 내 경로에서 톨비 제거
        // - 거리 50km 이하이고 톨비 1000원 이하인 경우 → 도시 내 경로로 간주
        // - 또는 실제 톨게이트/IC가 없는 경우 → 톨비 없음
        let filteredTollFare = route.summary.fare?.toll ?? 0;
        const isShortDistance = route.summary.distance <= 50000; // 50km 이하
        const isLowToll = filteredTollFare <= 1000; // 1000원 이하
        const hasNoTollGates = allGuides.length === 0; // 실제 톨게이트/IC 없음
        
        if (filteredTollFare > 0 && ((isShortDistance && isLowToll) || hasNoTollGates)) {
          // 개발 환경: 톨비 필터링 로그
          if (process.env.NODE_ENV === "development") {
            console.group("🔍 [톨비 필터링] 도시 내 경로 감지");
            console.log("원본 톨비:", filteredTollFare);
            console.log("거리:", route.summary.distance, "m");
            console.log("짧은 거리:", isShortDistance);
            console.log("낮은 톨비:", isLowToll);
            console.log("톨게이트 없음:", hasNoTollGates);
            console.log("필터링된 톨비: 0");
            console.groupEnd();
          }
          filteredTollFare = 0;
          
          // 구간별 톨비도 모두 0으로 설정
          segments.forEach(segment => {
            if (segment.tollFare && segment.tollFare > 0) {
              segment.tollFare = undefined;
            }
          });
        }

        // 6. 결과 반환
        const carRoute: CarRoute = {
          totalDuration: Math.round(route.summary.duration / 60), // 초 → 분
          totalDistance: route.summary.distance,
          tollFare: filteredTollFare > 0 ? filteredTollFare : undefined,
          taxiFare: route.summary.fare?.taxi ?? undefined,
          fuelCost: undefined,
          polyline,
          summary: route.summary.origin?.name && route.summary.destination?.name
            ? `${route.summary.origin.name} → ${route.summary.destination.name}`
            : undefined,
          segments: segments.length > 0 ? segments : undefined,
          guides: limitedGuides.length > 0 ? limitedGuides : undefined,
        };

        // 개발 환경: 최종 carRoute 객체 확인
        if (process.env.NODE_ENV === "development") {
          console.group("✅ [Server Action] 최종 CarRoute");
          console.log("CarRoute 객체:", {
            totalDuration: carRoute.totalDuration,
            totalDistance: carRoute.totalDistance,
            tollFare: carRoute.tollFare,
            taxiFare: carRoute.taxiFare,
            segments: carRoute.segments?.length ?? 0,
            guides: carRoute.guides?.length ?? 0,
            guides_상세: JSON.stringify(carRoute.guides, null, 2),
            segments_상세: JSON.stringify(carRoute.segments?.slice(0, 2), null, 2), // 처음 2개만
          });
          console.groupEnd();
        }

        console.log("✅ [카카오 API 호출 성공] 자동차 경로 조회 완료", {
          duration: carRoute.totalDuration,
          distance: carRoute.totalDistance,
          attempt: attempt + 1,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          data: carRoute,
        };
      } catch (error) {
        lastError = error as Error;

        // 네트워크 에러 - 재시도
        if (
          error instanceof TypeError &&
          error.message.includes("fetch") &&
          attempt < maxRetries
        ) {
          await delay(calculateBackoffDelay(attempt));
          continue;
        }

        throw error;
      }
    }

    // 최종 실패 로그
    console.error("❌ [카카오 API 호출 실패] 모든 재시도 실패", {
      attempts: maxRetries + 1,
      lastError: lastError?.message,
      timestamp: new Date().toISOString(),
    });

    throw lastError || new Error("알 수 없는 오류");
  } catch (error) {
    console.error("❌ [카카오 API 호출 예외]", error);
    return {
      success: false,
      error: {
        code: "API_ERROR",
        message: "서버 오류가 발생했습니다.",
      },
    };
  }
}

/**
 * 두 지점 간 자동차 소요시간만 조회 (빠른 버전)
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 소요 시간 (분) 또는 에러
 */
export async function getCarDuration(
  origin: Coordinate,
  destination: Coordinate
): Promise<{ success: boolean; duration?: number; error?: string }> {
  const result = await getCarRoute({ origin, destination });

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message ?? "경로 조회 실패",
    };
  }

  return {
    success: true,
    duration: result.data?.totalDuration,
  };
}

/**
 * 두 지점 간 자동차 거리만 조회 (빠른 버전)
 *
 * @param origin - 출발지 좌표
 * @param destination - 도착지 좌표
 * @returns 거리 (미터) 또는 에러
 */
export async function getCarDistance(
  origin: Coordinate,
  destination: Coordinate
): Promise<{ success: boolean; distance?: number; error?: string }> {
  const result = await getCarRoute({ origin, destination });

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message ?? "경로 조회 실패",
    };
  }

  return {
    success: true,
    distance: result.data?.totalDistance,
  };
}
