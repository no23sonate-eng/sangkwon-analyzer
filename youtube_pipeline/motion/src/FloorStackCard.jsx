import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, GRAY, LINE, glow, fadeIn, Kicker, Footer} from './v2shared';

// 층 스택 선도면 (§21 기본층 — B1M "얇은 흰 선도면 + 치수선" 문법).
// 건물의 어느 층을 누가 쓰는지 한눈에. 3D 없이 2D 입면 스택으로 깔끔하게.
// floors: [{name, tenant, hot}] — 배열 순서는 아래층부터(1F, 2F, ...).
// dimension: {label} 을 주면 hot 구간에 치수선(중괄호)과 라벨을 붙인다.
export const FloorStackCard = ({
  kicker = '',
  sub = '',
  floors = [],
  dimension = null,
  caption = '',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = fadeIn(frame, 0, 14);

  const n = floors.length || 1;
  const fh = Math.min(96, Math.round(560 / n)); // 층 높이
  const bw = 620; // 건물 폭
  const bx = 430; // 건물 좌측 x
  const baseY = 760; // 지면
  const topY = baseY - n * fh;

  const hotIdx = floors.map((f, i) => (f.hot ? i : -1)).filter((i) => i >= 0);
  const hotTop = hotIdx.length ? baseY - (Math.max(...hotIdx) + 1) * fh : 0;
  const hotBottom = hotIdx.length ? baseY - Math.min(...hotIdx) * fh : 0;

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      <Kicker title={kicker} sub={sub} opacity={enter} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 지면선 */}
        <line x1={bx - 90} y1={baseY} x2={bx + bw + 300} y2={baseY} stroke={LINE} strokeWidth={2} opacity={enter} />

        {floors.map((f, i) => {
          const pop = spring({frame: frame - 12 - i * 6, fps, config: {damping: 200}, durationInFrames: 20});
          const y = baseY - (i + 1) * fh;
          const hot = Boolean(f.hot);
          return (
            <g key={i} opacity={pop}>
              <rect
                x={bx} y={y} width={bw} height={fh}
                fill={hot ? 'rgba(250,255,46,0.10)' : 'rgba(255,255,255,0.02)'}
                stroke={hot ? YELLOW : '#3E3E3E'}
                strokeWidth={hot ? 2.5 : 1.5}
                style={hot ? {filter: 'drop-shadow(0 0 10px rgba(250,255,46,0.28))'} : undefined}
              />
              {/* 층 창문 — 선도면 느낌의 얇은 세로선 */}
              {Array.from({length: 5}, (_, k) => (
                <line
                  key={k}
                  x1={bx + (bw / 6) * (k + 1)} y1={y + fh * 0.28}
                  x2={bx + (bw / 6) * (k + 1)} y2={y + fh * 0.78}
                  stroke={hot ? 'rgba(250,255,46,0.45)' : '#333333'} strokeWidth={1.5}
                />
              ))}
            </g>
          );
        })}

        {/* hot 구간 치수선 (좌측) */}
        {dimension && hotIdx.length ? (
          <g opacity={fadeIn(frame, 12 + n * 6 + 8)}>
            <line x1={bx - 46} y1={hotTop} x2={bx - 46} y2={hotBottom} stroke={WHITE} strokeWidth={2} />
            <line x1={bx - 60} y1={hotTop} x2={bx - 32} y2={hotTop} stroke={WHITE} strokeWidth={2} />
            <line x1={bx - 60} y1={hotBottom} x2={bx - 32} y2={hotBottom} stroke={WHITE} strokeWidth={2} />
          </g>
        ) : null}
      </svg>

      {/* 층 라벨 (건물 우측) */}
      {floors.map((f, i) => {
        const y = baseY - (i + 1) * fh;
        const hot = Boolean(f.hot);
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: bx + bw + 34, top: y + fh / 2 - 21,
              display: 'flex', alignItems: 'baseline', gap: 18,
              opacity: fadeIn(frame, 14 + i * 6), whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                fontFamily: 'A2Z Medium, sans-serif', fontSize: 23, letterSpacing: '0.16em',
                color: hot ? YELLOW : '#5A5A5A',
                border: `1.5px solid ${hot ? YELLOW : '#333333'}`, padding: '3px 9px 1px',
              }}
            >
              {f.name}
            </span>
            <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 30, letterSpacing: '0.04em', color: hot ? WHITE : MUTE}}>
              {f.tenant}
            </span>
          </div>
        );
      })}

      {/* 치수 라벨 (건물 좌측, 세로 중앙) */}
      {dimension && hotIdx.length ? (
        <div
          style={{
            position: 'absolute', right: 1920 - (bx - 74), top: (hotTop + hotBottom) / 2 - 40,
            textAlign: 'right', opacity: fadeIn(frame, 12 + n * 6 + 10), whiteSpace: 'nowrap',
          }}
        >
          <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 68, color: WHITE, letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums'}}>
            {dimension.label}
          </div>
          {dimension.sub ? (
            <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: MUTE, letterSpacing: '0.05em'}}>
              {dimension.sub}
            </div>
          ) : null}
        </div>
      ) : null}

      <Footer caption={caption} source={source} opacity={fadeIn(frame, 18 + n * 6)} />
    </AbsoluteFill>
  );
};
