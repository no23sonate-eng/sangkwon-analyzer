import React from 'react';
import {AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {YELLOW, fadeIn} from './paper';

// 좌우 분할 공원 비교 카드 — 화면을 반씩 나눠 각 공원의 실사를 깔고,
// 그 위에 공원 경계 실루엣과 면적을 얹는다. 실루엣은 알파 PNG 를 CSS 마스크로
// 써서 색을 코드에서 정한다(파일을 다시 굽지 않아도 됨).
// 실사는 어둡게 눌러 흰 글씨·실루엣이 확실히 뜨게 한다.
//
// sides: [{photo, shape, name, area, sub, hot}] — 2개
const SHADOW = '0 2px 20px rgba(0,0,0,0.75), 0 1px 4px rgba(0,0,0,0.6)';

const Side = ({s, x, w, frame, i, shapeW, shapeH, shapeCY}) => {
  const o = fadeIn(frame, 6 + i * 10);
  const shapeIn = interpolate(frame, [18 + i * 10, 54 + i * 10], [0, 1],
                              {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const zoom = interpolate(frame, [0, 300], [1.04, 1.1], {extrapolateRight: 'clamp'});
  const color = s.hot ? YELLOW : '#FFFFFF';
  return (
    <>
      <div style={{position: 'absolute', left: x, top: 0, width: w, height: 1080, overflow: 'hidden', opacity: o}}>
        <Img src={staticFile(s.photo)}
             style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`}} />
        {/* 실사 눌러주기 — 위는 더 어둡게(제목), 아래는 자막 대비 */}
        <div style={{position: 'absolute', inset: 0, background: 'rgba(11,14,18,0.62)'}} />
        <div style={{position: 'absolute', inset: 0,
                     background: 'linear-gradient(180deg, rgba(11,14,18,0.55) 0%, rgba(11,14,18,0.05) 40%, rgba(11,14,18,0.55) 100%)'}} />
      </div>

      {/* 공원 경계 실루엣 — 마스크로 색을 입힌다.
          크기는 두 공원이 **같은 축척**을 쓴다 (각자 박스에 맞추면 면적 비교가 무의미해짐) */}
      <div style={{position: 'absolute', left: x + w / 2 - shapeW / 2, top: shapeCY - shapeH / 2,
                   width: shapeW, height: shapeH,
                   opacity: shapeIn,
                   transform: `scale(${0.9 + 0.1 * shapeIn})`, transformOrigin: '50% 50%',
                   background: color,
                   WebkitMaskImage: `url(${staticFile(s.shape)})`,
                   maskImage: `url(${staticFile(s.shape)})`,
                   WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                   WebkitMaskPosition: 'center', maskPosition: 'center',
                   WebkitMaskSize: 'contain', maskSize: 'contain',
                   filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.55))'}} />

      <div style={{position: 'absolute', left: x, width: w, top: 690, textAlign: 'center',
                   opacity: fadeIn(frame, 34 + i * 10)}}>
        <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 52,
                     letterSpacing: '0.02em', color: '#FFFFFF', textShadow: SHADOW}}>
          {s.name}
        </div>
        <div style={{marginTop: 10, fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 66,
                     color: s.hot ? YELLOW : '#FFFFFF', fontVariantNumeric: 'tabular-nums', textShadow: SHADOW}}>
          {s.area}
        </div>
        {s.sub ? (
          <div style={{marginTop: 8, fontFamily: 'A2Z Light, sans-serif', fontSize: 34,
                       color: '#D8DDE4', textShadow: SHADOW}}>{s.sub}</div>
        ) : null}
      </div>
    </>
  );
};

export const ParkCompareCard = ({title = '', sub = '', sides = [], note = '', source = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  if (sides.length < 2) return <AbsoluteFill style={{background: '#12151a'}} />;
  const HALF = 960;
  // 두 실루엣은 하나의 축척(px per 도면px)을 공유한다. 각자 박스에 맞추면
  // 3.41㎢ 와 3.03㎢ 가 같은 크기로 보여 비교가 거짓말이 된다.
  const MAXH = 420, SHAPE_CY = 452;
  const k = MAXH / Math.max(...sides.map((s) => s.dh || 1));
  const dim = (s) => ({w: (s.dw || 1) * k, h: (s.dh || 1) * k});

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: '#0b0e12'}}>
      <Side s={sides[0]} x={0} w={HALF} frame={frame} i={0}
            shapeW={dim(sides[0]).w} shapeH={dim(sides[0]).h} shapeCY={SHAPE_CY} />
      <Side s={sides[1]} x={HALF} w={HALF} frame={frame} i={1}
            shapeW={dim(sides[1]).w} shapeH={dim(sides[1]).h} shapeCY={SHAPE_CY} />
      {/* 가운데 분할선 */}
      <div style={{position: 'absolute', left: HALF - 1, top: 0, width: 2, height: 1080,
                   background: 'rgba(255,255,255,0.35)'}} />

      <div style={{position: 'absolute', top: 96, left: 0, width: 1920, textAlign: 'center', opacity: fadeIn(frame, 0)}}>
        <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 68,
                     letterSpacing: '-0.01em', color: '#FFFFFF', textShadow: SHADOW}}>
          {title}
        </div>
        {sub ? (
          <div style={{marginTop: 12, fontFamily: 'A2Z Light, sans-serif', fontSize: 36,
                       letterSpacing: '0.06em', color: '#E4E8EE', textShadow: SHADOW}}>{sub}</div>
        ) : null}
      </div>

      {note ? (
        <div style={{position: 'absolute', left: 0, width: 1920, top: 208, textAlign: 'center',
                     opacity: fadeIn(frame, 62)}}>
          <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 44,
                        color: '#12151a', background: YELLOW, padding: '6px 20px'}}>{note}</span>
        </div>
      ) : null}

      {source ? (
        <div style={{position: 'absolute', right: 72, top: 1008, textAlign: 'right',
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 27, letterSpacing: '0.05em',
                     color: '#FFFFFF', opacity: 0.75 * fadeIn(frame, 40), textShadow: SHADOW}}>
          {source}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
