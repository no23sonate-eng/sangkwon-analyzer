"""호가 vs 실거래 보정계수 산출 → dong_calibration 업서트.

호가 출처: naver_estimated_deals.rent_per_pyeong (호가 기반 추정 실거래)
실거래 ground truth: owner_network_rents.monthly_rent_per_pyeong

계수: adjustment_pct = (median_actual - median_listing) / median_listing * 100
- 양수: 호가가 실거래보다 낮음 (드뭄)
- 음수: 호가가 실거래보다 높음 (전형적, -10~-30% 범위)

사용: PYTHONPATH=. python3 services/calibration.py
전제: import_owner_rents.py 먼저 돌려 owner_network_rents 채워야 의미 있음.
"""
import sys
from datetime import datetime
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from services.data_updater import _load_env, _get_sb  # noqa: E402

MIN_OWNER_N = 3   # 동·층별 ground truth 최소 표본
MIN_LISTING_N = 3 # 동·층별 호가 최소 표본


def _floor_normalize(f: str) -> str:
    """floor 표기 정규화: '1', '1층', 'F1' → '1층'."""
    s = str(f).strip().upper()
    if s in ("1", "1F", "F1", "1층"): return "1층"
    if s in ("2", "2F", "F2", "2층"): return "2층"
    if s in ("B1", "지하", "지하1층", "-1", "-1층"): return "지하"
    if s.endswith("층"): return s
    if s.isdigit(): return f"{s}층"
    return s or "1층"


def main() -> None:
    _load_env()
    sb = _get_sb()

    # ── owner_network_rents 동·층별 중위값 ──
    owner_rows = sb.table("owner_network_rents").select(
        "dong_code, floor, monthly_rent_per_pyeong"
    ).execute().data or []

    # (dong_code, floor) → list[rent]
    owner_groups: dict[tuple[str, str], list[float]] = {}
    for r in owner_rows:
        if not r.get("dong_code"): continue
        key = (r["dong_code"], _floor_normalize(r.get("floor", "1층")))
        owner_groups.setdefault(key, []).append(float(r["monthly_rent_per_pyeong"]))

    # ── naver_estimated_deals 동·층별 중위값 ──
    listing_rows = sb.table("naver_estimated_deals").select(
        "dong_code, floor, rent_per_pyeong"
    ).gt("rent_per_pyeong", 0).execute().data or []

    listing_groups: dict[tuple[str, str], list[float]] = {}
    for r in listing_rows:
        if not r.get("dong_code"): continue
        key = (r["dong_code"], _floor_normalize(r.get("floor", "1층")))
        listing_groups.setdefault(key, []).append(float(r["rent_per_pyeong"]))

    # ── 동·층별 보정계수 ──
    payload = []
    skipped: list[str] = []
    for key, owner_rents in owner_groups.items():
        dong_code, floor = key
        if len(owner_rents) < MIN_OWNER_N:
            skipped.append(f"{dong_code}/{floor}: ground truth {len(owner_rents)} < {MIN_OWNER_N}")
            continue
        listings = listing_groups.get(key, [])
        if len(listings) < MIN_LISTING_N:
            skipped.append(f"{dong_code}/{floor}: 호가 {len(listings)} < {MIN_LISTING_N}")
            continue

        owner_med = median(owner_rents)
        listing_med = median(listings)
        if listing_med <= 0:
            continue

        adj = (owner_med - listing_med) / listing_med * 100
        # 표본·갭 기반 신뢰도 0~1
        confidence = min(1.0, len(owner_rents) / 10) * (1 - min(abs(adj) / 100, 0.5))

        payload.append({
            "dong_code": dong_code,
            "floor": floor,
            "adjustment_pct": round(adj, 2),
            "sample_n": len(owner_rents),
            "confidence": round(confidence, 2),
            "computed_at": datetime.now().isoformat(),
            "method": "owner_network_vs_naver",
        })

    if not payload:
        print(f"[calibration] 산출 가능한 케이스 없음. owner_network_rents 표본 더 필요.")
        if skipped:
            print(f"  스킵 {len(skipped)}건 — 첫 3건: {skipped[:3]}")
        sys.exit(0)

    for i in range(0, len(payload), 100):
        chunk = payload[i:i + 100]
        sb.table("dong_calibration").upsert(
            chunk, on_conflict="dong_code,floor"
        ).execute()
    print(f"[calibration] dong_calibration: {len(payload)}건 upsert")
    print(f"[calibration] 스킵 {len(skipped)}건 (표본 부족)")
    # 한남동 1층 샘플 출력
    sample = [p for p in payload if p["dong_code"] == "1117068500" and p["floor"] == "1층"]
    if sample:
        print(f"  한남동 1층 보정: {sample[0]['adjustment_pct']}% (n={sample[0]['sample_n']})")


if __name__ == "__main__":
    main()
