"""마크다운 리포트 생성"""

from datetime import datetime


def generate_report(
    address: str,
    lat: float,
    lng: float,
    radius: int,
    store_summary: dict,
    sales_summary: dict,
    foot_traffic_summary: dict,
    population_summary: dict,
    store_count_summary: dict,
    opportunities: dict,
    rent_info: dict = None,
) -> str:
    """종합 상권 분석 마크다운 리포트를 생성한다."""
    now = datetime.now().strftime("%Y년 %m월 %d일")
    insights = opportunities.get("insights", {})

    lines = [
        f"# 상권 분석 리포트: {address}",
        "",
        f"**분석일**: {now}",
        f"**좌표**: 위도 {lat}, 경도 {lng}",
        f"**분석 반경**: {radius}m",
        "",
        "---",
        "",
        "## 1. 핵심 지표 요약",
        "",
        "| 지표 | 수치 |",
        "|------|------|",
        f"| 총 점포 수 | {insights.get('total_stores', 0):,}개 |",
        f"| 유동인구 (분기) | {insights.get('total_foot_traffic', 0):,}명 |",
        f"| 상주인구 | {insights.get('total_population', 0):,}명 |",
        f"| 세대 수 | {insights.get('total_households', 0):,}세대 |",
        f"| 피크 시간대 | {insights.get('peak_time', '-')} |",
        f"| 주 연령층 | {insights.get('dominant_age', '-')} |",
        f"| 주 성별 | {insights.get('dominant_gender', '-')} |",
        f"| 상권 활력 | {insights.get('vitality', '-')} (개업 {insights.get('open_count', 0)} / 폐업 {insights.get('close_count', 0)}) |",
        "",
        "---",
        "",
    ]

    # 2. 업종 분포
    lines.append("## 2. 업종 분포")
    lines.append("")
    by_cat = store_summary.get("by_category", {})
    if by_cat:
        lines.append("| 업종 | 점포 수 | 비율 |")
        lines.append("|------|---------|------|")
        for name, info in sorted(by_cat.items(), key=lambda x: x[1]["count"], reverse=True):
            lines.append(f"| {name} | {info['count']}개 | {info['ratio']}% |")
    else:
        lines.append("*데이터 없음*")
    lines.extend(["", "---", ""])

    # 3. 매출 분석
    lines.append("## 3. 매출 분석")
    lines.append("")
    sales_svc = sales_summary.get("by_service", [])
    if sales_svc:
        lines.append("### 업종별 추정 매출")
        lines.append("| 순위 | 업종 | 매출액 |")
        lines.append("|------|------|--------|")
        for i, item in enumerate(sales_svc[:10], 1):
            lines.append(f"| {i} | {item['업종']} | {item['매출액']:,}원 |")
    lines.extend(["", ""])

    time_slots = sales_summary.get("time_slots", {})
    if time_slots:
        lines.append("### 시간대별 매출")
        lines.append("| 시간대 | 매출액 |")
        lines.append("|--------|--------|")
        for t, v in time_slots.items():
            lines.append(f"| {t} | {v:,}원 |")
    lines.extend(["", "---", ""])

    # 4. 유동인구
    lines.append("## 4. 유동인구 분석")
    lines.append("")
    ft = foot_traffic_summary
    if ft.get("total"):
        lines.append(f"**총 유동인구 (분기)**: {ft['total']:,}명")
        lines.append("")

    if ft.get("by_age"):
        lines.append("### 연령대별")
        lines.append("| 연령대 | 인구수 |")
        lines.append("|--------|--------|")
        for age, cnt in ft["by_age"].items():
            lines.append(f"| {age} | {cnt:,}명 |")
        lines.append("")

    if ft.get("by_gender"):
        lines.append("### 성별")
        total_g = sum(ft["by_gender"].values()) or 1
        for g, cnt in ft["by_gender"].items():
            lines.append(f"- {g}: {cnt:,}명 ({cnt / total_g * 100:.1f}%)")
        lines.append("")
    lines.extend(["---", ""])

    # 5. 직장인구
    lines.append("## 5. 직장인구")
    lines.append("")
    pop = population_summary
    if pop.get("total"):
        lines.append(f"- 총 직장인구: {pop['total']:,}명")
    else:
        lines.append("*데이터 없음*")
    lines.extend(["", "---", ""])

    # 5.5 임대료
    if rent_info:
        lines.append("## 5.5 상가 임대료")
        lines.append("")
        lines.append(f"**{rent_info['gu']}** 기준 (전용면적 기준, 월 임대료)")
        lines.append("")
        lines.append("| 층별 | 천원/m²/월 | 천원/평/월 |")
        lines.append("|------|-----------|-----------|")
        lines.append(f"| 1층 | {rent_info['1층_m2']} | {rent_info['1층_평']:,.0f} |")
        lines.append(f"| 지하 | {rent_info['지하_m2']} | {rent_info['지하_평']:,.0f} |")
        lines.append(f"| 2층 이상 | {rent_info['2층이상_m2']} | {rent_info['2층이상_평']:,.0f} |")
        lines.append("")
        lines.append(f"*출처: {rent_info['source']}*")
        lines.extend(["", "---", ""])

    # 6. 기회 분석
    lines.append("## 6. 기회 분석")
    lines.append("")

    if opportunities.get("saturated"):
        lines.append("### 포화 업종 (진입 주의)")
        lines.append("| 업종 | 점포수 | 비율 | 판단 |")
        lines.append("|------|--------|------|------|")
        for s in opportunities["saturated"]:
            lines.append(f"| {s['업종']} | {s['점포수']}개 | {s['비율']} | {s['판단']} |")
        lines.append("")

    if opportunities.get("underserved"):
        lines.append("### 부족 업종 (진입 기회)")
        lines.append("| 업종 | 점포수 | 비율 | 판단 |")
        lines.append("|------|--------|------|------|")
        for u in opportunities["underserved"]:
            lines.append(f"| {u['업종']} | {u['점포수']}개 | {u['비율']} | {u['판단']} |")
        lines.append("")

    if opportunities.get("growing"):
        lines.append("### 매출 상위 업종")
        lines.append("| 업종 | 매출액 | 판단 |")
        lines.append("|------|--------|------|")
        for g in opportunities["growing"]:
            lines.append(f"| {g['업종']} | {g['매출액']} | {g['판단']} |")
        lines.append("")

    if opportunities.get("recommendations"):
        lines.append("### 추천 업종")
        lines.append("| 업종 | 근거 | 신뢰도 |")
        lines.append("|------|------|--------|")
        for r in opportunities["recommendations"]:
            lines.append(f"| {r['업종']} | {r['근거']} | {r['신뢰도']} |")
        lines.append("")

    lines.extend([
        "---",
        "",
        f"*본 리포트는 공공데이터 API를 활용하여 자동 생성되었습니다. ({now})*",
    ])

    return "\n".join(lines)
