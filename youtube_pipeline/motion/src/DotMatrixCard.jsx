import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_SOFT, YELLOW, TONES, fadeIn} from './paper';

// 점 격자 카드 — 숫자를 막대 길이가 아니라 **개수 그 자체**로 보여준다.
// 청약 경쟁률(모집 대 접수)처럼 "몇 대 몇"이 셀 수 있는 양일 때, 점이 하나씩
// 찍히는 것만으로 초과 물량이 눈에 들어온다.
// groups: [{label, value, sub, hot}] / perDot: 점 하나가 몇을 뜻하는지
export const DotMatrixCard = ({
  title = '', sub = '', groups = [], perDot = 10, cols = 13,
  unit = '', source = '', caption = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = groups.length;
  if (!n) return <AbsoluteFill><PaperBg /></AbsoluteFill>;

  const R = 10, PITCH = 30;
  const blockW = cols * PITCH;
  const slot = Math.min(760, 1560 / n);
  const startX = (1920 - slot * n) / 2 + slot / 2;
  const TOP = 330;
  // 그룹마다 행 수가 달라도 수치·라벨은 **가장 큰 격자 아래 한 줄**에 맞춘다.
  // 제각각 높이에 두면 격자 크기 차이가 아니라 배치 실수처럼 보인다.
  const maxRows = Math.max(...groups.map((g) => Math.ceil(Math.max(1, Math.round(g.value / perDot)) / cols)));
  const LABEL_Y = TOP + (maxRows - 1) * PITCH + R + 38;
  // 점이 순서대로 찍히는 속도 (그룹마다 살짝 시차)
  const dotsOf = (v) => Math.max(1, Math.round(v / perDot));

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {groups.map((g, gi) => {
          const total = dotsOf(g.value);
          const cx0 = startX + gi * slot - blockW / 2 + PITCH / 2;
          const t0 = 16 + gi * 14;
          const per = 46 / total;              // 전체 46프레임 안에 다 찍힌다
          return (
            <g key={gi}>
              {Array.from({length: total}, (_, k) => {
                const o = fadeIn(frame, t0 + k * per, 6);
                if (o <= 0) return null;
                const r = Math.floor(k / cols), c = k % cols;
                return (
                  <circle key={k} cx={cx0 + c * PITCH} cy={TOP + r * PITCH} r={R}
                          fill={g.hot ? YELLOW : TONES[3]} stroke={INK} strokeWidth={1.6}
                          opacity={o} />
                );
              })}
            </g>
          );
        })}
      </svg>

      {groups.map((g, gi) => {
        return (
          <div key={gi} style={{position: 'absolute', left: startX + gi * slot - slot / 2, width: slot,
                                top: LABEL_Y, textAlign: 'center',
                                opacity: fadeIn(frame, 26 + gi * 14)}}>
            <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 68, color: INK,
                         lineHeight: 1.05, fontVariantNumeric: 'tabular-nums'}}>
              {(g.display ?? g.value).toLocaleString?.() ?? g.display ?? g.value}
              <span style={{fontSize: 42, marginLeft: 4}}>{unit}</span>
            </div>
            <div style={{marginTop: 6, fontFamily: g.hot ? 'Pretendard Bold, A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                         fontSize: 42, color: INK, wordBreak: 'keep-all'}}>
              {g.label}
            </div>
            {g.sub ? (
              <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: INK_SOFT, wordBreak: 'keep-all'}}>
                {g.sub}
              </div>
            ) : null}
          </div>
        );
      })}

      {caption ? (
        <div style={{position: 'absolute', left: 0, width: 1920, top: TOP - 62, textAlign: 'center',
                     opacity: fadeIn(frame, 10), fontFamily: 'A2Z Light, sans-serif',
                     fontSize: 32, color: INK_SOFT, letterSpacing: '0.04em'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
