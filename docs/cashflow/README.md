# 캐쉬플로우 학습·작성 시스템

업로드한 실전 재무모델을 학습해 표준 골격·요율을 축적하고, 신규 캐쉬플로우 작성 시 재사용한다.

## 구성

- `model-spec.md` — **학습 통합 스펙**. 신규 캐쉬플로우 작성 시 따르는 표준 골격 (유형 분기 → 시트 아키텍처 → TIC 트리 → CF 엔진 → 운영/Exit → 시나리오 → 체크리스트)
- `models/*.md` — 학습된 개별 모델 상세 분석 (누적)
- `web/lib/data/cashflow-knowledge.json` — 머신리더블 학습 파라미터 (요율·지수·엔진 규칙 + 근거 모델 태그). 캐쉬플로우 생성기가 소비
- `data/cashflow-docs/` — 원본 엑셀 (**gitignore**, 비공개)

## 캐쉬플로우 생성기 (`/cashflow` 페이지)

카테고리·면적만 정하면 학습 요율로 캐쉬플로우 뼈대를 자동 산출하는 툴.
- `web/lib/cashflow/types.ts` — 입력·산출 타입
- `web/lib/cashflow/defaults.ts` — 카테고리별 기본값(오피스/리테일/호텔/시니어) + 공통 학습 요율 (knowledge.json 동기). 값마다 `학습`/`추정`/`입력` 근거 태그
- `web/lib/cashflow/engine.ts` — 순차 로직: ①카테고리 → ②면적·필수요소 → ③TIC(요율 자동) → ④조달(Equity→Tr.A→B→C) → ⑤운영(램프업·NOI) → ⑥Exit(cap) → ⑦지표(IRR·MoM·DSCR)
- `web/app/cashflow/page.tsx` — 6단계 위저드 UI + 실시간 결과(TIC·조달·운영·Exit 3안·경고)

수입 모델 2종: **yield형**(오피스·리테일·호텔 — NOI÷cap 매각) / **보증금 회수형**(시니어 — 보증금이 수입, 730 사업수지 방식).
생성 뼈대는 시작점일 뿐 — `추정` 태그 항목은 실입지 견적으로 override 필요. 정밀 월별 CF·세금 엔진·계좌 워터폴은 model-spec.md 참조(v2 확장 여지).

## 새 재무모델 학습 절차 (자료 들어올 때마다)

1. 원본을 `data/cashflow-docs/`에 저장
2. Claude에게 "이 모델 학습해" 요청 → 시트 구조·TIC 트리·가정값·CF 엔진·Exit 로직 추출
3. `models/<프로젝트명>.md`로 분석 저장 + `model-spec.md`의 학습 요율표에 새 근거 병합
4. `cashflow-knowledge.json`의 해당 파라미터에 값·source 추가 (범위가 넓어지면 range로)

## 신규 캐쉬플로우 작성 절차

1. `model-spec.md` §1 유형 분기로 골격 선택 (분양형 / 임대-매각형 / 밸류애드형 / 운영 손익형)
2. §끝 체크리스트 10단계 순서로 작성
3. 요율은 knowledge.json 학습값을 기본값으로, 딜 고유 조건은 override + 출처 표기
4. 반드시 포함: Check 로직(현금부족·합계일치·청산완료), 크로스체크 블록(임대료/매출 부담률 등), 시나리오 최소 3안, Log 시트

## 학습 이력

| 일자 | 모델 | 유형 |
|---|---|---|
| 2026-07-06 | BRIX 한남동 730 v9.2 (개발) | 개발-분양(보증금)형 |
| 2026-07-06 | BRIX Cash Flow v5.2 (운영) | 운영 손익형 Prop.Co./OpCo. |
| 2026-07-06 | Project soho v6.9 | 개발-임대-매각형 (PFV) |
| 2026-07-06 | WORKSTAY v7.3 | 밸류애드-임대운영형 |
| _대기_ | Trunk Hotel HN224 v5.2 | 호텔 (원본 `data/cashflow-docs/`에 있음 — 학습 미완, 호텔 ADR·공사비 갱신 예정) |
