import React from 'react';
import {AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {YELLOW, fadeIn, PaperSource} from './paper';

// 전체 화면 이미지 + 가운데(또는 아래) 한 줄 문구.
// 설명이 필요 없고 "장면 하나"로 밀어붙일 때 — 훅 전환, 배치도 전체보기, 클로징.
const SHADOW = '0 3px 24px rgba(0,0,0,0.8), 0 1px 5px rgba(0,0,0,0.6)';

export const FullBleedCard = ({
  image = '', headline = '', sub = '', caption = '',
  align = 'center',        // 'center' | 'bottom'
  scrim = 0.42,            // 이미지를 누르는 정도
  kenBurns = true, fit = 'cover',
  source = '', theme,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const zoom = kenBurns ? interpolate(frame, [0, 300], [1.03, 1.10], {extrapolateRight: 'clamp'}) : 1;
  const rise = interpolate(frame, [8, 34], [26, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const o = fadeIn(frame, 8);
  const top = align === 'bottom' ? 620 : 0;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: '#0b0e12'}}>
      {image ? (
        <Img src={staticFile(image)}
             style={{width: '100%', height: '100%', objectFit: fit, transform: `scale(${zoom})`}} />
      ) : null}
      <div style={{position: 'absolute', inset: 0, background: `rgba(11,14,18,${scrim})`}} />
      <div style={{position: 'absolute', inset: 0,
                   background: 'linear-gradient(180deg, rgba(11,14,18,0.45) 0%, rgba(11,14,18,0) 30%, rgba(11,14,18,0) 62%, rgba(11,14,18,0.62) 100%)'}} />

      <div style={{position: 'absolute', left: 160, width: 1600, top: top,
                   height: align === 'bottom' ? 'auto' : 1080,
                   display: 'flex', flexDirection: 'column', alignItems: 'center',
                   justifyContent: align === 'bottom' ? 'flex-start' : 'center',
                   textAlign: 'center', opacity: o, transform: `translateY(${rise}px)`}}>
        {headline ? (
          <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 80,
                       lineHeight: 1.25, letterSpacing: '-0.01em', color: '#FFFFFF',
                       textShadow: SHADOW, wordBreak: 'keep-all'}}>
            {headline}
          </div>
        ) : null}
        {sub ? (
          <div style={{marginTop: 22, fontFamily: 'A2Z Light, sans-serif', fontSize: 36,
                       letterSpacing: '0.04em', color: '#E4E8EE', textShadow: SHADOW,
                       wordBreak: 'keep-all', opacity: fadeIn(frame, 22)}}>
            {sub}
          </div>
        ) : null}
      </div>

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: 800, textAlign: 'center',
                     fontFamily: 'A2Z Medium, sans-serif', fontSize: 46, color: '#FFFFFF',
                     textShadow: SHADOW, opacity: fadeIn(frame, 30), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}

      {/* 출처는 우측 **상단** · `Source : …` — 채널 규칙.
          사진 카드만 하단에 있어서 컷이 넘어갈 때마다 출처가 위아래로
          튀었다 */}
      <PaperSource source={source} theme={theme} onPhoto />
    </AbsoluteFill>
  );
};
