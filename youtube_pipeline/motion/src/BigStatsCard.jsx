import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_SOFT, YELLOW, fadeIn} from './paper';

// 큰 수치만 남긴 카드 — 도형을 걷어내고 숫자 2~3개로 끝낸다.
// 격자·막대가 오히려 지저분해지는 구간에서 쓴다.
// items: [{value, unit, label, sub, hot, decimals}]
export const BigStatsCard = ({title = '', sub = '', items = [], source = '', caption = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = items.length;
  if (!n) return <AbsoluteFill><PaperBg /></AbsoluteFill>;
  const slot = Math.min(720, 1680 / n);
  const startX = (1920 - slot * n) / 2;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {items.slice(1).map((_, i) => (
          <line key={i} x1={startX + slot * (i + 1)} y1={388} x2={startX + slot * (i + 1)} y2={648}
                stroke={INK} strokeWidth={2} opacity={0.22 * fadeIn(frame, 10)} />
        ))}
      </svg>
      {items.map((it, i) => {
        const v = interpolate(frame, [14 + i * 12, 62 + i * 12], [0, it.value ?? 0],
                              {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <div key={i} style={{position: 'absolute', left: startX + i * slot, width: slot, top: 400,
                               textAlign: 'center', opacity: fadeIn(frame, 8 + i * 12)}}>
            <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                         fontSize: it.hot ? 148 : 124, color: INK, lineHeight: 1,
                         fontVariantNumeric: 'tabular-nums'}}>
              {it.display ?? v.toFixed(it.decimals ?? 0)}
              <span style={{fontSize: it.hot ? 66 : 56, marginLeft: 6,
                            color: it.hot ? INK : INK_SOFT}}>{it.unit}</span>
            </div>
            <div style={{marginTop: 26, fontFamily: it.hot ? 'Pretendard Bold, A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                         fontSize: 46, color: INK, wordBreak: 'keep-all'}}>
              {it.hot ? <span style={{background: 'rgba(250,255,46,0.8)', padding: '2px 12px'}}>{it.label}</span> : it.label}
            </div>
            {it.sub ? (
              <div style={{marginTop: 10, fontFamily: 'A2Z Light, sans-serif', fontSize: 34, color: INK_SOFT, wordBreak: 'keep-all'}}>
                {it.sub}
              </div>
            ) : null}
          </div>
        );
      })}
      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: 730, textAlign: 'center',
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 34, color: INK_SOFT,
                     opacity: fadeIn(frame, 56), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
