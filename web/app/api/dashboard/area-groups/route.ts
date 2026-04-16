import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

/* key: area-groups dashboard label (서울 전체 = no filter) */
const AREA_GROUPS = [
  { key: "서울 전체", label: "서울 전체" },
  { key: "강남역", label: "강남역" },
  { key: "도산공원", label: "도산공원" },
  { key: "한남동", label: "한남동" },
  { key: "성수동", label: "성수동" },
  { key: "홍대역", label: "홍대역" },
  { key: "명동", label: "명동" },
];

export async function GET(req: Request) {
  const limited = rateLimit(req, "dashboard-area-groups", 120, 60_000);
  if (limited) return limited;

  return NextResponse.json(AREA_GROUPS);
}
