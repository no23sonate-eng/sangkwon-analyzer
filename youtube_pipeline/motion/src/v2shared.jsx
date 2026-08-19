import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

// ── v3 디자인 시스템 (2026-08-19) ──────────────────────────────────────
// v2(순블랙+옐로)의 뼈대는 유지하되, 레퍼런스(B1M·Stewart Hicks) 실측과
// 대조해 드러난 약점 6가지를 고친 판:
//   1) 발광 남용 → 글자에는 절대 금지, 강조 도형에만 아주 약하게
//   2) 평면 배경 → 비네팅·격자·그레인이 있는 "비어있지 않은 검정"
//   3) 약한 타이포 위계 → 라벨/숫자 크기 격차를 키우고 큰 글자는 자간 음수
//   4) 하단이 비는 구도 → 콘텐츠 밴드를 명시하고 좌우 비대칭 배치 허용
//   5) 정지 후 죽는 화면 → 상시 미세 드리프트
//   6) 카드마다 제각각인 여백 → 공통 그리드(마진·컬럼)
export const BLACK = '#0B0C0E'; // 완전 검정보다 살짝 든 검정 (압축에 강함)
export const YELLOW = '#FAFF2E';
export const WHITE = '#F2F4F7';
export const GRAY = '#9AA0A8'; // 준강조
export const MUTE = '#6B7076'; // 캡션·비강조
export const LINE = '#2E3238';
export const GRID = 'rgba(255,255,255,0.055)';

// ── 레이아웃 그리드 ───────────────────────────────────────────────────
export const M = 120; // 좌우 마진
export const CONTENT_TOP = 250; // 킥커 아래 콘텐츠 시작
export const SAFE_BOTTOM_Y = 820; // 자막 안전영역 상단 (하단 260px 비움)
export const COLS = 12;
export const GUTTER = 32;
const COL_W = (1920 - M * 2 - GUTTER * (COLS - 1)) / COLS;
export const col = (n) => COL_W * n + GUTTER * (n - 1); // n칸 폭
export const colX = (i) => M + (COL_W + GUTTER) * i; // i번째 칸 좌측 x

// ── 타이포 스케일 ─────────────────────────────────────────────────────
// 큰 글자일수록 자간을 좁힌다(양수 자간은 큰 크기에서 흐물거린다).
export const T = {
  eyebrow: {fontFamily: 'A2Z Light, sans-serif', fontSize: 27, letterSpacing: '0.2em', color: GRAY},
  title: {fontFamily: 'A2Z Light, sans-serif', fontSize: 42, letterSpacing: '0.06em', color: WHITE},
  sub: {fontFamily: 'A2Z Light, sans-serif', fontSize: 27, letterSpacing: '0.1em', color: MUTE},
  body: {fontFamily: 'A2Z Light, sans-serif', fontSize: 32, letterSpacing: '0.03em', color: WHITE},
  label: {fontFamily: 'A2Z Light, sans-serif', fontSize: 29, letterSpacing: '0.05em', color: GRAY},
  caption: {fontFamily: 'A2Z Light, sans-serif', fontSize: 25, letterSpacing: '0.07em', color: MUTE},
  // 숫자·값 — 자간 음수, Medium
  valueXL: {fontFamily: 'A2Z Medium, sans-serif', fontSize: 300, letterSpacing: '-0.03em', color: WHITE, fontVariantNumeric: 'tabular-nums', lineHeight: 0.95},
  valueL: {fontFamily: 'A2Z Medium, sans-serif', fontSize: 150, letterSpacing: '-0.02em', color: WHITE, fontVariantNumeric: 'tabular-nums', lineHeight: 1},
  valueM: {fontFamily: 'A2Z Medium, sans-serif', fontSize: 86, letterSpacing: '-0.01em', color: WHITE, fontVariantNumeric: 'tabular-nums', lineHeight: 1.05},
  valueS: {fontFamily: 'A2Z Medium, sans-serif', fontSize: 52, letterSpacing: '0em', color: WHITE, fontVariantNumeric: 'tabular-nums'},
};

// ── 발광 정책 ─────────────────────────────────────────────────────────
// 글자에는 쓰지 않는다. 강조 "도형" 하나에만, 아주 약하게.
export const shapeGlow = (s = 1) => `drop-shadow(0 0 ${10 * s}px rgba(250,255,46,0.32))`;
// 뒤에 깔아 존재감을 주는 헤이즈 — 텍스트섀도 대신 이걸 쓴다.
export const Haze = ({x, y, r = 420, opacity = 0.1}) => (
  <div
    style={{
      position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2,
      background: `radial-gradient(circle, rgba(250,255,46,${opacity}) 0%, rgba(250,255,46,0) 68%)`,
      pointerEvents: 'none',
    }}
  />
);
// 구버전 호환 — 예전 카드가 glow() 를 텍스트에 쓰던 자리를 무해하게 만든다
export const glow = () => 'none';

export const fadeIn = (frame, start, len = 16) =>
  interpolate(frame, [start, start + len], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

// 상시 미세 드리프트 — 등장이 끝나도 화면이 완전히 멈추지 않게
export const useDrift = (amp = 6, period = 420) => {
  const frame = useCurrentFrame();
  return {
    x: Math.sin((frame / period) * Math.PI * 2) * amp,
    y: Math.cos((frame / period) * Math.PI * 2) * amp * 0.5,
    scale: 1 + Math.sin((frame / period) * Math.PI * 2) * 0.004,
  };
};

// ── 캔버스 ────────────────────────────────────────────────────────────
// variant: 'dark'(기본) | 'blueprint'(B1M 네이비 청사진)
export const Canvas = ({variant = 'dark', grid = true, grain = true, vignette = true}) => {
  const base =
    variant === 'blueprint'
      ? 'linear-gradient(160deg, #16202F 0%, #0E141D 55%, #0A0E14 100%)'
      : 'linear-gradient(165deg, #121417 0%, #0B0C0E 60%, #08090B 100%)';
  const gridColor = variant === 'blueprint' ? 'rgba(120,170,255,0.07)' : GRID;
  return (
    <>
      <div style={{position: 'absolute', inset: 0, background: base}} />
      {grid ? (
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          <defs>
            <pattern id="v3grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M80 0 L0 0 0 80" fill="none" stroke={gridColor} strokeWidth="1" />
            </pattern>
            <radialGradient id="v3vig" cx="50%" cy="42%" r="72%">
              <stop offset="0%" stopColor="#000" stopOpacity="0" />
              <stop offset="70%" stopColor="#000" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.62" />
            </radialGradient>
            <filter id="v3grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="1920" height="1080" fill="url(#v3grid)" />
          {vignette ? <rect width="1920" height="1080" fill="url(#v3vig)" /> : null}
          {grain ? <rect width="1920" height="1080" filter="url(#v3grain)" opacity="0.045" /> : null}
        </svg>
      ) : null}
    </>
  );
};

// ── 공통 요소 ─────────────────────────────────────────────────────────
// 킥커 — 옐로 도트 + 짧은 규칙선 + 타이틀. 좌상단 그리드에 고정.
export const Kicker = ({title, sub = '', opacity = 1}) => (
  <div style={{position: 'absolute', top: 104, left: M, opacity}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
      <div style={{width: 9, height: 9, borderRadius: '50%', background: YELLOW}} />
      <div style={{width: 30, height: 1, background: LINE}} />
      <span style={{...T.eyebrow, color: WHITE}}>{title}</span>
    </div>
    {sub ? <div style={{marginTop: 12, marginLeft: 55, ...T.sub}}>{sub}</div> : null}
  </div>
);

// 푸터 — 캡션(화이트) + 출처(뮤트). 자막 안전영역 바로 위 그리드에 정렬.
export const Footer = ({caption = '', source = '', opacity = 1}) => (
  <div style={{position: 'absolute', left: M, top: SAFE_BOTTOM_Y - 96, width: 1920 - M * 2, opacity}}>
    {caption ? <div style={{...T.body, fontSize: 34}}>{caption}</div> : null}
    {source ? <div style={{marginTop: 12, ...T.caption}}>{source}</div> : null}
  </div>
);

// 하단 원근 격자 — 기본적으로 쓰지 않는다(캔버스가 이미 질감을 담당).
export const PerspectiveFloor = ({opacity = 1}) => {
  const horizonY = 700;
  const vpX = 960;
  const rays = [];
  for (let x = -1400; x <= 3320; x += 236) {
    rays.push(<line key={`r${x}`} x1={vpX} y1={horizonY} x2={x} y2={1080} />);
  }
  const rows = [];
  for (let i = 1; i <= 7; i += 1) {
    const t = i / 7;
    rows.push(<line key={`h${i}`} x1={0} y1={horizonY + 380 * t * t} x2={1920} y2={horizonY + 380 * t * t} />);
  }
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, opacity: opacity * 0.5}}>
      <g stroke="rgba(250,255,46,0.07)" strokeWidth={1}>{rays}{rows}</g>
    </svg>
  );
};
