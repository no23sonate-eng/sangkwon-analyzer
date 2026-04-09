"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

export default function FloatingConsultButton() {
  const [hover, setHover] = useState(false);
  const pathname = usePathname();

  // 상담 페이지에서는 숨김
  if (pathname === "/consultation") return null;

  // /map에서는 위치 조정 (지도 컨트롤과 안 겹치게)
  const isMap = pathname === "/map";

  return (
    <Link
      href="/consultation"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`
        fixed z-50 flex items-center gap-2 rounded-full bg-primary-600 text-white shadow-lg
        transition-all duration-200 hover:bg-primary-700 hover:shadow-xl active:scale-95
        ${isMap ? "bottom-20 right-5" : "bottom-6 right-6"}
      `}
      style={{ height: 56, paddingLeft: 16, paddingRight: hover ? 20 : 16 }}
    >
      <MessageCircle size={22} />
      <span
        className={`overflow-hidden whitespace-nowrap text-[13px] font-semibold transition-all duration-200 ${
          hover ? "w-[80px] opacity-100" : "w-0 opacity-0"
        }`}
      >
        전문가 상담
      </span>
    </Link>
  );
}
