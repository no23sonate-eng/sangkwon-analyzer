/* ── 주요 상권 권역 정의 ──
   중심점 + 반경 + 소속 trdar_cd 매핑
   zone 분류: 중심 거리 기준 자동 태깅 (메인 < 200m, 이면 < 400m, 배후)
*/

export interface DistrictDef {
  id: string;
  name: string;
  center: [number, number]; // [lat, lng]
  radiusM: number;
  gu: string[];
  keywords: string[];
  color: string;
}

export interface ZonedArea {
  trdar_cd: string;
  trdar_nm: string;
  lat: number;
  lng: number;
  zone: "main" | "side" | "rear";
  distFromCenter: number;
}

export interface DistrictZoneData {
  district: DistrictDef;
  areas: ZonedArea[];
}

export const DISTRICTS: DistrictDef[] = [
  {
    id: "gangnam",
    name: "강남역",
    center: [37.4976, 127.0278],
    radiusM: 1200,
    gu: ["강남구", "서초구"],
    keywords: ["강남역", "강남대로"],
    color: "#6366F1",
  },
  {
    id: "hongdae",
    name: "홍대",
    center: [37.5549, 126.9237],
    radiusM: 900,
    gu: ["마포구"],
    keywords: ["홍대", "서교동", "동교"],
    color: "#EC4899",
  },
  {
    id: "seongsu",
    name: "성수동",
    center: [37.5447, 127.0557],
    radiusM: 800,
    gu: ["성동구"],
    keywords: ["성수"],
    color: "#10B981",
  },
  {
    id: "hannam",
    name: "한남동",
    center: [37.5330, 127.0076],
    radiusM: 700,
    gu: ["용산구"],
    keywords: ["한남"],
    color: "#F59E0B",
  },
  {
    id: "yeonnam",
    name: "연남동",
    center: [37.5600, 126.9225],
    radiusM: 600,
    gu: ["마포구"],
    keywords: ["연남", "연트럴"],
    color: "#8B5CF6",
  },
  {
    id: "garosu",
    name: "가로수길",
    center: [37.5208, 127.0226],
    radiusM: 500,
    gu: ["강남구"],
    keywords: ["가로수길", "신사동"],
    color: "#14B8A6",
  },
  {
    id: "dosan",
    name: "도산공원",
    center: [37.5237, 127.0345],
    radiusM: 800,
    gu: ["강남구"],
    keywords: ["도산공원", "압구정"],
    color: "#F97316",
  },
  {
    id: "myeongdong",
    name: "명동",
    center: [37.5614, 126.9830],
    radiusM: 600,
    gu: ["중구"],
    keywords: ["명동"],
    color: "#EF4444",
  },
];

export const ZONE_COLORS = {
  main: { fill: 0.25, stroke: 0.8, label: "메인 상권" },
  side: { fill: 0.15, stroke: 0.5, label: "이면 상권" },
  rear: { fill: 0.08, stroke: 0.3, label: "배후 상권" },
} as const;

export function classifyZone(distFromCenter: number, radiusM: number): "main" | "side" | "rear" {
  const ratio = distFromCenter / radiusM;
  if (ratio < 0.4) return "main";
  if (ratio < 0.75) return "side";
  return "rear";
}

export function findDistrictByQuery(query: string): DistrictDef | null {
  const q = query.trim();
  return DISTRICTS.find((d) =>
    d.name === q || d.keywords.some((kw) => q.includes(kw) || kw.includes(q))
  ) ?? null;
}
