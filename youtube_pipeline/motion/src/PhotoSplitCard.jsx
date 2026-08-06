import React from 'react';
import {AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {YELLOW, fadeIn} from './paper';

// 좌우 분할 실사 대비 카드 — 두 대상을 각각 실사 반쪽에 놓고 수치·특징을 얹는다.
// SplitCard(종이·글자만)와 달리 **둘이 실제로 어떻게 생겼는지**가 같이 보인다.
// 같은 입지에 놓인 서로 다른 답을 나란히 보여줄 때.
//
// sides: [{photo, name, sub, stat, statUnit, lines:[...], hot}]
const SHADOW = '0 2px 20px rgba(0,0,0,0.78), 0 1px 4px rgba(0,0,0,0.6)';

const Side = ({s, x, w, frame, i}) => {
  const o = fadeIn(frame, 6 + i * 10);
  const zoom = interpolate(frame, [0, 340], [1.05, 1.13], {extrapolateRight: 'clamp'});
  const rise = interpolate(frame, [10 + i * 10, 40 + i * 10], [22, 0],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <>
      <div style={{position: 'absolute', left: x, top: 0, width: w, height: 1080, overflow: 'hidden', opacity: o}}>
        <Img src={staticFile(s.photo)}
             style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`}} />
        <div style={{position: 'absolute', inset: 0, background: 'rgba(11,14,18,0.50)'}} />
        <div style={{position: 'absolute', inset: 0,
                     background: 'linear-gradient(180deg, rgba(11,14,18,0.66) 0%, rgba(11,14,18,0.08) 34%, rgba(11,14,18,0.78) 100%)'}} />
      </div>

      <div style={{position: 'absolute', left: x + 70, width: w - 140, top: 300,
                   textAlign: 'center', opacity: o, transform: `translateY(${rise}px)`}}>
        <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 56,
                     color: '#FFFFFF', lineHeight: 1.2, textShadow: SHADOW, wordBreak: 'keep-all'}}>
          {s.hot ? <span style={{background: YELLOW, color: '#12151a', padding: '2px 16px', textShadow: 'none'}}>{s.name}</span> : s.name}
        </div>
        {s.sub ? (
          <div style={{marginTop: 14, fontFamily: 'A2Z Light, sans-serif', fontSize: 34,
                       color: '#D8DDE4', textShadow: SHADOW}}>{s.sub}</div>
        ) : null}
        {s.stat ? (
          <div style={{marginTop: 30, fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 110,
                       color: s.hot ? YELLOW : '#FFFFFF', lineHeight: 1,
                       fontVariantNumeric: 'tabular-nums', textShadow: SHADOW}}>
            {s.stat}<span style={{fontSize: 52, marginLeft: 6}}>{s.statUnit}</span>
          </div>
        ) : null}
        <div style={{marginTop: 34}}>
          {(s.lines || []).map((ln, k) => (
            <div key={k} style={{marginTop: k ? 16 : 0, fontFamily: 'A2Z Regular, sans-serif',
                                 fontSize: 36, color: '#EDF0F4', lineHeight: 1.3,
                                 textShadow: SHADOW, wordBreak: 'keep-all',
                                 opacity: fadeIn(frame, 26 + i * 10 + k * 8)}}>
              {ln}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export const PhotoSplitCard = ({title = '', sub = '', sides = [], verdict = '', source = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  if (sides.length < 2) return <AbsoluteFill style={{background: '#12151a'}} />;
  const HALF = 960;
  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: '#0b0e12'}}>
      <Side s={sides[0]} x={0} w={HALF} frame={frame} i={0} />
      <Side s={sides[1]} x={HALF} w={HALF} frame={frame} i={1} />
      <div style={{position: 'absolute', left: HALF - 1, top: 0, width: 2, height: 1080,
                   background: 'rgba(255,255,255,0.32)'}} />

      <div style={{position: 'absolute', top: 96, left: 0, width: 1920, textAlign: 'center', opacity: fadeIn(frame, 0)}}>
        <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 68,
                     letterSpacing: '-0.01em', color: '#FFFFFF', textShadow: SHADOW}}>{title}</div>
        {sub ? (
          <div style={{marginTop: 12, fontFamily: 'A2Z Light, sans-serif', fontSize: 36,
                       letterSpacing: '0.06em', color: '#E4E8EE', textShadow: SHADOW}}>{sub}</div>
        ) : null}
      </div>

      {verdict ? (
        <div style={{position: 'absolute', left: 0, width: 1920, top: 812, textAlign: 'center',
                     opacity: fadeIn(frame, 62)}}>
          <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 48,
                        color: '#12151a', background: YELLOW, padding: '8px 24px'}}>{verdict}</span>
        </div>
      ) : null}
      {source ? (
        <div style={{position: 'absolute', right: 44, top: 1028, textAlign: 'right',
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 27, letterSpacing: '0.05em',
                     color: '#FFFFFF', opacity: 0.75 * fadeIn(frame, 40), textShadow: SHADOW}}>
          {source}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
