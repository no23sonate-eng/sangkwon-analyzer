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

## 컷 목록 (타임라인 순)

| 컷 | 파일 | 종류 | 길이 | 내용 |
|---|---|---|---|---|
| 1 | `sec00_hero_b.mp4` | 실사 | 5.5s | 공식 프로젝트 필름 |
| 2 | `sec01_section.mp4` | SectionPhotoCard | 11.0s | 지하7·지상20 실측 단면 |
| 3 | `sec01_section_b.mp4` | 실사 | 6.2s | 공식 프로젝트 필름 |
| 4 | `sec02_title.mp4` | ParkCompareCard | 10.4s | 센트럴파크 vs 용산공원 면적 |
| 5 | `sec03_cost3.mp4` | SkylineCompareCard | 10.0s | 사업비 2.1조 / 4.2조 / 11조 |
| 6 | `sec04_hookturn.mp4` | FullBleedCard | 8.3s | 시작은 도시가 아니었다 |
| 7 | `sec05_move.mp4` | FullBleedCard | 11.7s | 용산 → 평택 |
| 8 | `sec06_exchange.mp4` | ExchangeMotionCard | 12.0s | 기부 대 양여 (주고받기 모션) |
| 9 | `sec06_exchange_b.mp4` | 실사 | 6.0s | 공식 프로젝트 필름 |
| 10 | `sec07_rezone.mp4` | SkylineCompareCard | 12.2s | 용도지역 변경 · 용적률 상한 |
| 11 | `sec07_rezone_b.mp4` | 실사 | 6.5s | 공식 프로젝트 필름 |
| 12 | `sec08_tender.mp4` | PaperImageCard | 14.8s | 유엔사 부지 공개매각 |
| 13 | `sec09_bid.mp4` | RatioCard | 13.1s | 예정가 vs 낙찰가 |
| 14 | `sec10_founder.mp4` | PhotoStepsCard | 10.5s | 엄석오 회장 4단계 |
| 15 | `sec10_founder_b.mp4` | 실사 | 5.4s | 공식 프로젝트 필름 |
| 16 | `sec11_far.mp4` | SkylineCompareCard | 15.0s | 용적률 1300 / 800 / 600 |
| 17 | `sec12_conflict.mp4` | ExchangeMotionCard | 13.4s | 국방부 vs 서울시 논쟁 (주고받기 모션) |
| 18 | `sec13_sightline.mp4` | SightlineCard | 11.9s | 반포대교 → 남산 7부능선 |
| 19 | `sec14_section2.mp4` | SectionPhotoCard | 10.0s | 70m, 그래서 지하로 |
| 20 | `sec14_section2_b.mp4` | 실사 | 5.3s | 공식 프로젝트 필름 |
| 21 | `sec15_retail.mp4` | RatioCard | 11.2s | 상업시설 비중 8.1% vs 2.7% |
| 22 | `sec16_needop_b1.mp4` | 실사 | 5.0s | 임차인 트렌드가 빠르다 |
| 23 | `sec16_needop_b2.mp4` | 실사 | 5.0s | 소비 사이클에 민감하다 |
| 24 | `sec16_needop_b3.mp4` | 실사 | 5.1s | 그래서 운영사가 필요해진다 |
| 25 | `sec17_mori.mp4` | PhotoStepsCard | 16.5s | 모리빌딩 3개 프로젝트 |
| 26 | `sec18_shinsegae_b.mp4` | 실사 | 13.3s | 공식 프로젝트 필름 |
| 27 | `sec19_ss_area.mp4` | AreaNestCard | 11.4s | 제휴 구역 면적 4,980평 vs 1,500평 |
| 28 | `sec20_rosewood.mp4` | FullBleedCard | 7.5s | 로즈우드 (홍콩 전체화면) |
| 29 | `sec20_rosewood_b.mp4` | 실사 | 5.4s | 공식 프로젝트 필름 |
| 30 | `sec21_rank.mp4` | RankTrendCard | 15.3s | 50 Best Hotels 2위→3위→1위 |
| 31 | `sec22_stack.mp4` | ElevatorCard | 9.0s | 엘리베이터로 위아래 연결 |
| 32 | `sec22_stack_b1.mp4` | 실사 | 3.4s | 로즈우드 라운지 · 스파 |
| 33 | `sec22_stack_b2.mp4` | 실사 | 3.5s | B1 신세계 공간 |
| 34 | `sec23_recover.mp4` | PhotoStepsCard | 12.5s | 회수 시점 셋 |
| 35 | `sec24_layout.mp4` | FullBleedCard | 14.8s | 세대는 숲을 품었다 |
| 36 | `sec25_split.mp4` | SplitCard | 13.1s | 개발사 vs 운영사 |
| 37 | `sec26_azabu.mp4` | TimelineRailCard | 13.1s | 아자부다이 34년 vs 10년 |
| 38 | `sec27_subscribe.mp4` | BigStatsCard | 12.5s | 청약 경쟁률 |
| 39 | `sec28_price.mp4` | SkylineCompareCard | 13.6s | 분양가 — 평면 면적 비교 |
| 40 | `sec29_timeline.mp4` | TimelineRailCard | 10.5s | 남은 일정 2027 |
| 41 | `sec29_timeline_b.mp4` | 실사 | 5.8s | 공식 프로젝트 필름 |
| 42 | `sec30_eterno.mp4` | PhotoSplitCard | 13.8s | 다른 전략 — 에테르노 용산 |
| 43 | `sec31_closing_b.mp4` | 실사 | 10.6s | 공식 프로젝트 필름 |

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
