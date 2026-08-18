# 채널 디자인 학습 근거 이미지 (2026-08-18)

`design_reference.md` §20 의 실측 근거. 각 시트는 썸네일 12장을 3열로 묶은 것.

| 파일 | 내용 |
|---|---|
| `b1m_recent_sheet1.jpg` | The B1M 최신 장편 12편 |
| `b1m_top_sheet1.jpg` / `b1m_top_sheet2.jpg` | The B1M 최다조회 24편 |
| `sh_recent_sheet1.jpg` / `sh_recent_sheet2.jpg` | Stewart Hicks 최신 24편 |
| `sh_top_sheet1.jpg` / `sh_top_sheet2.jpg` | Stewart Hicks 최다조회 24편 |

수집 방법: 채널 전체 영상 목록을 받아(B1M 621편 / SH 159편) 5분 이상
장편만 걸러 최신순·조회순 상위를 뽑고, 원본 해상도 썸네일을 내려받아
컨택트 시트로 합성 + 픽셀 단위 색 통계를 냈다.

1차 시점엔 영상 프레임을 못 받았다(봇차단). **원인은 JS 런타임 부재였고
2차에서 해결됨** — 아래 참고.

## 2차 — 영상 본편 프레임 (2026-08-18)

`video_*.jpg` = 실제 영상에서 뽑은 프레임 컨택트 시트 (B1M 3편 / SH 3편,
편당 18프레임). 1차 썸네일 분석보다 **이쪽이 제작 기준**이다 →
`design_reference.md` §21.

수집 스크립트: `youtube_pipeline/scripts/grab_video_frames.py`
전제: `deno` 설치 필요 (없으면 유튜브가 봇으로 차단).
```
curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- -y
python3 youtube_pipeline/scripts/grab_video_frames.py <video_id> <out_prefix> 18
```
