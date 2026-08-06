# 더 파크사이드 서울 — 이미지 출처

화면 우하단 `source` 캡션에 표기할 문자열을 함께 적어둔다.
(카드 렌더 시 `source` prop 으로 그대로 넣는다.)

| 파일 | 원본 | 출처 / 라이선스 | 화면 표기 |
|---|---|---|---|
| `hero.jpg` | `/img/etc/thumb-universe.jpg` | 더파크사이드 서울 공식 홈페이지 (theparksideseoul.com) · 조감도 | `이미지: 더파크사이드 서울` |
| `centralpark.jpg` | `/img/etc/etc-seoul-pic05.jpg` | 동상 · 센트럴파크(3,410,000㎡) / 용산공원(3,030,000㎡) 면적 비교 다이어그램 | `이미지: 더파크사이드 서울` |
| `map.jpg` | `/img/ill_map3.jpg` | 동상 · 용산 일대 일러스트 지도 | `이미지: 더파크사이드 서울` |
| `retail.jpg` | `/suites_resource/img/etc/home-visual.jpg` | 동상 · 리테일 가로 투시도 | `이미지: 더파크사이드 서울` |
| `layout.jpg` | `/img/etc/etc-uni-pic-plan.jpg` | 동상 · 단지 배치 조감도 | `이미지: 더파크사이드 서울` |
| `closing.jpg` | `/upload/board/news/…_조감도_Background_01.jpg` | 동상 · 용산공원 방향 조감도 | `이미지: 더파크사이드 서울` |
| `sectional.jpg` | 사용자 제공 `THE PARKSIDE SEOUL SECTIONAL LAYOUT` | 시행사 공식 단면 도면 | `도면: 더파크사이드 서울` |
| `shape_centralpark.png` / `shape_yongsanpark.png` | `etc-seoul-pic05.jpg` 에서 추출한 공원 경계 실루엣 | 동상 | (실사 출처와 함께 표기) |
| `photo_centralpark.jpg` | Wikimedia `Central Park New York skyline (22212172922).jpg` | dronepicr, **CC BY 2.0** | `사진: dronepicr / CC BY 2.0` |
| `photo_yongsanpark.jpg` | Wikimedia `Korea Yongsan Family Park 20140421 01 (13939732142).jpg` | Korea.net (Jeon Han), **CC BY-SA 2.0** | `사진: Korea.net / CC BY-SA 2.0` |
| `humphreys.jpg` | Wikimedia Commons `Aerial Tour 2 Camp Humphreys, Sept. 13, 2017 (37293016265).jpg` | USAG-Humphreys, **CC BY 2.0** | `사진: USAG Humphreys / CC BY 2.0` |
| `rosewood.jpg` | Wikimedia Commons `Rosewood Hong Kong Lobby 201906.jpg` | Wpcpey, **CC BY-SA 4.0** | `사진: Wpcpey / CC BY-SA 4.0` |

## 단면 도면 (`sectional.jpg`)

원본은 상하 여백을 잘라 **가로/세로 2.124** 로 맞춰 두었고, 도면 안에서 지반
(광장·가로 레벨)이 **세로 0.7132** 위치에 있다. `SectionPhotoCard` 는 이 두 값으로
도면을 배치한다 — `cover` 로 깔면 지반이 화면 아래(y≈770)에 박혀 지하 수치가
자막 영역으로 밀려 내려간다. 잘라내는 비율을 바꾸면 두 값도 같이 고쳐야 한다.

주의: 좌측 로즈우드 동은 **지상부도 절개**돼 있어서 어두운 면이 시작되는 곳을
지반으로 잡으면 안 된다. 사람이 걷는 광장 레벨이 지반이다.

## 주의

- 공식 홈페이지 조감도·투시도는 **저작권이 시행사(일레븐건설)에 있다.** 보도·비평 목적
  인용 범위에서 쓰고, 화면에 반드시 출처를 남긴다. 썸네일·광고 소재로는 쓰지 않는다.
- Wikimedia 두 장은 CC 라이선스라 **저작자 표기가 의무**다. 위 "화면 표기" 문자열을
  빼지 말 것.
- 홈페이지는 CUPID(국내 WAF) JS 챌린지가 걸려 있어 일반 curl 로는 못 받는다.
  재수집은 `youtube_pipeline/scripts/fetch_parkside_images.py` 로 한다.
