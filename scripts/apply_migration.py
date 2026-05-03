"""Supabase 마이그레이션 SQL 직접 실행 헬퍼.

Usage:
    python scripts/apply_migration.py scripts/migrate_places.sql
"""
from __future__ import annotations

import os
import sys
import urllib.parse
from pathlib import Path
import requests


def _load_env(env_path: Path) -> dict:
    out = {}
    if not env_path.exists():
        return out
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python scripts/apply_migration.py <sql-file>")
        return 1
    sql_path = Path(sys.argv[1])
    if not sql_path.exists():
        print(f"[err] SQL 파일 없음: {sql_path}")
        return 1

    root = Path(__file__).resolve().parent.parent
    env = _load_env(root / "web" / ".env.local")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("[err] SUPABASE_URL / SERVICE_ROLE_KEY 없음 (web/.env.local 확인)")
        return 1

    sql = sql_path.read_text(encoding="utf-8")

    # Supabase REST 에는 generic SQL endpoint 가 없음 — pg_meta 또는 RPC 필요.
    # 가장 안정적: PostgREST 의 'rpc/exec_sql' 같은 함수가 보통 없으므로,
    # Supabase 가 제공하는 대시보드 SQL Editor 또는 psql 직접.
    # 여기선 supabase-py 로 자동 실행을 시도하되, 실패시 안내.

    try:
        from supabase import create_client  # type: ignore
        sb = create_client(url, key)
        # supabase-py 는 raw SQL 실행 미지원 — postgrest 만. 우회: rpc 함수 호출 시도.
        try:
            sb.postgrest.rpc("exec_sql", {"sql": sql}).execute()
            print(f"[ok] rpc exec_sql 로 적용 완료: {sql_path}")
            return 0
        except Exception:
            pass
    except Exception as e:
        print(f"[warn] supabase-py 미동작: {e}", file=sys.stderr)

    # PostgREST 대신 Supabase Admin REST API (pg-meta 비공식) 으로 직접 시도.
    pg_meta = url.rstrip("/") + "/pg/query"
    try:
        resp = requests.post(
            pg_meta,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={"query": sql},
            timeout=30,
        )
        if resp.status_code in (200, 201):
            print(f"[ok] pg-meta REST 로 적용 완료: {sql_path}")
            return 0
        print(f"[warn] pg-meta {resp.status_code}: {resp.text[:200]}", file=sys.stderr)
    except Exception as e:
        print(f"[warn] pg-meta 호출 실패: {e}", file=sys.stderr)

    print()
    print("━━━ 자동 적용 실패. 수기로 적용 필요 ━━━")
    print(f"  1) Supabase 대시보드 → SQL Editor")
    print(f"  2) {sql_path} 파일 내용 붙여넣기 → Run")
    print()
    print("또는 psql 직접:")
    print(f"  psql '<DATABASE_URL>' -f {sql_path}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
