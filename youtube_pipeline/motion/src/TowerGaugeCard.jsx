import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, Bracket, INK, INK_SOFT, YELLOW, TONES, CONTENT_BOTTOM, fadeIn} from './paper';

// 빌딩형 퍼센트 게이지 v2 — B1M "NYC 5 Boroughs / % Owner occupied" 정밀 재현.
// 창문 그리드 타워(코니스 캡) + 채움을 "창문 단위"로 아래에서부터 옐로로.
// items: [{label, pct(0~100), sub, chip(위 브래킷 라벨), wide(넓은 타워)}]
export const TowerGaugeCard = ({title = '', sub = '', items = [], source = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = items.length;
  const baseY = CONTENT_BOTTOM - 168;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      {items.map((it, i) => {
        const wide = Boolean(it.wide);
        const W = wide ? 250 : 130;
        const H = 400;
        const COLS = wide ? 7 : 4;
        const ROWS = wide ? 12 : 13;
        const slot = Math.min(560, 1560 / n);
        const cx = (1920 - slot * n) / 2 + slot / 2 + i * slot;
        const x = cx - W / 2;
        const top = baseY - H;
        const bodyFill = TONES[3]; // 딥 잉크 톤 바디
        const pct = interpolate(frame, [14 + i * 8, 68 + i * 8], [0, it.pct ?? 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const pctShown = Math.round(pct);
        const litRows = Math.round(ROWS * (pct / 100));
        const cellW = (W - 20) / COLS;
        const cellH = (H - 20) / ROWS;
        const o = fadeIn(frame, 8 + i * 8);
        return (
          <React.Fragment key={i}>
            <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, opacity: o}}>
              {/* 위 브래킷 + 칩 라벨 */}
              {it.chip ? <Bracket x={cx - W / 2 - 46} y={top - 44} w={W + 92} /> : null}
              {/* 코니스 캡(위) + 기단(아래) */}
              <rect x={x - 10} y={top - 14} width={W + 20} height={14} fill={bodyFill} />
              <rect x={x} y={top} width={W} height={H} fill={bodyFill} />
              <rect x={x - 10} y={baseY} width={W + 20} height={10} fill={bodyFill} />
              {/* 창문 그리드 — 아래 litRows 만큼 옐로 */}
              {Array.from({length: ROWS * COLS}, (_, k) => {
                const r = Math.floor(k / COLS); // 0 = 최상단 행
                const c = k % COLS;
                const lit = ROWS - 1 - r < litRows;
                return (
                  <rect key={k}
                        x={x + 10 + c * cellW + cellW * 0.14} y={top + 10 + r * cellH + cellH * 0.16}
                        width={cellW * 0.72} height={cellH * 0.62} rx={1.5}
                        fill={lit ? YELLOW : '#FFFFFF'} opacity={lit ? 0.95 : 0.28} />
                );
              })}
              <line x1={cx - slot / 2 + 30} y1={baseY + 10} x2={cx + slot / 2 - 30} y2={baseY + 10} stroke={INK} strokeWidth={2} opacity={0.5} />
            </svg>
            {it.chip ? (
              <div style={{position: 'absolute', left: cx - W / 2 - 46, top: top - 82, fontFamily: 'A2Z Medium, sans-serif', fontSize: 26, letterSpacing: '0.08em', color: INK, opacity: o}}>
                {it.chip}
              </div>
            ) : null}
            {/* 빅 스탯: 큰 볼드 % + 오른쪽 2줄 얇은 라벨 */}
            <div style={{position: 'absolute', left: cx - slot / 2, width: slot, top: baseY + 34, textAlign: 'center', opacity: fadeIn(frame, 22 + i * 8)}}>
              <div style={{display: 'inline-flex', alignItems: 'baseline', gap: 14}}>
                <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 88, color: INK, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em'}}>
                  {pctShown}
                  <span style={{fontFamily: 'A2Z Regular, sans-serif', fontSize: 54}}>%</span>
                </span>
                {it.sub ? (
                  <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 28, lineHeight: 1.25, color: INK_SOFT, whiteSpace: 'pre-line', letterSpacing: '0.05em', textAlign: 'left'}}>
                    {it.sub}
                  </span>
                ) : null}
              </div>
              <div style={{marginTop: 2, fontFamily: 'A2Z Light, sans-serif', fontSize: 25, color: INK_SOFT, letterSpacing: '0.03em'}}>
                {it.label}
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
