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
  axis: [number, number][]; // 도로축 좌표 [lat, lng][]
  bufferM: number; // 축에서 이 거리까지 상권 포함
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

// axis: 도로축 좌표 [lat, lng][] — 이 라인을 따라 상권이 형성됨
// bufferM: 축에서 이 거리까지 상권으로 포함
export const DISTRICTS: DistrictDef[] = [
  {
    id: "gangnam",
    name: "강남역",
    center: [37.4976, 127.0278],
    radiusM: 1200,
    gu: ["강남구", "서초구"],
    keywords: ["강남역", "강남대로"],
    color: "#6366F1",
    axis: [[37.5045, 127.0249], [37.4976, 127.0278], [37.4910, 127.0310]], // 신논현→강남역→역삼
    bufferM: 400,
  },
  {
    id: "hongdae",
    name: "홍대",
    center: [37.5549, 126.9237],
    radiusM: 900,
    gu: ["마포구"],
    keywords: ["홍대", "서교동", "동교"],
    color: "#EC4899",
    axis: [[37.5571, 126.9259], [37.5538, 126.9213], [37.5500, 126.9220]], // 홍대입구역→걷고싶은거리→상수방면
    bufferM: 450,
  },
  {
    id: "seongsu",
    name: "성수동",
    center: [37.5447, 127.0557],
    radiusM: 800,
    gu: ["성동구"],
    keywords: ["성수"],
    color: "#10B981",
    axis: [[37.5447, 127.0440], [37.5447, 127.0567], [37.5430, 127.0650]], // 서울숲→성수역→카페거리
    bufferM: 400,
  },
  {
    id: "hannam",
    name: "한남동",
    center: [37.5330, 127.0076],
    radiusM: 700,
    gu: ["용산구"],
    keywords: ["한남"],
    color: "#F59E0B",
    axis: [[37.5350, 127.0020], [37.5330, 127.0076], [37.5310, 127.0130]], // 한남오거리→한남동
    bufferM: 350,
  },
  {
    id: "yeonnam",
    name: "연남동",
    center: [37.5600, 126.9225],
    radiusM: 600,
    gu: ["마포구"],
    keywords: ["연남", "연트럴"],
    color: "#8B5CF6",
    axis: [[37.5571, 126.9235], [37.5620, 126.9230], [37.5650, 126.9225]], // 홍대입구역→연트럴파크→연남동 안쪽
    bufferM: 350,
  },
  {
    id: "garosu",
    name: "가로수길",
    center: [37.5208, 127.0226],
    radiusM: 500,
    gu: ["강남구"],
    keywords: ["가로수길", "신사동"],
    color: "#14B8A6",
    axis: [[37.5235, 127.0230], [37.5190, 127.0220]], // 신사역→가로수길 남단
    bufferM: 300,
  },
  {
    id: "dosan",
    name: "도산공원",
    center: [37.5237, 127.0345],
    radiusM: 800,
    gu: ["강남구"],
    keywords: ["도산공원", "압구정"],
    color: "#F97316",
    axis: [[37.5270, 127.0289], [37.5230, 127.0350], [37.5215, 127.0400]], // 압구정로데오→도산공원→청담
    bufferM: 400,
  },
  {
    id: "myeongdong",
    name: "명동",
    center: [37.5614, 126.9830],
    radiusM: 600,
    gu: ["중구"],
    keywords: ["명동"],
    color: "#EF4444",
    axis: [[37.5610, 126.9860], [37.5628, 126.9837], [37.5640, 126.9810]], // 명동역→명동거리→을지로입구
    bufferM: 350,
  },
  {
    id: "konkuk",
    name: "건대입구",
    center: [37.5404, 127.0693],
    radiusM: 700,
    gu: ["광진구"],
    keywords: ["건대", "건국대"],
    color: "#0EA5E9",
    axis: [[37.5404, 127.0693], [37.5420, 127.0660], [37.5380, 127.0720]], // 건대입구역→먹자골목
    bufferM: 350,
  },
  {
    id: "hapjeong",
    name: "합정",
    center: [37.5499, 126.9145],
    radiusM: 600,
    gu: ["마포구"],
    keywords: ["합정"],
    color: "#84CC16",
    axis: [[37.5499, 126.9145], [37.5490, 126.9100]], // 합정역→망원동방면
    bufferM: 350,
  },
  {
    id: "euljiro",
    name: "을지로",
    center: [37.5665, 126.9918],
    radiusM: 700,
    gu: ["중구", "종로구"],
    keywords: ["을지로", "익선동"],
    color: "#A855F7",
    axis: [[37.5660, 126.9820], [37.5665, 126.9918], [37.5670, 127.0010]], // 을지로입구→을지로3가→을지로4가
    bufferM: 350,
  },
  {
    id: "ikseon",
    name: "익선동",
    center: [37.5735, 126.9880],
    radiusM: 400,
    gu: ["종로구"],
    keywords: ["익선"],
    color: "#D946EF",
    axis: [[37.5735, 126.9880], [37.5745, 126.9870]], // 익선동 골목
    bufferM: 250,
  },
  {
    id: "jamsil",
    name: "잠실",
    center: [37.5133, 127.1001],
    radiusM: 900,
    gu: ["송파구"],
    keywords: ["잠실"],
    color: "#06B6D4",
    axis: [[37.5133, 127.1001], [37.5100, 127.1050]], // 잠실역→잠실새내
    bufferM: 450,
  },
  {
    id: "yeouido",
    name: "여의도",
    center: [37.5218, 126.9245],
    radiusM: 800,
    gu: ["영등포구"],
    keywords: ["여의도"],
    color: "#0D9488",
    axis: [[37.5255, 126.9245], [37.5218, 126.9245], [37.5185, 126.9260]], // 여의도역→IFC→여의나루
    bufferM: 400,
  },
  {
    id: "sinchon",
    name: "신촌",
    center: [37.5554, 126.9368],
    radiusM: 600,
    gu: ["서대문구", "마포구"],
    keywords: ["신촌"],
    color: "#E11D48",
    axis: [[37.5554, 126.9368], [37.5570, 126.9340]],
    bufferM: 350,
  },
  {
    id: "apgujeong",
    name: "압구정로데오",
    center: [37.5270, 127.0400],
    radiusM: 700,
    gu: ["강남구"],
    keywords: ["압구정", "로데오", "청담"],
    color: "#BE185D",
    axis: [[37.5270, 127.0289], [37.5260, 127.0380], [37.5250, 127.0450]], // 압구정역→로데오→청담
    bufferM: 400,
  },
  {
    id: "samcheong",
    name: "삼청동",
    center: [37.5816, 126.9816],
    radiusM: 500,
    gu: ["종로구"],
    keywords: ["삼청", "북촌"],
    color: "#7C3AED",
    axis: [[37.5790, 126.9825], [37.5830, 126.9810]],
    bufferM: 300,
  },
  {
    id: "mangwon",
    name: "망원동",
    center: [37.5556, 126.9100],
    radiusM: 500,
    gu: ["마포구"],
    keywords: ["망원"],
    color: "#059669",
    axis: [[37.5556, 126.9100], [37.5540, 126.9060]],
    bufferM: 350,
  },
];

export const ZONE_COLORS = {
  main: { fill: 0.25, stroke: 0.8, label: "메인 상권" },
  side: { fill: 0.15, stroke: 0.5, label: "이면 상권" },
  rear: { fill: 0.08, stroke: 0.3, label: "배후 상권" },
} as const;

/** 점에서 선분까지 최단거리 (미터) */
export function distToSegmentM(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  // 평면 근사 (서울 스케일에서 충분)
  const cosLat = Math.cos(toRad((aLat + bLat) / 2));
  const px = (pLng - aLng) * cosLat;
  const py = pLat - aLat;
  const dx = (bLng - aLng) * cosLat;
  const dy = bLat - aLat;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px * dx + py * dy) / len2) : 0;
  t = Math.max(0, Math.min(1, t));
  const projX = (aLng + (bLng - aLng) * t) * cosLat;
  const projY = aLat + (bLat - aLat) * t;
  const distDeg = Math.sqrt((px - (projX - aLng * cosLat)) ** 2 + (py - (projY - aLat)) ** 2);
  return distDeg * (Math.PI / 180) * R;
}

/** 점에서 도로축(폴리라인)까지 최단거리 */
export function distToAxisM(lat: number, lng: number, axis: [number, number][]): number {
  let minDist = Infinity;
  for (let i = 0; i < axis.length - 1; i++) {
    const d = distToSegmentM(lat, lng, axis[i][0], axis[i][1], axis[i + 1][0], axis[i + 1][1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
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
