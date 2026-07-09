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
        "card_bg": "#104030", "surface": "#307060", "point": "#C0392B",
        "highlight": "#7FD8C0", "text": "#EDEDE4"})


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


def _source_box(ax, pal, fonts, text: str, y: float = -0.16) -> None:
    """카드 맨 아래 출처 캡션(흰 필박스) — 그래프/카드 공통 표준 요소.

    y: axes-fraction 기준 위치. subplots_adjust 로 하단 여백을 둔 카드는
    음수(-0.16 등)로 여백 안에 배치하고, 여백이 없는 카드(ax.axis('off')
    로 전체를 캔버스로 쓰는 stat_card 등)는 0~0.1 사이 값을 넘겨 캔버스
    안쪽에 그려야 잘려나가지 않는다.
    """
    if not text:
        return
    ax.annotate(text, (0.5, y), xycoords="axes fraction", ha="center",
                color="#222222", fontsize=15, fontproperties=fonts.get("reg"),
                bbox=dict(boxstyle="round,pad=0.5", facecolor="#FFFFFF",
                          edgecolor="none", alpha=0.92))


def bar_chart(categories: list[str], values: list[float], out: Path,
              title: str = "", subtitle: str = "", value_suffix: str = "",
              highlight_index: int | None = None, value_fmt: str = "{:.0f}",
              source: str = "", config: dict | None = None) -> Path:
    """막대그래프 카드 PNG — 셜록현준 채널 고해상도 스토리보드 재확인 스펙
    (design_reference.md §7-1): 위아래 둥근 필(pill) 막대, 제목 중앙정렬,
    수치 라벨은 막대 위, 카테고리 라벨은 막대 아래, 강조는 임의 index.

    렌더 단계에서 업스케일하지 않도록 dpi 200 으로 고정 저장한다.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    from matplotlib.patches import FancyBboxPatch

    pal = _palette(config)
    fonts = _load_fonts(font_manager)

    if highlight_index is None:
        highlight_index = len(values) - 1

    n = len(values)
    vmax = max(values)
    bar_w = 0.52
    gap = bar_w * 0.7  # 실측: 막대폭:간격 ≈ 1:0.6~0.8
    xs = [i * (bar_w + gap) for i in range(n)]

    fig, ax = plt.subplots(figsize=(16, 10), dpi=200)
    fig.patch.set_facecolor(pal["card_bg"])
    ax.set_facecolor(pal["card_bg"])
    fig.subplots_adjust(left=0.08, right=0.92, top=0.78, bottom=0.16)

    ax.set_xlim(-bar_w, xs[-1] + bar_w)
    ax.set_ylim(0, vmax * 1.30)

    for i, (x, v) in enumerate(zip(xs, values)):
        hl = i == highlight_index
        color = pal["point"] if hl else pal["surface"]
        # 필(캡슐) 형태: rounding_size 를 막대 폭의 절반으로 — 위아래 모두 둥글게
        h = max(v, vmax * 0.04)
        patch = FancyBboxPatch(
            (x - bar_w / 2, 0), bar_w, h,
            boxstyle=f"round,pad=0,rounding_size={bar_w / 2}",
            facecolor=color, edgecolor="none", zorder=2, mutation_aspect=1,
        )
        ax.add_patch(patch)
        ax.annotate(value_fmt.format(v) + value_suffix, (x, v + vmax * 0.04),
                    ha="center", color="#FFFFFF" if hl else pal["text"],
                    fontsize=40 if hl else 30,
                    fontproperties=fonts.get("med" if hl else "reg"), zorder=3)
        ax.annotate(categories[i], (x, -vmax * 0.09), ha="center", va="top",
                    color=pal["text"], fontsize=24, fontproperties=fonts.get("reg"))

    if title:
        ax.annotate(title, (0.5, 1.16), xycoords="axes fraction", ha="center",
                    color=pal["text"], fontsize=32, fontproperties=fonts.get("reg"))
    if subtitle:
        ax.annotate(subtitle, (0.5, 1.06), xycoords="axes fraction", ha="center",
                    color=pal["highlight"], fontsize=19, fontproperties=fonts.get("light"))
    _source_box(ax, pal, fonts, source)

    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["card_bg"])
    plt.close(fig)
    log.info("그래프 저장: %s (강조 index=%d)", out.name, highlight_index)
    return out


def percent_bar(percent: float, out: Path, title: str = "", subtitle: str = "",
                 label_filled: str = "", label_rest: str = "", source: str = "",
                 config: dict | None = None) -> Path:
    """비율(%) 필 막대 카드 — design_reference.md §8-5 "비율은 도식화 우선"
    원칙에 따른 단일 퍼센트 시각화. 가로 캡슐 막대를 point색:surface색 비율로
    채운다 (예: 매수가가 감정가의 85% 라면 85:15).
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    from matplotlib.patches import FancyBboxPatch

    pal = _palette(config)
    fonts = _load_fonts(font_manager)
    pct = max(0.0, min(100.0, percent))

    fig, ax = plt.subplots(figsize=(16, 6), dpi=200)
    fig.patch.set_facecolor(pal["card_bg"])
    ax.set_facecolor(pal["card_bg"])
    fig.subplots_adjust(left=0.08, right=0.92, top=0.62, bottom=0.30)

    bar_h = 1.0
    ax.set_xlim(0, 100)
    ax.set_ylim(0, bar_h)
    track = FancyBboxPatch((0, 0), 100, bar_h, boxstyle=f"round,pad=0,rounding_size={bar_h / 2}",
                           facecolor=pal["surface"], edgecolor="none", zorder=1)
    ax.add_patch(track)
    if pct > 0:
        fill = FancyBboxPatch((0, 0), pct, bar_h,
                              boxstyle=f"round,pad=0,rounding_size={bar_h / 2}",
                              facecolor=pal["point"], edgecolor="none", zorder=2)
        ax.add_patch(fill)

    ax.annotate(f"{pct:.0f}%", (pct, bar_h / 2), ha="center" if pct > 12 else "left",
                va="center", color="#FFFFFF", fontsize=34,
                fontproperties=fonts.get("med"), zorder=3,
                xytext=(pct if pct > 12 else pct + 2, bar_h / 2), textcoords="data")

    if title:
        ax.annotate(title, (0.5, 1.42), xycoords="axes fraction", ha="center",
                    color=pal["text"], fontsize=32, fontproperties=fonts.get("reg"))
    if subtitle:
        ax.annotate(subtitle, (0.5, 1.20), xycoords="axes fraction", ha="center",
                    color=pal["highlight"], fontsize=19, fontproperties=fonts.get("light"))
    if label_filled:
        ax.annotate(label_filled, (0.0, -0.32), xycoords="axes fraction", ha="left",
                    color=pal["point"], fontsize=20, fontproperties=fonts.get("reg"))
    if label_rest:
        ax.annotate(label_rest, (1.0, -0.32), xycoords="axes fraction", ha="right",
                    color=pal["text"], fontsize=20, fontproperties=fonts.get("reg"))
    _source_box(ax, pal, fonts, source)

    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_visible(False)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["card_bg"])
    plt.close(fig)
    log.info("퍼센트 막대 저장: %s (%.0f%%)", out.name, pct)
    return out


def stat_card(value: str, out: Path, label: str = "", subtext: str = "",
              value2: str = "", label2: str = "", arrow: bool = False,
              source: str = "", config: dict | None = None) -> Path:
    """빅넘버 스탯 카드 — design_reference.md §7-5.
    라벨(작게) → 초대형 숫자 → 캡션(작게) 3단, 또는 화살표로 연결된
    두 번째 수치(예: "캡레이트 4%" → "필요 NOI 52억")까지 지원.
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    pal = _palette(config)
    fonts = _load_fonts(font_manager)

    fig, ax = plt.subplots(figsize=(16, 9), dpi=200)
    fig.patch.set_facecolor(pal["card_bg"])
    ax.set_facecolor(pal["card_bg"])
    ax.axis("off")

    two = bool(value2)
    cx1 = 0.30 if two else 0.5
    if label:
        ax.annotate(label, (cx1, 0.66), xycoords="axes fraction", ha="center",
                    color=pal["highlight"], fontsize=26, fontproperties=fonts.get("reg"))
    ax.annotate(value, (cx1, 0.46), xycoords="axes fraction", ha="center", va="center",
                color="#FFFFFF", fontsize=88 if not two else 66,
                fontproperties=fonts.get("med"))
    if subtext:
        ax.annotate(subtext, (cx1, 0.26), xycoords="axes fraction", ha="center",
                    color=pal["text"], fontsize=24, fontproperties=fonts.get("reg"))

    if two:
        if arrow:
            ax.annotate("", xy=(0.62, 0.46), xytext=(0.42, 0.46),
                        xycoords="axes fraction", textcoords="axes fraction",
                        arrowprops=dict(arrowstyle="-|>", color=pal["text"],
                                        lw=2.5, mutation_scale=30))
        cx2 = 0.78
        if label2:
            ax.annotate(label2, (cx2, 0.66), xycoords="axes fraction", ha="center",
                        color=pal["highlight"], fontsize=26, fontproperties=fonts.get("reg"))
        ax.annotate(value2, (cx2, 0.46), xycoords="axes fraction", ha="center", va="center",
                    color=pal["point"], fontsize=66, fontproperties=fonts.get("med"))

    _source_box(ax, pal, fonts, source, y=0.06)

    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, facecolor=pal["card_bg"])
    plt.close(fig)
    log.info("스탯 카드 저장: %s (%s%s)", out.name, value, f" → {value2}" if two else "")
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
