"""상권 분석기 — OpenUB + Felt 스타일"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from config import check_api_keys
from services.geocoder import geocode
from services.store_api import get_stores_in_radius, summarize_stores
from services.seoul_api import (
    get_trdar_cd_by_dong,
    search_trdar_by_name,
    search_trdar_broad,
    search_trdar_by_coord,
    get_sales,
    summarize_sales,
    get_foot_traffic,
    summarize_foot_traffic,
    get_resident_population,
    summarize_population,
    get_store_count,
    summarize_store_count,
)
from services.analyzer import analyze_opportunities
from services.rent_api import get_rent_by_gu
from services.sales_estimator import estimate_by_foot_traffic, estimate_by_rent, cross_validate
from components.charts import (
    store_category_pie,
    store_subcategory_bar,
    sales_by_service_bar,
    time_slot_bar,
    day_of_week_bar,
    gender_pie,
    age_bar,
)
from components.report import generate_report
from components.map_view import create_map, create_category_legend

# ── 페이지 설정 ──

st.set_page_config(
    page_title="상권 분석기",
    page_icon="",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── 글로벌 CSS ──

st.markdown("""
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

html, body, [class*="css"] {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* 배경 */
.stApp { background: #FDFBF8; }

/* 상단 여백 제거 */
.stMainBlockContainer { padding-top: 1rem !important; }

/* Streamlit 기본 UI 숨김 (Deploy, 햄버거 메뉴, 푸터) */
header[data-testid="stHeader"] { display: none !important; }
#MainMenu { display: none !important; }
footer { display: none !important; }
div[data-testid="stDecoration"] { display: none !important; }
div[data-testid="stToolbar"] { display: none !important; }
section[data-testid="stSidebar"] { display: none; }

/* 왼쪽 패널 슬라이드 인 애니메이션 */
@keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-30px); }
    to   { opacity: 1; transform: translateX(0); }
}
div[data-testid="stColumn"]:first-child {
    animation: slideInLeft 0.4s ease-out;
}

/* 메트릭 카드 */
div[data-testid="stMetric"] {
    background: #fff;
    border: 1px solid #f0ebe4;
    border-radius: 10px;
    padding: 14px 16px;
    box-shadow: 0 1px 4px rgba(107,61,35,0.05);
}
div[data-testid="stMetric"] label {
    color: #AD7B68 !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
}
div[data-testid="stMetric"] [data-testid="stMetricValue"] {
    color: #2a2a2a !important;
    font-size: 20px !important;
    font-weight: 700 !important;
}
div[data-testid="stMetric"] [data-testid="stMetricDelta"] {
    color: #AD7B68 !important;
    font-size: 11px !important;
}

/* 탭 */
.stTabs [data-baseweb="tab-list"] {
    gap: 0;
    border-bottom: 1px solid #f0ebe4;
    background: #fff;
    border-radius: 10px 10px 0 0;
    padding: 0 8px;
}
.stTabs [data-baseweb="tab"] {
    color: #AD7B68;
    font-weight: 500;
    font-size: 13px;
    border-bottom: 2px solid transparent;
    padding: 10px 16px;
}
.stTabs [aria-selected="true"] {
    color: #1C4484 !important;
    border-bottom-color: #F88A4A !important;
    font-weight: 600;
}
.stTabs [data-baseweb="tab-panel"] {
    background: #fff;
    border: 1px solid #f0ebe4;
    border-top: none;
    border-radius: 0 0 10px 10px;
    padding: 16px;
}

/* 지도 */
iframe[title="streamlit_pydeck.streamlit_component"] {
    border-radius: 12px;
    border: 1px solid #f0ebe4;
    box-shadow: 0 2px 12px rgba(107,61,35,0.06);
}

/* 버튼 */
.stButton > button[kind="primary"] {
    background: #F88A4A;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    height: 42px;
}
.stButton > button[kind="primary"]:hover {
    background: #e07a3a;
}

/* 인풋 */
.stTextInput > div > div > input {
    border-radius: 8px;
    border: 1px solid #e8e0d8;
    font-size: 14px;
    height: 42px;
}
.stTextInput > div > div > input:focus {
    border-color: #F88A4A;
    box-shadow: 0 0 0 1px #F88A4A;
}

/* selectbox */
div[data-baseweb="select"] > div {
    border-radius: 8px !important;
    border-color: #e8e0d8 !important;
}

/* expander */
.streamlit-expanderHeader {
    font-weight: 600;
    font-size: 14px;
    color: #2a2a2a;
    background: #FDFBF8;
    border-radius: 8px;
}

/* divider */
hr { border-color: #f0ebe4 !important; }

/* 스크롤바 */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d4c8ba; border-radius: 3px; }

/* 다운로드 버튼 */
.stDownloadButton > button {
    background: #1C4484;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
}

/* alert */
.stAlert { border-radius: 8px; }

/* 라디오 (지도 토글) */
div[role="radiogroup"] {
    gap: 0 !important;
    background: #fff;
    border: 1px solid #f0ebe4;
    border-radius: 8px;
    padding: 2px;
}
div[role="radiogroup"] label {
    font-size: 12px !important;
    font-weight: 500 !important;
    padding: 6px 14px !important;
    border-radius: 6px !important;
    color: #AD7B68 !important;
}
div[role="radiogroup"] label[data-checked="true"],
div[role="radiogroup"] label:has(input:checked) {
    background: #F88A4A !important;
    color: white !important;
}

h1, h2, h3 { color: #2a2a2a; font-weight: 600; }
</style>
""", unsafe_allow_html=True)


# ── 포맷 헬퍼 ──

def _fmt_man(v):
    if v == 0:
        return "-"
    if v >= 10000:
        return "{:.1f}".format(v / 10000) + "억원"
    return "{:,}".format(int(v)) + "만원"


# ══════════════════════════════════════════════════════════════
# 상단 검색 바 (OpenUB 스타일)
# ══════════════════════════════════════════════════════════════

# 로고 + 검색 한 줄
top_logo, top_search, top_radius, top_btn = st.columns([1.5, 4, 2, 1])

with top_logo:
    st.markdown(
        "<div style='display:flex;align-items:center;height:42px;'>"
        "<span style='font-size:20px;font-weight:700;color:#2a2a2a;'>"
        "상권분석기</span>"
        "</div>",
        unsafe_allow_html=True,
    )

with top_search:
    address_input = st.text_input(
        "주소 검색",
        placeholder="도로명주소, 지역명, 건물명으로 검색",
        label_visibility="collapsed",
    )

with top_radius:
    radius = st.select_slider(
        "반경",
        options=[100, 200, 300, 500, 1000],
        value=300,
        format_func=lambda x: "반경 {}m".format(x),
        label_visibility="collapsed",
    )

with top_btn:
    analyze_btn = st.button("검색", type="primary", use_container_width=True)

# 검색 버튼 클릭 시 → session_state에 저장
if analyze_btn and address_input:
    st.session_state["searched"] = True
    st.session_state["search_address"] = address_input
    st.session_state["search_radius"] = radius

# 이전 검색 결과 복원
is_searched = st.session_state.get("searched", False)
if is_searched:
    address_input = st.session_state.get("search_address", address_input)
    radius = st.session_state.get("search_radius", radius)


# ══════════════════════════════════════════════════════════════
# 분석 전: 지도만 풀스크린 표시
# ══════════════════════════════════════════════════════════════

if not is_searched:
    default_deck = create_map(37.5665, 126.978, 1000, pd.DataFrame(), height=700)
    st.pydeck_chart(default_deck, use_container_width=True, height=700)
    st.stop()


# ══════════════════════════════════════════════════════════════
# 분석 실행 (결과를 session_state에 캐시)
# ══════════════════════════════════════════════════════════════

# 새 검색인 경우에만 API 호출, 아니면 캐시된 결과 사용
cache_key = "{}__{}".format(address_input, radius)
need_fetch = st.session_state.get("_cache_key") != cache_key

if need_fetch:
    progress = st.progress(0, text="주소를 변환하고 있습니다...")

    geo = geocode(address_input)
    if not geo:
        st.error("'{}' 의 좌표를 찾을 수 없습니다.".format(address_input))
        st.session_state["searched"] = False
        st.stop()

    lat, lng = geo["lat"], geo["lng"]
    resolved_address = geo["address"]
    progress.progress(15, text="점포 데이터를 수집하고 있습니다...")

    try:
        store_df = get_stores_in_radius(lat, lng, radius)
    except Exception:
        store_df = pd.DataFrame()
    store_summary = summarize_stores(store_df)
    if store_df.empty:
        progress.progress(20, text="점포 API 응답 없음 — 상권 데이터로 계속 진행...")
    progress.progress(30, text="상권 코드를 검색하고 있습니다...")

    dong_name = ""
    if "행정동명" in store_df.columns and not store_df.empty:
        dong_name = store_df["행정동명"].mode().iloc[0] if not store_df["행정동명"].mode().empty else ""

    trdar_list = search_trdar_by_coord(lat, lng, radius=max(radius, 500))
    if not trdar_list:
        trdar_list = search_trdar_broad(address_input, dong_name)
    if not trdar_list:
        if dong_name:
            trdar_list = get_trdar_cd_by_dong(dong_name)
        if not trdar_list:
            trdar_list = search_trdar_by_name(address_input.split()[-1] if address_input else "")

    trdar_cd = ""
    trdar_nm = ""
    if trdar_list:
        if len(trdar_list) == 1:
            trdar_cd = trdar_list[0]["trdar_cd"]
            trdar_nm = trdar_list[0]["trdar_nm"]
        else:
            trdar_cd = trdar_list[0]["trdar_cd"]
            trdar_nm = trdar_list[0]["trdar_nm"]
            st.session_state["_trdar_list"] = trdar_list

    progress.progress(45, text="매출 데이터를 수집하고 있습니다...")

    sc_df = get_store_count(trdar_cd) if trdar_cd else pd.DataFrame()
    sales_df = get_sales(trdar_cd) if trdar_cd else pd.DataFrame()
    sales_summary = summarize_sales(sales_df, sc_df)
    progress.progress(60, text="유동인구 데이터를 수집하고 있습니다...")

    ft_df = get_foot_traffic(trdar_cd) if trdar_cd else pd.DataFrame()
    ft_summary = summarize_foot_traffic(ft_df)
    progress.progress(75, text="인구 데이터를 수집하고 있습니다...")

    pop_df = get_resident_population(trdar_cd) if trdar_cd else pd.DataFrame()
    pop_summary = summarize_population(pop_df)
    sc_summary = summarize_store_count(sc_df)
    progress.progress(85, text="임대료/매출 추정 중...")

    # 점포 API 실패 시 → 서울시 CSV 점포 데이터로 store_summary 생성
    if store_df.empty and not sc_df.empty:
        _by_cat = {}
        _by_sub = {}
        _total = 0
        for _, row in sc_df.iterrows():
            name = row.get("서비스_업종_코드_명", "")
            cnt = int(row.get("점포_수", 0))
            if name and cnt > 0:
                _by_sub[name] = {"count": cnt, "ratio": 0}
                _total += cnt
        for k in _by_sub:
            _by_sub[k]["ratio"] = round(_by_sub[k]["count"] / max(_total, 1) * 100, 1)
        # 대분류 그룹핑 (음식/소매/서비스 등)
        for name, info in _by_sub.items():
            if "음식" in name or "커피" in name or "치킨" in name or "분식" in name or "제과" in name:
                cat = "음식"
            elif "의류" in name or "편의점" in name or "슈퍼" in name or "화장품" in name:
                cat = "소매"
            elif "의원" in name or "약국" in name or "미용" in name or "세탁" in name:
                cat = "생활서비스"
            elif "학원" in name or "교육" in name:
                cat = "학문/교육"
            elif "부동산" in name:
                cat = "부동산"
            else:
                cat = "기타"
            if cat not in _by_cat:
                _by_cat[cat] = {"count": 0, "ratio": 0}
            _by_cat[cat]["count"] += info["count"]
        for k in _by_cat:
            _by_cat[k]["ratio"] = round(_by_cat[k]["count"] / max(_total, 1) * 100, 1)
        store_summary = {"total": _total, "by_category": _by_cat, "by_subcategory": _by_sub}

    gu_name = ""
    if "시군구명" in store_df.columns and not store_df.empty:
        gu_name = store_df["시군구명"].mode().iloc[0] if not store_df["시군구명"].mode().empty else ""
    # 구 이름을 상권명에서 추출 (폴백)
    if not gu_name and trdar_nm:
        for _gu in ["강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구",
                     "노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구",
                     "성동구","성북구","송파구","양천구","영등포구","용산구","은평구",
                     "종로구","중구","중랑구"]:
            if _gu in resolved_address:
                gu_name = _gu
                break
    rent_info = get_rent_by_gu(gu_name) if gu_name else {}

    ft_estimate = estimate_by_foot_traffic(ft_summary, store_summary)
    rent_estimate = estimate_by_rent(rent_info, store_summary)
    per_store_avg = sales_summary.get("per_store", [])
    cross_result = cross_validate(per_store_avg, ft_estimate, rent_estimate)

    opportunities = analyze_opportunities(
        store_summary, sales_summary, ft_summary, pop_summary, sc_summary
)
    progress.progress(100, text="")
    insights = opportunities.get("insights", {})

    # 결과를 session_state에 캐시
    st.session_state["_cache_key"] = cache_key
    st.session_state["_r"] = {
        "lat": lat, "lng": lng, "resolved_address": resolved_address,
        "store_df": store_df, "store_summary": store_summary,
        "trdar_cd": trdar_cd, "trdar_nm": trdar_nm,
        "sales_summary": sales_summary, "ft_summary": ft_summary,
        "pop_summary": pop_summary, "sc_summary": sc_summary,
        "rent_info": rent_info, "cross_result": cross_result,
        "opportunities": opportunities, "insights": insights,
    }

else:
    # 캐시에서 복원
    _r = st.session_state["_r"]
    lat = _r["lat"]
    lng = _r["lng"]
    resolved_address = _r["resolved_address"]
    store_df = _r["store_df"]
    store_summary = _r["store_summary"]
    trdar_cd = _r["trdar_cd"]
    trdar_nm = _r["trdar_nm"]
    sales_summary = _r["sales_summary"]
    ft_summary = _r["ft_summary"]
    pop_summary = _r["pop_summary"]
    sc_summary = _r["sc_summary"]
    rent_info = _r["rent_info"]
    cross_result = _r["cross_result"]
    opportunities = _r["opportunities"]
    insights = _r["insights"]

# 여러 상권이 있을 때 선택 UI
trdar_list = st.session_state.get("_trdar_list", [])
if trdar_list and len(trdar_list) > 1:
    def _label(t):
        dist = t.get("distance")
        if dist is not None:
            return "{} ({}m)".format(t["trdar_nm"], dist)
        return t["trdar_nm"]
    options = {_label(t): t for t in trdar_list}
    selected = st.selectbox("주변 상권 선택", list(options.keys()))
    chosen = options[selected]
    if chosen["trdar_cd"] != trdar_cd:
        trdar_cd = chosen["trdar_cd"]
        trdar_nm = chosen["trdar_nm"]


# ══════════════════════════════════════════════════════════════
# 결과 화면 : 왼쪽 데이터 패널 | 오른쪽 지도 (OpenUB 스타일)
# ══════════════════════════════════════════════════════════════

# 패널 선택 (탭 대신 radio → session_state로 지도 연동)
PANELS = ["업종", "매출", "유동인구", "기회분석", "리포트"]
if "active_panel" not in st.session_state:
    st.session_state.active_panel = "업종"

panel_col, map_col = st.columns([2, 3], gap="medium")


# ── 왼쪽 패널 ────────────────────────────────────────────────

with panel_col:

    # 헤더
    st.markdown(
        "<div style='margin-bottom:12px;'>"
        "<div style='font-size:22px;font-weight:700;color:#2a2a2a;'>{addr}</div>"
        "<div style='font-size:13px;color:#AD7B68;margin-top:2px;'>"
        "반경 {r}m{trdar}</div>"
        "</div>".format(
            addr=resolved_address,
            r=radius,
            trdar=" &middot; {}".format(trdar_nm) if trdar_nm else "",
        ),
        unsafe_allow_html=True,
    )

    # 핵심 지표
    m1, m2 = st.columns(2)
    m1.metric("점포 수", "{:,}개".format(insights.get("total_stores", 0)))
    m2.metric("유동인구", "{:,}명".format(insights.get("total_foot_traffic", 0)))
    m3, m4 = st.columns(2)
    m3.metric("직장인구", "{:,}명".format(insights.get("total_population", 0)))
    rent_val = "{:,.0f}천원/평".format(rent_info.get("1층_평", 0)) if rent_info else "-"
    m4.metric("1층 임대료", rent_val)

    st.markdown("")

    # 패널 네비게이션
    active = st.radio(
        "분석 항목",
        PANELS,
        horizontal=True,
        label_visibility="collapsed",
        key="active_panel",
    )

    st.markdown("")

    # ── 업종 패널 ──
    if active == "업종":
        st.plotly_chart(
            store_category_pie(store_summary.get("by_category", {})),
            use_container_width=True,
        )
        st.plotly_chart(
            store_subcategory_bar(store_summary.get("by_subcategory", {})),
            use_container_width=True,
        )
        if not store_df.empty and "상호명" in store_df.columns:
            cat_col = "대분류명" if "대분류명" in store_df.columns else None
            sub_col = "중분류명" if "중분류명" in store_df.columns else None
            with st.expander("인근 사업자 상세 ({:,}개)".format(len(store_df))):
                if cat_col:
                    sel_cat = st.selectbox(
                        "업종 필터",
                        ["전체"] + sorted(store_df[cat_col].dropna().unique().tolist()),
                        key="panel_cat",
                    )
                    fdf = store_df if sel_cat == "전체" else store_df[store_df[cat_col] == sel_cat]
                else:
                    fdf = store_df
                if sub_col and "상호명" in fdf.columns:
                    for sub_name, group in sorted(fdf.groupby(sub_col), key=lambda x: -len(x[1])):
                        st.markdown(
                            "<div style='font-size:13px;font-weight:600;color:#6B3D23;"
                            "margin:8px 0 4px;'>{} ({})</div>".format(sub_name, len(group)),
                            unsafe_allow_html=True,
                        )
                        disp = [c for c in ["상호명", "도로명주소"] if c in group.columns]
                        if disp:
                            st.dataframe(
                                group[disp].sort_values("상호명").reset_index(drop=True),
                                use_container_width=True, hide_index=True,
                                height=min(200, len(group) * 36 + 40),
                            )

    # ── 매출 패널 ──
    elif active == "매출":
        has_sales = bool(sales_summary.get("by_service"))
        has_cross = bool(cross_result)
        if not has_sales and not has_cross:
            st.info("매출 데이터가 없습니다.")
        else:
            ts = sales_summary.get("total_sales", 0)
            tc = sales_summary.get("total_count", 0)
            s1, s2 = st.columns(2)
            ts_txt = "{:.1f}억원".format(ts / 1e8) if ts >= 1e8 else "{:.0f}만원".format(ts / 1e4)
            s1.metric("총 매출액", ts_txt)
            s2.metric("매출 건수", "{:,}건".format(tc))

            if has_cross:
                cr_df = pd.DataFrame(cross_result)
                _est_names = cr_df["업종"].tolist()
                _est_values = cr_df["종합_점포당_월매출"].tolist()
                conf_colors = []
                for r_item in cross_result:
                    c = r_item.get("신뢰등급", "참고")
                    if c == "높음":
                        conf_colors.append("#1C4484")
                    elif c == "보통":
                        conf_colors.append("#4EAC9F")
                    elif c == "낮음":
                        conf_colors.append("#C4A680")
                    else:
                        conf_colors.append("#ddd")
                lowers = [r_item["하한_월매출"] for r_item in cross_result]
                uppers = [r_item["상한_월매출"] for r_item in cross_result]
                fig = go.Figure(go.Bar(
                    x=_est_values, y=_est_names, orientation="h",
                    marker=dict(color=conf_colors, cornerradius=3),
                    error_x=dict(
                        type="data", symmetric=False,
                        array=[max(0, hi - v) for v, hi in zip(_est_values, uppers)],
                        arrayminus=[max(0, v - lo) for v, lo in zip(_est_values, lowers)],
                        color="rgba(0,0,0,0.12)", thickness=1.5,
                    ),
                    text=[_fmt_man(v) for v in _est_values],
                    textposition="outside", textfont=dict(size=10, color="#888"),
                    hovertemplate="<b>%{y}</b><br>%{text}<extra></extra>",
                ))
                fig.update_layout(
                    title=dict(text="점포당 추정 월매출", font=dict(size=14)),
                    xaxis=dict(visible=False),
                    yaxis=dict(autorange="reversed", tickfont=dict(size=11)),
                    height=max(300, len(_est_names) * 38),
                    margin=dict(t=40, b=10, l=10, r=80),
                    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                )
                st.plotly_chart(fig, use_container_width=True)
                st.markdown(
                    "<div style='font-size:11px;color:#AD7B68;margin-bottom:12px;'>"
                    "<span style='color:#1C4484;'>&#9679;</span> 높음 &nbsp;"
                    "<span style='color:#4EAC9F;'>&#9679;</span> 보통 &nbsp;"
                    "<span style='color:#C4A680;'>&#9679;</span> 낮음</div>",
                    unsafe_allow_html=True,
                )
            elif has_sales:
                st.plotly_chart(sales_by_service_bar(sales_summary["by_service"]), use_container_width=True)

            if has_sales:
                st.plotly_chart(time_slot_bar(sales_summary.get("time_slots", {}), "시간대별 매출"), use_container_width=True)
                st.plotly_chart(day_of_week_bar(sales_summary.get("day_of_week", {}), "요일별 매출"), use_container_width=True)

            if rent_info:
                with st.expander("임대료 상세 ({})".format(rent_info["gu"])):
                    rc1, rc2, rc3 = st.columns(3)
                    rc1.metric("1층", "{:,.0f}".format(rent_info["1층_평"]))
                    rc2.metric("지하", "{:,.0f}".format(rent_info["지하_평"]))
                    rc3.metric("2층+", "{:,.0f}".format(rent_info["2층이상_평"]))
                    st.caption("단위: 천원/평/월")

    # ── 유동인구 패널 ──
    elif active == "유동인구":
        if not ft_summary.get("total"):
            st.info("유동인구 데이터가 없습니다.")
        else:
            f1, f2 = st.columns(2)
            f1.metric("유동인구 (분기)", "{:,}명".format(ft_summary["total"]))
            f2.metric("피크 시간대", insights.get("peak_time", "-"))
            st.plotly_chart(time_slot_bar(ft_summary.get("time_slots", {}), "시간대별", unit="count"), use_container_width=True)
            st.plotly_chart(day_of_week_bar(ft_summary.get("by_day", {}), "요일별", unit="count"), use_container_width=True)
            gc1, gc2 = st.columns(2)
            with gc1:
                st.plotly_chart(gender_pie(ft_summary.get("by_gender", {})), use_container_width=True)
            with gc2:
                st.plotly_chart(age_bar(ft_summary.get("by_age", {}), "연령대별"), use_container_width=True)
            if pop_summary.get("total"):
                with st.expander("직장인구 ({:,}명)".format(pop_summary["total"])):
                    pc1, pc2 = st.columns(2)
                    with pc1:
                        st.plotly_chart(gender_pie(pop_summary.get("by_gender", {})), use_container_width=True)
                    with pc2:
                        st.plotly_chart(age_bar(pop_summary.get("by_age", {}), "연령대별"), use_container_width=True)

    # ── 기회분석 패널 ──
    elif active == "기회분석":
        i1, i2 = st.columns(2)
        i1.metric("주요 연령층", insights.get("dominant_age", "-"))
        i2.metric("활력도", insights.get("vitality", "-"),
                  delta="개업{} 폐업{}".format(insights.get("open_count", 0), insights.get("close_count", 0)))
        if opportunities.get("saturated"):
            st.markdown("<p style='font-size:14px;font-weight:600;color:#D66652;margin:12px 0 6px;'>포화 업종</p>", unsafe_allow_html=True)
            st.dataframe(pd.DataFrame(opportunities["saturated"]), use_container_width=True, hide_index=True)
        if opportunities.get("underserved"):
            st.markdown("<p style='font-size:14px;font-weight:600;color:#4EAC9F;margin:12px 0 6px;'>부족 업종 (기회)</p>", unsafe_allow_html=True)
            st.dataframe(pd.DataFrame(opportunities["underserved"]), use_container_width=True, hide_index=True)
        if opportunities.get("growing"):
            st.markdown("<p style='font-size:14px;font-weight:600;color:#1C4484;margin:12px 0 6px;'>매출 상위</p>", unsafe_allow_html=True)
            st.dataframe(pd.DataFrame(opportunities["growing"]), use_container_width=True, hide_index=True)
        if opportunities.get("recommendations"):
            st.markdown("<p style='font-size:14px;font-weight:600;color:#F88A4A;margin:12px 0 6px;'>추천 업종</p>", unsafe_allow_html=True)
            st.dataframe(pd.DataFrame(opportunities["recommendations"]), use_container_width=True, hide_index=True)
        if not any([opportunities.get(k) for k in ("saturated", "underserved", "growing", "recommendations")]):
            st.info("분석 데이터가 부족합니다.")

    # ── 리포트 패널 ──
    elif active == "리포트":
        report_md = generate_report(
            address=resolved_address, lat=lat, lng=lng, radius=radius,
            store_summary=store_summary, sales_summary=sales_summary,
            foot_traffic_summary=ft_summary, population_summary=pop_summary,
            store_count_summary=sc_summary, opportunities=opportunities,
            rent_info=rent_info,
        )
        st.markdown(report_md)
        st.markdown("")
        st.download_button(
            label="리포트 다운로드", data=report_md,
            file_name="{}_상권분석.md".format(resolved_address),
            mime="text/markdown", use_container_width=True,
        )


# ── 오른쪽: 지도 (패널에 따라 히트맵 변경) ──────────────────

with map_col:

    # 패널에 따른 히트맵 모드 결정
    heatmap_mode = "none"
    if active == "업종":
        heatmap_mode = "density"
    elif active == "매출":
        heatmap_mode = "sales"
    elif active == "유동인구":
        heatmap_mode = "foot_traffic"

    deck = create_map(
        lat, lng, radius, store_df,
        height=600,
        mode="both" if heatmap_mode != "none" else "marker",
        heatmap_mode=heatmap_mode,
        sales_data=cross_result if cross_result else None,
        ft_total=ft_summary.get("total", 0),
    )
    st.pydeck_chart(deck, use_container_width=True, height=600)

    # 범례
    legend = create_category_legend(store_df)
    legend_parts = []

    if legend:
        for cat, info in legend.items():
            legend_parts.append(
                "<span style='display:inline-flex;align-items:center;margin-right:12px;'>"
                "<span style='width:8px;height:8px;border-radius:50%;"
                "background:{c};margin-right:5px;'></span>"
                "<span style='font-size:11px;color:#6B3D23;'>{n} {v}</span>"
                "</span>".format(c=info["color"], n=cat, v=info["count"])
            )

    # 히트맵 범례
    if heatmap_mode == "density":
        heat_label = "점포 밀집도"
    elif heatmap_mode == "sales":
        heat_label = "추정 매출 분포"
    elif heatmap_mode == "foot_traffic":
        heat_label = "유동인구 밀도"
    else:
        heat_label = ""

    if heat_label:
        legend_parts.append(
            "<span style='display:inline-flex;align-items:center;margin-left:8px;'>"
            "<span style='display:inline-block;width:80px;height:8px;border-radius:4px;"
            "background:linear-gradient(to right,#FFFFCC,#F8B464,#F88A4A,#D66652,#B43C32);"
            "margin-right:6px;'></span>"
            "<span style='font-size:11px;color:#6B3D23;'>{}</span>"
            "</span>".format(heat_label)
        )

    if legend_parts:
        st.markdown(
            "<div style='display:flex;flex-wrap:wrap;padding:6px 0;gap:2px;'>"
            + "".join(legend_parts) + "</div>",
            unsafe_allow_html=True,
        )
