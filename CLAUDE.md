# 상권분석기 — 자동화 작업 default

임대료 4중 검증 시스템 구축 중. 이미 70% 완료(`web/lib/rent-estimator.ts` 3중 검증, `services/naver_crawler.py`, `services/data_updater.py`, `services/scheduler.py`). 남은 갭: 동 단위 분해 / 본인 네트워크 ground truth / PDF 권역 앵커 / sanity check 자동화.

## 무질문 자동 진행

다음 작업은 묻지 말고 즉시 진행:
- 데이터 모듈 추가·갱신 (`services/*.py`, `data_updater.py` 서브커맨드)
- 동 단위 인프라 (행정동 폴리곤, `dong_code` 컬럼, lookup 함수)
- `rent-estimator.ts` 가중치/소스 추가
- npm install / pip install (`requirements.txt`·`package.json` 명시 필수)
- Supabase 마이그레이션 SQL 작성·적용
- 테스트 + 타입 체크 통과 후 `git add → commit → push` (master 자동배포)

## 표준 상수

- 캡레이트 시나리오: **4.5% / 5.0% / 5.5%** 3개 모두 산출
- 임대료 단위: **만원/평/월** 통일
- 보증금: 1층 12개월 / 2층 10개월 / 지하 8개월 (`DEPOSIT_MONTHS`)
- 층별 비율: 1층 1.0 / 2층 0.55 / 지하 0.45 (`FLOOR_RATIO`)
- 동 단위 폴백 순서: **인접동 가중평균 → R-ONE 권역 → 구 평균**

## sanity check (회귀 케이스)

자동 산출값이 본인 수기값 ±20% 벗어나면 빌드 실패:
- 컨설팅 들어오는 케이스마다 본인 실측값을 `web/scripts/sanity-check.mjs`에 누적
- 가정값/추정값은 회귀 기대치로 사용 금지. 본인이 직접 측정한 실거래만

## 디렉토리

- `services/` — Python 파이프라인 (크롤러·API·스케줄러)
- `web/` — Next.js·Supabase·rent-estimator
- `data/reports/` — CBRE/JLL/쿠시먼 PDF (분기 본인 업로드, **gitignore**)
- `data/owner-network-rents.csv` — 본인 네트워크 실거래 (**gitignore**)

## 본인 입력 필요 (이것만)

1. CBRE/JLL/쿠시먼 PDF를 `data/reports/`에 업로드 (분기 1회)
2. 네트워크 실거래를 `data/owner-network-rents.csv`에 추가 (들어올 때마다)
3. Supabase 마이그레이션 SQL은 dashboard SQL Editor 에서 수기 적용 — REST 자동화 불가
4. 신규 권역 매장 자동수집: `python services/place_crawler.py --bootstrap-prime` (분기 1회) +
   admin "매장 검수" 탭에서 컨설팅 들어가는 권역만 수기 검수

이 4개 외에는 자동.

## 메모리 vs CLAUDE.md

`~/.claude/projects/.../memory/`는 비즈니스 전략·노하우. 코드 default는 여기 CLAUDE.md. 분리.

## Next.js 주의

`web/`은 최신 Next.js. API/conventions가 학습 데이터와 다를 수 있음 — 코드 작성 전 `web/node_modules/next/dist/docs/` 확인.
