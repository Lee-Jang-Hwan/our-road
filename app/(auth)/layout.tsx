import Link from "next/link";
import { LuRoute } from "react-icons/lu";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 로고 헤더 */}
      <div className="py-6 px-4">
        <Link href="/" className="flex items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <LuRoute className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">OurRoad</span>
        </Link>
      </div>

      {/* 인증 컴포넌트 */}
      {children}
    </div>
  );
}
