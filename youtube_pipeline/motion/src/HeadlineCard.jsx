import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, ACCENT, MediaBg} from './shared';

// 개념 하나를 큰 타이포로 전달하는 클로징/전환용 카드.
//
// bgVideo/bgImage: 실사 배경 위에 개념 문장을 얹는다(2026-07-29
// "중동지역 이미지 위에 글자 올려줘" 피드백).
// light=true: 화이트 배경 + 검정 글자 — 어두운 카드가 계속 이어질 때
// 톤 전환용 드라마틱한 대비(2026-07-29 "#4 배경을 화이트로" 피드백).
export const HeadlineCard = ({
  line1 = '', line2 = '', accent = ACCENT,
  bgVideo = '', bgImage = '', bgVideoStart = 0,
  light = false,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const hasMedia = Boolean(bgVideo || bgImage);

  const opacity = interpolate(frame, [0, 18], [0, 1], {extrapolateRight: 'clamp'});
  const y = interpolate(frame, [0, 18], [16, 0], {extrapolateRight: 'clamp'});
  const line2Opacity = interpolate(frame, [16, 34], [0, 1], {extrapolateRight: 'clamp'});

  const line1Color = light ? '#0A0B0D' : '#EDEFF3';
  // 실사 배경 위에서는 accent(무채색 회색)가 너무 흐려 잘 안 보여서
  // 더 밝은 톤을 쓴다 — 차콜 배경 전용으로 설계된 색이라 사진 위에서는
  // 대비가 부족했다(2026-07-29 legibility 점검).
  const line2Color = light ? '#000000' : (hasMedia ? '#D7DAE0' : accent);

  return (
    <AbsoluteFill style={hasMedia ? {backgroundColor: '#05070a'} : (light ? {background: '#F4F1EC'} : BG_STYLE)}>
      {hasMedia ? (
        <MediaBg video={bgVideo} image={bgImage} videoStart={bgVideoStart} />
      ) : !light ? (
        <GridBg />
      ) : null}
      <div
        style={{
          position: 'absolute', top: 420, left: 0, width: '100%', textAlign: 'center',
          opacity, transform: `translateY(${y}px)`,
        }}
      >
        <div
          style={{
            fontSize: 56, color: line1Color, fontFamily: 'A2Z Light, sans-serif',
            letterSpacing: '0.01em', lineHeight: 1.4,
          }}
        >
          {line1}
        </div>
        {line2 ? (
          <div
            style={{
              fontSize: 56, color: line2Color, fontFamily: 'A2Z Regular, sans-serif',
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
