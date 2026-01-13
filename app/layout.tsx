import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { koKR } from "@clerk/localizations";
import { Geist, Geist_Mono, Single_Day, Chango } from "next/font/google";

import { SyncUserProvider } from "@/components/providers/sync-user-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const singleDay = Single_Day({
  variable: "--font-single-day",
  weight: "400",
});

const chango = Chango({
  variable: "--font-chango",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "RootUs",
    template: "%s | RootUs",
  },
  description: "우리한테 딱 맞는 여행&데이트 코스",
  applicationName: "RootUs",
  keywords: ["여행", "데이트", "코스", "최적화", "일정", "여행지", "데이트코스"],
  authors: [{ name: "RootUs Team" }],
  creator: "RootUs",
  publisher: "RootUs",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    title: "RootUs",
    description: "우리한테 딱 맞는 여행&데이트 코스",
    siteName: "RootUs",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RootUs - 우리한테 딱 맞는 여행&데이트 코스",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RootUs",
    description: "우리한테 딱 맞는 여행&데이트 코스",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [{ url: "/2026.png", sizes: "1024x1024", type: "image/png" }],
    apple: [{ url: "/2026.png", sizes: "1024x1024", type: "image/png" }],
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover", // iOS Safe Area 지원
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={koKR}>
      <html lang="ko">
        <head>
          <script
            type="text/javascript"
            src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`}
            async
          />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${singleDay.variable} ${chango.variable} antialiased desktop-background`}
        >
          <SyncUserProvider>
            <div className="app-container-safe">
              {children}
            </div>
            <Toaster position="top-center" richColors closeButton />
          </SyncUserProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
