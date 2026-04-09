"""Felt 스타일 차트 컴포넌트 — 따뜻한 컬러 팔레트"""

from __future__ import annotations

import plotly.graph_objects as go
import pandas as pd

# ── Felt 컬러 팔레트 ──

FELT = {
    "orange": "#F88A4A",       # primary warm orange
    "navy": "#1C4484",         # deep navy
    "teal": "#4EAC9F",         # teal green
    "brown": "#6B3D23",        # dark brown
    "taupe": "#AD7B68",        # warm taupe
    "steel": "#5D8AA8",        # steel blue
    "magenta": "#EA3891",      # highlight magenta
    "sand": "#C4A680",         # sand
    "sage": "#8EA084",         # sage green
    "terra": "#D66652",        # terracotta
    "ocean": "#447494",        # ocean blue
}

# 차트에 순서대로 사용할 컬러 리스트
PALETTE = [
    FELT["orange"], FELT["navy"], FELT["teal"], FELT["terra"],
    FELT["taupe"], FELT["steel"], FELT["sage"], FELT["sand"],
    FELT["ocean"], FELT["brown"], FELT["magenta"],
]

CHART_LAYOUT = dict(
    font=dict(
        family="-apple-system, BlinkMacSystemFont, Pretendard, sans-serif",
        color="#3a3a3a",
    ),
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    margin=dict(t=40, b=20, l=20, r=20),
    hoverlabel=dict(
        bgcolor="white",
        bordercolor="#eee",
        font=dict(color="#1a1a1a", size=12),
    ),
)


def _fmt_won(v):
    if v >= 100000000:
        return "{:.1f}".format(v / 100000000) + "억원"
    if v >= 10000:
        return "{:,.0f}".format(v / 10000) + "만원"
    return "{:,.0f}".format(v) + "원"


def _fmt_count(v):
    if v >= 10000:
        return "{:,.1f}".format(v / 10000) + "만명"
    return "{:,.0f}".format(v) + "명"


def store_category_pie(by_category):
    if not by_category:
        return _empty_chart("업종 분포 데이터 없음")

    names = list(by_category.keys())
    values = [v["count"] for v in by_category.values()]

    fig = go.Figure(go.Pie(
        labels=names,
        values=values,
        hole=0.45,
        marker=dict(colors=PALETTE[:len(names)], line=dict(color="white", width=2)),
        textposition="inside",
        textinfo="percent+label",
        textfont=dict(size=11, color="white"),
        hovertemplate="<b>%{label}</b><br>%{value}개 (%{percent})<extra></extra>",
    ))
    fig.update_layout(
        title=dict(text="업종 대분류", font=dict(size=14)),
        height=380,
        showlegend=False,
        **CHART_LAYOUT,
    )
    return fig


def store_subcategory_bar(by_subcategory, top_n=12):
    if not by_subcategory:
        return _empty_chart("중분류 데이터 없음")

    items = sorted(by_subcategory.items(), key=lambda x: x[1]["count"], reverse=True)[:top_n]
    names = [i[0] for i in items]
    counts = [i[1]["count"] for i in items]

    # 그라데이션: 상위일수록 진한 navy → 하위는 연한 teal
    colors = []
    for i in range(len(names)):
        ratio = i / max(len(names) - 1, 1)
        r = int(28 + (78 - 28) * ratio)
        g = int(68 + (172 - 68) * ratio)
        b = int(132 + (159 - 132) * ratio)
        colors.append("rgb({},{},{})".format(r, g, b))

    fig = go.Figure(go.Bar(
        x=counts,
        y=names,
        orientation="h",
        marker=dict(color=colors, cornerradius=3),
        hovertemplate="<b>%{y}</b><br>%{x}개<extra></extra>",
        text=counts,
        textposition="outside",
        textfont=dict(size=11, color="#888"),
    ))
    fig.update_layout(
        title=dict(text="업종 중분류 TOP {}".format(top_n), font=dict(size=14)),
        xaxis=dict(visible=False),
        yaxis=dict(autorange="reversed", tickfont=dict(size=11)),
        height=max(350, top_n * 32),
        **CHART_LAYOUT,
    )
    return fig


def sales_by_service_bar(by_service):
    if not by_service:
        return _empty_chart("매출 데이터 없음")

    df = pd.DataFrame(by_service)
    hover_texts = [_fmt_won(v) for v in df["매출액"]]

    fig = go.Figure(go.Bar(
        x=df["매출액"],
        y=df["업종"],
        orientation="h",
        marker=dict(color=FELT["orange"], cornerradius=3),
        customdata=hover_texts,
        hovertemplate="<b>%{y}</b><br>%{customdata}<extra></extra>",
        text=hover_texts,
        textposition="outside",
        textfont=dict(size=11, color="#888"),
    ))
    fig.update_layout(
        title=dict(text="업종별 추정 매출", font=dict(size=14)),
        xaxis=dict(visible=False),
        yaxis=dict(autorange="reversed", tickfont=dict(size=11)),
        height=max(350, len(by_service) * 32),
        **CHART_LAYOUT,
    )
    return fig


def time_slot_bar(time_slots, title="시간대별 현황", unit="won"):
    if not time_slots:
        return _empty_chart("{} 데이터 없음".format(title))

    labels = list(time_slots.keys())
    values = list(time_slots.values())
    fmt = _fmt_won if unit == "won" else _fmt_count
    hover_texts = [fmt(v) for v in values]

    max_val = max(values) if values else 0
    colors = [FELT["orange"] if v == max_val else FELT["sand"] for v in values]

    fig = go.Figure(go.Bar(
        x=labels,
        y=values,
        marker=dict(color=colors, cornerradius=3),
        customdata=hover_texts,
        hovertemplate="<b>%{x}</b><br>%{customdata}<extra></extra>",
        text=hover_texts,
        textposition="outside",
        textfont=dict(size=10, color="#888"),
    ))
    fig.update_layout(
        title=dict(text=title, font=dict(size=14)),
        xaxis=dict(tickfont=dict(size=10)),
        yaxis=dict(visible=False),
        height=340,
        **CHART_LAYOUT,
    )
    return fig


def day_of_week_bar(day_data, title="요일별 현황", unit="won"):
    if not day_data:
        return _empty_chart("{} 데이터 없음".format(title))

    labels = list(day_data.keys())
    values = list(day_data.values())
    fmt = _fmt_won if unit == "won" else _fmt_count
    hover_texts = [fmt(v) for v in values]

    colors = []
    for label in labels:
        if "토" in label or "일" in label:
            colors.append(FELT["orange"])
        else:
            colors.append(FELT["steel"])

    fig = go.Figure(go.Bar(
        x=labels,
        y=values,
        marker=dict(color=colors, cornerradius=3),
        customdata=hover_texts,
        hovertemplate="<b>%{x}</b><br>%{customdata}<extra></extra>",
        text=hover_texts,
        textposition="outside",
        textfont=dict(size=10, color="#888"),
    ))
    fig.update_layout(
        title=dict(text=title, font=dict(size=14)),
        xaxis=dict(tickfont=dict(size=10)),
        yaxis=dict(visible=False),
        height=340,
        **CHART_LAYOUT,
    )
    return fig


def gender_pie(by_gender):
    if not by_gender:
        return _empty_chart("성별 데이터 없음")

    names = list(by_gender.keys())
    values = list(by_gender.values())

    fig = go.Figure(go.Pie(
        labels=names,
        values=values,
        hole=0.5,
        marker=dict(
            colors=[FELT["navy"], FELT["orange"]],
            line=dict(color="white", width=2),
        ),
        textposition="inside",
        textinfo="percent+label",
        textfont=dict(size=12, color="white"),
        hovertemplate="<b>%{label}</b><br>%{value:,.0f}명 (%{percent})<extra></extra>",
    ))
    fig.update_layout(
        title=dict(text="성별 분포", font=dict(size=14)),
        height=300,
        showlegend=False,
        **CHART_LAYOUT,
    )
    return fig


def age_bar(by_age, title="연령대별 분포"):
    if not by_age:
        return _empty_chart("{} 데이터 없음".format(title))

    labels = list(by_age.keys())
    values = list(by_age.values())
    hover_texts = [_fmt_count(v) for v in values]

    max_val = max(values) if values else 0
    colors = [FELT["navy"] if v == max_val else FELT["steel"] for v in values]

    fig = go.Figure(go.Bar(
        x=labels,
        y=values,
        marker=dict(color=colors, cornerradius=3),
        customdata=hover_texts,
        hovertemplate="<b>%{x}</b><br>%{customdata}<extra></extra>",
        text=hover_texts,
        textposition="outside",
        textfont=dict(size=10, color="#888"),
    ))
    fig.update_layout(
        title=dict(text=title, font=dict(size=14)),
        xaxis=dict(tickfont=dict(size=10)),
        yaxis=dict(visible=False),
        height=340,
        **CHART_LAYOUT,
    )
    return fig


def _empty_chart(message):
    fig = go.Figure()
    fig.add_annotation(
        text=message, xref="paper", yref="paper", x=0.5, y=0.5,
        showarrow=False, font=dict(size=14, color="#C4A680"),
    )
    fig.update_layout(
        height=250,
        xaxis=dict(visible=False),
        yaxis=dict(visible=False),
        **CHART_LAYOUT,
    )
    return fig
