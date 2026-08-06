# 더 파크사이드 서울 — 편집 패키지

11조 용산 유엔사 부지 개발. 13개 섹션 스크립트 → **32장면 / 약 7분 24초**.
설명 그래픽 사이에 **실사 15컷**(공식 프로젝트 필름 + Mixkit 스톡) 이 끼어 있다.
**총 43컷** (카드 28 + 실사 15) / 443.5초.

## 폴더

```
projects/더파크사이드서울/
├─ scene_plan.json                 타이밍(start/end/dur) + 내레이션 + 실사 편성(cardDur/broll)
├─ scene_props.json                장면별 카드 종류 + props (문구·수치는 여기만 고치면 됨)
├─ footage/                        공식 프로젝트 필름 원본 6편 (gitignore)
├─ clips/                          렌더 결과 — secNN_key.mp4(카드) / secNN_key_b.mp4(실사)
│                                  한 장면에 실사가 여러 컷이면 _b1 _b2 _b3
├─ stills/                         검수용 png
└─ 더파크사이드서울_타임라인.xml     프리미어 임포트용 시퀀스
```

## 실사 컷 편성

한 장면이 [앞: 설명 카드] + [뒤: 실사] 두 컷으로 쪼개진다. 내레이션은 그대로
흐르고 그림만 바뀌므로 타이밍은 안 건드려도 된다.

| 장면 | 카드 | 실사 | 내용 |
|---|---|---|---|
| 0 | — | 5.5s | 공식 필름 |
| 1 | 11.0 | 6.2s | 공식 필름 |
| 6 | 12.0 | 6.0s | 공식 필름 |
| 7 | 12.2 | 6.5s | 공식 필름 |
| 10 | 10.5 | 5.4s | 공식 필름 |
| 14 | 10.0 | 5.3s | 공식 필름 |
| 16 | — | 5.0s + 5.0s + 5.1s | 임차인 트렌드가 빠르다, 소비 사이클에 민감하다, 그래서 운영사가 필요해진다 |
| 18 | — | 13.3s | 공식 필름 |
| 20 | 7.5 | 5.4s | 공식 필름 |
| 22 | 9.0 | 3.4s + 3.5s | 로즈우드 라운지 · 스파, B1 신세계 공간 |
| 29 | 10.5 | 5.8s | 공식 필름 |
| 31 | — | 10.6s | 공식 필름 |

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
| 0 | — (실사) | 조감도 (훅) |
| 1 | SectionPhotoCard | 지하7·지상20 실측 단면 |
| 2 | ParkCompareCard | 센트럴파크 vs 용산공원 면적 |
| 3 | SkylineCompareCard | 사업비 2.1조 / 4.2조 / 11조 |
| 4 | FullBleedCard | 시작은 도시가 아니었다 |
| 5 | FullBleedCard | 용산 → 평택 |
| 6 | ExchangeMotionCard | 기부 대 양여 (주고받기 모션) |
| 7 | SkylineCompareCard | 용도지역 변경 · 용적률 상한 |
| 8 | PaperImageCard | 유엔사 부지 공개매각 |
| 9 | RatioCard | 예정가 vs 낙찰가 |
| 10 | PhotoStepsCard | 엄석오 회장 4단계 |
| 11 | SkylineCompareCard | 용적률 1300 / 800 / 600 |
| 12 | ExchangeMotionCard | 국방부 vs 서울시 논쟁 (주고받기 모션) |
| 13 | SightlineCard | 반포대교 → 남산 7부능선 |
| 14 | SectionPhotoCard | 70m, 그래서 지하로 |
| 15 | RatioCard | 상업시설 비중 8.1% vs 2.7% |
| 16 | — (실사) | 운영사가 필요해진다 (실사 3컷) |
| 17 | PhotoStepsCard | 모리빌딩 3개 프로젝트 |
| 18 | — (실사) | 신세계 MOU |
| 19 | AreaNestCard | 제휴 구역 면적 4,980평 vs 1,500평 |
| 20 | FullBleedCard | 로즈우드 (홍콩 전체화면) |
| 21 | RankTrendCard | 50 Best Hotels 2위→3위→1위 |
| 22 | ElevatorCard | 엘리베이터로 위아래 연결 |
| 23 | PhotoStepsCard | 회수 시점 셋 |
| 24 | FullBleedCard | 배치 — 분양 동을 숲에 |
| 25 | SplitCard | 개발사 vs 운영사 |
| 26 | TimelineRailCard | 아자부다이 34년 vs 10년 |
| 27 | BigStatsCard | 청약 경쟁률 |
| 28 | SkylineCompareCard | 분양가 — 평면 면적 비교 |
| 29 | TimelineRailCard | 남은 일정 2027 |
| 30 | PhotoSplitCard | 다른 전략 — 에테르노 용산 |
| 31 | — (실사) | 클로징 |

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
