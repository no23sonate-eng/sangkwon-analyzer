"""dong_lookup 테이블 시드 — web/public/data/seoul_dong_polygons.geojson에서 426개 행정동 추출 + bbox 중심 계산 → Supabase로 upsert.

실행: PYTHONPATH=. python3 services/seed_dong_lookup.py
전제: scripts/migrate_dong_level.sql 먼저 적용되어 dong_lookup 테이블 존재.
"""
import json
import os
import sys
from pathlib import Path

from supabase import create_client

ROOT = Path(__file__).resolve().parent.parent
GEOJSON_PATH = ROOT / "web" / "public" / "data" / "seoul_dong_polygons.geojson"


def compute_centroid(geometry: dict) -> tuple[float, float]:
    """폴리곤 bbox 중심 (centroid 근사)."""
    min_lng, min_lat, max_lng, max_lat = float("inf"), float("inf"), float("-inf"), float("-inf")

    def visit(coords):
        nonlocal min_lng, min_lat, max_lng, max_lat
        for lng, lat in coords:
            min_lng = min(min_lng, lng)
            max_lng = max(max_lng, lng)
            min_lat = min(min_lat, lat)
            max_lat = max(max_lat, lat)

    if geometry["type"] == "Polygon":
        for ring in geometry["coordinates"]:
            visit(ring)
    else:  # MultiPolygon
        for poly in geometry["coordinates"]:
            for ring in poly:
                visit(ring)
    return (min_lat + max_lat) / 2, (min_lng + max_lng) / 2


def _load_env() -> None:
    """프로젝트 .env 파일들을 환경변수로 로드 (data_updater.py와 동일 패턴)"""
    for env_file in ["web/.env.local", ".env"]:
        path = ROOT / env_file
        if path.exists():
            with path.open() as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k, v)


def main() -> None:
    _load_env()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 필요", file=sys.stderr)
        sys.exit(1)

    sb = create_client(url, key)

    with GEOJSON_PATH.open("r", encoding="utf-8") as f:
        gj = json.load(f)

    rows = []
    for feat in gj["features"]:
        props = feat["properties"]
        c_lat, c_lng = compute_centroid(feat["geometry"])
        rows.append({
            "dong_code": props["dong_code"],
            "dong_code_short": props.get("dong_code_short"),
            "dong_name": props["dong_name"],
            "full_name": props["full_name"],
            "gu_code": props["gu_code"],
            "gu_name": props["gu_name"],
            "centroid_lat": round(c_lat, 6),
            "centroid_lng": round(c_lng, 6),
        })

    print(f"[seed] {len(rows)}개 행정동 upsert 시작")
    # chunk로 나눠 upsert
    for i in range(0, len(rows), 200):
        chunk = rows[i:i + 200]
        sb.table("dong_lookup").upsert(chunk, on_conflict="dong_code").execute()
        print(f"[seed] {min(i + 200, len(rows))}/{len(rows)}")
    print("[seed] 완료")


if __name__ == "__main__":
    main()
