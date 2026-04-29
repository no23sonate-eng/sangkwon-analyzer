"""분기 자동 갱신 파이프라인 — 모든 데이터 소스 갱신 + 보정계수 재산출 + 회귀 테스트.

실행:
  PYTHONPATH=. python3 services/quarterly_pipeline.py             # 전체
  PYTHONPATH=. python3 services/quarterly_pipeline.py --skip-rtms # RTMS 호출 스킵 (시간 단축)
  PYTHONPATH=. python3 services/quarterly_pipeline.py --dry       # 실제 실행 없이 단계만 출력

순서:
  1. RTMS 매매 동 단위 sync (25개 구, ~30분)        — sync-rtms-land-dong.mjs
  2. gu_rent_stats / gu_sale_stats / 네이버 sync    — data_updater.py
  3. owner_network_rents 임포트                    — import_owner_rents.py (CSV 있을 때)
  4. market_reports 임포트                         — import_market_reports.py (CSV 있을 때)
  5. dong_calibration 재산출                       — calibration.py
  6. 한남동 sanity check 회귀                      — sanity-check.ts
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def step(title: str, cmd: list[str], cwd: Path = ROOT, dry: bool = False, allow_fail: bool = False) -> bool:
    print(f"\n━━━ [{title}] {' '.join(cmd)}")
    if dry:
        print("  (dry run)")
        return True
    t0 = time.time()
    result = subprocess.run(cmd, cwd=cwd)
    dt = time.time() - t0
    ok = result.returncode == 0
    print(f"  → {'✓ 성공' if ok else '✗ 실패'} ({dt:.1f}s)")
    if not ok and not allow_fail:
        return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-rtms", action="store_true", help="RTMS 호출 스킵 (디버깅용)")
    ap.add_argument("--dry", action="store_true", help="실행 없이 단계만 출력")
    args = ap.parse_args()

    print(f"분기 갱신 파이프라인 시작 — {ROOT}")

    failed_steps: list[str] = []

    # 1. RTMS 동 단위 sync
    if not args.skip_rtms:
        ok = step("RTMS 매매 동 단위 sync", ["node", "scripts/sync-rtms-land-dong.mjs"],
                 cwd=ROOT / "web", dry=args.dry)
        if not ok: failed_steps.append("RTMS sync")

    # 2. 기본 통계 갱신
    for sub in ["naver", "rent", "sale", "dashboard"]:
        ok = step(f"data_updater {sub}", ["python3", "services/data_updater.py", sub],
                 dry=args.dry, allow_fail=True)
        if not ok: failed_steps.append(f"data_updater {sub}")

    # 3. owner network 임포트
    step("owner_network_rents 임포트",
         ["python3", "services/import_owner_rents.py"],
         dry=args.dry, allow_fail=True)  # CSV 비어있어도 정상 종료하게

    # 4. market reports 임포트
    step("market_reports 임포트",
         ["python3", "services/import_market_reports.py"],
         dry=args.dry, allow_fail=True)

    # 5. 보정계수 재산출
    step("dong_calibration 산출",
         ["python3", "services/calibration.py"],
         dry=args.dry, allow_fail=True)

    # 6. sanity check (실패 시 파이프라인 실패)
    ok = step("한남동 sanity check",
             ["npx", "tsx", "scripts/sanity-check.ts"],
             cwd=ROOT / "web", dry=args.dry)
    if not ok: failed_steps.append("sanity check")

    print(f"\n━━━ 파이프라인 완료 ━━━")
    if failed_steps:
        print(f"실패한 단계 {len(failed_steps)}: {failed_steps}")
        return 1
    print("전체 성공")
    return 0


if __name__ == "__main__":
    sys.exit(main())
