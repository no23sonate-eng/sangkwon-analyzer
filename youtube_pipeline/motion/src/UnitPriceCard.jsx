import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, ValueChip, YELLOW, CONTENT_BOTTOM, fadeIn, SP, LW} from './paper';
import {fit} from './layout';

// ── 총액 ÷ 개수 = 단가 ────────────────────────────────────────────────────
// "3,686억에 팔렸는데 576실이니까 객실 하나당 6억 4,000만원" —
// 호텔이 **거래되는 방식 자체**를 말하는 문장이다. 그런데 숫자 셋을 나란히
// 띄우면 그냥 숫자 셋이고, 나눗셈이라는 동작이 안 보인다.
//
// 나눗셈을 그림으로 만드는 법: **덩어리를 칸으로 쪼갠다.**
// 총액 사각형이 576칸으로 갈라지고, 그중 한 칸만 남아 단가가 된다.
// 쪼개지는 걸 봐야 "객실 하나당" 이라는 말이 몸에 붙는다.
//
// 칸 수는 진짜로 그린다. 576 이면 576개를 그린다 — 대충 그리면 "많다" 는
// 인상만 남고, 정확히 그리면 **576이라는 수 자체가 크기로 읽힌다.**
// (24×24 처럼 제곱수에 가까우면 격자가 반듯해져서 더 잘 읽힌다)
//
// total/totalLabel  총액. count/countLabel  나눌 개수
// unit/unitLabel    한 칸의 값 — 계산해서 넣지 않고 **받는다**.
//                   반올림 방식이 기사마다 달라 내가 계산하면 기사와 어긋난다
export const UnitPriceCard = ({
  title = '', sub = '',
  total = '', totalLabel = '',
  count = 0, countLabel = '',
  unit = '', unitLabel = '',
  caption = '', source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const bandTop = title ? (sub ? 292 : 240) : 168;
  const BOT = CONTENT_BOTTOM - (caption ? 56 : 0);

  // 격자 — 가로세로를 √에 가깝게. 다만 **딱 나누어떨어지는 열 수를 먼저 찾는다.**
  // 576을 28열로 그리면 마지막 줄에 12칸이 비어 사각형 오른쪽 아래가 뜯겨 나간
  // 것처럼 보인다. 보는 사람은 그걸 "덜 그렸다" 로 읽지 나눗셈으로 읽지 않는다.
  // 576 = 24×24 처럼 떨어지는 조합이 있으면 그걸 쓰고, 없을 때만 어림수로 간다.
  const n = Math.max(1, Math.round(count));
  const ideal = Math.sqrt(n * 1.35);
  let cols = Math.max(1, Math.round(ideal));
  for (let d = 0; d <= Math.round(ideal * 0.28); d++) {
    const lo = Math.round(ideal) - d, hi = Math.round(ideal) + d;
    if (lo > 0 && n % lo === 0) { cols = lo; break; }
    if (n % hi === 0) { cols = hi; break; }
  }
  const rows = Math.ceil(n / cols);

  const GW = 700, GH = Math.min(430, BOT - bandTop - 120);
  const cw = GW / cols, ch = GH / rows;
  const GX = 190, GY = Math.round(bandTop + (BOT - bandTop - GH) / 2);

  // ① 덩어리가 얹힌다 → ② 칸으로 갈라진다 → ③ 한 칸만 남는다
  const solid = spring({frame: frame - 6, fps, config: {damping: 200}});
  const split = interpolate(frame, [30, 64], [0, 1],
                            {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pick = interpolate(frame, [72, 92], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // 남길 한 칸 — **가운데 줄의 오른쪽 끝.**
  // 처음엔 격자 정중앙을 골랐는데, 거기서 단가 쪽으로 선을 뻗으면 그 선이
  // 오른쪽 절반을 가로질러 격자를 반으로 잘라 버린다. 오른쪽 끝 칸이면
  // 선이 격자 밖으로 바로 빠져나가고, 가운데 줄이라 "구석에 떨어진 것" 으로도
  // 안 보인다. 맨 아랫줄은 칸이 모자랄 수 있어 피한다
  const pi = Math.floor(rows / 2) * cols + (cols - 1);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {Array.from({length: n}, (_, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          // 갈라지는 동안 칸 사이가 벌어진다 — 틈이 곧 나눗셈이다
          const gap = 2.4 * split;
          const x = GX + c * cw + gap / 2;
          const y = GY + r * ch + gap / 2;
          const on = i === pi;
          // 고른 칸만 남고 나머지는 흐려진다. **지우지는 않는다** —
          // 576개가 화면에 남아 있어야 "그중 하나" 라는 게 유지된다
          const o = on ? 1 : 1 - 0.78 * pick;
          return (
            <rect key={i} x={x} y={y} width={Math.max(0, cw - gap)} height={Math.max(0, ch - gap)}
                  fill={on && pick > 0.1 ? YELLOW : T.tones[1]}
                  opacity={solid * o}
                  stroke={on && pick > 0.4 ? T.ink : 'none'} strokeWidth={LW.THIN} />
          );
        })}
        {/* 고른 한 칸에 조준 테두리. 576칸이면 한 칸이 25px 라 색만 바꿔선 안 보인다 —
            칸보다 큰 사각형을 겹쳐 씌워야 "저기 한 칸" 으로 눈이 간다.
            칸 자체를 키우지는 않는다. 키우면 576분의 1 이라는 크기가 거짓말이 된다 */}
        {pick > 0.1 ? (() => {
          const pad = 14 * Math.min(1, pick * 2);
          return (
            <rect x={GX + (pi % cols) * cw - pad} y={GY + Math.floor(pi / cols) * ch - pad}
                  width={cw + pad * 2} height={ch + pad * 2}
                  fill="none" stroke={T.ink} strokeWidth={LW.BODY} opacity={pick} />
          );
        })() : null}
      </svg>

      {/* 총액 — 격자 위 */}
      <div style={{position: 'absolute', left: GX, top: GY - 74, opacity: fadeIn(frame, 4)}}>
        <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 54,
                      color: T.ink, fontVariantNumeric: 'tabular-nums'}}>{total}</span>
        {totalLabel ? (
          <span style={{marginLeft: SP.NEAR, fontFamily: 'A2Z Light, sans-serif',
                        fontSize: 30, color: T.soft}}>{totalLabel}</span>
        ) : null}
      </div>

      {/* 나눈 개수 — 격자 아래 */}
      <div style={{position: 'absolute', left: GX, width: GW, top: GY + GH + SP.GAP,
                   opacity: fadeIn(frame, 34)}}>
        <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 30, color: T.soft}}>
          ÷
        </span>
        <span style={{marginLeft: SP.NEAR, fontFamily: 'A2Z Medium, sans-serif',
                      fontSize: 40, color: T.ink, fontVariantNumeric: 'tabular-nums'}}>
          {count.toLocaleString()}
        </span>
        {countLabel ? (
          <span style={{marginLeft: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                        fontSize: 30, color: T.soft}}>{countLabel}</span>
        ) : null}
      </div>

      {/* 단가 — 오른쪽. 고른 칸에서 선이 뻗어 나온다 */}
      {pick > 0.05 ? (
        <>
          <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
            {/* 격자 안을 가로지르지 않게 **조준 테두리 오른쪽 끝**에서 출발한다.
                칸 중심에서 그으면 선이 다른 칸들 위를 지나가 격자를 반으로 자른다 */}
            <line
              x1={GX + (pi % cols) * cw + cw + 18}
              y1={GY + Math.floor(pi / cols) * ch + ch / 2}
              x2={GX + (pi % cols) * cw + cw + 18
                  + (1080 - (GX + (pi % cols) * cw + cw + 18)) * Math.min(1, pick * 1.4)}
              y2={GY + Math.floor(pi / cols) * ch + ch / 2}
              stroke={T.ink} strokeWidth={LW.BODY} opacity={0.7} />
          </svg>
          <div style={{position: 'absolute', left: 1120, width: 660,
                       top: GY + Math.floor(pi / cols) * ch + ch / 2 - 96,
                       opacity: pick}}>
            <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 32,
                         color: T.soft, marginBottom: SP.NEAR}}>
              {unitLabel || '한 칸당'}
            </div>
            <ValueChip size={92} hot theme={theme}>{unit}</ValueChip>
          </div>
        </>
      ) : null}

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 34,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 29,
                     color: T.soft, opacity: fadeIn(frame, 96), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
