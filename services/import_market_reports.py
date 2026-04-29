"""data/reports/market-reports.csv → Supabase market_reports 업서트.

실행: PYTHONPATH=. python3 services/import_market_reports.py
전제: scripts/migrate_dong_level.sql 적용 (market_reports 테이블 생성).
입력: data/reports/market-reports.csv (# 주석 줄 무시).
"""
import csv
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "reports" / "market-reports.csv"

# data_updater 패턴 재사용 (env 자동 로드 + supabase 클라이언트)
sys.path.insert(0, str(ROOT))
from services.data_updater import _load_env, _get_sb  # noqa: E402


def parse_csv(path: Path) -> list[dict]:
    rows = []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = None
        for line in reader:
            if not line:
                continue
            first = line[0].strip()
            if first.startswith("#") or not first:
                continue
            if header is None:
                header = [h.strip() for h in line]
                continue
            row = dict(zip(header, [c.strip() for c in line]))
            rows.append(row)
    return rows


def to_db_row(r: dict) -> dict | None:
    src = r.get("source", "").upper()
    quarter = r.get("report_quarter", "")
    region = r.get("region_name", "")
    if not src or not quarter or not region:
        return None

    def num(key: str):
        v = r.get(key, "").strip()
        if not v:
            return None
        try:
            return float(v)
        except ValueError:
            return None

    return {
        "source": src,
        "report_quarter": quarter,
        "region_name": region,
        "gu_name": r.get("gu_name") or None,
        "rent_per_pyeong": num("rent_per_pyeong"),
        "rent_grade": r.get("rent_grade") or None,
        "vacancy_rate": num("vacancy_rate"),
        "cap_rate": num("cap_rate"),
        "parsed_at": datetime.now().isoformat(),
        "raw_data": {"notes": r.get("notes", "")},
    }


def main() -> None:
    _load_env()
    if not CSV_PATH.exists():
        print(f"[import] CSV 없음: {CSV_PATH}")
        sys.exit(0)

    rows = parse_csv(CSV_PATH)
    payload = [to_db_row(r) for r in rows]
    payload = [p for p in payload if p]

    if not payload:
        print("[import] 입력된 데이터 없음. 헤더 외 데이터 행을 추가해주세요.")
        sys.exit(0)

    sb = _get_sb()
    for i in range(0, len(payload), 100):
        chunk = payload[i:i + 100]
        sb.table("market_reports").upsert(
            chunk, on_conflict="source,report_quarter,region_name"
        ).execute()
    print(f"[import] market_reports: {len(payload)}건 upsert")


if __name__ == "__main__":
    main()
