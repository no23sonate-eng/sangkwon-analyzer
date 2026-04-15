"""2025년 점포 데이터를 Supabase stores 테이블에 업로드"""

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

CSV_PATH = "상권데이터/서울시 상권분석서비스(점포-상권)_2025년.csv"

print(f"=== {CSV_PATH} 읽는 중 ===")
df = pd.read_csv(CSV_PATH, encoding="cp949")
print(f"전체 행수: {len(df):,}")
print(f"분기: {sorted(df['기준_년분기_코드'].unique())}")

# stores 테이블 스키마에 맞게 변환
rows = []
for _, r in df.iterrows():
    rows.append({
        "quarter_cd": str(r["기준_년분기_코드"]),
        "trdar_cd": str(r["상권_코드"]),
        "trdar_nm": str(r["상권_코드_명"]),
        "svc_cd": str(r["서비스_업종_코드"]),
        "svc_nm": str(r["서비스_업종_코드_명"]),
        "store_count": int(r["점포_수"]) if pd.notna(r["점포_수"]) else 0,
        "similar_count": int(r["유사_업종_점포_수"]) if pd.notna(r["유사_업종_점포_수"]) else 0,
        "open_rate": float(r["개업_율"]) if pd.notna(r["개업_율"]) else 0,
        "open_count": int(r["개업_점포_수"]) if pd.notna(r["개업_점포_수"]) else 0,
        "close_rate": float(r["폐업_률"]) if pd.notna(r["폐업_률"]) else 0,
        "close_count": int(r["폐업_점포_수"]) if pd.notna(r["폐업_점포_수"]) else 0,
        "franchise_count": int(r["프랜차이즈_점포_수"]) if pd.notna(r["프랜차이즈_점포_수"]) else 0,
    })

print(f"업로드할 행: {len(rows):,}")

# 기존 2025년 데이터 삭제 (중복 방지)
print("=== 기존 2025년 데이터 삭제 ===")
for q in ["20251", "20252", "20253", "20254"]:
    result = sb.table("stores").delete().eq("quarter_cd", q).execute()
    print(f"  {q}: 삭제 완료")

# 배치 INSERT (500건씩)
print("=== 업로드 시작 ===")
BATCH = 500
for i in range(0, len(rows), BATCH):
    batch = rows[i:i+BATCH]
    sb.table("stores").insert(batch).execute()
    if (i // BATCH) % 20 == 0:
        print(f"  {i+len(batch):,}/{len(rows):,}")

print(f"=== 완료: {len(rows):,}건 업로드 ===")
