"use client";

import dynamic from "next/dynamic";

const DashboardContent = dynamic(() => import("./dashboard/page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
    </div>
  ),
});

export default function HomePage() {
  return <DashboardContent />;
}
