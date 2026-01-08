import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import {
  LuMapPin,
  LuRoute,
  LuClock,
  LuSparkles,
  LuChevronRight,
} from "react-icons/lu";

export default function Home() {
  return (
    <main className="flex flex-col min-h-[calc(100dvh-64px)] px-4">
      {/* Hero Section */}
      <section>
        <div className="space-y-3">
          {/* 메인 타이틀 */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight">
              여행 동선,
              <br />
              <span className="text-primary">AI가 최적화</span>해드려요
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              가고 싶은 장소만 선택하면
              <br />
              가장 효율적인 여행 일정을 만들어드립니다
            </p>
          </div>

          {/* 주요 기능 */}
          <div className="grid grid-cols-2 gap-3 py-1">
          <FeatureCard
              icon={<LuClock className="w-5 h-5" />}
              title="날짜 선택"
              description="여행 날짜를를 선택하세요"
            />
            <FeatureCard
              icon={<LuMapPin className="w-5 h-5" />}
              title="장소 선택"
              description="가고 싶은 곳을 검색하세요"
            />
            <FeatureCard
              icon={<LuRoute className="w-5 h-5" />}
              title="동선 최적화"
              description="이동 시간을 최소화"
            />

            <FeatureCard
              icon={<LuSparkles className="w-5 h-5" />}
              title="최고의 만족감"
              description="이동 피로도를 고려한 루트"
            />
            
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="space-y-3 py-8">
        <SignedOut>
          <Link href="/sign-in" className="block">
            <Button className="w-full h-14 text-lg font-semibold">
              시작하기
              <LuChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link href="/sign-in" className="text-primary underline">
              로그인
            </Link>
          </p>
        </SignedOut>

        <SignedIn>
          <Link href="/plan" className="block" replace>
            <Button className="w-full h-14 text-lg font-semibold">
              새 여행 만들기
              <LuChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </Link>
          <Link href="/my" className="block">
            <Button variant="outline" className="w-full h-12">
              내 여행 보기
            </Button>
          </Link>
        </SignedIn>
      </section>

      {/* Footer */}
      <footer className="pt-16 pb-4">
        <p className="text-center text-xs text-muted-foreground">
          OurRoad - AI 기반 여행 동선 최적화 서비스
        </p>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-muted/50 border">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
