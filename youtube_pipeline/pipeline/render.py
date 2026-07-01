#!/usr/bin/env python3
"""④ 렌더 단계 — ffmpeg 최종 합성 → output.mp4  (뼈대)

지금은 계약(입출력)과 실행 골격만. 실제 합성은 broll/subtitle 스펙 확정 후.

입력: projects/<영상명>/{원본, transcript.json, broll.json, subtitle.json}
출력: projects/<영상명>/output.mp4

렌더 포맷은 config.yaml 의 render.active_profile 프로파일을 따른다
(기본 landscape 1920x1080, 향후 shorts 세로 추가 가능).
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

log = common.get_logger("render")


def run(project: common.Project, config: dict) -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg 가 PATH 에 없습니다. 먼저 설치하세요.")
    profile = common.get_render_profile(config)
    log.info("렌더 프로파일: %(orientation)s %(width)sx%(height)s @%(fps)sfps", profile)
    log.warning("render: broll/subtitle 스펙 확정 후 ffmpeg 합성 구현 예정 — 현재 미구현.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="④ ffmpeg 최종 합성 → output.mp4")
    parser.add_argument("project", help="영상명 또는 projects/영상명 경로")
    parser.add_argument("--config", default=str(common.CONFIG_PATH))
    args = parser.parse_args(argv)

    config = common.load_config(args.config)
    project = common.resolve_project(args.project)
    run(project, config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
