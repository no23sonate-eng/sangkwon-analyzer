"""매출 추정 엔진 — 다중 소스 교차 검증 + 인구특성 보정

4가지 독립 추정 방식을 교차 검증하여 신뢰도를 높인다.
1. 상권 데이터 기반 (업종별 총매출 / 점포수)
2. 유동인구 기반 (유동인구 × 업종별 입점율 × 객단가)
3. 임대료 역산 (임대료 / 매출 대비 임대료 비율)
4. 인구특성 보정 (연령·성별·시간대 가중치)
"""

from __future__ import annotations

# ── 업종별 파라미터 ──────────────────────────────────────────────
# 입점율: 유동인구 중 해당 업종에 방문하는 비율
# 객단가: 1회 방문당 평균 결제금액 (원)
# 임대료비율: 월 매출 대비 임대료 비율 (%)
# 출처: 소상공인시장진흥공단 경영분석 보고서, 업종별 평균치

INDUSTRY_PARAMS = {
    "한식음식점": {"입점율": 0.025, "객단가": 9500, "임대료비율": 10},
    "중식음식점": {"입점율": 0.012, "객단가": 11000, "임대료비율": 10},
    "일식음식점": {"입점율": 0.010, "객단가": 15000, "임대료비율": 12},
    "양식음식점": {"입점율": 0.010, "객단가": 16000, "임대료비율": 12},
    "분식전문점": {"입점율": 0.020, "객단가": 6500, "임대료비율": 10},
    "치킨전문점": {"입점율": 0.012, "객단가": 18000, "임대료비율": 8},
    "피자전문점": {"입점율": 0.008, "객단가": 22000, "임대료비율": 10},
    "호프-간이주점": {"입점율": 0.015, "객단가": 25000, "임대료비율": 12},
    "커피-음료": {"입점율": 0.035, "객단가": 4800, "임대료비율": 15},
    "커피전문점": {"입점율": 0.035, "객단가": 4800, "임대료비율": 15},
    "제과제빵점": {"입점율": 0.018, "객단가": 7000, "임대료비율": 13},
    "편의점": {"입점율": 0.040, "객단가": 5500, "임대료비율": 8},
    "슈퍼마켓": {"입점율": 0.025, "객단가": 12000, "임대료비율": 7},
    "의류점": {"입점율": 0.015, "객단가": 35000, "임대료비율": 15},
    "화장품점": {"입점율": 0.012, "객단가": 25000, "임대료비율": 15},
    "미용실": {"입점율": 0.010, "객단가": 20000, "임대료비율": 12},
    "세탁소": {"입점율": 0.005, "객단가": 8000, "임대료비율": 8},
    "부동산중개": {"입점율": 0.003, "객단가": 500000, "임대료비율": 15},
    "학원-교습소": {"입점율": 0.008, "객단가": 150000, "임대료비율": 12},
    "의원": {"입점율": 0.008, "객단가": 35000, "임대료비율": 10},
    "약국": {"입점율": 0.010, "객단가": 15000, "임대료비율": 8},
    "반찬가게": {"입점율": 0.012, "객단가": 12000, "임대료비율": 10},
    "육류판매": {"입점율": 0.008, "객단가": 25000, "임대료비율": 8},
    "수산물판매": {"입점율": 0.006, "객단가": 20000, "임대료비율": 8},
    "과일판매": {"입점율": 0.010, "객단가": 15000, "임대료비율": 8},
    "PC방": {"입점율": 0.008, "객단가": 5000, "임대료비율": 10},
    "노래방": {"입점율": 0.005, "객단가": 15000, "임대료비율": 12},
    "당구장": {"입점율": 0.003, "객단가": 10000, "임대료비율": 10},
    "헬스클럽": {"입점율": 0.006, "객단가": 60000, "임대료비율": 12},
    "네일숍": {"입점율": 0.005, "객단가": 30000, "임대료비율": 13},
    "꽃집": {"입점율": 0.004, "객단가": 30000, "임대료비율": 12},
    "안경점": {"입점율": 0.004, "객단가": 120000, "임대료비율": 12},
    "휴대폰판매": {"입점율": 0.006, "객단가": 80000, "임대료비율": 10},
}

# 대분류 기본값
_DEFAULT_PARAMS = {
    "음식": {"입점율": 0.015, "객단가": 10000, "임대료비율": 10},
    "소매": {"입점율": 0.010, "객단가": 15000, "임대료비율": 10},
    "생활서비스": {"입점율": 0.008, "객단가": 15000, "임대료비율": 12},
    "학문/교육": {"입점율": 0.005, "객단가": 100000, "임대료비율": 12},
    "숙박": {"입점율": 0.003, "객단가": 80000, "임대료비율": 15},
    "스포츠": {"입점율": 0.005, "객단가": 30000, "임대료비율": 12},
    "부동산": {"입점율": 0.003, "객단가": 500000, "임대료비율": 15},
}

_FALLBACK = {"입점율": 0.010, "객단가": 12000, "임대료비율": 11}

# ── 연령대별 소비성향 가중치 ──────────────────────────────────────
# 연령대별 1인당 평균 소비지출 지수 (전체 평균=1.0)
# 출처: 통계청 가계동향조사 기반 상대지수
AGE_SPENDING_WEIGHT = {
    "10대": 0.5,
    "20대": 0.9,
    "30대": 1.2,
    "40대": 1.3,
    "50대": 1.1,
    "60대 이상": 0.8,
}

# 업종별 주요 타겟 연령대 (해당 연령대 비율이 높으면 매출 보정)
INDUSTRY_AGE_AFFINITY = {
    "커피-음료": {"20대": 1.3, "30대": 1.2},
    "커피전문점": {"20대": 1.3, "30대": 1.2},
    "호프-간이주점": {"20대": 1.2, "30대": 1.3, "40대": 1.1},
    "치킨전문점": {"20대": 1.2, "30대": 1.1},
    "분식전문점": {"10대": 1.3, "20대": 1.2},
    "한식음식점": {"40대": 1.1, "50대": 1.2},
    "의류점": {"20대": 1.3, "30대": 1.2},
    "화장품점": {"20대": 1.4, "30대": 1.2},
    "PC방": {"10대": 1.4, "20대": 1.3},
    "헬스클럽": {"20대": 1.3, "30대": 1.2},
    "약국": {"50대": 1.2, "60대 이상": 1.3},
    "의원": {"50대": 1.1, "60대 이상": 1.3},
}

# 시간대별 영업 가중치 (해당 시간대 유동인구가 집중되면 어떤 업종이 유리한지)
INDUSTRY_TIME_AFFINITY = {
    "커피-음료": {"06~11시": 1.3, "11~14시": 1.1, "14~17시": 1.2},
    "커피전문점": {"06~11시": 1.3, "11~14시": 1.1, "14~17시": 1.2},
    "한식음식점": {"11~14시": 1.4, "17~21시": 1.2},
    "중식음식점": {"11~14시": 1.4, "17~21시": 1.1},
    "일식음식점": {"11~14시": 1.2, "17~21시": 1.4},
    "양식음식점": {"11~14시": 1.2, "17~21시": 1.3},
    "분식전문점": {"11~14시": 1.2, "14~17시": 1.3},
    "호프-간이주점": {"17~21시": 1.3, "21~24시": 1.5},
    "편의점": {"00~06시": 1.1, "21~24시": 1.2},
    "노래방": {"17~21시": 1.2, "21~24시": 1.5},
}


def _get_params(industry_name: str, category_name: str = "") -> dict:
    """업종명으로 파라미터를 찾는다."""
    if industry_name in INDUSTRY_PARAMS:
        return INDUSTRY_PARAMS[industry_name]
    for key, params in INDUSTRY_PARAMS.items():
        if key in industry_name or industry_name in key:
            return params
    if category_name:
        for key, params in _DEFAULT_PARAMS.items():
            if key in category_name or category_name in key:
                return params
    return _FALLBACK


def _calc_age_multiplier(industry_name: str, by_age: dict) -> float:
    """연령대 구성에 따른 업종별 매출 보정 계수를 계산한다."""
    if not by_age:
        return 1.0

    affinity = INDUSTRY_AGE_AFFINITY.get(industry_name, {})
    if not affinity:
        # 일반적인 소비성향 가중치 적용
        total = sum(by_age.values()) or 1
        weighted = sum(
            (count / total) * AGE_SPENDING_WEIGHT.get(age, 1.0)
            for age, count in by_age.items()
        )
        return max(0.7, min(1.3, weighted))

    total = sum(by_age.values()) or 1
    multiplier = 1.0
    for age, weight in affinity.items():
        ratio = by_age.get(age, 0) / total
        # 해당 연령대 비율이 평균(1/6≈16.7%)보다 높으면 가중
        multiplier += (ratio - 1 / 6) * (weight - 1.0) * 3
    return max(0.7, min(1.5, multiplier))


def _calc_time_multiplier(industry_name: str, time_slots: dict) -> float:
    """시간대별 유동인구 분포에 따른 업종별 매출 보정 계수를 계산한다."""
    if not time_slots:
        return 1.0

    affinity = INDUSTRY_TIME_AFFINITY.get(industry_name, {})
    if not affinity:
        return 1.0

    total = sum(time_slots.values()) or 1
    multiplier = 1.0
    for slot, weight in affinity.items():
        ratio = time_slots.get(slot, 0) / total
        multiplier += (ratio - 1 / 6) * (weight - 1.0) * 3
    return max(0.7, min(1.5, multiplier))


def _calc_competition_factor(store_count: int, total_stores: int) -> float:
    """경쟁 강도에 따른 보정 계수. 점포가 많으면 1개당 매출 감소."""
    if total_stores == 0 or store_count == 0:
        return 1.0
    share = store_count / total_stores
    # 점유율이 20% 이상이면 과밀 → 매출 하락 보정
    if share > 0.20:
        return max(0.7, 1.0 - (share - 0.20) * 1.5)
    # 점유율이 5% 이하면 희소 → 독점 프리미엄
    if share < 0.05:
        return min(1.2, 1.0 + (0.05 - share) * 2.0)
    return 1.0


def estimate_by_foot_traffic(
    foot_traffic_summary: dict,
    store_summary: dict,
) -> list:
    """유동인구 기반으로 업종별 점포당 월매출을 추정한다.

    인구특성(연령, 시간대) 및 경쟁강도를 반영한 보정 적용.
    """
    total_ft = foot_traffic_summary.get("total", 0)
    if total_ft == 0:
        return []

    daily_ft = total_ft / 90  # 분기 → 일평균

    by_sub = store_summary.get("by_subcategory", {})
    total_stores = store_summary.get("total", 0)
    by_age = foot_traffic_summary.get("by_age", {})
    time_slots = foot_traffic_summary.get("time_slots", {})

    results = []
    for name, info in by_sub.items():
        count = info.get("count", 0)
        if count == 0:
            continue

        params = _get_params(name)

        # 기본 추정
        daily_customers_per_store = daily_ft * params["입점율"] / count
        base_monthly = daily_customers_per_store * params["객단가"] * 30

        # 보정 계수 적용
        age_mult = _calc_age_multiplier(name, by_age)
        time_mult = _calc_time_multiplier(name, time_slots)
        comp_factor = _calc_competition_factor(count, total_stores)

        adjusted_monthly = base_monthly * age_mult * time_mult * comp_factor
        monthly_man = int(adjusted_monthly / 10000)

        results.append({
            "업종": name,
            "점포수": count,
            "추정_월매출": monthly_man,
            "추정_연매출": monthly_man * 12,
            "일평균_고객": int(daily_customers_per_store * age_mult),
            "객단가": params["객단가"],
            "연령보정": round(age_mult, 2),
            "시간대보정": round(time_mult, 2),
            "경쟁보정": round(comp_factor, 2),
            "방식": "유동인구",
        })

    results.sort(key=lambda x: x["추정_월매출"], reverse=True)
    return results


def estimate_by_rent(
    rent_info: dict,
    store_summary: dict,
    floor: str = "1층",
    avg_area_pyeong: int = 10,
) -> list:
    """임대료 역산으로 업종별 최소 월매출을 추정한다."""
    if not rent_info:
        return []

    floor_key = {"1층": "1층_평", "지하": "지하_평", "2층 이상": "2층이상_평"}.get(floor, "1층_평")
    rent_per_pyeong = rent_info.get(floor_key, 0)
    if rent_per_pyeong == 0:
        return []

    monthly_rent = rent_per_pyeong * avg_area_pyeong  # 천원/월

    by_sub = store_summary.get("by_subcategory", {})
    results = []

    for name, info in by_sub.items():
        count = info.get("count", 0)
        if count == 0:
            continue

        params = _get_params(name)
        rent_ratio = params["임대료비율"] / 100
        if rent_ratio == 0:
            continue

        min_monthly_sales = monthly_rent / rent_ratio  # 천원
        min_monthly_man = int(min_monthly_sales / 10)  # 천원 → 만원

        results.append({
            "업종": name,
            "점포수": count,
            "월_임대료": int(monthly_rent),
            "임대료비율": params["임대료비율"],
            "최소_월매출": min_monthly_man,
            "최소_연매출": min_monthly_man * 12,
            "방식": "임대료역산",
        })

    results.sort(key=lambda x: x["최소_월매출"], reverse=True)
    return results


def cross_validate(
    per_store_avg: list,
    foot_traffic_est: list,
    rent_est: list,
) -> list:
    """3가지 추정치를 교차 검증하여 종합 추정 결과를 만든다.

    모든 값은 만원 단위. 신뢰등급과 추정 범위(하한~상한)도 산출.
    """
    avg_map = {item["업종"]: item for item in per_store_avg}
    ft_map = {item["업종"]: item for item in foot_traffic_est}
    rent_map = {item["업종"]: item for item in rent_est}

    all_industries = set(list(avg_map.keys()) + list(ft_map.keys()) + list(rent_map.keys()))

    results = []
    for name in all_industries:
        avg_data = avg_map.get(name, {})
        ft_data = ft_map.get(name, {})
        rent_data = rent_map.get(name, {})

        avg_per_store = int(avg_data.get("점포당_매출", 0) / 10000) if avg_data.get("점포당_매출") else 0
        ft_per_store = ft_data.get("추정_월매출", 0)
        rent_per_store = rent_data.get("최소_월매출", 0)

        store_count = avg_data.get("점포수", 0) or ft_data.get("점포수", 0) or rent_data.get("점포수", 0)

        # 가중 평균: 상권데이터(3) > 유동인구(2) > 임대료(1)
        estimates = []
        weights = []
        sources = []
        if avg_per_store > 0:
            estimates.append(avg_per_store)
            weights.append(3)
            sources.append("상권데이터")
        if ft_per_store > 0:
            estimates.append(ft_per_store)
            weights.append(2)
            sources.append("유동인구")
        if rent_per_store > 0:
            estimates.append(rent_per_store)
            weights.append(1)
            sources.append("임대료역산")

        if not estimates:
            continue

        total_weight = sum(weights)
        per_store_monthly = int(sum(e * w for e, w in zip(estimates, weights)) / total_weight)
        total_monthly = per_store_monthly * store_count

        # 신뢰등급 산출
        source_count = len(estimates)
        if source_count >= 3:
            # 3개 소스 있으면 편차로 신뢰도 판단
            mean_val = per_store_monthly
            max_dev = max(abs(e - mean_val) / mean_val for e in estimates) if mean_val > 0 else 1
            if max_dev < 0.3:
                confidence = "높음"
            elif max_dev < 0.6:
                confidence = "보통"
            else:
                confidence = "낮음"
        elif source_count == 2:
            confidence = "보통"
        else:
            confidence = "참고"

        # 추정 범위 (하한 ~ 상한)
        if len(estimates) >= 2:
            lower = int(min(estimates) * 0.85)
            upper = int(max(estimates) * 1.15)
        else:
            lower = int(per_store_monthly * 0.7)
            upper = int(per_store_monthly * 1.3)

        # 보정 계수 정보 (유동인구 추정에 있으면)
        age_mult = ft_data.get("연령보정", 1.0)
        time_mult = ft_data.get("시간대보정", 1.0)
        comp_factor = ft_data.get("경쟁보정", 1.0)

        results.append({
            "업종": name,
            "점포수": store_count,
            "종합_점포당_월매출": per_store_monthly,
            "종합_전체_월매출": total_monthly,
            "하한_월매출": lower,
            "상한_월매출": upper,
            "신뢰등급": confidence,
            "추정소스": " + ".join(sources),
            "소스수": source_count,
            "연령보정": age_mult,
            "시간대보정": time_mult,
            "경쟁보정": comp_factor,
        })

    results.sort(key=lambda x: x["종합_점포당_월매출"], reverse=True)
    return results
