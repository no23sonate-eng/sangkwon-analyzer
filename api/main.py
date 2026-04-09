"""FastAPI 백엔드 — 기존 Python 서비스를 REST API로 래핑"""

from __future__ import annotations

import sys
import os

# 프로젝트 루트를 path에 추가
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd

from config import check_api_keys
from services.geocoder import geocode as _geocode, reverse_geocode as _reverse_geocode
from services.store_api import get_stores_in_radius, summarize_stores
from services.seoul_api import (
    get_trdar_cd_by_dong,
    search_trdar_by_name,
    search_trdar_broad,
    search_trdar_by_coord,
    get_sales,
    summarize_sales,
    get_foot_traffic,
    summarize_foot_traffic,
    get_resident_population,
    summarize_population,
    get_store_count,
    summarize_store_count,
)
from services.analyzer import analyze_opportunities
from services.rent_api import get_rent_by_gu
from services.sales_estimator import (
    estimate_by_foot_traffic,
    estimate_by_rent,
    cross_validate,
)
from components.report import generate_report
from services.rent_live_api import get_store_rent_by_gu, get_store_sale_by_gu

app = FastAPI(title="상권 분석 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.45.15:3000", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 서버 시작 시 자동 크롤러 시작 ──

@app.on_event("startup")
def on_startup():
    from services.scheduler import start_scheduler
    start_scheduler()


# ── 헬스 체크 ──

@app.get("/api/health")
def health():
    return {"status": "ok", "keys": check_api_keys()}


# ── 지오코딩 ──

@app.get("/api/geocode")
def geocode(address: str = Query(...)):
    result = _geocode(address)
    if not result:
        return JSONResponse({"error": "좌표를 찾을 수 없습니다"}, status_code=404)
    return result


@app.get("/api/reverse-geocode")
def reverse_geocode(lat: float = Query(...), lng: float = Query(...)):
    result = _reverse_geocode(lat, lng)
    return result


# ── 상권 코드 조회 ──

@app.get("/api/trdar/by-coord")
def trdar_by_coord(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(500),
):
    results = search_trdar_by_coord(lat, lng, radius)
    if not results:
        results = search_trdar_broad("", "")
    return results


@app.get("/api/trdar/search")
def trdar_search(keyword: str = Query(...), dong: str = Query("")):
    from services.seoul_api import _load_area
    results = search_trdar_broad(keyword, dong)
    if not results:
        results = search_trdar_by_name(keyword)
    if not results and dong:
        results = get_trdar_cd_by_dong(dong)
    # 좌표 붙이기
    area_df = _load_area()
    coord_map = {}
    if not area_df.empty:
        for _, r in area_df.iterrows():
            try:
                coord_map[str(r["상권_코드"])] = {"lat": float(r["위도"]), "lng": float(r["경도"])}
            except (ValueError, TypeError):
                pass
    for item in results:
        cd = item.get("trdar_cd", "")
        if cd in coord_map:
            item["lat"] = coord_map[cd]["lat"]
            item["lng"] = coord_map[cd]["lng"]
    return results[:20]


# ── 점포 데이터 ──

@app.get("/api/stores")
def stores(lat: float = Query(...), lng: float = Query(...), radius: int = Query(300)):
    try:
        df = get_stores_in_radius(lat, lng, radius)
    except Exception:
        df = pd.DataFrame()
    summary = summarize_stores(df)
    stores_list = []
    if not df.empty:
        cols = ["상호명", "대분류명", "중분류명", "소분류명", "도로명주소", "위도", "경도"]
        cols = [c for c in cols if c in df.columns]
        stores_list = df[cols].to_dict("records")
    return {"summary": summary, "stores": stores_list}


# ── 매출 데이터 ──

@app.get("/api/sales/{trdar_cd}")
def sales(trdar_cd: str):
    sc_df = get_store_count(trdar_cd)
    sales_df = get_sales(trdar_cd)
    summary = summarize_sales(sales_df, sc_df)
    return summary


# ── 유동인구 ──

@app.get("/api/foot-traffic/{trdar_cd}")
def foot_traffic(trdar_cd: str):
    df = get_foot_traffic(trdar_cd)
    return summarize_foot_traffic(df)


# ── 상주/직장인구 ──

@app.get("/api/population/{trdar_cd}")
def population(trdar_cd: str):
    df = get_resident_population(trdar_cd)
    return summarize_population(df)


# ── 점포수 ──

@app.get("/api/store-count/{trdar_cd}")
def store_count(trdar_cd: str):
    df = get_store_count(trdar_cd)
    summary = summarize_store_count(df)
    # 업종별 상세 데이터도 포함
    detail = []
    if not df.empty:
        for _, row in df.iterrows():
            detail.append({
                "업종": row.get("서비스_업종_코드_명", ""),
                "점포수": int(row.get("점포_수", 0)),
                "개업수": int(row.get("개업_점포_수", 0)),
                "폐업수": int(row.get("폐업_점포_수", 0)),
                "프랜차이즈": int(row.get("프랜차이즈_점포_수", 0)),
            })
    return {"summary": summary, "detail": detail}


# ── 임대료 ──

@app.get("/api/rent/{gu_name}")
def rent(gu_name: str):
    info = get_rent_by_gu(gu_name)
    if not info:
        return JSONResponse({"error": "임대료 정보 없음"}, status_code=404)
    return info


# ── 종합 분석 ──

@app.get("/api/analyze/{trdar_cd}")
def analyze(trdar_cd: str, lat: float = Query(0), lng: float = Query(0), radius: int = Query(300)):
    """한 번의 호출로 모든 분석 데이터를 반환한다."""
    # 점포
    try:
        store_df = get_stores_in_radius(lat, lng, radius) if lat else pd.DataFrame()
    except Exception:
        store_df = pd.DataFrame()
    store_summary = summarize_stores(store_df)
    stores_list = []
    if not store_df.empty:
        cols = ["상호명", "대분류명", "중분류명", "소분류명", "도로명주소", "위도", "경도"]
        cols = [c for c in cols if c in store_df.columns]
        stores_list = store_df[cols].to_dict("records")

    # 서울 API 데이터
    sc_df = get_store_count(trdar_cd)
    sales_df = get_sales(trdar_cd)
    sales_summary = summarize_sales(sales_df, sc_df)

    ft_df = get_foot_traffic(trdar_cd)
    ft_summary = summarize_foot_traffic(ft_df)

    pop_df = get_resident_population(trdar_cd)
    pop_summary = summarize_population(pop_df)

    sc_summary = summarize_store_count(sc_df)

    # 점포 API 실패 시 CSV 폴백
    if store_df.empty and not sc_df.empty:
        _by_cat = {}
        _by_sub = {}
        _total = 0
        for _, row in sc_df.iterrows():
            name = row.get("서비스_업종_코드_명", "")
            cnt = int(row.get("점포_수", 0))
            if name and cnt > 0:
                _by_sub[name] = {"count": cnt, "ratio": 0}
                _total += cnt
        for k in _by_sub:
            _by_sub[k]["ratio"] = round(_by_sub[k]["count"] / max(_total, 1) * 100, 1)
        for name, info in _by_sub.items():
            if any(w in name for w in ["음식", "커피", "치킨", "분식", "제과"]):
                cat = "음식"
            elif any(w in name for w in ["의류", "편의점", "슈퍼", "화장품"]):
                cat = "소매"
            elif any(w in name for w in ["의원", "약국", "미용", "세탁"]):
                cat = "생활서비스"
            elif any(w in name for w in ["학원", "교육"]):
                cat = "학문/교육"
            elif "부동산" in name:
                cat = "부동산"
            else:
                cat = "기타"
            if cat not in _by_cat:
                _by_cat[cat] = {"count": 0, "ratio": 0}
            _by_cat[cat]["count"] += info["count"]
        for k in _by_cat:
            _by_cat[k]["ratio"] = round(_by_cat[k]["count"] / max(_total, 1) * 100, 1)
        store_summary = {"total": _total, "by_category": _by_cat, "by_subcategory": _by_sub}

    # 임대료
    gu_name = ""
    if "시군구명" in store_df.columns and not store_df.empty:
        gu_name = store_df["시군구명"].mode().iloc[0] if not store_df["시군구명"].mode().empty else ""
    rent_info = get_rent_by_gu(gu_name) if gu_name else {}

    # 매출 추정
    ft_estimate = estimate_by_foot_traffic(ft_summary, store_summary)
    rent_estimate = estimate_by_rent(rent_info, store_summary)
    per_store_avg = sales_summary.get("per_store", [])
    cross_result = cross_validate(per_store_avg, ft_estimate, rent_estimate)

    # 기회 분석
    opportunities = analyze_opportunities(
        store_summary, sales_summary, ft_summary, pop_summary, sc_summary
    )

    return {
        "store_summary": store_summary,
        "stores": stores_list,
        "sales_summary": sales_summary,
        "ft_summary": ft_summary,
        "pop_summary": pop_summary,
        "sc_summary": sc_summary,
        "rent_info": rent_info,
        "cross_result": cross_result,
        "opportunities": opportunities,
    }


# ── 반경 기반 종합 분석 (다중 상권 집계) ──

def _merge_summary_dicts(base: dict, add: dict) -> dict:
    """두 summary dict의 숫자 값을 합산한다."""
    merged = {}
    for key in set(list(base.keys()) + list(add.keys())):
        bv = base.get(key, 0)
        av = add.get(key, 0)
        if isinstance(bv, (int, float)) and isinstance(av, (int, float)):
            merged[key] = bv + av
        else:
            merged[key] = bv if bv else av
    return merged


def _merge_record_lists(base: list, add: list, key_field: str = "업종") -> list:
    """업종 기준으로 두 리스트의 숫자 필드를 합산한다."""
    by_key = {}
    for item in base + add:
        k = item.get(key_field, "")
        if k not in by_key:
            by_key[k] = dict(item)
        else:
            for field, val in item.items():
                if field == key_field:
                    continue
                if isinstance(val, (int, float)):
                    by_key[k][field] = by_key[k].get(field, 0) + val
    return list(by_key.values())


def _build_store_summary_from_sc(sc_df: pd.DataFrame) -> dict:
    """점포수 CSV 데이터로 store_summary를 구성한다."""
    _by_cat = {}
    _by_sub = {}
    _total = 0
    for _, row in sc_df.iterrows():
        name = row.get("서비스_업종_코드_명", "")
        cnt = int(row.get("점포_수", 0))
        if name and cnt > 0:
            if name in _by_sub:
                _by_sub[name]["count"] += cnt
            else:
                _by_sub[name] = {"count": cnt, "ratio": 0}
            _total += cnt
    for k in _by_sub:
        _by_sub[k]["ratio"] = round(_by_sub[k]["count"] / max(_total, 1) * 100, 1)
    for name, info in _by_sub.items():
        if any(w in name for w in ["음식", "커피", "치킨", "분식", "제과"]):
            cat = "음식"
        elif any(w in name for w in ["의류", "편의점", "슈퍼", "화장품"]):
            cat = "소매"
        elif any(w in name for w in ["의원", "약국", "미용", "세탁"]):
            cat = "생활서비스"
        elif any(w in name for w in ["학원", "교육"]):
            cat = "학문/교육"
        elif "부동산" in name:
            cat = "부동산"
        else:
            cat = "기타"
        if cat not in _by_cat:
            _by_cat[cat] = {"count": 0, "ratio": 0}
        _by_cat[cat]["count"] += info["count"]
    for k in _by_cat:
        _by_cat[k]["ratio"] = round(_by_cat[k]["count"] / max(_total, 1) * 100, 1)
    return {"total": _total, "by_category": _by_cat, "by_subcategory": _by_sub}


def _distance_weight(distance: int, radius: int) -> float:
    """거리에 따른 가중치를 계산한다. 가까울수록 1.0, 반경 경계에서 0.3.

    선형 감쇠: w = 1.0 - 0.7 * (distance / radius)
    이 방식으로 300m vs 500m에서 같은 상권이라도 가중치가 달라진다.
    """
    if radius <= 0:
        return 1.0
    ratio = min(distance / radius, 1.0)
    return max(0.3, 1.0 - 0.7 * ratio)


def _scale_dict(d: dict, weight: float) -> dict:
    """dict의 숫자 값에 가중치를 곱한다."""
    return {k: int(v * weight) if isinstance(v, (int, float)) else v for k, v in d.items()}


def _scale_record_list(lst: list, weight: float, key_field: str = "업종") -> list:
    """레코드 리스트의 숫자 필드에 가중치를 곱한다."""
    scaled = []
    for item in lst:
        new_item = {}
        for k, v in item.items():
            if k == key_field:
                new_item[k] = v
            elif isinstance(v, (int, float)):
                new_item[k] = int(v * weight)
            else:
                new_item[k] = v
        scaled.append(new_item)
    return scaled


def _aggregate_trdar_data(nearby: list[dict], radius: int) -> tuple:
    """상권 목록(거리 포함)의 서울시 데이터를 거리 가중치를 적용하여 집계한다.

    nearby 각 항목에 'distance' 필드가 있어야 한다.

    Returns:
        (sales_summary, ft_summary, pop_summary, sc_summary, all_sc_df)
    """
    agg_sales = {"by_service": [], "per_store": [], "time_slots": {}, "day_of_week": {}, "total_sales": 0, "total_count": 0}
    agg_ft = {"total": 0, "time_slots": {}, "by_gender": {}, "by_age": {}, "by_day": {}}
    agg_pop = {"total": 0, "households": 0, "by_age": {}, "by_gender": {}}
    agg_sc_by_service = []
    agg_sc_open = 0
    agg_sc_close = 0
    all_sc_df = pd.DataFrame()

    for item in nearby:
        trdar_cd = item["trdar_cd"]
        dist = item.get("distance", 0)
        w = _distance_weight(dist, radius)

        sc_df = get_store_count(trdar_cd)
        sales_df = get_sales(trdar_cd)
        s = summarize_sales(sales_df, sc_df)
        agg_sales["total_sales"] += int(s.get("total_sales", 0) * w)
        agg_sales["total_count"] += int(s.get("total_count", 0) * w)
        agg_sales["by_service"] = _merge_record_lists(agg_sales["by_service"], _scale_record_list(s.get("by_service", []), w))
        agg_sales["per_store"] = _merge_record_lists(agg_sales["per_store"], _scale_record_list(s.get("per_store", []), w))
        agg_sales["time_slots"] = _merge_summary_dicts(agg_sales["time_slots"], _scale_dict(s.get("time_slots", {}), w))
        agg_sales["day_of_week"] = _merge_summary_dicts(agg_sales["day_of_week"], _scale_dict(s.get("day_of_week", {}), w))

        ft_df = get_foot_traffic(trdar_cd)
        f = summarize_foot_traffic(ft_df)
        agg_ft["total"] += int(f.get("total", 0) * w)
        for k in ("time_slots", "by_gender", "by_age", "by_day"):
            agg_ft[k] = _merge_summary_dicts(agg_ft[k], _scale_dict(f.get(k, {}), w))

        pop_df = get_resident_population(trdar_cd)
        p = summarize_population(pop_df)
        agg_pop["total"] += int(p.get("total", 0) * w)
        agg_pop["households"] += int(p.get("households", 0) * w)
        for k in ("by_age", "by_gender"):
            agg_pop[k] = _merge_summary_dicts(agg_pop[k], _scale_dict(p.get(k, {}), w))

        sc_one = summarize_store_count(sc_df)
        agg_sc_by_service = _merge_record_lists(agg_sc_by_service, _scale_record_list(sc_one.get("by_service", []), w))
        oc = sc_one.get("open_close", {})
        agg_sc_open += int(oc.get("개업", 0) * w)
        agg_sc_close += int(oc.get("폐업", 0) * w)
        if not sc_df.empty:
            # sc_df에 가중치 적용 (점포수 등 숫자 컬럼)
            wdf = sc_df.copy()
            for col in ["점포_수", "개업_점포_수", "폐업_점포_수", "프랜차이즈_점포_수"]:
                if col in wdf.columns:
                    wdf[col] = (pd.to_numeric(wdf[col], errors="coerce") * w).astype(int)
            all_sc_df = pd.concat([all_sc_df, wdf], ignore_index=True)

    # per_store: 총매출/점포수로 재계산
    for item in agg_sales["per_store"]:
        cnt = item.get("점포수", 1)
        total_sales_val = item.get("총매출", 0)
        if cnt > 0 and total_sales_val > 0:
            item["점포당_매출"] = int(total_sales_val / cnt)

    agg_sc = {
        "by_service": sorted(agg_sc_by_service, key=lambda x: x.get("점포수", 0), reverse=True),
        "open_close": {"개업": agg_sc_open, "폐업": agg_sc_close},
    }
    return agg_sales, agg_ft, agg_pop, agg_sc, all_sc_df


@app.get("/api/analyze-area")
def analyze_area(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(300),
):
    """반경 내 모든 상권의 데이터를 집계하여 반환한다.

    - 반경 내 상권이 있으면 해당 상권들의 데이터를 합산
    - 반경 내 상권이 없으면 가장 가까운 1개 상권만 사용
    - 반경이 커질수록 더 많은 상권이 포함되어 수치가 증가
    """
    # 1) 정확히 사용자 반경 내 상권 검색
    nearby = search_trdar_by_coord(lat, lng, radius)

    # 2) 반경 내에 없으면 가장 가까운 1개만 찾기 (폴백)
    used_fallback = False
    if not nearby:
        wider = search_trdar_by_coord(lat, lng, 1500, limit=1)
        nearby = wider[:1] if wider else []
        used_fallback = True

    # 3) 점포 데이터 (공공데이터 API — 이미 반경 반영)
    try:
        store_df = get_stores_in_radius(lat, lng, radius)
    except Exception:
        store_df = pd.DataFrame()
    store_summary = summarize_stores(store_df)
    stores_list = []
    if not store_df.empty:
        cols = ["상호명", "대분류명", "중분류명", "소분류명", "도로명주소", "위도", "경도"]
        cols = [c for c in cols if c in store_df.columns]
        stores_list = store_df[cols].to_dict("records")

    # 4) 서울시 데이터 집계 (거리 가중치 적용)
    agg_sales, agg_ft, agg_pop, agg_sc, all_sc_df = _aggregate_trdar_data(nearby, radius)

    # 5) 점포 API 실패 시 CSV 폴백
    if store_df.empty and not all_sc_df.empty:
        store_summary = _build_store_summary_from_sc(all_sc_df)

    # 6) 임대료 — 구 이름은 상권 영역 CSV에서 가져옴
    gu_name = ""
    if "시군구명" in store_df.columns and not store_df.empty:
        gu_name = store_df["시군구명"].mode().iloc[0] if not store_df["시군구명"].mode().empty else ""
    if not gu_name and nearby:
        gu_name = nearby[0].get("gu", "")
    if not gu_name:
        # 상권 영역 좌표에서 가장 가까운 상권의 구 이름
        from services.seoul_api import _load_area
        area_df = _load_area()
        if not area_df.empty and "자치구명" in area_df.columns:
            nearest = search_trdar_by_coord(lat, lng, 1000, limit=1)
            if nearest:
                cd = nearest[0].get("trdar_cd", "")
                match = area_df[area_df["상권_코드"].astype(str) == cd]
                if not match.empty:
                    gu_name = match.iloc[0].get("자치구명", "")
    rent_info = get_rent_by_gu(gu_name) if gu_name else {}

    # 7) 매출 추정
    ft_estimate = estimate_by_foot_traffic(agg_ft, store_summary)
    rent_estimate = estimate_by_rent(rent_info, store_summary)
    per_store_avg = agg_sales.get("per_store", [])
    cross_result = cross_validate(per_store_avg, ft_estimate, rent_estimate)

    # 8) 기회 분석
    opportunities = analyze_opportunities(
        store_summary, agg_sales, agg_ft, agg_pop, agg_sc
    )

    return {
        "store_summary": store_summary,
        "stores": stores_list,
        "sales_summary": agg_sales,
        "ft_summary": agg_ft,
        "pop_summary": agg_pop,
        "sc_summary": agg_sc,
        "rent_info": rent_info,
        "cross_result": cross_result,
        "opportunities": opportunities,
        "trdar_count": len(nearby),
        "trdar_names": [item.get("trdar_nm", "") for item in nearby[:5]],
        "used_fallback": used_fallback,
        "gu_name": gu_name,
    }


# ── 대시보드: 추천 상권 (실제 CSV 기반 · 일 1회 캐시 갱신) ──

import time as _time

_recommend_cache: dict = {"data": None, "ts": 0}
_CACHE_TTL = 86400  # 24시간


def _build_recommendations() -> list[dict]:
    """4분기 연속 데이터가 있고 안정적으로 성장 중인 상권을 추천한다.

    단발성 급등(신규 업종 진입, 데이터 누락 후 복구 등)을 제외하고
    실제 꾸준히 성장하는 상권만 선별한다.

    선정 기준:
    - 매출: 4분기 연속 10억 이상 + 연속 증가
    - 유동인구: 4분기 연속 존재 + 연속 증가 + 일평균 5천명 이상
    - 개업: 점포 30개 이상 + 개업률 5% 이상 + 폐업 < 개업 (순증)
    """
    from services.seoul_api import _load, _load_area, STORE_FILE, FLPOP_FILE, SALES_FILE

    # 상권 좌표 매핑
    area_df = _load_area()
    coord_map: dict[str, dict] = {}
    if not area_df.empty:
        for _, r in area_df.iterrows():
            try:
                coord_map[r["상권_코드_명"]] = {"lat": float(r["위도"]), "lng": float(r["경도"])}
            except (ValueError, TypeError):
                pass

    scored: list[dict] = []

    # ── 1) 매출 — 4분기 연속 성장 상권 ──
    sales_df = _load(SALES_FILE)
    if not sales_df.empty:
        sales_df["당월_매출_금액"] = pd.to_numeric(sales_df["당월_매출_금액"], errors="coerce")
        sq = sorted(sales_df["기준_년분기_코드"].unique())
        last4 = sq[-4:] if len(sq) >= 4 else sq

        for name in sales_df["상권_코드_명"].unique():
            sub = sales_df[sales_df["상권_코드_명"] == name]
            qvals = []
            for q in last4:
                val = sub[sub["기준_년분기_코드"] == q]["당월_매출_금액"].sum()
                qvals.append(val)

            # 4분기 모두 10억 이상
            if len(qvals) < 4 or not all(v >= 1e9 for v in qvals):
                continue

            # 연속 증가 확인
            rates = []
            for i in range(1, len(qvals)):
                if qvals[i - 1] > 0:
                    rates.append((qvals[i] - qvals[i - 1]) / qvals[i - 1] * 100)
            if not rates or not all(r > 0 for r in rates):
                continue

            # 비현실적 급등 제외 (분기 성장률 80% 이상은 데이터 이상)
            if any(r > 80 for r in rates):
                continue

            avg_growth = round(sum(rates) / len(rates), 1)
            latest_억 = round(qvals[-1] / 1e8, 1)
            scored.append({
                "name": name,
                "score": avg_growth * 1.5,
                "description": f"분기 매출 {latest_억}억원, 4분기 연속 성장",
                "stat": f"+{avg_growth}%",
                "statLabel": "평균 매출 성장률",
                "statColor": "amber",
                **coord_map.get(name, {}),
            })

    # ── 2) 유동인구 — 4분기 연속 증가 상권 ──
    ft_df = _load(FLPOP_FILE)
    if not ft_df.empty:
        ft_df["총_유동인구_수"] = pd.to_numeric(ft_df["총_유동인구_수"], errors="coerce")
        fq = sorted(ft_df["기준_년분기_코드"].unique())
        last4_ft = fq[-4:] if len(fq) >= 4 else fq

        for name in ft_df["상권_코드_명"].unique():
            sub = ft_df[ft_df["상권_코드_명"] == name]
            qvals = []
            for q in last4_ft:
                val = sub[sub["기준_년분기_코드"] == q]["총_유동인구_수"].sum()
                qvals.append(val)

            if len(qvals) < 4:
                continue
            daily_latest = int(qvals[-1] / 90)
            if daily_latest < 5000:
                continue
            if not all(v > 0 for v in qvals):
                continue

            rates = []
            for i in range(1, len(qvals)):
                if qvals[i - 1] > 0:
                    rates.append((qvals[i] - qvals[i - 1]) / qvals[i - 1] * 100)
            if not rates or not all(r > 0 for r in rates):
                continue
            if any(r > 80 for r in rates):
                continue

            avg_growth = round(sum(rates) / len(rates), 1)
            daily_str = f"{round(daily_latest / 10000, 1)}만명" if daily_latest >= 10000 else f"{daily_latest:,}명"
            scored.append({
                "name": name,
                "score": avg_growth * 1.2,
                "description": f"일평균 유동인구 {daily_str}, 4분기 연속 증가",
                "stat": f"+{avg_growth}%",
                "statLabel": "평균 유동인구 증가율",
                "statColor": "blue",
                **coord_map.get(name, {}),
            })

    # ── 3) 개업 — 순증 + 높은 개업률 ──
    store_df = _load(STORE_FILE)
    if not store_df.empty:
        for col in ("점포_수", "개업_점포_수", "폐업_점포_수"):
            store_df[col] = pd.to_numeric(store_df[col], errors="coerce")
        latest_q = sorted(store_df["기준_년분기_코드"].unique())[-1]

        cur = store_df[store_df["기준_년분기_코드"] == latest_q].groupby("상권_코드_명").agg(
            점포수=("점포_수", "sum"), 개업수=("개업_점포_수", "sum"), 폐업수=("폐업_점포_수", "sum"),
        ).reset_index()

        cur = cur[(cur["점포수"] >= 30) & (cur["개업수"] > cur["폐업수"])].copy()
        cur["개업률"] = (cur["개업수"] / cur["점포수"].clip(lower=1) * 100).round(1)
        cur = cur[cur["개업률"] >= 5.0]

        for _, row in cur.iterrows():
            name = row["상권_코드_명"]
            net = int(row["개업수"] - row["폐업수"])
            scored.append({
                "name": name,
                "score": row["개업률"] * 1.0,
                "description": f"점포 {int(row['점포수'])}개, 순증 +{net}개",
                "stat": f"+{row['개업률']}%",
                "statLabel": "신규 개업률",
                "statColor": "emerald",
                **coord_map.get(name, {}),
            })

    # ── 종합: 상권명 중복 제거 + 점수 상위 6개 ──
    best: dict[str, dict] = {}
    for item in scored:
        name = item["name"]
        if name not in best or item["score"] > best[name]["score"]:
            best[name] = item

    ranked = sorted(best.values(), key=lambda x: x["score"], reverse=True)
    return ranked[:6]


@app.get("/api/dashboard/recommended")
def dashboard_recommended():
    """추천 상권 TOP 6. 24시간 캐시."""
    now = _time.time()
    if _recommend_cache["data"] is None or now - _recommend_cache["ts"] > _CACHE_TTL:
        _recommend_cache["data"] = _build_recommendations()
        _recommend_cache["ts"] = now
    return _recommend_cache["data"]


@app.get("/api/dashboard/stats")
def dashboard_stats():
    """대시보드 요약 통계를 반환한다."""
    from services.seoul_api import _load, STORE_FILE, FLPOP_FILE, AREA_FILE

    area_df = _load(AREA_FILE)
    store_df = _load(STORE_FILE)

    total_districts = len(area_df["상권_코드"].unique()) if not area_df.empty else 0

    total_stores = 0
    if not store_df.empty:
        latest_q = store_df["기준_년분기_코드"].max()
        latest = store_df[store_df["기준_년분기_코드"] == latest_q]
        total_stores = int(pd.to_numeric(latest["점포_수"], errors="coerce").sum())

    return {
        "totalDistricts": total_districts,
        "totalStores": total_stores,
    }


# ── 네이버 추정 임대료 조회 ──

@app.get("/api/naver-rent")
def naver_rent(dong: str = Query(""), floor: str = Query("1층"), days: int = Query(30)):
    """네이버 부동산 호가 기반 추정 임대료 조회"""
    from services.naver_crawler import query_estimated_rent
    return query_estimated_rent(dong, floor, days)


# ── 인근 임대료 사례 조회 (73,870건 기반) ──

import math as _math

_rent_est_cache = None
_rent_est_mtime = 0

def _load_rent_estimates():
    global _rent_est_cache, _rent_est_mtime
    path = os.path.join(ROOT, "상권데이터", "rent_estimates_all.json")
    if not os.path.exists(path):
        return []
    mtime = os.path.getmtime(path)
    if _rent_est_cache is not None and mtime == _rent_est_mtime:
        return _rent_est_cache
    import json
    with open(path, "r", encoding="utf-8") as f:
        _rent_est_cache = json.load(f)
    _rent_est_mtime = mtime
    print(f"[임대료] 데이터 로드: {len(_rent_est_cache)}건, target_pyeong 필드: {'target_pyeong' in (_rent_est_cache[0] if _rent_est_cache else {})}")
    return _rent_est_cache

def _haversine_m(lat1, lng1, lat2, lng2):
    R = 6371000
    dlat = _math.radians(lat2 - lat1)
    dlng = _math.radians(lng2 - lng1)
    a = _math.sin(dlat/2)**2 + _math.cos(_math.radians(lat1)) * _math.cos(_math.radians(lat2)) * _math.sin(dlng/2)**2
    return R * 2 * _math.atan2(_math.sqrt(a), _math.sqrt(1-a))

@app.get("/api/rent-nearby")
def rent_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(500),
    target_pyeong: int = Query(10),
):
    """좌표 반경 내 임대료 사례 조회 + 층별 통계

    최소 50건 이상 확보. 부족하면 반경 자동 확장.
    50건 이상이면 가까운 상권 우선 (거리 가중 평균).
    """
    data = _load_rent_estimates()
    if not data:
        return {"cases": [], "stats": {}}

    # 면적 체감 계수
    _AREA_DISCOUNT = {10: 1.0, 30: 0.88, 50: 0.78, 100: 0.65, 200: 0.52}
    discount = _AREA_DISCOUNT.get(target_pyeong, 1.0)
    if target_pyeong not in _AREA_DISCOUNT:
        # 보간
        keys = sorted(_AREA_DISCOUNT.keys())
        for i in range(len(keys) - 1):
            if keys[i] <= target_pyeong <= keys[i+1]:
                ratio = (target_pyeong - keys[i]) / (keys[i+1] - keys[i])
                discount = _AREA_DISCOUNT[keys[i]] * (1 - ratio) + _AREA_DISCOUNT[keys[i+1]] * ratio
                break

    # 면적 구간 필터 (±50% 범위의 사례)
    target_m2 = target_pyeong * 3.3
    area_lo = target_m2 * 0.5
    area_hi = target_m2 * 1.5

    # 반경 내 필터 — 같은 구 우선
    nearby = []
    closest_gu = ""
    closest_dist = float("inf")
    for d in data:
        dist = _haversine_m(lat, lng, d["lat"], d["lng"])
        if dist < closest_dist:
            closest_dist = dist
            closest_gu = d.get("gu", "")

    for d in data:
        # 면적 필터: 요청한 면적의 사례만
        d_pyeong = d.get("target_pyeong", 10)
        if d_pyeong != target_pyeong:
            continue

        dist = _haversine_m(lat, lng, d["lat"], d["lng"])
        if dist <= radius:
            d_copy = dict(d)
            effective_dist = dist if d.get("gu") == closest_gu else dist * 2
            d_copy["distance"] = round(effective_dist)
            nearby.append(d_copy)

    # 3건 미만이면 단계적 반경 확장 (선택 반경 기준 점진적 확장)
    actual_radius = radius
    expand_steps = [r for r in [200, 300, 500, 800, 1000, 1500, 2000, 3000] if r > radius]
    for expand_r in expand_steps:
        if len(nearby) >= 3:
            break
        nearby = []
        actual_radius = expand_r
        for d in data:
            d_pyeong = d.get("target_pyeong", 10)
            if d_pyeong != target_pyeong:
                continue
            dist = _haversine_m(lat, lng, d["lat"], d["lng"])
            if dist <= expand_r:
                d_copy = dict(d)
                effective_dist = dist if d.get("gu") == closest_gu else dist * 1.5
                d_copy["distance"] = round(effective_dist)
                nearby.append(d_copy)

    nearby.sort(key=lambda x: x["distance"])

    # 층별 통계 (새 구조: 각 사례에 floor 필드가 있음)
    f1 = [c for c in nearby if c.get("floor") == "1층"]
    f2 = [c for c in nearby if c.get("floor") == "2층"]
    b1 = [c for c in nearby if c.get("floor") == "지하"]
    # 구 구조 폴백 (floor 필드 없으면)
    if not f1 and not f2 and not b1:
        f1 = [c for c in nearby if c.get("f1_rent", 0) > 0]
        f2 = [c for c in nearby if c.get("f2_rent", 0) > 0]
        b1 = [c for c in nearby if c.get("b1_rent", 0) > 0]

    def stats(cases, key_rent, key_deposit, key_pyeong=None):
        if not cases:
            return {"count": 0, "avg_rent": 0, "avg_deposit": 0, "avg_pyeong": 0, "min_rent": 0, "max_rent": 0, "median_rent": 0}
        # 거리 가중 평균 (가까울수록 가중치 높음)
        max_dist = max(c.get("distance", 1) for c in cases) or 1
        weights = [max(0.3, 1 - c.get("distance", 0) / (max_dist * 1.5)) for c in cases]
        total_w = sum(weights)

        rents = [c[key_rent] for c in cases]
        deposits = [c[key_deposit] for c in cases]
        pyeongs = [c.get(key_pyeong, 0) for c in cases] if key_pyeong else [0]

        w_avg_rent = round(sum(r * w for r, w in zip(rents, weights)) / total_w) if total_w > 0 else 0
        w_avg_dep = round(sum(d * w for d, w in zip(deposits, weights)) / total_w) if total_w > 0 else 0
        w_avg_pp = round(sum(p * w for p, w in zip(pyeongs, weights)) / total_w, 1) if key_pyeong and total_w > 0 else 0

        rents_sorted = sorted(rents)
        return {
            "count": len(cases),
            "avg_rent": w_avg_rent,
            "median_rent": rents_sorted[len(rents_sorted)//2],
            "min_rent": rents_sorted[0],
            "max_rent": rents_sorted[-1],
            "avg_deposit": w_avg_dep,
            "avg_pyeong": w_avg_pp,
        }

    def stats_new(cases):
        """통계 — 데이터 직접 사용 (면적별 사례가 이미 분리됨)"""
        if not cases:
            return {"count": 0, "avg_rent": 0, "avg_deposit": 0, "avg_pyeong": 0, "min_rent": 0, "max_rent": 0, "median_rent": 0, "target_pyeong": target_pyeong}
        max_dist = max(c.get("distance", 1) for c in cases) or 1
        weights = [max(0.3, 1 - c.get("distance", 0) / (max_dist * 1.5)) for c in cases]
        total_w = sum(weights)

        rents = [c.get("rent", 0) for c in cases]
        deposits = [c.get("deposit", 0) for c in cases]
        pyeongs = [c.get("rent_pyeong", 0) for c in cases]

        w_avg_rent = round(sum(r * w for r, w in zip(rents, weights)) / total_w) if total_w > 0 else 0
        w_avg_dep = round(sum(d * w for d, w in zip(deposits, weights)) / total_w) if total_w > 0 else 0
        w_avg_pp = round(sum(p * w for p, w in zip(pyeongs, weights)) / total_w, 1) if total_w > 0 else 0

        rents_sorted = sorted(r for r in rents if r > 0) or [0]
        return {
            "count": len(cases),
            "avg_rent": w_avg_rent,
            "median_rent": rents_sorted[len(rents_sorted)//2],
            "min_rent": rents_sorted[0],
            "max_rent": rents_sorted[-1],
            "avg_deposit": w_avg_dep,
            "avg_pyeong": w_avg_pp,
            "target_pyeong": target_pyeong,
        }

    return {
        "total_cases": len(nearby),
        "radius": actual_radius,
        "stats": {
            "1층": stats_new(f1),
            "2층": stats_new(f2),
            "지하": stats_new(b1),
        },
        "sample_cases": nearby[:20],
    }


# ── 상가 임대료 실거래 ──

@app.get("/api/rent-live/{gu_name}")
def rent_live(gu_name: str, year: int = Query(2025)):
    """구별 상가 임대료 실거래 통계"""
    result = get_store_rent_by_gu(gu_name, year)
    if not result:
        return JSONResponse({"error": "임대료 데이터 없음"}, status_code=404)
    return result


# ── 상업용 부동산 매매 실거래 ──

@app.get("/api/sale-live/{gu_name}")
def sale_live(gu_name: str, year: int = Query(2025)):
    """구별 상업용 부동산 매매 실거래 통계"""
    result = get_store_sale_by_gu(gu_name, year)
    if not result:
        return JSONResponse({"error": "매매 데이터 없음"}, status_code=404)
    return result


# ── 상권 선택 가능한 목록 ──

# 대표 상권 그룹: 키워드 → 포함할 상권명들
_AREA_GROUPS = {
    "명동": ["명동역(명동재미로)", "명동(명동거리)", "명동 남대문 북창동 다동 무교동 관광특구"],
    "강남역": ["강남역"],
    "한남동": ["한남오거리", "한남초등학교", "한남IC"],
    "성수동": ["성수동카페거리", "성수1가1동주민센터", "성수2가3동주민센터"],
    "도산공원": ["도산공원북측", "도산공원교차로"],
    "홍대입구": ["서교동(홍대)", "홍대입구역 3번", "홍대땡땡거리"],
    "연남동": ["연트럴파크(연남동주민센터)", "연남동(홍대)"],
    "이태원": ["이태원(이태원역)", "이태원역 북측", "이태원시장"],
    "여의도": ["여의도역(여의도)"],
    "잠실": ["잠실역", "잠실새내역(신천)", "잠실나루역"],
    "서울 전체": [],  # 전체 합산
}


@app.get("/api/dashboard/area-groups")
def area_groups():
    """선택 가능한 상권 그룹 목록을 반환한다."""
    return [{"key": k, "label": k} for k in _AREA_GROUPS.keys()]


@app.get("/api/dashboard/trend")
def dashboard_trend(
    area: str = Query("서울 전체"),
    period: str = Query("6m"),
):
    """상권별 · 기간별 트렌드를 반환한다.

    - 개폐업: 최대 1년 (점포 CSV가 4분기만 보유)
    - 매출: 최대 1년 + 업종별 분기 매출 (매출 CSV 4분기)
    - 유동인구: 최대 7년 (유동인구 CSV 28분기)
    """
    from services.seoul_api import _load, STORE_FILE, FLPOP_FILE, SALES_FILE

    period_map = {"3m": 1, "6m": 2, "1y": 4, "2y": 8, "3y": 12}
    n_quarters = period_map.get(period, 2)

    group_names = _AREA_GROUPS.get(area, [])

    result = {
        "개폐업": [],
        "유동인구": [],
        "매출": [],
        "매출_업종별": [],
        "data_range": {},  # 각 데이터의 실제 기간 범위
    }

    # ── 1) 개폐업 (최대 4분기) ──
    store_df = _load(STORE_FILE)
    if not store_df.empty:
        for col in ("점포_수", "개업_점포_수", "폐업_점포_수"):
            store_df[col] = pd.to_numeric(store_df[col], errors="coerce")

        sdf = store_df[store_df["상권_코드_명"].isin(group_names)] if group_names else store_df
        sq = sorted(sdf["기준_년분기_코드"].unique())
        n_store = min(n_quarters, len(sq))
        target_q = sq[-n_store:]

        for q in target_q:
            qdata = sdf[sdf["기준_년분기_코드"] == q]
            label = f"{str(q)[:4]}.Q{str(q)[-1]}"
            result["개폐업"].append({
                "quarter": label,
                "개업": int(qdata["개업_점포_수"].sum()),
                "폐업": int(qdata["폐업_점포_수"].sum()),
                "점포수": int(qdata["점포_수"].sum()),
            })
        result["data_range"]["개폐업"] = f"{len(sq)}분기 보유"

    # ── 2) 매출 + 업종별 매출 (최대 4분기) ──
    sales_df = _load(SALES_FILE)
    if not sales_df.empty:
        sales_df["당월_매출_금액"] = pd.to_numeric(sales_df["당월_매출_금액"], errors="coerce")
        sales_df["당월_매출_건수"] = pd.to_numeric(sales_df["당월_매출_건수"], errors="coerce")

        sls = sales_df[sales_df["상권_코드_명"].isin(group_names)] if group_names else sales_df
        slq = sorted(sls["기준_년분기_코드"].unique())
        n_sales = min(n_quarters, len(slq))
        target_slq = slq[-n_sales:]

        for q in target_slq:
            qdata = sls[sls["기준_년분기_코드"] == q]
            label = f"{str(q)[:4]}.Q{str(q)[-1]}"
            total = int(qdata["당월_매출_금액"].sum())
            count = int(qdata["당월_매출_건수"].sum())
            result["매출"].append({
                "quarter": label,
                "매출_억": round(total / 1e8, 1),
                "건수_만": round(count / 1e4, 1),
            })

        # 업종별 매출 (최신 분기 vs 이전 분기 비교)
        if len(slq) >= 2:
            latest_q, prev_q = slq[-1], slq[-2]
            cur_by_ind = sls[sls["기준_년분기_코드"] == latest_q].groupby("서비스_업종_코드_명")["당월_매출_금액"].sum()
            pre_by_ind = sls[sls["기준_년분기_코드"] == prev_q].groupby("서비스_업종_코드_명")["당월_매출_금액"].sum()

            industry_list = []
            for ind in cur_by_ind.index:
                cur_val = cur_by_ind[ind]
                pre_val = pre_by_ind.get(ind, 0)
                change = round((cur_val - pre_val) / max(pre_val, 1) * 100, 1) if pre_val > 0 else 0
                industry_list.append({
                    "업종": ind,
                    "매출_억": round(cur_val / 1e8, 1),
                    "전분기대비": change,
                })
            industry_list.sort(key=lambda x: x["매출_억"], reverse=True)
            result["매출_업종별"] = industry_list[:15]  # 상위 15개

        result["data_range"]["매출"] = f"{len(slq)}분기 보유"

    # ── 3) 유동인구 (최대 28분기) ──
    ft_df = _load(FLPOP_FILE)
    if not ft_df.empty:
        ft_df["총_유동인구_수"] = pd.to_numeric(ft_df["총_유동인구_수"], errors="coerce")
        fdf = ft_df[ft_df["상권_코드_명"].isin(group_names)] if group_names else ft_df
        fq = sorted(fdf["기준_년분기_코드"].unique())
        n_ft = min(n_quarters, len(fq))
        target_fq = fq[-n_ft:]

        for q in target_fq:
            qdata = fdf[fdf["기준_년분기_코드"] == q]
            total = int(qdata["총_유동인구_수"].sum())
            daily = int(total / 90)
            label = f"{str(q)[:4]}.Q{str(q)[-1]}"
            result["유동인구"].append({
                "quarter": label,
                "유동인구": daily,
            })
        result["data_range"]["유동인구"] = f"{len(fq)}분기 보유"

    return result
