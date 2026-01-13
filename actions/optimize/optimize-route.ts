"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import {
  simpleOptimizeRequestSchema,
  type SimpleOptimizeRequestInput,
} from "@/lib/schemas";
import type {
  OptimizeResult,
  OptimizeStatistics,
  OptimizeError,
  DistanceMatrix,
} from "@/types/optimize";
import type {
  DailyItinerary,
  ScheduleItem,
  FixedSchedule,
  DayEndpoint,
  CheckInEvent,
} from "@/types/schedule";
import type { Place, TripPlaceRow } from "@/types/place";
import type { Trip, TripRow, TripLocation } from "@/types/trip";
import type { DailyAccommodation } from "@/types/accommodation";
import type { TransportMode, RouteSegment } from "@/types/route";
import type { OptimizeNode } from "@/lib/optimize/types";
import {
  createDistanceMatrix,
  nearestNeighborWithEndpoints,
  twoOptWithEndpoints,
  distributeToDaily,
  validateFixedSchedules,
  fixedScheduleToNode,
  timeToMinutes,
  minutesToTime,
  addMinutesToTime,
  getDaysBetween,
  generateDateRange,
  createDistanceMatrixGetter,
  generateDailyTimeConfigs,
  DEFAULT_MIDDLE_DAY_START_TIME,
  DEFAULT_MIDDLE_DAY_END_TIME,
} from "@/lib/optimize";
import type { DistanceEntry } from "@/lib/optimize";
import type { DailyTimeConfig } from "@/lib/optimize/types";
import { optimizePublicTransitRoute } from "./optimize-route-public-transit";

// ============================================
// Types
// ============================================

/**
 * 理쒖쟻???ㅽ뻾 寃곌낵
 */
export interface OptimizeRouteResult {
  success: boolean;
  data?: OptimizeResult;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 理쒖쟻??吏꾪뻾 ?④퀎
 */
type OptimizeStage =
  | "validating"
  | "calculating_matrix"
  | "initial_route"
  | "improving"
  | "distributing"
  | "fetching_routes"
  | "saving"
  | "completed";

// ============================================
// Helper Functions
// ============================================

/**
 * TripRow瑜?Trip?쇰줈 蹂??
 */
function convertRowToTrip(row: TripRow): Trip {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    origin: row.origin,
    destination: row.destination,
    dailyStartTime: row.daily_start_time,
    dailyEndTime: row.daily_end_time,
    transportModes: row.transport_mode,
    status: row.status,
    accommodations: row.accommodations ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * TripPlaceRow瑜?Place濡?蹂??
 */
function convertRowToPlace(row: TripPlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    coordinate: {
      lat: row.lat,
      lng: row.lng,
    },
    category: row.category ?? undefined,
    kakaoPlaceId: row.kakao_place_id ?? undefined,
    estimatedDuration: row.estimated_duration,
    priority: row.priority ?? undefined,
  };
}

/**
 * Place瑜?OptimizeNode濡?蹂??
 */
function placeToOptimizeNode(place: Place, priority: number): OptimizeNode {
  return {
    id: place.id,
    name: place.name,
    coordinate: place.coordinate,
    duration: place.estimatedDuration,
    priority: place.priority ?? priority,
    isFixed: false,
  };
}

/**
 * TripLocation??OptimizeNode濡?蹂??
 */
function locationToOptimizeNode(
  location: TripLocation,
  id: string
): OptimizeNode {
  return {
    id,
    name: location.name,
    coordinate: {
      lat: location.lat,
      lng: location.lng,
    },
    duration: 0,
    priority: 0,
    isFixed: false,
  };
}

/**
 * ?숈냼瑜?OptimizeNode濡?蹂??
 */
function accommodationToOptimizeNode(
  accom: DailyAccommodation,
  index: number
): OptimizeNode {
  return {
    id: `__accommodation_${index}__`,
    name: accom.location.name,
    coordinate: {
      lat: accom.location.lat,
      lng: accom.location.lng,
    },
    duration: 0,
    priority: 0,
    isFixed: false,
  };
}

const DEFAULT_CHECKIN_TIME = "15:00";
const DEFAULT_CHECKIN_DURATION_MIN = 30;

interface CheckInConfig {
  accommodation: DailyAccommodation;
  checkInTime: string;
  checkInDurationMin: number;
}

function getCheckInConfigForDate(
  accommodations: DailyAccommodation[],
  date: string
): CheckInConfig | null {
  const accommodation = accommodations.find((acc) => acc.startDate === date);
  if (!accommodation) return null;
  return {
    accommodation,
    checkInTime: accommodation.checkInTime ?? DEFAULT_CHECKIN_TIME,
    checkInDurationMin: DEFAULT_CHECKIN_DURATION_MIN,
  };
}

function buildRouteSegment(entry?: DistanceEntry | null): RouteSegment | undefined {
  if (!entry) return undefined;
  return {
    mode: entry.mode,
    distance: entry.distance,
    duration: entry.duration,
    polyline: entry.polyline,
    fare: entry.fare,
    taxiFare: entry.taxiFare,
    transitDetails: entry.transitDetails,
    carSegments: entry.carSegments,
    guides: entry.guides,
  };
}

function splitPlaceIdsByCheckIn(params: {
  dayPlaceIds: string[];
  nodeMap: Map<string, OptimizeNode>;
  distanceMatrix: DistanceMatrix;
  dayStartTime: string;
  dayStartId: string;
  checkInTime: string;
}): { amPlaceIds: string[]; pmPlaceIds: string[]; splitIndex: number } {
  const {
    dayPlaceIds,
    nodeMap,
    distanceMatrix,
    dayStartTime,
    dayStartId,
    checkInTime,
  } = params;

  if (dayPlaceIds.length === 0) {
    return { amPlaceIds: [], pmPlaceIds: [], splitIndex: 0 };
  }

  const checkInMinute = timeToMinutes(checkInTime);
  let currentTime = timeToMinutes(dayStartTime);
  let lastId = dayStartId;
  let splitIndex = dayPlaceIds.length;

  if (checkInMinute <= currentTime) {
    return { amPlaceIds: [], pmPlaceIds: [...dayPlaceIds], splitIndex: 0 };
  }

  const getDistance = createDistanceMatrixGetter(distanceMatrix);

  for (let i = 0; i < dayPlaceIds.length; i++) {
    const placeId = dayPlaceIds[i];
    const node = nodeMap.get(placeId);
    if (!node) continue;

    const travelMinutes = getDistance(lastId, placeId)?.duration ?? 0;
    const arrivalBase = currentTime + travelMinutes;

    if (node.isFixed && node.fixedStartTime) {
      const fixedMinute = timeToMinutes(node.fixedStartTime);
      if (fixedMinute >= checkInMinute) {
        splitIndex = i;
        break;
      }
      const arrival = Math.max(fixedMinute, arrivalBase);
      currentTime = arrival + node.duration;
    } else {
      if (arrivalBase >= checkInMinute) {
        splitIndex = i;
        break;
      }
      currentTime = arrivalBase + node.duration;
    }

    lastId = placeId;
  }

  return {
    amPlaceIds: dayPlaceIds.slice(0, splitIndex),
    pmPlaceIds: dayPlaceIds.slice(splitIndex),
    splitIndex,
  };
}

function getPrimaryTransportMode(modes: TransportMode[]): TransportMode {
  // ?먮룞李④? ?ы븿?섏뼱 ?덉쑝硫??먮룞李??곗꽑
  if (modes.includes("car")) {
    return "car";
  }
  // ?以묎탳?듭씠 ?ы븿?섏뼱 ?덉쑝硫??以묎탳??
  if (modes.includes("public")) {
    return "public";
  }
  // 洹??몄뿉???꾨낫
  return "walking";
}

/**
 * ?쇱옄蹂?遺꾨같 寃곌낵瑜?DailyItinerary濡?蹂??
 * @param skipTransportToDestination - true硫??꾩갑吏源뚯? ?대룞 ?뺣낫 ?앸왂 (?숈냼 ?녿뒗 ??
 * @param dayOrigin - ???좎쓽 ?쒖옉???뺣낫 (異쒕컻吏 ?먮뒗 ?꾨궇 ?숈냼)
 * @param dayDestination - ???좎쓽 ?앹젏 ?뺣낫 (?꾩갑吏, ?숈냼, ?먮뒗 undefined)
 */
async function createDailyItinerary(
  dayPlaceIds: string[],
  nodeMap: Map<string, OptimizeNode>,
  distanceMatrix: DistanceMatrix,
  date: string,
  dayNumber: number,
  dailyStartTime: string,
  dailyEndTime: string,
  transportMode: TransportMode,
  originId: string,
  destinationId: string,
  skipTransportToDestination: boolean = false,
  dayOrigin?: DayEndpoint,
  dayDestination?: DayEndpoint
): Promise<DailyItinerary> {
  const schedule: ScheduleItem[] = [];
  const getDistance = createDistanceMatrixGetter(distanceMatrix);

  let totalDistance = 0;
  let totalDuration = 0;
  let totalStayDuration = 0;

  // 異쒕컻吏?먯꽌 泥??μ냼源뚯? ?대룞 ?뺣낫 怨꾩궛
  let transportFromOrigin: DailyItinerary["transportFromOrigin"];
  let currentTime = timeToMinutes(dailyStartTime);

  if (dayPlaceIds.length > 0) {
    const firstPlaceId = dayPlaceIds[0];
    const entry = getDistance(originId, firstPlaceId);
    if (entry) {
      // 개발 환경: transportFromOrigin 생성 확인
      if (process.env.NODE_ENV === "development") {
        console.group("🛣️ [RouteSegment 생성] transportFromOrigin");
        console.log("entry.fare:", entry.fare);
        console.log("entry.taxiFare:", entry.taxiFare);
        console.log("entry.guides:", JSON.stringify(entry.guides, null, 2));
        console.log("entry.guides 개수:", entry.guides?.length ?? 0);
        console.groupEnd();
      }
      
      transportFromOrigin = {
        mode: entry.mode,
        distance: entry.distance,
        duration: entry.duration,
        polyline: entry.polyline,
        fare: entry.fare,
        taxiFare: entry.taxiFare,
        transitDetails: entry.transitDetails,
        carSegments: entry.carSegments,
        guides: entry.guides,
      };
      // 泥??μ냼 ?꾩갑 ?쒓컙 = 異쒕컻 ?쒓컙 + ?대룞 ?쒓컙
      currentTime = timeToMinutes(dailyStartTime) + entry.duration;
      totalDistance += entry.distance;
      totalDuration += entry.duration;
    }
  }

  for (let i = 0; i < dayPlaceIds.length; i++) {
    const placeId = dayPlaceIds[i];
    const node = nodeMap.get(placeId);

    if (!node) continue;

    // 怨좎젙 ?쇱젙??寃쎌슦 ?대떦 ?쒓컙?쇰줈 議곗젙
    if (node.isFixed && node.fixedStartTime) {
      currentTime = timeToMinutes(node.fixedStartTime);
    }

    const arrivalTime = minutesToTime(currentTime);
    const departureTime = addMinutesToTime(arrivalTime, node.duration);

    // ?ㅼ쓬 ?μ냼源뚯? ?대룞 ?뺣낫 怨꾩궛
    let transportToNext: ScheduleItem["transportToNext"];

    if (i < dayPlaceIds.length - 1) {
      const nextPlaceId = dayPlaceIds[i + 1];
      const entry = getDistance(placeId, nextPlaceId);

      if (entry) {
        // 개발 환경: transportToNext 생성 확인
        if (process.env.NODE_ENV === "development") {
          console.group(`🛣️ [RouteSegment 생성] transportToNext - ${placeId} → ${nextPlaceId}`);
          console.log("entry.fare:", entry.fare);
          console.log("entry.taxiFare:", entry.taxiFare);
          console.log("entry.guides:", JSON.stringify(entry.guides, null, 2));
          console.log("entry.guides 개수:", entry.guides?.length ?? 0);
          console.groupEnd();
        }
        
        transportToNext = {
          mode: entry.mode,
          distance: entry.distance,
          duration: entry.duration,
          polyline: entry.polyline,
          fare: entry.fare,
          taxiFare: entry.taxiFare,
          transitDetails: entry.transitDetails,
          carSegments: entry.carSegments,
          guides: entry.guides,
        };

        totalDistance += entry.distance;
        totalDuration += entry.duration;
        currentTime = timeToMinutes(departureTime) + entry.duration;
      }
    }

    totalStayDuration += node.duration;

    schedule.push({
      order: i + 1,
      placeId: node.id,
      placeName: node.name,
      arrivalTime,
      departureTime,
      duration: node.duration,
      isFixed: node.isFixed,
      transportToNext,
    });
  }

  // 留덉?留??μ냼?먯꽌 ?꾩갑吏源뚯? ?대룞 ?뺣낫 怨꾩궛 (?숈냼 ?녿뒗 ?좎? ?앸왂)
  let transportToDestination: DailyItinerary["transportToDestination"];
  if (dayPlaceIds.length > 0 && !skipTransportToDestination) {
    const lastPlaceId = dayPlaceIds[dayPlaceIds.length - 1];
    const entry = getDistance(lastPlaceId, destinationId);
    if (entry) {
      // 개발 환경: transportToDestination 생성 확인
      if (process.env.NODE_ENV === "development") {
        console.group(`🛣️ [RouteSegment 생성] transportToDestination - ${lastPlaceId} → ${destinationId}`);
        console.log("entry.fare:", entry.fare);
        console.log("entry.taxiFare:", entry.taxiFare);
        console.log("entry.guides:", JSON.stringify(entry.guides, null, 2));
        console.log("entry.guides 개수:", entry.guides?.length ?? 0);
        console.groupEnd();
      }
      
      transportToDestination = {
        mode: entry.mode,
        distance: entry.distance,
        duration: entry.duration,
        polyline: entry.polyline,
        fare: entry.fare,
        taxiFare: entry.taxiFare,
        transitDetails: entry.transitDetails,
        carSegments: entry.carSegments,
        guides: entry.guides,
      };
      totalDistance += entry.distance;
      totalDuration += entry.duration;
    }
  }

  // startTime: 異쒕컻吏 異쒕컻 ?쒓컙 (dailyStartTime)
  // endTime: 留덉?留??μ냼 異쒕컻 ?쒓컙 + ?꾩갑吏源뚯? ?대룞 ?쒓컙
  const startTime = dailyStartTime;
  let endTime = schedule[schedule.length - 1]?.departureTime ?? dailyStartTime;
  
  // ?꾩갑吏源뚯? ?대룞 ?쒓컙???덉쑝硫?異붽?
  if (transportToDestination) {
    endTime = addMinutesToTime(endTime, transportToDestination.duration);
  }

  return {
    dayNumber,
    date,
    schedule,
    totalDistance,
    totalDuration,
    totalStayDuration,
    placeCount: schedule.length,
    startTime,
    endTime,
    transportFromOrigin,
    transportToDestination,
    dailyStartTime,
    dailyEndTime,
    dayOrigin,
    dayDestination,
  };
}
// ============================================
// Main Server Action
// ============================================

/**
 * 寃쎈줈 理쒖쟻???ㅽ뻾 Server Action
 *
 * 1. 嫄곕━ ?됰젹 怨꾩궛
 * 2. Nearest Neighbor 珥덇린 寃쎈줈 ?앹꽦
 * 3. 怨좎젙 ?쇱젙 諛섏쁺
 * 4. ?쇱옄蹂?遺꾨같
 * 5. 援ш컙 ?대룞 ?뺣낫 議고쉶
 *
 * @param input - 理쒖쟻???붿껌 (tripId ?꾩닔)
 * @returns 理쒖쟻??寃곌낵
 *
 * @example
 * ```tsx
 * const result = await optimizeRoute({ tripId: "..." });
 * if (result.success) {
 *   console.log(result.data.itinerary); // DailyItinerary[]
 * }
 * ```
 */
export async function optimizeRoute(
  input: SimpleOptimizeRequestInput
): Promise<OptimizeRouteResult> {
  const startTime = Date.now();
  const errors: OptimizeError[] = [];

  try {
    // 1. ?몄쬆 ?뺤씤
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "濡쒓렇?몄씠 ?꾩슂?⑸땲??",
        },
      };
    }

    // 2. ?낅젰 寃利?
    const validationResult = simpleOptimizeRequestSchema.safeParse(input);
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

    const { tripId, options: userOptions } = validationResult.data;

    // 3. Supabase ?대씪?댁뼵???앹꽦
    const supabase = createClerkSupabaseClient();

    // 4. ?ы뻾 諛?愿???곗씠??議고쉶
    const [tripResult, placesResult, schedulesResult] = await Promise.all([
      supabase.from("trips").select("*").eq("id", tripId).single(),
      supabase
        .from("trip_places")
        .select("*")
        .eq("trip_id", tripId)
        .order("priority", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("trip_fixed_schedules")
        .select("*")
        .eq("trip_id", tripId)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true }),
    ]);

    if (tripResult.error || !tripResult.data) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "?ы뻾??李얠쓣 ???놁뒿?덈떎.",
        },
      };
    }

    const trip = convertRowToTrip(tripResult.data as TripRow);
    const places = (placesResult.data ?? []).map((row) =>
      convertRowToPlace(row as TripPlaceRow)
    );
    // 怨좎젙 ?쇱젙 蹂??
    const fixedSchedules: FixedSchedule[] = (schedulesResult.data ?? []).map(
      (row) => ({
        id: row.id,
        placeId: row.place_id ?? "",
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        note: row.note ?? undefined,
      })
    );

    // 5. 理쒖냼 ?μ냼 ???뺤씤
    if (places.length < 2) {
      return {
        success: false,
        error: {
          code: "INSUFFICIENT_PLACES",
          message: "理쒖냼 2媛??댁긽???μ냼媛 ?꾩슂?⑸땲??",
        },
      };
    }

    // 6. 怨좎젙 ?쇱젙 ?좏슚??寃利?
    const constraintValidation = validateFixedSchedules(fixedSchedules, {
      startDate: trip.startDate,
      endDate: trip.endDate,
      dailyStartTime: trip.dailyStartTime,
      dailyEndTime: trip.dailyEndTime,
    });

    if (!constraintValidation.isValid) {
      return {
        success: false,
        error: {
          code: "FIXED_SCHEDULE_CONFLICT",
          message:
            constraintValidation.conflicts[0]?.message ??
            "怨좎젙 ?쇱젙??異⑸룎???덉뒿?덈떎.",
        },
      };
    }

    // 寃쎄퀬 硫붿떆吏??errors??異붽?
    for (const warning of constraintValidation.warnings) {
      errors.push({
        code: "UNKNOWN",
        message: warning,
      });
    }

    // 7. ?몃뱶 留??앹꽦
    const nodeMap = new Map<string, OptimizeNode>();

    // 異쒕컻吏/?꾩갑吏 ?몃뱶 ?앹꽦
    const originNode = locationToOptimizeNode(trip.origin, "__origin__");
    const destinationNode = locationToOptimizeNode(
      trip.destination,
      "__destination__"
    );

    nodeMap.set(originNode.id, originNode);
    nodeMap.set(destinationNode.id, destinationNode);

    // ?숈냼 ?몃뱶 ?앹꽦 (?곗냽 ?쇱젙 吏??
    const accommodationNodes = new Map<string, OptimizeNode>();
    const tripAccommodations = trip.accommodations ?? [];
    for (let i = 0; i < tripAccommodations.length; i++) {
      const accom = tripAccommodations[i];
      const node = accommodationToOptimizeNode(accom, i);
      nodeMap.set(node.id, node);
      // ?숈냼 湲곌컙 ??紐⑤뱺 ?좎쭨??????몃뱶 留ㅽ븨 (startDate遺??endDate ?꾨궇源뚯?)
      // 泥댄겕?꾩썐? endDate ?꾩묠?대?濡? endDate ?꾨궇源뚯? ?숇컯
      const start = new Date(accom.startDate);
      const end = new Date(accom.endDate);
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        accommodationNodes.set(dateStr, node);
      }
    }

    // ?μ냼 ?몃뱶 ?앹꽦
    const placeNodes: OptimizeNode[] = [];
    for (let i = 0; i < places.length; i++) {
      const place = places[i];

      // 怨좎젙 ?쇱젙???μ냼 ?뺤씤
      const fixedSchedule = fixedSchedules.find(
        (s) => s.placeId === place.id
      );

      let node: OptimizeNode;
      if (fixedSchedule) {
        // 怨좎젙 ?쇱젙???덈뒗 ?μ냼
        node = fixedScheduleToNode(fixedSchedule, {
          id: place.id,
          name: place.name,
          coordinate: place.coordinate,
        });
      } else {
        // ?쇰컲 ?μ냼
        node = placeToOptimizeNode(place, i + 1);
      }

      nodeMap.set(node.id, node);
      placeNodes.push(node);
    }
    // 8. ?대룞 ?섎떒 寃곗젙
    const transportMode = getPrimaryTransportMode(trip.transportModes);
    // 9. ?以묎탳??紐⑤뱶: ?좉퇋 ?뚭퀬由ъ쬁 ?ъ슜
    if (transportMode === "public") {
      return await optimizePublicTransitRoute({
        tripId,
        trip,
        places,
        placeNodes,
        fixedSchedules,
        userOptions,
        errors,
        startTime,
      });
    }

    // 10. 李⑤웾 紐⑤뱶: 湲곗〈 嫄곕━ ?됰젹 諛⑹떇
    const allAccommodationNodes = Array.from(accommodationNodes.values());
    const allNodes = [
      originNode,
      ...placeNodes,
      ...allAccommodationNodes,
      destinationNode,
    ];

    const distanceMatrix = await createDistanceMatrix(allNodes, {
      mode: transportMode,
      useApi: true, // API 湲곕컲 ?ㅼ젣 嫄곕━ ?ъ슜
      batchSize: 3,
    });

    // 10. 理쒖쟻???ㅼ젙
    const optimizeConfig = {
      timeWeight: userOptions?.timeWeight ?? 1.0,
      distanceWeight: userOptions?.distanceWeight ?? 0.1,
    };

    // 11. Nearest Neighbor 珥덇린 寃쎈줈 ?앹꽦
    const initialResult = nearestNeighborWithEndpoints(
      placeNodes,
      distanceMatrix,
      optimizeConfig,
      originNode.id,
      destinationNode.id
    );

    // 12. 2-opt濡?寃쎈줈 媛쒖꽑
    const improvedResult = twoOptWithEndpoints(
      initialResult.route,
      distanceMatrix,
      optimizeConfig,
      {
        maxIterations: userOptions?.improvementIterations ?? 100,
        noImprovementLimit: 20,
      }
    );

    // 13. ?쇱옄蹂?遺꾨같
    const totalDays = getDaysBetween(trip.startDate, trip.endDate);
    const dates = generateDateRange(trip.startDate, totalDays);
    const dayEndpoints = dates.map((date, index) => {
      const isFirstDay = index === 0;
      const isLastDay = index === totalDays - 1;
      let startId: string | undefined;
      let endId: string | undefined;

      if (isFirstDay) {
        startId = originNode.id;
      } else {
        const prevDate = dates[index - 1];
        const prevAccomNode = accommodationNodes.get(prevDate);
        if (prevAccomNode) {
          startId = prevAccomNode.id;
        }
      }

      if (isLastDay) {
        endId = destinationNode.id;
      } else {
        const todayAccomNode = accommodationNodes.get(date);
        if (todayAccomNode) {
          endId = todayAccomNode.id;
        }
      }

      return { startId, endId };
    });

    // 일자별 시간 설정 생성
    // - 1일차: 여행 시작 시간 ~ 20:00
    // - 중간 일차: 10:00 ~ 20:00
    // - 마지막 일차: 10:00 ~ 여행 종료 시간
    const dailyTimeConfigs: DailyTimeConfig[] = generateDailyTimeConfigs({
      totalDays,
      startDate: trip.startDate,
      firstDayStartTime: trip.dailyStartTime,
      lastDayEndTime: trip.dailyEndTime,
      middleDayStartTime: DEFAULT_MIDDLE_DAY_START_TIME,
      middleDayEndTime: DEFAULT_MIDDLE_DAY_END_TIME,
    });

    const distributionResult = distributeToDaily(
      improvedResult.route,
      nodeMap,
      distanceMatrix,
      {
        startDate: trip.startDate,
        endDate: trip.endDate,
        dailyStartTime: trip.dailyStartTime,
        dailyEndTime: trip.dailyEndTime,
        fixedSchedules,
        dailyTimeConfigs,
        dayEndpoints,
      }
    );

    // 遺꾨같?섏? 紐삵븳 ?μ냼 寃쎄퀬 (異쒕컻吏/?꾩갑吏/?숈냼 ?쒖쇅)
    const actualUnassignedPlaces = distributionResult.unassignedPlaces.filter(
      (id) =>
        id !== "__origin__" &&
        id !== "__destination__" &&
        !id.startsWith("__accommodation_")
    );

    if (actualUnassignedPlaces.length > 0) {
      // ?곸꽭 ?뺣낫 ?ы븿?섏뿬 ?꾨떖
      const unassignedPlaceDetails = actualUnassignedPlaces.map((placeId) => {
        const place = places.find((p) => p.id === placeId);
        const node = nodeMap.get(placeId);
        return {
          placeId,
          placeName: place?.name || placeId,
          reasonCode: "TIME_EXCEEDED" as const,
          reasonMessage: "?쇱씪 ?쒕룞 ?쒓컙??遺議깊븯???쇱젙???ы븿?섏? 紐삵뻽?듬땲??",
          details: {
            estimatedDuration: place?.estimatedDuration ?? node?.duration,
          },
        };
      });

      errors.push({
        code: "EXCEEDS_DAILY_LIMIT",
        message: `${actualUnassignedPlaces.length}媛??μ냼媛 ?쇱젙???ы븿?섏? 紐삵뻽?듬땲??`,
        details: {
          unassignedPlaces: actualUnassignedPlaces,
          unassignedPlaceDetails,
        },
      });
    }

    // 14. DailyItinerary ?앹꽦 (?쇱옄蹂??숈쟻 ?쒖옉/?앹젏)
    const itinerary: DailyItinerary[] = [];
    const totalDaysCount = distributionResult.days.length;

    for (let i = 0; i < totalDaysCount; i++) {
      const dayPlaceIds = distributionResult.days[i];
      const date = dates[i];
      const isFirstDay = i === 0;
      const isLastDay = i === totalDaysCount - 1;

      // 異쒕컻吏/?꾩갑吏/?숈냼 ?쒖쇅 (?ㅼ젣 諛⑸Ц ?μ냼留?
      const actualPlaceIds = dayPlaceIds.filter(
        (id) =>
          id !== "__origin__" &&
          id !== "__destination__" &&
          !id.startsWith("__accommodation_")
      );
      // ?쒖옉??寃곗젙
      let actualStartId: string;
      let dayOriginInfo: DayEndpoint | undefined;

      if (isFirstDay) {
        // 泥ル궇: 異쒕컻吏?먯꽌 ?쒖옉
        actualStartId = originNode.id;
        dayOriginInfo = {
          name: trip.origin.name,
          address: trip.origin.address,
          lat: trip.origin.lat,
          lng: trip.origin.lng,
          type: "origin",
        };
      } else {
        // 洹??? ?댁쟾 ?좎쓽 ?숈냼 ?먮뒗 ?댁쟾 ??留덉?留??μ냼
        const prevDate = dates[i - 1];
        // ?곗냽 ?쇱젙 吏?? prevDate媛 startDate <= prevDate < endDate 踰붿쐞???덈뒗 ?숈냼 李얘린
        const prevAccomData = tripAccommodations.find(
          (a) => a.startDate <= prevDate && prevDate < a.endDate
        );
        const prevAccomNode = accommodationNodes.get(prevDate);

        if (prevAccomNode && prevAccomData) {
          actualStartId = prevAccomNode.id;
          dayOriginInfo = {
            name: prevAccomData.location.name,
            address: prevAccomData.location.address,
            lat: prevAccomData.location.lat,
            lng: prevAccomData.location.lng,
            type: "accommodation",
          };
        } else if (
          itinerary[i - 1] &&
          itinerary[i - 1].schedule.length > 0
        ) {
          // ?댁쟾 ??留덉?留?諛⑸Ц ?μ냼 (?숈냼媛 ?녿뒗 寃쎌슦)
          const lastSchedule = itinerary[i - 1].schedule[itinerary[i - 1].schedule.length - 1];
          actualStartId = lastSchedule.placeId;
          const lastNode = nodeMap.get(lastSchedule.placeId);
          if (lastNode) {
            dayOriginInfo = {
              name: lastNode.name,
              address: "",
              lat: lastNode.coordinate.lat,
              lng: lastNode.coordinate.lng,
              type: "lastPlace", // ?꾨궇 留덉?留??μ냼?먯꽌 ?쒖옉
            };
          }
        } else {
          // ?댁쟾 ??諛⑸Ц ?μ냼媛 ?놁쑝硫?異쒕컻吏 ?ъ슜
          actualStartId = originNode.id;
          dayOriginInfo = {
            name: trip.origin.name,
            address: trip.origin.address,
            lat: trip.origin.lat,
            lng: trip.origin.lng,
            type: "origin",
          };
        }
      }

      // ?앹젏 寃곗젙
      let actualEndId: string;
      let skipTransportToDestination = false;
      let dayDestinationInfo: DayEndpoint | undefined;

      if (isLastDay) {
        // 留덉?留??? 臾댁“嫄??꾩갑吏
        actualEndId = destinationNode.id;
        dayDestinationInfo = {
          name: trip.destination.name,
          address: trip.destination.address,
          lat: trip.destination.lat,
          lng: trip.destination.lng,
          type: "destination",
        };
      } else {
        // 以묎컙 ?? ?숈냼媛 ?덉쑝硫??숈냼, ?놁쑝硫?留덉?留??μ냼?먯꽌 醫낅즺
        // ?곗냽 ?쇱젙 吏?? date媛 startDate <= date < endDate 踰붿쐞???덈뒗 ?숈냼 李얘린
        const todayAccomData = tripAccommodations.find(
          (a) => a.startDate <= date && date < a.endDate
        );
        const todayAccomNode = accommodationNodes.get(date);

        if (todayAccomNode && todayAccomData) {
          actualEndId = todayAccomNode.id;
          dayDestinationInfo = {
            name: todayAccomData.location.name,
            address: todayAccomData.location.address,
            lat: todayAccomData.location.lat,
            lng: todayAccomData.location.lng,
            type: "accommodation",
          };
        } else {
          // ?숈냼 ?놁쓬: 留덉?留??μ냼?먯꽌 醫낅즺 (transportToDestination ?앸왂)
          // ?ㅼ젣 ?앹젏? ?놁?留?dummy ID ?ъ슜
          actualEndId = "__no_destination__";
          skipTransportToDestination = true;
          // dayDestinationInfo??undefined濡??좎? (?앹젏 ?놁쓬 = 留덉?留??μ냼?먯꽌 醫낅즺)
        }
      }

      // 일자별 시간 설정 적용
      const dayTimeConfig = dailyTimeConfigs[i];
      const dayStartTime = minutesToTime(dayTimeConfig.startMinute);
      const dayEndTime = minutesToTime(dayTimeConfig.endMinute);
      const checkInConfig = getCheckInConfigForDate(tripAccommodations, date);
      const shouldApplyCheckIn =
        !!checkInConfig &&
        dayDestinationInfo?.type === "accommodation" &&
        actualEndId.startsWith("__accommodation_");

      if (actualPlaceIds.length === 0) {
        // 鍮??좎? 湲곕낯 ?뺣낫留?
        itinerary.push({
          dayNumber: i + 1,
          date,
          schedule: [],
          totalDistance: 0,
          totalDuration: 0,
          totalStayDuration: 0,
          placeCount: 0,
          startTime: dayStartTime,
          endTime: dayStartTime,
          dailyStartTime: dayStartTime,
          dailyEndTime: dayEndTime,
          dayOrigin: dayOriginInfo,
          dayDestination: dayDestinationInfo,
        });
        continue;
      }

      if (shouldApplyCheckIn && checkInConfig) {
        const { amPlaceIds, pmPlaceIds } = splitPlaceIdsByCheckIn({
          dayPlaceIds: actualPlaceIds,
          nodeMap,
          distanceMatrix,
          dayStartTime,
          dayStartId: actualStartId,
          checkInTime: checkInConfig.checkInTime,
        });

        const accommodationId = actualEndId;
        const getDistance = createDistanceMatrixGetter(distanceMatrix);

        const amItinerary =
          amPlaceIds.length > 0
            ? await createDailyItinerary(
                amPlaceIds,
                nodeMap,
                distanceMatrix,
                date,
                i + 1,
                dayStartTime,
                dayEndTime,
                transportMode,
                actualStartId,
                accommodationId,
                false,
              )
            : null;

        let arrivalTime = dayStartTime;
        let transportToHotel: RouteSegment | undefined;

        if (amItinerary) {
          arrivalTime = amItinerary.endTime;
          transportToHotel = amItinerary.transportToDestination;
        } else {
          const entry = getDistance(actualStartId, accommodationId);
          transportToHotel = buildRouteSegment(entry);
          const travelMinutes = entry?.duration ?? 0;
          arrivalTime = addMinutesToTime(dayStartTime, travelMinutes);
        }

        const checkInStartMinute = Math.max(
          timeToMinutes(checkInConfig.checkInTime),
          timeToMinutes(arrivalTime),
        );
        const checkInStartTime = minutesToTime(checkInStartMinute);
        const checkInEndTime = minutesToTime(
          checkInStartMinute + checkInConfig.checkInDurationMin,
        );

        const pmItinerary =
          pmPlaceIds.length > 0
            ? await createDailyItinerary(
                pmPlaceIds,
                nodeMap,
                distanceMatrix,
                date,
                i + 1,
                checkInEndTime,
                dayEndTime,
                transportMode,
                accommodationId,
                actualEndId,
                false,
              )
            : null;

        const checkInEvent: CheckInEvent = {
          accommodationName: checkInConfig.accommodation.location.name,
          accommodationAddress: checkInConfig.accommodation.location.address,
          lat: checkInConfig.accommodation.location.lat,
          lng: checkInConfig.accommodation.location.lng,
          checkInTime: checkInConfig.checkInTime,
          durationMin: checkInConfig.checkInDurationMin,
          arrivalTime,
          startTime: checkInStartTime,
          endTime: checkInEndTime,
          insertAfterOrder: amItinerary?.schedule.length ?? 0,
          transportToHotel,
          transportFromHotel: pmItinerary?.transportFromOrigin,
        };

        const mergedSchedule: ScheduleItem[] = [];
        if (amItinerary) {
          mergedSchedule.push(...amItinerary.schedule);
        }
        if (pmItinerary) {
          const offset = mergedSchedule.length;
          mergedSchedule.push(
            ...pmItinerary.schedule.map((item, index) => ({
              ...item,
              order: offset + index + 1,
            })),
          );
        }

        const totalDistance =
          (amItinerary?.totalDistance ?? 0) + (pmItinerary?.totalDistance ?? 0);
        const totalDuration =
          (amItinerary?.totalDuration ?? 0) + (pmItinerary?.totalDuration ?? 0);
        const totalStayDuration =
          (amItinerary?.totalStayDuration ?? 0) +
          (pmItinerary?.totalStayDuration ?? 0) +
          checkInConfig.checkInDurationMin;
        const startTimeValue =
          amItinerary?.startTime ??
          pmItinerary?.startTime ??
          dayStartTime;
        const endTimeValue =
          pmItinerary?.endTime ??
          checkInEndTime ??
          amItinerary?.endTime ??
          startTimeValue;

        itinerary.push({
          dayNumber: i + 1,
          date,
          schedule: mergedSchedule,
          totalDistance,
          totalDuration,
          totalStayDuration,
          placeCount: mergedSchedule.length,
          startTime: startTimeValue,
          endTime: endTimeValue,
          transportFromOrigin: amItinerary?.transportFromOrigin,
          transportToDestination:
            pmItinerary?.transportToDestination ??
            amItinerary?.transportToDestination,
          dailyStartTime: dayStartTime,
          dailyEndTime: dayEndTime,
          dayOrigin: dayOriginInfo,
          dayDestination: dayDestinationInfo,
          checkInEvent,
        });
        continue;
      }

      const dailyItinerary = await createDailyItinerary(
        actualPlaceIds,
        nodeMap,
        distanceMatrix,
        date,
        i + 1,
        dayStartTime,
        dayEndTime,
        transportMode,
        actualStartId,
        actualEndId,
        skipTransportToDestination,
        dayOriginInfo,
        dayDestinationInfo
      );

      itinerary.push(dailyItinerary);
    }

    // 15. ?듦퀎 怨꾩궛
    const statistics: OptimizeStatistics = {
      totalPlaces: places.length,
      totalDays: totalDays,
      totalDistance:
        itinerary.reduce((sum, day) => sum + day.totalDistance, 0) / 1000, // km
      totalDuration: itinerary.reduce((sum, day) => sum + day.totalDuration, 0),
      totalStayDuration: itinerary.reduce(
        (sum, day) => sum + day.totalStayDuration,
        0
      ),
      averageDailyDistance:
        itinerary.reduce((sum, day) => sum + day.totalDistance, 0) /
        1000 /
        totalDays,
      averageDailyPlaces:
        itinerary.reduce((sum, day) => sum + day.placeCount, 0) / totalDays,
      optimizationTimeMs: Date.now() - startTime,
      improvementPercentage: improvedResult.improvementPercentage,
    };

    // 16. ?ы뻾 ?곹깭 ?낅뜲?댄듃
    await supabase
      .from("trips")
      .update({ status: "optimized" })
      .eq("id", tripId);

    // 17. 罹먯떆 臾댄슚??
    revalidatePath("/my");
    revalidatePath(`/plan/${tripId}`);
    revalidatePath(`/my/trips/${tripId}`);

    const endTime = Date.now();

    return {
      success: true,
      data: {
        success: true,
        tripId,
        itinerary,
        statistics,
        errors: errors.length > 0 ? errors : undefined,
        completedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("??[理쒖쟻???쒕쾭 ?≪뀡 ?ㅽ뙣] optimizeRoute ?ㅽ뙣", {
      tripId: input.tripId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    return {
      success: false,
      error: {
        code: "UNKNOWN",
        message: "理쒖쟻??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄?댁＜?몄슂.",
      },
    };
  }
}





