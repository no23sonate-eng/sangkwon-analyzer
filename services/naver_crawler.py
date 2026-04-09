"""네이버 부동산 상가 매물 크롤러 + SQLite 저장

매일 1회 실행하여:
1. 네이버 부동산 API에서 주요 상권의 상가 임대 매물을 수집
2. SQLite DB에 스냅샷 저장
3. 어제 스냅샷과 비교 → 사라진 매물을 "추정 거래"로 기록
4. 호가 × 0.88 보정 = 추정 실거래가

Usage:
    python services/naver_crawler.py          # 전체 크롤링
    python services/naver_crawler.py --query  # DB 조회만
"""

from __future__ import annotations

import sqlite3
import json
import time
import os
import requests
from datetime import datetime, timedelta
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "상권데이터", "rent_market.db")

# 주요 상권 법정동코드 (cortarNo)
TARGET_AREAS = {
    "1168010300": "역삼동",    # 강남구
    "1168010100": "논현동",
    "1165010100": "서초동",    # 서초구
    "1165010700": "반포동",
    "1144010100": "서교동",    # 마포구 홍대
    "1144010800": "연남동",
    "1144011400": "망원동",
    "1117010100": "이태원동",  # 용산구
    "1117010200": "한남동",
    "1120010100": "성수동1가", # 성동구
    "1120010200": "성수동2가",
    "1114010100": "명동",      # 중구
    "1114010300": "을지로",
    "1156010100": "여의도동",  # 영등포구
    "1171010100": "잠실동",    # 송파구
}

NAVER_API = "https://new.land.naver.com/api/articles"

# User-Agent 로테이션으로 Rate Limit 분산
_UA_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]
_ua_idx = 0

def _get_headers():
    global _ua_idx
    _ua_idx = (_ua_idx + 1) % len(_UA_LIST)
    return {
        "User-Agent": _UA_LIST[_ua_idx],
        "Referer": "https://new.land.naver.com/shops",
        "Accept": "application/json",
        "sec-ch-ua-platform": '"Windows"',
    }

HEADERS = _get_headers()  # 호환성

# 호가 → 실거래 보정 계수
ASKING_TO_DEAL_RATIO = 0.88  # 호가의 88%를 실거래로 추정


def init_db():
    """SQLite DB 및 테이블 생성"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 매물 스냅샷 테이블
    c.execute("""
        CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            crawl_date TEXT NOT NULL,           -- YYYY-MM-DD
            article_id TEXT NOT NULL,           -- 네이버 매물 고유ID
            dong TEXT,
            building TEXT,
            floor TEXT,
            area_m2 REAL,
            deposit INTEGER,                   -- 보증금 (만원)
            monthly_rent INTEGER,              -- 월세 (만원)
            article_name TEXT,
            cortarNo TEXT,
            raw_json TEXT,
            UNIQUE(crawl_date, article_id)
        )
    """)

    # 추정 거래 테이블 (사라진 매물)
    c.execute("""
        CREATE TABLE IF NOT EXISTS estimated_deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            disappeared_date TEXT NOT NULL,     -- 매물이 사라진 날짜
            article_id TEXT NOT NULL,
            dong TEXT,
            building TEXT,
            floor TEXT,
            area_m2 REAL,
            asking_deposit INTEGER,            -- 호가 보증금
            asking_rent INTEGER,               -- 호가 월세
            estimated_deposit INTEGER,          -- 추정 실거래 보증금
            estimated_rent INTEGER,             -- 추정 실거래 월세
            rent_per_pyeong REAL,              -- 추정 평당 월세 (만원)
            cortarNo TEXT,
            UNIQUE(disappeared_date, article_id)
        )
    """)

    # 일별 평균 임대료 집계 테이블
    c.execute("""
        CREATE TABLE IF NOT EXISTS daily_avg_rent (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            cortarNo TEXT,
            dong TEXT,
            floor_type TEXT,                    -- 1층, 2층, 지하
            avg_asking_rent_pyeong REAL,        -- 호가 평균 평당 월세
            avg_estimated_rent_pyeong REAL,     -- 추정 실거래 평당 월세
            sample_count INTEGER,
            UNIQUE(date, cortarNo, floor_type)
        )
    """)

    conn.commit()
    return conn


def crawl_area(cortarNo: str, dong_name: str, max_retries: int = 3) -> list[dict]:
    """특정 동의 상가 임대 매물을 크롤링 (재시도 포함)"""
    articles = []
    gu_code = cortarNo[:5] + "00000"

    for attempt in range(max_retries):
        try:
            resp = requests.get(
                NAVER_API,
                params={
                    "cortarNo": gu_code,
                    "realEstateType": "SHP",
                    "tradeType": "B2",
                    "page": 1,
                },
                headers=_get_headers(),
                timeout=10,
            )

            if resp.status_code == 429:
                wait = 15 * (attempt + 1)
                print(f"  Rate limit ({dong_name}), {wait}초 대기 후 재시도 ({attempt+1}/{max_retries})")
                time.sleep(wait)
                continue

            if resp.status_code != 200:
                print(f"  HTTP {resp.status_code} for {dong_name}")
                return []

            data = resp.json()
            if not data.get("articleList"):
                return []

            for a in data["articleList"]:
                prc_str = str(a.get("dealOrWarrantPrc", "0")).replace(",", "").replace("억", "0000").strip()
                rent_str = str(a.get("rentPrc", "0")).replace(",", "").strip()
                try:
                    deposit = int(prc_str) if prc_str.isdigit() else 0
                    monthly = int(rent_str) if rent_str.isdigit() else 0
                except ValueError:
                    deposit, monthly = 0, 0

                articles.append({
                    "article_id": str(a.get("articleNo", "")),
                    "dong": dong_name,
                    "building": a.get("articleName", ""),
                    "floor": a.get("floorInfo", ""),
                    "area_m2": float(a.get("area1", 0) or 0),
                    "deposit": deposit,
                    "monthly_rent": monthly,
                    "article_name": a.get("articleName", ""),
                    "cortarNo": cortarNo,
                    "raw_json": json.dumps(a, ensure_ascii=False),
                })

            return articles

        except Exception as e:
            print(f"  크롤링 오류 ({dong_name}): {e}")
            if attempt < max_retries - 1:
                time.sleep(10)

    return articles


def save_snapshot(conn: sqlite3.Connection, articles: list[dict], crawl_date: str):
    """스냅샷 저장"""
    c = conn.cursor()
    saved = 0
    for a in articles:
        try:
            c.execute("""
                INSERT OR IGNORE INTO snapshots
                (crawl_date, article_id, dong, building, floor, area_m2,
                 deposit, monthly_rent, article_name, cortarNo, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                crawl_date, a["article_id"], a["dong"], a["building"],
                a["floor"], a["area_m2"], a["deposit"], a["monthly_rent"],
                a["article_name"], a["cortarNo"], a["raw_json"],
            ))
            saved += 1
        except Exception:
            pass
    conn.commit()
    return saved


def find_disappeared(conn: sqlite3.Connection, today: str, yesterday: str) -> list[dict]:
    """어제는 있었는데 오늘 사라진 매물 = 추정 거래"""
    c = conn.cursor()
    c.execute("""
        SELECT y.article_id, y.dong, y.building, y.floor, y.area_m2,
               y.deposit, y.monthly_rent, y.cortarNo
        FROM snapshots y
        WHERE y.crawl_date = ?
        AND y.article_id NOT IN (
            SELECT t.article_id FROM snapshots t WHERE t.crawl_date = ?
        )
        AND y.monthly_rent > 0
        AND y.area_m2 > 0
    """, (yesterday, today))

    disappeared = []
    for row in c.fetchall():
        area_m2 = row[4]
        asking_deposit = row[5]
        asking_rent = row[6]
        pyeong = area_m2 / 3.3

        est_deposit = int(asking_deposit * ASKING_TO_DEAL_RATIO)
        est_rent = int(asking_rent * ASKING_TO_DEAL_RATIO)
        rent_per_pyeong = round(est_rent / pyeong, 1) if pyeong > 0 else 0

        disappeared.append({
            "article_id": row[0],
            "dong": row[1],
            "building": row[2],
            "floor": row[3],
            "area_m2": area_m2,
            "asking_deposit": asking_deposit,
            "asking_rent": asking_rent,
            "estimated_deposit": est_deposit,
            "estimated_rent": est_rent,
            "rent_per_pyeong": rent_per_pyeong,
            "cortarNo": row[7],
        })

    return disappeared


def save_estimated_deals(conn: sqlite3.Connection, deals: list[dict], date: str):
    """추정 거래 저장"""
    c = conn.cursor()
    for d in deals:
        try:
            c.execute("""
                INSERT OR IGNORE INTO estimated_deals
                (disappeared_date, article_id, dong, building, floor, area_m2,
                 asking_deposit, asking_rent, estimated_deposit, estimated_rent,
                 rent_per_pyeong, cortarNo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                date, d["article_id"], d["dong"], d["building"], d["floor"],
                d["area_m2"], d["asking_deposit"], d["asking_rent"],
                d["estimated_deposit"], d["estimated_rent"],
                d["rent_per_pyeong"], d["cortarNo"],
            ))
        except Exception:
            pass
    conn.commit()


def update_daily_avg(conn: sqlite3.Connection, date: str):
    """일별 평균 임대료 집계"""
    c = conn.cursor()

    # 호가 평균 (스냅샷에서)
    c.execute("""
        SELECT cortarNo, dong,
            CASE
                WHEN floor LIKE '%1%' OR floor LIKE '%1층%' THEN '1층'
                WHEN floor LIKE '%B%' OR floor LIKE '%지하%' THEN '지하'
                ELSE '2층'
            END as floor_type,
            AVG(monthly_rent / (area_m2 / 3.3)) as avg_rent_pyeong,
            COUNT(*) as cnt
        FROM snapshots
        WHERE crawl_date = ? AND monthly_rent > 0 AND area_m2 > 0
        GROUP BY cortarNo, floor_type
    """, (date,))

    for row in c.fetchall():
        cortarNo, dong, floor_type, avg_asking, cnt = row
        # 추정 실거래 평균
        avg_estimated = avg_asking * ASKING_TO_DEAL_RATIO if avg_asking else 0

        try:
            c.execute("""
                INSERT OR REPLACE INTO daily_avg_rent
                (date, cortarNo, dong, floor_type, avg_asking_rent_pyeong,
                 avg_estimated_rent_pyeong, sample_count)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (date, cortarNo, dong, floor_type,
                  round(avg_asking, 1), round(avg_estimated, 1), cnt))
        except Exception:
            pass

    conn.commit()


def run_crawl():
    """전체 크롤링 실행"""
    conn = init_db()
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    print(f"=== 네이버 부동산 상가 크롤링: {today} ===")
    print(f"DB: {DB_PATH}")

    total_articles = 0
    crawled_areas = set()

    for cortarNo, dong_name in TARGET_AREAS.items():
        gu_code = cortarNo[:5]
        if gu_code in crawled_areas:
            continue  # 같은 구는 1번만

        print(f"  크롤링: {dong_name} ({cortarNo})...")
        articles = crawl_area(cortarNo, dong_name)
        if articles:
            saved = save_snapshot(conn, articles, today)
            total_articles += saved
            print(f"    → {saved}건 저장")
        else:
            print(f"    → 매물 없음 또는 API 제한")

        crawled_areas.add(gu_code)
        time.sleep(5)  # Rate limit 방지 (5초 대기)

    print(f"\n총 {total_articles}건 스냅샷 저장")

    # Phase 3: 사라진 매물 비교
    disappeared = find_disappeared(conn, today, yesterday)
    if disappeared:
        save_estimated_deals(conn, disappeared, today)
        print(f"추정 거래: {len(disappeared)}건")
        for d in disappeared[:5]:
            print(f"  {d['dong']} {d['building']} {d['area_m2']}㎡ "
                  f"호가 보{d['asking_deposit']}/월{d['asking_rent']} → "
                  f"추정 보{d['estimated_deposit']}/월{d['estimated_rent']} "
                  f"(평당 {d['rent_per_pyeong']}만)")
    else:
        print("추정 거래: 어제 스냅샷 없음 (첫 실행)")

    # 일별 평균 집계
    update_daily_avg(conn, today)
    print("일별 평균 임대료 집계 완료")

    conn.close()
    print("완료!")


def query_estimated_rent(dong_name: str = "", floor_type: str = "1층", days: int = 30) -> dict:
    """추정 임대료 조회 (API에서 호출용)"""
    if not os.path.exists(DB_PATH):
        return {"error": "DB 없음", "data": []}

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    since = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    # 추정 거래 기반
    if dong_name:
        c.execute("""
            SELECT AVG(rent_per_pyeong), COUNT(*), AVG(estimated_deposit / (area_m2/3.3))
            FROM estimated_deals
            WHERE dong LIKE ? AND floor LIKE ? AND disappeared_date >= ?
            AND rent_per_pyeong > 0
        """, (f"%{dong_name}%", f"%{floor_type}%", since))
    else:
        c.execute("""
            SELECT AVG(rent_per_pyeong), COUNT(*), AVG(estimated_deposit / (area_m2/3.3))
            FROM estimated_deals
            WHERE floor LIKE ? AND disappeared_date >= ?
            AND rent_per_pyeong > 0
        """, (f"%{floor_type}%", since))

    row = c.fetchone()
    avg_rent = round(row[0], 1) if row[0] else 0
    count = row[1] if row[1] else 0
    avg_deposit = round(row[2], 0) if row[2] else 0

    # 호가 기반 (현재 매물)
    c.execute("""
        SELECT AVG(monthly_rent / (area_m2/3.3)), COUNT(*)
        FROM snapshots
        WHERE crawl_date = (SELECT MAX(crawl_date) FROM snapshots)
        AND monthly_rent > 0 AND area_m2 > 0
    """)
    asking_row = c.fetchone()
    avg_asking = round(asking_row[0], 1) if asking_row[0] else 0
    asking_count = asking_row[1] if asking_row[1] else 0

    conn.close()

    return {
        "estimated_rent_per_pyeong": avg_rent,
        "estimated_deposit_per_pyeong": avg_deposit,
        "deal_count": count,
        "asking_rent_per_pyeong": avg_asking,
        "asking_count": asking_count,
        "period_days": days,
        "source": "네이버 부동산 호가 추정 실거래",
    }


if __name__ == "__main__":
    import sys
    if "--query" in sys.argv:
        result = query_estimated_rent("역삼동", "1층", 30)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        run_crawl()
