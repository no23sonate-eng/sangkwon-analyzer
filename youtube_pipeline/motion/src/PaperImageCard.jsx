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
  wide = false,   // true면 화면 폭을 더 쓰는 와이드 프레임
  ratio = 0,      // 원본 가로/세로 비. 주면 액자를 그 비율에 맞춰 잘림 없이 담는다
  fit = 'cover',  // 'contain' 이면 다이어그램처럼 잘리면 안 되는 이미지
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const o = fadeIn(frame, 8);
  // 캡션까지 자막 안전영역(y<820) 안에서 끝나도록 프레임 크기 산정.
  // 타이틀·서브·이미지타이틀이 있으면 그만큼 프레임을 내리고 높이를 깎는다
  // (2026-08-06 폰트 확대 이후 상단 블록이 커져 고정값으로는 겹침).
  const titleBottom = title ? (sub ? 285 : 224) : 122;
  const top = titleBottom + 28 + (imageTitle ? 58 : 0);
  const maxW = wide ? 1360 : 1000;
  const maxH = Math.min(wide ? 620 : 600, 758 - top);
  // ratio 를 주면 (maxW × maxH) 안에 그 비율로 액자를 맞춘다 → 잘림/여백 없음
  const H = ratio ? Math.min(maxH, maxW / ratio) : maxH;
  const W = ratio ? Math.min(maxW, H * ratio) : maxW;
  const left = (1920 - W) / 2;
  const MAT = 16; // 흰 매트 두께
  const zoom = kenBurns ? interpolate(frame, [0, 280], [1, 1.06], {extrapolateRight: 'clamp'}) : 1;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      {imageTitle ? (
        <div style={{position: 'absolute', left, width: W, top: top - 56, textAlign: 'center',
                     fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 43, letterSpacing: '0.01em', color: INK, opacity: o}}>
          {imageTitle}
        </div>
      ) : null}
      <div style={{position: 'absolute', left, top, width: W, height: H, background: '#FFFFFF',
                   boxShadow: '0 10px 34px rgba(35,38,43,0.22)', padding: MAT, opacity: o}}>
        <div style={{width: '100%', height: '100%', overflow: 'hidden'}}>
          {image ? (
            <Img src={staticFile(image)} style={{width: '100%', height: '100%', objectFit: fit, transform: `scale(${zoom})`}} />
          ) : null}
        </div>
      </div>
      {caption ? (
        <div style={{position: 'absolute', left: 260, width: 1400, top: top + H + 16, textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 34, lineHeight: 1.4, letterSpacing: '0.04em', color: INK_SOFT, opacity: fadeIn(frame, 26), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
