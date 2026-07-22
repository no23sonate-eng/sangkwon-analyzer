#!/usr/bin/env python3
"""소스 라이브러리 — 스크립트 내용에 맞는 고퀄리티 이미지·픽토그램·지도.

- images : Wikimedia Commons (특정 건물·인물·장소·미술품 등 고유명사에 강함,
           고해상도 필터 + 출처/라이선스 기록) — B-roll 사진 체인에도 연결됨
- icon   : Iconify (Tabler·Phosphor·Lucide 등 오픈소스 아이콘) →
           인포그래픽 팔레트 색으로 칠해 고해상도 PNG
- map    : GeoJSON + matplotlib → design_reference.md 팔레트의 플랫 지도
           (딥그린 배경 + 민트 면 + 포인트 하이라이트, 에이투지체 라벨)

CLI:
  python assets_lib.py images "Centre Pompidou" --n 4 --out ./out
  python assets_lib.py icon building-skyscraper --color point --size 512 --out ./out
  python assets_lib.py map world --highlight KOR,FRA --out ./out
  python assets_lib.py map KOR --out ./out
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

log = common.get_logger("assets")

UA = {"User-Agent": "youtube-pipeline/1.0 (editorial research)"}
ICON_SETS = ["tabler", "ph", "lucide", "material-symbols"]  # 선호 순
GEO_WORLD = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"
GEO_COUNTRY = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries/{code}.geo.json"
GEO_KOREA = ("https://raw.githubusercontent.com/southkorea/southkorea-maps/master/"
             "kostat/2013/json/skorea_provinces_geo.json")


def _palette(config: dict | None = None) -> dict:
    config = config or common.load_config()
    return config.get("infographic", {
        "card_bg": "#FFFFFF", "canvas_bg": "#EEF1F6", "surface": "#2E9E6B",
        "point": "#3D5A96", "highlight": "#7C8592", "text": "#1C2A38",
        "canvas_text": "#EDEFF4", "blueprint_bg": "#16233A", "blueprint_text": "#EDEFF4"})


# ══════════════════════════════════════════════════════════
# 1. 이미지 — Wikimedia Commons (고해상도 + 출처 기록)
# ══════════════════════════════════════════════════════════

def wikimedia_images(query: str, n: int = 4, min_px: int = 1400) -> list[dict]:
    """위키미디어 커먼즈에서 고해상도 이미지 검색. 출처·라이선스 포함."""
    r = requests.get("https://commons.wikimedia.org/w/api.php", headers=UA, timeout=20, params={
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": f"filetype:bitmap {query}", "gsrnamespace": 6, "gsrlimit": n * 4,
        "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 1920,
    })
    r.raise_for_status()
    pages = (r.json().get("query") or {}).get("pages", {})
    out = []
    for p in sorted(pages.values(), key=lambda p: p.get("index", 99)):
        ii = (p.get("imageinfo") or [{}])[0]
        if not ii or max(ii.get("width", 0), ii.get("height", 0)) < min_px:
            continue
        meta = ii.get("extmetadata", {})
        lic = (meta.get("LicenseShortName") or {}).get("value", "")
        artist = re.sub(r"<[^>]+>", "", (meta.get("Artist") or {}).get("value", ""))[:80]
        out.append({
            "type": "photo", "source": "wikimedia", "source_id": p.get("pageid"),
            "url": ii.get("thumburl") or ii.get("url"),
            "width": ii.get("thumbwidth", ii.get("width")),
            "height": ii.get("thumbheight", ii.get("height")),
            "page": ii.get("descriptionurl"),
            "license": lic, "artist": artist.strip(), "query": query,
        })
        if len(out) >= n:
            break
    return out


def download_images(items: list[dict], out_dir: Path, prefix: str = "img") -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    saved, credits = [], []
    for i, it in enumerate(items):
        ext = ".jpg" if ".png" not in (it["url"] or "").lower() else ".png"
        dest = out_dir / f"{prefix}{i:02d}_{it['source']}{ext}"
        try:
            time.sleep(1.2)  # 위키미디어 rate limit 예방
            r = requests.get(it["url"], headers=UA, timeout=60)
            if r.status_code == 429:
                time.sleep(5)
                r = requests.get(it["url"], headers=UA, timeout=60)
            r.raise_for_status()
            dest.write_bytes(r.content)
            saved.append(dest)
            credits.append({k: it.get(k) for k in ("source", "page", "license", "artist", "query")})
            log.info("이미지 저장: %s (%s, %s)", dest.name, it["source"], it.get("license", ""))
        except Exception as e:
            log.warning("다운로드 실패 %s: %s", it["url"], e)
    if credits:
        common.write_json(out_dir / "credits.json", credits)
    return saved


# ══════════════════════════════════════════════════════════
# 2. 픽토그램 — Iconify → 팔레트 색 고해상도 PNG
# ══════════════════════════════════════════════════════════

def find_icon(query: str) -> str | None:
    """아이콘 이름/검색어 → 'prefix:name'. 선호 세트 우선."""
    r = requests.get("https://api.iconify.design/search", headers=UA, timeout=15,
                     params={"query": query, "limit": 64})
    r.raise_for_status()
    icons = r.json().get("icons", [])
    if not icons:
        return None
    for pref in ICON_SETS:
        for ic in icons:
            if ic.startswith(pref + ":"):
                return ic
    return icons[0]


def icon_png(name: str, out: Path, color: str = "point", size: int = 512,
             config: dict | None = None) -> Path | None:
    """픽토그램 PNG 생성. color 는 hex 또는 팔레트 키(point/highlight/text/surface)."""
    import cairosvg
    pal = _palette(config)
    hexcolor = pal.get(color, color if color.startswith("#") else "#" + color)
    full = name if ":" in name else find_icon(name)
    if not full:
        log.warning("아이콘 없음: %s", name)
        return None
    prefix, icon = full.split(":", 1)
    r = requests.get(f"https://api.iconify.design/{prefix}/{icon}.svg", headers=UA,
                     timeout=15, params={"color": hexcolor, "height": size})
    r.raise_for_status()
    out.parent.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(bytestring=r.content, write_to=str(out),
                     output_width=size, output_height=size)
    log.info("아이콘 저장: %s (%s, %s)", out.name, full, hexcolor)
    return out


# ══════════════════════════════════════════════════════════
# 3. 지도 — GeoJSON → 인포그래픽 팔레트 플랫 지도 PNG
# ══════════════════════════════════════════════════════════

def _geo_cache(url: str, cache_name: str) -> dict:
    cache = common.ROOT_DIR / "assets" / "geo" / cache_name
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        r = requests.get(url, headers=UA, timeout=60)
        r.raise_for_status()
        cache.write_bytes(r.content)
    return json.loads(cache.read_text(encoding="utf-8"))


def _draw_polys(ax, geometry, **kw):
    from matplotlib.patches import Polygon as MplPolygon
    polys = (geometry["coordinates"] if geometry["type"] == "MultiPolygon"
             else [geometry["coordinates"]])
    for poly in polys:
        ax.add_patch(MplPolygon(poly[0], closed=True, **kw))


CODE_KO = {"KOR": "한국", "USA": "미국", "JPN": "일본", "CHN": "중국",
           "GBR": "영국", "FRA": "프랑스", "DEU": "독일"}


def flat_map(target: str, out: Path, highlight: list[str] | None = None,
             label: bool = True, config: dict | None = None,
             regional_zoom: bool = True) -> Path:
    """플랫 지도 PNG — 고정 고해상도 출력(업스케일 없이 그대로 사용) + 하이라이트 지역 확대.

    target: "world" (세계지도) 또는 ISO3 국가코드 ("KOR" 등 단일 국가 확대)
    highlight: 세계지도에서 포인트색으로 칠할 ISO3 코드 목록
    regional_zoom: world 지도에서 highlight 가 있으면 그 지역으로 확대해
                   "작은 점" 이 아니라 화면을 지배하는 포인트가 되게 한다
                   (design_reference §4 — 지도는 장식이 아니라 포인트).
    """
    import math
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    pal = _palette(config)
    highlight = [h.upper() for h in (highlight or [])]

    # 에이투지체 라벨 (본문 + 강조용 두 웨이트)
    font_reg = font_bold = None
    a2z_reg = common.ROOT_DIR / "assets" / "fonts" / "A2Z-4Regular.ttf"
    a2z_med = common.ROOT_DIR / "assets" / "fonts" / "A2Z-5Medium.ttf"
    if a2z_reg.exists():
        font_manager.fontManager.addfont(str(a2z_reg))
        font_reg = font_manager.FontProperties(fname=str(a2z_reg))
    if a2z_med.exists():
        font_manager.fontManager.addfont(str(a2z_med))
        font_bold = font_manager.FontProperties(fname=str(a2z_med))
    font_prop = font_reg

    # 고정 고해상도(dpi 200 = 3840x2160) — 렌더 단계에서 업스케일하지 않아도 되도록
    # 원본 자체를 충분히 크게 만든다. bbox_inches='tight' 는 매번 크기가 달라져
    # 저해상도로 저장되는 원인이었다.
    fig, ax = plt.subplots(figsize=(19.2, 10.8), dpi=200)
    fig.patch.set_facecolor(pal["card_bg"])
    ax.set_facecolor(pal["card_bg"])
    fig.subplots_adjust(left=0.02, right=0.98, top=0.97, bottom=0.03)

    def _pulse(cx: float, cy: float, color: str) -> None:
        """위치 강조용 동심원 마커 — 지도가 '포인트'로 읽히게."""
        for radius_pt, alpha in [(46, 0.12), (30, 0.24), (15, 0.9)]:
            ax.scatter([cx], [cy], s=radius_pt ** 2, color=color,
                       alpha=alpha, zorder=4, linewidths=0)

    if target.lower() == "world":
        geo = _geo_cache(GEO_WORLD, "world.geo.json")
        centroids = {}
        for feat in geo["features"]:
            code = feat.get("id", "")
            hl = code in highlight
            _draw_polys(ax, feat["geometry"],
                        facecolor=pal["point"] if hl else pal["surface"],
                        edgecolor=pal["card_bg"], linewidth=0.5, zorder=2 if hl else 1)
            if hl:
                xs, ys = [], []
                g = feat["geometry"]
                for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
                    for x, y in poly[0]:
                        xs.append(x); ys.append(y)
                centroids[code] = (sum(xs) / len(xs), sum(ys) / len(ys))

        zoomed = bool(centroids) and regional_zoom
        if zoomed:
            cx = sum(c[0] for c in centroids.values()) / len(centroids)
            cy = sum(c[1] for c in centroids.values()) / len(centroids)
            ax.set_xlim(cx - 22, cx + 22); ax.set_ylim(cy - 16, cy + 16)
        else:
            ax.set_xlim(-180, 180); ax.set_ylim(-60, 85)

        if label:
            for code, (cx2, cy2) in centroids.items():
                if zoomed:
                    _pulse(cx2, cy2, pal["point"])
                name = CODE_KO.get(code, code) if zoomed else code
                fontsize = 46 if zoomed else 22
                ax.annotate(name, (cx2, cy2), color=pal["text"], fontsize=fontsize,
                            fontproperties=font_bold or font_prop, ha="center",
                            va="top", zorder=5, xytext=(0, -(fontsize * 1.5)),
                            textcoords="offset points")
    elif target.upper() in ("KOR", "KOREA", "한국"):
        # 한국 전용 고해상 행정구역 (시·도 17개) — highlight 는 지역명 부분일치 ("서울" 등)
        geo = _geo_cache(GEO_KOREA, "korea_provinces.geo.json")
        xs, ys = [], []
        hl_names = highlight or []
        for feat in geo["features"]:
            name = feat["properties"].get("name", "")
            hl = any(h and h in name for h in hl_names)
            _draw_polys(ax, feat["geometry"],
                        facecolor=pal["point"] if hl else pal["surface"],
                        edgecolor=pal["card_bg"], linewidth=0.8, zorder=2 if hl else 1)
            g = feat["geometry"]
            for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
                for x, y in poly[0]:
                    xs.append(x); ys.append(y)
            if hl and label:
                gx, gy = [], []
                for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
                    for x, y in poly[0]:
                        gx.append(x); gy.append(y)
                ax.annotate(name.replace("특별시", "").replace("광역시", ""),
                            (sum(gx) / len(gx), sum(gy) / len(gy)),
                            color=pal["text"], fontsize=26, fontproperties=font_prop,
                            ha="center", zorder=3)
        pad_x = (max(xs) - min(xs)) * 0.08
        pad_y = (max(ys) - min(ys)) * 0.08
        ax.set_xlim(min(xs) - pad_x, max(xs) + pad_x)
        ax.set_ylim(min(ys) - pad_y, max(ys) + pad_y)
    else:
        code = target.upper()
        geo = _geo_cache(GEO_COUNTRY.format(code=code), f"{code}.geo.json")
        feat = geo["features"][0]
        _draw_polys(ax, feat["geometry"], facecolor=pal["surface"],
                    edgecolor=pal["highlight"], linewidth=2)
        xs, ys = [], []
        g = feat["geometry"]
        for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
            for x, y in poly[0]:
                xs.append(x); ys.append(y)
        pad_x = (max(xs) - min(xs)) * 0.15
        pad_y = (max(ys) - min(ys)) * 0.15
        ax.set_xlim(min(xs) - pad_x, max(xs) + pad_x)
        ax.set_ylim(min(ys) - pad_y, max(ys) + pad_y)
        if label:
            name = feat.get("properties", {}).get("name", code)
            ax.annotate(name, (0.05, 0.92), xycoords="axes fraction",
                        color=pal["text"], fontsize=44, fontproperties=font_prop)

    # 위경도 격자는 위도에 따라 가로가 눌리므로(Mercator 근사) 화면 중심 위도 기준으로
    # 종횡비를 보정한다 — 확대 시 나라 모양이 눌려 보이던 부분까지 함께 고친다.
    lat_center = sum(ax.get_ylim()) / 2
    ax.set_aspect(1 / max(0.35, math.cos(math.radians(lat_center))))
    ax.axis("off")
    out.parent.mkdir(parents=True, exist_ok=True)
    # bbox_inches='tight' 는 매번 다른(대개 훨씬 작은) 픽셀 크기로 저장되어 이후
    # 렌더 단계에서 업스케일 → 글자 뭉개짐/줌 떨림의 원인이었다. 고정 크기로 저장.
    fig.savefig(out, facecolor=pal["card_bg"])
    plt.close(fig)
    log.info("지도 저장: %s (%s, 하이라이트 %s, %s)", out.name, target, highlight or "-",
              "확대" if target.lower() == "world" and highlight and regional_zoom else "전체")
    return out


# ══════════════════════════════════════════════════════════
# 4. 그래프 카드 — 인포그래픽 팔레트, 고정 고해상도 (design_reference §2)
# ══════════════════════════════════════════════════════════

def _load_fonts(font_manager, keys=("light", "reg", "med")):
    names = {"light": "A2Z-3Light.ttf", "reg": "A2Z-4Regular.ttf", "med": "A2Z-5Medium.ttf",
             "thin": "A2Z-1Thin.ttf"}
    fonts: dict[str, object] = {}
    for key in keys:
        p = common.ROOT_DIR / "assets" / "fonts" / names[key]
        if p.exists():
            font_manager.fontManager.addfont(str(p))
            fonts[key] = font_manager.FontProperties(fname=str(p))
    return fonts


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _lighten(hex_color: str, amount: float = 0.15) -> str:
    r, g, b = _hex_to_rgb(hex_color)
    r = max(0, min(255, int(r + (255 - r) * amount)))
    g = max(0, min(255, int(g + (255 - g) * amount)))
    b = max(0, min(255, int(b + (255 - b) * amount)))
    return f"#{r:02x}{g:02x}{b:02x}"


def _shadow_fx(alpha: float = 0.22, offset: tuple[float, float] = (2.2, -2.2)):
    """평면 도형에 드롭섀도를 얹어 입체감을 준다(2026-07-21 디자인 정제
    피드백: 애프터이펙트 효과 말고 디자인 자체가 더 정제되길 원함).
    Rectangle/Polygon/Wedge 등 어떤 Patch 에도
    patch.set_path_effects(_shadow_fx()) 로 바로 물릴 수 있다."""
    import matplotlib.patheffects as pe
    return [pe.SimplePatchShadow(offset=offset, alpha=alpha, shadow_rgbFace="#1C2A38"),
            pe.Normal()]


def _track_display(text: str, amount: str = " ") -> str:
    """대형 타이틀용 자간 확보 — 글자 사이 얇은 공백을 끼워 흉내낸다.
    작은 본문 텍스트에는 쓰지 말 것."""
    return amount.join(text)


def _round_corners(im, radius_frac: float = 0.03):
    """PIL 합성 이미지(로고/사진 카드)의 네 모서리를 둥글게 마스킹."""
    from PIL import Image, ImageDraw

    w, h = im.size
    radius = int(min(w, h) * radius_frac)
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def _paste_with_shadow(canvas, im, pos: tuple[int, int], blur: int = 18,
                       alpha: int = 60, offset: tuple[int, int] = (0, 6)) -> None:
    """카드/사진/로고 아래 부드러운 블러 섀도를 깔아 입체감을 준다."""
    from PIL import Image, ImageFilter

    shadow_shape = Image.new("RGBA", im.size, (20, 26, 36, 255))
    shadow_shape.putalpha(im.split()[-1].point(lambda a: alpha if a > 0 else 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow.paste(shadow_shape, (pos[0] + offset[0], pos[1] + offset[1]), shadow_shape)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(im, pos)


def _radial_gradient(w: int, h: int, inner_hex: str, outer_hex: str,
                     cx: float = 0.5, cy: float = 0.42, radius: float = 0.95):
    """중심이 밝고 가장자리로 갈수록 짙어지는 방사형 그라디언트 배열
    (2026-07-22 "아이폰처럼 고급스럽게" 피드백) — 애플 발표 영상 특유의
    다크 스포트라이트 배경에 쓴다. 저해상도로 만들고 imshow 보간으로
    확대해야 밴딩 없이 부드럽다."""
    import numpy as np
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    xx = xx / w - cx
    yy = yy / h - cy
    d = np.sqrt(xx ** 2 + (yy * (w / h)) ** 2) / radius
    t = np.clip(d, 0, 1)[..., None]
    inner = np.array(_hex_to_rgb(inner_hex))
    outer = np.array(_hex_to_rgb(outer_hex))
    return (inner * (1 - t) + outer * t).astype("uint8")


def _add_canvas_premium(fig, inner: str = "#1C2740", outer: str = "#05070C"):
    """애플 발표 영상풍 다크 스포트라이트 배경 — 중앙이 밝고 가장자리로
    갈수록 짙어지는 방사형 그라디언트. icon_hero_card(dark=True) 전용."""
    bg = fig.add_axes((0, 0, 1, 1))
    bg.set_xlim(0, 1); bg.set_ylim(0, 1)
    bg.set_xticks([]); bg.set_yticks([])
    for sp in bg.spines.values():
        sp.set_visible(False)
    grad = _radial_gradient(192, 108, inner, outer)
    bg.imshow(grad, extent=(0, 1, 0, 1), aspect="auto", zorder=0, interpolation="bicubic")
    return bg


def _glow_behind(canvas, center: tuple[int, int], radius: int, color_hex: str,
                 alpha: int = 130, blur: int = 70) -> None:
    """아이콘 뒤에 컬러 글로우(부드러운 방사형 빛)를 깔아 '백라이트'
    프리미엄 느낌을 준다 — 애플 제품 스포트라이트 연출."""
    from PIL import Image, ImageDraw, ImageFilter

    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    r, g, b = _hex_to_rgb(color_hex)
    draw.ellipse((center[0] - radius, center[1] - radius,
                 center[0] + radius, center[1] + radius), fill=(r, g, b, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(glow)


def _track_latin(text: str, space: str = " ") -> str:
    """짧은 영문 약어(단독 라벨용, 2~5자, 예: "NOI", "IRR", "B1M")의 글자
    사이에 얇은 유니코드 공백을 넣어 트래킹한다 — 이미지 제작 가이드 §4
    "국영문 혼용" 규칙: 국문 글자 사이 시각적 밀도에 맞춰 영문 대문자
    약어가 단독으로(문장에 섞이지 않고) 쓰일 때만 적용한다. 문장 중간에
    섞인 영문(예: "필요 순영업이익(NOI)")에는 절대 적용하지 않는다 —
    문장 흐름이 끊겨 보인다.
    """
    return space.join(list(text))


def _add_canvas_grid(fig, pal: dict, nx: int = 16, ny: int = 9,
                     lw: float = 0.7, alpha: float = 0.4):
    """네이비 블루프린트 캔버스 전체에 얇은 격자선을 깐다 — 지도류 함수
    (map_pin_blueprint/map_data_markers) 전용 배경. §15 팔레트 교체로
    canvas_bg 자체가 밝은 색이 됐으므로, 이 함수는 반드시 별도 키인
    `blueprint_bg`(짙은 네이비)를 쓴다 — canvas_bg 를 썼다가 밝은 배경에
    밝은 텍스트가 얹혀 안 보이는 회귀가 실제로 있었다.
    """
    bg = fig.add_axes((0, 0, 1, 1))
    bg.set_facecolor(pal["blueprint_bg"])
    grid_color = _lighten(pal["blueprint_bg"], 0.22)
    for i in range(1, nx):
        bg.axvline(i / nx, color=grid_color, lw=lw, alpha=alpha, zorder=0)
    for j in range(1, ny):
        bg.axhline(j / ny, color=grid_color, lw=lw, alpha=alpha, zorder=0)
    bg.set_xlim(0, 1)
    bg.set_ylim(0, 1)
    bg.set_xticks([])
    bg.set_yticks([])
    for sp in bg.spines.values():
        sp.set_visible(False)
    return bg


def _add_canvas_light(fig, pal: dict):
    """라이트 오프화이트 캔버스 (design_reference.md §15) — 완전 무지 단색은
    "밋밋하다"는 피드백(§15-5)에 따라 아주 옅은 노이즈 텍스처를 얹는다 —
    확대해야 겨우 보이는 수준(격자처럼 눈에 띄는 무늬가 아니라 종이 질감에
    가까운 디테일). 콘텐츠는 이 위에 facecolor="none" 인 투명 축을 별도로
    얹어 그린다.
    """
    bg = fig.add_axes((0, 0, 1, 1))
    bg.set_facecolor(pal["canvas_bg"])
    bg.set_xlim(0, 1)
    bg.set_ylim(0, 1)
    bg.set_xticks([])
    bg.set_yticks([])
    for sp in bg.spines.values():
        sp.set_visible(False)
    return bg


def _add_subtle_texture(path: Path, amount: int = 4) -> None:
    """완전 무지 배경이 밋밋하다는 피드백 — 아주 옅은(±4/255) 랜덤 노이즈를
    얹어 종이 질감에 가까운 미세한 디테일을 준다. 격자·그레인처럼 눈에 띄는
    무늬가 아니라 확대해야 겨우 보이는 수준으로 절제한다.
    """
    from PIL import Image
    import numpy as np

    im = Image.open(path).convert("RGB")
    arr = np.asarray(im).astype(int)
    noise = np.random.randint(-amount, amount + 1, size=arr.shape[:2] + (1,))
    arr = np.clip(arr + noise, 0, 255).astype("uint8")
    Image.fromarray(arr).save(path)


def _rounded_top_bar(ax, x0: float, y0: float, width: float, height: float,
                     color: str, radius: float = 0.012, zorder: int = 2) -> None:
    """위쪽 모서리만 둥근 막대 — 레퍼런스 실측(세로 막대그래프)은 전체
    라운드가 아니라 상단만 둥글다. FancyBboxPatch 는 네 모서리를 동시에
    둥글리므로, 전체 라운드 패치 위에 아랫부분을 덮는 직각 사각형을 한 장
    더 올려 아래쪽 모서리를 가린다.
    """
    from matplotlib.patches import FancyBboxPatch, Rectangle
    if height <= 0:
        return
    box = FancyBboxPatch((x0, y0), width, height,
                         boxstyle=f"round,pad=0,rounding_size={radius}",
                         facecolor=color, edgecolor="none", zorder=zorder)
    ax.add_patch(box)
    if height > radius:
        ax.add_patch(Rectangle((x0, y0), width, height - radius,
                               facecolor=color, edgecolor="none", zorder=zorder + 0.1))


def _source_box(ax, pal, fonts, text: str, y: float = -0.16) -> None:
    """카드 맨 아래 출처 캡션 — 종이 위 뮤트 올리브그레이 텍스트, 박스 없음.

    y: axes-fraction 기준 위치. subplots_adjust 로 하단 여백을 둔 카드는
    음수로 여백 안에, 여백이 없는 카드(stat_card 등)는 0~0.1 사이 값을
    넘겨야 잘려나가지 않는다.
    """
    if not text:
        return
    ax.annotate(text, (0.5, y), xycoords="axes fraction", ha="center",
                color=pal["highlight"], fontsize=15, fontproperties=fonts.get("reg"))


def _place_icon(card_path: Path, icon_query: str, config: dict | None = None,
                color: str = "text", pos: tuple[float, float] = (0.06, 0.06),
                size_frac: float = 0.16) -> None:
    """카드에 개념 픽토그램을 합성한다 (design_reference.md §12-6) — "토지",
    "건물" 같은 대상이 언급될 땐 텍스트/막대만이 아니라 그에 맞는 아이콘이
    함께 있어야 자연스럽다는 피드백 반영. Iconify 검색 → 컬러 SVG → PNG →
    카드에 합성. 아이콘을 못 찾으면 조용히 건너뛴다(카드 자체는 그대로 유지).

    pos: 카드 크기 대비 좌상단 기준 배치 위치(가로, 세로 비율).
    """
    import tempfile
    from PIL import Image

    tmp = Path(tempfile.mktemp(suffix=".png"))
    try:
        result = icon_png(icon_query, tmp, color=color, size=512, config=config)
        if not result:
            return
        card = Image.open(card_path).convert("RGBA")
        icon = Image.open(result).convert("RGBA")
        side = int(card.width * size_frac)
        icon = icon.resize((side, side), Image.LANCZOS)
        x, y = int(card.width * pos[0]), int(card.height * pos[1])
        card.alpha_composite(icon, (x, y))
        card.convert("RGB").save(card_path)
    except Exception as e:
        log.warning("아이콘 합성 실패(%s) — 카드는 아이콘 없이 유지: %s", icon_query, e)
    finally:
        tmp.unlink(missing_ok=True)


def _place_isometric_icon(card_path: Path, config: dict | None = None, color: str = "point",
                          pos: tuple[float, float] = (0.06, 0.06), size_frac: float = 0.16,
                          floors: int = 5) -> None:
    """카드에 아이소메트릭 빌딩 아이콘을 합성한다 — Iconify 외부 픽토그램
    대신 팔레트와 완전히 일치하는 원본 아이콘을 쓰고 싶을 때 _place_icon()
    대신 사용(예: "건물/사물 아이콘 표현" 요청 — 병원/부동산처럼 건물이
    핵심 대상인 경우)."""
    import tempfile
    from PIL import Image

    tmp = Path(tempfile.mktemp(suffix=".png"))
    try:
        isometric_building_icon(tmp, config=config, color=color, floors=floors)
        card = Image.open(card_path).convert("RGBA")
        icon = Image.open(tmp).convert("RGBA")
        side = int(card.width * size_frac)
        icon = icon.resize((side, side), Image.LANCZOS)
        x, y = int(card.width * pos[0]), int(card.height * pos[1])
        _paste_with_shadow(card, icon, (x, y), blur=10, alpha=40, offset=(0, 3))
        card.convert("RGB").save(card_path)
    finally:
        tmp.unlink(missing_ok=True)


def isometric_building_icon(out: Path, config: dict | None = None, color: str = "point",
                            floors: int = 5, transparent: bool = True) -> Path:
    """아이소메트릭(등각투상) 빌딩/타워 아이콘 — 표준 제도 기법(2:1 등각
    격자)으로 직접 그린 3면 박스. Iconify 에서 검색해 오는 범용 아이콘
    (가늘고 검은 선 아이콘)이 카드 톤과 안 맞아 "이상하다"는 지적을 받은
    적이 있어, 팔레트 색을 그대로 쓰는 자체 아이콘으로 대체 가능하게
    만들었다. `_place_icon()` 자리에 이 함수로 만든 PNG를 대신 합성하면
    된다.

    등각 정육면체 원리: 윗면은 마름모(rhombus), 좌/우 측면은 평행사변형
    — 세 면에 명도 차(윗면 밝게, 우측면 기본색, 좌측면 어둡게)를 줘서
    입체감을 낸다. floors 만큼 우측면에 얇은 가로줄(창/층 구분)을 넣어
    "건물"임을 분명히 한다.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon

    pal = _palette(config)
    base_hex = pal.get(color, color if color.startswith("#") else "#" + color)
    top_hex = _lighten(base_hex, 0.45)
    left_hex = _lighten(base_hex, -0.30)

    fig = plt.figure(figsize=(6, 6), dpi=200)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(-1.1, 1.1)
    ax.set_ylim(-1.3, 1.1)
    ax.set_aspect("equal")
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    hw = 0.55       # 밑변 반폭
    k = 0.5         # 등각 비율(2:1)
    height = 1.7    # 건물 높이
    top_y = 0.35    # 지붕(마름모) 중심 y

    apex = (0, top_y + hw * k)
    right = (hw, top_y)
    front = (0, top_y - hw * k)
    left = (-hw, top_y)

    # 지붕
    ax.add_patch(Polygon([apex, right, front, left], closed=True,
                        facecolor=top_hex, edgecolor="none", zorder=3))
    # 우측면(정면 기준 밝은 쪽) — 기본색
    ax.add_patch(Polygon([front, right, (right[0], right[1] - height),
                         (front[0], front[1] - height)], closed=True,
                        facecolor=base_hex, edgecolor="none", zorder=2))
    # 좌측면(그늘) — 어두운 톤
    ax.add_patch(Polygon([front, left, (left[0], left[1] - height),
                         (front[0], front[1] - height)], closed=True,
                        facecolor=left_hex, edgecolor="none", zorder=2))

    # 우측면에 층 구분선(창) — 건물임을 분명히
    for i in range(1, floors):
        t = i / floors
        y0 = front[1] * (1 - t) + (front[1] - height) * t
        y1 = right[1] * (1 - t) + (right[1] - height) * t
        ax.plot([front[0], right[0]], [y0, y1], color=_lighten(base_hex, 0.25),
                lw=1.2, alpha=0.55, zorder=3)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, transparent=transparent)
    plt.close(fig)
    log.info("아이소메트릭 빌딩 아이콘 저장: %s", out.name)
    return out


def _add_grain(path: Path, amount: int = 9) -> None:
    """빈티지 에이지드 페이퍼 그레인 텍스처 (design_reference.md §12-1) —
    The B1M 카드 특유의 낡은 종이 질감. 미세한 랜덤 노이즈를 얹는다.
    """
    from PIL import Image
    import numpy as np

    im = Image.open(path).convert("RGB")
    arr = np.asarray(im).astype(int)
    noise = np.random.randint(-amount, amount + 1, size=arr.shape[:2] + (1,))
    arr = np.clip(arr + noise, 0, 255).astype("uint8")
    Image.fromarray(arr).save(path)


def bar_chart(categories: list[str], values: list[float], out: Path,
              title: str = "", subtitle: str = "", value_suffix: str = "",
              highlight_index: int | None = None, value_fmt: str = "{:.0f}",
              source: str = "", icon: str = "", config: dict | None = None) -> Path:
    """세로 막대 비교 카드 PNG (design_reference.md §12-7 갱신) — 격자
    블루프린트 캔버스 위에 막대가 별도 카드 없이 직접 서는 구도. 상단만
    둥근 막대, 막대 위 수치 라벨, 막대 아래 카테고리 라벨 — 실제 채널
    레퍼런스(세로 막대그래프 스크린샷) 실측 비율 반영: 폰트는 크게
    부풀리지 않고, 막대 폭 대비 간격도 실측 비율을 따른다.

    icon: 주제를 나타내는 픽토그램 검색어(예: "office building", "land
    plot") — 막대가 닿지 않는 우상단 여백에 배치.

    렌더 단계에서 업스케일하지 않도록 dpi 200 으로 고정 저장한다.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)

    if highlight_index is None:
        highlight_index = len(values) - 1

    n = len(values)
    vmax = max(values)

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_light(fig, pal)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    # 막대 레이아웃 — 실측 레퍼런스 비율(막대 폭 : 간격 ≈ 1.8 : 1), 바닥선에서
    # 위로 자란다. 폰트는 카드 전체를 지배하지 않는 절제된 크기로 고정.
    baseline = 0.15
    top_max = 0.70
    content_w = 0.66
    content_x0 = 0.17
    bar_w = content_w / (1.55 * n + 0.55)
    bar_w *= 0.75  # 막대가 투박하다는 피드백 — 폭을 조금 더 얄상하게
    gap = (content_w - bar_w * n) / (n + 1)
    x = content_x0 + gap

    ax.axhline(baseline, color=_lighten(pal["text"], 0.75), lw=1.3, zorder=1)

    for i, v in enumerate(values):
        hl = i == highlight_index
        color = pal["surface"] if hl else pal["point"]
        h = (v / vmax) * (top_max - baseline)
        _rounded_top_bar(ax, x, baseline, bar_w, h, color,
                         radius=min(bar_w * 0.3, 0.018), zorder=2)
        ax.annotate(value_fmt.format(v) + value_suffix, (x + bar_w / 2, baseline + h + 0.022),
                    ha="center", va="bottom", color=color,
                    fontsize=25 if hl else 21,
                    fontproperties=fonts.get("med"), zorder=4)
        ax.annotate(categories[i], (x + bar_w / 2, baseline - 0.03),
                    ha="center", va="top", color=pal["text"],
                    fontsize=19, fontproperties=fonts.get("med"), zorder=4)
        x += bar_w + gap

    if title:
        ax.annotate(title, (0.06, 0.90), ha="left", va="top",
                    color=pal["text"], fontsize=28, fontproperties=fonts.get("med"))
    if subtitle:
        ax.annotate(subtitle, (0.06, 0.845), ha="left", va="top",
                    color=pal["highlight"], fontsize=16, fontproperties=fonts.get("light"))
    _source_box(ax, pal, fonts, source, y=0.045)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    if icon:
        # 막대는 바닥선 위로만 자라므로 우상단 여백은 항상 비어 있다 —
        # 이전엔 카드 안쪽 좌표를 따로 계산해야 했지만 이제 카드=캔버스
        # 전체라 pos 가 곧 이미지 전체 기준 비율이라 계산이 단순해졌다.
        _place_icon(out, icon, config, color="point", pos=(0.83, 0.06), size_frac=0.09)
    _add_subtle_texture(out)
    log.info("그래프 저장: %s (강조 index=%d)", out.name, highlight_index)
    return out


def percent_bar(percent: float, out: Path, title: str = "", subtitle: str = "",
                 label_filled: str = "", label_rest: str = "", source: str = "",
                 config: dict | None = None) -> Path:
    """비율(%) 막대 카드 — 격자 블루프린트 캔버스에 캡슐형 막대가 직접
    놓이는 구도(design_reference.md §12-7 갱신, 별도 페이퍼 카드 없음).
    §8-5 "비율은 도식화 우선" 원칙에 따른 단일 퍼센트 시각화
    (예: 매수가가 감정가의 85% 라면 85:15).
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    from matplotlib.patches import FancyBboxPatch

    pal = _palette(config)
    fonts = _load_fonts(font_manager)
    pct = max(0.0, min(100.0, percent))

    fig = plt.figure(figsize=(16, 6), dpi=200)
    _add_canvas_light(fig, pal)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    bar_h = 0.16
    bar_x0, bar_w = 0.08, 0.84
    y0 = 0.40
    r = bar_h * 0.14
    track = FancyBboxPatch((bar_x0, y0), bar_w, bar_h, boxstyle=f"round,pad=0,rounding_size={r}",
                           facecolor=pal["text"], edgecolor="none", zorder=1, alpha=0.12)
    ax.add_patch(track)
    fill_w = bar_w * pct / 100
    if fill_w > 0:
        fill = FancyBboxPatch((bar_x0, y0), fill_w, bar_h,
                              boxstyle=f"round,pad=0,rounding_size={r}",
                              facecolor=pal["point"], edgecolor="none", zorder=2)
        ax.add_patch(fill)

    ha, tx = ("right", min(bar_x0 + fill_w, bar_x0 + bar_w - 0.02)) if pct > 90 else \
             ("center", bar_x0 + fill_w)
    ax.annotate(f"{pct:.0f}%", (tx, y0 + bar_h + 0.05), ha=ha, va="bottom",
                color=pal["point"], fontsize=27, fontproperties=fonts.get("med"), zorder=3)

    if title:
        ax.annotate(title, (0.08, 0.86), ha="left", va="top",
                    color=pal["text"], fontsize=28, fontproperties=fonts.get("med"))
    if subtitle:
        ax.annotate(subtitle, (0.08, 0.79), ha="left", va="top",
                    color=pal["highlight"], fontsize=16, fontproperties=fonts.get("light"))
    if label_filled:
        ax.annotate(label_filled, (bar_x0, y0 - 0.06), ha="left", va="top",
                    color=pal["point"], fontsize=17, fontproperties=fonts.get("reg"))
    if label_rest:
        ax.annotate(label_rest, (bar_x0 + bar_w, y0 - 0.06), ha="right", va="top",
                    color=pal["highlight"], fontsize=17, fontproperties=fonts.get("reg"))
    _source_box(ax, pal, fonts, source, y=0.06)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    _add_subtle_texture(out)
    log.info("퍼센트 막대 저장: %s (%.0f%%)", out.name, pct)
    return out


def stat_card(value: str, out: Path, label: str = "", subtext: str = "",
              value2: str = "", label2: str = "", arrow: bool = False,
              source: str = "", icon: str = "", icon_building: bool = False,
              config: dict | None = None) -> Path:
    """빅넘버 스탯 카드 — The B1M 스타일 (design_reference.md §12). 네이비
    블루프린트 캔버스 위 빈티지 페이퍼 카드, 핵심 숫자는 브릭 레드
    (건물 높이 라벨 문법과 동일), 라벨/캡션은 다크 차콜·올리브그레이.
    화살표로 연결된 두 번째 수치(예: "캡레이트 4%" → "필요 NOI 52억")도 지원 —
    입력값은 블루, 결과값만 레드로 강조.

    icon: 주제 픽토그램 검색어 — 숫자만 덩그러니 있으면 어색하다는 피드백
    (§12-6)에 따라 카드 좌상단에 개념 아이콘을 함께 넣는다.
    icon_building: True 면 Iconify 검색 대신 원본 아이소메트릭 빌딩
    아이콘(isometric_building_icon)을 쓴다 — 병원/부동산처럼 "건물"이
    핵심 대상이면서 팔레트와 완전히 일치하는 톤이 필요할 때.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyBboxPatch
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_light(fig, pal)
    ax = fig.add_axes((0.06, 0.06, 0.88, 0.88))
    ax.set_facecolor(pal["card_bg"])
    # 주의: ax.axis('off') 는 틱/스파인뿐 아니라 축 patch(카드 배경색)까지
    # 지워버려 배경만 남는 버그가 있었다 — 틱/스파인만 개별로 끔.
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    two = bool(value2)
    cx1 = 0.30 if two else 0.5

    def _accent_rule(cx: float, color: str) -> None:
        # 큰 숫자 바로 아래 짧은 둥근 액센트 바 — 숫자와 서브텍스트 사이
        # 시각적 구획을 주는 디테일(2026-07-22 디자인 정제 피드백).
        w, h = 0.05, 0.008
        ax.add_patch(FancyBboxPatch((cx - w / 2, 0.365), w, h,
                                    boxstyle=f"round,pad=0,rounding_size={h/2}",
                                    facecolor=color, edgecolor="none", zorder=4))

    if label:
        ax.annotate(label, (cx1, 0.66), xycoords="axes fraction",
                    ha="center", color=pal["text"], fontsize=26, fontproperties=fonts.get("reg"))
    value_txt = ax.annotate(_track_display(value), (cx1, 0.46), xycoords="axes fraction",
                            ha="center", va="center", color=pal["point"],
                            fontsize=80 if not two else 60, fontproperties=fonts.get("med"))
    value_txt.set_path_effects(_shadow_fx(alpha=0.14, offset=(1.6, -1.6)))
    if not (icon_building or icon):
        # 아이콘이 이 자리(값-서브텍스트 사이 여백)를 이미 쓰고 있으면
        # 액센트 바를 겹쳐 그리지 않는다 — 실제로 겹쳐서 깨져 보였다.
        _accent_rule(cx1, pal["point"])
    if subtext:
        ax.annotate(subtext, (cx1, 0.26), xycoords="axes fraction", ha="center",
                    color=pal["highlight"], fontsize=24, fontproperties=fonts.get("reg"))

    if two:
        if arrow:
            ax.annotate("", xy=(0.62, 0.46), xytext=(0.42, 0.46),
                        xycoords="axes fraction", textcoords="axes fraction",
                        arrowprops=dict(arrowstyle="-|>", color=pal["highlight"],
                                        lw=2.5, mutation_scale=30))
        cx2 = 0.78
        if label2:
            ax.annotate(label2, (cx2, 0.66), xycoords="axes fraction",
                        ha="center", color=pal["text"], fontsize=26, fontproperties=fonts.get("reg"))
        value2_txt = ax.annotate(_track_display(value2), (cx2, 0.46), xycoords="axes fraction",
                                 ha="center", va="center", color=pal["surface"], fontsize=60,
                                 fontproperties=fonts.get("med"))
        value2_txt.set_path_effects(_shadow_fx(alpha=0.14, offset=(1.6, -1.6)))
        _accent_rule(cx2, pal["surface"])

    _source_box(ax, pal, fonts, source, y=0.06)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    if icon_building or icon:
        # 아이콘은 값(0.46)과 서브텍스트(0.26) 사이 여백에 둔다 — 라벨/서브텍스트
        # 유무와 무관하게 항상 비어 있는 공간이라, 자막 캡션 박스(하단)나
        # 서브텍스트 줄과 겹치는 회귀가 없다. side 는 카드 "폭" 기준 비율이라
        # 16:9 카드에서 세로 크기로 환산하면 side*(16/9)로 더 커지므로 실측 보정.
        side = 0.05
        icon_h = side * (16 / 9)
        icon_center_ax = (0.46 + 0.26) / 2
        icon_center_pil = 0.94 - 0.88 * icon_center_ax
        pos = (cx1 - side / 2, icon_center_pil - icon_h / 2)
        if icon_building:
            _place_isometric_icon(out, config, color="point", pos=pos, size_frac=side)
        else:
            _place_icon(out, icon, config, color="point", pos=pos, size_frac=side)
    _add_subtle_texture(out)
    log.info("스탯 카드 저장: %s (%s%s)", out.name, value, f" → {value2}" if two else "")
    return out


# ══════════════════════════════════════════════════════════
# 4. 출처 인용 애니메이션 클립 — 기사 화면 + 하이라이트 강조
# ══════════════════════════════════════════════════════════

def _wrap_text(draw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=font) <= max_width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _ease_out_cubic(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def render_source_citation(headline: str, quote: str, out: Path,
                           tag: str = "출처 기사", body_lines: int = 3,
                           config: dict | None = None, width: int = 1920,
                           height: int = 1080, fps: int = 30,
                           duration: float = 3.0, highlight_sec: float = 0.7) -> Path:
    """출처 기사 인용 애니메이션 클립(mp4) — "출처를 그냥 텍스트 캡션으로만
    올리지 말고 기사 화면에 약간의 애니메이션(하이라이트 강조)을 써서
    보여달라"는 피드백 반영. 실제 기사 스크린샷이 없으므로 브라우저/문서
    형태를 도식화한 카드를 그려 재현한다 — 실제 화면이 아님을 카드 안에
    작게 명시(레퍼런스 채널도 예시 그래프에 "FOR ILLUSTRATIVE PURPOSES
    ONLY" 를 작게 표기하는 관례를 따름).

    headline: 기사 제목(1~2줄로 자동 줄바꿈)
    quote: 강조해서 보여줄 한 줄(예: "평당 4억 5천만원") — 애니메이션으로
    하이라이트 박스가 뒤에서 자라나며 강조된다.
    body_lines: quote 외에 채워 넣을 회색 더미 본문 줄 수(문서 느낌용).

    프레임을 PIL 로 직접 그려(그래프용 matplotlib 대신 — 텍스트/도형 위주라
    더 빠르고 애니메이션 프레임 반복에 유리) ffmpeg 로 인코딩한다.
    """
    import shutil
    import subprocess
    import tempfile

    from PIL import Image, ImageDraw, ImageFont

    pal = _palette(config)
    font_dir = common.ROOT_DIR / "assets" / "fonts"
    f_head = ImageFont.truetype(str(font_dir / "A2Z-5Medium.ttf"), int(height * 0.042))
    f_quote = ImageFont.truetype(str(font_dir / "A2Z-4Regular.ttf"), int(height * 0.032))
    f_tag = ImageFont.truetype(str(font_dir / "A2Z-5Medium.ttf"), int(height * 0.02))
    f_cap = ImageFont.truetype(str(font_dir / "A2Z-3Light.ttf"), int(height * 0.014))

    zoom_max = 1.05
    bw, bh = int(width * zoom_max), int(height * zoom_max)

    # ── 배경(격자 블루프린트 캔버스) ──
    base = Image.new("RGB", (bw, bh), pal["canvas_bg"])
    bd = ImageDraw.Draw(base)
    grid_color = _lighten(pal["canvas_bg"], 0.22)
    nx, ny = 16, 9
    for i in range(1, nx):
        x = int(bw * i / nx)
        bd.line([(x, 0), (x, bh)], fill=grid_color, width=1)
    for j in range(1, ny):
        y = int(bh * j / ny)
        bd.line([(0, y), (bw, y)], fill=grid_color, width=1)

    # ── 기사 카드(문서/브라우저 도식) ──
    card_w, card_h = int(bw * 0.58), int(bh * 0.58)
    card_x0, card_y0 = (bw - card_w) // 2, (bh - card_h) // 2
    card_x1, card_y1 = card_x0 + card_w, card_y0 + card_h
    shadow = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((card_x0 + 10, card_y0 + 14, card_x1 + 10, card_y1 + 14),
                        radius=int(card_h * 0.03), fill=(0, 0, 0, 90))
    base = Image.alpha_composite(base.convert("RGBA"), shadow)
    bd = ImageDraw.Draw(base)
    bd.rounded_rectangle((card_x0, card_y0, card_x1, card_y1),
                        radius=int(card_h * 0.03), fill=pal["card_bg"])

    # 브라우저 크롬 바(상단) — 신호점 3개 + URL 필 플레이스홀더 (카드와 같은
    # 종이색 위에 구분선만 그어 상단 라운드 모서리를 그대로 살린다)
    chrome_h = int(card_h * 0.10)
    bd.line([(card_x0, card_y0 + chrome_h), (card_x1, card_y0 + chrome_h)],
           fill=_lighten(pal["text"], 0.7), width=1)
    dot_r = int(chrome_h * 0.14)
    dot_cy = card_y0 + chrome_h // 2
    for k, dc in enumerate([pal["point"], pal["highlight"], pal["surface"]]):
        dot_cx = card_x0 + int(card_w * 0.035) + k * dot_r * 3
        bd.ellipse((dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r), fill=dc)
    pill_x0 = card_x0 + int(card_w * 0.20)
    pill_x1 = card_x0 + int(card_w * 0.62)
    pill_h = int(chrome_h * 0.42)
    bd.rounded_rectangle((pill_x0, dot_cy - pill_h // 2, pill_x1, dot_cy + pill_h // 2),
                        radius=pill_h // 2, fill=_lighten(pal["text"], 0.82))

    # 작은 출처 태그 배지(캔버스 위, 카드 좌상단 바깥)
    tag_pad_x, tag_pad_y = int(width * 0.012), int(height * 0.01)
    tag_w = int(bd.textlength(tag, font=f_tag)) + tag_pad_x * 2
    tag_h = int(height * 0.045)
    tag_x0, tag_y0 = card_x0, card_y0 - tag_h - int(height * 0.018)
    bd.rounded_rectangle((tag_x0, tag_y0, tag_x0 + tag_w, tag_y0 + tag_h),
                        radius=tag_h // 2, fill=pal["point"])
    bd.text((tag_x0 + tag_pad_x, tag_y0 + tag_h // 2), tag, font=f_tag,
           fill=pal["canvas_text"], anchor="lm")

    # 헤드라인
    content_x0 = card_x0 + int(card_w * 0.07)
    content_x1 = card_x1 - int(card_w * 0.07)
    max_text_w = content_x1 - content_x0
    head_lines = _wrap_text(bd, headline, f_head, max_text_w)[:2]
    y = card_y0 + chrome_h + int(card_h * 0.09)
    line_gap = int(f_head.size * 1.28)
    for ln in head_lines:
        bd.text((content_x0, y), ln, font=f_head, fill=pal["text"])
        y += line_gap

    # 더미 본문 줄(회색 바) + 인용 줄(실제 텍스트) 위치 계산
    y += int(card_h * 0.03)
    body_gap = int(card_h * 0.085)
    dummy_widths = [0.92, 0.78, 0.85]
    quote_box = None
    quote_line_index = min(1, body_lines - 1) if body_lines > 0 else 0
    for i in range(body_lines):
        if i == quote_line_index:
            quote_box = (content_x0, y - int(card_h * 0.018),
                        content_x0 + int(bd.textlength(quote, font=f_quote)) + int(card_w * 0.03),
                        y + int(f_quote.size * 1.15))
        else:
            frac = dummy_widths[i % len(dummy_widths)]
            bar_h = int(f_quote.size * 0.62)
            bd.rounded_rectangle((content_x0, y, content_x0 + int(max_text_w * frac), y + bar_h),
                                radius=bar_h // 2, fill=_lighten(pal["text"], 0.72))
        y += body_gap

    # 하단 캡션(예시 이미지 안내 — 레퍼런스 채널의 "FOR ILLUSTRATIVE PURPOSES
    # ONLY" 관례와 동일한 취지)
    bd.text((card_x1 - int(card_w * 0.03), card_y1 - int(card_h * 0.045)),
           "예시 이미지 · 실제 화면 아님", font=f_cap, fill=_lighten(pal["text"], 0.5), anchor="rm")

    background_img = base  # 인용 텍스트 없이(하이라이트가 뒤에 깔릴 것이므로)

    quote_layer = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ql = ImageDraw.Draw(quote_layer)
    if quote_box:
        qx0, qy0, qx1, qy1 = quote_box
        ql.text((qx0 + int(card_w * 0.015), qy0 + (qy1 - qy0) // 2), quote,
               font=f_quote, fill=pal["text"], anchor="lm")

    total_frames = max(int(round(duration * fps)), 2)
    hl_frames = max(int(round(highlight_sec * fps)), 1)

    tmp_dir = Path(tempfile.mkdtemp(prefix="citation_"))
    try:
        for i in range(total_frames):
            t = i / (total_frames - 1)
            frame = background_img.convert("RGBA").copy()
            if quote_box:
                p = _ease_out_cubic(min(i / hl_frames, 1.0))
                qx0, qy0, qx1, qy1 = quote_box
                cur_x1 = qx0 + (qx1 - qx0) * p
                hl_layer = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
                hd = ImageDraw.Draw(hl_layer)
                hr, hg, hb = _hex_to_rgb(pal["point"])
                hd.rounded_rectangle((qx0, qy0, cur_x1, qy1), radius=(qy1 - qy0) * 0.25,
                                    fill=(hr, hg, hb, 70))
                frame = Image.alpha_composite(frame, hl_layer)
            frame = Image.alpha_composite(frame, quote_layer)

            zoom = 1 + (zoom_max - 1) * t
            cw, ch = bw / zoom, bh / zoom
            cx, cy = (bw - cw) / 2, (bh - ch) / 2
            frame = frame.convert("RGB").crop((int(cx), int(cy), int(cx + cw), int(cy + ch)))
            frame = frame.resize((width, height), Image.LANCZOS)
            frame.save(tmp_dir / f"f{i:05d}.png")

        out.parent.mkdir(parents=True, exist_ok=True)
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps),
              "-i", str(tmp_dir / "f%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
              "-crf", "18", str(out)]
        subprocess.run(cmd, check=True)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    log.info("출처 인용 클립 저장: %s (%.1fs, %d프레임)", out.name, duration, total_frames)
    return out


def render_source_capture(image_path: Path, out: Path, tag: str = "출처 기사",
                          highlight_box: tuple[float, float, float, float] | None = None,
                          source_caption: str = "", config: dict | None = None,
                          width: int = 1920, height: int = 1080, fps: int = 30,
                          duration: float = 2.6) -> Path:
    """실제 기사 캡쳐 이미지 1장을 받아 보여주는 애니메이션 클립 — 이미지
    제작 가이드 §1 의 두 변형을 하나의 함수로 제공한다.

    - highlight_box 를 안 주면 **변형 A "줌"**: 캡쳐 이미지 전체에 은은한
      Ken Burns 줌만 적용. 캡쳐 자체가 이미 핵심을 보여줄 때(제목 기사,
      표 전체 등) 사용.
    - highlight_box=(x0,y0,x1,y1)(원본 이미지 기준 0~1 비율)를 주면
      **변형 B "하이라이트"**: 줌 + 지정 영역 위로 하이라이트 박스가
      자라나는 애니메이션. 캡쳐 중 특정 문장/숫자 한 곳을 짚어줘야 할 때
      사용(예: 가격 부분, 헤드라인 핵심 문구).

    두 변형 모두 네이비 격자 캔버스 위 페이퍼 테두리 카드에 캡쳐 이미지를
    "contain" 방식(잘리지 않게 비율 유지)으로 앉힌다 — 실제 캡쳐를
    자르면 문맥이 잘려 오해를 부를 수 있어 항상 전체를 보여준다.
    """
    import shutil
    import subprocess
    import tempfile

    from PIL import Image, ImageDraw, ImageFont

    pal = _palette(config)
    font_dir = common.ROOT_DIR / "assets" / "fonts"
    f_tag = ImageFont.truetype(str(font_dir / "A2Z-5Medium.ttf"), int(height * 0.02))
    f_cap = ImageFont.truetype(str(font_dir / "A2Z-3Light.ttf"), int(height * 0.016))

    zoom_max = 1.06
    bw, bh = int(width * zoom_max), int(height * zoom_max)

    base = Image.new("RGB", (bw, bh), pal["canvas_bg"])
    bd = ImageDraw.Draw(base)
    grid_color = _lighten(pal["canvas_bg"], 0.22)
    for i in range(1, 16):
        x = int(bw * i / 16)
        bd.line([(x, 0), (x, bh)], fill=grid_color, width=1)
    for j in range(1, 9):
        y = int(bh * j / 9)
        bd.line([(0, y), (bw, y)], fill=grid_color, width=1)

    card_w, card_h = int(bw * 0.62), int(bh * 0.62)
    card_x0, card_y0 = (bw - card_w) // 2, (bh - card_h) // 2
    card_x1, card_y1 = card_x0 + card_w, card_y0 + card_h

    shadow = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((card_x0 + 10, card_y0 + 14, card_x1 + 10, card_y1 + 14),
                        radius=int(card_h * 0.025), fill=(0, 0, 0, 90))
    base = Image.alpha_composite(base.convert("RGBA"), shadow).convert("RGB")
    bd = ImageDraw.Draw(base)
    pad = int(card_h * 0.035)
    bd.rounded_rectangle((card_x0, card_y0, card_x1, card_y1),
                        radius=int(card_h * 0.025), fill=pal["card_bg"])

    # 캡쳐 이미지를 카드 안쪽에 "contain" 배치(잘림 없음)
    cap = Image.open(image_path).convert("RGB")
    inner_w, inner_h = card_w - pad * 2, card_h - pad * 2
    scale = min(inner_w / cap.width, inner_h / cap.height)
    disp_w, disp_h = int(cap.width * scale), int(cap.height * scale)
    cap_resized = cap.resize((disp_w, disp_h), Image.LANCZOS)
    img_x0 = card_x0 + pad + (inner_w - disp_w) // 2
    img_y0 = card_y0 + pad + (inner_h - disp_h) // 2
    base.paste(cap_resized, (img_x0, img_y0))

    # 태그 배지
    tag_pad_x = int(width * 0.012)
    tag_w = int(bd.textlength(tag, font=f_tag)) + tag_pad_x * 2
    tag_h = int(height * 0.045)
    tag_x0, tag_y0 = card_x0, card_y0 - tag_h - int(height * 0.018)
    bd.rounded_rectangle((tag_x0, tag_y0, tag_x0 + tag_w, tag_y0 + tag_h),
                        radius=tag_h // 2, fill=pal["point"])
    bd.text((tag_x0 + tag_pad_x, tag_y0 + tag_h // 2), tag, font=f_tag,
           fill=pal["canvas_text"], anchor="lm")
    if source_caption:
        bd.text((card_x1, card_y1 + int(height * 0.028)), source_caption, font=f_cap,
               fill=_lighten(pal["canvas_bg"], 0.55), anchor="ra")

    background_img = base

    # 하이라이트 박스(변형 B) — 원본 이미지 비율 좌표를 표시 좌표로 환산
    hl_box_px = None
    if highlight_box:
        hx0, hy0, hx1, hy1 = highlight_box
        hl_box_px = (img_x0 + hx0 * disp_w, img_y0 + hy0 * disp_h,
                    img_x0 + hx1 * disp_w, img_y0 + hy1 * disp_h)

    total_frames = max(int(round(duration * fps)), 2)
    hl_frames = max(int(round(0.6 * fps)), 1)

    tmp_dir = Path(tempfile.mkdtemp(prefix="capture_"))
    try:
        for i in range(total_frames):
            t = i / (total_frames - 1)
            frame = background_img.convert("RGBA").copy()
            if hl_box_px:
                p = _ease_out_cubic(min(i / hl_frames, 1.0))
                qx0, qy0, qx1, qy1 = hl_box_px
                cur_x1 = qx0 + (qx1 - qx0) * p
                hl_layer = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
                hd = ImageDraw.Draw(hl_layer)
                hr, hg, hb = _hex_to_rgb(pal["point"])
                hd.rounded_rectangle((qx0, qy0, cur_x1, qy1), radius=(qy1 - qy0) * 0.12,
                                    outline=(hr, hg, hb, 235), width=max(int(height * 0.005), 2))
                frame = Image.alpha_composite(frame, hl_layer)

            zoom = 1 + (zoom_max - 1) * t
            cw, ch = bw / zoom, bh / zoom
            cx, cy = (bw - cw) / 2, (bh - ch) / 2
            frame = frame.convert("RGB").crop((int(cx), int(cy), int(cx + cw), int(cy + ch)))
            frame = frame.resize((width, height), Image.LANCZOS)
            frame.save(tmp_dir / f"f{i:05d}.png")

        out.parent.mkdir(parents=True, exist_ok=True)
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps),
              "-i", str(tmp_dir / "f%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
              "-crf", "18", str(out)]
        subprocess.run(cmd, check=True)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    variant = "하이라이트" if highlight_box else "줌"
    log.info("기사 캡쳐 클립 저장: %s (변형=%s, %.1fs)", out.name, variant, duration)
    return out


# ══════════════════════════════════════════════════════════
# 5. 지도 — 3가지 톤앤매너 (이미지 제작 가이드 §2)
# ══════════════════════════════════════════════════════════

def map_pin_blueprint(label: str, out: Path, sublabel: str = "",
                      config: dict | None = None) -> Path:
    """지도 톤앤매너 B: "블루프린트 핀"— 실제 지리 데이터 없이, 네이비 격자
    캔버스 위에 도식화한 街(가구/블록) 선과 펄스 핀 마커만으로 "정확히
    이 지점" 을 가리킨다. flat_map()(톤앤매너 A, 국가·지역 실루엣)보다
    스케일이 작은 대상(건물·필지 단위)에 적합 — 실제 지도 데이터가
    없어도(또는 필요 이상으로 정밀하지 않아도) 빠르게 만들 수 있다.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_grid(fig, pal)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    # 도식화된 街 블록(사실적 지도가 아니라 "도면" 느낌) — 얇은 크림색 선
    block_color = _lighten(pal["blueprint_bg"], 0.4)
    for i in range(3):
        y = 0.30 + i * 0.22
        ax.plot([0.2, 0.8], [y, y], color=block_color, lw=1.4, alpha=0.7, zorder=1)
    for i in range(4):
        x = 0.25 + i * 0.18
        ax.plot([x, x], [0.18, 0.82], color=block_color, lw=1.4, alpha=0.7, zorder=1)

    cx, cy = 0.5, 0.52
    for radius_pt, alpha in [(70, 0.10), (46, 0.22), (22, 0.9)]:
        ax.scatter([cx], [cy], s=radius_pt ** 2, color=pal["point"], alpha=alpha,
                  zorder=3, linewidths=0)
    ax.scatter([cx], [cy], s=22 ** 2 * 0.28, color=pal["blueprint_bg"], zorder=4, linewidths=0)

    ax.annotate(label, (cx, cy - 0.14), ha="center", va="top",
                color=pal["blueprint_text"], fontsize=30, fontproperties=fonts.get("med"), zorder=5)
    if sublabel:
        ax.annotate(sublabel, (cx, cy - 0.19), ha="center", va="top",
                    color=pal["blueprint_text"], fontsize=17, fontproperties=fonts.get("light"),
                    alpha=0.75, zorder=5)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["blueprint_bg"])
    plt.close(fig)
    _add_grain(out)
    log.info("블루프린트 핀 지도 저장: %s (%s)", out.name, label)
    return out


def map_data_markers(points: list[dict], out: Path, title: str = "", subtitle: str = "",
                     source: str = "", config: dict | None = None) -> Path:
    """지도 톤앤매너 D: "지도 위 데이터 시각화" — 지도(또는 도식화한 블록
    배치) 위 여러 지점에서 값에 비례한 막대가 위로 솟아오르는 구도. 여러
    지역/지점의 수치를 한 화면에서 비교하면서 동시에 "어디에 있는지"도
    보여줘야 할 때 flat_map(지역 하이라이트만)이나 stat_card(위치 정보
    없음)보다 적합 — 지도(map_pin_blueprint 의 블루프린트 톤)와 그래프
    (lollipop_chart 의 선+점 문법)를 합친 네 번째 지도 유형.

    points: [{"x": 0~1, "y": 0~1, "value": float, "label": str}, ...]
    x/y 는 캔버스 기준 위치 비율(좌상단이 0,0).
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)
    vmax = max(p["value"] for p in points) or 1

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_grid(fig, pal)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    # 도식화된 街 블록(map_pin_blueprint 와 동일한 "도면" 느낌) — 지점들이
    # 실제 지도 위가 아니라 추상 배치 위에 있어도 위치 정보로 읽히게 한다.
    block_color = _lighten(pal["blueprint_bg"], 0.35)
    for i in range(4):
        yy = 0.16 + i * 0.22
        ax.plot([0.08, 0.92], [yy, yy], color=block_color, lw=1.1, alpha=0.6, zorder=0)
    for i in range(6):
        xx = 0.12 + i * 0.152
        ax.plot([xx, xx], [0.10, 0.86], color=block_color, lw=1.1, alpha=0.6, zorder=0)

    max_bar_h = 0.30
    for p in points:
        px, py, val = p["x"], 1 - p["y"], p["value"]
        h = max_bar_h * (val / vmax)
        ax.plot([px, px], [py, py + h], color=pal["point"], lw=6,
               solid_capstyle="round", zorder=2)
        ax.scatter([px], [py], s=90, color=pal["blueprint_text"], zorder=3,
                  edgecolors=pal["point"], linewidths=2)
        ax.annotate(f"{val:.0f}", (px, py + h + 0.035), ha="center", va="bottom",
                    color=pal["point"], fontsize=20, fontproperties=fonts.get("med"), zorder=4)
        ax.annotate(p.get("label", ""), (px, py - 0.03), ha="center", va="top",
                    color=pal["blueprint_text"], fontsize=15, fontproperties=fonts.get("reg"), zorder=4)

    if title:
        ax.annotate(title, (0.06, 0.94), ha="left", va="top",
                    color=pal["blueprint_text"], fontsize=28, fontproperties=fonts.get("med"))
    if subtitle:
        ax.annotate(subtitle, (0.06, 0.895), ha="left", va="top",
                    color=pal["blueprint_text"], fontsize=16, fontproperties=fonts.get("light"), alpha=0.75)
    _source_box(ax, pal, fonts, source, y=0.03)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["blueprint_bg"])
    plt.close(fig)
    _add_grain(out)
    log.info("지도 데이터 마커 저장: %s (%d개 지점)", out.name, len(points))
    return out


def map_aerial_highlight(photo_path: Path, out: Path, label: str = "",
                         box_frac: tuple[float, float, float, float] = (0.3, 0.3, 0.7, 0.7),
                         source: str = "", config: dict | None = None) -> Path:
    """지도 톤앤매너 C: "항공사진 + 권역 오버레이" — 실제 항공/위성 사진
    위에 반투명 색 블록으로 대상 권역을 표시. 가장 사실적이라 "이 건물/
    이 블록" 처럼 실제감이 필요할 때 적합(레퍼런스 채널 실측: 항공사진+
    컬러 사각형 하이라이트).

    photo_path: 항공/위성 사진(로컬 파일). box_frac: 강조할 영역을 사진
    비율(0~1, 좌상단 기준)로 지정.
    """
    from PIL import Image, ImageDraw, ImageFont

    pal = _palette(config)
    font_dir = common.ROOT_DIR / "assets" / "fonts"
    f_label = ImageFont.truetype(str(font_dir / "A2Z-5Medium.ttf"), 46)

    width, height = 1920, 1080
    canvas = Image.new("RGB", (width, height), pal["blueprint_bg"])
    cd = ImageDraw.Draw(canvas)
    grid_color = _lighten(pal["blueprint_bg"], 0.22)
    for i in range(1, 16):
        x = int(width * i / 16)
        cd.line([(x, 0), (x, height)], fill=grid_color, width=1)
    for j in range(1, 9):
        y = int(height * j / 9)
        cd.line([(0, y), (width, y)], fill=grid_color, width=1)

    card_w, card_h = int(width * 0.64), int(height * 0.72)
    card_x0, card_y0 = (width - card_w) // 2, (height - card_h) // 2
    border = 10
    photo = Image.open(photo_path).convert("RGB")
    scale = max(card_w / photo.width, card_h / photo.height)
    photo = photo.resize((int(photo.width * scale), int(photo.height * scale)), Image.LANCZOS)
    px0, py0 = (photo.width - card_w) // 2, (photo.height - card_h) // 2
    photo = photo.crop((px0, py0, px0 + card_w, py0 + card_h))
    canvas.paste(photo, (card_x0, card_y0))
    cd.rectangle((card_x0 - border, card_y0 - border, card_x0 + card_w + border,
                 card_y0 + card_h + border), outline=pal["card_bg"], width=border)

    bx0 = card_x0 + int(card_w * box_frac[0])
    by0 = card_y0 + int(card_h * box_frac[1])
    bx1 = card_x0 + int(card_w * box_frac[2])
    by1 = card_y0 + int(card_h * box_frac[3])
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    pr, pg, pb = _hex_to_rgb(pal["point"])
    od.rectangle((bx0, by0, bx1, by1), fill=(pr, pg, pb, 80), outline=(pr, pg, pb, 255), width=4)
    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
    cd = ImageDraw.Draw(canvas)

    if label:
        lx, ly = bx1 + 14, by0
        cd.rectangle((lx, ly, lx + int(cd.textlength(label, font=f_label)) + 28, ly + 56),
                    fill=pal["point"])
        cd.text((lx + 14, ly + 28), label, font=f_label, fill=pal["blueprint_text"], anchor="lm")
    if source:
        f_cap = ImageFont.truetype(str(font_dir / "A2Z-3Light.ttf"), 22)
        cd.text((width / 2, card_y0 + card_h + border + 26), source, font=f_cap,
               fill=pal["highlight"], anchor="ma")

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)
    log.info("항공사진 오버레이 지도 저장: %s (%s)", out.name, label or "-")
    return out


# ══════════════════════════════════════════════════════════
# 6. 그래프 추가 유형 — 도넛/게이지, 추이선 (이미지 제작 가이드 §3)
# ══════════════════════════════════════════════════════════

def donut_gauge(percent: float, out: Path, label: str = "", subtitle: str = "",
                source: str = "", config: dict | None = None) -> Path:
    """그래프 유형 B: 도넛/게이지 — 단일 퍼센트를 링 형태로. percent_bar()
    (직선 캡슐 막대)와 같은 데이터를 다루지만 리듬 변화를 위한 대안 —
    같은 영상에 비율 그래픽이 연달아 나올 때 percent_bar 와 번갈아 쓴다.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)
    pct = max(0.0, min(100.0, percent))

    # 16:9 고정 — B-roll 합성 단계(render.py)가 항상 1920x1080 으로 스케일
    # 하므로, 정사각형으로 만들면 링이 타원으로 눌린다(실제로 발견한 버그).
    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_light(fig, pal)
    txt_ax = fig.add_axes((0, 0, 1, 1))
    txt_ax.set_facecolor("none")
    txt_ax.set_xlim(0, 1)
    txt_ax.set_ylim(0, 1)
    txt_ax.set_xticks([])
    txt_ax.set_yticks([])
    for sp in txt_ax.spines.values():
        sp.set_visible(False)

    # 링 전용 정사각 인셋 axes — figsize(16,9) 안에서 실제로 정원이 되도록
    # 가로/세로 인치가 같은 박스로 명시 배치.
    ring_h_frac = 0.62
    ring_w_frac = ring_h_frac * 9 / 16
    pie_ax = fig.add_axes(((1 - ring_w_frac) / 2, 0.16, ring_w_frac, ring_h_frac))
    pie_ax.set_facecolor("none")
    pie_ax.set_xticks([])
    pie_ax.set_yticks([])
    for sp in pie_ax.spines.values():
        sp.set_visible(False)

    ring_w = 0.16
    pie_ax.pie([100], radius=1.0, colors=[pal["text"]], startangle=90,
              wedgeprops=dict(width=ring_w, alpha=0.10, edgecolor="none"))
    pie_ax.pie([pct, 100 - pct], radius=1.0, colors=[pal["point"], (0, 0, 0, 0)],
              startangle=90, counterclock=False, wedgeprops=dict(width=ring_w, edgecolor="none"))
    pie_ax.annotate(f"{pct:.0f}%", (0, 0.06), ha="center", va="center",
                    color=pal["point"], fontsize=52, fontproperties=fonts.get("med"))
    if label:
        pie_ax.annotate(label, (0, -0.24), ha="center", va="center",
                        color=pal["text"], fontsize=19, fontproperties=fonts.get("reg"))

    if subtitle:
        txt_ax.annotate(subtitle, (0.5, 0.90), ha="center", va="top",
                        color=pal["highlight"], fontsize=16, fontproperties=fonts.get("light"))
    _source_box(txt_ax, pal, fonts, source, y=0.05)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    _add_subtle_texture(out)
    log.info("도넛 게이지 저장: %s (%.0f%%)", out.name, pct)
    return out


def trend_line(labels: list[str], values: list[float], out: Path, title: str = "",
               subtitle: str = "", value_suffix: str = "", source: str = "",
               config: dict | None = None) -> Path:
    """그래프 유형 C: 추이선 — 시간에 따른 변화(예: 지가 상승 추이)처럼
    비교가 아니라 "흐름" 이 핵심인 데이터에 적합. bar_chart(비교)·
    donut_gauge/percent_bar(비율) 와 함께 3종 세트.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)
    n = len(values)
    vmax, vmin = max(values), min(values)
    span = (vmax - vmin) or 1

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_light(fig, pal)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    x0, x1 = 0.14, 0.90
    y0, y1 = 0.22, 0.66
    xs = [x0 + (x1 - x0) * i / max(n - 1, 1) for i in range(n)]
    ys = [y0 + (y1 - y0) * (v - vmin) / span for v in values]

    ax.plot(xs, ys, color=pal["point"], lw=3.4, zorder=2, solid_capstyle="round")
    ax.fill_between(xs, ys, y0 - 0.02, color=pal["point"], alpha=0.08, zorder=1)
    # 마지막(최신) 지점만 강조색(그린)으로 — 레퍼런스의 "최신값만 별도
    # 강조" 리듬을 따른다.
    for i, (x, y, v, lb) in enumerate(zip(xs, ys, values, labels)):
        last = i == n - 1
        pcolor = pal["surface"] if last else pal["point"]
        ax.scatter([x], [y], s=170, color=pcolor, zorder=3, edgecolors=pal["canvas_bg"], linewidths=2)
        ax.annotate(f"{v:.0f}{value_suffix}", (x, y + 0.05), ha="center", va="bottom",
                    color=pcolor, fontsize=20, fontproperties=fonts.get("med"), zorder=4)
        ax.annotate(lb, (x, y0 - 0.05), ha="center", va="top",
                    color=pal["text"], fontsize=17, fontproperties=fonts.get("med"), zorder=4)

    if title:
        ax.annotate(title, (0.06, 0.90), ha="left", va="top",
                    color=pal["text"], fontsize=28, fontproperties=fonts.get("med"))
    if subtitle:
        ax.annotate(subtitle, (0.06, 0.845), ha="left", va="top",
                    color=pal["highlight"], fontsize=16, fontproperties=fonts.get("light"))
    _source_box(ax, pal, fonts, source, y=0.045)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    _add_subtle_texture(out)
    log.info("추이선 저장: %s (%d개 지점)", out.name, n)
    return out


def lollipop_chart(categories: list[str], values: list[float], out: Path,
                   title: str = "", subtitle: str = "", value_suffix: str = "",
                   highlight_index: int | None = None, value_fmt: str = "{:.0f}",
                   source: str = "", config: dict | None = None) -> Path:
    """그래프 유형 D: 로리팝(막대 대신 얇은 선+원) 비교 — 실측 레퍼런스가
    두꺼운 막대보다 훨씬 자주 쓰는 미니멀 비교 표현. `bar_chart()`(굵은
    막대)보다 가볍고 절제된 느낌이 필요할 때, 특히 항목이 3개 이상이라
    막대가 답답해 보일 때 쓴다.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)

    if highlight_index is None:
        highlight_index = len(values) - 1

    n = len(values)
    vmax = max(values)

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_light(fig, pal)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    baseline = 0.16
    top_max = 0.72
    content_x0, content_x1 = 0.14, 0.90
    xs = [content_x0 + (content_x1 - content_x0) * i / max(n - 1, 1) for i in range(n)] \
        if n > 1 else [(content_x0 + content_x1) / 2]

    ax.axhline(baseline, color=_lighten(pal["text"], 0.8), lw=1.2, zorder=1)

    for i, (x, v) in enumerate(zip(xs, values)):
        hl = i == highlight_index
        color = pal["surface"] if hl else pal["point"]
        h = (v / vmax) * (top_max - baseline)
        ax.plot([x, x], [baseline, baseline + h], color=color, lw=8,
               solid_capstyle="round", zorder=2)
        ax.scatter([x], [baseline + h], s=650 if hl else 480, color=color,
                  zorder=3, edgecolors=pal["canvas_bg"], linewidths=4)
        ax.annotate(value_fmt.format(v) + value_suffix, (x, baseline + h + 0.055),
                    ha="center", va="bottom", color=color, fontsize=23 if hl else 19,
                    fontproperties=fonts.get("med"), zorder=4)
        ax.annotate(categories[i], (x, baseline - 0.035), ha="center", va="top",
                    color=pal["text"], fontsize=18, fontproperties=fonts.get("med"), zorder=4)

    if title:
        ax.annotate(title, (0.06, 0.90), ha="left", va="top",
                    color=pal["text"], fontsize=28, fontproperties=fonts.get("med"))
    if subtitle:
        ax.annotate(subtitle, (0.06, 0.845), ha="left", va="top",
                    color=pal["highlight"], fontsize=16, fontproperties=fonts.get("light"))
    _source_box(ax, pal, fonts, source, y=0.045)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    _add_subtle_texture(out)
    log.info("로리팝 차트 저장: %s (강조 index=%d)", out.name, highlight_index)
    return out


def spectrum_diagram(left_label: str, right_label: str, position: float, out: Path,
                     title: str = "", subtitle: str = "", left_icon: str = "",
                     right_icon: str = "", source: str = "",
                     config: dict | None = None) -> Path:
    """그래프 유형 E: 스펙트럼/연속선 다이어그램 — 두 극단(예: "유동적" ↔
    "비유동적", "저위험" ↔ "고위험") 사이 어딘가에 위치한다는 걸 보여줄 때.
    막대·숫자로 딱 떨어지지 않는 정성적 비교에 적합 — bar_chart/
    lollipop_chart(정량 비교)와 상호 보완적인 도구.

    position: 0(왼쪽 끝, left_label 쪽)~1(오른쪽 끝, right_label 쪽) 사이 값.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyBboxPatch, Ellipse
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)
    pos = max(0.0, min(1.0, position))

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_light(fig, pal)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    # 이 axes 는 0~1 정사각 좌표계이지만 실제 저장 캔버스는 16:9 라, Circle
    # (x/y 반지름이 데이터 단위로 같음)을 그대로 쓰면 최종 이미지에서 가로로
    # 눌린 타원이 된다 — 진짜 원으로 보이려면 세로 반지름을 16/9 배로 키운다.
    aspect = 16 / 9

    def _circle(cx, cy, r, **kw):
        ax.add_patch(Ellipse((cx, cy), width=2 * r, height=2 * r * aspect, **kw))

    track_x0, track_x1 = 0.20, 0.80
    track_y = 0.48
    track_h = 0.05
    ax.add_patch(FancyBboxPatch((track_x0, track_y - track_h / 2), track_x1 - track_x0, track_h,
                               boxstyle=f"round,pad=0,rounding_size={track_h / 2}",
                               facecolor=_lighten(pal["text"], 0.85), edgecolor="none", zorder=1))

    mx = track_x0 + (track_x1 - track_x0) * pos
    for r, alpha in [(0.052, 0.16), (0.036, 0.30)]:
        _circle(mx, track_y, r, facecolor=pal["point"], alpha=alpha, zorder=2, linewidth=0)
    _circle(mx, track_y, 0.020, facecolor=pal["point"], zorder=3)

    anchor_r = 0.052
    for x, label, icon in [(track_x0, left_label, left_icon), (track_x1, right_label, right_icon)]:
        _circle(x, track_y, anchor_r, facecolor=pal["card_bg"],
               edgecolor=pal["text"], linewidth=1.4, zorder=3)
        ax.annotate(label, (x, track_y - anchor_r * aspect - 0.05), ha="center", va="top",
                    color=pal["text"], fontsize=20, fontproperties=fonts.get("med"), zorder=4)

    if title:
        ax.annotate(title, (0.06, 0.90), ha="left", va="top",
                    color=pal["text"], fontsize=28, fontproperties=fonts.get("med"))
    if subtitle:
        ax.annotate(subtitle, (0.06, 0.845), ha="left", va="top",
                    color=pal["highlight"], fontsize=16, fontproperties=fonts.get("light"))
    _source_box(ax, pal, fonts, source, y=0.10)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    icon_side = 0.064
    icon_top = 0.52 - (icon_side * aspect) / 2  # 앵커 원 중심에 정렬(PIL 상하 반전 보정)
    if left_icon:
        _place_icon(out, left_icon, config, color="text", pos=(0.20 - icon_side / 2, icon_top), size_frac=icon_side)
    if right_icon:
        _place_icon(out, right_icon, config, color="text", pos=(0.80 - icon_side / 2, icon_top), size_frac=icon_side)
    _add_subtle_texture(out)
    log.info("스펙트럼 다이어그램 저장: %s (position=%.2f)", out.name, pos)
    return out


# ══════════════════════════════════════════════════════════
# 7. 배경 3가지 톤앤매너 (이미지 제작 가이드 §5)
# ══════════════════════════════════════════════════════════

def _add_canvas_paper(fig, pal: dict) -> None:
    """배경 톤앤매너 B: "풀블리드 페이퍼" — 격자 캔버스+카드의 이중 구조
    없이 빈티지 페이퍼 한 장이 화면 전체를 채운다. 격자형보다 부드럽고
    따뜻한 톤이 필요할 때(인트로, 인용구, 여백이 많은 한 줄 카피 등)."""
    bg = fig.add_axes((0, 0, 1, 1))
    bg.set_facecolor(pal["card_bg"])
    bg.set_xticks([])
    bg.set_yticks([])
    for sp in bg.spines.values():
        sp.set_visible(False)


def _add_canvas_photo(fig, pal: dict, photo_path: Path, darken: float = 0.55) -> None:
    """배경 톤앤매너 C: "사진 블러 배경" — 실제 관련 사진(예: 대상 건물
    항공사진)을 흐리게+어둡게 깔아 장면에 사실적 무게감을 준다.
    카드/텍스트는 이 위에 그대로 얹으면 된다(canvas_text 색 사용 권장)."""
    from PIL import Image, ImageFilter, ImageEnhance
    import numpy as np

    im = Image.open(photo_path).convert("RGB")
    target_ratio = 16 / 9
    w, h = im.size
    if w / h > target_ratio:
        new_w = int(h * target_ratio)
        im = im.crop(((w - new_w) // 2, 0, (w - new_w) // 2 + new_w, h))
    else:
        new_h = int(w / target_ratio)
        im = im.crop((0, (h - new_h) // 2, w, (h - new_h) // 2 + new_h))
    im = im.resize((1920, 1080), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(18))
    im = ImageEnhance.Brightness(im).enhance(1 - darken)
    bg = fig.add_axes((0, 0, 1, 1))
    bg.imshow(np.asarray(im), extent=[0, 1, 0, 1], aspect="auto", zorder=0)
    bg.set_xlim(0, 1)
    bg.set_ylim(0, 1)
    bg.set_xticks([])
    bg.set_yticks([])
    for sp in bg.spines.values():
        sp.set_visible(False)


# ══════════════════════════════════════════════════════════
# 8. B1M 정밀 재스터디로 습득한 신규 문법 (design_reference.md §17, 2026-07-12)
# ══════════════════════════════════════════════════════════

def _tower_silhouette(shape: str, cx: float, base_y: float, half_w: float, h: float) -> list[tuple[float, float]]:
    """비교 막대용 건물 매싱 아키타입(범용 건축 유형 이름 — 특정 건물의
    윤곽을 베낀 게 아니다): 니들/테이퍼드/스텝(웨딩케이크)/펜슬/슬래브.
    실루엣 자체가 값을 담는 막대가 되도록 한다."""
    if shape == "needle":
        body_h = h * 0.72
        pts = [(-half_w, 0), (-half_w, body_h), (0, h), (half_w, body_h), (half_w, 0)]
    elif shape == "tapered":
        top_w = half_w * 0.42
        pts = [(-half_w, 0), (-top_w, h), (top_w, h), (half_w, 0)]
    elif shape == "stepped":
        w1, w2, w3 = half_w, half_w * 0.68, half_w * 0.42
        h1, h2 = h * 0.55, h * 0.80
        pts = [(-w1, 0), (-w1, h1), (-w2, h1), (-w2, h2), (-w3, h2), (-w3, h),
               (w3, h), (w3, h2), (w2, h2), (w2, h1), (w1, h1), (w1, 0)]
    elif shape == "pencil":
        pw = half_w * 0.55
        pts = [(-pw, 0), (-pw, h), (pw, h), (pw, 0)]
    else:  # "slab" 기본값
        pts = [(-half_w, 0), (-half_w, h), (half_w, h), (half_w, 0)]
    return [(cx + x, base_y + y) for x, y in pts]


def silhouette_bar_chart(categories: list[str], values: list[float], out: Path,
                         shapes: list[str] | None = None, title: str = "", subtitle: str = "",
                         value_suffix: str = "", highlight_index: int | None = None,
                         value_fmt: str = "{:.0f}", source: str = "", config: dict | None = None) -> Path:
    """그래프 유형 E: 실루엣 비교바 — B1M 정밀 재스터디(2026-07-12)로 새로
    잡아낸 이 채널의 핵심 시그니처. 막대가 사각형이 아니라 건물 매싱
    아키타입(니들/테이퍼드/스텝/펜슬/슬래브) 윤곽선 자체다. `bar_chart()`
    (사각 막대)·`lollipop_chart()`(선+점)에 이은 세 번째 "높이/규모 비교"
    문법 — 스카이라인·건물 높이 비교처럼 "건물다움"이 핵심일 때 쓴다.

    shapes: 카테고리별 매싱 유형(예: ["needle","slab"]). 생략하면
    needle/tapered/stepped/slab/pencil 순서로 자동 순환.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)
    n = len(categories)
    vmax = max(values) or 1
    cycle = shapes or ["needle", "tapered", "stepped", "slab", "pencil"]

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_light(fig, pal)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    base_y = 0.16
    max_h = 0.58
    half_w = min(0.30 / n, 0.05)
    xs = [(i + 0.5) / n for i in range(n)]

    for i, (cat, val) in enumerate(zip(categories, values)):
        h = max_h * (val / vmax)
        shape = cycle[i % len(cycle)]
        color = pal["surface"] if highlight_index == i else pal["point"]
        pts = _tower_silhouette(shape, xs[i], base_y, half_w, h)
        tower = Polygon(pts, closed=True, facecolor=color, edgecolor="none", zorder=2)
        tower.set_path_effects(_shadow_fx(alpha=0.16))
        ax.add_patch(tower)
        label = value_fmt.format(val) + (f" {value_suffix}" if value_suffix else "")
        ax.annotate(_track_display(label), (xs[i], base_y + h + 0.03), ha="center", va="bottom",
                    color=color, fontsize=22, fontproperties=fonts.get("med"), zorder=3)
        ax.annotate(cat, (xs[i], base_y - 0.03), ha="center", va="top",
                    color=pal["text"], fontsize=17, fontproperties=fonts.get("reg"), zorder=3)

    ax.plot([0.04, 0.96], [base_y, base_y], color=pal["text"], lw=1, alpha=0.25, zorder=1)

    if title:
        ax.annotate(title, (0.5, 0.90), ha="center", va="top",
                    color=pal["text"], fontsize=28, fontproperties=fonts.get("med"))
    if subtitle:
        ax.annotate(subtitle, (0.5, 0.845), ha="center", va="top",
                    color=pal["highlight"], fontsize=16, fontproperties=fonts.get("light"))
    _source_box(ax, pal, fonts, source, y=0.045)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    _add_subtle_texture(out)
    log.info("실루엣 비교바 저장: %s (%d개 항목)", out.name, n)
    return out


def unit_grid_building(percent: float, out: Path, label: str = "", subtitle: str = "",
                       cols: int = 7, rows: int = 12, source: str = "",
                       config: dict | None = None) -> Path:
    """그래프 유형 F: 유닛그리드 퍼센트(와플차트) — B1M 정밀 재스터디로
    잡아낸 문법. 퍼센트를 건물 파사드처럼 촘촘한 격자 타일로 채워
    표현하고, 위/아래에 지붕/베이스 캡을 둬서 "건물"로 읽히게 한다.
    `donut_gauge()`/`percent_bar()`(연속형 비율)와 달리 "실제 세대/유닛
    수"가 감각적으로 와닿아야 할 때(공실률, 입주율 등) 쓴다.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyBboxPatch
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_light(fig, pal)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    grid_w = 0.16
    cell_w = grid_w / cols
    cell_h = cell_w * (16 / 9)   # 16:9 캔버스 보정 — 물리적으로 정사각 타일
    grid_h = rows * cell_h
    gx0 = 0.5 - grid_w / 2
    gy0 = 0.38
    gap = cell_w * 0.14
    cell_round = cell_w * 0.06  # 각진 타일 대신 살짝 둥근 모서리 — 정제된 인상

    total_cells = cols * rows
    fill_cells = round(total_cells * percent / 100)
    fill_color = pal["point"]
    empty_color = _lighten(pal["highlight"], 0.35)
    for r in range(rows):
        for c in range(cols):
            idx = r * cols + c   # 아래에서부터 채움(0=맨 아래 줄)
            color = fill_color if idx < fill_cells else empty_color
            x0 = gx0 + c * cell_w + gap / 2
            y0 = gy0 + r * cell_h + gap / 2
            ax.add_patch(FancyBboxPatch((x0, y0), cell_w - gap, cell_h - gap,
                                       boxstyle=f"round,pad=0,rounding_size={cell_round}",
                                       facecolor=color, edgecolor="none", zorder=2,
                                       mutation_aspect=1))

    cap_h = cell_h * 0.55
    cap_round = cap_h * 0.35
    for cap_y in (gy0 + grid_h, gy0 - cap_h):
        cap = FancyBboxPatch((gx0 - cell_w * 0.2, cap_y), grid_w + cell_w * 0.4, cap_h,
                             boxstyle=f"round,pad=0,rounding_size={cap_round}",
                             facecolor=pal["point"], edgecolor="none", zorder=3,
                             mutation_aspect=(9 / 16))
        cap.set_path_effects(_shadow_fx(alpha=0.18))
        ax.add_patch(cap)

    ax.annotate(f"{percent:.0f}%", (0.5, gy0 - cap_h - 0.05), ha="center", va="top",
                color=pal["point"], fontsize=56, fontproperties=fonts.get("med"))
    if label:
        ax.annotate(label, (0.5, gy0 - cap_h - 0.21), ha="center", va="top",
                    color=pal["text"], fontsize=22, fontproperties=fonts.get("reg"))
    if subtitle:
        ax.annotate(subtitle, (0.5, gy0 + grid_h + cap_h + 0.03), ha="center", va="bottom",
                    color=pal["highlight"], fontsize=16, fontproperties=fonts.get("light"))
    _source_box(ax, pal, fonts, source, y=0.03)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    _add_subtle_texture(out)
    log.info("유닛그리드 빌딩 저장: %s (%.0f%%)", out.name, percent)
    return out


def donut_compare(value_a: float, value_b: float, out: Path, label_a: str = "", label_b: str = "",
                  unit: str = "", subtitle: str = "", source: str = "",
                  config: dict | None = None) -> Path:
    """그래프 유형 G: 두 항목 실비교 도넛 — B1M 정밀 재스터디로 바로잡은
    문법. `donut_gauge()`(단일 값 + 회색 잔여 트랙, 게이지 느낌)와 달리
    이건 두 실제 항목을 나란히 비교하는 진짜 도넛/파이다 — 두 조각 다
    각자의 실측값+라벨을 바깥에 표기한다. "A vs B" 실비교가 주제일 때
    쓴다(예: 입주 세대 vs 공실 세대).
    """
    import math
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)
    total = (value_a + value_b) or 1
    pct_a = 100 * value_a / total

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_light(fig, pal)
    txt_ax = fig.add_axes((0, 0, 1, 1))
    txt_ax.set_facecolor("none")
    txt_ax.set_xlim(0, 1)
    txt_ax.set_ylim(0, 1)
    txt_ax.set_xticks([])
    txt_ax.set_yticks([])
    for sp in txt_ax.spines.values():
        sp.set_visible(False)

    ring_h_frac = 0.58
    ring_w_frac = ring_h_frac * 9 / 16
    pie_ax = fig.add_axes(((1 - ring_w_frac) / 2, 0.20, ring_w_frac, ring_h_frac))
    pie_ax.set_facecolor("none")
    pie_ax.set_xticks([])
    pie_ax.set_yticks([])
    for sp in pie_ax.spines.values():
        sp.set_visible(False)

    color_a = pal["point"]
    color_b = _lighten(pal["point"], 0.42)
    ring_w = 0.42  # 레퍼런스처럼 두툼한 링 — donut_gauge 보다 훨씬 두껍다
    wedges = pie_ax.pie([value_a, value_b], radius=1.0, colors=[color_a, color_b],
                       startangle=90, counterclock=False,
                       wedgeprops=dict(width=ring_w, edgecolor=pal["canvas_bg"], linewidth=3))[0]
    for wedge in wedges:
        wedge.set_path_effects(_shadow_fx(alpha=0.16))
    pie_ax.set_xlim(-1.6, 1.6)
    pie_ax.set_ylim(-1.6, 1.6)
    pie_ax.set_aspect("equal")
    pie_ax.annotate(f"{pct_a:.0f}%", (0, 0), ha="center", va="center",
                    color=color_a, fontsize=50, fontproperties=fonts.get("med"))

    for wedge, val, lbl, color in [(wedges[0], value_a, label_a, color_a),
                                   (wedges[1], value_b, label_b, color_b)]:
        mid = math.radians((wedge.theta1 + wedge.theta2) / 2)
        lx, ly = 1.32 * math.cos(mid), 1.32 * math.sin(mid)
        pie_ax.annotate(f"{val:.0f}{unit}", (lx, ly + 0.10), ha="center", va="center",
                        color=pal["text"], fontsize=24, fontproperties=fonts.get("med"))
        if lbl:
            pie_ax.annotate(lbl, (lx, ly - 0.10), ha="center", va="center",
                            color=pal["highlight"], fontsize=15, fontproperties=fonts.get("reg"))

    if subtitle:
        txt_ax.annotate(subtitle, (0.5, 0.90), ha="center", va="top",
                        color=pal["highlight"], fontsize=16, fontproperties=fonts.get("light"))
    _source_box(txt_ax, pal, fonts, source, y=0.05)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    _add_subtle_texture(out)
    log.info("실비교 도넛 저장: %s (%.0f vs %.0f)", out.name, value_a, value_b)
    return out


def isometric_block_diagram(footprint: list[tuple[int, int]], out: Path,
                            highlight: tuple[int, int] | None = None,
                            title: str = "", source: str = "", config: dict | None = None) -> Path:
    """그래프 유형 H: 아이소메트릭 블록 다이어그램 — B1M 정밀 재스터디로
    잡아낸 문법. 여러 필지/유닛 블록을 아이소메트릭으로 쌓아 "부지
    조합/선정" 같은 맥락을 보여주고 그중 하나를 그린으로 강조한다.
    `isometric_building_icon()`(단일 타워 아이콘)과 달리 여러 블록의
    평면 배치 자체가 정보다.

    footprint: 점유된 (col, row) 정수 좌표 리스트 — 예: 3x3 사각형이면
    [(c, r) for c in range(3) for r in range(3)].
    highlight: 강조할 (col, row) 좌표 — pal["surface"](그린)로 칠해짐.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_light(fig, pal)
    txt_ax = fig.add_axes((0, 0, 1, 1))
    txt_ax.set_facecolor("none")
    txt_ax.set_xlim(0, 1)
    txt_ax.set_ylim(0, 1)
    txt_ax.set_xticks([])
    txt_ax.set_yticks([])
    for sp in txt_ax.spines.values():
        sp.set_visible(False)

    ax = fig.add_axes((0.28, 0.10, 0.44, 0.75))
    ax.set_aspect("equal")   # 실제 2:1 아이소 비율 보장(눌리지 않게) — §16-1 교훈
    ax.set_facecolor("none")
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    dx, dy, H = 0.5, 0.25, 0.55
    base_hex = pal["point"]
    top_hex, right_hex, left_hex = _lighten(base_hex, 0.30), base_hex, _lighten(base_hex, -0.30)
    hi_hex = pal["surface"]
    hi_top, hi_right, hi_left = _lighten(hi_hex, 0.30), hi_hex, _lighten(hi_hex, -0.30)

    max_cr = max(c + r for c, r in footprint)
    xs_all, ys_all = [], []
    for c, r in footprint:
        cx = (c - r) * dx
        y0 = (c + r) * dy
        is_hi = highlight is not None and (c, r) == tuple(highlight)
        fc_top, fc_right, fc_left = (hi_top, hi_right, hi_left) if is_hi else (top_hex, right_hex, left_hex)
        zbase = (max_cr - (c + r)) * 10  # 앞쪽(가까운) 블록일수록 큰 값 → 항상 뒤 블록을 덮는다

        top = [(cx, y0 + H + dy), (cx + dx, y0 + H), (cx, y0 + H - dy), (cx - dx, y0 + H)]
        right = [(cx + dx, y0 + H), (cx, y0 + H - dy), (cx, y0 - dy), (cx + dx, y0)]
        left = [(cx - dx, y0 + H), (cx, y0 + H - dy), (cx, y0 - dy), (cx - dx, y0)]
        ax.add_patch(Polygon(top, closed=True, facecolor=fc_top, edgecolor="none", zorder=zbase + 3))
        ax.add_patch(Polygon(right, closed=True, facecolor=fc_right, edgecolor="none", zorder=zbase + 2))
        ax.add_patch(Polygon(left, closed=True, facecolor=fc_left, edgecolor="none", zorder=zbase + 2))
        for poly in (top, right, left):
            for x, y in poly:
                xs_all.append(x)
                ys_all.append(y)

    # 블록 전체 아래 옅은 그림자 타원 — 바닥에 붕 뜨지 않고 놓여 있는
    # 느낌(2026-07-21 디자인 정제: 애프터이펙트 없이도 입체감).
    from matplotlib.patches import Ellipse
    gx = sum(xs_all) / len(xs_all)
    gw = (max(xs_all) - min(xs_all)) * 0.72
    gy_ground = min(y0 for _, y0 in [((c - r) * dx, (c + r) * dy) for c, r in footprint])
    ground = Ellipse((gx, gy_ground - 0.05), gw, gw * 0.28,
                     facecolor=pal["text"], alpha=0.14, edgecolor="none", zorder=0)
    ax.add_patch(ground)

    pad = 0.3
    ax.set_xlim(min(xs_all) - pad, max(xs_all) + pad)
    ax.set_ylim(min(ys_all) - pad, max(ys_all) + pad)

    if title:
        txt_ax.annotate(title, (0.5, 0.92), ha="center", va="top",
                        color=pal["text"], fontsize=26, fontproperties=fonts.get("med"))
    _source_box(txt_ax, pal, fonts, source, y=0.045)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    _add_subtle_texture(out)
    log.info("아이소메트릭 블록 다이어그램 저장: %s (%d개 블록)", out.name, len(footprint))
    return out


def tag_badge(text: str, out: Path, config: dict | None = None, color: str = "point",
             text_color: str = "canvas_bg", font_key: str = "med", fontsize: int = 54,
             pad_frac: float = 0.35) -> Path:
    """실사 영상 위에 얹는 단색 태그 배지 — B1M 정밀 재스터디로 잡아낸
    문법. 흰 카드/테두리 없이 팔레트 색 사각형 하나에 굵은 글자만 얹어
    영상 위에 직접 합성한다(예: "$65,600,000" 처럼 — 레퍼런스가 실제로
    쓴 방식). render.py 의 B-roll 오버레이 자리에 이 투명 배경 PNG를
    얹으면 된다. 카드형 문법(stat_card 등)과는 별개의, 영상-직접-오버레이
    전용 축.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyBboxPatch
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)
    bg_hex = pal.get(color, color if color.startswith("#") else "#" + color)
    fg_hex = pal.get(text_color, text_color if text_color.startswith("#") else "#" + text_color)

    fig = plt.figure(figsize=(8, 2), dpi=200)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    t = ax.text(0.5, 0.5, text, ha="center", va="center", color=fg_hex,
               fontsize=fontsize, fontproperties=fonts.get(font_key), zorder=2)

    fig.canvas.draw()
    bbox = t.get_window_extent(renderer=fig.canvas.get_renderer())
    bbox_ax = bbox.transformed(ax.transAxes.inverted())
    pad_x = (bbox_ax.x1 - bbox_ax.x0) * pad_frac
    pad_y = (bbox_ax.y1 - bbox_ax.y0) * pad_frac
    ax.add_patch(FancyBboxPatch((bbox_ax.x0 - pad_x, bbox_ax.y0 - pad_y),
                               (bbox_ax.x1 - bbox_ax.x0) + 2 * pad_x,
                               (bbox_ax.y1 - bbox_ax.y0) + 2 * pad_y,
                               boxstyle="square,pad=0", facecolor=bg_hex,
                               edgecolor="none", zorder=1))

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, transparent=True)
    plt.close(fig)
    log.info("태그 배지 저장: %s (%s)", out.name, text)
    return out


def logo_arrow_card(logo_left: Path, logo_right: Path, out: Path, icon_pictogram: bool = False,
                    title: str = "", subtext: str = "", source: str = "",
                    config: dict | None = None) -> Path:
    """실제 회사 로고 두 개를 화살표로 연결하는 카드 — 인수·이전처럼
    두 실제 법인 사이에서 일어난 일을 다룰 때, 로고 자체가 팩트라 새로
    그리지 않고 실제 로고 이미지를 그대로 쓴다(뉴스·다큐멘터리의 관행적
    팩트 표기 — 로고 원본 흰 여백은 자동 크롭 후 배치).

    icon_pictogram: True 면 두 로고 사이 위쪽에 아이소메트릭 빌딩
    아이콘을 얹는다("운영권/자산이 넘어가는 대상"을 시각적으로 표시).
    """
    import tempfile
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    from PIL import Image
    import numpy as np

    pal = _palette(config)
    fonts = _load_fonts(font_manager)

    def _autocrop(path: Path) -> Image.Image:
        im = Image.open(path).convert("RGBA")
        gray = np.asarray(im.convert("L"))
        mask = gray < 245
        if not mask.any():
            return im
        ys, xs = np.where(mask)
        pad = 4
        x0, x1 = max(int(xs.min()) - pad, 0), min(int(xs.max()) + pad, gray.shape[1])
        y0, y1 = max(int(ys.min()) - pad, 0), min(int(ys.max()) + pad, gray.shape[0])
        return im.crop((x0, y0, x1, y1))

    left_im = _autocrop(logo_left)
    right_im = _autocrop(logo_right)

    # 로고 원본이 흰 배경 JPEG라 캔버스가 조금이라도 다른 톤이면 로고가
    # "네모 박스"로 도드라져 보인다(실측 피드백) — 이 카드만 순백 배경으로
    # 통일해 로고 여백과 캔버스가 이어지게 한다.
    fig = plt.figure(figsize=(16, 9), dpi=200)
    bg = fig.add_axes((0, 0, 1, 1))
    bg.set_facecolor("#FFFFFF")
    bg.set_xticks([])
    bg.set_yticks([])
    for sp in bg.spines.values():
        sp.set_visible(False)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    ax.annotate("", xy=(0.60, 0.46), xytext=(0.40, 0.46),
                xycoords="axes fraction", textcoords="axes fraction",
                arrowprops=dict(arrowstyle="-|>", color=pal["highlight"],
                                lw=2.5, mutation_scale=30))

    if title:
        ax.annotate(title, (0.5, 0.90), ha="center", va="top",
                    color=pal["text"], fontsize=28, fontproperties=fonts.get("med"))
    if subtext:
        ax.annotate(subtext, (0.5, 0.15), ha="center", va="top",
                    color=pal["highlight"], fontsize=20, fontproperties=fonts.get("reg"))
    _source_box(ax, pal, fonts, source, y=0.045)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor="#FFFFFF")
    plt.close(fig)

    card = Image.open(out).convert("RGBA")
    W, H = card.size
    target_h = int(H * 0.13)

    def _fit(im: Image.Image, target_h: int) -> Image.Image:
        w = max(int(im.width * target_h / im.height), 1)
        return im.resize((w, target_h), Image.LANCZOS)

    left_r = _round_corners(_fit(left_im, target_h))
    right_r = _round_corners(_fit(right_im, target_h))
    cy = int(H * 0.54)
    lx = int(W * 0.24 - left_r.width / 2)
    rx = int(W * 0.76 - right_r.width / 2)
    _paste_with_shadow(card, left_r, (lx, cy - left_r.height // 2))
    _paste_with_shadow(card, right_r, (rx, cy - right_r.height // 2))

    if icon_pictogram:
        side = int(W * 0.085)
        icon_tmp = Path(tempfile.mktemp(suffix=".png"))
        isometric_building_icon(icon_tmp, config=config, color="point")
        icon_im = Image.open(icon_tmp).convert("RGBA").resize((side, side), Image.LANCZOS)
        _paste_with_shadow(card, icon_im, (int(W / 2 - side / 2), int(H * 0.22 - side / 2)),
                          blur=14, alpha=45)
        icon_tmp.unlink(missing_ok=True)

    card.convert("RGB").save(out)
    _add_subtle_texture(out)
    log.info("로고 화살표 카드 저장: %s", out.name)
    return out


def photo_headline_card(photo_path: Path, out: Path, headline: str, source_label: str = "",
                        config: dict | None = None) -> Path:
    """실제 인물·사물 사진 + 사진 아래 헤드라인 타이포 — 사진 자체가
    팩트를 전달할 때(예: 실제 구매자 사진, 반드시 출처 있는 사진만) 쓴다.
    사진 위에 글자를 얹지 않고 사진/텍스트 영역을 분리해 둘 다 온전하게
    읽히게 한다. source_label: 사진 우측 상단에 작게 넣는 출처 표기
    (예: "Source: Wikipedia").
    """
    from PIL import Image, ImageDraw, ImageFont

    pal = _palette(config)
    font_dir = common.ROOT_DIR / "assets" / "fonts"
    f_headline = ImageFont.truetype(str(font_dir / "A2Z-1Thin.ttf"), 76)
    f_source = ImageFont.truetype(str(font_dir / "A2Z-4Regular.ttf"), 20)

    W, H = 1920, 1080
    canvas = Image.new("RGBA", (W, H), pal["canvas_bg"] + "FF")

    photo = Image.open(photo_path).convert("RGB")
    photo_h = int(H * 0.60)
    photo_w = min(int(photo.width * photo_h / photo.height), int(W * 0.40))
    scale = max(photo_w / photo.width, photo_h / photo.height)
    photo_r = photo.resize((max(int(photo.width * scale), 1), max(int(photo.height * scale), 1)),
                           Image.LANCZOS)
    px0 = (photo_r.width - photo_w) // 2
    py0 = (photo_r.height - photo_h) // 2
    photo_r = photo_r.crop((px0, py0, px0 + photo_w, py0 + photo_h))

    px = (W - photo_w) // 2
    py = int(H * 0.09)
    # 각진 흰 테두리 대신 둥근 모서리 + 부드러운 섀도 — 직각 프레임보다
    # 붕 뜬 카드처럼 보여 "정제된" 인상을 준다(2026-07-21 디자인 정제).
    photo_rounded = _round_corners(photo_r.convert("RGBA"), radius_frac=0.025)
    _paste_with_shadow(canvas, photo_rounded, (px, py), blur=26, alpha=70, offset=(0, 10))

    cd = ImageDraw.Draw(canvas)
    if source_label:
        cd.text((px + photo_w - 16, py + 16), source_label, font=f_source,
                fill=(255, 255, 255), anchor="ra")

    hy = py + photo_h + int(H * 0.07)
    cd.text((W / 2, hy), _track_display(headline), font=f_headline, fill=pal["text"], anchor="ma")

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out)
    _add_subtle_texture(out)
    log.info("사진+헤드라인 카드 저장: %s (%s)", out.name, headline)
    return out


def icon_hero_card(icon: str, out: Path, value: str = "", label: str = "", subtitle: str = "",
                   color: str = "point", icon_scale: float = 0.30, source: str = "",
                   building_icon: bool = False, building_floors: int = 6,
                   dark: bool = False, config: dict | None = None) -> Path:
    """아이콘이 주인공인 카드 — 개념 하나(입장·비용·기간 등)를 큰 픽토그램
    하나로 전달하고, 숫자/텍스트는 작게 보조로만 붙인다(2026-07-22 디자인
    피드백: "숫자만 크게 있지 말고 이모티콘/이미지를 중앙에, 글은 작게").
    `stat_card()`(숫자가 주인공)와 정반대 위계 — 개념 자체가 핵심일 때
    (예: "진입장벽 제거", "초기비용 부담/가벼움") 쓴다.

    building_icon: True 면 Iconify 검색 대신 원본 아이소메트릭 빌딩을
    큰 히어로 이미지로 쓴다 — "건물 자체가 주제"일 때(예: 한 동당 객실
    수 범위).

    dark: True 면 라이트 오프화이트 카드 대신 애플 발표 영상풍 다크
    스포트라이트 배경 + 화이트 아이콘 + 컬러 백라이트 글로우로 렌더링한다
    (2026-07-22 "아이폰처럼 좀 고급스럽게" 피드백)."""
    import tempfile
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    from PIL import Image

    pal = _palette(config)
    fonts = _load_fonts(font_manager)
    accent_hex = pal.get(color, color if str(color).startswith("#") else "#" + str(color))

    fig = plt.figure(figsize=(16, 9), dpi=200)
    if dark:
        _add_canvas_premium(fig)
    else:
        _add_canvas_light(fig, pal)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    label_color = "#EEF2FA" if dark else pal["text"]
    subtitle_color = "#8D96A8" if dark else pal["highlight"]
    value_color = _lighten(accent_hex, 0.45) if dark else accent_hex

    if label:
        ax.annotate(label, (0.5, 0.90), ha="center", va="top",
                    color=label_color, fontsize=28, fontproperties=fonts.get("med"))
    if value:
        val_txt = ax.annotate(_track_display(value), (0.5, 0.09), ha="center", va="center",
                              color=value_color, fontsize=34,
                              fontproperties=fonts.get("med"))
        val_txt.set_path_effects(_shadow_fx(alpha=0.35 if dark else 0.12, offset=(1.2, -1.2)))
    if subtitle:
        ax.annotate(subtitle, (0.5, 0.90 - (0.06 if label else 0)), ha="center", va="top",
                    color=subtitle_color, fontsize=16, fontproperties=fonts.get("light"))
    _source_box(ax, pal, fonts, source, y=0.045)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=("#05070C" if dark else pal["canvas_bg"]))
    plt.close(fig)

    card = Image.open(out).convert("RGBA")
    W, H = card.size
    # 라벨/값이 둘 다 없는 "아이콘만" 모드는 화면 중앙에 자막/헤드라인
    # 오버레이(ASS Alignment=5, 정중앙)가 나중에 얹힐 걸 가정한다 —
    # 아이콘을 화면 상단으로 올리고 작게 줄여 겹치지 않게 한다
    # (실제로 겪은 버그: 문 아이콘과 헤드라인 텍스트가 정중앙에서 충돌).
    bare = not value and not label
    eff_scale = min(icon_scale, 0.18) if bare else icon_scale
    icon_cy_frac = 0.28 if bare else (0.48 if value else 0.50)
    side = int(W * eff_scale)
    icon_tmp = Path(tempfile.mktemp(suffix=".png"))
    try:
        if dark:
            # 아이소메트릭 빌딩은 순백을 주면 (255-r)이 거의 0이라 명암
            # 대비가 안 생겨(면 구분이 안 보임) 옅은 틴트를 대신 쓴다.
            icon_color = _lighten(accent_hex, 0.55) if building_icon else "#FBFCFF"
        else:
            icon_color = color
        if building_icon:
            isometric_building_icon(icon_tmp, config=config, color=icon_color, floors=building_floors)
        else:
            icon_png(icon, icon_tmp, color=icon_color, size=512, config=config)
        icon_im = Image.open(icon_tmp).convert("RGBA").resize((side, side), Image.LANCZOS)
        icon_cy = int(H * icon_cy_frac)
        pos = (int(W / 2 - side / 2), int(icon_cy - side / 2))
        if dark:
            _glow_behind(card, (int(W / 2), icon_cy), int(side * 0.72), accent_hex,
                        alpha=140, blur=int(side * 0.22))
            card.alpha_composite(icon_im, pos)
        else:
            _paste_with_shadow(card, icon_im, pos, blur=16, alpha=35, offset=(0, 5))
    except Exception as e:
        log.warning("아이콘 히어로 카드 아이콘 합성 실패(%s): %s", icon, e)
    finally:
        icon_tmp.unlink(missing_ok=True)

    card.convert("RGB").save(out)
    _add_subtle_texture(out)
    log.info("아이콘 히어로 카드 저장: %s (%s, dark=%s)", out.name, icon, dark)
    return out


def icon_amenity_row(items: list[dict], out: Path, title: str = "", subtitle: str = "",
                     source: str = "", config: dict | None = None) -> Path:
    """공용부·어매니티처럼 여러 개념을 나란히 아이콘+라벨로 보여주는 열
    (row) — 항목마다 다른 색을 줘서 "컬러감 있게"(2026-07-22 피드백)
    구성한다. items: [{"icon": <iconify 검색어>, "label": str,
    "color": <옵션, hex 또는 팔레트 키>}, ...] (3~5개 권장).
    """
    import tempfile
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    from PIL import Image

    pal = _palette(config)
    fonts = _load_fonts(font_manager)
    # 브랜드 팔레트와 어울리는 절제된 톤의 보조 컬러 세트 — 네온 아님,
    # 기존 point/surface 와 같은 채도·명도대로 맞춘 확장 팔레트.
    accent_cycle = [pal["point"], pal["surface"], "#C98A3E", "#B0618F", "#3E9AA6"]

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_light(fig, pal)
    ax = fig.add_axes((0, 0, 1, 1))
    ax.set_facecolor("none")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    if title:
        ax.annotate(title, (0.5, 0.90), ha="center", va="top",
                    color=pal["text"], fontsize=28, fontproperties=fonts.get("med"))
    if subtitle:
        ax.annotate(subtitle, (0.5, 0.845), ha="center", va="top",
                    color=pal["highlight"], fontsize=16, fontproperties=fonts.get("light"))
    _source_box(ax, pal, fonts, source, y=0.045)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)

    card = Image.open(out).convert("RGBA")
    W, H = card.size
    n = len(items)
    side = int(W * min(0.16, 0.72 / n))
    xs = [(i + 0.5) / n for i in range(n)]
    cy = int(H * 0.48)

    fonts_for_pil = font_manager
    from PIL import ImageDraw, ImageFont
    font_dir = common.ROOT_DIR / "assets" / "fonts"
    f_label = ImageFont.truetype(str(font_dir / "A2Z-4Regular.ttf"), 34)
    cd = ImageDraw.Draw(card)

    for i, item in enumerate(items):
        color = item.get("color") or accent_cycle[i % len(accent_cycle)]
        color = pal.get(color, color)
        icon_tmp = Path(tempfile.mktemp(suffix=".png"))
        try:
            icon_png(item["icon"], icon_tmp, color=color, size=512, config=config)
            icon_im = Image.open(icon_tmp).convert("RGBA").resize((side, side), Image.LANCZOS)
            cx = int(W * xs[i])
            pos = (cx - side // 2, cy - side // 2)
            _paste_with_shadow(card, icon_im, pos, blur=14, alpha=35, offset=(0, 4))
            label = item.get("label", "")
            if label:
                cd.text((cx, cy + side // 2 + 30), label, font=f_label, fill=color, anchor="ma")
        except Exception as e:
            log.warning("어매니티 아이콘 합성 실패(%s): %s", item.get("icon"), e)
        finally:
            icon_tmp.unlink(missing_ok=True)

    card.convert("RGB").save(out)
    _add_subtle_texture(out)
    log.info("어매니티 아이콘 행 저장: %s (%d개)", out.name, n)
    return out


# ══════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="고퀄리티 소스 라이브러리")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("images", help="위키미디어 고해상도 이미지 검색·다운로드")
    p1.add_argument("query"); p1.add_argument("--n", type=int, default=4)
    p1.add_argument("--out", default="./assets_out")

    p2 = sub.add_parser("icon", help="픽토그램 PNG (Iconify)")
    p2.add_argument("name"); p2.add_argument("--color", default="point")
    p2.add_argument("--size", type=int, default=512)
    p2.add_argument("--out", default="./assets_out")

    p3 = sub.add_parser("map", help="플랫 지도 PNG")
    p3.add_argument("target", help='"world" 또는 ISO3 코드 (KOR 등)')
    p3.add_argument("--highlight", default="",
                    help="세계지도: ISO3 코드 / 한국(KOR): 시도명 부분일치 (쉼표 구분)")
    p3.add_argument("--out", default="./assets_out")

    p4 = sub.add_parser("chart", help="막대그래프 카드 PNG")
    p4.add_argument("categories", help="쉼표 구분 (예: 2023,2024,2025)")
    p4.add_argument("values", help="쉼표 구분 숫자 (예: 61,117,201)")
    p4.add_argument("--title", default="")
    p4.add_argument("--subtitle", default="")
    p4.add_argument("--suffix", default="")
    p4.add_argument("--out", default="./assets_out")

    args = parser.parse_args(argv)
    out_dir = Path(args.out)

    if args.cmd == "images":
        items = wikimedia_images(args.query, args.n)
        if not items:
            log.warning("결과 없음: %s", args.query)
            return 1
        download_images(items, out_dir)
    elif args.cmd == "icon":
        safe = re.sub(r"[^\w-]", "_", args.name)
        icon_png(args.name, out_dir / f"icon_{safe}.png", args.color, args.size)
    elif args.cmd == "map":
        hl = [h for h in args.highlight.split(",") if h]
        safe = re.sub(r"[^\w-]", "_", args.target)
        flat_map(args.target, out_dir / f"map_{safe}.png", hl)
    elif args.cmd == "chart":
        cats = args.categories.split(",")
        vals = [float(v) for v in args.values.split(",")]
        bar_chart(cats, vals, out_dir / "chart.png",
                  title=args.title, subtitle=args.subtitle, value_suffix=args.suffix)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
