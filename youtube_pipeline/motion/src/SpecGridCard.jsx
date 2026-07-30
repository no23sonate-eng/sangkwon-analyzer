import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT} from './shared';

// 스펙시트형 카드 — DataTable(세로 리스트 표)과는 다른 리듬을 주기 위한
// 2x2(또는 그 이하) 그리드 배치(2026-07-30 "그래프는 기존이랑 동일하게
// 하지마" 피드백 — 표 반복 대신 쿼드런트 스펙시트로). items: [{label,
// value, note}] 최대 4개. 십자 구분선으로 4분할, 각 칸은 라벨 위·값 아래.
export const SpecGridCard = ({title = '', items = [], source = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});

  const GRID_TOP = 300;
  const GRID_W = 1240;
  const GRID_H = 480;
  const COLS = 2;
  const cellW = GRID_W / COLS;
  const cellH = GRID_H / Math.ceil((items.length || 1) / COLS);
  const left = (1920 - GRID_W) / 2;

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

      <div style={{position: 'absolute', top: GRID_TOP, left, width: GRID_W, height: GRID_H}}>
        {/* 십자 구분선 */}
        <div style={{position: 'absolute', top: 0, left: cellW, width: 1, height: GRID_H, background: 'rgba(255,255,255,0.12)'}} />
        <div style={{position: 'absolute', top: cellH, left: 0, width: GRID_W, height: 1, background: 'rgba(255,255,255,0.12)'}} />

        {items.slice(0, 4).map((item, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const delay = 15 + i * 10;
          const opacity = interpolate(frame, [delay, delay + 16], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
          const y = interpolate(frame, [delay, delay + 16], [14, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
          return (
            <div
              key={i}
              style={{
                position: 'absolute', top: row * cellH, left: col * cellW, width: cellW, height: cellH,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                opacity, transform: `translateY(${y}px)`,
              }}
            >
              <div style={{fontSize: 24, marginBottom: 18, ...TEXT.label}}>{item.label}</div>
              <div style={{fontSize: 44, ...TEXT.value, textAlign: 'center'}}>{item.value}</div>
              {item.note ? (
                <div style={{fontSize: 20, marginTop: 10, color: '#6B7078', fontFamily: 'A2Z Light, sans-serif'}}>
                  {item.note}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {source ? (
        <div
          style={{
            position: 'absolute', top: GRID_TOP + GRID_H + 30, left, fontSize: 20, color: '#565C64',
            fontFamily: 'A2Z Light, sans-serif', fontStyle: 'italic',
            opacity: interpolate(frame, [50, 65], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          {source}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
