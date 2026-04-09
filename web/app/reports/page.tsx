"use client";

import { FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
          <FileText size={28} className="text-primary-600" />
        </div>
        <h1 className="text-[20px] font-bold text-gray-900">리포트</h1>
        <p className="text-[14px] text-muted">곧 준비됩니다.</p>
        <Link
          href="/"
          className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft size={14} />
          대시보드로 돌아가기
        </Link>
      </div>
    </div>
  );
}
