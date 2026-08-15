# 유튜브 제작 시스템 — 운영 매뉴얼

`design_reference.md` 가 **무엇을 어떻게 그리는가**(그래픽 문법)라면,
이 문서는 **한 편을 어떤 순서로 만드는가**(공정)다.

---

## 0. 한 편 만드는 순서

```bash
P=새프로젝트

# 1. 스크립트 → 장면·타이밍·카드·챕터 초안
python3 youtube_pipeline/scripts/plan_from_script.py 스크립트.md --project $P --dry   # 먼저 눈으로
python3 youtube_pipeline/scripts/plan_from_script.py 스크립트.md --project $P

# 2-a. 소재 수집 — 반드시 컨택트시트를 눈으로 보고 채택한다
python3 youtube_pipeline/scripts/suggest_queries.py $P            # 장면별 영어 검색어 제안
python3 youtube_pipeline/scripts/suggest_queries.py $P --collect  # 제안대로 바로 수집
#     지도 — **좌표는 반드시 --find 로 찾는다. 손으로 찍지 말 것 (§34-4)**
python3 youtube_pipeline/scripts/fetch_map.py $P --name x --find "녹사평역" --find "용산공원"
#     주변 건물 3D 매싱 — 발자국은 실제, 높이는 추정이니 화면에 밝힐 것
python3 youtube_pipeline/scripts/fetch_buildings.py $P --name x --center 37.5341 126.9881 --radius 260
#     찍히는 bounds 를 MapCard 에 그대로 붙인다
python3 youtube_pipeline/scripts/fetch_map.py $P --name yongsan \
    --center 37.5326 126.9800 --zoom 15 --style light
python3 youtube_pipeline/scripts/fetch_sources.py $P --q "검색어" --video "검색어" --limit 6
python3 youtube_pipeline/scripts/fetch_sources.py $P --adopt <ID> <파일명>
#     회사·브랜드 로고는 --logo 를 붙인다 (누끼 + 알파 PNG + logoInvert 판정까지)
python3 youtube_pipeline/scripts/fetch_sources.py $P --logo --q "회사명"
python3 youtube_pipeline/scripts/fetch_sources.py $P --adopt <ID> conran --logo

# 2-b. scene_props.json 의 빈 값을 채운다 (여기가 사람의 일)
#      scene_plan.json 의 chapters[].name 도 여기서 짓는다 — 자동으로 안 짓는다

# 3. 검수용 스틸 → 눈으로 확인 → 고치기 반복
python3 youtube_pipeline/scripts/render_parkside.py --still
python3 youtube_pipeline/scripts/qa_check.py $P            # ERROR 0 될 때까지

# 4. 본 렌더
python3 youtube_pipeline/scripts/render_parkside.py
python3 youtube_pipeline/scripts/render_broll.py
python3 youtube_pipeline/scripts/qa_check.py $P            # 클립까지 포함해 재검사

# 5. 납품물
python3 youtube_pipeline/scripts/build_parkside_xml.py     # 프리미어 시퀀스
python3 youtube_pipeline/scripts/export_srt.py $P          # 자막 초안
python3 youtube_pipeline/scripts/export_description.py $P --logline "한 문장"  # 설명문(목차+출처)
python3 youtube_pipeline/scripts/make_thumbnails.py $P \
    --bg $P/hero.jpg --stamp "11조 사업" --stamp-sub "서울 용산" --arrow "0.55,0.62" \
    --verdict "왜 20층?"                                    # 썸네일 A~E안
python3 youtube_pipeline/scripts/make_shorts.py $P --list   # 쇼츠 후보 → --ids 로 생성
```

**규칙: `qa_check.py` 에서 ERROR 가 하나라도 있으면 납품하지 않는다.**

---

## 1. 스크립트 → 장면 (`plan_from_script.py`)

- 낭독 속도 **5.53자/초** — 파크사이드 확정 타이밍(443.5초)에 맞춰 역산한 값.
  같은 스크립트를 넣으면 445.2초가 나온다(오차 0.4%). 새 영상에서 어긋나면
  `CPS` 하나만 고친다.
- 숫자·영문은 또박또박 읽으므로 **1.6배 가중**. 이걸 빼면 수치가 많은 구간이 짧게 잡힌다.
- 15초 넘는 장면은 자동으로 `[카드 + 실사]` 로 쪼갠다. 첫 30초에 컷이 3개 미만이면
  앞쪽을 더 나눈다 (아래 §2).
- 카드 추천 정확도는 파크사이드 기준 32장면 중 17개 정확 일치 + 근접 다수.
  **초안이다. 반드시 사람이 훑는다.**

---

## 2. 리텐션 규칙 (2026 기준, `qa_check.py` 가 강제)

| 항목 | 기준 | 근거 |
|---|---|---|
| 한 컷 최대 | **15초** | 그 이상 정지하면 이탈이 는다 |
| 컷 스위트스팟 | 3~8초 | 대부분의 컷이 이 안에 |
| 첫 30초 | **컷 3개 이상** | 시청 지속 여부가 여기서 갈린다 |
| 오프닝 | 채널 인트로 금지, 가치 문장부터 | "이 영상에서 뭘 얻는가"를 먼저 |
| 훅 재배치 | 3~4분마다 | 중반 이탈 구간 |
| 평균 컷 | 10초 아래 목표 | 설명 영상이라도 |

> 파크사이드 실측: 컷 43개 · 평균 10.0초 · 최장 16.5초 · 3~8초 구간 33%.
> 평균이 기준선이라 **다음 편은 실사 컷을 더 잘게 끼워 넣는 게 과제**다.

---

## 3. 모션 (선택, `MotionShell` + `MotionWrap`)

`scene_props.json` 의 장면에 `motion` 을 넣으면 카드를 다시 그리지 않고
전환·강조 모션이 붙는다. 렌더러가 알아서 `MotionWrap` 컴포지션으로 돌린다.

```json
"3": {
  "card": "SkylineCompareCard",
  "motion": {"dir": "up", "push": 0.04, "punchAt": 2.6, "punch": 0.05, "exitSec": 0},
  "props": { ... }
}
```

| 키 | 뜻 | 권장 |
|---|---|---|
| `dir` | 밀고 들어오는 방향 `left/right/up/down` | 연속 컷은 같은 방향으로 이어받기 |
| `push` | 홀드 동안 커지는 비율 | 0.04~0.05 (표·타임라인은 **0**) |
| `punchAt` | 강조 푸시 시점(초) | 핵심 수치가 도착하는 순간 |
| `exitSec` | 밀고 나가는 시간(초) | 실사로 넘어가는 컷만 0.5 |

**표·타임라인·평면 비교에는 `push` 를 주지 않는다.** 눈이 좌표를 읽어야 하는데
화면이 계속 커지면 비교 기준이 흔들린다.

---

## 4. 자동 검사 (`qa_check.py`)

| 검사 | 잡는 사고 |
|---|---|
| 데이터 정합 | plan/props 카드 불일치, 장면 누락 |
| 자산 존재 | 없는 이미지를 가리키는 props |
| 출처 표기 | CC 자산의 저작자 표기 누락 (**라이선스 위반**) |
| 클립 규격 | 해상도·fps·길이 불일치, 용량 폭주 |
| 타임스케일 | 90k 아닌 클립 → concat 시 길이 폭발(7분→41분) |
| 리텐션 | 15초 초과 컷, 오프닝 컷 부족, 평균 컷 길이 |
| 자막 안전영역 | 하단 260px 침범 (배경 대비로 판정 — 다크 카드도 됨) |

실제로 이 검사기를 처음 돌렸을 때 **`TimelineRailCard` 축 라벨이 자막 영역으로
내려가 있었고, `SkylineCompareCard` 단서 조항은 아예 자막 자리에 있었다.** 둘 다 고쳤다.

---

## 5. 파생물

- **자막**(`export_srt.py`) — 장면 타이밍을 그대로 써서 SRT 초안. 숫자 안 쉼표에서
  줄이 끊기지 않고, 8자 이하 꼬리는 앞줄에 붙인다.
- **쇼츠**(`make_shorts.py`) — 1080×1920. 원본을 크게 흐려 배경으로 깔고 그 위에
  16:9 클립을 얹는다. 훅은 수치가 가장 많은 문장에서 자동 추출.
  하단 420px 는 쇼츠 UI 가 가리므로 비운다.
- **썸네일**(`make_thumbnails.py`) — 1280×720 3안(빅넘버 / 대조 / 질문).
  글자 최소 68px, 옐로는 한 곳에만, 우하단은 재생시간 배지 자리라 비운다.

---

## 6. 자산 규칙

- 공식 홈페이지가 있으면 **블로그·기사 재게재본보다 공식 CDN 원본**을 쓴다.
  Zyro/Wix 계열은 `https://assets.zyrosite.com/<사이트키>/<파일명>` 로 원본이 열린다.
- 수집한 이미지는 **반드시 한 번 열어서 눈으로 확인**한다. 파일 이름이 맞다고
  건물이 맞는 게 아니다 (에테르노 3장이 다른 프로젝트 렌더였던 사고).
- CC 라이선스 자산은 `qa_check.py` 의 `CC_ASSETS` 에 등록해 둔다 — 표기가 빠지면
  ERROR 로 잡힌다.
- 스톡 영상: 이 환경에서 Pexels·Pixabay·Videvo 는 403. **Mixkit 은 통과**
  (`https://assets.mixkit.co/videos/{id}/{id}-720.mp4`, 720p 만).

---

## 7. 안 하기로 한 것 (판단 기록)

- **`@remotion/transitions` 도입 안 함.** `TransitionSeries` 는 여러 장면을 한 파일로
  렌더할 때 쓰는 물건인데, 우리는 **컷을 따로 뽑아 프리미어에서 붙이는** 구조다.
  전환을 파일 안에 구워 버리면 편집에서 길이를 못 민다. `MotionShell` 로 컷 단위
  진입/퇴장만 얹는 게 이 워크플로에 맞다.
- **자동 업로드·API 연동 안 함.** 업로드는 사람이 최종 확인하고 누르는 게 맞다.

---

## 7-2. 수정 프로토콜

사용자 지적이 오면 **좌표를 만지기 전에** 이 순서를 지킨다.

1. 지적을 **배치 규칙**으로 번역한다 ("겹친다" → 두 블록이 같은 흐름에 없다)
2. `layout.jsx` 의 `flow()` 로 고친다. y 상수를 손으로 밀지 않는다
3. 고친 뒤 **`qa_check.py` 를 먼저** 돌린다 — 보여 주기 전에
4. 같은 결함이 다른 카드에도 있는지 **전수 확인**한다
5. 규칙을 `design_reference.md` 에 적는다

이번 세션에서 자막 영역 침범을 세 카드에서 **따로따로** 고쳤다. 4번을 지켰으면
한 번에 끝났을 일이다.

## 7-3. 그래픽 어휘

| 카드 | 언제 |
|---|---|
| `MapCard` | **위치를 말할 때는 반드시.** 위경도로 핀·영역·경로 |
| `ArticleCard` | 기사·보도자료를 인용할 때. **원문 통째 + 형광펜** |
| `IsoDiagramCard` | "어떻게 생겼나" — 덩어리·배치. 얕은 3D 축측 |
| `SectionDiagramCard` | **"얼마나 깊나"** — 깊이·경계. 단면 (주황 채움 + 점선 계획) |
| `LayerPeelCard` | **"안에 뭐가 들었나"** — 층을 벗기거나 잘라서 본다. 실제 3D (§35-7) |
| `MassingCard` | **"어떤 동네에 서나"** — OSM 실제 건물 발자국을 세운 3D 매싱 (§35-8) |
| `NodeArrayCard` | **"몇 곳만 신호를 낸다"** — 점 배열 중 일부를 짚고 잇는다. 센서·출구망 (§36) |
| `BrandCard` | 회사·브랜드가 **처음 나올 때**. 누끼 로고 + 한 줄 (`split`/`mark`) |
| `TrackRecordCard` | "그 회사가 뭘 해왔는데" — 레퍼런스를 도장 찍듯 떨어뜨린다 |
| `StrikeSwapCard` | 값이 **대체**될 때. 옛 값 → 취소선 → 새 값 |
| `AnnotatedShotCard` | 항공샷·배치도를 **훑으며** 짚을 때. `pointer` 3종 |
| `ScaleCompareCard` | "그래서 얼마나 큰데?" — 실제 미터 + 사람 1.7m |
| `BeforeAfterCard` | 같은 지점의 전/후. **화각이 맞을 때만** |
| `NumberIn` | 강조 수치는 마스크 리빌 + 카운트업 + 밑줄 |

`AnnotatedShotCard.pointer` (비트별 `b.pointer` 로 덮어씀)
- `arrow` **기본** — 손으로 그린 듯 휜 화살표. 사진 위에서는 이게 맞다
- `ring` — 링 + 직선. **도면·배치도**처럼 한 점을 정확히 찍어야 할 때만
- `circle` — 점선 원. "여기가 비었다 / 여기가 문제다"
- `box` — 점선 사각. **"이게 그거다"** — 대상을 지목한다 (§35-3 ③)

실사 문구 처리 (`render_broll.py --style`)
- `stamp` **기본 권장** — 검정 상자 + 흰 글씨 2단. 스크림을 안 깔아 사진이 산다
- `center` / `lower` / `band` — 스크림을 깐다. 하늘·단색 배경 실사에서만
- 연속 두 컷이 같은 처리면 안 된다. `qa_check` 가 센다

**배경은 멎지 않는다** (§32-5). 종이 카드 21종이 `bg` 를 받는다:
`bg: {backdrop: "프로젝트/사진.jpg", veil: 0.9, dir: 0~5}`
→ 격자 아래에 실사가 깔려 5초에 배율 +3.5%·이동 1.4% 로 **등속** 이동한다.
사진은 주인공이 아니라 질감이라 베일로 눌러 놓는다. `dir` 은 컷마다 돌려 쓸 것.

인용·강조 프리미티브 (`annotate.jsx`)
- `Highlighter` — 형광펜. 기사 강조는 밑줄이 아니라 이것 (§32-1)
- `DimLine` — 치수선. **가리키는 게 아니라 재는 것**이라 손맛을 주지 않는다
- `HandArrow` / `DashCircle` / `StampLabel` — §31-4

바탕 테마 (`theme`): `paper`(크림) / `ink`(먹) / `blueprint`(청사진).
카드 51종 중 실사 카드를 뺀 전부가 받는다. **정렬(`align`)까지 합쳐 껍데기가 6종.**
연속 두 컷이 (카드 + 바탕 + 정렬) 조합까지 같으면 `qa_check` 가 경고한다.

## 7-4. 제작 원칙 3종 (design_reference §30 · **전부 기능으로 구현됨**)

1. **브랜드·기업은 로고/대표 이미지로. 누끼 필수.**
   → `fetch_sources.py --logo` + `BrandCard`
2. **줄글은 도식·그래프·예시로 바꾼다.** 표에 안 맞으면 억지로 그리지 말고 실사로 넘긴다.
   → `plan_from_script.py` 의 `RULES` 가 문장 유형을 카드로 보낸다.
     안 걸리는 문장은 `도식 불가 — 실사 b-roll 권장` 으로 말하고, 연달아 나오면 실사로 넘긴다
3. **화면은 계속 바뀐다.** 컷 평균 5초 이하 + 컷 안에서도 순차 도착 + 연속 두 컷은 껍데기를 달리한다.

## 7-5. B1M 실측 기준 (620편 · design_reference §31)

**기획할 때 이 숫자에 맞춘다.** 감이 아니라 잰 값이다.

| 항목 | 기준 | 근거 |
|---|---|---|
| 길이 | **길이를 줄일 이유 없음** | 최근 1년 중앙 15:16 (7년 전 5:33). 조회수 안 떨어짐 |
| 챕터 | **8개 · 각 90초** (p10 48s / p90 237s) | 117편 실측 |
| 인트로 | **65초** | 훅에 1분을 쓴다 |
| 컷 | 평균 5초 이하 | 자체 규칙 |
| **실사 비중** | **45% 이상** (B1M 75~90%) | 780프레임 분류 · §34-1 |
| 컷 연속성 | 2컷마다 방향 전환 | §34-2 |
| 제목 | 44자 · **지명 + 금액**을 넣는다 | 최근 2년 지명 46% · 금액 26% |
| 제목 | 최상급은 아껴 쓴다 | 11년째 12% 붙박이 — 그것만으로는 안 먹힌다 |
| 설명문 | 로그라인 1줄(61자) + 목차 + 출처 블록 | 85%가 출처 블록을 단다 |
| 썸네일 | 수치+단위 **또는** 한 단어 판정 | `$2BN` / `ABANDONED.` |

썸네일 부호: **마침표 = 끝났다 · 물음표 = 아직 모른다 · 말줄임표 = 이어진다.**

## 8. 다음 후보 (우선순위순)

1. **실사 자동 매칭** — 장면 텍스트 → 검색어 → 후보 다운로드 → 컨택트시트까지 자동.
   지금은 검색어를 손으로 준다
2. **음성 길이 실측 피드백** — 녹음 파일을 넣으면 장면별 실제 길이로
   `scene_plan.json` 을 갱신. `CPS` 추정을 없앨 수 있다
3. **A/B 기록** — 업로드한 썸네일·제목과 CTR 을 프로젝트에 적어 두고
   §7-5 기준을 실제 성과로 갱신
4. **로케이터** — "여기가 어디인가"를 넓게→좁게. 지금 0개다.
   `AnnotatedShotCard` 를 중첩 이미지 3장으로 이어 붙이면 된다
5. **챕터 제목 제안** — 자동 작성은 안 하되, 그 구간 문장에서 후보 3개를 뽑아 보여 주기

끝난 것: 컷 밀도(§9-1) · 문법 반복 검사(§9-2) · 다중 소스(§9-3) ·
누끼/`BrandCard`(§7-4) · 챕터/설명문(§7-5) · 카드 테마 개방

---

## 9. 컷 밀도 · 다중 소스 (2026-08-06 확장)

### 9-1. 화면이 더 빨리 바뀌게 — 문법이 아니라 **분할 단위**를 바꿨다

1편 실측이 평균 10.0초였다. 컷 문법을 늘려도 한 장면 = 한 문단이면 화면은 안 바뀐다.
그래서 **분할 단위를 절(쉼표)까지 내렸다.**

| 기준 | 이전 | 지금 |
|---|---|---|
| 문장 분할 | 24초(MAX_CUT×1.6) → 9초 | **6초** |
| 절(쉼표) 분할 | 없음 | **6.5초 넘는 문장** |
| 최소 컷 | 4.0초 | **1.8초** |
| 한 컷 최대 | 15초 | **10초** |
| 스위트스팟 | 3~8초 | **2.5~6초** |
| 오프닝 최소 컷 | 3개 | **5개** |

같은 파크사이드 스크립트: **43컷 · 평균 10.0초 → 93컷 · 평균 4.9초.**
내레이션은 한 글자도 안 바뀐다. 화면만 두 배 이상 자주 바뀐다.

`MIN_CUT` 을 1.8 로 내린 게 핵심이다. 2.2 로 두면 "전면 경영제휴입니다" 같은
2초짜리 마무리 절이 앞 컷에 붙어 7초짜리가 된다. **짧은 마무리 컷이 리듬을 만든다.**

### 9-2. 같은 카드가 연속되면 컷만 빨라지고 화면은 그대로다

컷을 잘게 쪼개면 인접 장면이 비슷해져 같은 카드가 줄줄이 나온다.
플래너가 `ALT` 표로 3연속부터 대안 문법으로 돌린다. `qa_check` 도 따로 센다.

> 파크사이드 1편 실측: 카드 16종 / 28컷 · **최다 SkylineCompareCard 4회 연속**.

### 9-3. 다중 소스 수집 (`fetch_sources.py`)

자료 수집이 매번 손이었다 — 뒤지고, 라이선스 확인하고, CREDITS 적고,
**잘못된 건물을 쓴 적도 있다**(에테르노 3장).

```bash
python3 youtube_pipeline/scripts/fetch_sources.py 프로젝트 \
    --q "shinsegae department store" --q "Seoul department store night" \
    --video "shopping mall"
# → 후보 20개 (Commons + Openverse + Mixkit) · 라이선스/저작자 포함
#   _candidates/contact_sheet.png 로 **눈으로 확인**

python3 youtube_pipeline/scripts/fetch_sources.py 프로젝트 --adopt b21cf550 shinsegae_plate.jpg
# → 본 폴더로 승격 + CREDITS.md 에 줄 추가 (영상은 채택 시 720p 로 재다운로드)
```

| 소스 | 종류 | 비고 |
|---|---|---|
| Wikimedia Commons | 사진 | 저작자·라이선스가 가장 확실 |
| Openverse | 사진 | Flickr 등 집계. 상업이용 가능만 필터 |
| Mixkit | 영상 | 미리보기 360p → 채택 시 720p |

**규칙: 컨택트시트를 보기 전에는 절대 본 폴더로 안 들어간다.** 첫 실행에서
"Dongdaegu Bus Center"가 신세계 검색에 섞여 나왔다 — 이름만 보고 쓰면 또 사고다.
