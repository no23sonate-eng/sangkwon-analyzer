/* ── 타입 정의: FastAPI 백엔드 응답 형태에 맞춤 ── */

export interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
}

export interface TrdarItem {
  trdar_cd: string;
  trdar_nm: string;
  distance?: number;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

/* ── 업종 ── */

export interface CategoryInfo {
  count: number;
  ratio: number;
}

export interface StoreSummary {
  total: number;
  by_category: Record<string, CategoryInfo>;
  by_subcategory: Record<string, CategoryInfo>;
}

/* ── 매출 ── */

export interface SalesSummary {
  by_service: Array<{ 업종: string; 매출액: number; 건수: number }>;
  per_store: Array<{ 업종: string; 점포수: number; 총매출: number; 점포당_매출: number; 점포당_건수: number }>;
  time_slots: Record<string, number>;
  day_of_week: Record<string, number>;
  total_sales: number;
  total_count: number;
}

/* ── 유동인구 ── */

export interface FootTrafficSummary {
  total: number;
  time_slots: Record<string, number>;
  by_gender: Record<string, number>;
  by_age: Record<string, number>;
  by_day: Record<string, number>;
}

/* ── 상주/직장인구 ── */

export interface PopulationSummary {
  total: number;
  households: number;
  by_age: Record<string, number>;
  by_gender: Record<string, number>;
}

/* ── 매출 추정 ── */

export interface CrossResult {
  업종: string;
  점포수: number;
  종합_점포당_월매출: number;
  종합_전체_월매출: number;
  하한_월매출: number;
  상한_월매출: number;
  신뢰등급: string;
  추정소스: string;
}

/* ── 기회분석 ── */

export interface OpportunityInsights {
  total_stores: number;
  total_foot_traffic: number;
  total_population: number;
  peak_time: string;
  dominant_age: string;
  dominant_gender: string;
  vitality: string;
  vitality_score?: number;
  open_count: number;
  close_count: number;
  area_type?: string;
  diagnosis?: string;
}

export interface OpportunityItem {
  업종: string;
  점포수?: number;
  비율?: string;
  판단?: string;
  매출액?: string;
  근거?: string;
  신뢰도?: string;
}

export interface Opportunities {
  saturated: OpportunityItem[];
  underserved: OpportunityItem[];
  growing: OpportunityItem[];
  recommendations: OpportunityItem[];
  insights: OpportunityInsights;
}

/* ── 점포수 (sc_summary) ── */

export interface StoreCountSummary {
  by_service: Array<{
    업종: string;
    점포수: number;
    개업수: number;
    폐업수: number;
    프랜차이즈: number;
  }>;
  open_close: { open: number; close: number };
}

/* ── 임대료 ── */

import type { Provenance } from "./data-quality";

export interface RentInfo {
  gu: string;
  dong?: string;
  source: string;
  "1층_평": number;
  "지하_평": number;
  "2층이상_평": number;
  /** actual: 본인 네트워크/좌표 실측. dong_estimate: 동 단위 추정. gu_fallback: 구 평균. */
  confidence?: "actual" | "dong_estimate" | "gu_fallback";
  /** owner_network · rents_db · naver_deal · naver_listing · dong_rtms · gu_avg · hardcoded */
  source_kind?: "owner_network" | "rents_db" | "naver_deal" | "naver_listing" | "dong_rtms" | "gu_avg" | "hardcoded";
  /** Tier·표본·CV·만료 메타 (data-quality.makeProvenance 산출). 리포트 인용 형식 자동 생성용. */
  provenance?: Provenance;
  /** Cross-check 보조 소스 (출처 각주 "± OO" 표기에 사용) */
  provenance_secondary?: Provenance;
}

/* ── 통합 dominant 카테고리 (trdar 7개 + places 6개) ── */
export interface UnifiedDominant {
  total: number;
  by_group: Record<string, number>;
  share: Record<string, number>;
  dominant: Array<{ group: string; share: number; count: number }>;
  source_breakdown: { trdar: number; places: number };
}

/* ── 전체 분석 응답 (/api/analyze 반환값) ── */

export interface AnalysisData {
  store_summary: StoreSummary;
  stores: Array<Record<string, string | number>>;
  sales_summary: SalesSummary;
  ft_summary: FootTrafficSummary;
  pop_summary: PopulationSummary;
  sc_summary: StoreCountSummary;
  rent_info: RentInfo | Record<string, never>;
  cross_result: CrossResult[];
  opportunities: Opportunities;
  trdar_count?: number;
  trdar_names?: string[];
  gu_name?: string;
  /** trdar 7개 + places 6개 통합 dominant. BrandSynergy 가 13개 그룹 점수 산출에 사용. */
  unified_dominant?: UnifiedDominant;
  places_meta?: { total: number; collected_at: string };
}

/* ── store-count API 응답 ── */

export interface StoreCountData {
  summary: StoreCountSummary;
  detail: Array<{
    업종: string;
    점포수: number;
    개업수: number;
    폐업수: number;
    프랜차이즈: number;
  }>;
}

/* ── UI ── */

export type PanelTab =
  | "category"
  | "sales"
  | "foot_traffic"
  | "opportunity"
  | "report";

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}
