import { NextResponse } from "next/server";

const AREA_GROUPS = [
  { name: "서울 전체", keywords: [] },
  { name: "명동", keywords: ["명동"] },
  { name: "강남역", keywords: ["강남"] },
  { name: "홍대입구", keywords: ["홍대", "서교"] },
  { name: "성수동", keywords: ["성수"] },
  { name: "이태원", keywords: ["이태원"] },
  { name: "건대입구", keywords: ["건대", "화양"] },
  { name: "여의도", keywords: ["여의도"] },
  { name: "잠실", keywords: ["잠실"] },
  { name: "신촌", keywords: ["신촌"] },
  { name: "종로", keywords: ["종로"] },
];

export async function GET() {
  return NextResponse.json(AREA_GROUPS);
}
