"""소상공인시장진흥공단 상가(상권)정보 API"""

import requests
import pandas as pd
from config import DATA_GO_KR_API_KEY

BASE_URL = "https://apis.data.go.kr/B553077/api/open/sdsc2"

# 대분류 코드 → 한글 매핑
CATEGORY_MAP = {
    "Q": "음식",
    "I": "숙박",
    "D": "소매",
    "R": "생활서비스",
    "P": "학문/교육",
    "N": "시설관리/임대",
    "L": "부동산",
    "O": "수리/개인",
    "S": "스포츠",
    "F": "음료/식품",
    "G": "소매/유통",
}


_api_available = None  # type: bool | None


def _quick_check() -> bool:
    """API 서버가 실제 HTTP 응답 가능한지 확인. 결과를 캐시."""
    global _api_available
    if _api_available is not None:
        return _api_available
    try:
        resp = requests.get(
            BASE_URL,
            timeout=(1, 2),
            params={"serviceKey": DATA_GO_KR_API_KEY, "numOfRows": "1", "type": "json"},
        )
        _api_available = resp.status_code == 200
    except Exception:
        _api_available = False
    return _api_available


def get_stores_in_radius(lat: float, lng: float, radius: int = 300) -> pd.DataFrame:
    """좌표 기준 반경 내 상가 점포 목록을 조회한다."""
    if not DATA_GO_KR_API_KEY:
        return pd.DataFrame()

    # 서버 응답 체크 — 안 되면 바로 빈 결과 반환
    if not _quick_check():
        return pd.DataFrame()

    all_rows = []
    page = 1

    while True:
        params = {
            "serviceKey": DATA_GO_KR_API_KEY,
            "pageNo": str(page),
            "numOfRows": "100",
            "radius": str(radius),
            "cx": str(lng),
            "cy": str(lat),
            "type": "json",
        }
        try:
            resp = requests.get(
                f"{BASE_URL}/storeListInRadius",
                params=params,
                timeout=(2, 3),  # connect 2s, read 3s
            )
        except Exception:
            break
        if resp.status_code != 200:
            break

        try:
            data = resp.json()
        except ValueError:
            break
        items = data.get("body", {}).get("items", [])
        if not items:
            break

        all_rows.extend(items)
        total = int(data.get("body", {}).get("totalCount", 0))
        if page * 100 >= total:
            break
        page += 1

    if not all_rows:
        return pd.DataFrame()

    df = pd.DataFrame(all_rows)

    # 컬럼 정리
    col_map = {
        "bizesId": "사업자ID",
        "bizesNm": "상호명",
        "brchNm": "지점명",
        "indsLclsCd": "대분류코드",
        "indsLclsNm": "대분류명",
        "indsMclsCd": "중분류코드",
        "indsMclsNm": "중분류명",
        "indsSclsCd": "소분류코드",
        "indsSclsNm": "소분류명",
        "ksicCd": "표준산업분류코드",
        "ksicNm": "표준산업분류명",
        "ctprvnCd": "시도코드",
        "ctprvnNm": "시도명",
        "signguCd": "시군구코드",
        "signguNm": "시군구명",
        "adongCd": "행정동코드",
        "adongNm": "행정동명",
        "ldongCd": "법정동코드",
        "ldongNm": "법정동명",
        "lnoCd": "지번코드",
        "plotSctCd": "대지구분코드",
        "plotSctNm": "대지구분명",
        "lnoMnno": "지번본번",
        "lnoSlno": "지번부번",
        "lnoAdr": "지번주소",
        "rdnmCd": "도로명코드",
        "rdnm": "도로명",
        "bldMnno": "건물본번",
        "bldSlno": "건물부번",
        "bldMngNo": "건물관리번호",
        "bldNm": "건물명",
        "rdnmAdr": "도로명주소",
        "oldZipcd": "구우편번호",
        "newZipcd": "신우편번호",
        "dongNo": "동정보",
        "flrNo": "층정보",
        "hoNo": "호정보",
        "lon": "경도",
        "lat": "위도",
    }
    rename = {k: v for k, v in col_map.items() if k in df.columns}
    df = df.rename(columns=rename)

    return df


def summarize_stores(df: pd.DataFrame) -> dict:
    """점포 데이터프레임을 카테고리별로 집계한다."""
    if df.empty:
        return {"total": 0, "by_category": {}, "by_subcategory": {}}

    cat_col = "대분류명" if "대분류명" in df.columns else None
    sub_col = "중분류명" if "중분류명" in df.columns else None

    by_category = {}
    if cat_col:
        counts = df[cat_col].value_counts()
        by_category = {
            name: {"count": int(cnt), "ratio": round(cnt / len(df) * 100, 1)}
            for name, cnt in counts.items()
        }

    by_subcategory = {}
    if sub_col:
        counts = df[sub_col].value_counts().head(20)
        by_subcategory = {
            name: {"count": int(cnt), "ratio": round(cnt / len(df) * 100, 1)}
            for name, cnt in counts.items()
        }

    return {
        "total": len(df),
        "by_category": by_category,
        "by_subcategory": by_subcategory,
    }
