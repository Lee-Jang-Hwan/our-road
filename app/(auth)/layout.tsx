import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-[calc(100dvh-64px)]">
      {/* 濡쒓퀬 ?ㅻ뜑 */}
      <div className="py-6 px-4">
        <Link href="/" className="flex items-center justify-center gap-2">
          <Image
            src="/RUrogo.png"
            alt="RootUs logo"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl"
          />
          <span className="text-2xl font-bold">RootUs</span>
        </Link>
      </div>

      {/* ?몄쬆 而댄룷?뚰듃 */}
      {children}
    </div>
  );
}
