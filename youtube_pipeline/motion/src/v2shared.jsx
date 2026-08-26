import React from 'react';
import {interpolate} from 'remotion';
import {LW} from './paper';   // 선 굵기 네 단계 — paper.jsx 가 기준이다

// ── v2 디자인 시스템 (2026-07-31 사용자 확정) ──────────────────────────
// 순블랙 캔버스 + 채널 실측 레몬 옐로 단일 강조(발광). Cleo Abram 의
// 색·여백 언어(§11)에 채널 컬러(style_guide.md #FAFF2E)를 얹은 체계.
// 기존 B1M 계열 카드(shared.jsx)는 하남스피어 등 과거 프로젝트 재렌더
// 호환을 위해 그대로 두고, 새 카드는 전부 이 모듈을 쓴다.
export const BLACK = '#0A0A0A';
export const YELLOW = '#FAFF2E';
export const WHITE = '#F5F5F0';
export const MUTE = '#5F5F5F'; // 비강조 텍스트/도형
export const GRAY = '#8A8A8A'; // 준강조 텍스트
export const LINE = '#3A3A3A'; // 테두리/구분선
export const GRID = 'rgba(255,255,255,0.07)';

export const glow = (strength = 1) =>
  [
    `0 0 ${8 * strength}px rgba(250,255,46,0.85)`,
    `0 0 ${22 * strength}px rgba(250,255,46,0.4)`,
    `0 0 ${60 * strength}px rgba(250,255,46,0.18)`,
  ].join(', ');

// 자막 안전영역(shared.jsx 규칙과 동일) — 콘텐츠는 이 위에서 끝낼 것.
export const SAFE_BOTTOM_Y = 820;

export const fadeIn = (frame, start, len = 16) =>
  interpolate(frame, [start, start + len], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

// 좌상단 킥커 — 옐로 도트 + 타이틀(화이트) + 서브(그레이) 2단.
export const Kicker = ({title, sub = '', opacity = 1}) => (
  <div style={{position: 'absolute', top: 92, left: 120, opacity}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
      <div style={{width: 10, height: 10, borderRadius: '50%', background: YELLOW, boxShadow: glow(0.7)}} />
      <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 36, letterSpacing: '0.12em', color: WHITE}}>
        {title}
      </span>
    </div>
    {sub ? (
      <div
        style={{
          marginTop: 14, marginLeft: 28,
          fontFamily: 'A2Z Light, sans-serif', fontSize: 24,
          letterSpacing: '0.1em', color: MUTE,
        }}
      >
        {sub}
      </div>
    ) : null}
  </div>
);

// 좌하단 캡션(화이트) + 출처(뮤트) — 자막 안전영역 바로 위.
export const Footer = ({caption = '', source = '', opacity = 1}) => (
  <div style={{position: 'absolute', left: 120, bottom: 1080 - SAFE_BOTTOM_Y + 40, opacity}}>
    {caption ? (
      <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 36, letterSpacing: '0.05em', color: WHITE}}>
        {caption}
      </div>
    ) : null}
    {source ? (
      <div style={{marginTop: 14, fontFamily: 'A2Z Light, sans-serif', fontSize: 24, letterSpacing: '0.08em', color: MUTE}}>
        {source}
      </div>
    ) : null}
  </div>
);

// 하단 앰비언스 — 원근 격자 바닥(§11-4). 어떤 카드에든 배경으로 깔 수 있다.
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
    const y = horizonY + 380 * t * t;
    rows.push(<line key={`h${i}`} x1={0} y1={y} x2={1920} y2={y} />);
  }
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, opacity}}>
      <g stroke="rgba(250,255,46,0.10)" strokeWidth={LW.HAIR}>
        {rays}
        {rows}
      </g>
      <rect x={0} y={horizonY} width={1920} height={380} fill="url(#v2FloorFade)" />
      <defs>
        <linearGradient id="v2FloorFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BLACK} stopOpacity="1" />
          <stop offset="0.35" stopColor={BLACK} stopOpacity="0" />
          <stop offset="1" stopColor={BLACK} stopOpacity="0.9" />
        </linearGradient>
      </defs>
    </svg>
  );
};
