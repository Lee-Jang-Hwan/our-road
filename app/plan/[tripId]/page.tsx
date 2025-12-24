"use client";

import { use } from "react";
import Link from "next/link";
import { LuChevronLeft, LuMapPin, LuCalendarClock, LuSparkles, LuSettings } from "react-icons/lu";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TripStatus } from "@/types/trip";

interface TripEditPageProps {
  params: Promise<{ tripId: string }>;
}

export default function TripEditPage({ params }: TripEditPageProps) {
  const { tripId } = use(params);

  // TODO: 실제 여행 데이터 로드
  const trip: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    status: TripStatus;
    placeCount: number;
    fixedScheduleCount: number;
  } = {
    id: tripId,
    title: "제주도 여행",
    startDate: "2025-01-15",
    endDate: "2025-01-18",
    status: "draft",
    placeCount: 0,
    fixedScheduleCount: 0,
  };

  const steps = [
    {
      icon: LuMapPin,
      title: "장소 추가",
      description: "방문하고 싶은 장소들을 추가하세요",
      href: `/plan/${tripId}/places`,
      count: trip.placeCount,
      countLabel: "개 장소",
      isComplete: trip.placeCount > 0,
    },
    {
      icon: LuCalendarClock,
      title: "고정 일정 설정",
      description: "예약된 시간이 있다면 설정하세요",
      href: `/plan/${tripId}/schedule`,
      count: trip.fixedScheduleCount,
      countLabel: "개 일정",
      isComplete: false,
      isOptional: true,
    },
    {
      icon: LuSparkles,
      title: "일정 최적화",
      description: "AI가 최적의 동선을 계획해드려요",
      href: `/plan/${tripId}/result`,
      isComplete: trip.status === "optimized",
      disabled: trip.placeCount === 0,
    },
  ];

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Link href="/my">
            <Button variant="ghost" size="icon" className="shrink-0">
              <LuChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold text-lg">{trip.title}</h1>
            <p className="text-xs text-muted-foreground">
              {trip.startDate} ~ {trip.endDate}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <LuSettings className="w-5 h-5" />
        </Button>
      </header>

      {/* 단계 카드 목록 */}
      <div className="flex-1 px-4 py-6 space-y-4">
        <p className="text-sm text-muted-foreground mb-4">
          아래 단계를 따라 여행을 계획해보세요
        </p>

        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.title}
              href={step.disabled ? "#" : step.href}
              className={step.disabled ? "pointer-events-none" : ""}
            >
              <Card
                className={`transition-all ${
                  step.disabled
                    ? "opacity-50"
                    : "hover:border-primary hover:shadow-sm"
                }`}
              >
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      step.isComplete
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="text-sm font-semibold">{index + 1}</span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{step.title}</CardTitle>
                      {step.isOptional && (
                        <Badge variant="secondary" className="text-xs">
                          선택
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{step.description}</CardDescription>
                  </div>
                  <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                </CardHeader>
                {step.count !== undefined && step.count > 0 && (
                  <CardContent className="pt-0 pb-3">
                    <p className="text-sm text-primary font-medium">
                      {step.count}
                      {step.countLabel}
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          );
        })}
      </div>

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
        <Link href={`/plan/${tripId}/result`}>
          <Button
            className="w-full h-12"
            disabled={trip.placeCount === 0}
          >
            <LuSparkles className="w-4 h-4 mr-2" />
            일정 최적화하기
          </Button>
        </Link>
      </div>
    </main>
  );
}
