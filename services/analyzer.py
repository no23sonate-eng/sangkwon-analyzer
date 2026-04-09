"""수집된 데이터를 종합 분석하여 기회/위험을 도출하는 엔진

분석 관점:
1. 상권 종합 진단 (한줄 + 점수)
2. 수요-공급 갭 분석 (유동인구 특성 → 부족 업종)
3. 포화/부족/성장 업종 (세부업종 기준)
4. 추천 업종 (진입장벽 고려)
"""

# 진입장벽 높은 업종 (의료, 교육 등 — 일반 창업 추천에서 제외)
HIGH_BARRIER = {"일반의원", "치과의원", "한의원", "약국", "의료기기", "의약품",
                "예술학원", "외국어학원", "일반교습학원", "부동산중개업"}

# 연령대별 선호 업종
AGE_DEMAND = {
    "10대": ["분식전문점", "PC방", "편의점", "제과점"],
    "20대": ["커피-음료", "호프-간이주점", "양식음식점", "의류점", "화장품"],
    "30대": ["한식음식점", "커피-음료", "일식음식점", "미용실", "제과점"],
    "40대": ["한식음식점", "중식음식점", "슈퍼마켓", "세탁소"],
    "50대": ["한식음식점", "슈퍼마켓", "반찬가게", "청과상"],
    "60대 이상": ["한식음식점", "슈퍼마켓", "반찬가게"],
}

# 성별 선호 업종
GENDER_DEMAND = {
    "여성": ["커피-음료", "제과점", "화장품", "미용실", "네일숍"],
    "남성": ["호프-간이주점", "PC방", "당구장", "치킨전문점"],
}


def analyze_opportunities(
    store_summary: dict,
    sales_summary: dict,
    foot_traffic_summary: dict,
    population_summary: dict,
    store_count_summary: dict,
) -> dict:
    by_sub = store_summary.get("by_subcategory", {})
    by_cat = store_summary.get("by_category", {})
    total_stores = store_summary.get("total", 0)
    sales_by_svc = sales_summary.get("by_service", [])
    per_store = sales_summary.get("per_store", [])
    ft = foot_traffic_summary
    sc_list = store_count_summary.get("by_service", [])

    # ── 1. 상권 종합 진단 ──
    total_ft = ft.get("total", 0)
    oc = store_count_summary.get("open_close", {})
    open_count = oc.get("개업", 0)
    close_count = oc.get("폐업", 0)

    # 활력 점수 계산 (0~100)
    vitality_score = 50  # 기본
    if open_count + close_count > 0:
        open_ratio = open_count / (open_count + close_count)
        vitality_score = int(open_ratio * 60 + 20)  # 20~80 범위
    if total_ft > 5000000:
        vitality_score = min(100, vitality_score + 10)
    if total_stores > 1000:
        vitality_score = min(100, vitality_score + 5)

    # 상권 유형 판별
    if total_ft > 0:
        pop_total = population_summary.get("total", 0)
        worker_ratio = pop_total / max(total_ft / 90, 1)
    else:
        worker_ratio = 0

    area_type = "혼합형 상권"
    if worker_ratio > 0.5:
        area_type = "직장인 중심 상권"
    elif worker_ratio < 0.15:
        area_type = "외부 유입형 상권 (관광/상업)"

    # 피크 시간/연령/성별
    peak_time = ""
    if ft.get("time_slots"):
        peak_time = max(ft["time_slots"], key=ft["time_slots"].get)
    dominant_age = ""
    if ft.get("by_age"):
        dominant_age = max(ft["by_age"], key=ft["by_age"].get)
    dominant_gender = ""
    if ft.get("by_gender"):
        dominant_gender = max(ft["by_gender"], key=ft["by_gender"].get)

    vitality_label = "활성" if vitality_score >= 65 else "보통" if vitality_score >= 45 else "침체"

    # 한줄 진단
    diagnosis_parts = [area_type]
    if dominant_age:
        diagnosis_parts.append(f"{dominant_age} 중심")
    if peak_time:
        diagnosis_parts.append(f"피크 {peak_time}")
    diagnosis = " · ".join(diagnosis_parts)

    # ── 2. 수요-공급 갭 분석 ──
    # 유동인구 특성에서 수요가 높을 업종 목록
    demanded_industries = set()
    if dominant_age and dominant_age in AGE_DEMAND:
        demanded_industries.update(AGE_DEMAND[dominant_age])
    if dominant_gender and dominant_gender in GENDER_DEMAND:
        demanded_industries.update(GENDER_DEMAND[dominant_gender])

    # 현재 세부업종 점포 수
    sub_counts = {name: info.get("count", 0) for name, info in by_sub.items()}

    # 수요는 높은데 공급이 부족한 업종
    gap_opportunities = []
    for ind in demanded_industries:
        current = sub_counts.get(ind, 0)
        ratio = (current / max(total_stores, 1)) * 100
        if ratio < 5 and ind not in HIGH_BARRIER:
            # 매출 확인
            ind_sales = next((s for s in sales_by_svc if s["업종"] == ind), None)
            gap_opportunities.append({
                "업종": ind,
                "점포수": current,
                "비율": f"{ratio:.1f}%",
                "판단": f"{dominant_age} 수요 높음, 공급 부족",
                "매출액": f"{ind_sales['매출액'] / 1e8:.1f}억" if ind_sales else "매출 데이터 없음",
            })

    # ── 3. 포화/부족/성장 업종 (세부업종 기준, 기타 제외) ──
    saturated = []
    underserved = []
    growing = []

    for name, info in by_sub.items():
        if name in HIGH_BARRIER:
            continue
        ratio = info.get("ratio", 0)
        count = info.get("count", 0)

        # 포화: 5% 이상이면 포화 가능성
        if ratio > 5 and count > 10:
            saturated.append({
                "업종": name,
                "점포수": count,
                "비율": f"{ratio}%",
                "판단": "공급 과다 — 경쟁 치열",
            })
        # 부족: 수요 목록에 있는데 1% 미만
        elif name in demanded_industries and ratio < 1:
            underserved.append({
                "업종": name,
                "점포수": count,
                "비율": f"{ratio}%",
                "판단": f"{dominant_age} 타깃 대비 부족",
            })

    saturated.sort(key=lambda x: x["점포수"], reverse=True)

    # 성장: 매출 상위 (진입장벽 제외)
    for item in sales_by_svc[:10]:
        if item["업종"] not in HIGH_BARRIER:
            growing.append({
                "업종": item["업종"],
                "매출액": f"{item['매출액'] / 1e8:.1f}억",
                "판단": "매출 검증 — 수요 확인됨",
            })
    growing = growing[:5]

    # ── 4. 추천 업종 (종합 점수) ──
    recommendations = []

    # 수요-공급 갭에서 추천
    for gap in gap_opportunities[:3]:
        recommendations.append({
            "업종": gap["업종"],
            "근거": f"{gap['판단']}, 현재 {gap['점포수']}개 ({gap['비율']})",
            "신뢰도": "높음" if gap.get("매출액") != "매출 데이터 없음" else "보통",
        })

    # 매출 상위 + 비포화에서 추천
    saturated_names = {s["업종"] for s in saturated}
    for item in growing:
        if item["업종"] not in saturated_names and item["업종"] not in {r["업종"] for r in recommendations}:
            recommendations.append({
                "업종": item["업종"],
                "근거": f"매출 {item['매출액']}으로 수요 검증, 포화 아님",
                "신뢰도": "높음",
            })
    recommendations = recommendations[:5]

    return {
        "saturated": saturated[:5],
        "underserved": underserved + gap_opportunities[:5],
        "growing": growing,
        "recommendations": recommendations,
        "insights": {
            "peak_time": peak_time,
            "dominant_age": dominant_age,
            "dominant_gender": dominant_gender,
            "total_foot_traffic": total_ft,
            "total_stores": total_stores,
            "total_population": population_summary.get("total", 0),
            "vitality": vitality_label,
            "vitality_score": vitality_score,
            "open_count": open_count,
            "close_count": close_count,
            "area_type": area_type,
            "diagnosis": diagnosis,
        },
    }
