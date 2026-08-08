# 유튜브 제작 시스템 — 운영 매뉴얼

`design_reference.md` 가 **무엇을 어떻게 그리는가**(그래픽 문법)라면,
이 문서는 **한 편을 어떤 순서로 만드는가**(공정)다.

---

## 0. 한 편 만드는 순서

```bash
P=새프로젝트

# 1. 스크립트 → 장면·타이밍·카드 초안
python3 youtube_pipeline/scripts/plan_from_script.py 스크립트.md --project $P --dry   # 먼저 눈으로
python3 youtube_pipeline/scripts/plan_from_script.py 스크립트.md --project $P

# 2. scene_props.json 의 빈 값을 채운다 (여기가 사람의 일)
#    이미지는 motion/public/$P/ 에 모으고 CREDITS.md 를 같이 쓴다

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
python3 youtube_pipeline/scripts/make_thumbnails.py $P ...  # 썸네일 3안
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

## 8. 다음 후보 (우선순위순)

1. **컷 밀도 개선** — 평균 10초는 길다. `plan_from_script.py` 가 카드 하나를
   앞뒤 두 컷(도입 그래픽 → 수치 강조)으로 쪼개는 패턴을 넣을 것.
2. **실사 자동 매칭** — 장면 텍스트 → Mixkit 검색어 → 후보 다운로드 → 컨택트시트.
   지금은 손으로 고른다.
3. **A/B 기록** — 업로드한 썸네일·제목과 CTR 을 프로젝트에 적어 두고, 다음 기획 때
   `SYSTEM.md` 규칙을 실제 성과로 갱신.
4. **음성 길이 실측 피드백** — 녹음 파일을 넣으면 장면별 실제 길이로
   `scene_plan.json` 을 갱신하는 스크립트. `CPS` 추정을 없앨 수 있다.
