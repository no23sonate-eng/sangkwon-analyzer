import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_SOFT, CONTENT_BOTTOM, fadeIn} from './paper';

// 종이 위 이미지 프레임 카드 — B1M의 "자료 이미지를 흰 매트 액자로 종이에
// 얹는" 문법. 이미지 위 오버라인 브래킷 + 볼드 타이틀, 아래 캡션.
// image: motion/public/ 기준 상대경로. kenBurns: 느린 줌(1.0→1.06).
export const PaperImageCard = ({
  title = '',
  sub = '',
  image = '',
  caption = '',
  imageTitle = '',
  source = '',
  kenBurns = true,
  wide = false, // true면 화면 폭을 더 쓰는 와이드 프레임
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const o = fadeIn(frame, 8);
  // 캡션까지 자막 안전영역(y<820) 안에서 끝나도록 프레임 크기 산정
  const W = wide ? 1360 : 1000;
  const H = wide ? 540 : 560;
  const left = (1920 - W) / 2;
  const top = title ? 196 : 150;
  const MAT = 16; // 흰 매트 두께
  const zoom = kenBurns ? interpolate(frame, [0, 280], [1, 1.06], {extrapolateRight: 'clamp'}) : 1;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      {imageTitle ? (
        <div style={{position: 'absolute', left, width: W, top: top - 52, textAlign: 'center',
                     fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 32, letterSpacing: '0.01em', color: INK, opacity: o}}>
          {imageTitle}
        </div>
      ) : null}
      <div style={{position: 'absolute', left, top, width: W, height: H, background: '#FFFFFF',
                   boxShadow: '0 10px 34px rgba(35,38,43,0.22)', padding: MAT, opacity: o}}>
        <div style={{width: '100%', height: '100%', overflow: 'hidden'}}>
          {image ? (
            <Img src={staticFile(image)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`}} />
          ) : null}
        </div>
      </div>
      {caption ? (
        <div style={{position: 'absolute', left: left + 4, width: W - 8, top: top + H + 20, textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 25, letterSpacing: '0.04em', color: INK_SOFT, opacity: fadeIn(frame, 26), whiteSpace: 'nowrap', overflow: 'hidden'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
