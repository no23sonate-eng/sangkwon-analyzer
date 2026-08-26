import React from 'react';
import {Img, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';

// ── 종이 설명 그래픽 공통 토큰 (2026-08-02, Billionaires' Row 레퍼런스) ──
// B1M의 "밝은 종이 + 그리드 + 플랫 실루엣" 설명 문법을 채널 팔레트로 번역:
// 종이는 크림(#EFEAE3, 실사 액자와 동일), 잉크는 딥 차콜, 강조는 레몬 옐로.
// 로직/구조/비교를 "설명"하는 구간 전용 — 실사/다크 카드와 구분되는 톤.
export const PAPER = '#EFEAE3';
export const INK = '#23262B'; // 외곽선·본문
export const INK_MUTE = '#9AA0A8'; // 비강조 면
export const INK_SOFT = '#6E747C'; // 보조 텍스트
export const YELLOW = '#FAFF2E'; // 강조 채움 (외곽선은 항상 INK와 병용)
export const PAPER_LINE = 'rgba(35,38,43,0.10)'; // 그리드선


// ── 간격 규칙 (B1M 기준, 2026-08-16 확정) ────────────────────────────────
// 지금까지 카드마다 여백을 눈대중으로 박아 넣었더니 어떤 카드는 라벨이 도형에
// 달라붙고 어떤 카드는 붕 떴다. **한 척도에서 고른다.**
//
// B1M 판을 보고 잡은 원칙:
//   ① **라벨과 대상 사이는 넉넉하다.** 붙으면 라벨이 도형의 일부처럼 읽힌다
//   ② **위계 차이는 크게 벌린다.** 수치 148 / 라벨 46 처럼 3배 이상
//   ③ 같은 묶음 안은 촘촘하게(TIGHT), 묶음끼리는 확실하게(BLOCK)
//
//   TIGHT  8   같은 덩어리 안 (수치와 단위, 라벨 두 줄)
//   NEAR   20  붙어 있어야 하지만 겹치면 안 되는 것 (라벨 ↔ 보조설명)
//   GAP    36  요소와 요소 (도형 ↔ 라벨)
//   BLOCK  64  묶음과 묶음 (제목 블록 ↔ 본문 블록)
//   BAND   96  단과 단 (평면 ↔ 정면)
export const SP = {TIGHT: 8, NEAR: 20, GAP: 36, BLOCK: 64, BAND: 96};

// ── 선 굵기 ───────────────────────────────────────────────────────────────
// 세어 보니 저장소 전체에 굵기가 **열두 가지**였다 (1 · 1.4 · 1.5 · 1.6 · 2 ·
// 2.5 · 2.6 · 3 · 3.5 · 4 · 5 · 12). 그건 위계가 아니라 소음이다. 보는 사람은
// "이 선이 저 선보다 굵다" 를 뜻으로 읽는데, 열두 단계면 뜻이 안 생긴다.
//
// B1M 도면 문법은 네 단계다. 각 단계에 **역할**이 있고, 역할이 없으면 안 쓴다.
//   HAIR  격자 · 치수선 · 리더선. 있는 줄 모를 만큼 얇게 — 대상을 안 가린다
//   THIN  축, 보조 도형의 외곽. 읽히되 주장하지 않는다
//   BODY  데이터 도형의 외곽 (막대 · 면 · 실루엣). 이게 그림의 기본 굵기다
//   BOLD  강조 하나. **화면에 한 군데만.** 두 군데면 강조가 아니다
export const LW = {HAIR: 1.5, THIN: 2.5, BODY: 4, BOLD: 7};

// ── 글자 크기 ─────────────────────────────────────────────────────────────
// 마찬가지로 25~200 사이에 스무 가지가 흩어져 있었다. 1.25배(장3도) 간격의
// 여덟 단계로 모은다. 단계 사이가 이만큼 벌어져야 위계가 눈에 보인다 —
// 62 와 65 는 다른 크기가 아니라 그냥 어긋난 값이다.
export const FS = {
  MICRO: 26,   // 출처 · 주석 · 단위
  SMALL: 32,   // 보조 설명
  LABEL: 40,   // 축 항목 · 라벨
  BODY: 50,    // 본문 한 줄
  LEAD: 64,    // 부제 · 리드
  TITLE: 80,   // 제목
  HERO: 104,   // 큰 수치
  MEGA: 148,   // 주인공 수치 — 한 화면에 하나
};

// ── 세로 구도 ─────────────────────────────────────────────────────────────
// 자막은 **얹히는 것**이지 화면을 잘라내는 게 아니다. 1080 에 구운 한글
// 자막은 대략 y 900~1030 을 쓴다. 그런데 여기서 260 을 비워 두고(=820),
// 카드마다 다시 자기 여백을 더하니 내용이 화면 위쪽 70% 에 몰렸다.
// 182컷을 재 보니 **98컷이 위로 60px 넘게 솟아** 있었고, 아래는 텅 비었다.
// 176 이면 자막 자리는 그대로 지키면서 구도에 80px 을 돌려준다.
export const SUBTITLE_SAFE_BOTTOM = 176;
export const CONTENT_BOTTOM = 1080 - SUBTITLE_SAFE_BOTTOM; // 904

// 사람 눈은 기하학적 중심(540)보다 조금 위를 가운데로 본다. 포스터·표지에서
// 제목을 정확히 반으로 놓으면 처져 보이는 것과 같은 이유다.
export const OPTICAL_CENTER = 512;

// 높이를 아는 덩어리를 **화면 한가운데**에 놓는다.
//
// 지금까지 카드들은 저마다 `bandTop + (CONTENT_BOTTOM - bandTop - h) / 2` 로
// 계산했다. 그건 화면이 아니라 **띠 안에서의 가운데**라, 제목이 있는 카드는
// 띠가 300 부터 시작해 덩어리가 아래로 밀리고, 제목이 없으면 위로 붙었다.
// 같은 영상 안에서 컷마다 기준이 달랐다는 뜻이다.
//
//   h       덩어리 높이
//   top     이보다 위로는 안 올라간다 (제목 아래 등)
//   bottom  이보다 아래로는 안 내려간다 (기본 = 자막 안전선)
// PaperTitle 이 실제로 차지하는 높이. 스택 높이를 셀 때 쓴다
export const titleH = (title, sub) => (title ? (sub ? 116 : 76) : 0);

export const stageTop = (h, {top = 120, bottom = CONTENT_BOTTOM} = {}) => {
  let y = Math.round(OPTICAL_CENTER - h / 2);
  if (y + h > bottom) y = bottom - h;      // 아래로 넘치면 끌어올린다
  if (y < top) y = top;                    // 그래도 위를 침범하면 위에 맞춘다
  return y;
};

// 실루엣 톤 패밀리 (B1M의 5단계 블루 패밀리를 잉크 계열로 번역)
// — 건물/막대마다 다른 톤을 순환시켜 단조로움을 없앤다. 옐로는 강조 전용.
export const TONES = ['#B9BFC9', '#5C6470', '#8F97A3', '#3A414C', '#A8B0BC'];

// 오버라인/언더라인 브래킷 (끝에 짧은 틱) — B1M 라벨·수치 묶음 문법
export const Bracket = ({x, y, w, tick = 10, stroke = INK, strokeWidth = 2, opacity = 1, below = false}) => (
  <g opacity={opacity} stroke={stroke} strokeWidth={strokeWidth}>
    <line x1={x} y1={y} x2={x + w} y2={y} />
    <line x1={x} y1={y} x2={x} y2={y + (below ? -tick : tick)} />
    <line x1={x + w} y1={y} x2={x + w} y2={y + (below ? -tick : tick)} />
  </g>
);

// 빅 스탯 타이포 블록 — 큰 볼드 수치 + 오른쪽 2줄 얇은 라벨 ("72% | Owner/occupied")
export const BigStat = ({value, unit = '%', label = '', color = INK, size = 92, opacity = 1}) => (
  <div style={{display: 'inline-flex', alignItems: 'baseline', gap: 16, opacity}}>
    <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: size, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em'}}>
      {value}
      <span style={{fontFamily: 'A2Z Regular, sans-serif', fontSize: size * 0.62}}>{unit}</span>
    </span>
    {label ? (
      <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: size * 0.3, lineHeight: 1.22, color: INK_SOFT, whiteSpace: 'pre-line', letterSpacing: '0.04em'}}>
        {label}
      </span>
    ) : null}
  </div>
);

export const fadeIn = (frame, start, len = 14) => {
  const t = Math.max(0, Math.min(1, (frame - start) / len));
  return t * t * (3 - 2 * t);
};

// 어두운 종이 톤 — 같은 문법을 유지한 채 색만 뒤집는다.
// 종이 카드가 길게 이어질 때 중간에 한두 장 끼워 넣어 단조로움을 끊는 용도.
export const DARK_PAPER = '#242830';
export const DARK_INK = '#F2F0EC';
export const DARK_INK_SOFT = '#A7AEB8';
export const DARK_TONES = ['#4A525E', '#79828F', '#3A414C', '#98A1AD', '#5C6470'];
export const palette = (dark, theme) => (theme
  ? {paper: THEMES[theme].bg, ink: THEMES[theme].ink, inkSoft: THEMES[theme].soft,
     tones: THEMES[theme].tones, line: THEMES[theme].grid, vig: '#000'}
  : dark
  ? {paper: DARK_PAPER, ink: DARK_INK, inkSoft: DARK_INK_SOFT, tones: DARK_TONES,
     line: 'rgba(242,240,236,0.10)', vig: '#000'}
  : {paper: PAPER, ink: INK, inkSoft: INK_SOFT, tones: TONES, line: PAPER_LINE, vig: '#000'});

// ── 바탕 테마 ────────────────────────────────────────────────────────────
// 종이 카드가 전부 같은 크림 바탕이면 카드를 아무리 늘려도 화면은 한 종류로 읽힌다.
// (갤러리 편 9컷 중 5컷이 사실상 같은 그림이었다.)
// 바탕 자체를 갈아 끼울 수 있게 만든다 — 같은 카드도 톤이 바뀌면 다른 화면이 된다.
//
//   paper      크림 종이 · 굵은 격자      기본. 설명·비교
//   ink        딥 차콜                    무게를 싣는 구간, 종이 사이의 쉼표
//   blueprint  네이비 청사진 · 촘촘한 격자  도면·구조·계획 이야기
export const THEMES = {
  paper:     {bg: '#EFEAE3', ink: '#23262B', soft: '#6E747C',
              grid: 'rgba(35,38,43,0.10)', step: 80, fine: false,
              tones: ['#B9BFC9', '#5C6470', '#8F97A3', '#3A414C', '#A8B0BC']},
  ink:       {bg: '#242830', ink: '#F2F0EC', soft: '#A7AEB8',
              grid: 'rgba(242,240,236,0.10)', step: 80, fine: false,
              tones: ['#4A525E', '#79828F', '#3A414C', '#98A1AD', '#5C6470']},
  blueprint: {bg: '#16233A', ink: '#E8F0FF', soft: '#8FA6C8',
              grid: 'rgba(150,190,255,0.16)', step: 40, fine: true,
              tones: ['#33507E', '#4E74AE', '#28405F', '#6A92CE', '#3E5F92']},
};
export const themeOf = (t, dark) => THEMES[t] || (dark ? THEMES.ink : THEMES.paper);

// ── 살아 있는 배경 ───────────────────────────────────────────────────────
// B1M 화면은 **정지하는 순간이 없다.** 도표 카드조차 뒤에 실사가 깔려 아주 느리게
// 밀리고 커진다. 사진은 주인공이 아니라 **질감**이라 베일로 눌러 놓는다.
//
// 왜 필요한가: 완전히 멈춘 판은 몇 초만 지나도 "슬라이드"로 읽힌다.
// 내레이션이 계속 흐르는데 화면이 멈춰 있으면 시청자는 화면을 보지 않게 된다.
// 컷을 더 쪼개는 것(§9-1)과 별개 문제다 — **한 컷 안에서도 멎으면 안 된다.**
//
// 값의 근거: 5초(150프레임)에 배율 +3.5%, 이동 1.4% 정도가 한계다.
// 그보다 크면 '움직인다'고 알아채고, 그보다 작으면 안 느껴진다.
// 그리고 **절대 이징하지 않는다.** 가감속이 붙는 순간 "애니메이션"이 되어 버린다.
// 등속으로 계속 가는 것이 카메라가 걸려 있는 느낌을 만든다.
//
// dir 로 방향을 돌린다. 연속된 컷이 같은 방향으로 밀리면 그것대로 눈에 띈다.
const DRIFT_DIRS = [[1, 0.4], [-1, 0.3], [0.5, -1], [-0.6, -0.8], [0.9, 0.9], [-1, 0.9]];

// 배경은 사진만이 아니라 **영상**도 된다. 경매·계약·현금처럼 "장면 자체가
// 움직여야 하는" 구간은 정지 사진을 아무리 드리프트시켜도 정지 사진이다.
// 확장자로 갈라 `OffthreadVideo` 로 넘긴다 — 카드 코드는 하나도 안 바뀐다.
//
// 영상일 때 드리프트를 **끄는** 이유: 영상은 이미 스스로 움직인다. 거기에
// 배율·이동을 또 얹으면 두 개의 움직임이 싸워서 어지럽다. 사진일 때만 민다.
const isVideo = (src) => /\.(mp4|webm|mov)(\?|$)/i.test(String(src));

export const LiveBackdrop = ({image = '', veil = 0.9, blur = 0, dir = 0,
                              scale = 0.035, shift = 0.014, theme, dark = false}) => {
  const frame = useCurrentFrame();
  const T = themeOf(theme, dark);
  if (!image) return null;
  const vid = isVideo(image);
  const [dx, dy] = DRIFT_DIRS[Math.abs(dir) % DRIFT_DIRS.length];
  const t = frame / 150;                       // 5초를 1로 본다
  const k = vid ? 1.02 : 1.06 + scale * t;     // 처음부터 살짝 크게 깔아 여백이 안 생기게
  const tx = vid ? 0 : dx * shift * t * 1920;
  const ty = vid ? 0 : dy * shift * t * 1080;
  const src = /^https?:/.test(image) ? image : staticFile(image);
  const box = {position: 'absolute', left: '50%', top: '50%', width: 1920, height: 1080,
               objectFit: 'cover',
               transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${k})`,
               filter: blur ? `blur(${blur}px)` : 'none'};
  return (
    <>
      <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: T.bg}}>
        {vid
          ? <OffthreadVideo src={src} muted style={box} />
          : <Img src={src} style={box} />}
      </div>
      <div style={{position: 'absolute', inset: 0, background: T.bg, opacity: veil}} />
    </>
  );
};

// ── 종이 결 ───────────────────────────────────────────────────────────────
// B1M 프레임 22장 중 **순색 바탕은 한 장도 없었다** (§40-1, §40-11).
// 격자 위에 종이 얼룩과 먼지 점이 늘 깔려 있고, 그 층이 없으면 같은 레이아웃도
// "파워포인트"로 읽힌다. 우리에게 지금 가장 없는 것이 이거다.
//
// **난수는 씨앗을 고정한다.** Math.random 을 쓰면 프레임마다 점이 새로 찍혀
// 화면 전체가 지글거린다 (렌더는 프레임 단위로 컴포넌트를 다시 그린다).
const rnd = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// 얼룩은 크고 뭉쳐 있고, 먼지는 작고 흩어져 있다 — 실제 스캔한 종이의 결이다.
// 둘을 같은 크기로 뿌리면 노이즈 필터처럼 보이고 종이로는 안 읽힌다.
export const PaperGrain = ({theme, dark = false, opacity = 1}) => {
  const T = themeOf(theme, dark);
  const light = T.bg !== DARK_PAPER && T.bg !== THEMES.blueprint.bg;
  const speck = light ? '#3A3F47' : '#EFEDE8';
  const SPECKS = 260, BLOTS = 14;
  return (
    <svg width={1920} height={1080}
         style={{position: 'absolute', top: 0, left: 0, pointerEvents: 'none',
                 opacity, mixBlendMode: light ? 'multiply' : 'screen'}}>
      <defs>
        <radialGradient id={`blot-${theme || 'd'}`}>
          <stop offset="0" stopColor={speck} stopOpacity={light ? 0.055 : 0.045} />
          <stop offset="1" stopColor={speck} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 얼룩 — 큰 반점. 균일하게 뿌리면 안 된다 */}
      {Array.from({length: BLOTS}, (_, i) => (
        <circle key={`b${i}`} cx={rnd(i * 3 + 1) * 1920} cy={rnd(i * 3 + 2) * 1080}
                r={70 + rnd(i * 3 + 3) * 160} fill={`url(#blot-${theme || 'd'})`} />
      ))}
      {/* 먼지 — 작고 흩어진 점. 크기를 세 단계로 섞어야 스캔한 결이 난다 */}
      {Array.from({length: SPECKS}, (_, i) => {
        const r = rnd(i * 7 + 5);
        return (
          <circle key={`s${i}`} cx={rnd(i * 7 + 11) * 1920} cy={rnd(i * 7 + 13) * 1080}
                  r={r < 0.7 ? 1 : r < 0.94 ? 1.8 : 2.8}
                  fill={speck} opacity={(light ? 0.16 : 0.13) * (0.5 + r * 0.5)} />
        );
      })}
    </svg>
  );
};

// 크림 종이 배경 + 옅은 격자 + 가장자리 비네트
// backdrop 을 주면 격자 아래에 살아 있는 실사가 깔린다 — 판이 멎지 않는다.
export const PaperBg = ({dark = false, theme, backdrop = '', veil = 0.9, blur = 0, dir = 0,
                         grain = true}) => {
  const T = themeOf(theme, dark);
  const nv = Math.floor(1920 / T.step) - 1;
  const nh = Math.floor(1080 / T.step) - 1;
  // 교차점 십자 — B1M 종이판이 5칸마다 찍는 표시 (§40-1).
  // 격자선만 있으면 방안지인데, 십자가 찍히면 **도면**으로 읽힌다.
  const CROSS = 5, CL = 7;
  const crosses = [];
  for (let i = 1; i * CROSS <= nv; i++) {
    for (let j = 1; j * CROSS <= nh; j++) {
      crosses.push([i * CROSS * T.step, j * CROSS * T.step]);
    }
  }
  return (
  <>
    <div style={{position: 'absolute', inset: 0, background: T.bg}} />
    <LiveBackdrop image={backdrop} veil={veil} blur={blur} dir={dir} theme={theme} dark={dark} />
    <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
      <g stroke={T.grid} strokeWidth={1}>
        {Array.from({length: nv}, (_, i) => (
          <line key={`v${i}`} x1={(i + 1) * T.step} y1={0} x2={(i + 1) * T.step} y2={1080} />
        ))}
        {Array.from({length: nh}, (_, i) => (
          <line key={`h${i}`} x1={0} y1={(i + 1) * T.step} x2={1920} y2={(i + 1) * T.step} />
        ))}
      </g>
      {/* 청사진은 굵은 기준선을 5칸마다 한 번 더 — 도면처럼 보이게 */}
      {T.fine ? (
        <g stroke={T.grid} strokeWidth={2} opacity={0.9}>
          {Array.from({length: Math.floor(nv / 5)}, (_, i) => (
            <line key={`V${i}`} x1={(i + 1) * T.step * 5} y1={0} x2={(i + 1) * T.step * 5} y2={1080} />
          ))}
          {Array.from({length: Math.floor(nh / 5)}, (_, i) => (
            <line key={`H${i}`} x1={0} y1={(i + 1) * T.step * 5} x2={1920} y2={(i + 1) * T.step * 5} />
          ))}
        </g>
      ) : null}
      {/* 십자는 청사진엔 안 찍는다 — 이미 굵은 기준선이 그 역할을 한다 */}
      {!T.fine ? (
        <g stroke={T.grid} strokeWidth={1.6}>
          {crosses.map(([x, y], i) => (
            <g key={`c${i}`}>
              <line x1={x - CL} y1={y} x2={x + CL} y2={y} />
              <line x1={x} y1={y - CL} x2={x} y2={y + CL} />
            </g>
          ))}
        </g>
      ) : null}
      <rect x={0} y={0} width={1920} height={1080} fill="url(#paperVig)" />
      <defs>
        <radialGradient id="paperVig" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.75" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.06" />
        </radialGradient>
      </defs>
    </svg>
    {/* 실사가 깔린 컷은 결을 약하게 — 사진 자체에 이미 결이 있다 */}
    {grain ? <PaperGrain theme={theme} dark={dark} opacity={backdrop ? 0.45 : 1} /> : null}
  </>
  );
};

// 타이틀 — 가운데 정렬이 기본이지만 **왼쪽 정렬**도 쓴다.
// 가운데만 쓰면 카드가 달라도 첫인상이 같다. 왼쪽 정렬에는 짧은 옐로 룰을 얹어
// "다른 장"이라는 신호를 준다 (B1M 이 챕터를 가를 때 쓰는 방식).
// top 을 주면 그 자리에 선다. 안 주면 예전처럼 화면 위에 고정된다.
//
// 안 줬을 때의 기본 자리도 138 → 196 으로 내렸다. 제목이 화면 맨 위에 떠
// 있고 본문은 가운데(512)에 있으니 그 사이가 190px 씩 비었고, 그래서
// [제목+본문] 덩어리의 중심이 위로 끌려 올라갔다. 실측에서 −140px 쏠림이
// 서로 무관한 카드 열두 종에 똑같이 찍힌 게 이 간격 때문이었다.
// 제목은 자기가 가리키는 것 가까이 있어야 한다.
//
// **왜 필요한가.** 제목도 화면에 찍히는 잉크다. 그런데 제목은 y=138 에 못
// 박아 두고 본문만 가운데로 옮기면, 보는 사람 눈에는 [제목+본문] 한 덩어리가
// 위로 쏠린 것으로 보인다. 182컷을 재 보니 98컷이 그랬다.
// 제목과 본문을 **한 스택으로 묶어** 통째로 앉혀야 가운데 정렬이 된다.
export const PaperTitle = ({title, sub = '', dark = false, theme, align = 'center', top}) => {
  const frame = useCurrentFrame();
  const T = themeOf(theme, dark);
  const left = align === 'left';
  const grow = Math.max(0, Math.min(1, (frame - 2) / 14));
  return (
    <div style={{position: 'absolute', top: top ?? (left ? 176 : 196), left: left ? 150 : 0,
                 width: left ? 1560 : 1920, textAlign: left ? 'left' : 'center',
                 opacity: fadeIn(frame, 0)}}>
      {left ? (
        <div style={{width: 96 * grow, height: 8, background: YELLOW, marginBottom: 22}} />
      ) : null}
      <div style={{fontFamily: 'A2Z Medium, sans-serif',
                   fontSize: left ? 76 : 68, letterSpacing: '-0.01em', color: T.ink,
                   wordBreak: 'keep-all'}}>
        {title}
      </div>
      {sub ? (
        <div style={{marginTop: 12, fontFamily: 'A2Z Light, sans-serif', fontSize: 36,
                     letterSpacing: left ? '0.02em' : '0.08em', color: T.soft,
                     wordBreak: 'keep-all'}}>
          {sub}
        </div>
      ) : null}
    </div>
  );
};

// ── 출처 표기 (채널 고정 규칙) ───────────────────────────────────────────
// **우측 위 · `Source : …` 한 형식으로 통일한다.** (2026-08-16 확정)
// 예전엔 우하단이었는데 두 가지가 걸렸다:
//   ① 하단은 자막·면책 문구·디스클레이머가 이미 붐빈다
//   ② 카드마다 아래쪽 여백이 달라 출처 높이가 들쭉날쭉했다
// 위쪽은 어느 카드든 타이틀 옆이 비어 있어 **항상 같은 자리**가 나온다.
// 접두어를 붙이는 이유: 출처인지 캡션인지 한눈에 갈리게 하려고.
export const PaperSource = ({source = '', dark = false, theme, onPhoto = false}) => {
  const frame = useCurrentFrame();
  if (!source) return null;
  const T = themeOf(theme, dark);
  const txt = /^\s*source\s*:/i.test(source) ? source : `Source : ${source}`;
  return (
    <div style={{position: 'absolute', right: 44, top: 34, textAlign: 'right',
                 maxWidth: 760,
                 fontFamily: 'A2Z Light, sans-serif', fontSize: 20,
                 letterSpacing: '0.04em', lineHeight: 1.3,
                 // 사진을 꽉 채우는 카드는 무대 색이 없다. 사진이 밝을지
                 // 어두울지 모르니 흰 글자 + 그림자로 고정한다
                 color: onPhoto ? '#FFFFFF' : T.soft,
                 textShadow: onPhoto ? '0 2px 10px rgba(0,0,0,0.8)' : 'none',
                 opacity: 0.85 * fadeIn(frame, 40), wordBreak: 'keep-all'}}>
      {txt}
    </div>
  );
};

// ── 수치가 도착하는 방식 ─────────────────────────────────────────────────
// 지금까지 모든 카드가 숫자를 **같은 방식**으로 띄웠다 — interpolate 로 값만
// 굴리고 통째로 페이드. 그래서 43컷에서 수치가 다 똑같이 읽혔다.
//
// 강조되는 수치는 세 겹으로 온다.
//   ① 자릿수 마스크   아래에서 위로 밀려 올라오며 나타난다 (페이드 아님)
//   ② 카운트업       값이 굴러간다
//   ③ 밑줄 긋기      다 굴러간 뒤 밑줄이 좌→우로 그어지며 "확정"된다
// ③ 이 있고 없고가 "표시된 숫자"와 "선언된 숫자"를 가른다.
//
// value/to  : 목표 값 (숫자)
// start     : 시작 프레임
// decimals  : 소수 자리
// underline : 밑줄 색 (없으면 안 그림)
export const NumberIn = ({
  to = 0, start = 0, dur = 34, decimals = 0, unit = '', unitSize = 0.62,
  size = 96, color = INK, underline = null, locale = true, align = 'left',
}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, Math.min(1, (frame - start) / dur));
  const e = t * t * (3 - 2 * t);
  const v = to * e;
  const shown = locale
    ? Number(v.toFixed(decimals)).toLocaleString('ko-KR',
        {minimumFractionDigits: decimals, maximumFractionDigits: decimals})
    : v.toFixed(decimals);
  // 마스크 리빌 — 글자 높이만큼 아래에서 올라온다
  const rise = (1 - e) * size * 0.42;
  const ul = Math.max(0, Math.min(1, (frame - start - dur) / 14));
  return (
    <span style={{display: 'inline-block', textAlign: align}}>
      <span style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom',
                    lineHeight: 1.02, height: size * 1.02}}>
        <span style={{display: 'inline-block', transform: `translateY(${rise}px)`,
                      fontFamily: 'A2Z Medium, sans-serif', fontSize: size,
                      color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em'}}>
          {shown}<span style={{fontSize: size * unitSize}}>{unit}</span>
        </span>
      </span>
      {underline ? (
        <span style={{display: 'block', height: 6, background: underline,
                      transform: `scaleX(${ul})`, transformOrigin: 'left center', marginTop: 4}} />
      ) : null}
    </span>
  );
};

// ── 값 칩 ─────────────────────────────────────────────────────────────────
// B1M 은 도해 **안에서** 수치를 못 박을 때 글자를 색 박스로 감싼다 (§40-6).
// `1:7` `18m` `435m` `1:24` — 전부 파란 박스 안 흰 글자다.
//
// 왜 박스인가: 도해 위에는 이미 선과 면이 많아서 **글자만 얹으면 도형의 일부로
// 읽힌다.** 박스가 글자를 배경에서 떼어 내 "이건 값이다" 라고 분리해 준다.
// 우리 기존 방식(옐로 형광펜)은 라벨에만 걸려 있었고 수치 자체는 맨 글자였다.
//
// hot 이면 옐로 박스에 먹 글자 — 화면에 **딱 한 군데만** 쓴다.
// 그 외에는 잉크 박스에 바탕색 글자로, 도해를 해치지 않을 만큼만 세운다.
export const ValueChip = ({children, size = 44, hot = false, theme, dark = false,
                           style = {}}) => {
  const T = themeOf(theme, dark);
  return (
    <span style={{display: 'inline-block',
                  background: hot ? YELLOW : T.ink,
                  color: hot ? '#1B1E24' : T.bg,
                  fontFamily: 'A2Z Medium, sans-serif',
                  fontSize: size, lineHeight: 1.14,
                  padding: `${Math.round(size * 0.16)}px ${Math.round(size * 0.34)}px`,
                  borderRadius: 3, letterSpacing: '0.01em',
                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  ...style}}>
      {children}
    </span>
  );
};

// ── v2 카드를 종이로 옮길 때 쓰는 부품 ───────────────────────────────────
// 옛 v2 카드는 `Kicker` 와 `Footer` 를 썼다. 둘 다 먹 배경 전용 색이 박혀
// 있어서 그대로 두면 크림 종이 위에 회색 글자가 떠 안 읽힌다.
// 같은 자리·같은 리듬을 유지하면서 색만 테마에서 받게 한 짝이다.
//
// 출처는 여기 안 넣는다 — 채널 규칙대로 **우측 상단** `PaperSource` 다.
// 옛 Footer 는 캡션과 출처를 같이 아래에 뒀는데, 그래서 v2 카드만 출처
// 자리가 달랐다.
export const PaperKicker = ({title = '', sub = '', theme, dark = false, opacity = 1,
                             left = 120, top = 150}) => {
  const T = themeOf(theme, dark);
  if (!title && !sub) return null;
  return (
    <div style={{position: 'absolute', left, top, opacity}}>
      <div style={{display: 'flex', alignItems: 'center', gap: SP.NEAR}}>
        <div style={{width: 46, height: 5, background: YELLOW}} />
        <span style={{fontFamily: 'A2Z Medium, sans-serif',
                      fontSize: 32, letterSpacing: '0.06em', color: T.ink,
                      wordBreak: 'keep-all'}}>{title}</span>
      </div>
      {sub ? (
        <div style={{marginTop: SP.TIGHT, marginLeft: 66,
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 28,
                     color: T.soft, wordBreak: 'keep-all'}}>{sub}</div>
      ) : null}
    </div>
  );
};

// 캡션 — 가정·단서·기준을 적는 자리. 화면 아래 가운데.
// 자막 안전선(CONTENT_BOTTOM) 위에 붙는다
export const PaperCaption = ({children, theme, dark = false, opacity = 1, top = null}) => {
  const T = themeOf(theme, dark);
  if (!children) return null;
  return (
    <div style={{position: 'absolute', left: 200, width: 1520,
                 top: top == null ? CONTENT_BOTTOM - 26 : top, textAlign: 'center',
                 fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: T.soft,
                 opacity, wordBreak: 'keep-all'}}>
      {children}
    </div>
  );
};
