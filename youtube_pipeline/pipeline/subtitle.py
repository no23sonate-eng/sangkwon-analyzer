#!/usr/bin/env python3
"""③ 자막 단계 — 자막 스타일링 → subtitle.json  (뼈대)

상세 스펙은 후속 지시 예정. 지금은 계약(입출력)과 실행 골격만 잡아둔다.

입력: projects/<영상명>/transcript.json
출력: projects/<영상명>/subtitle.json

원칙:
- 자막 스타일링의 AI 판단은 Anthropic 호출.
  판단 기준은 코드에 하드코딩하지 않고 style_guide.md 를 읽어 프롬프트에 포함.
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

log = common.get_logger("subtitle")


def run(project: common.Project, config: dict) -> dict:
    if not project.transcript_path.exists():
        raise FileNotFoundError(
            f"{project.transcript_path} 없음. 먼저 transcribe 를 실행하세요."
        )
    _ = common.read_json(project.transcript_path)
    _style = common.load_style_guide(config)  # noqa: F841
    log.warning("subtitle: 상세 스펙 대기 중 — 아직 스타일링 미구현.")
    return {"project": project.name, "status": "not_implemented", "cues": []}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="③ 자막 스타일링 → subtitle.json")
    parser.add_argument("project", help="영상명 또는 projects/영상명 경로")
    parser.add_argument("--config", default=str(common.CONFIG_PATH))
    args = parser.parse_args(argv)

    config = common.load_config(args.config)
    project = common.resolve_project(args.project)
    result = run(project, config)
    common.write_json(project.subtitle_path, result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
