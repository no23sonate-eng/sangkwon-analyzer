#!/usr/bin/env python3
"""⑤ 내보내기 — 프리미어 프로 / 캡컷 연동 패키지 생성.

출력: projects/<영상명>/export/
  premiere.xml   프리미어 프로용 시퀀스 (FCP7 XML) — V1 원본, V2 선택된 B-roll 배치
  subtitle.srt   자막 (프리미어 '캡션 가져오기' / 캡컷 '자막 가져오기' 용)
  typo/*.png     대형 키워드 타이포 — 투명 배경 PNG (V3에 드래그해서 얹기)
  가이드.txt     타임코드 목록 + 사용법

실행:
    python youtube_pipeline/pipeline/export.py <영상명>
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import xml.sax.saxutils as sx
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import subtitle as subtitle_mod  # noqa: E402

log = common.get_logger("export")

EXPORT_DIR = "export"


# ── SRT ────────────────────────────────────────────────────

def _srt_ts(sec: float) -> str:
    h = int(sec // 3600); m = int(sec % 3600 // 60)
    s = int(sec % 60); ms = int(round((sec - int(sec)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_srt(config: dict, plan: dict, segments: list[dict], out: Path) -> int:
    """subtitle_plan 의 큐를 (한 줄 분할 규칙 적용해) SRT 로 변환."""
    sconf = config.get("subtitle", {})
    cues = subtitle_mod.split_long_cues(
        plan["cues"], segments,
        max_sec=float(sconf.get("max_cue_sec", 5.0)),
        max_chars=int(sconf.get("max_chars_per_line", 20)))
    lines = []
    for i, c in enumerate(cues, 1):
        lines += [str(i), f"{_srt_ts(c['start'])} --> {_srt_ts(c['end'])}", c["text"], ""]
    out.write_text("\n".join(lines), encoding="utf-8")
    return len(cues)


# ── 타이포 PNG (투명 배경 — 프리미어/캡컷에 드래그) ────────

def build_typo_pngs(config: dict, plan: dict, out_dir: Path) -> list[dict]:
    from PIL import Image, ImageDraw, ImageFont
    sconf = config.get("subtitle", {})
    profile = common.get_render_profile(config)
    w, h = profile["width"], profile["height"]
    fonts_dir = common.ROOT_DIR / "assets" / "fonts"
    styles = {
        "headline": (fonts_dir / "A2Z-1Thin.ttf", round(h * 0.16), (255, 255, 255, 255)),
        "concept": (fonts_dir / "A2Z-5Medium.ttf", round(h * 0.11), (250, 255, 46, 255)),
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    made = []
    for d in plan.get("displays", []):
        if not d.get("enabled", True):
            continue
        font_path, size, color = styles.get(d.get("style", "headline"), styles["headline"])
        font = ImageFont.truetype(str(font_path), size)
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        bbox = draw.textbbox((0, 0), d["text"], font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x, y = (w - tw) // 2 - bbox[0], (h - th) // 2 - bbox[1]
        draw.text((x + 3, y + 3), d["text"], font=font, fill=(0, 0, 0, 140))  # 그림자
        draw.text((x, y), d["text"], font=font, fill=color)
        name = f"typo_{d['id']:02d}_{d['style']}.png"
        img.save(out_dir / name)
        made.append({**d, "file": name})
        log.info("타이포 PNG: %s (\"%s\")", name, d["text"])
    return made


# ── 프리미어 시퀀스 (FCP7 XML) ─────────────────────────────

def _has_audio_stream(path: Path) -> bool:
    """실제로 오디오 스트림이 있는지 ffprobe 로 직접 확인한다 — type이
    "video"라고 오디오가 있다는 뜻은 아니다(Pexels/Pixabay 스톡 영상은
    무음인 경우가 흔하다, 실제로 겪은 버그). PNG 등은 애초에 ffprobe가
    오디오 스트림을 못 찾으므로 자동으로 False."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a",
             "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, timeout=10,
        )
        return bool(out.stdout.strip())
    except Exception:
        return False


def _clipitem(cid: str, name: str, path: Path, fid: str, tb: int,
              in_f: int, out_f: int, start_f: int, end_f: int,
              w: int, h: int, media: str = "video", new_file: bool = True,
              has_audio: bool = True, abs_path_str: str | None = None) -> str:
    """has_audio=False 로 PNG/사진처럼 오디오 트랙이 아예 없는 소스를
    표시 — <media> 에 <audio> 를 넣으면 프리미어 '미디어 연결'이 오디오
    없는 파일을 "형식 불일치"로 거부한다(실제로 겪은 버그).

    abs_path_str: 이 파이프라인이 도는 서버 경로 대신, 실제로 파일을 열
    로컬 컴퓨터의 절대경로를 직접 지정 — 지정하면 프리미어가 "미디어
    연결" 창 없이 드래그만으로 바로 연결한다(build_premiere_xml 의
    local_root 참고)."""
    pathurl = "file://localhost" + sx.escape((abs_path_str or str(path.resolve())).replace(os.sep, "/"))
    audio_el = '<audio><channelcount>2</channelcount></audio>' if has_audio else ''
    file_el = (f'<file id="{fid}"><name>{sx.escape(path.name)}</name>'
               f'<pathurl>{pathurl}</pathurl>'
               f'<rate><timebase>{tb}</timebase><ntsc>FALSE</ntsc></rate>'
               f'<media><video><samplecharacteristics><width>{w}</width><height>{h}</height>'
               f'</samplecharacteristics></video>{audio_el}</media>'
               f'</file>') if new_file else f'<file id="{fid}"/>'
    return (f'<clipitem id="{cid}"><name>{sx.escape(name)}</name>'
            f'<rate><timebase>{tb}</timebase><ntsc>FALSE</ntsc></rate>'
            f'<in>{in_f}</in><out>{out_f}</out><start>{start_f}</start><end>{end_f}</end>'
            f'{file_el}</clipitem>')


def build_premiere_xml(config: dict, project: common.Project, out: Path,
                       local_root: str | None = None) -> int:
    """local_root: 프리미어를 실제로 열 로컬 컴퓨터에서 이 프로젝트
    폴더가 위치할 절대경로(예: "/Volumes/TOSHIBA EXT/.../웨스트뱅크딜").
    지정하면 pathurl 이 이 경로 기준으로 만들어져 "미디어 연결" 창 없이
    드래그만으로 바로 붙는다. 생략하면 지금 이 서버의 경로가 그대로
    들어가 결국 사용자가 수동으로 다시 연결해야 한다."""
    profile = common.get_render_profile(config)
    w, h, tb = profile["width"], profile["height"], int(profile.get("fps", 30))
    source = project.find_source_media()
    transcript = common.read_json(project.transcript_path)
    total_f = int(round(float(transcript.get("duration", 0)) * tb)) or tb

    def F(sec: float) -> int:
        return int(round(sec * tb))

    def local_path(f: Path) -> str | None:
        if not local_root:
            return None
        rel = f.relative_to(project.path)
        return f"{local_root.rstrip('/')}/{rel.as_posix()}"

    # V2: 선택된 B-roll
    v2 = []
    n_broll = 0
    sel_path = project.path / "selections.json"
    if sel_path.exists():
        for s in common.read_json(sel_path).get("sections", []):
            ch = s.get("choice")
            if not isinstance(ch, dict):
                continue
            f = project.path / ch["file"]
            if not f.exists():
                continue
            n_broll += 1
            dur_f = F(s["end"]) - F(s["start"])
            v2.append(_clipitem(f"broll-{n_broll}", f.name, f, f"file-b{n_broll}", tb,
                                0, dur_f, F(s["start"]), F(s["end"]), w, h,
                                has_audio=_has_audio_stream(f), abs_path_str=local_path(f)))

    v1 = _clipitem("main-v", source.name, source, "file-main", tb, 0, total_f, 0, total_f, w, h,
                   abs_path_str=local_path(source))
    a1 = _clipitem("main-a", source.name, source, "file-main", tb, 0, total_f, 0, total_f, w, h,
                   media="audio", new_file=False)

    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
 <sequence id="seq-1">
  <name>{sx.escape(project.name)}_auto</name>
  <duration>{total_f}</duration>
  <rate><timebase>{tb}</timebase><ntsc>FALSE</ntsc></rate>
  <media>
   <video>
    <format><samplecharacteristics>
      <width>{w}</width><height>{h}</height>
      <rate><timebase>{tb}</timebase><ntsc>FALSE</ntsc></rate>
    </samplecharacteristics></format>
    <track>{v1}</track>
    <track>{"".join(v2)}</track>
   </video>
   <audio>
    <track>{a1}</track>
   </audio>
  </media>
 </sequence>
</xmeml>
'''
    out.write_text(xml, encoding="utf-8")
    return n_broll


# ── 가이드 ─────────────────────────────────────────────────

def build_guide(plan: dict, typos: list[dict], n_cues: int, n_broll: int, out: Path,
               local_root: str | None = None) -> None:
    def ts(sec):
        return f"{int(sec // 60)}:{sec % 60:05.2f}"

    # 자막/타이포가 아예 없는 영상(예: 그래픽 카드에 텍스트가 이미 다
    # 구워져 있는 경우)은 관련 단계를 안내에서 아예 뺀다 — 빈 파일을
    # 가져오라는 무의미한 지시를 남기지 않는다.
    if local_root:
        prem_steps = ["1. premiere.xml 을 프리미어로 드래그 (또는 파일→가져오기)",
                     f"   → 압축을 반드시 \"{local_root}\" 경로 그대로 풀었다면",
                     "     '미디어 연결' 창 없이 바로 V1+V2 시퀀스가 생성됩니다",
                     "   ※ 그래도 연결 창이 뜨면 경로가 달라진 것 — 파일 하나만 찾아주고",
                     "     '이 폴더 자동 재연결' 체크하면 나머지도 한 번에 붙습니다"]
    else:
        prem_steps = ["1. premiere.xml 을 프리미어로 드래그 (또는 파일→가져오기)",
                     "   → V1 원본 + V2 에 B-roll 이 배치된 시퀀스가 생성됩니다",
                     "   ※ '미디어 연결' 창이 뜨면 이 폴더 상위의 원본/broll_candidates 파일을 지정"]
    capcut_steps = ["1. 원본 영상 + broll_candidates 의 선택 클립을 타임라인에 배치"]
    step = 2
    if n_cues:
        prem_steps.append(f"{step}. subtitle.srt 를 가져와 캡션 트랙에 ({n_cues}개, 한 줄 규칙 적용됨)")
        prem_steps.append("   → 캡션 스타일에서 폰트를 '에이투지'로 지정하면 자동 렌더와 동일")
        capcut_steps.append("2. 텍스트 → 자막 가져오기 → subtitle.srt")
        step += 1
    if typos:
        prem_steps.append(f"{step}. typo/ 의 PNG 를 V3 에 드래그 — 아래 타임코드 참고")
        capcut_steps.append("3. typo/ PNG 를 오버레이 트랙에")

    lines = ["■ 프리미어 프로", *prem_steps, "", "■ 캡컷", *capcut_steps]
    if typos:
        lines += ["", f"■ 대형 타이포 타임코드 ({len(typos)}개)"]
        for t in typos:
            lines.append(f"  {ts(t['start'])} ~ {ts(t['end'])}  [{t['style']}] {t['text']}  → typo/{t['file']}")
    lines += ["", f"■ B-roll {n_broll}개는 premiere.xml V2 트랙에 자동 배치되어 있습니다."]
    if not n_cues and not typos:
        lines += ["", "※ 이 영상은 자막/타이포 없이 그래픽 카드 안에 텍스트가 이미 구워져 있습니다",
                 "  — subtitle.srt/typo/ 는 비어 있어 가져올 필요 없습니다."]
    out.write_text("\n".join(lines), encoding="utf-8")


def run(project: common.Project, config: dict, local_root: str | None = None) -> Path:
    if not project.transcript_path.exists():
        raise FileNotFoundError("transcript.json 없음 — 먼저 전사를 실행하세요.")
    plan_path = project.path / "subtitle_plan.json"
    if not plan_path.exists():
        raise FileNotFoundError("subtitle_plan.json 없음 — 먼저 자막 단계를 실행하세요.")
    plan = common.read_json(plan_path)
    transcript = common.read_json(project.transcript_path)

    out_dir = project.path / EXPORT_DIR
    out_dir.mkdir(exist_ok=True)

    n_cues = build_srt(config, plan, transcript.get("segments", []), out_dir / "subtitle.srt")
    typos = build_typo_pngs(config, plan, out_dir / "typo")
    n_broll = build_premiere_xml(config, project, out_dir / "premiere.xml", local_root=local_root)
    build_guide(plan, typos, n_cues, n_broll, out_dir / "가이드.txt", local_root=local_root)

    log.info("내보내기 완료: %s (SRT %d개, 타이포 %d개, B-roll %d개)",
             out_dir, n_cues, len(typos), n_broll)
    return out_dir


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="⑤ 프리미어/캡컷 내보내기")
    parser.add_argument("project")
    parser.add_argument("--local-root", default=None,
                        help="프리미어를 열 로컬 컴퓨터에서 이 프로젝트 폴더의 절대경로"
                             " — 지정하면 미디어 연결 없이 바로 붙는 premiere.xml 생성")
    parser.add_argument("--config", default=str(common.CONFIG_PATH))
    args = parser.parse_args(argv)
    run(common.resolve_project(args.project), common.load_config(args.config), local_root=args.local_root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
