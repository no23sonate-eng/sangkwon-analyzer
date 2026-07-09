#!/usr/bin/env python3
"""④ 렌더 단계 — B-roll 오버레이 + 크로스페이드 + 자막 굽기 → output.mp4.

입력: projects/<영상명>/{원본, selections.json, subtitle.ass}
출력: projects/<영상명>/output.mp4

처리:
1. selections.json 의 선택된 B-roll 을 해당 타임코드에 오버레이
   - 원본 음성 유지, 화면만 교체
   - 사진(type=photo)은 Ken Burns(느린 줌) 적용
   - 스킵/미선택 구간은 원본 화면 유지
2. B-roll 들어가고 나가는 전환부에 0.3초 크로스페이드 (알파 페이드 오버레이)
3. 자막(subtitle.ass)을 맨 마지막에 굽는다 — Pretendard Bold(assets/fonts)

실행:
    python youtube_pipeline/pipeline/render.py <영상명>
    python youtube_pipeline/pipeline/render.py <영상명> --no-subtitle   # 자막 없이
    python youtube_pipeline/pipeline/render.py <영상명> --dry-run       # ffmpeg 명령만 출력
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

log = common.get_logger("render")

SELECTIONS_JSON = "selections.json"
ASS_FILE = "subtitle.ass"
XFADE = 0.3          # B-roll 전환 크로스페이드(초)
KEN_BURNS_ZOOM = 0.12  # 사진 줌 비율 (구간 동안 1.0 → 1.12배)


def _picked_brolls(project: common.Project) -> list[dict]:
    """selections.json 에서 실제 선택된(스킵/미선택 제외) B-roll 구간만 추린다."""
    sel_path = project.path / SELECTIONS_JSON
    if not sel_path.exists():
        log.warning("%s 없음 — B-roll 없이 렌더합니다. (broll.py 검토에서 저장하세요)", SELECTIONS_JSON)
        return []
    sel = common.read_json(sel_path)
    picked = []
    for s in sel.get("sections", []):
        ch = s.get("choice")
        if ch is None:
            log.warning("구간 %d: 검토 페이지에서 선택 안 됨 → 원본 화면 유지", s["id"])
            continue
        if ch == "skip":
            continue
        f = project.path / ch["file"]
        if not f.exists():
            log.warning("구간 %d: 후보 파일 없음(%s) → 원본 화면 유지", s["id"], ch["file"])
            continue
        picked.append({"start": float(s["start"]), "end": float(s["end"]),
                       "file": str(f), "type": ch.get("type", "video"), "section_id": s["id"]})
    return sorted(picked, key=lambda b: b["start"])


def _probe_duration(path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
         "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def _photo_brightness(path: str) -> float:
    """사진 평균 밝기(0~255) — 프레임 배경색 자동 선택용."""
    try:
        from PIL import Image
        im = Image.open(path).convert("L").resize((64, 64))
        pixels = list(im.getdata())
        return sum(pixels) / len(pixels)
    except Exception:
        return 128.0


def _broll_chain(idx: int, b: dict, w: int, h: int, fps: int,
                 frame_conf: dict | None = None,
                 fade_in: bool = True, fade_out: bool = True) -> str:
    """B-roll 입력 하나를 오버레이용 스트림으로 가공하는 필터 체인.

    fade_in/fade_out=False: 영상 전체의 맨 처음/맨 끝에 걸린 구간은 페이드를
    걸지 않는다 — 그 순간 크로스페이드를 걸면 아직 안 보여야 할 원본(베이스)
    레이어가 잠깐 비쳐 보인다 (얼굴 미촬영 모드에서 특히 눈에 띄는 문제).
    """
    dur = b["end"] - b["start"]
    fade_out_st = max(dur - XFADE, 0)
    steps = ["format=yuva420p"]
    if fade_in:
        steps.append(f"fade=t=in:st=0:d={XFADE}:alpha=1")
    if fade_out:
        steps.append(f"fade=t=out:st={fade_out_st:.3f}:d={XFADE}:alpha=1")
    steps.append(f"setpts=PTS-STARTPTS+{b['start']:.3f}/TB[b{idx}]")
    common_tail = ",".join(steps)
    if b["type"] in ("photo", "graphic"):
        frames = max(int(round(dur * fps)), 2)
        fc = frame_conf or {}
        if b["type"] == "graphic":
            # 데이터 카드(지도·그래프): 저해상도 소스를 지속적으로 확대해 매 프레임
            # 리샘플링이 달라지며 생기던 뭉개짐/떨림의 원인이었다. 짧게 자리
            # 잡히는 정도(0.5초)만 움직이고 이후 완전 정지 — 그래픽은 정지가 원칙.
            ramp = max(int(round(0.5 * fps)), 1)
            zoom_amt = 0.04
            zoom_expr = f"min(1+{zoom_amt},1+{zoom_amt}*on/{ramp})"
        else:
            zoom_expr = f"1+{KEN_BURNS_ZOOM}*on/{frames}"
        if b["type"] == "graphic":
            # Cleo Abram 스타일(design_reference.md §11) 그래픽 카드는 이미
            # 완성된 풀블리드 디자인(순블랙 캔버스)이므로 흰 테두리 액자로
            # 다시 감싸지 않는다 — 화면 전체를 그대로 채운다.
            return (
                f"[{idx + 1}:v]scale=3840:-2:flags=lanczos,"
                f"zoompan=z='{zoom_expr}'"
                f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                f":d={frames}:s={w}x{h}:fps={fps},setsar=1," + common_tail
            )
        if fc.get("enabled", True):
            # 프레임 연출: 배경색 캔버스 + 얇은 흰 테두리 카드 + 카드 내부만 줌
            # (style_guide ④ — 셜록현준/조승연 스타일, 풀블리드 금지)
            bright = _photo_brightness(b["file"])
            bg = fc.get("bg_light", "#EFEAE3") if bright >= 90 else fc.get("bg_dark", "#16181D")
            card_h = int(h * float(fc.get("card_ratio", 0.74)))
            border = int(fc.get("border", 6) * h / 1080)
            log.info("  프레임(%s): 밝기 %.0f → 배경 %s", b["type"], bright, bg)
            return (
                # 카드: 줌(내부) → 테두리 → 배경 캔버스 중앙 배치
                # lanczos: 기본(bilinear)보다 선명하게 스케일 — 얇은 폰트 뭉개짐 완화
                f"[{idx + 1}:v]scale=3840:-2:flags=lanczos,"
                f"zoompan=z='{zoom_expr}'"
                f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                f":d={frames}:s={int(card_h * w / h)}x{card_h}:fps={fps},"
                f"pad=iw+{border * 2}:ih+{border * 2}:{border}:{border}:white,"
                f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:{bg.replace('#', '0x')},setsar=1,"
                + common_tail
            )
        # 프레임 연출 끔: 풀화면
        return (
            f"[{idx + 1}:v]scale=3840:-2:flags=lanczos,"
            f"zoompan=z='{zoom_expr}'"
            f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":d={frames}:s={w}x{h}:fps={fps},setsar=1," + common_tail
        )
    # 영상: 프레임레이트/크기 정규화, 짧으면 마지막 프레임 유지로 채움
    return (
        f"[{idx + 1}:v]fps={fps},"
        f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h},setsar=1,"
        f"tpad=stop_mode=clone:stop_duration=30,trim=duration={dur:.3f}," + common_tail
    )


def build_command(project: common.Project, config: dict, use_subtitle: bool = True) -> list[str]:
    profile = common.get_render_profile(config)
    rconf = config.get("render", {})
    w, h, fps = profile["width"], profile["height"], int(profile.get("fps", 30))

    source = project.find_source_media()
    brolls = _picked_brolls(project)
    duration = _probe_duration(source)

    # 입력들
    cmd = ["ffmpeg", "-y", "-loglevel", "warning", "-stats", "-i", str(source)]
    for b in brolls:
        if b["type"] in ("photo", "graphic"):
            cmd += ["-loop", "1", "-t", f"{b['end'] - b['start'] + 1:.3f}", "-i", b["file"]]
        else:
            cmd += ["-i", b["file"]]

    # 필터 그래프
    parts = [
        f"[0:v]fps={fps},scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,"
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1[base0]"
    ]
    cur = "base0"
    for i, b in enumerate(brolls):
        # 영상 전체의 맨 처음/맨 끝에 걸리는 구간은 페이드를 걸지 않는다 —
        # 그 순간 크로스페이드를 걸면 아직 안 보여야 할 원본(베이스)이 잠깐 비친다.
        fade_in = b["start"] > 0.05
        fade_out = b["end"] < duration - 0.05
        parts.append(_broll_chain(i, b, w, h, fps, config.get("photo_frame"),
                                  fade_in=fade_in, fade_out=fade_out))
        nxt = f"base{i + 1}"
        parts.append(f"[{cur}][b{i}]overlay=eof_action=pass[{nxt}]")
        cur = nxt
        log.info("B-roll 구간 %d: %.2f→%.2fs %s (%s)",
                 b["section_id"], b["start"], b["end"], Path(b["file"]).name, b["type"])

    # 자막은 맨 마지막에
    ass_path = project.path / ASS_FILE
    if use_subtitle and ass_path.exists():
        fonts_dir = os.path.relpath(common.ROOT_DIR / "assets" / "fonts", project.path)
        parts.append(f"[{cur}]ass={ASS_FILE}:fontsdir={fonts_dir}[vout]")
        cur = "vout"
        log.info("자막 굽기: %s (fontsdir=%s)", ASS_FILE, fonts_dir)
    elif use_subtitle:
        log.warning("%s 없음 — 자막 없이 렌더합니다. (subtitle.py 검토에서 확정 저장하세요)", ASS_FILE)

    cmd += [
        "-filter_complex", ";".join(parts),
        "-map", f"[{cur}]", "-map", "0:a?",
        "-c:v", rconf.get("video_codec", "libx264"),
        "-crf", str(rconf.get("crf", 18)),
        "-preset", rconf.get("preset", "medium"),
        "-pix_fmt", rconf.get("pixel_format", "yuv420p"),
        "-c:a", rconf.get("audio_codec", "aac"),
        "-movflags", "+faststart",
        str(project.output_path),
    ]
    return cmd


def run(project: common.Project, config: dict, use_subtitle: bool = True,
        dry_run: bool = False) -> Path:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg 가 PATH 에 없습니다. 먼저 설치하세요.")
    # 자막 확정 여부 안내
    plan_path = project.path / "subtitle_plan.json"
    if use_subtitle and plan_path.exists():
        plan = common.read_json(plan_path)
        if not plan.get("user_confirmed"):
            log.warning("자막이 검토 표에서 확정되지 않았습니다 — 초안 ASS 로 굽습니다.")

    cmd = build_command(project, config, use_subtitle)
    if dry_run:
        print(" \\\n  ".join(cmd))
        return project.output_path

    log.info("렌더 시작 → %s", project.output_path)
    # ass 필터의 상대경로가 프로젝트 폴더 기준이 되도록 cwd 지정
    result = subprocess.run(cmd, cwd=project.path)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg 실패 (exit {result.returncode})")
    log.info("완료: %s", project.output_path)
    return project.output_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="④ 최종 합성 → output.mp4")
    parser.add_argument("project", help="영상명 또는 projects/영상명 경로")
    parser.add_argument("--config", default=str(common.CONFIG_PATH))
    parser.add_argument("--no-subtitle", action="store_true", help="자막 굽지 않음")
    parser.add_argument("--dry-run", action="store_true", help="ffmpeg 명령만 출력")
    args = parser.parse_args(argv)

    config = common.load_config(args.config)
    project = common.resolve_project(args.project)
    run(project, config, use_subtitle=not args.no_subtitle, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
