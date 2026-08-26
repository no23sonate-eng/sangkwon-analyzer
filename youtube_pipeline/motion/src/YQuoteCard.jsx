import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, GRAY, glow, fadeIn, Kicker, PerspectiveFloor} from './v2shared';

// v2 인용구 — 대형 옐로 따옴표 + 화이트 본문(수동 줄바꿈 pre-line 지원).
// quote2 가 있으면 카드 길이의 절반 지점에 2단 크로스페이드 전환.
export const YQuoteCard = ({
  kicker = '',
  quote = '',
  quote2 = '',
  name = '',
  role = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const enter = fadeIn(frame, 0, 14);
  const bodyIn = fadeIn(frame, 8, 18);

  const has2 = Boolean(quote2);
  const stage2Start = Math.round(durationInFrames * 0.5);
  const q1 = has2
    ? interpolate(frame, [stage2Start, stage2Start + 12], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 1;
  const q2 = has2
    ? interpolate(frame, [stage2Start + 6, stage2Start + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;

  const QuoteBlock = ({text, opacity}) => (
    <div style={{position: 'absolute', top: 300, left: 250, width: 1420, opacity}}>
      <div
        style={{
          position: 'absolute', top: -105, left: -130,
          fontFamily: 'A2Z Medium, sans-serif', fontSize: 200, lineHeight: 1,
          color: YELLOW, textShadow: glow(0.7),
        }}
      >
        “
      </div>
      <div
        style={{
          fontFamily: 'A2Z Regular, sans-serif', fontSize: 54, lineHeight: 1.55,
          letterSpacing: '0.02em', color: WHITE, whiteSpace: 'pre-line',
        }}
      >
        {text}
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      <PerspectiveFloor opacity={enter * 0.7} />
      {kicker ? <Kicker title={kicker} opacity={enter} /> : null}

      <QuoteBlock text={quote} opacity={bodyIn * q1} />
      {has2 ? <QuoteBlock text={quote2} opacity={q2} /> : null}

      {name ? (
        <div style={{position: 'absolute', left: 250, top: 690, opacity: fadeIn(frame, 30)}}>
          <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 36, letterSpacing: '0.06em', color: WHITE}}>
            {name}
          </span>
          {role ? (
            <span style={{marginLeft: 24, fontFamily: 'A2Z Light, sans-serif', fontSize: 28, letterSpacing: '0.06em', color: MUTE}}>
              {role}
            </span>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
