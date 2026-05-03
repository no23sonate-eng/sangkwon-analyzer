"""매장 단위 카테고리 크롤러 — 카카오 Local API 기반.

trdar(서울시) 분류로 안 잡히는 명품·플래그십·갤러리·파인다이닝·편집숍·라이프스타일을
좌표 단위로 자동 수집. 모든 상권에 동일 동작 (좌표만 있으면 됨).

수집 방식:
1. 카카오 keyword 검색 — data/brand-whitelist.json 의 6개 카테고리 화이트리스트 브랜드명을
   좌표 반경 N미터 안에서 검색.
2. 카카오 category 검색 — FD6(음식점) / CE7(카페) / CT1(문화시설) 등 보조 수집.

결과 → Supabase `places` 테이블 (brand, category, lat, lng, road_name, ...).
지원: 단일 좌표 / 동 단위 좌표 리스트 / 모든 행정동 일괄.

Usage:
    KAKAO_REST_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
        python services/place_crawler.py --dong 한남동 --gu 용산구 --radius 600
    # 일괄:
    python services/place_crawler.py --bootstrap-prime  # 한남·청담·신사·성수 1차 수집
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Iterable, Optional

import requests

KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
KAKAO_CATEGORY_URL = "https://dapi.kakao.com/v2/local/search/category.json"
RATE_LIMIT_SLEEP = 0.06  # 카카오 무료 한도 1만/일·1만/시간 — 안전마진

ROOT = Path(__file__).resolve().parent.parent
WHITELIST_PATH = ROOT / "data" / "brand-whitelist.json"


# ── 환경 ─────────────────────────────────────────────────────
def _env(key: str) -> str:
    v = os.getenv(key, "").strip()
    if not v:
        raise RuntimeError(f"{key} 환경변수 필요")
    return v


def _kakao_headers() -> dict:
    return {"Authorization": f"KakaoAK {_env('KAKAO_REST_API_KEY')}"}


# ── Supabase 지연 import (테이블 없을 때도 dry-run 가능) ──
def _get_supabase():
    from supabase import create_client  # type: ignore
    return create_client(_env("NEXT_PUBLIC_SUPABASE_URL"), _env("SUPABASE_SERVICE_ROLE_KEY"))


# ── 카카오 호출 헬퍼 ─────────────────────────────────────────
def _kakao_keyword(query: str, lng: float, lat: float, radius_m: int) -> list[dict]:
    """좌표 반경 안 keyword 검색. 페이지네이션 합산 (최대 45건)."""
    out: list[dict] = []
    for page in range(1, 4):  # max_page 3 (15 × 3 = 45)
        try:
            resp = requests.get(
                KAKAO_KEYWORD_URL,
                headers=_kakao_headers(),
                params={
                    "query": query,
                    "x": str(lng),
                    "y": str(lat),
                    "radius": str(radius_m),
                    "size": "15",
                    "page": str(page),
                    "sort": "distance",
                },
                timeout=8,
            )
            time.sleep(RATE_LIMIT_SLEEP)
            if resp.status_code != 200:
                break
            data = resp.json()
            docs = data.get("documents", [])
            out.extend(docs)
            if data.get("meta", {}).get("is_end", True):
                break
        except Exception as e:
            print(f"  ! kakao keyword '{query}' 실패: {e}", file=sys.stderr)
            break
    return out


def _kakao_category(category_group_code: str, lng: float, lat: float, radius_m: int) -> list[dict]:
    out: list[dict] = []
    for page in range(1, 4):
        try:
            resp = requests.get(
                KAKAO_CATEGORY_URL,
                headers=_kakao_headers(),
                params={
                    "category_group_code": category_group_code,
                    "x": str(lng),
                    "y": str(lat),
                    "radius": str(radius_m),
                    "size": "15",
                    "page": str(page),
                    "sort": "distance",
                },
                timeout=8,
            )
            time.sleep(RATE_LIMIT_SLEEP)
            if resp.status_code != 200:
                break
            data = resp.json()
            out.extend(data.get("documents", []))
            if data.get("meta", {}).get("is_end", True):
                break
        except Exception as e:
            print(f"  ! kakao category '{category_group_code}' 실패: {e}", file=sys.stderr)
            break
    return out


# ── 매장 정규화 ─────────────────────────────────────────────
def _normalize(doc: dict, category: str, source_query: str) -> Optional[dict]:
    try:
        lat = float(doc.get("y", 0))
        lng = float(doc.get("x", 0))
    except (TypeError, ValueError):
        return None
    if lat == 0 or lng == 0:
        return None
    return {
        "kakao_place_id": str(doc.get("id", "")),
        "brand_name": (doc.get("place_name") or "").strip(),
        "category": category,                          # luxury / flagship / ...
        "kakao_category_name": (doc.get("category_name") or "").strip(),
        "phone": (doc.get("phone") or "").strip(),
        "address": (doc.get("address_name") or "").strip(),
        "road_address": (doc.get("road_address_name") or "").strip(),
        "lat": lat,
        "lng": lng,
        "source_query": source_query,
        "place_url": (doc.get("place_url") or "").strip(),
    }


def _extract_road_name(road_address: str) -> str:
    """'서울 용산구 이태원로 240' → '이태원로'."""
    if not road_address:
        return ""
    parts = road_address.split()
    for p in parts:
        if p.endswith("로") or p.endswith("길") or p.endswith("대로"):
            return p
    return ""


# ── 한 좌표·반경 수집 파이프라인 ─────────────────────────
def crawl_point(
    name: str,
    gu: str,
    dong: str,
    lat: float,
    lng: float,
    radius_m: int,
    whitelist: dict,
    only_categories: Optional[Iterable[str]] = None,
) -> list[dict]:
    """단일 좌표 반경 수집. dedup 후 정규화된 매장 리스트 반환."""
    print(f"\n=== {name} ({gu} {dong}) lat={lat} lng={lng} R={radius_m}m ===")
    seen_ids: set[str] = set()
    rows: list[dict] = []

    targets = only_categories or [
        "luxury", "flagship", "gallery", "fine_dining", "select_shop", "lifestyle",
    ]

    # 1) 화이트리스트 brand 단위 keyword 검색
    for cat in targets:
        block = whitelist.get(cat, {})
        brands = block.get("brands", [])
        for brand in brands:
            docs = _kakao_keyword(brand, lng, lat, radius_m)
            for d in docs:
                row = _normalize(d, category=cat, source_query=brand)
                if not row or not row["kakao_place_id"]:
                    continue
                if row["kakao_place_id"] in seen_ids:
                    continue
                # 매장명에 query 가 부분 포함되어야 false-positive 방지
                if brand.replace(" ", "").lower() not in row["brand_name"].replace(" ", "").lower():
                    # kakao 가 검색어 외 결과를 줄 수 있어 1차 필터
                    continue
                seen_ids.add(row["kakao_place_id"])
                row["gu"] = gu
                row["dong"] = dong
                row["road_name"] = _extract_road_name(row["road_address"])
                row["radius_m"] = radius_m
                rows.append(row)
        print(f"  · {cat}: 누적 {len([r for r in rows if r['category'] == cat])}건")

    # 2) 카테고리 보조 — 갤러리(CT1) / 파인다이닝(FD6, 후속 매장명 필터)
    if not only_categories or "gallery" in targets:
        for d in _kakao_category("CT1", lng, lat, radius_m):
            row = _normalize(d, category="gallery", source_query="kakao:CT1")
            if not row or row["kakao_place_id"] in seen_ids:
                continue
            # CT1 안에서 갤러리·미술관·전시 키워드만
            ck = (row["kakao_category_name"] + " " + row["brand_name"]).lower()
            if not any(w in ck for w in ["갤러리", "미술관", "전시", "gallery", "art"]):
                continue
            seen_ids.add(row["kakao_place_id"])
            row["gu"] = gu
            row["dong"] = dong
            row["road_name"] = _extract_road_name(row["road_address"])
            row["radius_m"] = radius_m
            rows.append(row)

    print(f"  → 총 {len(rows)}건 수집 (dedup 후)")
    return rows


# ── Supabase upsert ─────────────────────────────────────────
def upsert_places(rows: list[dict], dry_run: bool = False) -> None:
    if not rows:
        print("[upsert] 빈 리스트 — skip")
        return
    if dry_run:
        print(f"[upsert dry-run] {len(rows)}건")
        for r in rows[:5]:
            print(f"  · {r['category']:14s} | {r['brand_name']:30s} | {r['road_name']:10s} | {r['address']}")
        if len(rows) > 5:
            print(f"  · ... +{len(rows) - 5}건")
        return
    sb = _get_supabase()
    table = sb.table("places")
    # collected_at 부여
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    payload = []
    for r in rows:
        payload.append({**r, "collected_at": now})
    # batch upsert (kakao_place_id 기준)
    BATCH = 100
    for i in range(0, len(payload), BATCH):
        chunk = payload[i:i + BATCH]
        try:
            table.upsert(chunk, on_conflict="kakao_place_id").execute()
        except Exception as e:
            print(f"  ! upsert 실패 batch={i}: {e}", file=sys.stderr)
    print(f"[upsert] ✓ {len(payload)}건 upsert 완료")


# ── 부트스트랩: 프라임 권역 1차 수집 ─────────────────────
PRIME_POINTS = [
    # (name, gu, dong, lat, lng, radius_m)
    ("한남동 - 한남대로 메인", "용산구", "한남동", 37.5346, 127.0040, 600),
    ("한남동 - 이태원역", "용산구", "한남동", 37.5345, 126.9947, 500),
    ("청담동 - 명품거리", "강남구", "청담동", 37.5274, 127.0410, 600),
    ("신사동 - 가로수길", "강남구", "신사동", 37.5208, 127.0228, 600),
    ("성수동1가 - 연무장길", "성동구", "성수동1가", 37.5446, 127.0566, 500),
    ("성수동2가 - 수제화거리", "성동구", "성수동2가", 37.5419, 127.0577, 500),
    ("이태원동 - 경리단길", "용산구", "이태원동", 37.5400, 126.9876, 500),
    ("압구정동 - 갤러리아", "강남구", "압구정동", 37.5275, 127.0350, 500),
]


def bootstrap_prime(whitelist: dict, dry_run: bool = False) -> None:
    all_rows: list[dict] = []
    for name, gu, dong, lat, lng, r in PRIME_POINTS:
        rows = crawl_point(name, gu, dong, lat, lng, r, whitelist)
        all_rows.extend(rows)
    print(f"\n━━━ 부트스트랩 결과 ━━━")
    print(f"총 {len(all_rows)}건")
    by_cat: dict[str, int] = {}
    for r in all_rows:
        by_cat[r["category"]] = by_cat.get(r["category"], 0) + 1
    for cat, n in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {cat:14s}: {n}건")
    upsert_places(all_rows, dry_run=dry_run)


# ── CLI ─────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(description="매장 단위 카테고리 자동 수집 (카카오 Local API)")
    parser.add_argument("--dong", help="동 이름 (단일 좌표 모드)")
    parser.add_argument("--gu", help="구 이름")
    parser.add_argument("--lat", type=float, help="좌표 lat")
    parser.add_argument("--lng", type=float, help="좌표 lng")
    parser.add_argument("--radius", type=int, default=600, help="반경 m (기본 600)")
    parser.add_argument("--bootstrap-prime", action="store_true", help="프라임 권역 8곳 1차 수집")
    parser.add_argument("--dry-run", action="store_true", help="DB upsert 건너뜀")
    parser.add_argument("--only", help="카테고리 한정 (luxury,flagship,gallery,fine_dining,select_shop,lifestyle)")
    args = parser.parse_args()

    if not WHITELIST_PATH.exists():
        print(f"[err] whitelist 없음: {WHITELIST_PATH}", file=sys.stderr)
        return 1
    whitelist = json.loads(WHITELIST_PATH.read_text(encoding="utf-8"))

    only = [s.strip() for s in args.only.split(",")] if args.only else None

    if args.bootstrap_prime:
        bootstrap_prime(whitelist, dry_run=args.dry_run)
        return 0

    if args.lat is None or args.lng is None or not args.gu or not args.dong:
        parser.error("좌표 모드는 --gu/--dong/--lat/--lng 필수. 또는 --bootstrap-prime")
    rows = crawl_point(
        f"{args.gu} {args.dong}", args.gu, args.dong, args.lat, args.lng, args.radius,
        whitelist, only_categories=only,
    )
    upsert_places(rows, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
