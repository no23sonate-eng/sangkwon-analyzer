import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_MUTE, INK_SOFT, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';

// 빌딩형 퍼센트 게이지 (레퍼런스 "% Owner occupied" 문법).
// items: [{label, pct(0~100), sub, hot}] — 빌딩 윤곽 안이 pct 만큼 차오르고
// 큰 숫자가 카운트업. 공정률·점유율·달성률 설명용.
export const TowerGaugeCard = ({title = '', sub = '', items = [], source = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = items.length;
  const W = 210;
  const H = 380;
  const gap = Math.min(260, (1500 - n * W) / Math.max(1, n - 1) || 0);
  const totalW = n * W + (n - 1) * gap;
  const startX = (1920 - totalW) / 2;
  const baseY = CONTENT_BOTTOM - 150;
  const ROWS = 9, COLS = 4; // 창문 그리드

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {items.map((it, i) => {
          const x = startX + i * (W + gap);
          const top = baseY - H;
          const pct = interpolate(frame, [14 + i * 8, 64 + i * 8], [0, it.pct ?? 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const fillH = (H - 16) * (pct / 100);
          const hot = Boolean(it.hot);
          return (
            <g key={i}>
              {/* 채움 (아래에서부터) */}
              <rect x={x + 8} y={baseY - 8 - fillH} width={W - 16} height={fillH} fill={hot ? YELLOW : INK_MUTE} opacity={hot ? 1 : 0.55} />
              {/* 빌딩 윤곽 + 옥탑 */}
              <rect x={x} y={top} width={W} height={H} fill="none" stroke={INK} strokeWidth={3} />
              <rect x={x + W * 0.3} y={top - 26} width={W * 0.4} height={26} fill="none" stroke={INK} strokeWidth={3} />
              {/* 창문 그리드 */}
              {Array.from({length: ROWS * COLS}, (_, k) => {
                const r = Math.floor(k / COLS), c = k % COLS;
                return (
                  <rect key={k} x={x + 18 + c * ((W - 36) / COLS) + 5} y={top + 18 + r * ((H - 36) / ROWS) + 5}
                        width={(W - 36) / COLS - 10} height={(H - 36) / ROWS - 10}
                        fill="none" stroke={INK} strokeWidth={1.2} opacity={0.35} />
                );
              })}
              <line x1={x - 34} y1={baseY} x2={x + W + 34} y2={baseY} stroke={INK} strokeWidth={2.5} />
            </g>
          );
        })}
      </svg>
      {items.map((it, i) => {
        const x = startX + i * (W + gap);
        const pct = Math.round(interpolate(frame, [14 + i * 8, 64 + i * 8], [0, it.pct ?? 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
        const hot = Boolean(it.hot);
        return (
          <div key={i} style={{position: 'absolute', left: x + W / 2 - 200, width: 400, top: baseY + 22, textAlign: 'center', opacity: fadeIn(frame, 20 + i * 8)}}>
            <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 64, color: INK, fontVariantNumeric: 'tabular-nums'}}>
              {pct}
              <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 40}}>%</span>
              <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 30, marginLeft: 10, color: hot ? INK : INK_SOFT}}>{it.sub || ''}</span>
            </div>
            <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: 26, color: INK_SOFT}}>
              {it.label}
            </div>
          </div>
        );
      })}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
