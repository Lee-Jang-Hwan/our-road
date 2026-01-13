import Image from "next/image";
import Link from "next/link";

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
          <Image
            src="/2026.png"
            alt="RootUs logo"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl"
          />
          <span className="text-2xl font-bold">RootUs</span>
        </Link>
      </div>

      {/* 인증 컴포넌트 */}
      {children}
    </div>
  );
}
