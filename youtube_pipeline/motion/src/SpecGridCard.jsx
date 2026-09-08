import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, PaperCaption, CONTENT_BOTTOM, fadeIn,
        SP, LW, FS, stageTop} from './paper';

// ── 스펙시트 ──────────────────────────────────────────────────────────────
// "지하 3층 지상 38층, 138m, 1,020실" 처럼 **성격이 다른 값이 나란히** 오는
// 문장. 세로 표로 늘어놓으면 읽는 순서가 강요되는데, 이건 서넛을 동시에
// 던지는 자리라 칸으로 나눠 놓는 게 맞다.
//
// ── 2026-09-09 · 자리와 크기를 다시 잡았다 ────────────────────────────
//  ① 격자가 y=200 에 못 박혀 있어, 항목이 한둘일 때 **화면 아래 절반이
//     통째로 비었다.** 제목과 격자를 한 덩어리로 재서 시각 중심에 앉힌다
//  ② 제목은 stageTop 으로, 격자는 titleBottom 으로 자리를 잡고 있었다 —
//     서로 다른 식이라 둘이 따로 놀았다. 하나로 합친다
//  ③ 값이 32~56px 이었다. 항목이 하나뿐인 컷에서도 그 크기라 판이 비어
//     보였다 → 항목 수에 따라 키운다 (1개면 크게, 4개면 작게)
//  ④ 칸이 하나면 구분선이 없어 글자만 떠 있었다 → 위아래 가는 선을 둘러
//     '칸'이라는 걸 보이게 한다
//
// items: [{label, value, note}] 최대 4개
export const SpecGridCard = ({
  title = '', sub = '', items = [], bgImage = '',
  caption = '', source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);

  const list = items.slice(0, 4);
  const n = list.length || 1;
  // 셋일 때 2열로 두면 **네 번째 칸이 빈 채로 남아** 판이 깨져 보인다.
  // 셋까지는 한 줄, 넷일 때만 두 줄이다
  const COLS = n === 4 ? 2 : n;
  const ROWS = Math.ceil(n / COLS);

  // 항목이 적을수록 크게. 하나뿐인 컷은 그 하나가 주인공이다
  const vBase = n === 1 ? 92 : n === 2 ? 72 : n === 3 ? 62 : 58;
  const lSize = n === 1 ? FS.LABEL : FS.SMALL;
  const nSize = n === 1 ? FS.SMALL : FS.MICRO + 2;
  const cellH = n === 1 ? 300 : 250;

  const GRID_W = n === 1 ? 1180 : n === 3 ? 1560 : 1440;
  const GRID_H = cellH * ROWS;
  const left = (1920 - GRID_W) / 2;

  const titleBlock = title ? (sub ? 118 : 76) + SP.GAP : 0;
  const capBlock = caption ? 56 : 0;
  const TOP = stageTop(titleBlock + GRID_H + capBlock, {top: 170});
  const gridTop = TOP + titleBlock;
  const cellW = GRID_W / COLS;
  // 값 크기는 **칸마다 다르면 안 된다.** 글자수로 칸마다 재면 '대신 책임'과
  // '신병과 짐 인수' 가 다른 크기로 나와, 한 묶음이 아니라 따로 놓인 것으로
  // 읽힌다. 제일 긴 값에 맞춰 셋이 같은 크기를 쓴다
  const vLong = Math.max(1, ...list.map((it) => String(it.value ?? '').length));
  const vSize = Math.min(vBase, Math.max(34, Math.floor(cellW / Math.max(3, vLong) * 1.75)));

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} backdrop={bgImage} veil={0.94} {...bg} />

      {title ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: TOP,
                     textAlign: 'center', opacity: fadeIn(frame, 0)}}>
          <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: FS.LEAD,
                       letterSpacing: '-0.02em', color: T.ink, wordBreak: 'keep-all'}}>{title}</div>
          {sub ? (
            <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: FS.SMALL, color: T.soft, wordBreak: 'keep-all'}}>{sub}</div>
          ) : null}
        </div>
      ) : null}

      <div style={{position: 'absolute', top: gridTop, left, width: GRID_W, height: GRID_H}}>
        {/* 칸 위아래 선 — 한 칸일 때도 '칸'으로 읽히게 한다 */}
        <div style={{position: 'absolute', top: 0, left: 0, width: GRID_W, height: LW.HAIR,
                     background: T.ink, opacity: 0.26 * fadeIn(frame, 6)}} />
        <div style={{position: 'absolute', top: GRID_H, left: 0, width: GRID_W, height: LW.HAIR,
                     background: T.ink, opacity: 0.26 * fadeIn(frame, 6)}} />
        {Array.from({length: COLS - 1}, (_, i) => (
          <div key={`v${i}`} style={{position: 'absolute', top: 22, left: (i + 1) * cellW,
                                     width: 1, height: GRID_H - 44,
                                     background: T.ink, opacity: 0.2}} />
        ))}
        {Array.from({length: ROWS - 1}, (_, i) => (
          <div key={`h${i}`} style={{position: 'absolute', top: (i + 1) * cellH, left: 40,
                                     width: GRID_W - 80, height: 1,
                                     background: T.ink, opacity: 0.2}} />
        ))}

        {list.map((it, i) => {
          const col = i % COLS, row = Math.floor(i / COLS);
          const d = 14 + i * 9;
          const o = fadeIn(frame, d, 16);
          const dy = interpolate(frame, [d, d + 16], [14, 0],
                                 {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const v = String(it.value ?? '');
          return (
            <div key={i} style={{position: 'absolute', top: row * cellH, left: col * cellW,
                                 width: cellW, height: cellH, padding: '0 34px',
                                 display: 'flex', flexDirection: 'column',
                                 alignItems: 'center', justifyContent: 'center',
                                 opacity: o, transform: `translateY(${dy}px)`}}>
              <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: lSize, color: T.soft,
                           marginBottom: SP.NEAR, wordBreak: 'keep-all', textAlign: 'center',
                           letterSpacing: '0.01em'}}>
                {it.label}
              </div>
              {v ? (
                <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: vSize,
                             lineHeight: 1.12, letterSpacing: '-0.02em',
                             color: T.ink, textAlign: 'center', wordBreak: 'keep-all',
                             fontVariantNumeric: 'tabular-nums'}}>
                  {v}
                </div>
              ) : null}
              {it.note ? (
                <div style={{marginTop: SP.TIGHT + 2, fontFamily: 'A2Z Light, sans-serif',
                             fontSize: nSize, color: T.soft, textAlign: 'center',
                             lineHeight: 1.4, wordBreak: 'keep-all'}}>{it.note}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {caption ? <PaperCaption theme={theme}>{caption}</PaperCaption> : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
