/* ============================================================
   Design System — Color Tokens & Chart Constants
   Flup Furniture Dashboard 스타일
   ============================================================ */

/* ── 팔레트 ── */
export const palette = {
  // Brand (Indigo)
  primary: "#6366F1",
  primary50: "#EEF2FF",
  primary100: "#E0E7FF",
  primary200: "#C7D2FE",
  primary300: "#A5B4FC",
  primary400: "#818CF8",
  primary500: "#6366F1",
  primary600: "#4F46E5",
  primary700: "#4338CA",

  // Surfaces
  background: "#F8F9FC",
  card: "#FFFFFF",
  border: "#F1F5F9",

  // Text
  textPrimary: "#1E293B",
  textSecondary: "#64748B",
  muted: "#94A3B8",

  // Accent (차트/마커에만 사용)
  orange: "#F97316",
  teal: "#10B981",
  navy: "#3B82F6",
  magenta: "#EC4899",
  purple: "#8B5CF6",
} as const;

/* ── 업종 컬러 (전역 상수) ── */
export const industryColors: Record<string, string> = {
  음식점: "#F97316",    // orange
  음식: "#F97316",
  한식음식점: "#F97316",
  카페: "#8B5CF6",      // purple
  "커피-음료": "#8B5CF6",
  커피전문점: "#8B5CF6",
  소매: "#3B82F6",      // blue
  편의점: "#3B82F6",
  서비스: "#10B981",    // green
  생활서비스: "#10B981",
  주점: "#EC4899",      // pink
  "호프-간이주점": "#EC4899",
  기타: "#94A3B8",      // muted
};

/** 업종명으로 색상 반환 */
export function getIndustryColor(name: string): string {
  if (industryColors[name]) return industryColors[name];
  // 부분 매칭
  for (const [key, color] of Object.entries(industryColors)) {
    if (name.includes(key) || key.includes(name)) return color;
  }
  return palette.muted;
}

/* ── 카테고리 컬러 (지도 마커용) ── */
export const categoryColorMap: Record<string, string> = {
  음식: "#F97316",
  소매: "#3B82F6",
  생활서비스: "#10B981",
  "학문/교육": "#F59E0B",
  숙박: "#8B5CF6",
  부동산: "#6366F1",
  스포츠: "#EC4899",
  "수리/개인": "#94A3B8",
  "음료/식품": "#8B5CF6",
};

export function getCategoryColor(category: string): string {
  return categoryColorMap[category] ?? palette.muted;
}

/* ── 차트 컬러 배열 (순서대로 사용) ── */
export const chartColors = [
  "#F97316", // 음식점
  "#8B5CF6", // 카페
  "#3B82F6", // 소매
  "#10B981", // 서비스
  "#EC4899", // 주점
  "#F59E0B", // 교육
  "#6366F1", // 기타1
  "#94A3B8", // 기타2
];

/* ── Recharts 공통 스타일 ── */
export const chartTheme = {
  grid: {
    strokeDasharray: "3 3",
    stroke: "#F1F5F9",
  },
  axis: {
    fill: "#64748B",
    fontSize: 12,
  },
  tooltip: {
    contentStyle: {
      background: "#fff",
      border: "none",
      borderRadius: 12,
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      padding: "10px 14px",
      fontSize: 13,
    },
    labelStyle: {
      color: "#64748B",
      fontSize: 12,
      marginBottom: 4,
    },
  },
  animationDuration: 800,
} as const;
