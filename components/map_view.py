"""Felt 스타일 지도 — 패널 연동 히트맵"""

from __future__ import annotations

import math
import pydeck as pdk
import pandas as pd

# ── Felt 컬러 팔레트 ──

CATEGORY_COLORS = {
    "음식": [248, 138, 74, 210],
    "소매": [28, 68, 132, 210],
    "생활서비스": [78, 172, 159, 200],
    "학문/교육": [107, 61, 35, 200],
    "숙박": [173, 123, 104, 200],
    "부동산": [93, 138, 168, 200],
    "스포츠": [234, 56, 145, 200],
    "수리/개인": [196, 166, 128, 200],
    "시설관리/임대": [142, 160, 132, 200],
    "음료/식품": [214, 102, 82, 200],
    "소매/유통": [68, 114, 148, 200],
}

DEFAULT_COLOR = [173, 163, 152, 180]

# 히트맵별 컬러랭프
HEATMAP_DENSITY = [
    [255, 255, 230],
    [255, 230, 180],
    [248, 180, 100],
    [248, 138, 74],
    [214, 102, 82],
    [180, 60, 50],
]

HEATMAP_SALES = [
    [230, 245, 255],
    [160, 210, 240],
    [80, 160, 210],
    [28, 120, 180],
    [28, 68, 132],
    [15, 40, 90],
]

HEATMAP_FOOT_TRAFFIC = [
    [240, 255, 245],
    [180, 230, 200],
    [120, 200, 170],
    [78, 172, 159],
    [40, 130, 120],
    [20, 80, 70],
]


def _get_color(category: str) -> list:
    return CATEGORY_COLORS.get(category, DEFAULT_COLOR)


def _make_circle_polygon(lat: float, lng: float, radius_m: int, n_points: int = 80) -> list:
    coords = []
    for i in range(n_points + 1):
        angle = math.radians(360 * i / n_points)
        dlat = radius_m / 111_320 * math.cos(angle)
        dlng = radius_m / (111_320 * math.cos(math.radians(lat))) * math.sin(angle)
        coords.append([lng + dlng, lat + dlat])
    return [coords]


def _prepare_store_df(store_df: pd.DataFrame) -> pd.DataFrame:
    if store_df.empty or "위도" not in store_df.columns:
        return pd.DataFrame()

    df = store_df.copy()
    df["위도"] = pd.to_numeric(df["위도"], errors="coerce")
    df["경도"] = pd.to_numeric(df["경도"], errors="coerce")
    df = df.dropna(subset=["위도", "경도"])
    if df.empty:
        return df

    cat_col = "대분류명" if "대분류명" in df.columns else None
    df["color"] = df[cat_col].apply(_get_color) if cat_col else [DEFAULT_COLOR] * len(df)

    name_col = "상호명" if "상호명" in df.columns else None
    sub_col = "중분류명" if "중분류명" in df.columns else None
    addr_col = "도로명주소" if "도로명주소" in df.columns else None

    df["tooltip_name"] = df[name_col] if name_col else ""
    df["tooltip_cat"] = df[sub_col] if sub_col else (df[cat_col] if cat_col else "")
    df["tooltip_addr"] = df[addr_col] if addr_col else ""

    return df


def create_map(
    center_lat: float,
    center_lng: float,
    radius: int,
    store_df: pd.DataFrame,
    height: int = 620,
    mode: str = "marker",
    heatmap_mode: str = "none",
    sales_data: list = None,
    ft_total: int = 0,
) -> pdk.Deck:
    """
    지도 생성.
    mode: 'marker' | 'both'
    heatmap_mode: 'none' | 'density' | 'sales' | 'foot_traffic'
    """

    layers = []
    map_df = _prepare_store_df(store_df)

    # ── 반경 원 ──
    circle_data = pd.DataFrame([{
        "polygon": _make_circle_polygon(center_lat, center_lng, radius),
    }])
    layers.append(pdk.Layer(
        "PolygonLayer",
        data=circle_data,
        get_polygon="polygon",
        get_fill_color=[248, 138, 74, 15],
        get_line_color=[248, 138, 74, 100],
        get_line_width=2,
        line_width_min_pixels=1.5,
        pickable=False,
    ))

    # ── 히트맵 레이어 (패널에 따라 다른 가중치/색상) ──
    if heatmap_mode != "none" and not map_df.empty:
        heat_df = map_df[["위도", "경도"]].copy()
        cat_col = "대분류명" if "대분류명" in map_df.columns else None
        sub_col = "중분류명" if "중분류명" in map_df.columns else None

        if heatmap_mode == "density":
            # 업종: 전체 점포 밀집도 (동일 가중치)
            heat_df["weight"] = 1.0
            color_range = HEATMAP_DENSITY
            intensity = 1.2
            radius_px = 40

        elif heatmap_mode == "sales":
            # 매출: 업종별 추정매출로 가중치 부여
            weight_map = {}
            if sales_data:
                max_sales = max((s.get("종합_점포당_월매출", 0) for s in sales_data), default=1)
                if max_sales > 0:
                    for s in sales_data:
                        weight_map[s["업종"]] = s.get("종합_점포당_월매출", 0) / max_sales
            # 업종명 → 가중치 매핑 (중분류가 있으면 중분류 사용)
            match_col = sub_col if sub_col else cat_col
            if weight_map and match_col:
                heat_df["weight"] = map_df[match_col].apply(
                    lambda x: weight_map.get(x, 0.3)
                )
            else:
                heat_df["weight"] = 0.5
            color_range = HEATMAP_SALES
            intensity = 1.5
            radius_px = 45

        elif heatmap_mode == "foot_traffic":
            # 유동인구: 음식/소매 밀집 지역에 가중치 (유동인구가 몰리는 곳)
            if cat_col:
                ft_weight = {
                    "음식": 1.0, "소매": 0.9, "생활서비스": 0.7,
                    "음료/식품": 0.8, "소매/유통": 0.8,
                }
                heat_df["weight"] = map_df[cat_col].apply(
                    lambda x: ft_weight.get(x, 0.3)
                )
            else:
                heat_df["weight"] = 1.0
            # 유동인구 총량으로 intensity 조절
            intensity = min(2.0, max(0.8, ft_total / 500000)) if ft_total else 1.0
            color_range = HEATMAP_FOOT_TRAFFIC
            radius_px = 50
        else:
            heat_df["weight"] = 1.0
            color_range = HEATMAP_DENSITY
            intensity = 1.0
            radius_px = 40

        layers.append(pdk.Layer(
            "HeatmapLayer",
            data=heat_df,
            get_position=["경도", "위도"],
            get_weight="weight",
            radiusPixels=radius_px,
            intensity=intensity,
            threshold=0.08,
            color_range=color_range,
            opacity=0.55,
        ))

    # ── 마커 레이어 ──
    if not map_df.empty:
        is_heat = heatmap_mode != "none"
        layers.append(pdk.Layer(
            "ScatterplotLayer",
            data=map_df,
            get_position=["경도", "위도"],
            get_fill_color="color",
            get_line_color=[255, 255, 255, 220],
            get_radius=5 if is_heat else 7,
            radius_min_pixels=3 if is_heat else 4,
            radius_max_pixels=7 if is_heat else 10,
            line_width_min_pixels=1 if is_heat else 1.5,
            stroked=True,
            pickable=True,
            auto_highlight=True,
            highlight_color=[234, 56, 145, 255],
        ))

    # ── 중심점 ──
    center_data = pd.DataFrame([{
        "lat": center_lat,
        "lng": center_lng,
        "tooltip_name": "분석 중심",
        "tooltip_cat": "",
        "tooltip_addr": "",
    }])
    layers.append(pdk.Layer(
        "ScatterplotLayer",
        data=center_data,
        get_position=["lng", "lat"],
        get_fill_color=[248, 138, 74, 255],
        get_line_color=[255, 255, 255, 255],
        get_radius=12,
        radius_min_pixels=7,
        radius_max_pixels=14,
        line_width_min_pixels=3,
        stroked=True,
        pickable=False,
    ))

    # ── 뷰 ──
    zoom_map = {100: 17, 200: 16.5, 300: 16, 500: 15.2, 1000: 14.3}
    view_state = pdk.ViewState(
        latitude=center_lat,
        longitude=center_lng,
        zoom=zoom_map.get(radius, 15),
        pitch=0,
        bearing=0,
    )

    tooltip = {
        "html": (
            "<div style='"
            "font-family:-apple-system,BlinkMacSystemFont,Pretendard,sans-serif;"
            "padding:10px 14px;max-width:260px;"
            "'>"
            "<div style='font-weight:600;font-size:14px;color:#1a1a1a;margin-bottom:3px;'>"
            "{tooltip_name}</div>"
            "<div style='font-size:12px;color:#6b3d23;margin-bottom:2px;'>"
            "{tooltip_cat}</div>"
            "<div style='font-size:11px;color:#ad9b98;'>"
            "{tooltip_addr}</div>"
            "</div>"
        ),
        "style": {
            "backgroundColor": "white",
            "color": "#1a1a1a",
            "border": "none",
            "border-radius": "10px",
            "box-shadow": "0 4px 20px rgba(0,0,0,0.10)",
        },
    }

    return pdk.Deck(
        layers=layers,
        initial_view_state=view_state,
        tooltip=tooltip,
        map_style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    )


def create_category_legend(store_df: pd.DataFrame) -> dict:
    if store_df.empty or "대분류명" not in store_df.columns:
        return {}

    counts = store_df["대분류명"].value_counts()
    legend = {}
    for cat, cnt in counts.items():
        color = _get_color(cat)
        legend[cat] = {
            "count": int(cnt),
            "color": "rgb({},{},{})".format(color[0], color[1], color[2]),
        }
    return legend
