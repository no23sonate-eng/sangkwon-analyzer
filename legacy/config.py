from __future__ import annotations

import os
from typing import Dict

from dotenv import load_dotenv

load_dotenv()

KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY", "")
DATA_GO_KR_API_KEY = os.getenv("DATA_GO_KR_API_KEY", "")

# 서울열린데이터 — API별 인증키
SEOUL_SALES_API_KEY = os.getenv("SEOUL_SALES_API_KEY", "")
SEOUL_FLPOP_API_KEY = os.getenv("SEOUL_FLPOP_API_KEY", "")
SEOUL_POPLTN_API_KEY = os.getenv("SEOUL_POPLTN_API_KEY", "")
SEOUL_STORE_API_KEY = os.getenv("SEOUL_STORE_API_KEY", "")


def check_api_keys() -> Dict[str, bool]:
    return {
        "카카오 (지오코딩)": bool(KAKAO_REST_API_KEY),
        "공공데이터포털 (상가정보)": bool(DATA_GO_KR_API_KEY),
        "서울 추정매출": bool(SEOUL_SALES_API_KEY),
        "서울 유동인구": bool(SEOUL_FLPOP_API_KEY),
        "서울 상주인구": bool(SEOUL_POPLTN_API_KEY),
        "서울 점포수": bool(SEOUL_STORE_API_KEY),
    }
