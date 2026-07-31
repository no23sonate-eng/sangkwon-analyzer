import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, GRAY, GRID, glow, fadeIn, Kicker, Footer} from './v2shared';

// v2 가로 랭킹 바 — 항목명이 긴 한국어 비교에 유리한 수평 막대.
// 1위(hot)만 옐로 발광, 나머지 뮤트그레이. 순위 번호·증감 주석 포함.
// rows: [{name, value, display, hot, delta}] — delta 예: '↗ 증가세'
export const YRankBarsCard = ({
  kicker = '',
  sub = '',
  rows = [],
  caption = '',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = fadeIn(frame, 0, 14);
  const maxVal = Math.max(...rows.map((r) => r.value), 1);

  // 킥커(~220px)와 하단 Footer(~660px부터) 사이에 행이 다 들어가게 계산
  const top = 250;
  const rowH = rows.length > 4 ? 82 : 108;
  const nameX = 120;
  const barX = 520;
  const barMaxW = 950;

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      <Kicker title={kicker} sub={sub} opacity={enter} />

      {/* 세로 기준선(시작선) 하나만 — 데이터잉크 최소 */}
      <div
        style={{
          position: 'absolute', top: top - 26, left: barX - 1,
          width: 1, height: rows.length * rowH + 30, background: GRID, opacity: enter,
        }}
      />

      {rows.map((r, i) => {
        const grow = spring({frame: frame - 12 - i * 7, fps, config: {damping: 200}, durationInFrames: 30});
        const w = Math.max(6, (r.value / maxVal) * barMaxW * grow);
        const y = top + i * rowH;
        return (
          <React.Fragment key={r.name}>
            {/* 순위 + 항목명 */}
            <div style={{position: 'absolute', top: y + 4, left: nameX, width: barX - nameX - 30, whiteSpace: 'nowrap', opacity: grow}}>
              <span
                style={{
                  fontFamily: 'A2Z Medium, sans-serif', fontSize: 27,
                  letterSpacing: '0.14em', color: r.hot ? YELLOW : '#4A4A4A',
                  marginRight: 22, fontVariantNumeric: 'tabular-nums',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontFamily: r.hot ? 'A2Z Regular, sans-serif' : 'A2Z Light, sans-serif',
                  fontSize: 36, letterSpacing: '0.04em', color: r.hot ? WHITE : GRAY,
                }}
              >
                {r.name}
              </span>
            </div>
            {/* 막대 */}
            <div
              style={{
                position: 'absolute', top: y, left: barX, width: w, height: 44,
                borderRadius: 4,
                background: r.hot ? YELLOW : '#3E3E3E',
                boxShadow: r.hot ? '0 0 18px rgba(250,255,46,0.55)' : 'none',
              }}
            />
            {/* 값 + 증감 주석 */}
            <div
              style={{
                position: 'absolute', top: y + 2, left: barX + w + 28,
                display: 'flex', alignItems: 'baseline', gap: 20, opacity: grow,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  fontFamily: 'A2Z Medium, sans-serif',
                  fontSize: r.hot ? 44 : 36,
                  letterSpacing: '0.02em',
                  color: r.hot ? YELLOW : GRAY,
                  textShadow: r.hot ? glow(0.5) : 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {r.display}
              </span>
              {r.delta ? (
                <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 26, letterSpacing: '0.05em', color: r.hot ? WHITE : MUTE}}>
                  {r.delta}
                </span>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}

      <Footer caption={caption} source={source} opacity={fadeIn(frame, 12 + rows.length * 7 + 14)} />
    </AbsoluteFill>
  );
};
