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
  {
    id: "konkuk",
    name: "건대입구",
    center: [37.5404, 127.0693],
    radiusM: 700,
    gu: ["광진구"],
    keywords: ["건대", "건국대"],
    color: "#0EA5E9",
  },
  {
    id: "hapjeong",
    name: "합정",
    center: [37.5499, 126.9145],
    radiusM: 600,
    gu: ["마포구"],
    keywords: ["합정"],
    color: "#84CC16",
  },
  {
    id: "euljiro",
    name: "을지로",
    center: [37.5665, 126.9918],
    radiusM: 700,
    gu: ["중구", "종로구"],
    keywords: ["을지로", "익선동"],
    color: "#A855F7",
  },
  {
    id: "ikseon",
    name: "익선동",
    center: [37.5735, 126.9880],
    radiusM: 400,
    gu: ["종로구"],
    keywords: ["익선"],
    color: "#D946EF",
  },
  {
    id: "jamsil",
    name: "잠실",
    center: [37.5133, 127.1001],
    radiusM: 900,
    gu: ["송파구"],
    keywords: ["잠실"],
    color: "#06B6D4",
  },
  {
    id: "yeouido",
    name: "여의도",
    center: [37.5218, 126.9245],
    radiusM: 800,
    gu: ["영등포구"],
    keywords: ["여의도"],
    color: "#0D9488",
  },
  {
    id: "sinchon",
    name: "신촌",
    center: [37.5554, 126.9368],
    radiusM: 600,
    gu: ["서대문구", "마포구"],
    keywords: ["신촌"],
    color: "#E11D48",
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

/* ── Convex Hull (Graham scan) — zone 경계 폴리곤 생성 ── */
function cross(o: [number, number], a: [number, number], b: [number, number]) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

export function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** 폴리곤을 부드럽게 확장 (버퍼) — padM 미터만큼 */
export function bufferPolygon(coords: [number, number][], padM: number): [number, number][] {
  if (coords.length < 3) return coords;
  const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const padLng = padM / (111320 * Math.cos((cy * Math.PI) / 180));
  const padLat = padM / 111320;
  return coords.map(([lng, lat]) => {
    const dx = lng - cx;
    const dy = lat - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return [lng, lat] as [number, number];
    const scale = (dist + Math.sqrt(padLng * padLng + padLat * padLat)) / dist;
    return [cx + dx * scale, cy + dy * scale] as [number, number];
  });
}
