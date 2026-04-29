"""data/owner-network-rents.csv → Supabase owner_network_rents 업서트.

실행: PYTHONPATH=. python3 services/import_owner_rents.py
전제: scripts/migrate_dong_level.sql 적용 (owner_network_rents + dong_lookup 존재).

CSV에서 dong_name + gu_name으로 dong_code를 자동 매핑한다.
"""
import csv
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "owner-network-rents.csv"

sys.path.insert(0, str(ROOT))
from services.data_updater import _load_env, _get_sb, _load_dong_code_map, _resolve_dong_code  # noqa: E402


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


def main() -> None:
    _load_env()
    if not CSV_PATH.exists():
        print(f"[import] CSV 없음: {CSV_PATH}")
        sys.exit(0)

    sb = _get_sb()
    code_map = _load_dong_code_map(sb)

    rows = parse_csv(CSV_PATH)
    payload = []
    skipped_no_code = []

    for r in rows:
        dong_name = r.get("dong_name", "").strip()
        gu_name = r.get("gu_name", "").strip()
        rent_str = r.get("monthly_rent_per_pyeong", "").strip()
        if not dong_name or not gu_name or not rent_str:
            continue
        try:
            rent = float(rent_str)
        except ValueError:
            continue

        dong_code = _resolve_dong_code(code_map, gu_name, dong_name)
        if not dong_code:
            skipped_no_code.append(f"{gu_name} {dong_name}")
            continue

        def num(key: str):
            v = r.get(key, "").strip()
            try:
                return float(v) if v else None
            except ValueError:
                return None

        payload.append({
            "recorded_at": r.get("recorded_at") or datetime.now().date().isoformat(),
            "dong_code": dong_code,
            "dong_name": dong_name,
            "gu_name": gu_name,
            "floor": r.get("floor", "1층"),
            "area_pyeong": num("area_pyeong"),
            "monthly_rent_per_pyeong": rent,
            "deposit_per_pyeong": num("deposit_per_pyeong"),
            "building_grade": r.get("building_grade") or None,
            "source_note": r.get("source_note") or None,
            "contributed_by": r.get("contributed_by") or None,
            "notes": r.get("notes") or None,
        })

    if not payload:
        print("[import] 입력된 유효 데이터 없음. CSV에 행을 추가해주세요.")
        if skipped_no_code:
            print(f"  매핑 실패한 동: {skipped_no_code[:5]}...")
        sys.exit(0)

    # owner_network_rents는 PRIMARY KEY가 SERIAL이라 conflict가 없음 — INSERT만
    for i in range(0, len(payload), 100):
        chunk = payload[i:i + 100]
        sb.table("owner_network_rents").insert(chunk).execute()
    print(f"[import] owner_network_rents: {len(payload)}건 추가")
    if skipped_no_code:
        print(f"[import] dong_code 매핑 실패 {len(skipped_no_code)}건: {skipped_no_code[:3]}...")


if __name__ == "__main__":
    main()
