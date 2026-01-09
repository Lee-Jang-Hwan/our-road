import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { BackgroundMedia } from "@/components/landing/background-media";
import { SignInModalButton } from "@/components/landing/sign-in-modal-button";

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
        {/* Headline */}
        <h1 className="text-white text-[42px] font-extrabold tracking-tight leading-tight drop-shadow-lg mb-2 font-[family-name:var(--font-chango)]">
          RootUs
        </h1>

        {/* Tagline */}
        <p className="text-white/90 text-lg drop-shadow-md font-[family-name:var(--font-single-day)]">
          우리한테 딱 맞는 여행&데이트 코스
        </p>
      </div>

      {/* Footer / Action Area */}
      <div className="relative z-10 flex w-full flex-col items-center gap-6 px-6 pb-12">
        {/* Glassmorphic Login Button */}
        <div className="w-full max-w-sm">
          <SignInModalButton />
        </div>
      </div>
    </main>
  );
}
