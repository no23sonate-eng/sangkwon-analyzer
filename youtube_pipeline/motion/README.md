# motion — Remotion 기반 모션그래픽 카드 렌더러

`pipeline/assets_lib.py`(matplotlib+PIL)로는 안 되는 것들(진짜
그라디언트, 진짜 letter-spacing, 진짜 blur/shadow, 스프링 애니메이션/
숫자 카운트업)을 위한 별도 렌더링 백엔드. 디자인 판단 기준(왜 이
톤인지)은 `../design_reference.md` §18 참고 — 이 문서는 "어떻게
실행하는지"만 다룬다.

## 설치

```bash
cd youtube_pipeline/motion
npm install
```

Chromium은 새로 받지 않는다 — 이 환경에 이미 설치된 걸 쓴다
(`/opt/pw-browsers/`). Node/npm 이 없으면 `node --version` 으로 먼저
확인.

## 카드 하나 렌더링하기

```bash
CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
# 버전 번호(-1194)가 다를 수 있음 — 없으면:
#   find /opt/pw-browsers -maxdepth 1 -iname "chromium_headless_shell-*"

npx remotion render src/index.jsx <컴포넌트ID> <출력경로.mp4> \
  --props='{"title":"...", "durationSec": 12.3}' \
  --browser-executable="$CHROME"
```

`<컴포넌트ID>` 는 `src/Root.jsx` 에 등록된 `id` (BuildingCard/StatCard/
DataTable/QuoteCard/HeadlineCard). **주의**: 일반 `chrome` 바이너리가
아니라 `chromium_headless_shell` 을 써야 한다 — 일반 chrome은 최신
Chromium에서 구 헤드리스 모드가 제거돼 실행 자체가 실패한다(에러
메시지: "Old Headless mode has been removed").

`durationSec` prop 은 `Root.jsx` 의 `calculateMetadata` 가 읽어서
`durationInFrames` 를 동적으로 계산한다 — 카드 길이는 항상 해당
섹션(문장)의 실제 발화 길이(TTS 타이밍)에 맞춰서 넘길 것, 고정값 쓰지
말 것.

## 새 프로젝트에 카드 적용하는 전체 흐름

1. **TTS로 타이밍만 뽑기** — `espeak-ng -v ko -s 130 -p 40` 로 문장별
   wav 생성(숫자는 "삼천오백억" 처럼 발음대로 풀어써야 길이가 정확함),
   `ffprobe` 로 각 길이 측정. 최종본엔 음성 안 남긴다(아래 4번).
2. **`transcript.json` 수기 작성** — 문장별 start/end (LEAD 0.3s,
   문장간 GAP 0.4s, tail 0.6s), `sentences`+`segments`(단어 타임스탬프는
   문자 길이 비례 분배로 근사).
3. **섹션별로 카드 선택 + 렌더** — 위 "카드 하나 렌더링하기" 명령으로
   `broll_candidates/*.mp4` 생성. 문장이 길면(20초 이상) 카드 하나가
   화면에서 오래 안 죽어있게 `StatCard`(value2/subtitle2) 나
   `DataTable`(closingLine) 처럼 2단계 전환을 쓸 것.
4. **`source.mp4`(무음)** — `ffmpeg -f lavfi -i "color=c=0x0A0B0D:s=1920x1080:r=30" -t <총길이> -an source.mp4`
5. **`broll_plan.json`/`selections.json`/`subtitle_plan.json`** —
   섹션마다 `type: "video"`, `source: "remotion"`. `subtitle_plan.json`
   은 `{"cues": [], "displays": []}` 로 비움(§18-2, 자막은 사용자가
   직접 얹음).
6. **`pipeline.subtitle.build_ass()`** 로 빈 `subtitle.ass` 굽기(빈
   cues/displays 라도 render.py가 파일 존재를 요구함).
7. **`python3 -m pipeline.render <프로젝트명>`** 로 최종 합성.

`projects/하남스피어/` 가 이 흐름대로 만든 실전 예시(전체 스크립트는
`design_reference.md` §18-4).

## 알려진 버그와 우회

### 헤드리스 스크린샷 하단이 하얗게 잘리는 버그

이 샌드박스의 헤드리스 Chromium은 GPU가 없어 소프트웨어 경로로
폴백하는데(`SharedImageManager::ProduceMemory` 에러 로그가 항상
찍힘 — 무시해도 되는 노이즈), **전체 뷰포트 크기의 배경**(CSS
`radial-gradient`든 `background-image` 든)이 있으면 캔버스 하단
5~8%가 새하얗게 잘려 나온다. 작은 요소(예: 620px 원형 글로우)의
그라디언트/블러는 문제없음 — 전체 화면 크기 배경에서만 재현된다.

`pipeline/html_render.py` 의 `html_to_png()` 가 우회법: 실제 필요한
높이보다 `render_height = height / 0.72` 로 창을 넉넉히 더 키워서
요청한 뒤, 손상되는 하단 구간보다 위쪽만 크롭한다. Remotion 은 프레임
단위 캡처라 이 버그를 안 겪는다(Remotion 자체 컴포지터 경로가 달라서
안전한 것으로 추정 — 실제로 이 세션에서 Remotion 렌더는 한 번도 이
증상이 없었음). 새로 정적 이미지 렌더러를 만들 일이 있으면 이 우회를
그대로 적용할 것.

### 폰트 FOUT (로드 전 시스템 폰트로 찍힘)

`src/Fonts.jsx` 의 `useA2ZFonts()` 필수 호출 — §18-3-1 참고.
`public/fonts/` 에 A2Z 전 웨이트가 있어야 함(레포에 커밋돼 있음).

## 파일 구조

```
motion/
  package.json        # remotion, @remotion/cli, react, react-dom
  public/fonts/        # A2Z-*.ttf (커밋됨 — Remotion staticFile() 로 로드)
  src/
    index.jsx          # registerRoot 진입점
    Root.jsx           # <Composition> 등록 (카드 ID·기본 props·동적 duration)
    Fonts.jsx           # useA2ZFonts() — FontFace API 로드
    shared.jsx          # GridBg, SUBTITLE_SAFE_BOTTOM, 공통 텍스트 스타일
    BuildingCard.jsx / StatCard.jsx / DataTable.jsx /
    QuoteCard.jsx / HeadlineCard.jsx
```

`node_modules/` 는 커밋 안 함(`.gitignore`) — 새 세션에서는 항상
`npm install` 부터.
