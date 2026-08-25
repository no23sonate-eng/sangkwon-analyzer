import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';

// 점 격자 카드 — 숫자를 막대 길이가 아니라 **개수 그 자체**로 보여준다.
// 청약 경쟁률(모집 대 접수)처럼 "몇 대 몇"이 셀 수 있는 양일 때, 점이 하나씩
// 찍히는 것만으로 초과 물량이 눈에 들어온다.
// groups: [{label, value, sub, hot}] / perDot: 점 하나가 몇을 뜻하는지
export const DotMatrixCard = ({
  title = '', sub = '', groups = [], perDot = 10, cols = 13,
  // merge=true 면 **한 덩어리**로 그린다.
  // 두 블록을 나란히 놓으면 '590 과 147' 이라는 두 수의 비교가 되는데,
  // 원래 하려던 말은 '737 중에 147 이 꺼졌다' 다. 전체를 먼저 깔고
  // 그중 일부를 흐리게 해야 **사라졌다는 게** 보인다
  merge = false,
  unit = '', source = '', caption = '',
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const n = groups.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  // 열 수와 점 크기를 그대로 믿지 않는다. 737개를 1:1 로 그리라고 하면
  // 격자가 화면 밖으로 나가는데 **렌더는 성공한다** — 시트에서야 안다.
  // 폭과 높이 양쪽에 맞을 때까지 점 간격을 줄인다. 점 개수는 안 건드린다:
  // 개수가 곧 뜻이라 임의로 줄이면 그림이 거짓말이 된다
  const TOP = 330;
  const slot = Math.min(760, 1560 / n);
  const AVAIL_H = CONTENT_BOTTOM - TOP - 96;          // 아래 수치·라벨 자리
  const maxDots = Math.max(...groups.map((g) => Math.max(1, Math.round(g.value / perDot))));
  let PITCH = 30, nCol = 4;
  for (let pitch = 30; pitch >= 7; pitch -= 1) {
    const c = Math.max(4, Math.min(cols, Math.floor((slot - 24) / pitch)));
    if (Math.ceil(maxDots / c) * pitch <= AVAIL_H) { PITCH = pitch; nCol = c; break; }
    PITCH = pitch; nCol = c;                          // 끝까지 못 맞으면 최소 간격
  }
  const R = Math.max(2.5, PITCH / 3);
  const blockW = nCol * PITCH;
  const startX = (1920 - slot * n) / 2 + slot / 2;
  // 그룹마다 행 수가 달라도 수치·라벨은 **가장 큰 격자 아래 한 줄**에 맞춘다.
  // 제각각 높이에 두면 격자 크기 차이가 아니라 배치 실수처럼 보인다.
  const dotsAll = groups.reduce((s, g) => s + Math.max(1, Math.round(g.value / perDot)), 0);
  const maxRows = merge
    ? Math.ceil(dotsAll / nCol)
    : Math.max(...groups.map((g) => Math.ceil(Math.max(1, Math.round(g.value / perDot)) / nCol)));
  const LABEL_Y = TOP + (maxRows - 1) * PITCH + R + 38;
  // 점이 순서대로 찍히는 속도 (그룹마다 살짝 시차)
  const dotsOf = (v) => Math.max(1, Math.round(v / perDot));

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {merge ? (() => {
          // 한 격자에 이어 붙인다. 앞 그룹부터 채우고, 각 점의 색은
          // 그 점이 어느 그룹 몫인지로 정한다
          const cx0 = (1920 - nCol * PITCH) / 2 + PITCH / 2;
          const per = 52 / Math.max(1, dotsAll);
          let acc = 0;
          const bands = groups.map((g) => {
            const nd = Math.max(1, Math.round(g.value / perDot));
            const from = acc; acc += nd;
            return {g, from, to: acc};
          });
          return Array.from({length: dotsAll}, (_, k) => {
            const o = fadeIn(frame, 16 + k * per, 6);
            if (o <= 0) return null;
            const b = bands.find((x) => k >= x.from && k < x.to) || bands[0];
            const r = Math.floor(k / nCol), c = k % nCol;
            const gone = b.g.gone;                 // 사라진 몫 — 흐린 회색
            return (
              <circle key={k} cx={cx0 + c * PITCH} cy={TOP + r * PITCH} r={R}
                      fill={gone ? T.tones[0] : (b.g.hot ? YELLOW : T.tones[3])}
                      stroke={gone ? 'none' : T.ink} strokeWidth={1.6}
                      opacity={o * (gone ? 0.34 : 1)} />
            );
          });
        })() : groups.map((g, gi) => {
          const total = dotsOf(g.value);
          const cx0 = startX + gi * slot - blockW / 2 + PITCH / 2;
          const t0 = 16 + gi * 14;
          const per = 46 / total;              // 전체 46프레임 안에 다 찍힌다
          return (
            <g key={gi}>
              {Array.from({length: total}, (_, k) => {
                const o = fadeIn(frame, t0 + k * per, 6);
                if (o <= 0) return null;
                const r = Math.floor(k / nCol), c = k % nCol;
                return (
                  <circle key={k} cx={cx0 + c * PITCH} cy={TOP + r * PITCH} r={R}
                          fill={g.hot ? YELLOW : T.tones[3]} stroke={T.ink} strokeWidth={1.6}
                          opacity={o} />
                );
              })}
            </g>
          );
        })}
      </svg>

      {groups.map((g, gi) => {
        const L = merge ? (1920 - nCol * PITCH) / 2 + gi * (nCol * PITCH / groups.length)
                        : startX + gi * slot - slot / 2;
        const Wd = merge ? nCol * PITCH / groups.length : slot;
        return (
          <div key={gi} style={{position: 'absolute', left: L, width: Wd,
                                top: LABEL_Y, textAlign: 'center',
                                opacity: fadeIn(frame, 26 + gi * 14)}}>
            <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 68, color: T.ink,
                         lineHeight: 1.05, fontVariantNumeric: 'tabular-nums'}}>
              {(g.display ?? g.value).toLocaleString?.() ?? g.display ?? g.value}
              <span style={{fontSize: 42, marginLeft: 4}}>{unit}</span>
            </div>
            <div style={{marginTop: 6, fontFamily: g.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                         fontSize: 42, color: T.ink, wordBreak: 'keep-all'}}>
              {g.label}
            </div>
            {g.sub ? (
              <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft, wordBreak: 'keep-all'}}>
                {g.sub}
              </div>
            ) : null}
          </div>
        );
      })}

      {caption ? (
        <div style={{position: 'absolute', left: 0, width: 1920, top: TOP - 62, textAlign: 'center',
                     opacity: fadeIn(frame, 10), fontFamily: 'A2Z Light, sans-serif',
                     fontSize: 32, color: T.soft, letterSpacing: '0.04em'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
