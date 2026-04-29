"""데이터 자동 업데이트 — Supabase 테이블 갱신

하드코딩 데이터를 DB로 이관한 뒤, 주기적으로 공공 API에서 최신 데이터를 가져와 갱신한다.

스케줄:
- 매일 04:30 — 네이버 크롤링 결과 Supabase 동기화
- 매주 월요일 05:00 — 서울 열린데이터 임대/매매 통계 갱신
- 매일 05:00 — 대시보드 KPI 재계산
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timedelta
from supabase import create_client, Client

# ── Supabase 클라이언트 ──
def _get_sb() -> Client:
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 필요")
    return create_client(url, key)


# ═══════════════════════════════════════════════════════════
# 1. 네이버 크롤링 → Supabase 동기화
# ═══════════════════════════════════════════════════════════

NAVER_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "상권데이터", "rent_market.db")

# 법정동 → 구 매핑
DONG_TO_GU = {
    "역삼동": "강남구", "논현동": "강남구", "서초동": "서초구", "반포동": "서초구",
    "서교동": "마포구", "연남동": "마포구", "망원동": "마포구",
    "이태원동": "용산구", "한남동": "용산구",
    "성수동1가": "성동구", "성수동2가": "성동구",
    "명동": "중구", "을지로": "중구",
    "여의도동": "영등포구", "잠실동": "송파구",
}


def _load_dong_code_map(sb) -> dict:
    """dong_lookup → {(gu, dong_name): dong_code} 캐시. prefix 매칭용 동명 리스트도 함께."""
    rows = sb.table("dong_lookup").select("dong_code, dong_name, gu_name").execute().data or []
    exact_map = {}
    by_gu: dict[str, list[tuple[str, str]]] = {}
    for r in rows:
        exact_map[(r["gu_name"], r["dong_name"])] = r["dong_code"]
        by_gu.setdefault(r["gu_name"], []).append((r["dong_name"], r["dong_code"]))
    return {"exact": exact_map, "by_gu": by_gu}


def _normalize_dong(name: str) -> str:
    """동명 정규화 — 법정동·행정동 매칭용.
    '논현1동' → '논현', '한남동' → '한남', '성수동1가' → '성수1가', '성수1가1동' → '성수1가1'.
    """
    import re
    n = name.strip()
    # 끝의 "<숫자?>동" 제거 (논현1동, 한남동)
    n = re.sub(r"\d*동$", "", n)
    # 중간 "동" 제거 (성수동1가 → 성수1가)
    n = n.replace("동", "")
    return n


def _resolve_dong_code(code_map: dict, gu: str, dong_name: str) -> str | None:
    """동명 → dong_code. 직접 매칭 → 정규화 prefix 매칭 순."""
    if not gu or not dong_name:
        return None
    code = code_map["exact"].get((gu, dong_name))
    if code:
        return code
    target = _normalize_dong(dong_name)
    if not target:
        return None
    # 정규화 후 prefix 매칭
    candidates = []
    for adm_name, adm_code in code_map["by_gu"].get(gu, []):
        adm_norm = _normalize_dong(adm_name)
        if adm_norm == target or adm_norm.startswith(target) or target.startswith(adm_norm):
            candidates.append((adm_name, adm_code, abs(len(adm_norm) - len(target))))
    if not candidates:
        return None
    # 가장 가까운 길이의 매칭 (정확도 우선)
    candidates.sort(key=lambda x: x[2])
    return candidates[0][1]


def sync_naver_to_supabase():
    """SQLite의 네이버 크롤링 데이터를 Supabase로 동기화"""
    if not os.path.exists(NAVER_DB_PATH):
        print("[updater] 네이버 DB 없음, 스킵")
        return

    sb = _get_sb()
    conn = sqlite3.connect(NAVER_DB_PATH)
    conn.row_factory = sqlite3.Row

    # dong_lookup 캐시 — naver listings에 dong_code 부여용
    code_map = _load_dong_code_map(sb)

    # 최근 7일간 snapshots 동기화
    cutoff = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    # snapshots → naver_listings
    rows = conn.execute(
        "SELECT * FROM snapshots WHERE crawl_date >= ?", (cutoff,)
    ).fetchall()

    if rows:
        batch = []
        for r in rows:
            dong = r["dong"] if "dong" in r.keys() else ""
            gu = DONG_TO_GU.get(dong, "")
            batch.append({
                "crawl_date": r["crawl_date"],
                "article_id": str(r["article_id"]),
                "dong": dong,
                "dong_code": _resolve_dong_code(code_map, gu, dong),
                "building": r.get("building", ""),
                "floor": r.get("floor", ""),
                "area_m2": r.get("area_m2", 0),
                "deposit": r.get("deposit", 0),
                "monthly_rent": r.get("monthly_rent", 0),
                "article_name": r.get("article_name", ""),
                "gu": gu,
            })

        # 500건씩 upsert
        for i in range(0, len(batch), 500):
            chunk = batch[i:i+500]
            sb.table("naver_listings").upsert(chunk, on_conflict="crawl_date,article_id").execute()

        print(f"[updater] naver_listings: {len(batch)}건 동기화")

    # estimated_deals → naver_estimated_deals
    deals = conn.execute(
        "SELECT * FROM estimated_deals WHERE disappeared_date >= ?", (cutoff,)
    ).fetchall()

    if deals:
        batch = []
        for r in deals:
            dong = r["dong"] if "dong" in r.keys() else ""
            gu = DONG_TO_GU.get(dong, "")
            batch.append({
                "disappeared_date": r["disappeared_date"],
                "article_id": str(r["article_id"]),
                "dong": dong,
                "dong_code": _resolve_dong_code(code_map, gu, dong),
                "building": r.get("building", ""),
                "floor": r.get("floor_type", ""),
                "area_m2": r.get("area_m2", 0),
                "asking_deposit": r.get("asking_deposit", 0),
                "asking_rent": r.get("asking_rent", 0),
                "estimated_deposit": r.get("estimated_deposit", 0),
                "estimated_rent": r.get("estimated_rent", 0),
                "rent_per_pyeong": r.get("rent_per_pyeong", 0),
                "gu": gu,
            })

        for i in range(0, len(batch), 500):
            chunk = batch[i:i+500]
            sb.table("naver_estimated_deals").upsert(chunk, on_conflict="disappeared_date,article_id").execute()

        print(f"[updater] naver_estimated_deals: {len(batch)}건 동기화")

    conn.close()


# ═══════════════════════════════════════════════════════════
# 2. 서울 열린데이터 → gu_rent_stats / gu_sale_stats
# ═══════════════════════════════════════════════════════════

def update_gu_rent_stats():
    """서울 열린데이터 임대 API → gu_rent_stats 갱신"""
    from services.rent_live_api import get_store_rent_by_gu, GU_CODE

    sb = _get_sb()
    updated = 0

    for gu_name in GU_CODE.keys():
        try:
            data = get_store_rent_by_gu(gu_name)
            if not data or data.get("count", 0) == 0:
                continue

            # 평당 임대료 계산 (avg_rent_per_m2 × 3.3)
            m2_rent = data.get("avg_rent_per_m2", 0)
            f1_pyeong = round(m2_rent * 3.3, 1) if m2_rent else 0

            sb.table("gu_rent_stats").upsert({
                "gu": gu_name,
                "avg_deposit": data.get("avg_deposit", 0),
                "avg_monthly_rent": data.get("avg_monthly_rent", 0),
                "avg_rent_per_m2": m2_rent,
                "f1_pyeong": f1_pyeong,
                "f2_pyeong": round(f1_pyeong * 0.6, 1),  # 2층 ≈ 1층의 60%
                "b1_pyeong": round(f1_pyeong * 0.58, 1),  # 지하 ≈ 1층의 58%
                "source": data.get("source", "서울 열린데이터"),
                "updated_at": datetime.now().isoformat(),
            }, on_conflict="gu").execute()
            updated += 1

        except Exception as e:
            print(f"[updater] gu_rent_stats {gu_name} 오류: {e}")

    print(f"[updater] gu_rent_stats: {updated}개 구 갱신")


def update_gu_sale_stats():
    """서울 열린데이터 매매 API → gu_sale_stats 갱신"""
    from services.rent_live_api import get_store_sale_by_gu, GU_CODE

    sb = _get_sb()
    updated = 0

    for gu_name in GU_CODE.keys():
        try:
            data = get_store_sale_by_gu(gu_name)
            if not data or data.get("count", 0) == 0:
                continue

            sb.table("gu_sale_stats").upsert({
                "gu": gu_name,
                "m2_price": data.get("avg_price_per_m2", 0),
                "avg_price": data.get("avg_price", 0),
                "source": data.get("source", "서울 열린데이터"),
                "updated_at": datetime.now().isoformat(),
            }, on_conflict="gu").execute()
            updated += 1

        except Exception as e:
            print(f"[updater] gu_sale_stats {gu_name} 오류: {e}")

    print(f"[updater] gu_sale_stats: {updated}개 구 갱신")


# ═══════════════════════════════════════════════════════════
# 3. 대시보드 KPI — stores 테이블에서 집계
# ═══════════════════════════════════════════════════════════

def update_dashboard_stats():
    """Supabase stores 테이블에서 총 점포수/개업/폐업 집계 → dashboard_stats"""
    sb = _get_sb()

    # 전체 집계
    result = sb.table("stores").select("store_count, open_count, close_count").execute()
    rows = result.data or []

    total_stores = sum(r.get("store_count", 0) for r in rows)
    total_open = sum(r.get("open_count", 0) for r in rows)
    total_close = sum(r.get("close_count", 0) for r in rows)

    now = datetime.now().isoformat()

    sb.table("dashboard_stats").upsert([
        {"metric_key": "total_stores", "value": total_stores, "label": "총 상가 데이터", "updated_at": now},
        {"metric_key": "monthly_open", "value": total_open, "label": "이번 분기 신규 개업", "updated_at": now},
        {"metric_key": "monthly_close", "value": total_close, "label": "이번 분기 폐업", "updated_at": now},
    ], on_conflict="metric_key").execute()

    print(f"[updater] dashboard_stats: 점포 {total_stores}, 개업 {total_open}, 폐업 {total_close}")


# ═══════════════════════════════════════════════════════════
# CLI 실행
# ═══════════════════════════════════════════════════════════

def run_all():
    """전체 업데이트 실행"""
    print(f"[updater] 전체 업데이트 시작: {datetime.now()}")
    sync_naver_to_supabase()
    update_gu_rent_stats()
    update_gu_sale_stats()
    update_dashboard_stats()
    print(f"[updater] 전체 업데이트 완료: {datetime.now()}")


def _load_env():
    """프로젝트 .env 파일들을 환경변수로 로드"""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for env_file in ["web/.env.local", ".env"]:
        path = os.path.join(root, env_file)
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k, v)


if __name__ == "__main__":
    import sys
    _load_env()

    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd == "naver":
        sync_naver_to_supabase()
    elif cmd == "rent":
        update_gu_rent_stats()
    elif cmd == "sale":
        update_gu_sale_stats()
    elif cmd == "dashboard":
        update_dashboard_stats()
    elif cmd == "all":
        run_all()
    else:
        print(f"Usage: python services/data_updater.py [naver|rent|sale|dashboard|all]")
