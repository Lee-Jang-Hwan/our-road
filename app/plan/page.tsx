"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { LuChevronLeft } from "react-icons/lu";

import { Button } from "@/components/ui/button";
import { TripForm } from "@/components/trip/trip-form";
import type { CreateTripInput } from "@/lib/schemas";

export default function NewTripPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (_data: CreateTripInput) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // TODO: Server Action으로 여행 생성
      // const trip = await createTrip(_data);
      // router.push(`/plan/${trip.id}`);

      // 임시: 랜덤 ID로 이동
      const tempId = crypto.randomUUID();
      router.push(`/plan/${tempId}`);
    } catch (error) {
      console.error("여행 생성 실패:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100dvh-64px)]">
        <p className="text-muted-foreground">로딩 중...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[calc(100dvh-64px)] px-4 gap-4">
        <p className="text-muted-foreground">로그인이 필요합니다</p>
        <Link href="/sign-in">
          <Button>로그인하기</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <Link href="/">
          <Button variant="ghost" size="icon" className="shrink-0">
            <LuChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="font-semibold text-lg">새 여행 만들기</h1>
      </header>

      {/* 폼 */}
      <div className="flex-1 px-4 py-6">
        <TripForm
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
          submitText="여행 만들기"
        />
      </div>
    </main>
  );
}
