---
name: youtube-design-upgrade
description: 편집 레인이 만든 영상 컷 파일(scene_props.json / v2_scenes.json / zip)을 받아 디자인을 B1M 수준으로 끌어올린다. 파라미터 조정이 아니라 **표현 자체를 바꾸고** 더 나은 실사·영상·브랜드 광고를 붙여 제안한다. 사용자가 컷 파일을 주거나 "디자인 개선/업그레이드"를 요청할 때 사용.
---

# 유튜브 디자인 개선

편집 레인이 만든 컷을 받아 **더 나은 표현을 제안하고 바꾼다.**

## 이 스킬의 존재 이유 — 지난번 실패에서

처음 이 일을 했을 때 나는 밝기·글씨 크기·출처 위치·색면 넓이를 조정했다.
사용자 평가는 이랬다: **"디자인이 크게 막 개선된건 아니네?"**

맞는 지적이었다. 그건 **파라미터 조정**이지 디자인 개선이 아니다.
B1M 수준이란 "이 컷을 아예 다른 방식으로 보여준다"는 뜻이다.

> **이 스킬의 제1원칙: 값을 만지지 말고 표현을 바꿔라.**
> 밝기·크기·간격 조정은 마무리 작업이지 제안이 아니다.
> 제안은 "이 컷은 자막 대신 **막대 차트**로", "여기는 브랜드 **광고 영상**으로",
> "이 숫자는 **점 격자**로" 같은 것이어야 한다.

## 절차

### 1. 받아서 현 상태를 눈으로 본다

```bash
python3 youtube_pipeline/scripts/render_cuts_stills.py <프로젝트> --out-name before
```
전 컷을 스틸로 뽑고 컨택트 시트를 만든다. **먼저 다 본다.** 안 보고 제안하지 않는다.

소재 파일이 없어 렌더가 실패하는 컷이 있으면 몇 개인지 사용자에게 먼저 알린다
(스톡 영상은 보통 저장소에서 제외돼 있다).

### 2. 진단 — 숫자로 잡는다

```bash
python3 youtube_pipeline/scripts/redesign_propose.py <프로젝트> --diagnose
python3 youtube_pipeline/scripts/quality_probe.py --dir <cuts_before 경로>
```

**가장 먼저 볼 것은 카드 편중이다.**
실측 예: 올리브영성수 123컷 중 `LowerThirdCard` 가 **86컷(70%)**.
실사 위에 한 줄 자막만 얹는 카드가 화면의 70%였다. B1M 은 이렇게 하지 않는다.

| 진단 | 기준 | 뜻 |
|---|---|---|
| 카드 편중 | 한 장치가 25% 초과 | 표현이 하나뿐 — 최우선 교체 대상 |
| 연속 반복 | 같은 카드 3연속 | 리듬이 죽음 |
| 실사 비중 | 실사 90% 초과 / 10% 미만 | 설명을 안 그렸거나, 바닥이 없음 |
| 화면값 | quality_probe 의 B1M 구간 이탈 | 소재·등급 문제 |

### 3. 재표현 제안 — 컷마다 대안을 낸다

```bash
python3 youtube_pipeline/scripts/redesign_propose.py <프로젝트> --propose > 제안.md
```

스크립트는 컷의 **문장·숫자·키워드**를 읽고 대안 장치를 고른다.
자동 제안은 초안이다. **반드시 사람이(=내가) 컷을 보고 손본다.**

교체 판단 기준 (design_reference §23-15 대응표):

| 컷이 하는 말 | 지금 흔한 표현 | 더 나은 표현 |
|---|---|---|
| 숫자 하나를 말한다 | 자막 한 줄 | `FootageStatCard` 실사 위 큰 숫자 · `PaperDotsCard` 점 격자 |
| 둘을 비교한다 | 자막 한 줄 | `PaperBarCard` · `PaperCompareCard` · `ThenNowCard` |
| 계산한다 | 자막 한 줄 | `PaperFormulaCard` |
| 위치·거리 | 자막 한 줄 | `PaperWalkCard` · `SatelliteRouteCard` · `PaperChoroCard` |
| 조건·요건을 나열 | 자막 여러 컷 | `PaperListCard` 한 장 |
| 소유·지분 구조 | 자막 한 줄 | `PaperOrgCard` |
| 남의 말을 인용 | 자막 한 줄 | `PaperQuoteCard` · `PaperPortraitCard` |
| 기사 내용 | 자막 한 줄 | `PaperPressCard` 지면 위 이동 + 형광펜 |
| 과거 이야기 | 자막 한 줄 | `ArchiveCard` · `ThenNowCard` |
| 건물 층·구성 | 자막 한 줄 | `PaperElevationCard` · `PaperSectionCard` |
| **기업·브랜드가 나온다** | 외부 사진 | **그 기업 공식 광고 영상** (아래 4번) |

### 4. 소재를 새로 구한다 — 제안의 절반은 소재다

표현만 바꾸고 소재가 그대로면 화면은 그대로다.

```bash
# 실제 대상 사진·영상 (Wikimedia 1순위 → Pexels 2순위, B1M 화면값으로 심사)
python3 youtube_pipeline/scripts/fetch_media.py --slug <이름> --subject "<대상>" --anchor <핵심어>
python3 youtube_pipeline/scripts/fetch_media.py --slug <이름> --subject "<대상>" --anchor <핵심어> --video

# 브랜드·기업이 나오면 그 기업 공식 광고·홍보 영상
python3 youtube_pipeline/scripts/fetch_brand_media.py --brand "<기업>" --context "<대본 키워드>" --list-only
python3 youtube_pipeline/scripts/fetch_brand_media.py --brand "<기업>" --context "<대본 키워드>" --slug <이름>
```

원칙:
- **영상 > 사진.** 영상은 모션블러로 엣지가 낮고 조명으로 채도가 높아 B1M 구간에 잘 맞는다.
  정지 사진은 아무리 등급해도 "너무 날카롭고 밋밋"에서 못 벗어난다.
- **브랜드가 나오면 그 브랜드가 만든 화면을 쓴다.** 감도가 다르다.
  단 타인 저작물이므로 **짧게 인용**하고 `SourceClipCard` 의 `courtesy` 로
  화면에 `COURTESY OF <채널>` 을 반드시 띄운다.
- 받은 소재는 `credits.json` 에 출처·라이선스가 자동 기록된다. 지우지 않는다.

### 5. 제안을 렌더해서 보여준다 — 말로 하지 않는다

제안 컷들만 새 scene_props 로 만들어 렌더하고, 원본과 나란히 붙인다.

```bash
python3 youtube_pipeline/scripts/render_cuts_stills.py <프로젝트> --out-name proposal
python3 youtube_pipeline/scripts/redesign_propose.py <프로젝트> --sheet before,proposal
```

**한 컷에 대안이 둘 이상이면 둘 다 렌더해서 고르게 한다.** 사용자가 선택한다.

### 6. 선택을 반영한다

사용자가 고른 것만 원본 `scene_props.json` 에 반영한다.
**완성본을 마음대로 덮어쓰지 않는다** — 새 파일로 내거나 명시적 승인을 받는다.

## 하지 말 것

- **대본에 없는 사실을 만들지 않는다.** 층수·금액·날짜를 추측해 화면에 쓰지 않는다.
  모르면 중립 표기("상층부"). `scene_lint.py` 의 FACT 규칙이 잡는다.
- **하단 260px 를 침범하지 않는다** (자막 자리).
- **인물 촬영 영상은 만들지 않는다.** 사용자가 직접 넣고 뺀다.
- **모든 요소를 움직이지 않는다.** 움직임은 강조에만 (`motion: still/accent/full`).
- 값만 조정하고 "개선했다"고 하지 않는다.

## 참고 문서

- `youtube_pipeline/design_reference.md` §23 — v4 디자인 체계 (B1M 실측 기반)
  - §23-15 대본 → 장치 대응표 (**카드 고를 때 여기부터**)
  - §23-17 모션 예산
- `youtube_pipeline/DESIGN_LANE.md` — 두 레인 협업 규약
- `youtube_pipeline/reference/device_catalog/` — 장치 32종 실물 시트

## 도구 목록

| 도구 | 하는 일 |
|---|---|
| `render_cuts_stills.py` | 컷 전수 스틸 + 컨택트 시트 (`--upgrade` 로 개선 레이어 on/off) |
| `redesign_propose.py` | 카드 편중 진단 · 컷별 대안 장치 제안 · 비교 시트 |
| `quality_probe.py` | B1M 558프레임 대비 화면값 측정 |
| `motion_probe.py` | 시간축 검수 — 정착 시점·잔여 움직임 |
| `scene_lint.py` | 창작 방지·강조 과다·모션 리듬·자막 안전영역 |
| `fetch_media.py` | 실사 사진·영상 수급 (화면값 심사 포함) |
| `fetch_brand_media.py` | 브랜드 공식 광고 영상 수급 |
| `device_catalog.py` | 장치 32종을 같은 소재로 렌더 (체계 점검) |
