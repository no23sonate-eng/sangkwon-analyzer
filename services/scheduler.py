"""백그라운드 스케줄러 — FastAPI 서버와 함께 실행

서버가 켜져 있으면 자동으로:
- 매일 04:00 네이버 부동산 크롤링
- 매일 04:30 사라진 매물 비교 → 추정 실거래 저장
- 서버 시작 시 즉시 1회 실행 (데이터가 비어있으면)
"""

from __future__ import annotations

import threading
import time
import sqlite3
import os
from datetime import datetime
from services.naver_crawler import init_db, crawl_area, save_snapshot, find_disappeared, save_estimated_deals, update_daily_avg, TARGET_AREAS, DB_PATH

_scheduler_started = False


def _should_run_today() -> bool:
    """오늘 이미 크롤링했는지 확인"""
    if not os.path.exists(DB_PATH):
        return True
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    today = datetime.now().strftime("%Y-%m-%d")
    c.execute("SELECT COUNT(*) FROM snapshots WHERE crawl_date = ?", (today,))
    count = c.fetchone()[0]
    conn.close()
    return count == 0


def _run_crawl_safe():
    """크롤링 실행 (에러 무시)"""
    try:
        from datetime import timedelta
        conn = init_db()
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        print(f"[스케줄러] 크롤링 시작: {today}")
        total = 0
        crawled = set()

        for cortarNo, dong_name in TARGET_AREAS.items():
            gu_code = cortarNo[:5]
            if gu_code in crawled:
                continue

            articles = crawl_area(cortarNo, dong_name)
            if articles:
                saved = save_snapshot(conn, articles, today)
                total += saved
                print(f"  {dong_name}: {saved}건")

            crawled.add(gu_code)
            time.sleep(15)  # 네이버 Rate Limit 방지 (15초 간격)

        # 사라진 매물 비교
        disappeared = find_disappeared(conn, today, yesterday)
        if disappeared:
            save_estimated_deals(conn, disappeared, today)
            print(f"[스케줄러] 추정 거래: {len(disappeared)}건")

        update_daily_avg(conn, today)
        conn.close()
        print(f"[스케줄러] 완료: {total}건 수집")

        # ── Supabase 동기화 + 통계 갱신 ──
        try:
            from services.data_updater import sync_naver_to_supabase, update_dashboard_stats
            sync_naver_to_supabase()
            update_dashboard_stats()
        except Exception as e2:
            print(f"[스케줄러] Supabase 동기화 오류: {e2}")

    except Exception as e:
        print(f"[스케줄러] 크롤링 오류: {e}")


def _scheduler_loop():
    """메인 스케줄러 루프 — 매일 04:00에 실행"""
    # 서버 시작 시 데이터가 비어있으면 즉시 1회 실행
    if _should_run_today():
        print("[스케줄러] 오늘 데이터 없음 → 30초 후 첫 크롤링 시작")
        time.sleep(30)
        _run_crawl_safe()

    while True:
        now = datetime.now()
        # 다음 04:00까지 대기
        target = now.replace(hour=4, minute=0, second=0, microsecond=0)
        if now >= target:
            from datetime import timedelta
            target += timedelta(days=1)

        wait_seconds = (target - now).total_seconds()
        print(f"[스케줄러] 다음 크롤링: {target.strftime('%Y-%m-%d %H:%M')} ({wait_seconds/3600:.1f}시간 후)")
        time.sleep(wait_seconds)

        _run_crawl_safe()


def start_scheduler():
    """스케줄러를 백그라운드 스레드로 시작"""
    global _scheduler_started
    if _scheduler_started:
        return
    _scheduler_started = True

    # DB 초기화
    init_db()

    thread = threading.Thread(target=_scheduler_loop, daemon=True, name="rent-crawler")
    thread.start()
    print("[스케줄러] 네이버 부동산 자동 크롤러 시작됨")
