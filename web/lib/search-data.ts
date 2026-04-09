/* ── 상권 검색 더미 데이터 ── */

export interface SearchResult {
  areaCode: string;
  name: string;
  address: string;
  tags: string[];
  storeCount: number;
  footTraffic: "높음" | "보통" | "낮음";
  rentTrend: "상승" | "보합" | "하락";
  lat?: number;
  lng?: number;
}

export interface RecommendedArea {
  areaCode: string;
  name: string;
  description: string;
  stat: string;
  statLabel: string;
  statColor: "emerald" | "blue" | "amber" | "rose";
  lat?: number;
  lng?: number;
}

const ALL_RESULTS: SearchResult[] = [
  {
    areaCode: "3000001",
    name: "강남역 상권",
    address: "서울 강남구 역삼동 강남대로",
    tags: ["상가 2,847개", "유동인구 높음", "임대료 상승"],
    storeCount: 2847,
    footTraffic: "높음",
    rentTrend: "상승",
  },
  {
    areaCode: "3000002",
    name: "홍대입구역 상권",
    address: "서울 마포구 서교동 양화로",
    tags: ["상가 1,923개", "유동인구 높음", "개업률 높음"],
    storeCount: 1923,
    footTraffic: "높음",
    rentTrend: "상승",
  },
  {
    areaCode: "3000003",
    name: "성수동 카페거리",
    address: "서울 성동구 성수동2가 서울숲길",
    tags: ["상가 687개", "유동인구 높음", "MZ 핫플"],
    storeCount: 687,
    footTraffic: "높음",
    rentTrend: "상승",
  },
  {
    areaCode: "3000004",
    name: "이태원 상권",
    address: "서울 용산구 이태원동 이태원로",
    tags: ["상가 1,247개", "유동인구 보통", "임대료 보합"],
    storeCount: 1247,
    footTraffic: "보통",
    rentTrend: "보합",
  },
  {
    areaCode: "3000005",
    name: "을지로 노가리골목",
    address: "서울 중구 을지로3가",
    tags: ["상가 892개", "유동인구 높음", "레트로 감성"],
    storeCount: 892,
    footTraffic: "높음",
    rentTrend: "상승",
  },
  {
    areaCode: "3000006",
    name: "여의도 IFC 상권",
    address: "서울 영등포구 여의도동 국제금융로",
    tags: ["상가 534개", "직장인 밀집", "임대료 높음"],
    storeCount: 534,
    footTraffic: "보통",
    rentTrend: "보합",
  },
  {
    areaCode: "3000007",
    name: "망원동 상권",
    address: "서울 마포구 망원동 망원로",
    tags: ["상가 423개", "유동인구 보통", "소규모 창업"],
    storeCount: 423,
    footTraffic: "보통",
    rentTrend: "보합",
  },
  {
    areaCode: "3000008",
    name: "연남동 상권",
    address: "서울 마포구 연남동 동교로",
    tags: ["상가 312개", "유동인구 높음", "카페 밀집"],
    storeCount: 312,
    footTraffic: "높음",
    rentTrend: "상승",
  },
];

const RECOMMENDED: RecommendedArea[] = [
  {
    areaCode: "3000003",
    name: "성수동",
    description: "MZ세대 핫플레이스, 카페·팝업 밀집",
    stat: "+24%",
    statLabel: "신규 개업률",
    statColor: "emerald",
  },
  {
    areaCode: "3000005",
    name: "을지로",
    description: "레트로 감성 골목, 힙지로 트렌드",
    stat: "+18%",
    statLabel: "유동인구 증가",
    statColor: "blue",
  },
  {
    areaCode: "3000007",
    name: "망원동",
    description: "소규모 창업 최적지, 합리적 임대료",
    stat: "월 120만",
    statLabel: "평균 임대료",
    statColor: "amber",
  },
  {
    areaCode: "3000008",
    name: "연남동",
    description: "경의선숲길 따라 이어지는 상권",
    stat: "+15%",
    statLabel: "매출 성장률",
    statColor: "emerald",
  },
  {
    areaCode: "3000001",
    name: "강남역",
    description: "대한민국 대표 상권, 압도적 유동인구",
    stat: "28만명",
    statLabel: "일평균 유동인구",
    statColor: "blue",
  },
  {
    areaCode: "3000004",
    name: "이태원",
    description: "글로벌 문화 거리, 외국인 관광 특구",
    stat: "-5%",
    statLabel: "임대료 변동",
    statColor: "rose",
  },
];

export const POPULAR_TAGS = [
  "강남역",
  "홍대입구",
  "성수동",
  "이태원",
  "을지로",
  "여의도",
  "망원동",
  "연남동",
];

export async function searchAreas(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  try {
    const BASE = "";
    const res = await fetch(
      `${BASE}/api/trdar/search?keyword=${encodeURIComponent(query.trim())}`,
    );
    if (!res.ok) throw new Error("API error");
    const data: Array<{
      trdar_cd: string;
      trdar_nm: string;
      lat?: number;
      lng?: number;
    }> = await res.json();

    return data.slice(0, 12).map((d) => ({
      areaCode: d.trdar_cd,
      name: d.trdar_nm,
      address: "",
      tags: [],
      storeCount: 0,
      footTraffic: "보통" as const,
      rentTrend: "보합" as const,
      lat: d.lat,
      lng: d.lng,
    }));
  } catch {
    // API 실패 시 로컬 매칭 폴백
    const q = query.trim().toLowerCase();
    return ALL_RESULTS.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q),
    );
  }
}

export async function getRecommendedAreas(): Promise<RecommendedArea[]> {
  try {
    const BASE = "";
    const res = await fetch(`${BASE}/api/dashboard/recommended`);
    if (!res.ok) throw new Error("API error");
    const data: Array<{
      name: string;
      description: string;
      stat: string;
      statLabel: string;
      statColor: string;
      lat?: number;
      lng?: number;
    }> = await res.json();
    return data.map((d, i) => ({
      areaCode: `api-${i}`,
      name: d.name,
      description: d.description,
      stat: d.stat,
      statLabel: d.statLabel,
      statColor: (d.statColor as RecommendedArea["statColor"]) || "blue",
      lat: d.lat,
      lng: d.lng,
    }));
  } catch {
    // API 실패 시 더미 폴백
    return RECOMMENDED;
  }
}
