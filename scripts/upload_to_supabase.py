"""CSV/SQLite 데이터를 Supabase에 업로드하는 스크립트"""

import os
import sys
import pandas as pd
import sqlite3
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("환경변수 SUPABASE_URL, SUPABASE_SERVICE_KEY를 설정하세요")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "상권데이터")

def load_csv(filename, encoding="cp949"):
    path = os.path.join(DATA_DIR, filename)
    try:
        return pd.read_csv(path, encoding=encoding)
    except UnicodeDecodeError:
        return pd.read_csv(path, encoding="utf-8-sig")

def batch_insert(table, rows, batch_size=500):
    total = len(rows)
    for i in range(0, total, batch_size):
        batch = rows[i:i+batch_size]
        sb.table(table).insert(batch).execute()
        print(f"  {table}: {min(i+batch_size, total)}/{total}")

# ── 1. 상권 영역 좌표 ──
print("=== areas ===")
df = load_csv("상권_영역_좌표.csv", "utf-8-sig")
rows = []
for _, r in df.iterrows():
    rows.append({
        "trdar_cd": str(r["상권_코드"]),
        "trdar_nm": r["상권_코드_명"],
        "gu": r.get("자치구명", ""),
        "dong": r.get("행정동명", ""),
        "lat": float(r["위도"]) if pd.notna(r["위도"]) else None,
        "lng": float(r["경도"]) if pd.notna(r["경도"]) else None,
    })
batch_insert("areas", rows)

# ── 2. 추정매출 (최신 분기만) ──
print("=== sales ===")
df = load_csv("서울시 상권분석서비스(추정매출-상권).csv")
latest = df["기준_년분기_코드"].max()
df = df[df["기준_년분기_코드"] == latest]
print(f"  latest quarter: {latest}, rows: {len(df)}")
rows = []
for _, r in df.iterrows():
    rows.append({
        "quarter_cd": str(r["기준_년분기_코드"]),
        "trdar_cd": str(r["상권_코드"]),
        "trdar_nm": r["상권_코드_명"],
        "svc_cd": str(r.get("서비스_업종_코드", "")),
        "svc_nm": r.get("서비스_업종_코드_명", ""),
        "monthly_sales": int(r.get("당월_매출_금액", 0) or 0),
        "monthly_count": int(r.get("당월_매출_건수", 0) or 0),
        "weekday_sales": int(r.get("주중_매출_금액", 0) or 0),
        "weekend_sales": int(r.get("주말_매출_금액", 0) or 0),
        "mon_sales": int(r.get("월요일_매출_금액", 0) or 0),
        "tue_sales": int(r.get("화요일_매출_금액", 0) or 0),
        "wed_sales": int(r.get("수요일_매출_금액", 0) or 0),
        "thu_sales": int(r.get("목요일_매출_금액", 0) or 0),
        "fri_sales": int(r.get("금요일_매출_금액", 0) or 0),
        "sat_sales": int(r.get("토요일_매출_금액", 0) or 0),
        "sun_sales": int(r.get("일요일_매출_금액", 0) or 0),
        "time_00_06": int(r.get("시간대_00~06_매출_금액", 0) or 0),
        "time_06_11": int(r.get("시간대_06~11_매출_금액", 0) or 0),
        "time_11_14": int(r.get("시간대_11~14_매출_금액", 0) or 0),
        "time_14_17": int(r.get("시간대_14~17_매출_금액", 0) or 0),
        "time_17_21": int(r.get("시간대_17~21_매출_금액", 0) or 0),
        "time_21_24": int(r.get("시간대_21~24_매출_금액", 0) or 0),
        "male_sales": int(r.get("남성_매출_금액", 0) or 0),
        "female_sales": int(r.get("여성_매출_금액", 0) or 0),
        "age_10": int(r.get("연령대_10_매출_금액", 0) or 0),
        "age_20": int(r.get("연령대_20_매출_금액", 0) or 0),
        "age_30": int(r.get("연령대_30_매출_금액", 0) or 0),
        "age_40": int(r.get("연령대_40_매출_금액", 0) or 0),
        "age_50": int(r.get("연령대_50_매출_금액", 0) or 0),
        "age_60": int(r.get("연령대_60_이상_매출_금액", 0) or 0),
    })
batch_insert("sales", rows)

# ── 3. 유동인구 (최신 분기만) ──
print("=== foot_traffic ===")
df = load_csv("서울시 상권분석서비스(길단위인구-상권).csv")
latest = df["기준_년분기_코드"].max()
df = df[df["기준_년분기_코드"] == latest]
print(f"  latest quarter: {latest}, rows: {len(df)}")
rows = []
for _, r in df.iterrows():
    rows.append({
        "quarter_cd": str(r["기준_년분기_코드"]),
        "trdar_cd": str(r["상권_코드"]),
        "trdar_nm": r["상권_코드_명"],
        "total_ft": int(r.get("총_유동인구_수", 0) or 0),
        "male_ft": int(r.get("남성_유동인구_수", 0) or 0),
        "female_ft": int(r.get("여성_유동인구_수", 0) or 0),
        "age_10": int(r.get("연령대_10_유동인구_수", 0) or 0),
        "age_20": int(r.get("연령대_20_유동인구_수", 0) or 0),
        "age_30": int(r.get("연령대_30_유동인구_수", 0) or 0),
        "age_40": int(r.get("연령대_40_유동인구_수", 0) or 0),
        "age_50": int(r.get("연령대_50_유동인구_수", 0) or 0),
        "age_60": int(r.get("연령대_60_이상_유동인구_수", 0) or 0),
        "time_00_06": int(r.get("시간대_00_06_유동인구_수", 0) or 0),
        "time_06_11": int(r.get("시간대_06_11_유동인구_수", 0) or 0),
        "time_11_14": int(r.get("시간대_11_14_유동인구_수", 0) or 0),
        "time_14_17": int(r.get("시간대_14_17_유동인구_수", 0) or 0),
        "time_17_21": int(r.get("시간대_17_21_유동인구_수", 0) or 0),
        "time_21_24": int(r.get("시간대_21_24_유동인구_수", 0) or 0),
        "mon": int(r.get("월요일_유동인구_수", 0) or 0),
        "tue": int(r.get("화요일_유동인구_수", 0) or 0),
        "wed": int(r.get("수요일_유동인구_수", 0) or 0),
        "thu": int(r.get("목요일_유동인구_수", 0) or 0),
        "fri": int(r.get("금요일_유동인구_수", 0) or 0),
        "sat": int(r.get("토요일_유동인구_수", 0) or 0),
        "sun": int(r.get("일요일_유동인구_수", 0) or 0),
    })
batch_insert("foot_traffic", rows)

# ── 4. 직장인구 (최신 분기만) ──
print("=== population ===")
df = load_csv("서울시 상권분석서비스(직장인구-상권).csv")
latest = df["기준_년분기_코드"].max()
df = df[df["기준_년분기_코드"] == latest]
print(f"  latest quarter: {latest}, rows: {len(df)}")
rows = []
for _, r in df.iterrows():
    rows.append({
        "quarter_cd": str(r["기준_년분기_코드"]),
        "trdar_cd": str(r["상권_코드"]),
        "trdar_nm": r["상권_코드_명"],
        "total_pop": int(r.get("총_직장_인구_수", 0) or 0),
        "male_pop": int(r.get("남성_직장_인구_수", 0) or 0),
        "female_pop": int(r.get("여성_직장_인구_수", 0) or 0),
        "age_10": int(r.get("연령대_10_직장_인구_수", 0) or 0),
        "age_20": int(r.get("연령대_20_직장_인구_수", 0) or 0),
        "age_30": int(r.get("연령대_30_직장_인구_수", 0) or 0),
        "age_40": int(r.get("연령대_40_직장_인구_수", 0) or 0),
        "age_50": int(r.get("연령대_50_직장_인구_수", 0) or 0),
        "age_60": int(r.get("연령대_60_이상_직장_인구_수", 0) or 0),
    })
batch_insert("population", rows)

# ── 5. 점포 (최신 분기만) ──
print("=== stores ===")
df = load_csv("서울시 상권분석서비스(점포-상권)_2024년.csv")
latest = df["기준_년분기_코드"].max()
df = df[df["기준_년분기_코드"] == latest]
print(f"  latest quarter: {latest}, rows: {len(df)}")
rows = []
for _, r in df.iterrows():
    rows.append({
        "quarter_cd": str(r["기준_년분기_코드"]),
        "trdar_cd": str(r["상권_코드"]),
        "trdar_nm": r["상권_코드_명"],
        "svc_cd": str(r.get("서비스_업종_코드", "")),
        "svc_nm": r.get("서비스_업종_코드_명", ""),
        "store_count": int(r.get("점포_수", 0) or 0),
        "similar_count": int(r.get("유사_업종_점포_수", 0) or 0),
        "open_rate": float(r.get("개업_율", 0) or 0),
        "open_count": int(r.get("개업_점포_수", 0) or 0),
        "close_rate": float(r.get("폐업_률", 0) or 0),
        "close_count": int(r.get("폐업_점포_수", 0) or 0),
        "franchise_count": int(r.get("프랜차이즈_점포_수", 0) or 0),
    })
batch_insert("stores", rows)

# ── 6. 임대료 추정 (SQLite에서) ──
print("=== rents ===")
db_path = os.path.join(DATA_DIR, "rent_nearby.db")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    df = pd.read_sql("SELECT * FROM rents", conn)
    conn.close()
    print(f"  rows: {len(df)}")
    rows = []
    for _, r in df.iterrows():
        rows.append({
            "lat": float(r["lat"]),
            "lng": float(r["lng"]),
            "target_pyeong": int(r["target_pyeong"]),
            "floor": r["floor"],
            "rent_pyeong": float(r["rent_pyeong"]),
            "rent": float(r["rent"]),
            "deposit": float(r["deposit"]),
        })
    batch_insert("rents", rows, batch_size=1000)
else:
    print("  rent_nearby.db not found, skipping")

print("\n=== 업로드 완료! ===")
