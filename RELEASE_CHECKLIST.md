# 외부 공개 전 체크리스트

## 🔴 차단 — 배포 전 필수

- [ ] **Supabase RLS 적용**: `scripts/rls_policies.sql` 을 Supabase SQL Editor에서 실행. `anon` 키로 `naver_estimated_deals`, `naver_listings` 접근 불가 확인.
- [ ] **환경 변수 확인 (Vercel Production)**
  - `SUPABASE_SERVICE_ROLE_KEY` (서버 전용)
  - `CRON_SECRET` (반드시 설정. 미설정 시 cron 라우트 503 반환)
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] **`.env.local` git에 없는지 확인**: `git ls-files | grep .env` → `.env.example`만 나와야 함.
- [ ] **Vercel Cron Authorization 헤더 설정**: Vercel은 cron 호출에 자동으로 `Authorization: Bearer $CRON_SECRET` 주입됨. 프로젝트 Settings > Cron 확인.
- [ ] **Naver 데이터 법적 검토**
  - 네이버 부동산 크롤링 데이터(`naver_estimated_deals`, `naver_listings`) 공개 여부 법무 확인.
  - 공개 어려우면 해당 테이블 참조를 제거하거나 "추정" 라벨 + 소량 표본만 노출.
  - 현재는 API 라우트에서 `service_role` 필수 → RLS로 `anon` 접근 차단 완료.

## 🟡 품질 — 공개 권장선

- [ ] **데이터 기준 분기 라벨 검증**: 대시보드 헤더에 "2025 Q3/Q4 기준" 등 실제 DB 최신 분기 표기 (구현 완료, 실 동작 확인 필요).
- [ ] **추정치 표기**: 임대료/공실률/트렌드에 "추정치" 배지 + 하단 면책 문구 (구현 완료).
- [ ] **키워드 오탐 방지**: `AREA_DEF`에 구(gu) 필터 추가로 "강남시장(동작구)" 등 오탐 차단 (구현 완료).
- [ ] **더미값 숨김**: `rentChangeQoQ=0` / `vacancyChange=0` 시 표시 안 함 (구현 완료).
- [ ] **이용약관·개인정보처리방침 페이지** 추가 (`/terms`, `/privacy`).
- [ ] **모바일 반응형 확인**: 주요 페이지 (`/`, `/dashboard`, `/map`) iPhone SE~Pro Max 레이아웃.
- [ ] **에러 바운더리**: 대시보드 상단 fetchError 배너 (구현 완료). 지도/분석 패널도 유사 처리.

## 🟢 운영 — 공개 후 추적

- [ ] **에러 모니터링**: Sentry 또는 Vercel Log Drains.
- [ ] **Rate limiting**: 인메모리 IP limiter 적용됨 (`lib/rate-limit.ts`). 본격 공개 시 Upstash Redis 교체.
- [ ] **캐시**: `export const revalidate = 3600` 적용 완료 (area/dashboard 라우트).
- [ ] **월별 임대료 스냅샷 테이블** 구축 → `rentChangeQoQ`, `vacancyChange` 실값으로 교체.
- [ ] **Google Analytics / Plausible** 트래픽 계측.

## 📋 로컬 스모크 테스트

```bash
cd web && npm run dev
# 1. http://localhost:3000/dashboard → KPI, 트렌드, 업종별 매출 표시 확인
# 2. 상권 드롭다운에서 "강남역" 선택 → KPI 수치 변화, 헤더 분기 라벨 변경 확인
# 3. http://localhost:3000/map → 상권 클릭 → 분석 패널 5개 섹션 로드 확인
# 4. curl -I http://localhost:3000/api/cron/update-stats → 401 (secret 없이)
# 5. curl /api/area/3120189/overview 5회 연속 → 429 안 뜨는지 확인 (120/min 한도)
```

## 🔐 알려진 제약

- 서울 열린데이터 분기 공개 주기로 최신 분기는 2025 Q4 (오늘 2026-04-16 기준). "실시간" 과대 표현 금지.
- `avgBusinessYears` 계산은 분기 폐업률 ×4 근사. 정확한 개업일 정보 없음.
- 공실률 = 폐업률 ×4 근사. 공식 공실률과 다름.
- `/api/rent-nearby` fallback의 "한국부동산원 2025 Q3" 수치는 수기 기록된 것이라 시간 경과 시 업데이트 필요.
