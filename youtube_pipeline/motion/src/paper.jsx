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

export const SUBTITLE_SAFE_BOTTOM = 260;
export const CONTENT_BOTTOM = 1080 - SUBTITLE_SAFE_BOTTOM; // 820

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

// 크림 종이 배경 + 옅은 격자 + 가장자리 비네트
// backdrop 을 주면 격자 아래에 살아 있는 실사가 깔린다 — 판이 멎지 않는다.
export const PaperBg = ({dark = false, theme, backdrop = '', veil = 0.9, blur = 0, dir = 0}) => {
  const T = themeOf(theme, dark);
  const nv = Math.floor(1920 / T.step) - 1;
  const nh = Math.floor(1080 / T.step) - 1;
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
      <rect x={0} y={0} width={1920} height={1080} fill="url(#paperVig)" />
      <defs>
        <radialGradient id="paperVig" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.75" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.06" />
        </radialGradient>
      </defs>
    </svg>
  </>
  );
};

// 타이틀 — 가운데 정렬이 기본이지만 **왼쪽 정렬**도 쓴다.
// 가운데만 쓰면 카드가 달라도 첫인상이 같다. 왼쪽 정렬에는 짧은 옐로 룰을 얹어
// "다른 장"이라는 신호를 준다 (B1M 이 챕터를 가를 때 쓰는 방식).
export const PaperTitle = ({title, sub = '', dark = false, theme, align = 'center'}) => {
  const frame = useCurrentFrame();
  const T = themeOf(theme, dark);
  const left = align === 'left';
  const grow = Math.max(0, Math.min(1, (frame - 2) / 14));
  return (
    <div style={{position: 'absolute', top: left ? 118 : 138, left: left ? 150 : 0,
                 width: left ? 1560 : 1920, textAlign: left ? 'left' : 'center',
                 opacity: fadeIn(frame, 0)}}>
      {left ? (
        <div style={{width: 96 * grow, height: 8, background: YELLOW, marginBottom: 22}} />
      ) : null}
      <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
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
export const PaperSource = ({source = '', dark = false, theme}) => {
  const frame = useCurrentFrame();
  if (!source) return null;
  const T = themeOf(theme, dark);
  const txt = /^\s*source\s*:/i.test(source) ? source : `Source : ${source}`;
  return (
    <div style={{position: 'absolute', right: 44, top: 34, textAlign: 'right',
                 maxWidth: 760,
                 fontFamily: 'A2Z Light, sans-serif', fontSize: 23,
                 letterSpacing: '0.04em', lineHeight: 1.3, color: T.soft,
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
                      fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: size,
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
