"""주소 → 좌표 변환 (카카오 Local API → Nominatim 폴백)"""

from __future__ import annotations

from typing import Optional

import requests
from config import KAKAO_REST_API_KEY

KAKAO_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
KAKAO_REVERSE_URL = "https://dapi.kakao.com/v2/local/geo/coord2address.json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def reverse_geocode(lat: float, lng: float) -> Optional[dict]:
    """좌표 → 주소 변환 (역지오코딩)"""
    if not KAKAO_REST_API_KEY:
        return None
    try:
        resp = requests.get(
            KAKAO_REVERSE_URL,
            headers={"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"},
            params={"x": str(lng), "y": str(lat)},
            timeout=5,
        )
        if resp.status_code == 200:
            docs = resp.json().get("documents", [])
            if docs:
                doc = docs[0]
                road = doc.get("road_address")
                addr = doc.get("address")
                if road:
                    address = road.get("address_name", "")
                    building = road.get("building_name", "")
                    if building:
                        address = f"{address} ({building})"
                elif addr:
                    address = addr.get("address_name", "")
                else:
                    address = ""
                gu = ""
                dong = ""
                if addr:
                    gu = addr.get("region_2depth_name", "")
                    dong = addr.get("region_3depth_name", "")
                return {
                    "address": address,
                    "lat": lat,
                    "lng": lng,
                    "gu": gu,
                    "dong": dong,
                }
    except Exception:
        pass
    return {"address": f"{lat:.4f}, {lng:.4f}", "lat": lat, "lng": lng, "gu": "", "dong": ""}


def _kakao_geocode(address: str) -> Optional[dict]:
    """카카오 API로 지오코딩 시도"""
    if not KAKAO_REST_API_KEY:
        return None

    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}

    # 1차: 주소 검색
    try:
        resp = requests.get(
            KAKAO_SEARCH_URL,
            headers=headers,
            params={"query": address},
            timeout=10,
        )
        if resp.status_code == 200:
            docs = resp.json().get("documents", [])
            if docs:
                doc = docs[0]
                return {
                    "address": doc.get("address_name", address),
                    "lat": float(doc["y"]),
                    "lng": float(doc["x"]),
                }
    except Exception:
        pass

    # 2차: 키워드 검색
    try:
        resp = requests.get(
            KAKAO_KEYWORD_URL,
            headers=headers,
            params={"query": address},
            timeout=10,
        )
        if resp.status_code == 200:
            docs = resp.json().get("documents", [])
            if docs:
                doc = docs[0]
                return {
                    "address": doc.get("address_name", address),
                    "lat": float(doc["y"]),
                    "lng": float(doc["x"]),
                }
    except Exception:
        pass

    return None


def _nominatim_geocode(address: str) -> Optional[dict]:
    """Nominatim(OpenStreetMap) 무료 지오코딩"""
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={
                "q": address,
                "format": "json",
                "limit": 1,
                "countrycodes": "kr",
                "accept-language": "ko",
            },
            headers={"User-Agent": "sangkwon-analyzer/1.0"},
            timeout=10,
        )
        if resp.status_code == 200:
            results = resp.json()
            if results:
                r = results[0]
                return {
                    "address": r.get("display_name", address),
                    "lat": float(r["lat"]),
                    "lng": float(r["lon"]),
                }
    except Exception:
        pass
    return None


def geocode(address: str) -> Optional[dict]:
    """주소를 위도/경도로 변환한다.

    카카오 API를 먼저 시도하고, 실패 시 Nominatim(무료)으로 폴백.

    Returns:
        {"address": str, "lat": float, "lng": float} or None
    """
    result = _kakao_geocode(address)
    if result:
        return result

    return _nominatim_geocode(address)
