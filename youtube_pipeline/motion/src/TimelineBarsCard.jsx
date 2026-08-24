import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, PaperKicker, PaperCaption,
        YELLOW, CONTENT_BOTTOM, fadeIn, SP} from './paper';

// ── 기간을 칸으로 센다 ────────────────────────────────────────────────────
// "15개월", "3년간 문을 닫는다" 처럼 **길이가 결론인** 문장에 쓴다.
// 한 칸 = 1개월. 막대 하나로 뭉뚱그리면 15와 36의 차이가 그냥 길이 차이지만,
// 칸으로 세면 세는 동안 그 길이가 몸에 남는다.
//
// **종이 시스템으로 옮긴 카드다.** (원래 v2 — 먹 배경 + 옐로 발광)
//   발광 drop-shadow → 뺐다. 종이 위에서는 노란 칸에 먹 테두리를 두르는
//                      쪽이 훨씬 또렷하다
//   빈 칸 #1A1A1A    → T.tones. 먹 배경에서만 "안 채워진 칸"으로 읽히던 색이다
//   Footer(출처 하단) → PaperSource(우측 상단)
//
// bars: [{label, months, hot}]
export const TimelineBarsCard = ({
  kicker = '', sub = '', bars = [], caption = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const enter = fadeIn(frame, 0, 14);

  const list = bars.slice(0, 4);
  const maxM = Math.max(...list.map((b) => Number(b.months) || 0), 1);
  const gap = 5;
  // 우측 'NN개월' 라벨 자리를 빼고 남는 폭에 칸을 채운다
  const AVAIL = 1020;
  const cellW = Math.max(6, Math.min(34, Math.floor((AVAIL + gap) / maxM) - gap));
  const cellH = Math.min(64, Math.max(30, cellW * 1.9));
  const left = 420;

  // 줄 간격을 컷 수에 맞춘다. 190 고정이라 4줄이면 자막 안전선을 넘었다
  const bandTop = kicker ? 320 : 240;
  const rowH = Math.min(190, Math.max(cellH + 46,
                                      (CONTENT_BOTTOM - 40 - bandTop) / Math.max(1, list.length)));

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperKicker title={kicker} sub={sub} theme={theme} opacity={enter} />

      {/* 범례 — 칸 하나가 뭔지 안 적으면 그냥 무늬가 된다 */}
      <div style={{position: 'absolute', right: 120, top: bandTop - 62, display: 'flex',
                   alignItems: 'center', gap: 14, opacity: fadeIn(frame, 24)}}>
        <div style={{width: 16, height: 22, border: `2px solid ${T.ink}`, opacity: 0.6}} />
        <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 27,
                      letterSpacing: '0.04em', color: T.soft}}>= 1개월</span>
      </div>

      {list.map((b, bi) => {
        const months = Math.max(0, Math.round(Number(b.months) || 0));
        const lit = Math.floor(interpolate(frame, [14 + bi * 10, 60 + bi * 10], [0, months],
                                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
        const hot = Boolean(b.hot);
        const y = bandTop + bi * rowH;
        return (
          <React.Fragment key={bi}>
            <div style={{position: 'absolute', left: 120, width: 280, top: y + cellH / 2 - 22,
                         opacity: fadeIn(frame, 12 + bi * 10)}}>
              <span style={{fontFamily: hot ? 'Pretendard Bold, A2Z Medium, sans-serif'
                                            : 'A2Z Light, sans-serif',
                            fontSize: 33, color: hot ? T.ink : T.soft,
                            wordBreak: 'keep-all'}}>{b.label}</span>
            </div>
            <svg width={1920} height={cellH + 10} style={{position: 'absolute', top: y, left: 0}}>
              {Array.from({length: months}, (_, i) => (
                <rect key={i} x={left + i * (cellW + gap)} y={0}
                      width={cellW} height={cellH}
                      fill={i < lit ? (hot ? YELLOW : T.tones[0]) : 'none'}
                      stroke={T.ink} strokeWidth={i < lit && hot ? 2 : 1.2}
                      opacity={i < lit ? 1 : 0.28} />
              ))}
            </svg>
            <div style={{position: 'absolute',
                         left: left + months * (cellW + gap) + 26,
                         top: y + cellH / 2 - 30, whiteSpace: 'nowrap',
                         opacity: fadeIn(frame, 46 + bi * 10)}}>
              <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                            fontSize: 52, color: hot ? T.ink : T.soft,
                            fontVariantNumeric: 'tabular-nums'}}>
                {months}개월
              </span>
            </div>
          </React.Fragment>
        );
      })}

      <PaperCaption theme={theme} opacity={fadeIn(frame, 60)}>{caption}</PaperCaption>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
