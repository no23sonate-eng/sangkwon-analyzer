# 더 파크사이드 서울 — 편집 패키지

11조 용산 유엔사 부지 개발. 13개 섹션 스크립트 → **32장면 / 약 7분 24초**.
설명 그래픽 사이에 **공식 프로젝트 필름 12컷(81초, 전체의 18%)** 이 끼어 있다.

## 폴더

```
projects/더파크사이드서울/
├─ scene_plan.json                 타이밍(start/end/dur) + 내레이션 + 실사 편성(cardDur/broll)
├─ scene_props.json                장면별 카드 종류 + props (문구·수치는 여기만 고치면 됨)
├─ footage/                        공식 프로젝트 필름 원본 6편 (gitignore)
├─ clips/                          렌더 결과 — secNN_key.mp4(카드) / secNN_key_b.mp4(실사)
├─ stills/                         검수용 png
└─ 더파크사이드서울_타임라인.xml     프리미어 임포트용 시퀀스
```

## 실사 컷 편성

한 장면이 [앞: 설명 카드] + [뒤: 실사] 두 컷으로 쪼개진다. 내레이션은 그대로
흐르고 그림만 바뀌므로 타이밍은 안 건드려도 된다.

| 장면 | 카드 | 실사 | 내용 |
|---|---|---|---|
| 0 | — | 5.5s | 위성 → 용산 부지 줌인 → 남산 (오프닝) |
| 1 | 11.0s | 6.2s | 야간 조감 |
| 6 | 12.0s | 6.0s | 야경 조감 |
| 7 | 12.2s | 6.5s | 도로변 투시 |
| 10 | 10.5s | 5.4s | 동 사이 협곡, 카메라 상승 |
| 14 | 10.0s | 5.3s | 파사드 상승 |
| 16 | 9.5s | 5.6s | 지상 가로 |
| 18 | — | 13.3s | 리테일 가로 (신세계 제휴 구역) |
| 20 | 7.5s | 5.4s | 라운지 인테리어 |
| 22 | 10.5s | 5.4s | 발코니에서 용산공원 조망 |
| 29 | 10.5s | 5.8s | 준공 이미지 |
| 31 | — | 10.6s | 개구부 너머 용산공원 (엔딩) |

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

# 실사 구간을 바꿀 때 → scene_plan.json 의 cardDur / broll.ss 수정 후
python3 youtube_pipeline/scripts/render_broll.py 18 31

# 타이밍을 바꿀 때 → scene_plan.json 의 start/end/dur 수정 후
python3 youtube_pipeline/scripts/render_parkside.py
python3 youtube_pipeline/scripts/render_broll.py
python3 youtube_pipeline/scripts/build_parkside_xml.py
```

실사 원본(`footage/`)은 용량 때문에 git 에 없다. 다시 받으려면
`scripts/fetch_parkside_images.py` 와 같은 방식으로 공식 홈페이지에서
Vimeo 서명 URL 을 긁어야 한다 (서명은 만료될 수 있음).

## 이미지 출처

`motion/public/parkside/CREDITS.md` 참조. Wikimedia 두 장(평택 기지, 로즈우드
홍콩)은 CC 라이선스라 **화면 출처 표기가 의무**다 — `source` prop 을 지우지 말 것.
재수집은 `scripts/fetch_parkside_images.py`.
