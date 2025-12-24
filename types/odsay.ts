// ============================================
// ODsay API Types (대중교통 API 응답 타입)
// ============================================

/**
 * ODsay API 공통 응답 구조
 */
export interface ODsayResponse<T> {
  result: T;
}

/**
 * ODsay 대중교통 경로 검색 요청 파라미터
 */
export interface ODsaySearchPathRequest {
  /** 출발지 경도 (X) */
  SX: number;
  /** 출발지 위도 (Y) */
  SY: number;
  /** 도착지 경도 (X) */
  EX: number;
  /** 도착지 위도 (Y) */
  EY: number;
  /** 정렬 기준 (0: 추천순, 1: 시간순, 2: 환승횟수순, 3: 도보거리순) */
  OPT?: 0 | 1 | 2 | 3;
  /** 검색 유형 (0: 도시내, 1: 도시간, 2: 통합) */
  SearchType?: 0 | 1 | 2;
  /** API 키 */
  apiKey: string;
}

/**
 * ODsay 대중교통 경로 검색 응답
 */
export interface ODsaySearchPathResult {
  /** 검색 유형 */
  searchType: number;
  /** 출발지 정보 */
  outTrafficCheck: number;
  /** 목적지 정보 */
  busCount: number;
  /** 경로 수 */
  subwayCount: number;
  /** 경로 수 */
  subwayBusCount: number;
  /** 경로 수 */
  pointDistance: number;
  /** 출발지 시/도 코드 */
  startRadius: number;
  /** 목적지 시/도 코드 */
  endRadius: number;
  /** 경로 목록 */
  path: ODsayPath[];
}

/**
 * ODsay 경로 정보
 */
export interface ODsayPath {
  /** 경로 유형 (1: 지하철, 2: 버스, 3: 버스+지하철) */
  pathType: 1 | 2 | 3;
  /** 경로 정보 */
  info: ODsayPathInfo;
  /** 구간 정보 */
  subPath: ODsaySubPath[];
}

/**
 * ODsay 경로 상세 정보
 */
export interface ODsayPathInfo {
  /** 요금 (원) */
  payment: number;
  /** 버스 요금 (원) */
  busTransitCount: number;
  /** 지하철 요금 (원) */
  subwayTransitCount: number;
  /** 거리 (미터) */
  mapObj: string;
  /** 첫차 시간 */
  firstStartStation: string;
  /** 막차 시간 */
  lastStartStation: string;
  /** 총 소요 시간 (분) */
  totalTime: number;
  /** 총 거리 (미터) */
  totalDistance: number;
  /** 전체 환승 횟수 */
  totalWalk: number;
  /** 전체 도보 시간 (분) */
  totalWalkTime: number;
  /** 버스 환승 횟수 */
  busStationCount: number;
  /** 지하철 환승 횟수 */
  subwayStationCount: number;
  /** 버스 이동 시간 (분) */
  trafficDistance: number;
}

/**
 * ODsay 구간 정보
 */
export interface ODsaySubPath {
  /** 이동 수단 유형 (1: 지하철, 2: 버스, 3: 도보) */
  trafficType: 1 | 2 | 3;
  /** 거리 (미터) */
  distance: number;
  /** 소요 시간 (분) */
  sectionTime: number;
  /** 정류장 수 */
  stationCount?: number;
  /** 이동 정보 (도보일 경우 없음) */
  lane?: ODsayLane[];
  /** 구간 시작 정류장/역 이름 */
  startName?: string;
  /** 구간 시작 정류장/역 좌표 X */
  startX?: number;
  /** 구간 시작 정류장/역 좌표 Y */
  startY?: number;
  /** 구간 시작 정류장/역 ID */
  startID?: number;
  /** 구간 종료 정류장/역 이름 */
  endName?: string;
  /** 구간 종료 정류장/역 좌표 X */
  endX?: number;
  /** 구간 종료 정류장/역 좌표 Y */
  endY?: number;
  /** 구간 종료 정류장/역 ID */
  endID?: number;
  /** 방면 정보 (지하철) */
  way?: string;
  /** 방면 코드 (지하철) */
  wayCode?: number;
  /** 문 열림 방향 (지하철) */
  door?: string;
  /** 정류장 목록 */
  passStopList?: {
    stations: ODsayStation[];
  };
}

/**
 * ODsay 노선 정보
 */
export interface ODsayLane {
  /** 노선명 */
  name: string;
  /** 버스 번호 (버스인 경우) */
  busNo?: string;
  /** 버스 유형 (버스인 경우) */
  type?: number;
  /** 버스 ID (버스인 경우) */
  busID?: number;
  /** 지하철 노선 ID (지하철인 경우) */
  subwayCode?: number;
  /** 지하철 노선 색상 (지하철인 경우) */
  subwayCityCode?: number;
}

/**
 * ODsay 정류장/역 정보
 */
export interface ODsayStation {
  /** 정류장/역 순번 */
  index: number;
  /** 정류장/역 ID */
  stationID: number;
  /** 정류장/역 이름 */
  stationName: string;
  /** 좌표 X */
  x: string;
  /** 좌표 Y */
  y: string;
  /** 도시 코드 */
  cityCode?: number;
  /** 지역명 */
  localStationID?: string;
  /** 누적 시간 */
  stationCityCode?: number;
  /** 노선 그래프 */
  isNonStop?: string;
}

/**
 * ODsay 에러 응답
 */
export interface ODsayError {
  error: {
    code: number;
    msg: string;
  };
}

/**
 * ODsay 버스 유형 코드
 */
export type ODsayBusType =
  | 1 // 일반
  | 2 // 좌석
  | 3 // 마을
  | 4 // 직행좌석
  | 5 // 공항
  | 6 // 간선
  | 7 // 외곽
  | 10 // 마을
  | 11 // 간선
  | 12 // 지선
  | 13 // 순환
  | 14 // 광역
  | 15 // 급행
  | 16 // 관광
  | 20 // 농어촌
  | 21 // 제주
  | 22 // 시외
  | 26; // 급행간선

/**
 * ODsay 버스 유형 매핑
 */
export const ODSAY_BUS_TYPE_MAP: Record<ODsayBusType, string> = {
  1: "일반",
  2: "좌석",
  3: "마을",
  4: "직행좌석",
  5: "공항",
  6: "간선",
  7: "외곽",
  10: "마을",
  11: "간선",
  12: "지선",
  13: "순환",
  14: "광역",
  15: "급행",
  16: "관광",
  20: "농어촌",
  21: "제주",
  22: "시외",
  26: "급행간선",
};

/**
 * ODsay 지하철 노선 코드
 */
export type ODsaySubwayCode =
  | 1 // 1호선
  | 2 // 2호선
  | 3 // 3호선
  | 4 // 4호선
  | 5 // 5호선
  | 6 // 6호선
  | 7 // 7호선
  | 8 // 8호선
  | 9 // 9호선
  | 100 // 분당선
  | 101 // 공항철도
  | 102 // 자기부상
  | 104 // 경의중앙선
  | 107 // 에버라인
  | 108 // 경춘선
  | 109 // 신분당선
  | 110 // 의정부경전철
  | 112 // 경강선
  | 113 // 우이신설
  | 114 // 서해선
  | 115 // 김포골드라인
  | 116 // 수인분당선
  | 117 // GTX-A
  | 21 // 인천1호선
  | 22 // 인천2호선
  | 31 // 대전1호선
  | 41 // 대구1호선
  | 42 // 대구2호선
  | 43 // 대구3호선
  | 51 // 광주1호선
  | 71 // 부산1호선
  | 72 // 부산2호선
  | 73 // 부산3호선
  | 74 // 부산4호선
  | 78 // 동해선
  | 79; // 부산김해경전철

/**
 * ODsay 지하철 노선 매핑
 */
export const ODSAY_SUBWAY_LINE_MAP: Record<ODsaySubwayCode, string> = {
  1: "1호선",
  2: "2호선",
  3: "3호선",
  4: "4호선",
  5: "5호선",
  6: "6호선",
  7: "7호선",
  8: "8호선",
  9: "9호선",
  100: "분당선",
  101: "공항철도",
  102: "자기부상",
  104: "경의중앙선",
  107: "에버라인",
  108: "경춘선",
  109: "신분당선",
  110: "의정부경전철",
  112: "경강선",
  113: "우이신설",
  114: "서해선",
  115: "김포골드라인",
  116: "수인분당선",
  117: "GTX-A",
  21: "인천1호선",
  22: "인천2호선",
  31: "대전1호선",
  41: "대구1호선",
  42: "대구2호선",
  43: "대구3호선",
  51: "광주1호선",
  71: "부산1호선",
  72: "부산2호선",
  73: "부산3호선",
  74: "부산4호선",
  78: "동해선",
  79: "부산김해경전철",
};

/**
 * ODsay SubPath를 TransitSegment로 변환하는 헬퍼 함수
 */
export function convertODsaySubPathToSegment(
  subPath: ODsaySubPath
): import("./route").RouteSegment | import("./route").TransitSegment {
  if (subPath.trafficType === 3) {
    // 도보
    return {
      mode: "walking",
      distance: subPath.distance,
      duration: subPath.sectionTime,
    };
  }

  const lane = subPath.lane?.[0];

  if (subPath.trafficType === 1) {
    // 지하철
    return {
      mode: "subway",
      lineName: lane?.name,
      startStation: subPath.startName || "",
      endStation: subPath.endName || "",
      stationCount: subPath.stationCount,
      duration: subPath.sectionTime,
      distance: subPath.distance,
    };
  }

  // 버스
  return {
    mode: "bus",
    lineName: lane?.busNo || lane?.name,
    startStation: subPath.startName || "",
    endStation: subPath.endName || "",
    stationCount: subPath.stationCount,
    duration: subPath.sectionTime,
    distance: subPath.distance,
  };
}

/**
 * ODsay Path를 TransitRoute로 변환하는 헬퍼 함수
 */
export function convertODsayPathToTransitRoute(
  path: ODsayPath
): import("./route").TransitRoute {
  const segments = path.subPath.map(convertODsaySubPathToSegment);

  // 도보 시간/거리 계산
  const walkingInfo = path.subPath
    .filter((sp) => sp.trafficType === 3)
    .reduce(
      (acc, sp) => ({
        walkingTime: acc.walkingTime + sp.sectionTime,
        walkingDistance: acc.walkingDistance + sp.distance,
      }),
      { walkingTime: 0, walkingDistance: 0 }
    );

  // 환승 횟수 계산 (도보 제외 구간 수 - 1)
  const transferCount = Math.max(
    0,
    path.subPath.filter((sp) => sp.trafficType !== 3).length - 1
  );

  return {
    totalDuration: path.info.totalTime,
    totalDistance: path.info.totalDistance,
    totalFare: path.info.payment,
    transferCount,
    segments,
    walkingTime: walkingInfo.walkingTime,
    walkingDistance: walkingInfo.walkingDistance,
  };
}
