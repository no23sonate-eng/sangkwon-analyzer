"""2025년 전체 상권분석 데이터를 Supabase에 업로드 (매출/유동인구/직장인구/점포)

실행: PYTHONPATH=. python3 scripts/upload_all_2025.py [sales|ft|pop|stores|all]
"""

import os
import sys
import pandas as pd

# env 로드
for f in ["web/.env.local", ".env"]:
    if os.path.exists(f):
        with open(f) as fp:
            for line in fp:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k, v)

from supabase import create_client

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

BATCH = 500


def s(v, default=""):
    return str(v) if pd.notna(v) else default


def i(v, default=0):
    try:
        return int(v) if pd.notna(v) else default
    except (ValueError, TypeError):
        return default


def f(v, default=0.0):
    try:
        return float(v) if pd.notna(v) else default
    except (ValueError, TypeError):
        return default


def read_csv(filename: str) -> pd.DataFrame:
    for enc in ["cp949", "utf-8-sig", "utf-8"]:
        try:
            return pd.read_csv(f"상권데이터/{filename}", encoding=enc)
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"인코딩 판별 실패: {filename}")


def delete_quarters(table: str, quarters: list[str]):
    for q in quarters:
        sb.table(table).delete().eq("quarter_cd", q).execute()
        print(f"  {table}.{q} 삭제")


def batch_insert(table: str, rows: list[dict]):
    for k in range(0, len(rows), BATCH):
        sb.table(table).insert(rows[k:k+BATCH]).execute()
        if (k // BATCH) % 20 == 0:
            print(f"  {table}: {min(k+BATCH, len(rows)):,}/{len(rows):,}")


def upload_stores():
    df = read_csv("서울시 상권분석서비스(점포-상권)_2025년.csv")
    quarters = sorted(df["기준_년분기_코드"].astype(str).unique())
    print(f"[stores] 분기 {quarters}, 행 {len(df):,}")
    delete_quarters("stores", quarters)
    rows = [{
        "quarter_cd": s(r["기준_년분기_코드"]),
        "trdar_cd": s(r["상권_코드"]),
        "trdar_nm": s(r["상권_코드_명"]),
        "svc_cd": s(r["서비스_업종_코드"]),
        "svc_nm": s(r["서비스_업종_코드_명"]),
        "store_count": i(r["점포_수"]),
        "similar_count": i(r["유사_업종_점포_수"]),
        "open_rate": f(r["개업_율"]),
        "open_count": i(r["개업_점포_수"]),
        "close_rate": f(r["폐업_률"]),
        "close_count": i(r["폐업_점포_수"]),
        "franchise_count": i(r["프랜차이즈_점포_수"]),
    } for _, r in df.iterrows()]
    batch_insert("stores", rows)


def upload_sales():
    df = read_csv("서울시 상권분석서비스(추정매출-상권).csv")
    # 2025년만
    df = df[df["기준_년분기_코드"].astype(str).str.startswith("2025")]
    quarters = sorted(df["기준_년분기_코드"].astype(str).unique())
    print(f"[sales] 분기 {quarters}, 행 {len(df):,}")
    delete_quarters("sales", quarters)
    rows = [{
        "quarter_cd": s(r["기준_년분기_코드"]),
        "trdar_cd": s(r["상권_코드"]),
        "trdar_nm": s(r["상권_코드_명"]),
        "svc_cd": s(r["서비스_업종_코드"]),
        "svc_nm": s(r["서비스_업종_코드_명"]),
        "monthly_sales": i(r.get("당월_매출_금액")),
        "monthly_count": i(r.get("당월_매출_건수")),
        "weekday_sales": i(r.get("주중_매출_금액")),
        "weekend_sales": i(r.get("주말_매출_금액")),
        "mon_sales": i(r.get("월요일_매출_금액")),
        "tue_sales": i(r.get("화요일_매출_금액")),
        "wed_sales": i(r.get("수요일_매출_금액")),
        "thu_sales": i(r.get("목요일_매출_금액")),
        "fri_sales": i(r.get("금요일_매출_금액")),
        "sat_sales": i(r.get("토요일_매출_금액")),
        "sun_sales": i(r.get("일요일_매출_금액")),
        "time_00_06": i(r.get("시간대_00~06_매출_금액")),
        "time_06_11": i(r.get("시간대_06~11_매출_금액")),
        "time_11_14": i(r.get("시간대_11~14_매출_금액")),
        "time_14_17": i(r.get("시간대_14~17_매출_금액")),
        "time_17_21": i(r.get("시간대_17~21_매출_금액")),
        "time_21_24": i(r.get("시간대_21~24_매출_금액")),
        "male_sales": i(r.get("남성_매출_금액")),
        "female_sales": i(r.get("여성_매출_금액")),
        "age_10": i(r.get("연령대_10_매출_금액")),
        "age_20": i(r.get("연령대_20_매출_금액")),
        "age_30": i(r.get("연령대_30_매출_금액")),
        "age_40": i(r.get("연령대_40_매출_금액")),
        "age_50": i(r.get("연령대_50_매출_금액")),
        "age_60": i(r.get("연령대_60_이상_매출_금액")),
        "monthly_count_all": i(r.get("당월_매출_건수")),
    } for _, r in df.iterrows()]
    batch_insert("sales", rows)


def upload_ft():
    df = read_csv("서울시 상권분석서비스(길단위인구-상권).csv")
    df = df[df["기준_년분기_코드"].astype(str).str.startswith("2025")]
    quarters = sorted(df["기준_년분기_코드"].astype(str).unique())
    print(f"[foot_traffic] 분기 {quarters}, 행 {len(df):,}")
    delete_quarters("foot_traffic", quarters)
    rows = [{
        "quarter_cd": s(r["기준_년분기_코드"]),
        "trdar_cd": s(r["상권_코드"]),
        "trdar_nm": s(r["상권_코드_명"]),
        "total_ft": i(r.get("총_유동인구_수")),
        "male_ft": i(r.get("남성_유동인구_수")),
        "female_ft": i(r.get("여성_유동인구_수")),
        "age_10": i(r.get("연령대_10_유동인구_수")),
        "age_20": i(r.get("연령대_20_유동인구_수")),
        "age_30": i(r.get("연령대_30_유동인구_수")),
        "age_40": i(r.get("연령대_40_유동인구_수")),
        "age_50": i(r.get("연령대_50_유동인구_수")),
        "age_60": i(r.get("연령대_60_이상_유동인구_수")),
        "time_00_06": i(r.get("시간대_00_06_유동인구_수")),
        "time_06_11": i(r.get("시간대_06_11_유동인구_수")),
        "time_11_14": i(r.get("시간대_11_14_유동인구_수")),
        "time_14_17": i(r.get("시간대_14_17_유동인구_수")),
        "time_17_21": i(r.get("시간대_17_21_유동인구_수")),
        "time_21_24": i(r.get("시간대_21_24_유동인구_수")),
        "mon": i(r.get("월요일_유동인구_수")),
        "tue": i(r.get("화요일_유동인구_수")),
        "wed": i(r.get("수요일_유동인구_수")),
        "thu": i(r.get("목요일_유동인구_수")),
        "fri": i(r.get("금요일_유동인구_수")),
        "sat": i(r.get("토요일_유동인구_수")),
        "sun": i(r.get("일요일_유동인구_수")),
    } for _, r in df.iterrows()]
    batch_insert("foot_traffic", rows)


def upload_pop():
    df = read_csv("서울시 상권분석서비스(직장인구-상권).csv")
    df = df[df["기준_년분기_코드"].astype(str).str.startswith("2025")]
    quarters = sorted(df["기준_년분기_코드"].astype(str).unique())
    print(f"[population] 분기 {quarters}, 행 {len(df):,}")
    delete_quarters("population", quarters)
    rows = [{
        "quarter_cd": s(r["기준_년분기_코드"]),
        "trdar_cd": s(r["상권_코드"]),
        "trdar_nm": s(r["상권_코드_명"]),
        "total_pop": i(r.get("총_직장_인구_수")),
        "male_pop": i(r.get("남성_직장_인구_수")),
        "female_pop": i(r.get("여성_직장_인구_수")),
        "age_10": i(r.get("연령대_10_직장_인구_수")),
        "age_20": i(r.get("연령대_20_직장_인구_수")),
        "age_30": i(r.get("연령대_30_직장_인구_수")),
        "age_40": i(r.get("연령대_40_직장_인구_수")),
        "age_50": i(r.get("연령대_50_직장_인구_수")),
        "age_60": i(r.get("연령대_60_이상_직장_인구_수")),
    } for _, r in df.iterrows()]
    batch_insert("population", rows)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd == "stores":
        upload_stores()
    elif cmd == "sales":
        upload_sales()
    elif cmd == "ft":
        upload_ft()
    elif cmd == "pop":
        upload_pop()
    elif cmd == "all":
        upload_stores()
        upload_sales()
        upload_ft()
        upload_pop()
    else:
        print(f"Usage: python3 {sys.argv[0]} [stores|sales|ft|pop|all]")
    print("=== 완료 ===")
