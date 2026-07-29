#!/usr/bin/env python3
"""HTML/CSS/SVG → PNG 렌더러 (Chromium headless).

matplotlib+PIL 로는 만들 수 없는 것들(진짜 아날로그 그라디언트, 진짜
letter-spacing, box-shadow/filter 블러, SVG native gradient/dropshadow)을
써서 카드를 만들기 위한 새 렌더링 백엔드(2026-07-29, "B1M 퀄리티 따라잡기"
피드백 — 지금 배경/아이콘 그라디언트가 matplotlib imshow 보간이라 계단이
보이고, 자간도 유니코드 thin space 를 끼워 흉내내는 수준이라 한계가
뚜렷했다).

폰트는 파일 경로로 넘기지 않고 base64 data URI 로 인라인해서 @font-face
에 박는다 — 임시 디렉토리 위치에 상관없이 항상 로드되게 하기 위함.
"""

from __future__ import annotations

import base64
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import common

log = common.get_logger("html_render")

FONT_DIR = common.ROOT_DIR / "assets" / "fonts"
FONT_FILES = {
    "A2Z Thin": "A2Z-1Thin.ttf",
    "A2Z ExtraLight": "A2Z-2ExtraLight.ttf",
    "A2Z Light": "A2Z-3Light.ttf",
    "A2Z Regular": "A2Z-4Regular.ttf",
    "A2Z Medium": "A2Z-5Medium.ttf",
    "Pretendard": "Pretendard-Regular.otf",
    "Pretendard Bold": "Pretendard-Bold.otf",
}

_CHROME_CANDIDATES = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    shutil.which("chromium"),
    shutil.which("chromium-browser"),
    shutil.which("google-chrome"),
]


def _find_chrome() -> str:
    for c in _CHROME_CANDIDATES:
        if c and Path(c).exists():
            return c
    # 버전 번호가 바뀌었을 수 있으니 glob 으로 한 번 더 탐색
    for hit in Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome"):
        return str(hit)
    raise RuntimeError("Chromium 실행 파일을 찾을 수 없음 (/opt/pw-browsers 확인)")


def bg_gradient_data_uri(width: int = 960, height: int = 540, inner_hex: str = "#1C2740",
                         outer_hex: str = "#05070C", cx: float = 0.5, cy: float = 0.42,
                         radius: float = 0.95) -> str:
    """전체 화면 크기의 방사형 그라디언트를 CSS `radial-gradient()`로 라이브
    렌더링하면 Chromium 헤드리스 소프트웨어 래스터라이저가 캔버스 하단
    일부를 흰색으로 남기는 버그를 실제로 겪었다(작은 요소의 그라디언트는
    문제 없음 — 전체 뷰포트 크기의 큰 그라디언트에서만 재현됨). 그래서
    배경은 PIL/numpy 로 미리 래스터화해 PNG data URI 로 굽고, `<img>`/
    `background-image` 로만 쓴다. width/height 는 실제 출력보다 작게(기본
    960x540) 만들어도 되는데, 그라디언트는 저주파(부드러운 변화)라 브라우저의
    이미지 스케일링 보간만으로 밴딩 없이 충분히 매끈하다."""
    import io
    import base64 as b64mod
    from PIL import Image
    from assets_lib import _radial_gradient

    arr = _radial_gradient(width, height, inner_hex, outer_hex, cx, cy, radius)
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return "data:image/png;base64," + b64mod.b64encode(buf.getvalue()).decode("ascii")


def font_face_css(families: list[str] | None = None) -> str:
    """지정한 폰트(없으면 전체)를 base64 data URI @font-face 로 인라인."""
    out = []
    for fam, fname in FONT_FILES.items():
        if families and fam not in families:
            continue
        p = FONT_DIR / fname
        if not p.exists():
            continue
        b64 = base64.b64encode(p.read_bytes()).decode("ascii")
        fmt = "opentype" if fname.endswith(".otf") else "truetype"
        out.append(
            f"@font-face {{ font-family: '{fam}'; "
            f"src: url(data:font/{fmt};base64,{b64}) format('{fmt}'); }}"
        )
    return "\n".join(out)


def html_to_png(html: str, out: Path, width: int = 1920, height: int = 1080,
                scale: int = 2, transparent: bool = False) -> Path:
    """HTML 문자열을 렌더링해 PNG 로 저장. width/height 는 CSS 픽셀(뷰포트)
    기준이고, scale 배수만큼 실제 출력 해상도를 키운다(기본 2배 —
    render.py 의 zoompan 업스케일에 밴딩 없이 버티도록 여유 확보).

    실제로 겪은 버그: 이 샌드박스의 헤드리스 Chromium 은 GPU 가 없어
    소프트웨어 경로로 폴백하는데(SharedImageManager 관련 에러 로그가
    항상 찍힌다), 전체 뷰포트 크기의 배경(그라디언트든 배경이미지든)이
    있으면 캔버스 하단 ~5~8%가 새하얗게 잘려 나온다(작은 요소의
    그라디언트/블러는 문제 없음 — 전체 화면 크기 배경에서만 재현).
    실제 컨텐츠 높이(`height`)보다 창을 넉넉히 더 키워 요청한 뒤, 손상되는
    하단 구간을 넘어선 위쪽만 크롭해서 우회한다.
    """
    chrome = _find_chrome()
    out.parent.mkdir(parents=True, exist_ok=True)
    render_height = int(height / 0.72)  # 잘리는 구간(관측상 하단 4~8%)보다 확실히 위에서 크롭하기 위한 여유

    with tempfile.TemporaryDirectory() as td:
        html_path = Path(td) / "page.html"
        html_path.write_text(html, encoding="utf-8")

        cmd = [
            chrome, "--headless", "--disable-gpu", "--no-sandbox",
            "--hide-scrollbars", "--disable-lcd-text",
            f"--force-device-scale-factor={scale}",
            f"--window-size={width},{render_height}",
            f"--screenshot={out}",
        ]
        if transparent:
            cmd.append("--default-background-color=00000000")
        cmd.append(f"file://{html_path}")

        env = dict(os.environ)
        proc = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=60)
        if not out.exists():
            raise RuntimeError(f"HTML 렌더 실패: {proc.stderr[-2000:]}")

    from PIL import Image
    target_w, target_h = width * scale, height * scale
    im = Image.open(out)
    if im.size != (target_w, target_h):
        im.crop((0, 0, target_w, target_h)).save(out)

    log.info("HTML 렌더 저장: %s (%dx%d @%dx)", out.name, width, height, scale)
    return out


def wrap_page(body_css: str, body_html: str, width: int = 1920, height: int = 1080,
             extra_css: str = "", fonts: list[str] | None = None) -> str:
    """카드 하나짜리 풀페이지 HTML을 조립하는 공통 스켈레톤."""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
{font_face_css(fonts)}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
html, body {{ width: {width}px; height: {height}px; overflow: hidden; }}
html {{ {body_css} }}
body {{ position: relative; {body_css} }}
{extra_css}
</style></head>
<body>
{body_html}
</body></html>"""
