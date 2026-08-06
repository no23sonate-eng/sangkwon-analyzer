# 더 파크사이드 서울 — 편집 패키지

11조 용산 유엔사 부지 개발. 13개 섹션 스크립트 → **32장면 / 약 7분 24초**.

## 폴더

```
projects/더파크사이드서울/
├─ scene_plan.json                 장면별 타이밍(start/end/dur) + 내레이션 텍스트
├─ scene_props.json                장면별 카드 종류 + props (여기만 고치면 됨)
├─ clips/                          렌더된 mp4 32개  ← 프리미어에 넣을 것
├─ stills/                         검수용 png (프레임 78 고정)
└─ 더파크사이드서울_타임라인.xml     프리미어 임포트용 시퀀스
```

## 프리미어에 얹는 법

1. `clips/` 폴더를 로컬로 내려받는다.
2. `더파크사이드서울_타임라인.xml` 을 같은 폴더(또는 아무데나)에 둔다.
3. 프리미어 → **파일 › 가져오기** → xml 선택.
4. "미디어 찾기" 창이 뜨면 `clips` 폴더를 한 번 지정한다.
   클립이 **파일명만으로** 참조돼 있어 나머지 31개는 자동으로 붙는다.
5. 시퀀스 `더파크사이드서울_타임라인` 이 생긴다. 1920×1080 / 30fps.
6. 내레이션 오디오를 A1 에 얹고, 클립 길이를 실제 낭독 길이에 맞춰 밀면 된다.
   (타이밍은 5.3자/초 기준 추정값 — 녹음 후 조정 전제)

## 장면 구성

| # | 카드 | 내용 |
|---|---|---|
| 0 | PaperImageCard | 조감도 (훅) |
| 1 | SectionCard | 지하7·지상20 단면 |
| 2 | PaperImageCard | 센트럴파크 면적 비교 |
| 3 | SkylineCompareCard | 사업비 2.1조 / 4.2조 / 11조 |
| 4 | PaperFlowCard | 시작은 도시가 아니었다 |
| 5 | PaperImageCard | 용산 → 평택 |
| 6 | PaperFlowCard (exchange) | 기부 대 양여 |
| 7 | PaperFlowCard | 용도지역 변경 |
| 8 | PaperImageCard | 유엔사 부지 공개매각 |
| 9 | SkylineCompareCard | 예정가 vs 낙찰가 |
| 10 | PaperFlowCard | 엄석오 회장 |
| 11 | SkylineCompareCard | 용적률 1300/800/600 |
| 12 | PaperFlowCard (exchange) | 국방부 ↔ 서울시 |
| 13 | SightlineCard | 반포대교 → 남산 7부능선 |
| 14 | SectionCard | 70m, 지하로 |
| 15 | RatioCard | 상업시설 비중 8.1% vs 2.7% |
| 16 | PaperFlowCard | 운영사가 필요해진다 |
| 17 | PaperFlowCard | 모리빌딩 |
| 18 | PaperImageCard | 신세계 MOU |
| 19 | SkylineCompareCard | 제휴 구역 면적 |
| 20 | PaperImageCard | 로즈우드 |
| 21 | RankTrendCard | 50 Best Hotels 2위→3위→1위 |
| 22 | SectionCard | 위아래로 쌓인 구조 |
| 23 | PaperFlowCard | 회수 시점 셋 |
| 24 | PaperImageCard | 배치 |
| 25 | PaperFlowCard | 개발·운영 분리 |
| 26 | RatioCard (bar) | 아자부다이 8.1ha / 4.5ha |
| 27 | RatioCard (bar) | 청약 경쟁률 |
| 28 | SkylineCompareCard | 분양가 최소/최대 |
| 29 | PaperFlowCard | 남은 일정 |
| 30 | SkylineCompareCard | 에테르노 용산 |
| 31 | PaperImageCard | 클로징 |

## 고치고 싶을 때

```bash
# 문구·수치만 바꿀 때 → scene_props.json 수정 후
python3 youtube_pipeline/scripts/render_parkside.py 15 26      # 해당 장면만
python3 youtube_pipeline/scripts/render_parkside.py --still    # 검수용 스틸 전체

# 타이밍을 바꿀 때 → scene_plan.json 의 start/end/dur 수정 후
python3 youtube_pipeline/scripts/render_parkside.py
python3 youtube_pipeline/scripts/build_parkside_xml.py
```

## 이미지 출처

`motion/public/parkside/CREDITS.md` 참조. Wikimedia 두 장(평택 기지, 로즈우드
홍콩)은 CC 라이선스라 **화면 출처 표기가 의무**다 — `source` prop 을 지우지 말 것.
재수집은 `scripts/fetch_parkside_images.py`.
