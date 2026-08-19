import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, GRAY, LINE, glow, fadeIn, Kicker, Footer, Canvas, T} from './v2shared';

// v2 데이터 테이블 — 얇은 구분선 + 좌측 라벨 / 우측정렬 값.
// rows: [{label, value, note, hot}] — hot 값만 옐로 발광.
// closingLine: 마지막에 옐로로 떠오르는 요약 문장(선택).
export const YTableCard = ({
  kicker = '',
  sub = '',
  rows = [],
  closingLine = '',
  caption = '',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const enter = fadeIn(frame, 0, 14);

  const n = rows.length || 1;
  const rowH = n > 3 ? 118 : 138;
  const tableW = 1280;
  const left = (1920 - tableW) / 2;
  const closingSpace = closingLine ? 110 : 0;
  const top = Math.max(236, 470 - (n * rowH + closingSpace) / 2);

  const closingIn = interpolate(
    frame,
    [Math.round(durationInFrames * 0.45), Math.round(durationInFrames * 0.45) + 18],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      <Canvas />
      <Kicker title={kicker} sub={sub} opacity={enter} />

      {rows.map((r, i) => {
        const rowIn = spring({frame: frame - 12 - i * 8, fps, config: {damping: 200}, durationInFrames: 22});
        const y = top + i * rowH;
        return (
          <div key={i} style={{position: 'absolute', top: y, left, width: tableW, height: rowH, opacity: rowIn}}>
            <div style={{position: 'absolute', bottom: 0, left: 0, width: tableW, height: 1, background: LINE}} />
            {i === 0 ? (
              <div style={{position: 'absolute', top: 0, left: 0, width: tableW, height: 1, background: LINE}} />
            ) : null}
            <div
              style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 10,
                fontFamily: 'A2Z Light, sans-serif', fontSize: 34,
                letterSpacing: '0.05em', color: r.hot ? WHITE : GRAY,
              }}
            >
              {r.label}
            </div>
            <div
              style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 10,
                textAlign: 'right',
              }}
            >
              <span
                style={{
                  fontFamily: 'A2Z Medium, sans-serif',
                  fontSize: r.hot ? 52 : 44,
                  letterSpacing: '0.02em',
                  color: r.hot ? YELLOW : WHITE,
                  
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {r.value}
              </span>
              {r.note ? (
                <span
                  style={{
                    marginLeft: 20, fontFamily: 'A2Z Light, sans-serif',
                    fontSize: 27, letterSpacing: '0.04em', color: MUTE,
                  }}
                >
                  {r.note}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}

      {closingLine ? (
        <div
          style={{
            position: 'absolute', top: top + n * rowH + 52, left, width: tableW,
            textAlign: 'center',
            fontFamily: 'A2Z Regular, sans-serif', fontSize: 44,
            letterSpacing: '0.04em', color: WHITE,
            opacity: closingIn,
          }}
        >
          {closingLine}
        </div>
      ) : null}

      <Footer caption={caption} source={source} opacity={fadeIn(frame, 12 + n * 8 + 14)} />
    </AbsoluteFill>
  );
};
