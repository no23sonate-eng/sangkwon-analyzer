import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, PaperCaption, YELLOW, CONTENT_BOTTOM, fadeIn, SP, LW, titleBottom} from './paper';

// ── 막대 비교 ─────────────────────────────────────────────────────────────
// "1,015실이 868실이 됐다" 처럼 **같은 것의 두 시점**을 견줄 때.
// 성격이 다른 항목을 줄 세우는 건 YRankBarsCard(가로 막대) 쪽이다.
//
// **종이 시스템으로 옮기면서 채널 규칙 두 개를 같이 고쳤다.**
//   ① 숫자를 막대 위에 얹지 않는다. 원래는 막대 꼭대기에 값을 찍었는데
//      채널 규칙에 정면으로 어긋난다. 값은 **막대 밖 오른쪽**, 라벨 줄에 붙인다
//   ② 파스텔 4색 팔레트(#C98A9E 분홍 / #8FAD8B 초록 …) 를 버렸다.
//      이 채널은 먹 + 노랑 하나다. 색으로 항목을 구분하면 색이 뜻을 갖게 되고,
//      그러면 색을 계속 설명해야 한다. 강조 하나만 노랑으로 채운다
//   ③ light 인자로 흰 배경을 따로 갖고 있었다 — 테마가 그 일을 한다
//
// bars: [{label, value, displayValue, subValue, hot}]
export const BarChartCard = ({
  title = '', sub = '', bars = [], closingLine = '', caption = '',
  // arrow — 막대 사이에 작은 오른쪽 화살표. 두 막대가 **전/후** 일 때
  // "이쪽에서 저쪽으로" 를 한 글자도 안 쓰고 말한다 (#5)
  arrow = false,
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = themeOf(theme);

  // 예전엔 5개에서 잘랐다. **말없이 잘랐다.** 더그랜드롯데 #88 은 브랜드
  // 여섯 개를 견주는 컷인데 여섯 번째가 롯데호텔 39% — 이 컷의 결론이었다.
  // 그게 통째로 사라진 채 렌더가 [ok] 로 끝났다.
  // 일곱까지 받고, 개수에 맞춰 막대와 글자를 줄인다.
  const list = bars.slice(0, 7);
  const n = list.length || 1;
  const maxValue = Math.max(...list.map((b) => Math.abs(Number(b.value)) || 0), 1);

  const bandTop = title ? titleBottom(title, sub) + 26 : 190;
  const FOOT = 168;                       // 라벨 + 값
  const BASELINE = Math.min(700, CONTENT_BOTTOM - (caption || closingLine ? 96 : 40) - FOOT);
  const MAX_BAR_H = Math.max(160, BASELINE - bandTop - 20);

  const side = Math.min(240, Math.round(1180 / n));
  const gap = Math.min(110, Math.round(side * 0.5));
  const totalW = side * n + gap * (n - 1);
  const startX = (1920 - totalW) / 2;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />

      {title ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: 150, textAlign: 'center',
                     opacity: fadeIn(frame, 0)}}>
          <div style={{fontFamily: 'A2Z Medium, sans-serif',
                       fontSize: 42, color: T.ink, wordBreak: 'keep-all'}}>{title}</div>
          {sub ? (
            <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: 28, color: T.soft}}>{sub}</div>
          ) : null}
        </div>
      ) : null}

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <line x1={startX - 40} y1={BASELINE} x2={startX + totalW + 40} y2={BASELINE}
              stroke={T.ink} strokeWidth={LW.THIN} opacity={0.5 * fadeIn(frame, 6)} />
        {list.map((b, i) => {
          const grow = spring({frame: frame - 14 - i * 8, fps,
                               config: {damping: 200, mass: 0.8}, durationInFrames: 26});
          const h = (Math.abs(Number(b.value)) || 0) / maxValue * MAX_BAR_H * grow;
          const on = Boolean(b.hot);
          // ghost — **아직 없는 것**. 점선 윤곽만 그린다. 빈 자리가 있다는
          // 말을 글자로 하지 않고 그림으로 한다 (#92 "비어 있던 칸")
          return b.ghost ? (
            <rect key={i} x={startX + i * (side + gap)} y={BASELINE - h}
                  width={side} height={h}
                  fill="none" stroke={T.ink} strokeWidth={LW.THIN}
                  strokeDasharray="14 12" opacity={0.55 * grow} />
          ) : (
            <rect key={i} x={startX + i * (side + gap)} y={BASELINE - h}
                  width={side} height={h}
                  fill={on ? YELLOW : T.tones[0]}
                  stroke={T.ink} strokeWidth={on ? 3 : 2} />
          );
        })}
        {/* 막대 사이 화살표 — 사이가 두 칸 이상이면 첫 틈에만 그린다 */}
        {arrow && n > 1 ? (() => {
          const ax = startX + side + gap / 2;
          const ay = BASELINE - MAX_BAR_H * 0.42;
          const w = Math.min(46, gap * 0.5);
          const o = fadeIn(frame, 30, 16);
          return (
            <g opacity={o}>
              <line x1={ax - w / 2} y1={ay} x2={ax + w / 2 - 10} y2={ay}
                    stroke={T.ink} strokeWidth={LW.BODY} />
              <polygon points={`${ax + w / 2},${ay} ${ax + w / 2 - 14},${ay - 9} ${ax + w / 2 - 14},${ay + 9}`}
                       fill={T.ink} />
            </g>
          );
        })() : null}
      </svg>

      {/* 값은 막대 **아래**, 라벨과 한 덩어리로. 막대 위에 얹지 않는다 */}
      {list.map((b, i) => {
        const on = Boolean(b.hot);
        return (
          <div key={i} style={{position: 'absolute', left: startX + i * (side + gap) - gap / 2,
                               width: side + gap, top: BASELINE + SP.NEAR, textAlign: 'center',
                               opacity: fadeIn(frame, 30 + i * 8)}}>
            <div style={{fontFamily: 'A2Z Light, sans-serif',
                         fontSize: n > 5 ? 25 : 30, color: T.soft,
                         wordBreak: 'keep-all'}}>{b.label}</div>
            <div style={{marginTop: SP.TIGHT,
                         fontFamily: 'A2Z Medium, sans-serif',
                         fontSize: (on ? 54 : 44) * (n > 5 ? 0.8 : 1), color: T.ink,
                         fontVariantNumeric: 'tabular-nums'}}>
              {b.displayValue ?? b.value}
            </div>
            {b.subValue ? (
              <div style={{marginTop: 2, fontFamily: 'A2Z Light, sans-serif',
                           fontSize: 24, color: T.soft}}>{b.subValue}</div>
            ) : null}
          </div>
        );
      })}

      {closingLine ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 78,
                     textAlign: 'center', opacity: fadeIn(frame, 60)}}>
          <span style={{fontFamily: 'A2Z Medium, sans-serif',
                        fontSize: 42, color: T.ink, background: YELLOW,
                        padding: '6px 18px'}}>{closingLine}</span>
        </div>
      ) : null}
      <PaperCaption theme={theme} opacity={fadeIn(frame, 70)}>{caption}</PaperCaption>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
