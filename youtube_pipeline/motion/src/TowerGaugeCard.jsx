import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_SOFT, YELLOW, TONES, CONTENT_BOTTOM, fadeIn} from './paper';

// 공연장 게이지 — 돔 아레나 "단면"이 %만큼 아래에서부터 점등된다.
// 공연장 프로젝트의 공정률·진행 상태 전용 (빌딩 아님!).
// items: [{label(가운데 정렬 이름), pct(0~100), sub, note}]
export const TowerGaugeCard = ({title = '', sub = '', items = [], source = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = items.length;
  const baseY = CONTENT_BOTTOM - 170;
  const DOME_W = 460;
  const DOME_H = 260;
  const ROWS = 8; // 점등 밴드(객석 열 느낌)

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      {items.map((it, i) => {
        const slot = Math.min(760, 1720 / n);
        const cx = (1920 - slot * n) / 2 + slot / 2 + i * slot;
        const pct = interpolate(frame, [14 + i * 8, 68 + i * 8], [0, it.pct ?? 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const pctShown = Math.round(pct);
        const litRows = ROWS * (pct / 100);
        const o = fadeIn(frame, 8 + i * 8);
        const body = TONES[3];
        const clipId = `dome${i}`;
        return (
          <React.Fragment key={i}>
            {/* 공연장 이름 — 돔 위 가운데 정렬 */}
            <div style={{position: 'absolute', left: cx - slot / 2, width: slot, top: baseY - DOME_H - 96, textAlign: 'center',
                         fontFamily: 'A2Z Medium, sans-serif', fontSize: 30, letterSpacing: '0.05em', color: INK, opacity: o}}>
              {it.label}
            </div>
            <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, opacity: o}}>
              <defs>
                <clipPath id={clipId}>
                  <path d={`M ${cx - DOME_W / 2} ${baseY} A ${DOME_W / 2} ${DOME_H} 0 0 1 ${cx + DOME_W / 2} ${baseY} Z`} />
                </clipPath>
              </defs>
              {/* 접지 그림자 */}
              <ellipse cx={cx} cy={baseY + 4} rx={DOME_W * 0.54} ry={8} fill={INK} opacity={0.13} />
              {/* 돔 단면 바탕 */}
              <path d={`M ${cx - DOME_W / 2} ${baseY} A ${DOME_W / 2} ${DOME_H} 0 0 1 ${cx + DOME_W / 2} ${baseY} Z`}
                    fill={body} opacity={0.16} />
              {/* 객석 밴드 — 아래에서부터 %만큼 옐로 점등 */}
              {Array.from({length: ROWS}, (_, r) => {
                const y1 = baseY - (r + 1) * (DOME_H / ROWS) + 3;
                const lit = r < Math.floor(litRows);
                const partial = r === Math.floor(litRows) ? litRows - Math.floor(litRows) : 0;
                return (
                  <g key={r} clipPath={`url(#${clipId})`}>
                    <rect x={cx - DOME_W / 2} y={y1} width={DOME_W} height={DOME_H / ROWS - 6}
                          fill={lit ? YELLOW : body} opacity={lit ? 0.92 : partial > 0.5 ? 0.5 : 0.10} />
                  </g>
                );
              })}
              {/* 돔 윤곽 */}
              <path d={`M ${cx - DOME_W / 2} ${baseY} A ${DOME_W / 2} ${DOME_H} 0 0 1 ${cx + DOME_W / 2} ${baseY}`}
                    fill="none" stroke={INK} strokeWidth={3.5} />
              <line x1={cx - DOME_W / 2} y1={baseY} x2={cx + DOME_W / 2} y2={baseY} stroke={INK} strokeWidth={3.5} />
              {/* 무대 슬릿 */}
              <rect x={cx - 44} y={baseY - 14} width={88} height={14} fill={INK} opacity={0.75} />
            </svg>
            {/* 빅 스탯 — 가운데 정렬 */}
            <div style={{position: 'absolute', left: cx - slot / 2, width: slot, top: baseY + 30, textAlign: 'center', opacity: fadeIn(frame, 22 + i * 8)}}>
              <div style={{display: 'inline-flex', alignItems: 'baseline', gap: 14}}>
                <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 86, color: INK, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em'}}>
                  {pctShown}
                  <span style={{fontFamily: 'A2Z Regular, sans-serif', fontSize: 52}}>%</span>
                </span>
                {it.sub ? (
                  <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: INK_SOFT, letterSpacing: '0.05em'}}>
                    {it.sub}
                  </span>
                ) : null}
              </div>
              {it.note ? (
                <div style={{marginTop: 2, fontFamily: 'A2Z Light, sans-serif', fontSize: 25, color: INK_SOFT, letterSpacing: '0.03em'}}>
                  {it.note}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
