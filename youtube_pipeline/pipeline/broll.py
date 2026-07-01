#!/usr/bin/env python3
"""② B-roll 단계 — B-roll 후보 검색 및 검토 → broll.json  (뼈대)

상세 스펙은 후속 지시 예정. 지금은 계약(입출력)과 실행 골격만 잡아둔다.

입력: projects/<영상명>/transcript.json
출력: projects/<영상명>/broll.json

원칙:
- Pexels / Pixabay API 로 후보 검색 (키: PEXELS_API_KEY, PIXABAY_API_KEY)
- 어떤 문장에 어떤 클립을 붙일지의 AI 판단은 Anthropic 호출.
  판단 기준은 코드에 하드코딩하지 않고 style_guide.md 를 읽어 프롬프트에 포함.
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

log = common.get_logger("broll")


def run(project: common.Project, config: dict) -> dict:
    if not project.transcript_path.exists():
        raise FileNotFoundError(
            f"{project.transcript_path} 없음. 먼저 transcribe 를 실행하세요."
        )
    _ = common.read_json(project.transcript_path)
    # style_guide 는 AI 판단의 유일한 기준. 후속 스펙에서 프롬프트에 주입한다.
    _style = common.load_style_guide(config)  # noqa: F841
    log.warning("broll: 상세 스펙 대기 중 — 아직 후보 검색/검토 미구현.")
    return {"project": project.name, "status": "not_implemented", "clips": []}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="② B-roll 후보 검색/검토 → broll.json")
    parser.add_argument("project", help="영상명 또는 projects/영상명 경로")
    parser.add_argument("--config", default=str(common.CONFIG_PATH))
    args = parser.parse_args(argv)

    config = common.load_config(args.config)
    project = common.resolve_project(args.project)
    result = run(project, config)
    common.write_json(project.broll_path, result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
