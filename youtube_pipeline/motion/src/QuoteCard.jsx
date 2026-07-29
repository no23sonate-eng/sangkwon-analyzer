import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT} from './shared';

// 인용구 카드 — 큰 따옴표 + 인용문 + 이름/직함. photo 를 주면 인용
// 당사자의 실제 사진을 우측에 자연스럽게(가장자리는 배경에 스며들도록
// 페이드) 일부만 걸치게 배치한다(2026-07-29 "기타오 요시타카 사진을
// 자연스럽게 우측에 일부만" 피드백) — 실제 발언 당사자를 보여주는
// 것이므로 "얼굴 노출 금지"(자료화면 필러용 스톡 얼굴) 규칙과는 별개.
export const QuoteCard = ({quote = '', name = '', role = '', accent = ACCENT, photo = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();

  const markOpacity = interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  const quoteOpacity = interpolate(frame, [10, 26], [0, 1], {extrapolateRight: 'clamp'});
  const quoteY = interpolate(frame, [10, 26], [14, 0], {extrapolateRight: 'clamp'});
  const attrOpacity = interpolate(frame, [30, 42], [0, 1], {extrapolateRight: 'clamp'});
  const photoOpacity = interpolate(frame, [18, 42], [0, 1], {extrapolateRight: 'clamp'});
  const photoX = interpolate(frame, [18, 42], [40, 0], {extrapolateRight: 'clamp'});

  const hasPhoto = Boolean(photo);
  const quoteWidth = hasPhoto ? 1120 : 1300;
  const quoteCenter = hasPhoto ? '44%' : '50%';

  return (
    <AbsoluteFill style={BG_STYLE}>
      <GridBg />

      {hasPhoto ? (
        <div
          style={{
            position: 'absolute', top: 140, right: 140, width: 460, height: 700,
            opacity: photoOpacity, transform: `translateX(${photoX}px)`,
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 22%)',
            maskImage: 'linear-gradient(90deg, transparent 0%, black 22%)',
          }}
        >
          <Img
            src={staticFile(photo)}
            style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8}}
          />
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute', top: 230, left: quoteCenter, transform: 'translateX(-50%)', width: '100%',
          textAlign: hasPhoto ? 'left' : 'center',
          fontSize: 140, color: accent, opacity: markOpacity, fontFamily: 'A2Z Medium, sans-serif',
          lineHeight: '1',
        }}
      >
        <div style={{width: quoteWidth, textAlign: hasPhoto ? 'left' : 'center'}}>“</div>
      </div>

      <div
        style={{
          position: 'absolute', top: 400, left: quoteCenter, transform: `translateX(-50%) translateY(${quoteY}px)`,
          width: quoteWidth, textAlign: hasPhoto ? 'left' : 'center', fontSize: 46, lineHeight: 1.5,
          color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif', letterSpacing: '0.01em',
          opacity: quoteOpacity,
        }}
      >
        {quote}
      </div>

      <div
        style={{
          position: 'absolute', top: 700, left: quoteCenter, transform: 'translateX(-50%)', width: quoteWidth,
          textAlign: hasPhoto ? 'left' : 'center', opacity: attrOpacity,
        }}
      >
        <div style={{width: 48, height: 2, background: accent, margin: hasPhoto ? '0 0 20px' : '0 auto 20px'}} />
        <div style={{fontSize: 28, ...TEXT.value}}>{name}</div>
        {role ? (
          <div style={{fontSize: 20, marginTop: 6, ...TEXT.label}}>{role}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
