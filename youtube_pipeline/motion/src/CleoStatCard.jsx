import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';

// Cleo Abram(@CleoAbram) 스타일 테스트 카드 — design_reference.md §11 스펙.
// 순블랙 풀블리드 + 네온 라임 단일 강조(발광) + 화이트/뮤트그레이 2보조.
// B1M 계열 카드(shared.jsx BG_STYLE)와 톤이 완전히 달라 배경/색을 자체 정의한다.
const BLACK = '#0A0A0A';
const NEON = '#FAFF2E'; // 채널 실측 옐로(style_guide.md)로 교체 (2026-07-31)
const WHITE = '#F5F5F0';
const MUTE = '#5A5A5A';
const GRID = 'rgba(255,255,255,0.07)';

// 네온 발광(bloom) — 실측 시그니처. 텍스트/도형 공용.
const glow = (strength = 1) =>
  [
    `0 0 ${8 * strength}px rgba(250,255,46,0.85)`,
    `0 0 ${24 * strength}px rgba(250,255,46,0.45)`,
    `0 0 ${64 * strength}px rgba(250,255,46,0.22)`,
  ].join(', ');

// §11-4 그리드 바닥 — 원근 격자 라인만 뼈대로 흉내(하단 앰비언스, 매우 옅게).
const PerspectiveFloor = ({opacity}) => {
  const horizonY = 700;
  const vpX = 960;
  const rays = [];
  for (let x = -1400; x <= 3320; x += 236) {
    rays.push(<line key={`r${x}`} x1={vpX} y1={horizonY} x2={x} y2={1080} />);
  }
  const rows = [];
  for (let i = 1; i <= 7; i += 1) {
    const t = i / 7;
    const y = horizonY + 380 * t * t; // 가까울수록 간격 벌어짐
    rows.push(<line key={`h${i}`} x1={0} y1={y} x2={1920} y2={y} />);
  }
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, opacity}}>
      <g stroke="rgba(250,255,46,0.10)" strokeWidth={1}>
        {rays}
        {rows}
      </g>
      <rect x={0} y={horizonY} width={1920} height={380}
        fill="url(#floorFade)" />
      <defs>
        <linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BLACK} stopOpacity="1" />
          <stop offset="0.35" stopColor={BLACK} stopOpacity="0" />
          <stop offset="1" stopColor={BLACK} stopOpacity="0.9" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const CleoStatCard = ({
  kicker = '서울 자치구 1인당 종합소득',
  label = '용산구',
  valueTarget = 0,
  valueSuffix = '',
  valueText = '', // 주면 카운트업 대신 이 문자열을 그대로 표시 (비숫자 값용)
  decimals = 1, // 카운트업 소수 자리 (0이면 정수 + 천단위 콤마)
  caption = '',
  bars = [],
  source = '',
  bgImage = '', // motion/public/ 상대경로 — 풀블리드 실사 + 다크 오버레이
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const enter = spring({frame, fps, config: {damping: 200}, durationInFrames: 24});
  const countUp = interpolate(frame, [10, 55], [0, valueTarget], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shown = valueText
    ? valueText
    : decimals === 0
      ? Math.round(countUp).toLocaleString('en-US')
      : countUp.toFixed(decimals);
  const valueOpacity = valueText ? interpolate(frame, [8, 24], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
  const captionIn = interpolate(frame, [50, 68], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const maxVal = bars.length ? Math.max(...bars.map((b) => b.value)) : 1;

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      {bgImage ? (
        <>
          <Img
            src={staticFile(bgImage)}
            style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover'}}
          />
          <div
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              background: 'linear-gradient(180deg, rgba(10,10,10,.84) 0%, rgba(10,10,10,.62) 45%, rgba(10,10,10,.88) 100%)',
            }}
          />
        </>
      ) : (
        <PerspectiveFloor opacity={enter} />
      )}

      {/* 좌상단 킥커 — §11-2 좌상단 정렬 */}
      <div style={{position: 'absolute', top: 96, left: 120, opacity: enter}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <div style={{width: 10, height: 10, borderRadius: '50%', background: NEON, boxShadow: glow(0.7)}} />
          <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 34, letterSpacing: '0.14em', color: WHITE}}>
            {kicker}
          </span>
        </div>
      </div>

      {/* 좌측 빅넘버 3단: 라벨(화이트) → 숫자(네온+발광) → 캡션(그레이) */}
      <div style={{position: 'absolute', top: 268, left: 120, width: bars.length ? 880 : 1680}}>
        <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 54, color: WHITE, letterSpacing: '0.06em', opacity: enter}}>
          {label}
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: 'A2Z Medium, sans-serif',
            fontSize: valueText && valueText.length > 6 ? 190 : 290,
            lineHeight: 1.05,
            color: NEON,
            letterSpacing: '0.01em',
            textShadow: glow(1),
            fontVariantNumeric: 'tabular-nums',
            opacity: valueOpacity,
          }}
        >
          {shown}
          <span style={{fontSize: valueText && valueText.length > 6 ? 110 : 150, marginLeft: 10}}>{valueSuffix}</span>
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: 'A2Z Light, sans-serif',
            fontSize: 40,
            color: MUTE,
            letterSpacing: '0.05em',
            opacity: captionIn,
          }}
        >
          {caption}
        </div>
      </div>

      {/* 우측 미니멀 막대 — 가로 그리드선만, 강조 1개만 네온 */}
      {bars.length ? (
      <div style={{position: 'absolute', top: 250, left: 1080, width: 700, height: 470}}>
        <svg width={700} height={470}>
          {[0, 1, 2, 3, 4].map((i) => {
            const y = 40 + (i * 390) / 4;
            return <line key={i} x1={0} y1={y} x2={700} y2={y} stroke={GRID} strokeWidth={1} />;
          })}
          {bars.map((b, i) => {
            const barW = 118; // §11-2 폭:간격 ≈ 1:0.9
            const gap = 106;
            const x = 80 + i * (barW + gap);
            const grow = spring({frame: frame - 14 - i * 6, fps, config: {damping: 200}, durationInFrames: 30});
            const fullH = (b.value / maxVal) * 360;
            const h = Math.max(4, fullH * grow);
            const y = 430 - h;
            return (
              <g key={b.name}>
                <rect
                  x={x} y={y} width={barW} height={h}
                  rx={barW * 0.08}
                  fill={b.hot ? NEON : MUTE}
                  style={b.hot ? {filter: 'drop-shadow(0 0 14px rgba(250,255,46,0.7))'} : undefined}
                />
                <text
                  x={x + barW / 2} y={y - 22} textAnchor="middle"
                  fill={b.hot ? NEON : '#8A8A8A'}
                  style={{
                    fontFamily: b.hot ? 'A2Z Medium, sans-serif' : 'A2Z Light, sans-serif',
                    fontSize: 36,
                    letterSpacing: '0.04em',
                  }}
                  opacity={grow}
                >
                  {b.display}
                </text>
              </g>
            );
          })}
        </svg>
        <div style={{display: 'flex', paddingLeft: 80, gap: 106 + 118 - 118, opacity: enter}}>
          {bars.map((b) => (
            <div
              key={b.name}
              style={{
                width: 118 + 106, // 라벨 셀 = 막대폭+간격 (마지막 셀 초과분은 무해)
                marginLeft: 0,
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 118,
                  textAlign: 'center',
                  fontFamily: 'A2Z Light, sans-serif',
                  fontSize: 32,
                  letterSpacing: '0.06em',
                  color: b.hot ? WHITE : MUTE,
                }}
              >
                {b.name}
              </span>
            </div>
          ))}
        </div>
      </div>
      ) : null}

      {/* 좌하단 출처 — 뮤트그레이 소형 (우측은 막대 라벨과 겹쳐 좌측 배치) */}
      <div
        style={{
          position: 'absolute', left: 120, bottom: 300,
          fontFamily: 'A2Z Light, sans-serif', fontSize: 26,
          letterSpacing: '0.08em', color: MUTE, opacity: captionIn,
        }}
      >
        {source}
      </div>
    </AbsoluteFill>
  );
};
