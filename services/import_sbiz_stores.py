"""소상공인진흥공단 상가(상권)정보 → Supabase stores_geo 업서트.

데이터 출처: https://www.data.go.kr/data/15083033/fileData.do
   - 분기 단위 갱신, 무료
   - 시도별 CSV 분리 (서울특별시 약 50만 rows / 80MB)
   - 컬럼: 상가업소번호, 상호명, 상권업종대중소분류, 표준산업분류,
           시도/시군구/행정동/법정동, 도로명주소, 위도, 경도, 층정보 등

수동 절차:
  1. data.go.kr 위 URL에서 "서울특별시" CSV 다운로드
  2. data/sbiz-stores/seoul_{YYYYQ}.csv 로 저장 (gitignore)
  3. PYTHONPATH=. python3 services/import_sbiz_stores.py --quarter 20262 --file data/sbiz-stores/seoul_20262.csv

자동 매칭:
  - dong_name + gu_name → dong_lookup 통해 dong_code 매핑
  - 좌표 누락/이상치 row 스킵
"""
import argparse
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from services.data_updater import _load_env, _get_sb, _load_dong_code_map, _resolve_dong_code  # noqa: E402

# 소상공인 CSV 표준 컬럼명 (데이터셋에 따라 변동 가능 — 실제 헤더 보고 보정 필요)
COL_MAP = {
    "store_id": "상가업소번호",
    "store_name": "상호명",
    "branch_name": "지점명",
    "category_l": "상권업종대분류명",
    "category_m": "상권업종중분류명",
    "category_s": "상권업종소분류명",
    "std_industry_cd": "표준산업분류코드",
    "std_industry_nm": "표준산업분류명",
    "sido": "시도명",
    "sigungu": "시군구명",
    "adm_dong": "행정동명",
    "legal_dong": "법정동명",
    "road_name": "도로명",
    "road_address": "도로명주소",
    "jibun_address": "지번주소",
    "building_name": "건물명",
    "floor_info": "층정보",
    "lat": "위도",
    "lng": "경도",
}


def parse_csv(path: Path):
    with path.open("r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield row


def transform(row: dict, code_map: dict, quarter_cd: str) -> dict | None:
    def g(k: str) -> str:
        return (row.get(COL_MAP[k], "") or "").strip()

    try:
        lat = float(g("lat"))
        lng = float(g("lng"))
    except ValueError:
        return None
    if not (33 < lat < 39 and 124 < lng < 132):
        return None  # 한국 경계 밖 좌표

    sido = g("sido")
    if "서울" not in sido:
        return None

    gu_name = g("sigungu")
    dong_name = g("legal_dong") or g("adm_dong")
    dong_code = _resolve_dong_code(code_map, gu_name, dong_name) if dong_name else None

    return {
        "store_id": g("store_id"),
        "store_name": g("store_name"),
        "branch_name": g("branch_name") or None,
        "category_l": g("category_l") or None,
        "category_m": g("category_m") or None,
        "category_s": g("category_s") or None,
        "std_industry_cd": g("std_industry_cd") or None,
        "std_industry_nm": g("std_industry_nm") or None,
        "sido": sido,
        "sigungu": gu_name,
        "adm_dong": g("adm_dong") or None,
        "legal_dong": g("legal_dong") or None,
        "road_name": g("road_name") or None,
        "road_address": g("road_address") or None,
        "jibun_address": g("jibun_address") or None,
        "building_name": g("building_name") or None,
        "floor_info": g("floor_info") or None,
        "lat": lat,
        "lng": lng,
        "gu_name": gu_name,
        "dong_name": dong_name,
        "dong_code": dong_code,
        "quarter_cd": quarter_cd,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True, help="소상공인 상가 CSV 경로")
    ap.add_argument("--quarter", required=True, help="분기 코드 (예: 20262)")
    ap.add_argument("--batch", type=int, default=500)
    args = ap.parse_args()

    csv_path = Path(args.file)
    if not csv_path.exists():
        print(f"[import] CSV 없음: {csv_path}")
        sys.exit(1)

    _load_env()
    sb = _get_sb()
    code_map = _load_dong_code_map(sb)

    batch: list[dict] = []
    total = 0
    skipped = 0
    no_dong = 0

    for raw in parse_csv(csv_path):
        rec = transform(raw, code_map, args.quarter)
        if rec is None:
            skipped += 1
            continue
        if not rec["store_id"]:
            skipped += 1
            continue
        if rec["dong_code"] is None:
            no_dong += 1
        batch.append(rec)

        if len(batch) >= args.batch:
            sb.table("stores_geo").upsert(batch, on_conflict="store_id").execute()
            total += len(batch)
            print(f"[import] {total} rows 업서트 (skip {skipped}, dong미매핑 {no_dong})")
            batch = []

    if batch:
        sb.table("stores_geo").upsert(batch, on_conflict="store_id").execute()
        total += len(batch)

    print(f"[import] 완료: {total} rows / 스킵 {skipped} / dong 미매핑 {no_dong}")


if __name__ == "__main__":
    main()
