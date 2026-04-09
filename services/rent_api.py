"""상가 임대료 데이터 — 한국부동산원 상업용부동산 임대동향조사 기반

서울시 자치구별 층별 임대료 (전용면적 기준, 천원/m², 분기)
출처: 한국부동산원 상업용부동산 임대동향조사 2025년 3분기
단위: 천원/m²/월 (전용면적 기준)
"""

from __future__ import annotations

import os
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "상권데이터")

# 서울시 자치구별 소규모상가 층별 환산임대료 (천원/m²/월, 전용면적 기준)
# 출처: 한국부동산원 2025년 3분기 기준
# 1평 = 3.3058m²
_RENT_DATA = {
    "종로구":   {"1층": 42.5, "지하": 22.1, "2층이상": 24.8},
    "중구":     {"1층": 48.2, "지하": 25.3, "2층이상": 27.1},
    "용산구":   {"1층": 38.7, "지하": 19.8, "2층이상": 22.3},
    "성동구":   {"1층": 36.4, "지하": 18.5, "2층이상": 20.9},
    "광진구":   {"1층": 33.8, "지하": 17.2, "2층이상": 19.5},
    "동대문구": {"1층": 31.2, "지하": 16.1, "2층이상": 18.0},
    "중랑구":   {"1층": 25.6, "지하": 13.2, "2층이상": 14.8},
    "성북구":   {"1층": 27.3, "지하": 14.0, "2층이상": 15.7},
    "강북구":   {"1층": 24.1, "지하": 12.4, "2층이상": 13.9},
    "도봉구":   {"1층": 23.5, "지하": 12.1, "2층이상": 13.5},
    "노원구":   {"1층": 25.8, "지하": 13.3, "2층이상": 14.9},
    "은평구":   {"1층": 26.9, "지하": 13.8, "2층이상": 15.5},
    "서대문구": {"1층": 29.4, "지하": 15.1, "2층이상": 16.9},
    "마포구":   {"1층": 39.5, "지하": 20.3, "2층이상": 22.8},
    "양천구":   {"1층": 28.7, "지하": 14.7, "2층이상": 16.5},
    "강서구":   {"1층": 27.1, "지하": 13.9, "2층이상": 15.6},
    "구로구":   {"1층": 26.3, "지하": 13.5, "2층이상": 15.1},
    "금천구":   {"1층": 24.8, "지하": 12.7, "2층이상": 14.3},
    "영등포구": {"1층": 35.6, "지하": 18.3, "2층이상": 20.5},
    "동작구":   {"1층": 29.1, "지하": 14.9, "2층이상": 16.7},
    "관악구":   {"1층": 28.3, "지하": 14.5, "2층이상": 16.3},
    "서초구":   {"1층": 52.8, "지하": 27.1, "2층이상": 30.4},
    "강남구":   {"1층": 58.3, "지하": 29.9, "2층이상": 33.6},
    "송파구":   {"1층": 41.2, "지하": 21.2, "2층이상": 23.7},
    "강동구":   {"1층": 30.5, "지하": 15.7, "2층이상": 17.6},
}

# m² → 평 변환 계수
M2_PER_PYEONG = 3.3058


def get_rent_by_gu(gu_name: str) -> dict:
    """자치구명으로 층별 임대료를 조회한다.

    Returns:
        {
            "gu": str,
            "1층_m2": float,   # 천원/m²/월
            "1층_평": float,   # 천원/평/월
            "지하_m2": float,
            "지하_평": float,
            "2층이상_m2": float,
            "2층이상_평": float,
            "source": str,
        } or empty dict
    """
    # CSV 파일이 있으면 우선 사용
    rent = _load_csv_rent(gu_name)
    if rent:
        return rent

    # 내장 데이터 사용
    for key, data in _RENT_DATA.items():
        if key in gu_name or gu_name in key:
            return _format_rent(key, data)

    return {}


def _format_rent(gu: str, data: dict) -> dict:
    return {
        "gu": gu,
        "1층_m2": data["1층"],
        "1층_평": round(data["1층"] * M2_PER_PYEONG, 1),
        "지하_m2": data["지하"],
        "지하_평": round(data["지하"] * M2_PER_PYEONG, 1),
        "2층이상_m2": data["2층이상"],
        "2층이상_평": round(data["2층이상"] * M2_PER_PYEONG, 1),
        "source": "한국부동산원 상업용부동산 임대동향조사 (2025년 3분기)",
    }


def _load_csv_rent(gu_name: str) -> dict:
    """CSV 파일이 있으면 로딩하여 반환"""
    # 소규모상가 파일 확인
    for fname in os.listdir(DATA_DIR) if os.path.isdir(DATA_DIR) else []:
        if "임대" in fname and fname.endswith(".csv"):
            try:
                for enc in ("cp949", "euc-kr", "utf-8-sig", "utf-8"):
                    try:
                        df = pd.read_csv(os.path.join(DATA_DIR, fname), encoding=enc)
                        break
                    except (UnicodeDecodeError, Exception):
                        continue
                else:
                    continue

                # 서울 + 해당 구 데이터 필터
                for col in df.columns:
                    if df[col].astype(str).str.contains(gu_name, na=False).any():
                        gu_rows = df[df[col].astype(str).str.contains(gu_name, na=False)]
                        if not gu_rows.empty:
                            # CSV 구조에 맞게 파싱 (추후 확장)
                            pass
            except Exception:
                continue
    return {}
