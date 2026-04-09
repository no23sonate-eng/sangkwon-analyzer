"""서울시 상권분석 — CSV 파일 기반 데이터 조회"""

from __future__ import annotations

import math
import os
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "상권데이터")
AREA_FILE = "상권_영역_좌표.csv"

# ── CSV 로딩 (LRU 캐싱 — 최대 2개만 유지) ─────────────────────
import weakref
from collections import OrderedDict

_cache: OrderedDict[str, pd.DataFrame] = OrderedDict()
_CACHE_MAX = 2  # 동시에 메모리에 유지할 최대 CSV 수


def _load(filename: str) -> pd.DataFrame:
    if filename in _cache:
        _cache.move_to_end(filename)
        return _cache[filename]
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return pd.DataFrame()
    try:
        df = pd.read_csv(path, encoding="cp949")
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding="utf-8-sig")
    _cache[filename] = df
    # 오래된 캐시 제거
    while len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)
    return df


SALES_FILE = "서울시 상권분석서비스(추정매출-상권).csv"
FLPOP_FILE = "서울시 상권분석서비스(길단위인구-상권).csv"
POPLTN_FILE = "서울시 상권분석서비스(직장인구-상권).csv"
STORE_FILE = "서울시 상권분석서비스(점포-상권)_2024년.csv"


def _latest_quarter(df: pd.DataFrame) -> pd.DataFrame:
    """최신 분기 데이터만 반환"""
    if df.empty or "기준_년분기_코드" not in df.columns:
        return df
    latest = df["기준_년분기_코드"].max()
    return df[df["기준_년분기_코드"] == latest]


# ── 상권코드 조회 ──────────────────────────────────────────────

def _extract_keywords(address: str) -> list[str]:
    """주소 문자열에서 검색용 키워드를 다양하게 추출한다."""
    import re

    keywords: list[str] = []

    # 역 이름 추출 ("강남역" → "강남")
    station = re.findall(r"(\S+?)역(?:\s|$)", address)
    keywords.extend(station)

    # 동/로/가 추출 ("한남동" → "한남동", "한남")
    dong_matches = re.findall(r"(\S+?[동로가])(?:\s|$|\d)", address)
    for d in dong_matches:
        keywords.append(d)
        for suffix in ("동", "로", "가"):
            if d.endswith(suffix) and len(d) > len(suffix):
                keywords.append(d[: -len(suffix)])

    # 구 이름 추출 ("용산구" → "용산")
    gu_matches = re.findall(r"(\S+?)구(?:\s|$)", address)
    keywords.extend(gu_matches)

    # 공백으로 분리한 토큰 중 2글자 이상
    tokens = address.replace(",", " ").split()
    for t in tokens:
        clean = re.sub(r"[시도구군읍면리]$", "", t)
        if len(clean) >= 2 and clean not in keywords:
            keywords.append(clean)

    # 원본도 포함
    keywords.append(address.strip())

    # 중복 제거하면서 순서 유지
    seen = set()
    unique = []
    for k in keywords:
        k = k.strip()
        if k and k not in seen:
            seen.add(k)
            unique.append(k)
    return unique


def get_trdar_cd_by_dong(adong_nm: str) -> list[dict]:
    """행정동명(키워드)으로 상권코드 목록을 조회한다."""
    df = _load(SALES_FILE)
    if df.empty:
        return []

    # "한남동" → "한남" 처럼 '동/로/가' 접미사 제거 후 검색
    keywords = [adong_nm]
    for suffix in ("동", "로", "가"):
        if adong_nm.endswith(suffix) and len(adong_nm) > len(suffix):
            keywords.append(adong_nm[: -len(suffix)])

    seen = {}
    for kw in keywords:
        matched = df[df["상권_코드_명"].str.contains(kw, na=False)]
        for _, r in matched.iterrows():
            cd = str(r["상권_코드"])
            if cd not in seen:
                seen[cd] = {
                    "trdar_cd": cd,
                    "trdar_nm": r["상권_코드_명"],
                    "adstrd_nm": adong_nm,
                }
        if seen:
            break
    return list(seen.values())


def search_trdar_by_name(keyword: str) -> list[dict]:
    """상권명 키워드로 상권코드를 검색한다."""
    return get_trdar_cd_by_dong(keyword)


def search_trdar_broad(address: str, dong_name: str = "") -> list[dict]:
    """주소/동명에서 키워드를 추출하여 폭넓게 상권을 검색한다.

    모든 매칭 상권을 반환하며, 키워드 우선순위에 따라 정렬한다.
    """
    df = _load(SALES_FILE)
    if df.empty:
        return []

    # 키워드 생성: 동 이름 우선 + 주소에서 추출
    raw_keywords: list[str] = []
    if dong_name:
        raw_keywords.append(dong_name)
        for suffix in ("동", "로", "가"):
            if dong_name.endswith(suffix) and len(dong_name) > len(suffix):
                raw_keywords.append(dong_name[: -len(suffix)])
    raw_keywords.extend(_extract_keywords(address))

    # 중복 제거
    seen_kw: set[str] = set()
    keywords: list[str] = []
    for k in raw_keywords:
        if k not in seen_kw:
            seen_kw.add(k)
            keywords.append(k)

    names = df[["상권_코드", "상권_코드_명"]].drop_duplicates()

    seen: dict[str, dict] = {}
    for priority, kw in enumerate(keywords):
        matched = names[names["상권_코드_명"].str.contains(kw, na=False)]
        for _, r in matched.iterrows():
            cd = str(r["상권_코드"])
            if cd not in seen:
                seen[cd] = {
                    "trdar_cd": cd,
                    "trdar_nm": r["상권_코드_명"],
                    "keyword": kw,
                    "priority": priority,
                }

    results = sorted(seen.values(), key=lambda x: x["priority"])
    return results


# ── 좌표 기반 상권 검색 ──────────────────────────────────────────

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 좌표 간 거리(m)를 계산한다."""
    R = 6371000
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _load_area() -> pd.DataFrame:
    """상권 영역 좌표 CSV를 로드한다."""
    return _load(AREA_FILE)


def search_trdar_by_coord(lat: float, lng: float, radius: int = 500, limit: int = 10) -> list[dict]:
    """좌표 기반으로 반경 내 가장 가까운 상권들을 검색한다.

    Args:
        lat: 위도 (WGS84)
        lng: 경도 (WGS84)
        radius: 검색 반경(m). 기본 500m.
        limit: 최대 반환 개수.

    Returns:
        거리순으로 정렬된 상권 목록.
    """
    area_df = _load_area()
    if area_df.empty:
        return []

    # 매출 데이터에 존재하는 상권코드만 필터 (실제 분석 가능한 상권)
    sales_df = _load(SALES_FILE)
    if not sales_df.empty:
        valid_codes = set(sales_df["상권_코드"].astype(str).unique())
    else:
        valid_codes = None

    results = []
    for _, row in area_df.iterrows():
        try:
            r_lat = float(row["위도"])
            r_lng = float(row["경도"])
        except (ValueError, TypeError):
            continue

        dist = _haversine(lat, lng, r_lat, r_lng)
        if dist <= radius:
            cd = str(row["상권_코드"])
            # 매출 데이터가 있는 상권만 포함
            if valid_codes is not None and cd not in valid_codes:
                continue
            results.append({
                "trdar_cd": cd,
                "trdar_nm": row["상권_코드_명"],
                "distance": round(dist),
                "gu": row.get("자치구명", ""),
                "dong": row.get("행정동명", ""),
            })

    results.sort(key=lambda x: x["distance"])
    return results[:limit]


# ── 추정매출 ──────────────────────────────────────────────────

def get_sales(trdar_cd: str) -> pd.DataFrame:
    df = _load(SALES_FILE)
    if df.empty:
        return pd.DataFrame()
    filtered = df[df["상권_코드"].astype(str) == str(trdar_cd)]
    return _latest_quarter(filtered)


def summarize_sales(df: pd.DataFrame, store_count_df: pd.DataFrame = None) -> dict:
    if df.empty:
        return {"by_service": [], "per_store": [], "time_slots": {}, "day_of_week": {}, "total_sales": 0, "total_count": 0}

    df = df.copy()

    by_service = []
    per_store = []
    total_sales = 0
    total_count = 0

    if "서비스_업종_코드_명" in df.columns and "당월_매출_금액" in df.columns:
        df["당월_매출_금액"] = pd.to_numeric(df["당월_매출_금액"], errors="coerce")
        df["당월_매출_건수"] = pd.to_numeric(df.get("당월_매출_건수", 0), errors="coerce")
        total_sales = int(df["당월_매출_금액"].sum())
        total_count = int(df["당월_매출_건수"].sum())

        grouped = df.groupby("서비스_업종_코드_명").agg(
            매출액=("당월_매출_금액", "sum"),
            건수=("당월_매출_건수", "sum"),
        ).sort_values("매출액", ascending=False)

        for svc, row in grouped.iterrows():
            by_service.append({"업종": svc, "매출액": int(row["매출액"]), "건수": int(row["건수"])})

        # 점포당 평균 매출 계산
        if store_count_df is not None and not store_count_df.empty:
            sc = store_count_df.copy()
            if "서비스_업종_코드_명" in sc.columns and "점포_수" in sc.columns:
                sc["점포_수"] = pd.to_numeric(sc["점포_수"], errors="coerce")
                sc_grouped = sc.groupby("서비스_업종_코드_명")["점포_수"].sum()

                for svc, row in grouped.iterrows():
                    store_cnt = sc_grouped.get(svc, 0)
                    if store_cnt > 0:
                        avg_sales = int(row["매출액"] / store_cnt)
                        avg_count = int(row["건수"] / store_cnt)
                        per_store.append({
                            "업종": svc,
                            "점포수": int(store_cnt),
                            "총매출": int(row["매출액"]),
                            "점포당_매출": avg_sales,
                            "점포당_건수": avg_count,
                        })

                per_store.sort(key=lambda x: x["점포당_매출"], reverse=True)

    time_cols = {
        "시간대_00~06_매출_금액": "00~06시",
        "시간대_06~11_매출_금액": "06~11시",
        "시간대_11~14_매출_금액": "11~14시",
        "시간대_14~17_매출_금액": "14~17시",
        "시간대_17~21_매출_금액": "17~21시",
        "시간대_21~24_매출_금액": "21~24시",
    }
    time_slots = {}
    for col, label in time_cols.items():
        if col in df.columns:
            time_slots[label] = int(pd.to_numeric(df[col], errors="coerce").sum())

    day_cols = {
        "월요일_매출_금액": "월",
        "화요일_매출_금액": "화",
        "수요일_매출_금액": "수",
        "목요일_매출_금액": "목",
        "금요일_매출_금액": "금",
        "토요일_매출_금액": "토",
        "일요일_매출_금액": "일",
    }
    day_of_week = {}
    for col, label in day_cols.items():
        if col in df.columns:
            day_of_week[label] = int(pd.to_numeric(df[col], errors="coerce").sum())

    return {
        "by_service": by_service,
        "per_store": per_store,
        "time_slots": time_slots,
        "day_of_week": day_of_week,
        "total_sales": total_sales,
        "total_count": total_count,
    }


# ── 유동인구 ──────────────────────────────────────────────────

def get_foot_traffic(trdar_cd: str) -> pd.DataFrame:
    df = _load(FLPOP_FILE)
    if df.empty:
        return pd.DataFrame()
    filtered = df[df["상권_코드"].astype(str) == str(trdar_cd)]
    return _latest_quarter(filtered)


def summarize_foot_traffic(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"total": 0, "time_slots": {}, "by_gender": {}, "by_age": {}, "by_day": {}}

    total = 0
    if "총_유동인구_수" in df.columns:
        total = int(pd.to_numeric(df["총_유동인구_수"], errors="coerce").sum())

    time_cols = {
        "시간대_00_06_유동인구_수": "00~06시",
        "시간대_06_11_유동인구_수": "06~11시",
        "시간대_11_14_유동인구_수": "11~14시",
        "시간대_14_17_유동인구_수": "14~17시",
        "시간대_17_21_유동인구_수": "17~21시",
        "시간대_21_24_유동인구_수": "21~24시",
    }
    time_slots = {}
    for col, label in time_cols.items():
        if col in df.columns:
            time_slots[label] = int(pd.to_numeric(df[col], errors="coerce").sum())

    by_gender = {}
    if "남성_유동인구_수" in df.columns:
        by_gender["남성"] = int(pd.to_numeric(df["남성_유동인구_수"], errors="coerce").sum())
    if "여성_유동인구_수" in df.columns:
        by_gender["여성"] = int(pd.to_numeric(df["여성_유동인구_수"], errors="coerce").sum())

    age_cols = {
        "연령대_10_유동인구_수": "10대",
        "연령대_20_유동인구_수": "20대",
        "연령대_30_유동인구_수": "30대",
        "연령대_40_유동인구_수": "40대",
        "연령대_50_유동인구_수": "50대",
        "연령대_60_이상_유동인구_수": "60대 이상",
    }
    by_age = {}
    for col, label in age_cols.items():
        if col in df.columns:
            by_age[label] = int(pd.to_numeric(df[col], errors="coerce").sum())

    day_cols = {
        "월요일_유동인구_수": "월",
        "화요일_유동인구_수": "화",
        "수요일_유동인구_수": "수",
        "목요일_유동인구_수": "목",
        "금요일_유동인구_수": "금",
        "토요일_유동인구_수": "토",
        "일요일_유동인구_수": "일",
    }
    by_day = {}
    for col, label in day_cols.items():
        if col in df.columns:
            by_day[label] = int(pd.to_numeric(df[col], errors="coerce").sum())

    return {
        "total": total,
        "time_slots": time_slots,
        "by_gender": by_gender,
        "by_age": by_age,
        "by_day": by_day,
    }


# ── 상주인구 (직장인구로 대체) ───────────────────────────────────

def get_resident_population(trdar_cd: str) -> pd.DataFrame:
    df = _load(POPLTN_FILE)
    if df.empty:
        return pd.DataFrame()
    filtered = df[df["상권_코드"].astype(str) == str(trdar_cd)]
    return _latest_quarter(filtered)


def summarize_population(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"total": 0, "households": 0, "by_age": {}, "by_gender": {}}

    total = 0
    if "총_직장_인구_수" in df.columns:
        total = int(pd.to_numeric(df["총_직장_인구_수"], errors="coerce").sum())

    by_gender = {}
    if "남성_직장_인구_수" in df.columns:
        by_gender["남성"] = int(pd.to_numeric(df["남성_직장_인구_수"], errors="coerce").sum())
    if "여성_직장_인구_수" in df.columns:
        by_gender["여성"] = int(pd.to_numeric(df["여성_직장_인구_수"], errors="coerce").sum())

    age_cols = {
        "연령대_10_직장_인구_수": "10대",
        "연령대_20_직장_인구_수": "20대",
        "연령대_30_직장_인구_수": "30대",
        "연령대_40_직장_인구_수": "40대",
        "연령대_50_직장_인구_수": "50대",
        "연령대_60_이상_직장_인구_수": "60대 이상",
    }
    by_age = {}
    for col, label in age_cols.items():
        if col in df.columns:
            by_age[label] = int(pd.to_numeric(df[col], errors="coerce").sum())

    return {
        "total": total,
        "households": 0,
        "by_age": by_age,
        "by_gender": by_gender,
    }


# ── 점포 수 ──────────────────────────────────────────────────

def get_store_count(trdar_cd: str) -> pd.DataFrame:
    df = _load(STORE_FILE)
    if df.empty:
        return pd.DataFrame()
    filtered = df[df["상권_코드"].astype(str) == str(trdar_cd)]
    return _latest_quarter(filtered)


def summarize_store_count(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"by_service": [], "open_close": {}}

    by_service = []
    if "서비스_업종_코드_명" in df.columns and "점포_수" in df.columns:
        df = df.copy()
        df["점포_수"] = pd.to_numeric(df["점포_수"], errors="coerce")
        grouped = df.groupby("서비스_업종_코드_명")["점포_수"].sum().sort_values(ascending=False)
        for svc, cnt in grouped.items():
            by_service.append({"업종": svc, "점포수": int(cnt)})

    open_close = {}
    if "개업_점포_수" in df.columns:
        open_close["개업"] = int(pd.to_numeric(df["개업_점포_수"], errors="coerce").sum())
    if "폐업_점포_수" in df.columns:
        open_close["폐업"] = int(pd.to_numeric(df["폐업_점포_수"], errors="coerce").sum())

    return {"by_service": by_service, "open_close": open_close}
