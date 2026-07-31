import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, GRAY, GRID, glow, fadeIn, Kicker, Footer} from './v2shared';

// v2 추세 카드 — 두 증감률을 "기울기 차이" 그 자체로 보여준다.
// series: [{label, pct, display, hot}] — pct 는 기울기 계산용 (%).
export const TrendCard = ({
  kicker = '',
  sub = '',
  series = [],
  caption = '',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const enter = fadeIn(frame, 0, 14);

  const x0 = 300;
  const y0 = 700;
  const len = 1050;
  const maxPct = Math.max(...series.map((s) => Math.abs(s.pct)), 1);
  const draw = interpolate(frame, [14, 58], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      <Kicker title={kicker} sub={sub} opacity={enter} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 가는 가로 그리드 4개 + 기준선 */}
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={x0} y1={y0 - 110 * (i + 1)} x2={x0 + len} y2={y0 - 110 * (i + 1)} stroke={GRID} strokeWidth={1} opacity={enter} />
        ))}
        <line x1={x0} y1={y0} x2={x0 + len} y2={y0} stroke="#3A3A3A" strokeWidth={1.5} opacity={enter} />

        {series.map((s, i) => {
          const rise = (Math.abs(s.pct) / maxPct) * 380 * Math.sign(s.pct);
          const x1 = x0 + len * draw;
          const y1 = y0 - rise * draw;
          const col = s.hot ? YELLOW : '#6A6A6A';
          return (
            <g key={i}>
              <line
                x1={x0} y1={y0} x2={x1} y2={y1}
                stroke={col} strokeWidth={s.hot ? 6 : 4}
                strokeLinecap="round"
                style={s.hot ? {filter: 'drop-shadow(0 0 10px rgba(250,255,46,0.6))'} : undefined}
              />
              <circle cx={x1} cy={y1} r={s.hot ? 11 : 8} fill={col}
                style={s.hot ? {filter: 'drop-shadow(0 0 10px rgba(250,255,46,0.8))'} : undefined} />
            </g>
          );
        })}
      </svg>

      {/* 끝점 라벨 */}
      {series.map((s, i) => {
        const rise = (Math.abs(s.pct) / maxPct) * 380 * Math.sign(s.pct);
        const yEnd = y0 - rise;
        return (
          <div key={i} style={{position: 'absolute', left: x0 + len + 46, top: yEnd - 56, opacity: fadeIn(frame, 52)}}>
            <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: s.hot ? 92 : 64, letterSpacing: '0.01em', color: s.hot ? YELLOW : GRAY, textShadow: s.hot ? glow(0.8) : 'none', fontVariantNumeric: 'tabular-nums'}}>
              {s.display}
            </div>
            <div style={{marginTop: 2, fontFamily: 'A2Z Light, sans-serif', fontSize: 30, letterSpacing: '0.04em', color: s.hot ? WHITE : MUTE}}>
              {s.label}
            </div>
          </div>
        );
      })}

      <Footer caption={caption} source={source} opacity={fadeIn(frame, 64)} />
    </AbsoluteFill>
  );
};
