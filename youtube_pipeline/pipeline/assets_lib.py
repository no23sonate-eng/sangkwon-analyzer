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
        "card_bg": "#EDE3CC", "canvas_bg": "#16233A", "surface": "#4A6FA5",
        "point": "#B33A3A", "highlight": "#8A8064", "text": "#2A2417",
        "canvas_text": "#E8E3D3"})


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
    r = int(r + (255 - r) * amount)
    g = int(g + (255 - g) * amount)
    b = int(b + (255 - b) * amount)
    return f"#{r:02x}{g:02x}{b:02x}"


def _add_canvas_grid(fig, pal: dict, nx: int = 16, ny: int = 9,
                     lw: float = 0.7, alpha: float = 0.4):
    """네이비 캔버스 전체에 얇은 블루프린트 격자선을 깐다 — 플랫 단색 배경은
    디테일이 없어 허전하다는 피드백에 따라 "블루프린트" 컨셉(design_reference.md
    §12-1)을 실제 격자 무늬로 구체화. 콘텐츠는 이 위에 facecolor="none" 인
    투명 축을 별도로 얹어 그린다.
    """
    bg = fig.add_axes((0, 0, 1, 1))
    bg.set_facecolor(pal["canvas_bg"])
    grid_color = _lighten(pal["canvas_bg"], 0.22)
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
    _add_canvas_grid(fig, pal)
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
    gap = bar_w * 0.55
    x = content_x0 + gap

    ax.axhline(baseline, color=_lighten(pal["canvas_bg"], 0.3), lw=1.3, zorder=1)

    for i, v in enumerate(values):
        hl = i == highlight_index
        color = pal["point"] if hl else pal["surface"]
        h = (v / vmax) * (top_max - baseline)
        _rounded_top_bar(ax, x, baseline, bar_w, h, color,
                         radius=min(bar_w * 0.3, 0.018), zorder=2)
        ax.annotate(value_fmt.format(v) + value_suffix, (x + bar_w / 2, baseline + h + 0.022),
                    ha="center", va="bottom", color=color,
                    fontsize=25 if hl else 21,
                    fontproperties=fonts.get("med"), zorder=4)
        ax.annotate(categories[i], (x + bar_w / 2, baseline - 0.03),
                    ha="center", va="top", color=pal["canvas_text"],
                    fontsize=19, fontproperties=fonts.get("med"), zorder=4)
        x += bar_w + gap

    if title:
        ax.annotate(title, (0.06, 0.90), ha="left", va="top",
                    color=pal["canvas_text"], fontsize=28, fontproperties=fonts.get("med"))
    if subtitle:
        ax.annotate(subtitle, (0.06, 0.845), ha="left", va="top",
                    color=pal["canvas_text"], fontsize=16, fontproperties=fonts.get("light"), alpha=0.75)
    _source_box(ax, pal, fonts, source, y=0.045)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    if icon:
        # 막대는 바닥선 위로만 자라므로 우상단 여백은 항상 비어 있다 —
        # 이전엔 카드 안쪽 좌표를 따로 계산해야 했지만 이제 카드=캔버스
        # 전체라 pos 가 곧 이미지 전체 기준 비율이라 계산이 단순해졌다.
        _place_icon(out, icon, config, color="canvas_text", pos=(0.83, 0.06), size_frac=0.09)
    _add_grain(out)
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
    _add_canvas_grid(fig, pal, ny=6)
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
                           facecolor=pal["surface"], edgecolor="none", zorder=1, alpha=0.45)
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
                    color=pal["canvas_text"], fontsize=28, fontproperties=fonts.get("med"))
    if subtitle:
        ax.annotate(subtitle, (0.08, 0.79), ha="left", va="top",
                    color=pal["canvas_text"], fontsize=16, fontproperties=fonts.get("light"), alpha=0.75)
    if label_filled:
        ax.annotate(label_filled, (bar_x0, y0 - 0.06), ha="left", va="top",
                    color=pal["point"], fontsize=17, fontproperties=fonts.get("reg"))
    if label_rest:
        ax.annotate(label_rest, (bar_x0 + bar_w, y0 - 0.06), ha="right", va="top",
                    color=pal["surface"], fontsize=17, fontproperties=fonts.get("reg"))
    _source_box(ax, pal, fonts, source, y=0.06)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    _add_grain(out)
    log.info("퍼센트 막대 저장: %s (%.0f%%)", out.name, pct)
    return out


def stat_card(value: str, out: Path, label: str = "", subtext: str = "",
              value2: str = "", label2: str = "", arrow: bool = False,
              source: str = "", icon: str = "", config: dict | None = None) -> Path:
    """빅넘버 스탯 카드 — The B1M 스타일 (design_reference.md §12). 네이비
    블루프린트 캔버스 위 빈티지 페이퍼 카드, 핵심 숫자는 브릭 레드
    (건물 높이 라벨 문법과 동일), 라벨/캡션은 다크 차콜·올리브그레이.
    화살표로 연결된 두 번째 수치(예: "캡레이트 4%" → "필요 NOI 52억")도 지원 —
    입력값은 블루, 결과값만 레드로 강조.

    icon: 주제 픽토그램 검색어 — 숫자만 덩그러니 있으면 어색하다는 피드백
    (§12-6)에 따라 카드 좌상단에 개념 아이콘을 함께 넣는다.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)

    fig = plt.figure(figsize=(16, 9), dpi=200)
    _add_canvas_grid(fig, pal)  # 카드 바깥 네이비 여백에도 격자 디테일
    ax = fig.add_axes((0.06, 0.06, 0.88, 0.88))
    ax.set_facecolor(pal["card_bg"])
    # 주의: ax.axis('off') 는 틱/스파인뿐 아니라 축 patch(카드 배경색)까지
    # 지워버려 네이비 캔버스만 보이는 버그가 있었다 — 틱/스파인만 개별로 끔.
    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    two = bool(value2)
    cx1 = 0.30 if two else 0.5
    if label:
        ax.annotate(label, (cx1, 0.66), xycoords="axes fraction", ha="center",
                    color=pal["text"], fontsize=26, fontproperties=fonts.get("reg"))
    ax.annotate(value, (cx1, 0.46), xycoords="axes fraction", ha="center", va="center",
                color=pal["surface"] if two else pal["point"], fontsize=80 if not two else 60,
                fontproperties=fonts.get("med"))
    if subtext:
        ax.annotate(subtext, (cx1, 0.26), xycoords="axes fraction", ha="center",
                    color=pal["highlight"], fontsize=24, fontproperties=fonts.get("reg"))

    if two:
        if arrow:
            ax.annotate("", xy=(0.62, 0.46), xytext=(0.42, 0.46),
                        xycoords="axes fraction", textcoords="axes fraction",
                        arrowprops=dict(arrowstyle="-|>", color=pal["text"],
                                        lw=2.5, mutation_scale=30))
        cx2 = 0.78
        if label2:
            ax.annotate(label2, (cx2, 0.66), xycoords="axes fraction", ha="center",
                        color=pal["text"], fontsize=26, fontproperties=fonts.get("reg"))
        ax.annotate(value2, (cx2, 0.46), xycoords="axes fraction", ha="center", va="center",
                    color=pal["point"], fontsize=60, fontproperties=fonts.get("med"))

    _source_box(ax, pal, fonts, source, y=0.06)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["canvas_bg"])
    plt.close(fig)
    if icon:
        _place_icon(out, icon, config, pos=(0.09, 0.10), size_frac=0.14)
    _add_grain(out)
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
