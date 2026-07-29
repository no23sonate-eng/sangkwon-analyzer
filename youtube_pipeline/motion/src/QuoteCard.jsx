import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT} from './shared';

// 인물 사진 없이(실사 얼굴 노출 금지 규칙) 타이포만으로 구성하는 인용구
// 카드 — 큰 따옴표 + 인용문 + 이름/직함.
export const QuoteCard = ({quote = '', name = '', role = '', accent = ACCENT}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();

  const markOpacity = interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  const quoteOpacity = interpolate(frame, [10, 26], [0, 1], {extrapolateRight: 'clamp'});
  const quoteY = interpolate(frame, [10, 26], [14, 0], {extrapolateRight: 'clamp'});
  const attrOpacity = interpolate(frame, [30, 42], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={BG_STYLE}>
      <GridBg />
      <div
        style={{
          position: 'absolute', top: 230, left: 0, width: '100%', textAlign: 'center',
          fontSize: 140, color: accent, opacity: markOpacity, fontFamily: 'A2Z Medium, sans-serif',
          lineHeight: '1',
        }}
      >
        “
      </div>

      <div
        style={{
          position: 'absolute', top: 400, left: '50%', transform: `translateX(-50%) translateY(${quoteY}px)`,
          width: 1300, textAlign: 'center', fontSize: 46, lineHeight: 1.5,
          color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif', letterSpacing: '0.01em',
          opacity: quoteOpacity,
        }}
      >
        {quote}
      </div>

      <div
        style={{
          position: 'absolute', top: 700, left: 0, width: '100%', textAlign: 'center',
          opacity: attrOpacity,
        }}
      >
        <div style={{width: 48, height: 2, background: accent, margin: '0 auto 20px'}} />
        <div style={{fontSize: 28, ...TEXT.value}}>{name}</div>
        {role ? (
          <div style={{fontSize: 20, marginTop: 6, ...TEXT.label}}>{role}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
