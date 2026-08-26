import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, GRAY, LINE, glow, fadeIn, Kicker, Footer} from './v2shared';
import {LW} from './paper';   // 선 굵기 네 단계 — paper.jsx 가 기준이다

// v2 유닛 블록 카드 — 금액/개수를 "실제 블록 개수"로 보여준다 (■ = unitLabel).
// groups: [{label, units, note, hot}] — 블록이 아래에서부터 차오른다.
// progress 모드: {total, filled} 를 주면 total 그리드에 filled 만 켜진다(공정률 등).
export const UnitBlocksCard = ({
  kicker = '',
  sub = '',
  unitLabel = '',
  groups = [],
  cols = 5, // 그룹당 블록 열 수 (블록이 많으면 넓힌다)
  progress = null,
  caption = '',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const enter = fadeIn(frame, 0, 14);

  const B = 44; // 블록 한 변
  const G = 7; // 블록 간격

  if (progress) {
    // 10x10 progress 그리드
    const cols = 10;
    const rows = Math.ceil(progress.total / cols);
    const gridW = cols * (B + G);
    const left = (1920 - gridW) / 2;
    const top = 250;
    const lit = Math.floor(
      interpolate(frame, [14, 70], [0, progress.filled], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    );
    return (
      <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
        <Kicker title={kicker} sub={sub} opacity={enter} />
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          {Array.from({length: progress.total}, (_, i) => {
            // 아래 행부터 채운다
            const r = rows - 1 - Math.floor(i / cols);
            const c = i % cols;
            const on = i < lit;
            return (
              <rect
                key={i}
                x={left + c * (B + G)} y={top + r * (B + G)}
                width={B} height={B} rx={4}
                fill={on ? YELLOW : '#1E1E1E'}
                stroke={on ? 'none' : '#2E2E2E'}
                style={on ? {filter: 'drop-shadow(0 0 6px rgba(250,255,46,0.5))'} : undefined}
              />
            );
          })}
        </svg>
        <div style={{position: 'absolute', left: 0, width: 1920, top: 250 + rows * (B + G) + 36, textAlign: 'center', opacity: fadeIn(frame, 50)}}>
          <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 76, color: WHITE, fontVariantNumeric: 'tabular-nums'}}>
            {progress.filled}
          </span>
          <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 44, color: WHITE, marginLeft: 8}}>
            / {progress.total} {unitLabel}
          </span>
        </div>
        <Footer caption={caption} source={source} opacity={fadeIn(frame, 64)} />
      </AbsoluteFill>
    );
  }

  const groupW = cols * (B + G) + 130; // 블록 그리드 + 여백
  const totalW = groups.length * groupW;
  const startX = (1920 - totalW) / 2 + 65;
  // 그룹 라벨(baseY+28~+106)이 Footer(y≈744~)와 겹치지 않게 블록을 위로
  const baseY = 610;

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      <Kicker title={kicker} sub={sub} opacity={enter} />

      {unitLabel ? (
        <div style={{position: 'absolute', right: 120, top: 100, display: 'flex', alignItems: 'center', gap: 14, opacity: fadeIn(frame, 24)}}>
          <div style={{width: 16, height: 16, borderRadius: 3, background: YELLOW, boxShadow: glow(0.4)}} />
          <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 27, letterSpacing: '0.06em', color: MUTE}}>
            = {unitLabel}
          </span>
        </div>
      ) : null}

      {groups.map((g, gi) => {
        const x0 = startX + gi * groupW;
        const lit = Math.floor(
          interpolate(frame, [12 + gi * 8, 66 + gi * 8], [0, g.units], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
        );
        const hot = Boolean(g.hot);
        const rows = Math.ceil(g.units / cols);
        return (
          <React.Fragment key={gi}>
            <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
              {Array.from({length: g.units}, (_, i) => {
                const r = Math.floor(i / cols); // 0 = 바닥 행
                const c = i % cols;
                const on = i < lit;
                const col = hot ? YELLOW : '#4A4A4A';
                return (
                  <rect
                    key={i}
                    x={x0 + c * (B + G)}
                    y={baseY - (r + 1) * (B + G)}
                    width={B} height={B} rx={4}
                    fill={on ? col : '#1A1A1A'}
                    stroke={on ? 'none' : '#2A2A2A'}
                    style={on && hot ? {filter: 'drop-shadow(0 0 6px rgba(250,255,46,0.45))'} : undefined}
                  />
                );
              })}
              {/* 바닥선 */}
              <line x1={x0 - 20} y1={baseY + 6} x2={x0 + cols * (B + G) + 12} y2={baseY + 6} stroke={LINE} strokeWidth={LW.HAIR} />
            </svg>
            <div style={{position: 'absolute', left: x0 - 65, top: baseY + 28, width: groupW, textAlign: 'center', opacity: fadeIn(frame, 34 + gi * 8)}}>
              <div style={{fontFamily: hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif', fontSize: 40, letterSpacing: '0.02em', color: WHITE, fontVariantNumeric: 'tabular-nums'}}>
                {g.note}
              </div>
              <div style={{marginTop: 8, fontFamily: 'A2Z Light, sans-serif', fontSize: 30, letterSpacing: '0.05em', color: hot ? WHITE : MUTE}}>
                {g.label}
              </div>
            </div>
          </React.Fragment>
        );
      })}

      <Footer caption={caption} source={source} opacity={fadeIn(frame, 58)} />
    </AbsoluteFill>
  );
};
