"use client";

import * as React from "react";
import {
  Car,
  TrainFront,
  Footprints,
  ArrowDown,
  Clock,
  Route,
  Banknote,
  Bus,
  Train,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  RouteSegment as RouteSegmentType,
  TransportMode,
} from "@/types/route";

// 이동수단 아이콘
const transportIcons: Record<TransportMode, React.ReactNode> = {
  walking: <Footprints className="h-3.5 w-3.5" />,
  public: <TrainFront className="h-3.5 w-3.5" />,
  car: <Car className="h-3.5 w-3.5" />,
};

// 이동수단 라벨
const transportLabels: Record<TransportMode, string> = {
  walking: "도보",
  public: "대중교통",
  car: "자동차",
};

// 시간 포맷팅 (분 -> 시간분)
const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
};

// 거리 포맷팅 (미터 -> km/m)
const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${meters}m`;
};

interface RouteSegmentProps {
  /** 이동 구간 정보 */
  segment: RouteSegmentType;
  /** 간소화 표시 */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 구간별 이동 정보 컴포넌트
 * - 이동수단 아이콘
 * - 소요시간, 거리
 */
/**
 * 대중교통 구간의 주요 교통수단 라벨 반환
 */
function getPublicTransportLabel(segment: RouteSegmentType): string {
  if (segment.mode !== "public" || !segment.transitDetails) {
    return transportLabels[segment.mode];
  }

  // 대중교통 구간만 필터링 (도보 제외)
  const transitPaths = segment.transitDetails.subPaths.filter(
    (sp) => sp.trafficType !== 3,
  );

  if (transitPaths.length === 0) {
    return transportLabels[segment.mode];
  }

  // 디버깅: 열차 구간 확인
  if (process.env.NODE_ENV === "development") {
    const trainPaths = transitPaths.filter((sp) => sp.trafficType === 10);
    if (trainPaths.length > 0) {
      console.log("[getPublicTransportLabel] 열차 구간 발견:", {
        trainPathsCount: trainPaths.length,
        trainPaths: trainPaths.map((sp) => ({
          trafficType: sp.trafficType,
          lane: sp.lane,
          laneName: sp.lane?.name,
          startName: sp.startName,
          endName: sp.endName,
        })),
      });
    }
  }

  // 주요 교통수단 우선순위: 열차 > 고속버스 > 시외버스 > 지하철 > 버스
  const priorityOrder = [10, 11, 12, 1, 2];
  for (const priority of priorityOrder) {
    const found = transitPaths.find((sp) => sp.trafficType === priority);
    if (found) {
      // 열차의 경우 노선명 우선 표시 (KTX, 새마을 등)
      if (found.trafficType === 10) {
        // lane.name이 있으면 노선명 사용, 없으면 "열차" 표시
        const result =
          found.lane?.name && found.lane.name.trim() ? found.lane.name : "열차";
        if (process.env.NODE_ENV === "development") {
          console.log("[getPublicTransportLabel] 열차 구간 라벨 결정:", {
            laneName: found.lane?.name,
            result,
          });
        }
        return result;
      }
      // 다른 교통수단은 lane.name이 있으면 사용, 없으면 기본 라벨
      const label = getTrafficLabel(found.trafficType);
      if (found.lane?.name && found.lane.name.trim()) {
        return found.lane.name;
      }
      return label;
    }
  }

  // 우선순위에 없으면 첫 번째 구간의 라벨 사용
  const firstPath = transitPaths[0];
  if (firstPath.trafficType === 10) {
    // 열차인 경우
    const result =
      firstPath.lane?.name && firstPath.lane.name.trim()
        ? firstPath.lane.name
        : "열차";
    if (process.env.NODE_ENV === "development") {
      console.log("[getPublicTransportLabel] 첫 번째 구간이 열차, 라벨 결정:", {
        laneName: firstPath.lane?.name,
        result,
      });
    }
    return result;
  }
  return getTrafficLabel(firstPath.trafficType);
}

/**
 * 대중교통 구간의 주요 교통수단 아이콘 반환
 */
function getPublicTransportIcon(segment: RouteSegmentType): React.ReactNode {
  if (segment.mode !== "public" || !segment.transitDetails) {
    return transportIcons[segment.mode];
  }

  // 대중교통 구간만 필터링 (도보 제외)
  const transitPaths = segment.transitDetails.subPaths.filter(
    (sp) => sp.trafficType !== 3,
  );

  if (transitPaths.length === 0) {
    return transportIcons[segment.mode];
  }

  // 주요 교통수단 우선순위: 열차 > 고속버스 > 시외버스 > 지하철 > 버스
  const priorityOrder = [10, 11, 12, 1, 2];
  for (const priority of priorityOrder) {
    const found = transitPaths.find((sp) => sp.trafficType === priority);
    if (found) {
      return getTrafficIcon(found.trafficType, "h-3.5 w-3.5");
    }
  }

  // 우선순위에 없으면 첫 번째 구간의 아이콘 사용
  return getTrafficIcon(transitPaths[0].trafficType, "h-3.5 w-3.5");
}

export function RouteSegment({
  segment,
  compact = false,
  className,
}: RouteSegmentProps) {
  const icon =
    segment.mode === "public"
      ? getPublicTransportIcon(segment)
      : transportIcons[segment.mode] || <ArrowDown className="h-3.5 w-3.5" />;
  const label =
    segment.mode === "public"
      ? getPublicTransportLabel(segment)
      : transportLabels[segment.mode];

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap",
          className,
        )}
      >
        {icon}
        <span>{formatDuration(segment.duration)}</span>
        {segment.mode === "car" && segment.taxiFare && segment.taxiFare > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-foreground text-[10px] font-medium">
              택시 ₩{segment.taxiFare.toLocaleString()}
            </span>
          </>
        )}
        {segment.mode === "car" && segment.fare && segment.fare > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-blue-600 text-[10px] font-medium">
              톨비 ₩{segment.fare.toLocaleString()}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1.5 rounded-md">
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-medium text-foreground">{label}</span>
      </div>

      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatDuration(segment.duration)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Route className="h-3.5 w-3.5" />
          <span>{formatDistance(segment.distance)}</span>
        </div>
        {segment.fare && segment.fare > 0 && (
          <div className="flex items-center gap-1">
            <Banknote className="h-3.5 w-3.5" />
            <span>₩{segment.fare.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface RouteSegmentConnectorProps {
  /** 이동 구간 정보 */
  segment: RouteSegmentType;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 구간 타입에 따른 아이콘 반환
 */
function getTrafficIcon(trafficType: number, className?: string) {
  switch (trafficType) {
    case 1: // 지하철
    case 4: // 기차
      return <Train className={cn("w-3 h-3", className)} />;
    case 2: // 버스
    case 5: // 고속버스
    case 6: // 시외버스
      return <Bus className={cn("w-3 h-3", className)} />;
    case 3: // 도보
      return <Footprints className={cn("w-3 h-3", className)} />;
    default:
      return <TrainFront className={cn("w-3 h-3", className)} />;
  }
}

/**
 * 구간 타입에 따른 라벨 반환
 */
function getTrafficLabel(trafficType: number): string {
  switch (trafficType) {
    case 1:
      return "지하철";
    case 2:
      return "버스";
    case 3:
      return "도보";
    case 4:
      return "기차";
    case 5:
      return "고속버스";
    case 6:
      return "시외버스";
    default:
      return "대중교통";
  }
}

/**
 * 타임라인 스타일의 이동 구간 연결선
 */
export function RouteSegmentConnector({
  segment,
  className,
}: RouteSegmentConnectorProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const icon = transportIcons[segment.mode] || (
    <ArrowDown className="h-3.5 w-3.5" />
  );
  const hasTransitDetails = segment.mode === "public" && segment.transitDetails;
  const hasCarSegments =
    segment.mode === "car" &&
    segment.carSegments &&
    segment.carSegments.length > 0;

  // 대중교통 구간만 필터링 (도보 제외)
  const transitPaths = hasTransitDetails
    ? segment.transitDetails!.subPaths.filter((sp) => sp.trafficType !== 3)
    : [];

  // 개발 환경: 디버깅 로그
  if (process.env.NODE_ENV === "development" && segment.mode === "car") {
    console.group("🚗 [RouteSegmentConnector] 자동차 구간 정보");
    console.log("기본 정보:", {
      mode: segment.mode,
      distance: segment.distance,
      duration: segment.duration,
      description: segment.description,
    });
    console.log("요금 정보:", {
      fare: segment.fare,
      taxiFare: segment.taxiFare,
    });
    console.log("구간 정보:", {
      hasCarSegments,
      carSegmentsCount: segment.carSegments?.length ?? 0,
      guidesCount: segment.guides?.length ?? 0,
    });
    if (segment.guides && segment.guides.length > 0) {
      console.log(
        "IC/톨게이트 안내:",
        segment.guides.map((g) => ({
          name: g.name,
          distance: g.distance,
          duration: g.duration,
        })),
      );
    }
    if (segment.carSegments && segment.carSegments.length > 0) {
      console.log("구간별 상세 정보:");
      segment.carSegments.forEach((s, idx) => {
        console.log(`  구간 ${idx + 1}:`, {
          index: s.index,
          distance: `${s.distance}m`,
          duration: `${s.duration}분`,
          description: s.description || "(설명 없음)",
          tollFare: s.tollFare ? `₩${s.tollFare.toLocaleString()}` : "없음",
          guidesCount: s.guides?.length ?? 0,
          roadNamesCount: s.roadNames?.length ?? 0,
        });
        if (s.roadNames && s.roadNames.length > 0) {
          console.log(
            `    전체 도로명 (${s.roadNames.length}개):`,
            s.roadNames,
          );
        }
        if (s.guides && s.guides.length > 0) {
          console.log(
            `    IC/톨게이트:`,
            s.guides.map((g) => g.name),
          );
        }
      });
    }
    console.groupEnd();
  }

  return (
    <div className={cn("relative py-2 pl-[18px]", className)}>
      {/* 연결선 */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border" />

      {/* 이동 정보 */}
      <div className="ml-6">
        {hasTransitDetails ? (
          // 대중교통 상세 정보 표시
          <div className="space-y-1.5">
            {/* 요약 정보 (클릭하여 펼치기) */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:bg-muted/50 rounded px-2 py-1.5 -ml-2 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {icon}
                <span>{formatDuration(segment.duration)}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>{formatDistance(segment.distance)}</span>
              </div>

              {/* 노선 배지들 */}
              <div className="flex items-center gap-1 flex-wrap">
                {transitPaths.slice(0, 3).map((subPath, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                    style={{
                      backgroundColor: subPath.lane?.lineColor || "#6b7280",
                    }}
                  >
                    {getTrafficIcon(subPath.trafficType, "w-2.5 h-2.5")}
                    <span>
                      {subPath.lane?.name ||
                        getTrafficLabel(subPath.trafficType)}
                    </span>
                  </span>
                ))}
                {transitPaths.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{transitPaths.length - 3}
                  </span>
                )}
              </div>

              {/* 요금 */}
              {segment.transitDetails!.totalFare > 0 && (
                <span className="text-primary text-[10px] font-medium">
                  ₩{segment.transitDetails!.totalFare.toLocaleString()}
                </span>
              )}

              {/* 펼치기/접기 아이콘 */}
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>

            {/* 상세 구간 정보 */}
            {isExpanded && (
              <div className="ml-2 pl-3 border-l-2 border-primary/20 space-y-2">
                {segment.transitDetails!.subPaths.map((subPath, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs">
                    {/* 아이콘 */}
                    <div
                      className="flex items-center justify-center w-5 h-5 rounded-full shrink-0 mt-0.5"
                      style={{
                        backgroundColor: subPath.lane?.lineColor
                          ? `${subPath.lane.lineColor}20`
                          : "rgb(var(--muted))",
                        color: subPath.lane?.lineColor || "inherit",
                      }}
                    >
                      {getTrafficIcon(subPath.trafficType, "w-3 h-3")}
                    </div>

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      {subPath.trafficType === 3 ? (
                        // 도보
                        <span className="text-muted-foreground">
                          도보 {formatDistance(subPath.distance)} (
                          {subPath.sectionTime}분)
                        </span>
                      ) : (
                        // 대중교통
                        <div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                              style={{
                                backgroundColor:
                                  subPath.lane?.lineColor || "#6b7280",
                              }}
                            >
                              {subPath.lane?.name ||
                                getTrafficLabel(subPath.trafficType)}
                            </span>
                            {subPath.way && (
                              <span className="text-muted-foreground">
                                {subPath.way} 방면
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-foreground">
                            {subPath.startName} → {subPath.endName}
                          </div>
                          <div className="text-muted-foreground">
                            {subPath.stationCount && (
                              <span>{subPath.stationCount}개 정류장 · </span>
                            )}
                            {subPath.sectionTime}분
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : hasCarSegments ? (
          // 자동차 구간별 정보 표시
          <div className="space-y-1.5">
            {/* 요약 정보 (항상 표시) */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                {icon}
                <span>{formatDuration(segment.duration)}</span>
              </div>

              {/* 택시 요금 */}
              {segment.taxiFare && segment.taxiFare > 0 && (
                <span className="text-foreground text-xs font-medium">
                  택시 ₩{segment.taxiFare.toLocaleString()}
                </span>
              )}

              {/* 펼치기/접기 버튼 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    <span>접기</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    <span>상세</span>
                  </>
                )}
              </button>
            </div>

            {/* 상세 구간 정보 (주요 안내) */}
            {isExpanded && segment.carSegments && (
              <div className="ml-2 pl-3 border-l-2 border-primary/20 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-[14px] font-medium text-muted-foreground">
                    경로 안내
                  </div>

                  <span className="text-xs font-medium">·</span>
                  <span>{formatDistance(segment.distance)}</span>
                  {segment.fare && segment.fare > 0 && (
                    <span className="text-blue-600 text-xs font-medium">
                      톨비 ₩{segment.fare.toLocaleString()}
                    </span>
                  )}
                </div>

                {segment.carSegments.map((carSegment, index) => (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-start gap-2 text-xs">
                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-foreground font-medium">
                            {carSegment.description ||
                              `구간 ${carSegment.index + 1}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : segment.mode === "car" ? (
          // 자동차 모드 (carSegments 없어도 fare, taxiFare, guides 표시)
          <div className="space-y-1.5">
            {/* 요약 정보 */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
                {icon}
                <span>{formatDuration(segment.duration)}</span>
              </div>

              {/* 택시 요금 */}
              {segment.taxiFare && segment.taxiFare > 0 && (
                <span className="text-blue-600 text-xs font-medium">
                  택시 ₩{segment.taxiFare.toLocaleString()}
                </span>
              )}

              {/* 통행료 */}
              {segment.fare && segment.fare > 0 && (
                <span className="text-primary text-xs font-medium">
                  톨비 ₩{segment.fare.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        ) : (
          // 기본 표시 (도보 등)
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded">
              {icon}
              <span>{formatDuration(segment.duration)}</span>
              <span className="text-muted-foreground/60">·</span>
              <span>{formatDistance(segment.distance)}</span>
            </div>
            {segment.fare && segment.fare > 0 && (
              <span className="text-muted-foreground/70">
                ₩{segment.fare.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface RouteSegmentCardProps {
  /** 이동 구간 정보 */
  segment: RouteSegmentType;
  /** 출발지 이름 */
  fromName?: string;
  /** 도착지 이름 */
  toName?: string;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 카드 형태의 이동 구간 정보
 */
export function RouteSegmentCard({
  segment,
  fromName,
  toName,
  className,
}: RouteSegmentCardProps) {
  const icon =
    segment.mode === "public"
      ? getPublicTransportIcon(segment)
      : transportIcons[segment.mode] || <ArrowDown className="h-4 w-4" />;
  const label =
    segment.mode === "public"
      ? getPublicTransportLabel(segment)
      : transportLabels[segment.mode];

  return (
    <div className={cn("border rounded-lg p-3 bg-card", className)}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
      </div>

      {/* 출발/도착 */}
      {(fromName || toName) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          {fromName && <span>{fromName}</span>}
          {fromName && toName && (
            <ArrowDown className="h-3 w-3 rotate-[-90deg]" />
          )}
          {toName && <span>{toName}</span>}
        </div>
      )}

      {/* 상세 정보 */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatDuration(segment.duration)}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Route className="h-3.5 w-3.5" />
          <span>{formatDistance(segment.distance)}</span>
        </div>
        {segment.fare && segment.fare > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Banknote className="h-3.5 w-3.5" />
            <span>₩{segment.fare.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* 설명 */}
      {segment.description && (
        <p className="mt-2 text-xs text-muted-foreground">
          {segment.description}
        </p>
      )}
    </div>
  );
}

interface RouteSegmentInlineProps {
  /** 이동 구간 정보 */
  segment: RouteSegmentType;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 인라인 형태의 이동 구간 정보 (한 줄)
 */
export function RouteSegmentInline({
  segment,
  className,
}: RouteSegmentInlineProps) {
  const icon = transportIcons[segment.mode] || (
    <ArrowDown className="h-3 w-3" />
  );

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {icon}
      <span>{formatDuration(segment.duration)}</span>
      <span>·</span>
      <span>{formatDistance(segment.distance)}</span>
      {segment.fare && segment.fare > 0 && (
        <>
          <span>·</span>
          <span>₩{segment.fare.toLocaleString()}</span>
        </>
      )}
    </span>
  );
}
