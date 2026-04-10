"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Map,
  FileText,
  GitCompareArrows,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "대시보드", href: "/", icon: LayoutDashboard },
  { label: "지도 분석", href: "/map", icon: Map },
  { label: "입지 비교", href: "/compare", icon: GitCompareArrows },
  { label: "리포트", href: "/reports", icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-[60px] flex-col items-center border-r border-gray-100 bg-white py-4">
      {/* ── 로고 ── */}
      <Link
        href="/"
        className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-[17px] font-extrabold text-white transition-all hover:bg-primary-700 active:scale-95"
      >
        B
      </Link>

      {/* ── 메뉴 아이콘 ── */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <NavIcon
              key={item.href}
              href={item.href}
              icon={Icon}
              label={item.label}
              active={active}
            />
          );
        })}
      </nav>

      {/* ── 하단 설정 ── */}
      <NavIcon
        href="/settings"
        icon={Settings}
        label="설정"
        active={pathname === "/settings"}
      />
    </aside>
  );
}

function NavIcon({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  active: boolean;
}) {
  const [hover, setHover] = useState(false);

  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`
        relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150
        ${active ? "bg-primary-50" : "hover:bg-gray-100"}
      `}
    >
      {/* 활성 좌측 바 */}
      {active && (
        <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary-600" />
      )}

      <Icon
        size={20}
        strokeWidth={active ? 2.2 : 1.8}
        className={active ? "text-primary-600" : "text-gray-400"}
      />

      {/* 호버 툴팁 */}
      {hover && (
        <div className="absolute left-[52px] z-50 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white shadow-lg">
          {label}
          <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-gray-900" />
        </div>
      )}
    </Link>
  );
}
