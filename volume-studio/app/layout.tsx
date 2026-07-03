import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Volume Studio — 규모검토·볼륨 시뮬레이션",
  description:
    "주소 입력만으로 법규 검토(건폐율·용적률·일조·주차) 기반 3D 매스와 규모검토표를 산출하는 초기 볼륨 스터디 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
