import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_SOFT, YELLOW, fadeIn} from './paper';

// 좌우 대비 카드 — 두 항목을 한 화면에서 갈라 놓고 비교한다.
// 아이콘 3개를 좌→우로 세우는 것과 달리, "둘 사이의 간극"이 주어다.
// left/right: {label, sub, lines:[...], hot}
const Col = ({d, x, w, frame, delay}) => {
  const o = fadeIn(frame, delay);
  return (
    <div style={{position: 'absolute', left: x, width: w, top: 320, opacity: o, textAlign: 'center'}}>
      <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 62,
                   color: INK, lineHeight: 1.2, wordBreak: 'keep-all'}}>
        {d.hot ? <span style={{background: 'rgba(250,255,46,0.8)', padding: '2px 14px'}}>{d.label}</span> : d.label}
      </div>
      {d.sub ? (
        <div style={{marginTop: 14, fontFamily: 'A2Z Light, sans-serif', fontSize: 36, color: INK_SOFT}}>
          {d.sub}
        </div>
      ) : null}
      <div style={{marginTop: 46}}>
        {(d.lines || []).map((ln, i) => (
          <div key={i} style={{marginTop: i ? 22 : 0, fontFamily: 'A2Z Regular, sans-serif',
                               fontSize: 40, color: INK, lineHeight: 1.3, wordBreak: 'keep-all',
                               opacity: fadeIn(frame, delay + 12 + i * 8)}}>
            {ln}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SplitCard = ({title = '', sub = '', left = {}, right = {}, verdict = '', source = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const HALF = 960, PAD = 110;
  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <line x1={HALF} y1={302} x2={HALF} y2={716} stroke={INK} strokeWidth={2.5}
              strokeDasharray="10 8" opacity={0.4 * fadeIn(frame, 4)} />
      </svg>
      <Col d={left} x={PAD} w={HALF - PAD * 1.5} frame={frame} delay={8} />
      <Col d={right} x={HALF + PAD * 0.5} w={HALF - PAD * 1.5} frame={frame} delay={20} />
      {verdict ? (
        <div style={{position: 'absolute', left: 160, width: 1600, top: 746, textAlign: 'center',
                     opacity: fadeIn(frame, 52)}}>
          <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 48,
                        color: INK, background: YELLOW, padding: '6px 22px', wordBreak: 'keep-all'}}>
            {verdict}
          </span>
        </div>
      ) : null}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
