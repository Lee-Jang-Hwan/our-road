import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { BackgroundMedia } from "@/components/landing/background-media";

export default async function Home() {
  const { userId } = await auth();

  // 로그인 상태면 /my로 리다이렉트
  if (userId) {
    redirect("/my");
  }

  return (
    <main className="!p-0 !max-w-none relative flex h-dvh w-full flex-col justify-between overflow-hidden">
      {/* Background Video */}
      <BackgroundMedia />

      {/* Overlay for legibility */}
      <div className="absolute inset-0 landing-overlay z-[1]" />

      {/* Header Area - 빈 공간 (필요시 메뉴 아이콘 추가) */}
      <div className="relative z-10 flex w-full justify-between px-6 pt-12" />

      {/* Main Content: Brand Identity */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center animate-float-slow">
        {/* Icon/Logo Mark */}
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl ring-1 ring-white/10">
          <Image
            src="/2026.png"
            alt="OurRoad 로고"
            width={32}
            height={32}
            className="w-8 h-8"
          />
        </div>

        {/* Headline */}
        <h1 className="text-white text-[42px] font-extrabold tracking-tight leading-tight drop-shadow-lg mb-2">
          RoAId
        </h1>

      </div>

      {/* Footer / Action Area */}
      <div className="relative z-10 flex w-full flex-col items-center gap-6 px-6 pb-12">
        {/* Glassmorphic Login Button */}
        <Link href="/sign-in" className="w-full max-w-sm">
          <button className="group flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg glass-button h-14 px-5 shadow-lg">
            <span className="text-white text-base font-bold tracking-wide">
              여행가서 길 잃어버리지 말고 당장 시작하기
            </span>
          </button>
        </Link>
      </div>
    </main>
  );
}
