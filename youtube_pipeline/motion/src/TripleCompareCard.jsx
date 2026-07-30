import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT} from './shared';

const PALETTE = ['#C98A9E', '#8FAD8B', '#7B9BC2'];

// 3자 비교 카드 — DataTable(세로 리스트)과 달리 세 개체를 나란히
// 세로 컬럼으로 배치해 "비교"가 한눈에 읽히게 한다(2026-07-30 "그래프는
// 기존이랑 동일하게 하지마" 피드백 — 표 반복 대신 나란히 컬럼 비교로).
// items: [{name, value, note, accent}] 최대 3개.
export const TripleCompareCard = ({title = '', items = [], source = '', accent = ACCENT}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});

  const n = Math.min(items.length, 3) || 1;
  const COL_W = 420;
  const GAP = 70;
  const totalW = COL_W * n + GAP * (n - 1);
  const startX = (1920 - totalW) / 2;
  const COL_TOP = 340;

  return (
    <AbsoluteFill style={BG_STYLE}>
      <GridBg />

      <div
        style={{
          position: 'absolute', top: 130, left: 0, width: '100%', textAlign: 'center',
          fontSize: 34, opacity: titleOpacity, ...TEXT.title,
        }}
      >
        {title}
      </div>

      {items.slice(0, 3).map((item, i) => {
        const x = startX + i * (COL_W + GAP);
        const delay = 18 + i * 12;
        const opacity = interpolate(frame, [delay, delay + 18], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
        const y = interpolate(frame, [delay, delay + 18], [16, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
        const color = item.accent || PALETTE[i % PALETTE.length];
        return (
          <div key={i} style={{position: 'absolute', top: COL_TOP, left: x, width: COL_W, opacity, transform: `translateY(${y}px)`}}>
            <div style={{width: 40, height: 4, background: color, margin: '0 auto 26px'}} />
            <div style={{fontSize: 28, textAlign: 'center', marginBottom: 30, ...TEXT.label}}>{item.name}</div>
            <div style={{fontSize: 36, textAlign: 'center', lineHeight: 1.5, ...TEXT.value}}>{item.value}</div>
            {item.note ? (
              <div style={{fontSize: 20, textAlign: 'center', marginTop: 16, color: '#6B7078', fontFamily: 'A2Z Light, sans-serif'}}>
                {item.note}
              </div>
            ) : null}
          </div>
        );
      })}

      {n > 1 ? (
        <>
          {Array.from({length: n - 1}).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute', top: COL_TOP, left: startX + COL_W + GAP / 2 + i * (COL_W + GAP),
                width: 1, height: 340, background: 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </>
      ) : null}

      {source ? (
        <div
          style={{
            position: 'absolute', top: COL_TOP + 380, left: 0, width: '100%', textAlign: 'center',
            fontSize: 20, color: '#565C64', fontFamily: 'A2Z Light, sans-serif', fontStyle: 'italic',
            opacity: interpolate(frame, [50, 65], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          {source}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
