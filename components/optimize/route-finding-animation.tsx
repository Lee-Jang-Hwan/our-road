"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";

const MESSAGES = [
  "장소들을 연결하고 있어요",
  "최적의 경로를 탐색 중...",
  "일정을 최적화하고 있어요",
  "거의 다 됐어요!",
];

// 마커 색상 팔레트 (파스텔)
const MARKER_COLORS = [
  "#FF8A80", // 코랄
  "#80DEEA", // 민트
  "#FFE082", // 레몬
  "#CE93D8", // 라벤더
  "#FFAB91", // 피치
  "#A5D6A7", // 연녹색
];

// 마커 위치들 (겹치지 않도록 미리 정의)
const MARKER_POSITIONS = [
  { x: 18, y: 22 },
  { x: 78, y: 18 },
  { x: 82, y: 58 },
  { x: 22, y: 72 },
  { x: 52, y: 42 },
  { x: 48, y: 78 },
];

interface MarkerState {
  id: number;
  x: number;
  y: number;
  color: string;
  visited: boolean;
  visible: boolean;
}

interface RouteFindingAnimationProps {
  className?: string;
}

// 미니 나무 SVG
function MiniTree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="-8" rx="8" ry="10" className="fill-[#81C784]" />
      <rect x="-2" y="0" width="4" height="6" className="fill-amber-700" />
    </g>
  );
}

// 미니 집 SVG
function MiniHouse({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-8" y="-4" width="16" height="12" className="fill-[#FFCC80]" />
      <polygon points="0,-12 -10,-4 10,-4" className="fill-[#FF8A65]" />
      <rect x="-3" y="2" width="6" height="6" className="fill-amber-700" />
    </g>
  );
}

// 공원/녹지 SVG
function MiniPark({ x, y }: { x: number; y: number }) {
  return (
    <ellipse cx={x} cy={y} rx="18" ry="12" className="fill-[#C5E1A5]" opacity="0.7" />
  );
}

// 호수 SVG
function MiniLake({ x, y }: { x: number; y: number }) {
  return (
    <ellipse cx={x} cy={y} rx="14" ry="8" className="fill-[#B3E5FC]" opacity="0.8" />
  );
}

// 귀여운 핀 마커 SVG
function CuteMarker({
  x,
  y,
  color,
  visited,
  visible,
}: {
  x: number;
  y: number;
  color: string;
  visited: boolean;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      className={cn(
        visible && "animate-[markerPop_0.5s_ease-out_forwards]",
        visited && "animate-[markerComplete_0.3s_ease-out]"
      )}
    >
      {/* 마커 그림자 */}
      <ellipse cx="0" cy="2" rx="6" ry="3" className="fill-black/20" />

      {/* 마커 꼬리 */}
      <path d="M0 0 L-6 -14 Q0 -10 6 -14 Z" fill={color} />

      {/* 마커 머리 (원) */}
      <circle cx="0" cy="-18" r="10" fill={color} />
      <circle cx="0" cy="-18" r="7" className="fill-white/30" />

      {/* 체크마크 (방문 완료 시) */}
      {visited && (
        <g className="animate-[checkPop_0.4s_ease-out_forwards]">
          <circle cx="0" cy="-18" r="8" className="fill-[#4CAF50]" />
          <path
            d="M-4 -18 L-1 -15 L5 -22"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </g>
  );
}

// 경로 점선
function PathLine({
  fromX,
  fromY,
  toX,
  toY,
  visible,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  visible: boolean;
}) {
  if (!visible) return null;

  const pathLength = Math.sqrt(
    Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2)
  );

  return (
    <line
      x1={fromX}
      y1={fromY}
      x2={toX}
      y2={toY}
      className="stroke-primary/50"
      strokeWidth="2"
      strokeDasharray="6,4"
      strokeLinecap="round"
      style={{
        strokeDashoffset: pathLength,
        animation: `drawPath 0.8s ease-out forwards`,
      }}
    />
  );
}

// 축소된 귀여운 자동차 SVG
function MiniCar({ rotation = 0 }: { rotation: number }) {
  return (
    <g
      transform={`rotate(${rotation})`}
      className="animate-[carDrive_0.4s_ease-in-out_infinite]"
    >
      {/* 차체 그림자 */}
      <ellipse cx="0" cy="10" rx="14" ry="3" className="fill-black/15" />

      {/* 차체 하단 */}
      <rect x="-16" y="-4" width="32" height="10" rx="3" className="fill-primary" />

      {/* 차체 상단 (캐빈) */}
      <path d="M-8 -4 Q-8 -12 0 -12 Q8 -12 8 -4 Z" className="fill-primary" />

      {/* 창문 */}
      <path d="M-6 -5 Q-6 -10 0 -10 Q6 -10 6 -5 Z" className="fill-sky-200" />

      {/* 창문 반사 */}
      <path d="M-4 -6 Q-4 -9 -1 -9 Q1 -9 1 -7 Z" className="fill-white/50" />

      {/* 헤드라이트 */}
      <ellipse cx="14" cy="1" rx="2" ry="3" className="fill-yellow-300" />

      {/* 후미등 */}
      <ellipse cx="-14" cy="1" rx="1.5" ry="2" className="fill-red-400" />

      {/* 앞바퀴 */}
      <circle cx="10" cy="6" r="4" className="fill-gray-700" />
      <circle cx="10" cy="6" r="2.5" className="fill-gray-500" />

      {/* 뒷바퀴 */}
      <circle cx="-10" cy="6" r="4" className="fill-gray-700" />
      <circle cx="-10" cy="6" r="2.5" className="fill-gray-500" />
    </g>
  );
}

// 일러스트 스타일 지도 배경
function MapBackground() {
  return (
    <>
      {/* 도로들 */}
      <path
        d="M0 50 Q80 40, 150 60 Q220 80, 300 50"
        fill="none"
        className="stroke-[#E0D5C7] dark:stroke-[#4A5568]"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M50 0 Q60 80, 40 150 Q20 220, 60 280"
        fill="none"
        className="stroke-[#E0D5C7] dark:stroke-[#4A5568]"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M200 0 Q180 100, 220 180 Q260 260, 200 280"
        fill="none"
        className="stroke-[#E0D5C7] dark:stroke-[#4A5568]"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M100 120 Q150 110, 200 140"
        fill="none"
        className="stroke-[#E0D5C7] dark:stroke-[#4A5568]"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* 공원/녹지 */}
      <MiniPark x={240} y={200} />
      <MiniPark x={60} y={120} />

      {/* 호수 */}
      <MiniLake x={180} y={80} />

      {/* 나무들 */}
      <MiniTree x={30} y={180} scale={0.9} />
      <MiniTree x={260} y={60} scale={0.8} />
      <MiniTree x={120} y={230} scale={1} />
      <MiniTree x={220} y={240} scale={0.85} />

      {/* 집들 */}
      <MiniHouse x={90} y={70} />
      <MiniHouse x={250} y={140} />
      <MiniHouse x={140} y={180} />
    </>
  );
}

export function RouteFindingAnimation({
  className,
}: RouteFindingAnimationProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [markers, setMarkers] = useState<MarkerState[]>([]);
  const [carPosition, setCarPosition] = useState({ x: 150, y: 140 });
  const [carRotation, setCarRotation] = useState(0);
  const [paths, setPaths] = useState<Array<{ from: MarkerState; to: MarkerState }>>([]);

  // 초기 마커 데이터 생성
  const initialMarkers = useMemo(() => {
    return MARKER_POSITIONS.map((pos, i) => ({
      id: i,
      x: (pos.x / 100) * 300,
      y: (pos.y / 100) * 280,
      color: MARKER_COLORS[i],
      visited: false,
      visible: false,
    }));
  }, []);

  // 자동차 회전 각도 계산
  const calculateRotation = useCallback((fromX: number, fromY: number, toX: number, toY: number) => {
    const angle = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);
    return angle;
  }, []);

  // 애니메이션 시퀀스 실행
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];

    const runAnimation = () => {
      // 리셋
      setMarkers(initialMarkers.map(m => ({ ...m, visited: false, visible: false })));
      setCarPosition({ x: 150, y: 140 });
      setCarRotation(0);
      setPaths([]);

      // 마커 순차 표시 (각 0.3초 간격)
      initialMarkers.forEach((marker, i) => {
        const timeout = setTimeout(() => {
          setMarkers(prev => prev.map((m, idx) =>
            idx === i ? { ...m, visible: true } : m
          ));
        }, i * 300);
        timeouts.push(timeout);
      });

      // 자동차 이동 시작 (마커 모두 표시 후)
      const startMovingDelay = initialMarkers.length * 300 + 500;

      initialMarkers.forEach((marker, i) => {
        const moveDelay = startMovingDelay + i * 1200;

        // 자동차 이동
        const moveTimeout = setTimeout(() => {
          // 이전 위치에서 회전 각도 계산
          setCarPosition(prev => {
            const newRotation = calculateRotation(prev.x, prev.y, marker.x, marker.y);
            setCarRotation(newRotation);
            return prev;
          });

          // 약간의 지연 후 실제 이동
          setTimeout(() => {
            setCarPosition({ x: marker.x, y: marker.y });
          }, 50);
        }, moveDelay);
        timeouts.push(moveTimeout);

        // 마커 방문 완료 표시
        const visitTimeout = setTimeout(() => {
          setMarkers(prev => prev.map((m, idx) =>
            idx === i ? { ...m, visited: true } : m
          ));

          // 경로 추가
          if (i > 0) {
            setPaths(prev => [...prev, {
              from: initialMarkers[i - 1],
              to: marker
            }]);
          }
        }, moveDelay + 900);
        timeouts.push(visitTimeout);
      });
    };

    // 초기 실행
    runAnimation();

    // 전체 루프 (10초 간격)
    const loopInterval = setInterval(runAnimation, 10000);

    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(loopInterval);
    };
  }, [initialMarkers, calculateRotation]);

  // 메시지 순환
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn("flex flex-col items-center justify-center py-6", className)}
    >
      {/* 지도 컨테이너 */}
      <div className="relative w-72 h-52 md:w-80 md:h-56 overflow-hidden rounded-2xl bg-[#FDF6E3] dark:bg-[#2D3748] shadow-lg">
        <svg
          viewBox="0 0 300 280"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* 배경 */}
          <MapBackground />

          {/* 경로 점선들 */}
          {paths.map((path, i) => (
            <PathLine
              key={i}
              fromX={path.from.x}
              fromY={path.from.y}
              toX={path.to.x}
              toY={path.to.y}
              visible={true}
            />
          ))}

          {/* 마커들 */}
          {markers.map((marker) => (
            <CuteMarker
              key={marker.id}
              x={marker.x}
              y={marker.y}
              color={marker.color}
              visited={marker.visited}
              visible={marker.visible}
            />
          ))}

          {/* 자동차 */}
          <g
            style={{
              transform: `translate(${carPosition.x}px, ${carPosition.y}px)`,
              transition: "transform 0.9s ease-in-out",
            }}
          >
            <MiniCar rotation={carRotation} />
          </g>
        </svg>
      </div>

      {/* 상태 메시지 */}
      <div className="mt-6 text-center">
        <p className="text-lg font-semibold text-foreground">
          경로를 찾고 있어요
        </p>
        <p
          className="text-sm text-muted-foreground mt-1.5 min-h-[20px] transition-opacity duration-500"
          key={messageIndex}
        >
          {MESSAGES[messageIndex]}
        </p>
      </div>

      {/* 진행 인디케이터 */}
      <div className="flex gap-1.5 mt-5">
        {MESSAGES.map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              i === messageIndex ? "bg-primary w-6" : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>

      {/* 안내 문구 - 웨이브 효과 */}
      <div className="mt-6 px-4">
        <p className="text-base font-extrabold flex flex-wrap justify-center text-black dark:text-black">
          {"현재 시간 기준으로 최적화된 경로를 탐색합니다".split("").map((char, i) => (
            <span
              key={i}
              className="inline-block animate-[textWave_1.5s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
