import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, PaperKicker, PaperCaption,
        YELLOW, CONTENT_BOTTOM, fadeIn, SP, LW} from './paper';

// ── 추세 카드 ─────────────────────────────────────────────────────────────
// 두 증감률을 **기울기 차이 그 자체**로 보여준다. 막대 두 개면 "얼마"가 남고,
// 기울기면 "얼마나 빠르게"가 남는다. +98% 같은 문장에 쓴다.
//
// **종이 시스템으로 옮긴 카드다.** (원래 v2 — 먹 배경 + 옐로 발광)
//   발광 drop-shadow → 뺐다. 크림 종이 위에서는 노란 선 둘레가 지저분해질 뿐이다.
//                      대신 강조 선을 굵게 하고 끝점에 먹 테두리를 둘러 세운다.
//   자체 그리드      → PaperBg 격자. 카드마다 격자를 따로 그리면 간격이 안 맞는다
//   Footer(출처 하단) → PaperSource(우측 상단). v2 카드만 출처 자리가 달랐다
//
// series: [{label, pct, display, hot}] — pct 는 기울기 계산용 (%)
export const TrendCard = ({
  kicker = '', sub = '', series = [], caption = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const enter = fadeIn(frame, 0, 14);

  const list = series.slice(0, 4);
  const x0 = 300, y0 = 660, len = 1000;
  const maxPct = Math.max(...list.map((s) => Math.abs(Number(s.pct) || 0)), 1);
  const draw = interpolate(frame, [14, 58], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const riseOf = (s) => (Math.abs(Number(s.pct) || 0) / maxPct) * 360 * Math.sign(s.pct || 1);

  // 끝점 라벨이 겹치지 않게 아래로 밀어 둔다. 두 계열의 증감률이 비슷하면
  // 끝점 높이도 비슷해서 숫자 두 덩어리가 정확히 포개진다
  const ends = list
    .map((s, i) => ({i, s, y: y0 - riseOf(s)}))
    .sort((a, b) => a.y - b.y);
  let last = -1e9;
  for (const e of ends) {
    e.ly = Math.max(e.y, last + 118);
    last = e.ly;
  }

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperKicker title={kicker} sub={sub} theme={theme} opacity={enter} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 기준선 — 여기서 출발한다는 것만 보이면 된다 */}
        <line x1={x0} y1={y0} x2={x0 + len} y2={y0}
              stroke={T.ink} strokeWidth={LW.THIN} opacity={0.45 * enter} />
        {list.map((s, i) => {
          const rise = riseOf(s);
          const x1 = x0 + len * draw, y1 = y0 - rise * draw;
          const on = Boolean(s.hot);
          return (
            <g key={i}>
              <line x1={x0} y1={y0} x2={x1} y2={y1}
                    stroke={on ? T.ink : T.tones[0]} strokeWidth={on ? 7 : 4}
                    strokeLinecap="round" />
              <circle cx={x1} cy={y1} r={on ? 13 : 8}
                      fill={on ? YELLOW : T.tones[0]}
                      stroke={T.ink} strokeWidth={on ? 3 : 0} />
            </g>
          );
        })}
        {/* 라벨을 밀어 놓았으면 끝점과 라벨을 실선으로 잇는다 */}
        {ends.map((e) => (Math.abs(e.ly - e.y) < 6 ? null : (
          <line key={e.i} x1={x0 + len} y1={e.y} x2={x0 + len + 34} y2={e.ly}
                stroke={T.soft} strokeWidth={LW.HAIR} opacity={fadeIn(frame, 52)} />
        )))}
      </svg>

      {ends.map((e) => {
        const on = Boolean(e.s.hot);
        return (
          <div key={e.i} style={{position: 'absolute', left: x0 + len + 46, width: 460,
                                 top: e.ly - 54, opacity: fadeIn(frame, 52)}}>
            <div style={{fontFamily: 'A2Z Medium, sans-serif',
                         fontSize: on ? 84 : 58, color: T.ink,
                         fontVariantNumeric: 'tabular-nums'}}>
              {e.s.display}
            </div>
            <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: 28, color: T.soft, wordBreak: 'keep-all'}}>
              {e.s.label}
            </div>
          </div>
        );
      })}

      <PaperCaption theme={theme} opacity={fadeIn(frame, 64)}>{caption}</PaperCaption>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
