import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, glow, fadeIn, Kicker, PerspectiveFloor} from './v2shared';

// v2 대형 타이포 헤드라인 — 문장 일부만 옐로 발광으로 강조.
// lines: [[{t: '소득 ', hot: false}, {t: '전국 1위', hot: true}], [...]]
// bgImage 를 주면 풀블리드 실사 + 다크 오버레이 위에 얹는다.
export const YHeadlineCard = ({
  kicker = '',
  sub = '',
  lines = [],
  caption = '',
  bgImage = '',
  floor = true,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = fadeIn(frame, 0, 14);
  const n = lines.length || 1;
  // 줄 길이에 맞춰 자동 축소 — 한 줄이 화면을 넘어 어중간하게 꺾이지 않게
  const maxLen = Math.max(1, ...lines.map((segs) => segs.reduce((a, s) => a + s.t.length, 0)));
  const fontSize = Math.min(n > 2 ? 110 : 150, Math.floor(1640 / maxLen));
  const totalH = n * fontSize * 1.28;
  const top = 470 - totalH / 2;

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Medium, sans-serif'}}>
      {bgImage ? (
        <>
          <Img
            src={staticFile(bgImage)}
            style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover'}}
          />
          <div
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              background: 'linear-gradient(180deg, rgba(10,10,10,.82) 0%, rgba(10,10,10,.6) 45%, rgba(10,10,10,.88) 100%)',
            }}
          />
        </>
      ) : floor ? (
        <PerspectiveFloor opacity={enter} />
      ) : null}

      {kicker ? <Kicker title={kicker} sub={sub} opacity={enter} /> : null}

      <div style={{position: 'absolute', top, left: 120, width: 1680}}>
        {lines.map((segs, i) => {
          const slide = spring({frame: frame - 8 - i * 9, fps, config: {damping: 200}, durationInFrames: 24});
          return (
            <div
              key={i}
              style={{
                fontSize,
                lineHeight: 1.28,
                letterSpacing: '0.01em',
                opacity: slide,
                transform: `translateY(${(1 - slide) * 46}px)`,
              }}
            >
              {segs.map((s, j) => (
                <span
                  key={j}
                  style={
                    s.hot
                      ? {color: YELLOW, textShadow: glow(0.9)}
                      : {color: WHITE}
                  }
                >
                  {s.t}
                </span>
              ))}
            </div>
          );
        })}
        {caption ? (
          <div
            style={{
              marginTop: 34,
              fontFamily: 'A2Z Light, sans-serif',
              fontSize: 38,
              letterSpacing: '0.06em',
              color: MUTE,
              opacity: fadeIn(frame, 8 + n * 9 + 10),
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
