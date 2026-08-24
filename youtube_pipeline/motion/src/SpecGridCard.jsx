import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, CONTENT_BOTTOM, fadeIn, SP} from './paper';

// ── 스펙시트 ──────────────────────────────────────────────────────────────
// "지하 3층 지상 38층, 138m, 1,020실" 처럼 **성격이 다른 수치가 나란히**
// 오는 문장. 표로 세로로 늘어놓으면 읽는 순서가 강요되는데, 이건 넷을
// 동시에 던지는 자리라 사분면이 맞다.
//
// **종이 시스템으로 옮긴 카드다.** (원래 `shared` 먹 배경)
//   흰색 반투명 구분선 → T.ink 얇은 선. 종이 위에서 흰 선은 안 보인다
//   배경별 글자색 분기 → 없앴다. 테마가 색을 정한다
//   출처 좌하단        → PaperSource(우측 상단)
//
// items: [{label, value, note}] 최대 4개
export const SpecGridCard = ({
  title = '', sub = '', items = [], bgImage = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);

  const list = items.slice(0, 4);
  const COLS = list.length <= 2 ? list.length || 1 : 2;
  const ROWS = Math.ceil(list.length / COLS) || 1;
  const GRID_W = 1300, GRID_H = Math.min(520, 260 * ROWS);
  const cellW = GRID_W / COLS, cellH = GRID_H / ROWS;
  const left = (1920 - GRID_W) / 2;
  const top = title ? (sub ? 300 : 258) : 200;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} backdrop={bgImage} veil={0.9} {...bg} />

      {title ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: 150, textAlign: 'center',
                     opacity: fadeIn(frame, 0)}}>
          <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                       fontSize: 44, color: T.ink, wordBreak: 'keep-all'}}>{title}</div>
          {sub ? (
            <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: 30, color: T.soft}}>{sub}</div>
          ) : null}
        </div>
      ) : null}

      <div style={{position: 'absolute', top, left, width: GRID_W, height: GRID_H}}>
        {Array.from({length: COLS - 1}, (_, i) => (
          <div key={`v${i}`} style={{position: 'absolute', top: 0, left: (i + 1) * cellW,
                                     width: 1, height: GRID_H, background: T.ink, opacity: 0.22}} />
        ))}
        {Array.from({length: ROWS - 1}, (_, i) => (
          <div key={`h${i}`} style={{position: 'absolute', top: (i + 1) * cellH, left: 0,
                                     width: GRID_W, height: 1, background: T.ink, opacity: 0.22}} />
        ))}

        {list.map((it, i) => {
          const col = i % COLS, row = Math.floor(i / COLS);
          const d = 15 + i * 10;
          const o = interpolate(frame, [d, d + 16], [0, 1],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const dy = interpolate(frame, [d, d + 16], [14, 0],
                                 {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const v = String(it.value ?? '');
          return (
            <div key={i} style={{position: 'absolute', top: row * cellH, left: col * cellW,
                                 width: cellW, height: cellH, padding: '0 28px',
                                 display: 'flex', flexDirection: 'column',
                                 alignItems: 'center', justifyContent: 'center',
                                 opacity: o, transform: `translateY(${dy}px)`}}>
              <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: T.soft,
                           marginBottom: SP.NEAR, wordBreak: 'keep-all', textAlign: 'center'}}>
                {it.label}
              </div>
              <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                           fontSize: Math.min(56, Math.max(32, Math.floor(cellW / Math.max(3, v.length) * 1.7))),
                           color: T.ink, textAlign: 'center', wordBreak: 'keep-all',
                           fontVariantNumeric: 'tabular-nums'}}>
                {v}
              </div>
              {it.note ? (
                <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                             fontSize: 25, color: T.soft, textAlign: 'center',
                             wordBreak: 'keep-all'}}>{it.note}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
