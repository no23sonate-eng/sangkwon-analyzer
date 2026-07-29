import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, ACCENT} from './shared';

// 개념 하나를 큰 타이포로 전달하는 클로징/전환용 카드.
export const HeadlineCard = ({line1 = '', line2 = '', accent = ACCENT}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 18], [0, 1], {extrapolateRight: 'clamp'});
  const y = interpolate(frame, [0, 18], [16, 0], {extrapolateRight: 'clamp'});
  const line2Opacity = interpolate(frame, [16, 34], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={BG_STYLE}>
      <GridBg />
      <div
        style={{
          position: 'absolute', top: 420, left: 0, width: '100%', textAlign: 'center',
          opacity, transform: `translateY(${y}px)`,
        }}
      >
        <div
          style={{
            fontSize: 56, color: '#EDEFF3', fontFamily: 'A2Z Light, sans-serif',
            letterSpacing: '0.01em', lineHeight: 1.4,
          }}
        >
          {line1}
        </div>
        {line2 ? (
          <div
            style={{
              fontSize: 56, color: accent, fontFamily: 'A2Z Regular, sans-serif',
              letterSpacing: '0.01em', marginTop: 10, opacity: line2Opacity,
            }}
          >
            {line2}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
