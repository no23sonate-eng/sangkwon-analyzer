import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Layout/Sidebar";
import FloatingConsultButton from "@/components/FloatingConsultButton";
import SignupModal from "@/components/Modal/SignupModal";

export const metadata: Metadata = {
  title: "Land Analysis | 상권 분석",
  description: "지도 기반 서울 상권 분석 - 업종, 매출, 유동인구, 기회분석",
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
