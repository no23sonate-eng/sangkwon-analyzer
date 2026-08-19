import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, GRAY, LINE, glow, fadeIn, Kicker, Footer, Canvas, shapeGlow, T} from './v2shared';

// v2 기간 비교 카드 — 개월 수를 "실제 칸 개수"로 보여준다 (한 칸 = 1개월).
// bars: [{label, months, hot}] — 길이 차이가 그대로 보인다.
export const TimelineBarsCard = ({
  kicker = '',
  sub = '',
  bars = [],
  caption = '',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const enter = fadeIn(frame, 0, 14);

  const maxM = Math.max(...bars.map((b) => b.months), 1);
  const cellW = Math.min(34, Math.floor(1080 / maxM)); // 우측 'NN개월' 라벨 공간 확보
  const cellH = 64;
  const gap = 5;
  const left = 420;
  const rowH = 190;
  const top = 330;

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      <Canvas />
      <Kicker title={kicker} sub={sub} opacity={enter} />

      {/* 범례 */}
      <div style={{position: 'absolute', right: 120, top: 100, display: 'flex', alignItems: 'center', gap: 14, opacity: fadeIn(frame, 24)}}>
        <div style={{width: 16, height: 22, borderRadius: 3, border: `1.5px solid ${GRAY}`}} />
        <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 27, letterSpacing: '0.06em', color: MUTE}}>
          = 1개월
        </span>
      </div>

      {bars.map((b, bi) => {
        const lit = Math.floor(
          interpolate(frame, [14 + bi * 10, 60 + bi * 10], [0, b.months], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
        );
        const hot = Boolean(b.hot);
        const y = top + bi * rowH;
        return (
          <React.Fragment key={bi}>
            <div style={{position: 'absolute', left: 120, top: y + cellH / 2 - 22, opacity: fadeIn(frame, 12 + bi * 10)}}>
              <span style={{fontFamily: hot ? 'A2Z Regular, sans-serif' : 'A2Z Light, sans-serif', fontSize: 33, letterSpacing: '0.04em', color: hot ? WHITE : GRAY}}>
                {b.label}
              </span>
            </div>
            <svg width={1920} height={cellH + 10} style={{position: 'absolute', top: y, left: 0}}>
              {Array.from({length: b.months}, (_, i) => (
                <rect
                  key={i}
                  x={left + i * (cellW + gap)} y={0}
                  width={cellW} height={cellH} rx={4}
                  fill={i < lit ? (hot ? YELLOW : '#4A4A4A') : '#1A1A1A'}
                  stroke={i < lit ? 'none' : '#2A2A2A'}
                  style={i < lit && hot ? {filter: shapeGlow(0.7)} : undefined}
                />
              ))}
            </svg>
            <div
              style={{
                position: 'absolute',
                left: left + b.months * (cellW + gap) + 30,
                top: y + cellH / 2 - 32,
                opacity: fadeIn(frame, 46 + bi * 10),
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 56, letterSpacing: '0.01em', color: hot ? WHITE : GRAY, fontVariantNumeric: 'tabular-nums'}}>
                {b.months}개월
              </span>
            </div>
          </React.Fragment>
        );
      })}

      <Footer caption={caption} source={source} opacity={fadeIn(frame, 60)} />
    </AbsoluteFill>
  );
};
