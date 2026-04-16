import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Layout/Sidebar";
import FloatingConsultButton from "@/components/FloatingConsultButton";
import SignupModal from "@/components/Modal/SignupModal";

export const metadata: Metadata = {
  title: "Land Analysis | 서울 상권 분석",
  description: "지도 기반 서울 상권 분석 — 업종 분포, 매출 트렌드, 유동인구, 임대 시세, 기회 분석을 한눈에",
  keywords: "상권분석, 서울 상권, 유동인구, 임대료, 창업, 부동산, 매출 분석",
  openGraph: {
    title: "Land Analysis | 서울 상권 분석",
    description: "서울 상권의 업종·매출·유동인구·임대 시세를 지도 기반으로 분석합니다.",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Land Analysis | 서울 상권 분석",
    description: "서울 상권의 업종·매출·유동인구·임대 시세를 지도 기반으로 분석합니다.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full overflow-hidden bg-surface">
        {/* 슬림 사이드바 (전역 고정) */}
        <Sidebar />
        {/* 메인 영역 (사이드바 60px 제외) */}
        <div className="ml-[60px] h-full overflow-hidden">
          {children}
        </div>
        <FloatingConsultButton />
        <SignupModal />
      </body>
    </html>
  );
}
