"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LuLoader } from "react-icons/lu";

interface ResultPageProps {
  params: Promise<{ tripId: string }>;
}

export default function ResultPage({ params }: ResultPageProps) {
  const { tripId } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/my/trips/${tripId}`);
  }, [tripId, router]);

  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100dvh-64px)]">
      <LuLoader className="w-8 h-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">페이지를 이동하고 있습니다...</p>
    </main>
  );
}
