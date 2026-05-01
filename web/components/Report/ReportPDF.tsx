"use client";

import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { AnalysisData } from "@/lib/types";
import { formatCitation, TIER_LABEL, type Provenance } from "@/lib/data-quality";

// 한글 폰트 (나눔고딕)
Font.register({
  family: "NanumGothic",
  fonts: [
    { src: "https://cdn.jsdelivr.net/gh/fonts-archive/NanumGothic/NanumGothic-Regular.ttf" },
    { src: "https://cdn.jsdelivr.net/gh/fonts-archive/NanumGothic/NanumGothic-Bold.ttf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "NanumGothic", fontSize: 10, color: "#1F2937" },
  header: { borderBottom: "2 solid #6366F1", paddingBottom: 12, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: "#1F2937" },
  subtitle: { fontSize: 11, color: "#64748B", marginTop: 4 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", color: "#6366F1", marginBottom: 8, borderBottom: "1 solid #E5E7EB", paddingBottom: 3 },
  grid3: { flexDirection: "row", gap: 8, marginBottom: 8 },
  card: { flex: 1, backgroundColor: "#F9FAFB", padding: 10, borderRadius: 4 },
  cardLabel: { fontSize: 9, color: "#64748B", marginBottom: 3 },
  cardValue: { fontSize: 14, fontWeight: "bold", color: "#1F2937" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottom: "0.5 solid #E5E7EB" },
  tableHeader: { flexDirection: "row", backgroundColor: "#F3F4F6", paddingVertical: 6, paddingHorizontal: 8, marginBottom: 2 },
  th: { fontSize: 9, fontWeight: "bold", color: "#6B7280" },
  td: { fontSize: 9, color: "#374151" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#9CA3AF", textAlign: "center", borderTop: "0.5 solid #E5E7EB", paddingTop: 6 },
  sourceBadge: { fontSize: 8, fontWeight: "bold", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, marginRight: 6 },
  sourceRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
});

function sourceTier(source: string): { label: string; bg: string; color: string } {
  if (source.startsWith("공공 실거래")) return { label: "공공 DB", bg: "#D1FAE5", color: "#047857" };
  if (source.startsWith("추정 실거래")) return { label: "추정 실거래", bg: "#E0E7FF", color: "#4338CA" };
  if (source.startsWith("현재 호가")) return { label: "현재 호가", bg: "#E0E7FF", color: "#4338CA" };
  return { label: "권역 평균", bg: "#FEF3C7", color: "#B45309" };
}

interface Props {
  data: AnalysisData;
  areaName: string;
  address: string;
  generatedAt: string;
}

function num(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default function ReportPDF({ data, areaName, address, generatedAt }: Props) {
  const ft = data.ft_summary;
  const sales = data.sales_summary;
  const store = data.store_summary;
  const pop = data.pop_summary;
  const opp = data.opportunities;
  const rent = data.rent_info as Record<string, unknown> | undefined;

  const dailyFt = ft ? Math.round((ft.total ?? 0) / 90) : 0;
  const totalSales억 = sales ? Math.round((sales.total_sales ?? 0) / 1e8) : 0;
  const vitalityScore = opp?.insights?.vitality_score ?? 0;

  // 업종 분포 Top 5
  const categoryList = store?.by_category
    ? Object.entries(store.by_category).sort((a, b) => b[1].count - a[1].count).slice(0, 5)
    : [];

  // 시간대별 유동인구 Top 3
  const timeSlots = ft?.time_slots
    ? Object.entries(ft.time_slots).sort((a, b) => b[1] - a[1]).slice(0, 3)
    : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>{areaName} 상권 분석 리포트</Text>
          <Text style={styles.subtitle}>{address} · 발행일 {generatedAt}</Text>
        </View>

        {/* 1. 핵심 지표 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>핵심 지표</Text>
          <View style={styles.grid3}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>상권 활력 점수</Text>
              <Text style={styles.cardValue}>{vitalityScore}점</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>일평균 유동인구</Text>
              <Text style={styles.cardValue}>{num(dailyFt)}명</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>분기 매출 규모</Text>
              <Text style={styles.cardValue}>{num(totalSales억)}억</Text>
            </View>
          </View>
          <View style={styles.grid3}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>총 점포수</Text>
              <Text style={styles.cardValue}>{num(store?.total ?? 0)}개</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>신규 개업</Text>
              <Text style={styles.cardValue}>{num(opp?.insights?.open_count ?? 0)}개</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>폐업</Text>
              <Text style={styles.cardValue}>{num(opp?.insights?.close_count ?? 0)}개</Text>
            </View>
          </View>
        </View>

        {/* 2. 업종 분포 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>업종 분포 (Top 5)</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>업종</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>점포 수</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>비율</Text>
          </View>
          {categoryList.map(([name, info]) => (
            <View key={name} style={styles.row}>
              <Text style={[styles.td, { flex: 2 }]}>{name}</Text>
              <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>{num(info.count)}개</Text>
              <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>{info.ratio}%</Text>
            </View>
          ))}
        </View>

        {/* 3. 유동인구 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>유동인구 분석</Text>
          <View style={styles.row}>
            <Text style={styles.td}>분기 총 유동인구</Text>
            <Text style={styles.td}>{num(ft?.total ?? 0)}명</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.td}>일평균 유동인구</Text>
            <Text style={styles.td}>{num(dailyFt)}명</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.td}>피크 시간대</Text>
            <Text style={styles.td}>{opp?.insights?.peak_time ?? "-"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.td}>주요 연령대</Text>
            <Text style={styles.td}>{opp?.insights?.dominant_age ?? "-"}</Text>
          </View>
          {timeSlots.length > 0 && (
            <>
              <Text style={[styles.cardLabel, { marginTop: 6 }]}>상위 시간대</Text>
              {timeSlots.map(([t, v]) => (
                <View key={t} style={styles.row}>
                  <Text style={styles.td}>{t}</Text>
                  <Text style={styles.td}>{num(v)}명</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* 4. 배후 인구 */}
        {pop && pop.total > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>배후 인구</Text>
            <View style={styles.row}>
              <Text style={styles.td}>총 배후인구</Text>
              <Text style={styles.td}>{num(pop.total)}명</Text>
            </View>
            {pop.households > 0 && (
              <View style={styles.row}>
                <Text style={styles.td}>추정 가구수</Text>
                <Text style={styles.td}>{num(pop.households)}세대</Text>
              </View>
            )}
          </View>
        )}

        {/* 5. 임대 시세 */}
        {rent && rent["1층_평"] != null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>임대 시세 ({rent["gu"] as string})</Text>
            <View style={styles.row}>
              <Text style={styles.td}>1층 평당 월세</Text>
              <Text style={styles.td}>{num(rent["1층_평"] as number)}만원</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.td}>2층이상 평당 월세</Text>
              <Text style={styles.td}>{num(rent["2층이상_평"] as number)}만원</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.td}>지하 평당 월세</Text>
              <Text style={styles.td}>{num(rent["지하_평"] as number)}만원</Text>
            </View>
            {(() => {
              // provenance 메타가 있으면 Tier 라벨 + 인용 형식 자동 출력
              const prov = rent["provenance"] as Provenance | undefined;
              const provSec = rent["provenance_secondary"] as Provenance | undefined;
              if (prov) {
                const tonePalette: Record<string, { bg: string; color: string }> = {
                  emerald: { bg: "#D1FAE5", color: "#047857" },
                  violet: { bg: "#EDE9FE", color: "#5B21B6" },
                  indigo: { bg: "#E0E7FF", color: "#4338CA" },
                  amber: { bg: "#FEF3C7", color: "#B45309" },
                };
                const tier = TIER_LABEL[prov.tier];
                const palette = tonePalette[tier.tone];
                return (
                  <>
                    <View style={styles.sourceRow}>
                      <Text style={[styles.sourceBadge, { backgroundColor: palette.bg, color: palette.color }]}>
                        {tier.label}
                      </Text>
                      <Text style={styles.cardLabel}>{formatCitation(prov, provSec)}</Text>
                    </View>
                    {prov.downgrade_reasons?.length ? (
                      <Text style={[styles.cardLabel, { marginTop: 3, color: "#B45309" }]}>
                        ⚠️ {prov.downgrade_reasons.join(" · ")}
                      </Text>
                    ) : null}
                  </>
                );
              }
              const src = (rent["source"] as string) ?? "";
              const tier = sourceTier(src);
              return (
                <View style={styles.sourceRow}>
                  <Text style={[styles.sourceBadge, { backgroundColor: tier.bg, color: tier.color }]}>
                    {tier.label}
                  </Text>
                  <Text style={styles.cardLabel}>{src}</Text>
                </View>
              );
            })()}
          </View>
        )}

        <Text style={styles.footer}>
          본 리포트는 공공 데이터 기반 분석 결과이며, 최종 의사결정 시 현장 조사를 권장합니다. ⓒ 상권 분석 서비스
        </Text>
      </Page>
    </Document>
  );
}
