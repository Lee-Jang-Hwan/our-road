import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { koKR } from "@clerk/localizations";
import localFont from "next/font/local";

import { SyncUserProvider } from "@/components/providers/sync-user-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const pretendard = localFont({
  src: [
    {
      path: "../public/fonts/pretendad/Pretendard-Thin.woff2",
      weight: "100",
      style: "normal",
    },
    {
      path: "../public/fonts/pretendad/Pretendard-ExtraLight.woff2",
      weight: "200",
      style: "normal",
    },
    {
      path: "../public/fonts/pretendad/Pretendard-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/pretendad/Pretendard-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/pretendad/Pretendard-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/pretendad/Pretendard-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/pretendad/Pretendard-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/pretendad/Pretendard-ExtraBold.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "../public/fonts/pretendad/Pretendard-Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-pretendard",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RootUs",
    template: "%s | RootUs",
  },
  description: "?곕━?쒗뀒 ??留욌뒗 ?ы뻾&?곗씠??肄붿뒪",
  applicationName: "RootUs",
  keywords: ["travel", "date", "course", "itinerary", "plan", "trip", "route"],
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
    description: "?곕━?쒗뀒 ??留욌뒗 ?ы뻾&?곗씠??肄붿뒪",
    siteName: "RootUs",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RootUs - ?곕━?쒗뀒 ??留욌뒗 ?ы뻾&?곗씠??肄붿뒪",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RootUs",
    description: "?곕━?쒗뀒 ??留욌뒗 ?ы뻾&?곗씠??肄붿뒪",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [{ url: "/RUrogo.png", sizes: "1024x1024", type: "image/png" }],
    apple: [{ url: "/RUrogo.png", sizes: "1024x1024", type: "image/png" }],
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover", // iOS Safe Area 吏??
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
          className={`${pretendard.variable} antialiased desktop-background`}
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
