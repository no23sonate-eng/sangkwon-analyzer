import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, GRAY, LINE, glow, fadeIn, Kicker, Footer} from './v2shared';

// v2 좌우 대비 — 두 입장/두 수치의 대조. hot 쪽만 옐로.
// 각 side: {title, value, lines: [], empty, emptyLabel, hot}
// value(빅넘버 모드)와 lines(불릿 모드)는 함께 써도 된다.
const Side = ({side, x, w, delay, frame, fps}) => {
  const pop = spring({frame: frame - delay, fps, config: {damping: 200}, durationInFrames: 24});
  const hot = Boolean(side.hot);
  return (
    <div
      style={{
        position: 'absolute', top: 270, left: x, width: w, height: 440,
        border: `1.5px solid ${hot ? YELLOW : LINE}`,
        borderRadius: 6,
        background: hot ? 'rgba(250,255,46,0.05)' : 'rgba(255,255,255,0.02)',
        boxShadow: hot ? '0 0 26px rgba(250,255,46,0.22)' : 'none',
        opacity: pop,
        transform: `scale(${0.94 + 0.06 * pop})`,
      }}
    >
      <div
        style={{
          marginTop: 44, textAlign: 'center',
          fontFamily: 'A2Z Regular, sans-serif', fontSize: 37,
          letterSpacing: '0.08em', color: hot ? WHITE : GRAY,
        }}
      >
        {side.title}
      </div>

      {side.empty ? (
        <div
          style={{
            position: 'absolute', top: '52%', left: 0, width: '100%', textAlign: 'center',
            fontFamily: 'A2Z Light, sans-serif', fontSize: 40,
            letterSpacing: '0.1em', color: MUTE,
          }}
        >
          {side.emptyLabel || '확인되지 않음'}
        </div>
      ) : (
        <>
          {side.value ? (
            <div
              style={{
                marginTop: 30, textAlign: 'center',
                fontFamily: 'A2Z Medium, sans-serif',
                fontSize: 110, lineHeight: 1.1,
                letterSpacing: '0.01em',
                color: hot ? YELLOW : '#7A7A7A',
                textShadow: hot ? glow(0.8) : 'none',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {side.value}
            </div>
          ) : null}
          {(side.lines || []).length ? (
            <div style={{marginTop: side.value ? 26 : 44, padding: '0 56px'}}>
              {side.lines.map((ln, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 18,
                    marginBottom: 20,
                    fontFamily: 'A2Z Light, sans-serif', fontSize: 31,
                    letterSpacing: '0.03em', lineHeight: 1.4,
                    color: hot ? WHITE : GRAY,
                  }}
                >
                  <span style={{color: hot ? YELLOW : MUTE, fontSize: 24}}>—</span>
                  <span>{ln}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export const YCompareCard = ({
  kicker = '',
  sub = '',
  left = {},
  right = {},
  vsLabel = 'VS',
  caption = '',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = fadeIn(frame, 0, 14);
  const W = 730;
  const GAPC = 1920 / 2;

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      <Kicker title={kicker} sub={sub} opacity={enter} />

      <Side side={left} x={GAPC - W - 65} w={W} delay={10} frame={frame} fps={fps} />
      <Side side={right} x={GAPC + 65} w={W} delay={20} frame={frame} fps={fps} />

      {vsLabel ? (
        <div
          style={{
            position: 'absolute', top: 462, left: 0, width: 1920, textAlign: 'center',
            fontFamily: 'A2Z Medium, sans-serif', fontSize: 34,
            letterSpacing: '0.2em', color: MUTE,
            opacity: fadeIn(frame, 28),
          }}
        >
          {vsLabel}
        </div>
      ) : null}

      <Footer caption={caption} source={source} opacity={fadeIn(frame, 42)} />
    </AbsoluteFill>
  );
};
