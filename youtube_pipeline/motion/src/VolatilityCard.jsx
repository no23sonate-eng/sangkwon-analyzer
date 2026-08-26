import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, SP, LW, titleBottom} from './paper';

// ── 톱니 대 평지 ──────────────────────────────────────────────────────────
// "객실 매출은 성수기·비수기를 탄다. 임대 수입은 계약 기간 내내 평탄하다."
//
// 이 문장이 말하는 건 **높이가 아니라 흔들림**이다. 그래서 두 값을 그대로
// 겹쳐 그리면 안 된다 — 객실 매출과 임대료는 단위도 자릿수도 달라서, 겹쳐
// 놓으면 "어느 쪽이 큰가" 라는 엉뚱한 질문으로 눈이 간다.
//
// 그래서 **각 계열을 자기 연평균 = 100 으로 맞춰 놓고** 흔들림만 비교한다.
// 그러면 두 선의 높이는 뜻이 없어지고 모양만 남는다. 톱니와 평지.
// 그 대신 화면에 "각 항목의 연평균 = 100" 을 반드시 적는다. 안 적으면
// 서로 다른 두 값을 같은 축에 그린 셈이 되어 그냥 틀린 그래프다.
//
// 오른쪽 진폭 괄호가 결론이다. 선 모양은 인상이고, 괄호는 숫자다.
//
// series : [{name, values:[...], swingLabel, note, hot}]
//   values     원자료 (월별 등). 여기서 자기 평균 100 으로 지수화한다
//   swingLabel 진폭을 뭐라고 부를지 (예: '연중 ±38%') — **받는다**
export const VolatilityCard = ({
  title = '', sub = '',
  series = [], xLabels = [], indexNote = '각 항목의 연평균 = 100',
  caption = '', source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();

  const list = series.slice(0, 3).filter((s) => Array.isArray(s.values) && s.values.length > 1);
  if (list.length === 0) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const bandTop = title ? titleBottom(title, sub) + 24 : 176;
  const BOT = CONTENT_BOTTOM - (caption ? 58 : 0);

  const LX = 220, RX = 1340;          // 오른쪽은 진폭 괄호 + 진폭 값 자리
  const yTop = bandTop + 74, yBot = BOT - 88;   // 아래는 x축 라벨

  // 자기 평균 100 으로 지수화
  const idx = list.map((s) => {
    const v = s.values.map(Number).filter((x) => Number.isFinite(x));
    const m = v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
    return m === 0 ? v.map(() => 100) : v.map((x) => (x / m) * 100);
  });
  const all = idx.flat();
  const hi = Math.max(...all, 105), lo = Math.min(...all, 95);
  const pad = (hi - lo) * 0.18;
  const yOf = (v) => yBot - ((v - (lo - pad)) / ((hi + pad) - (lo - pad))) * (yBot - yTop);

  const n = Math.max(...idx.map((v) => v.length));
  const xOf = (i) => LX + (i / (n - 1)) * (RX - LX);

  // 선이 왼쪽에서 오른쪽으로 그어진다 — 시간이 흐르는 방향
  const trace = interpolate(frame, [10, 62], [0, 1],
                            {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const brac = interpolate(frame, [70, 92], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 100 기준선 — 이 선이 있어야 톱니가 "무엇을 중심으로" 흔들리는지 읽힌다 */}
        <line x1={LX} y1={yOf(100)} x2={RX} y2={yOf(100)}
              stroke={T.ink} strokeWidth={LW.HAIR} strokeDasharray="6 8" opacity={0.35} />
        <line x1={LX} y1={yBot} x2={RX} y2={yBot} stroke={T.ink} strokeWidth={LW.THIN} opacity={0.5} />

        {list.map((s, si) => {
          const v = idx[si];
          const on = Boolean(s.hot);
          const cut = Math.max(2, Math.round(v.length * trace));
          const pts = v.slice(0, cut).map((x, i) => `${xOf(i)},${yOf(x)}`).join(' ');
          return (
            <g key={si}>
              <polyline points={pts} fill="none"
                        stroke={on ? T.ink : T.ink} strokeWidth={on ? 6 : 3.5}
                        opacity={on ? 1 : 0.42}
                        strokeLinejoin="round" strokeLinecap="round" />
              {/* 강조 계열만 꼭짓점을 찍는다. 둘 다 찍으면 톱니가 뭉갠다 */}
              {on ? v.slice(0, cut).map((x, i) => (
                <circle key={i} cx={xOf(i)} cy={yOf(x)} r={5} fill={YELLOW}
                        stroke={T.ink} strokeWidth={LW.THIN} />
              )) : null}
            </g>
          );
        })}

        {/* 진폭 괄호 — 각 계열의 최고~최저를 오른쪽에 세로로 잰다. 여기가 결론 */}
        {list.map((s, si) => {
          const v = idx[si];
          const mx = Math.max(...v), mn = Math.min(...v);
          const bx = RX + 56 + si * 64;
          const y1 = yOf(mx), y2 = yOf(mn);
          const h = (y2 - y1) * brac;
          const on = Boolean(s.hot);
          return (
            <g key={si} opacity={brac}>
              <line x1={bx} y1={y1} x2={bx} y2={y1 + h}
                    stroke={on ? T.ink : T.soft} strokeWidth={on ? 5 : 3} />
              <line x1={bx - 13} y1={y1} x2={bx + 13} y2={y1}
                    stroke={on ? T.ink : T.soft} strokeWidth={on ? 5 : 3} />
              <line x1={bx - 13} y1={y1 + h} x2={bx + 13} y2={y1 + h}
                    stroke={on ? T.ink : T.soft} strokeWidth={on ? 5 : 3} />
              {/* 평지 계열은 괄호가 거의 점이 된다 — 그게 맞는 그림이다 */}
            </g>
          );
        })}
      </svg>

      {/* 계열 이름 — 처음엔 각 선 옆에 직접 붙였다. 그런데 이 카드의 주인공이
          **오르내리는 선**이라 선이 라벨을 계속 뚫고 지나간다. 시작점 위에 두면
          올라오는 선이 뚫고, 아래로 내리면 내려오는 선이 뚫고, 최댓값 위로 피하면
          두 계열 라벨끼리 겹친다. 그래서 그림판 **바깥 윗줄**로 뺐다.
          여기는 아무것도 그려지지 않는 자리라 어떤 자료가 와도 안 겹친다 */}
      <div style={{position: 'absolute', right: 96, top: bandTop + 8,
                   display: 'flex', gap: SP.BLOCK, alignItems: 'center',
                   opacity: fadeIn(frame, 8)}}>
        {list.map((s, si) => {
          const on = Boolean(s.hot);
          return (
            <div key={si} style={{display: 'flex', alignItems: 'center', gap: SP.NEAR}}>
              <svg width={46} height={16}>
                <line x1={2} y1={8} x2={44} y2={8}
                      stroke={T.ink} strokeWidth={on ? 6 : 3.5} opacity={on ? 1 : 0.42} />
                {on ? <circle cx={23} cy={8} r={5} fill={YELLOW} stroke={T.ink} strokeWidth={LW.THIN} /> : null}
              </svg>
              <span style={{fontFamily: 'A2Z Medium, sans-serif',
                            fontSize: on ? 32 : 28, color: on ? T.ink : T.soft,
                            wordBreak: 'keep-all'}}>{s.name}</span>
              {s.note ? (
                <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 24, color: T.soft}}>
                  {s.note}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* 진폭 값 — 한 세로 열에 모아 찍는다.
          처음엔 각자 괄호 가운데에 뒀는데, 두 계열 다 100 을 중심으로 흔들리니
          가운데가 같은 높이라 '연중 ±34%' 와 '연중 ±2%' 가 겹쳐 찍혔다.
          괄호는 각자 자리에 두되 값은 아래로 밀어 최소 간격을 확보한다 */}
      {(() => {
        const LBX = RX + 56 + (list.length - 1) * 64 + 34;
        const rows = list
          .map((s, si) => ({s, si, y: (yOf(Math.max(...idx[si])) + yOf(Math.min(...idx[si]))) / 2}))
          .filter((r) => r.s.swingLabel)
          .sort((a, b) => a.y - b.y);
        let last = -1e9;
        return rows.map((r) => {
          const y = Math.max(r.y, last + 58);
          last = y;
          return (
            <div key={r.si} style={{position: 'absolute', left: LBX, width: 330, top: y - 22,
                                    opacity: brac,
                                    fontFamily: 'A2Z Medium, sans-serif',
                                    fontSize: r.s.hot ? 34 : 28,
                                    color: r.s.hot ? T.ink : T.soft, wordBreak: 'keep-all'}}>
              {r.s.swingLabel}
            </div>
          );
        });
      })()}

      {/* x축 라벨 — 다 적으면 빽빽하다. 4개만 골라 찍는다 */}
      {xLabels.length > 1 ? xLabels.map((t, i) => {
        const step = Math.max(1, Math.round((xLabels.length - 1) / 3));
        if (i % step !== 0 && i !== xLabels.length - 1) return null;
        return (
          <div key={i} style={{position: 'absolute', left: xOf(i) - 90, width: 180,
                               top: yBot + SP.NEAR, textAlign: 'center',
                               fontFamily: 'A2Z Light, sans-serif', fontSize: 24, color: T.soft,
                               opacity: fadeIn(frame, 14)}}>{t}</div>
        );
      }) : null}

      {/* 지수화했다는 사실 — 이걸 빼면 단위가 다른 두 값을 겹쳐 그린 그래프가 된다 */}
      {indexNote ? (
        <div style={{position: 'absolute', left: LX, top: bandTop + 14,
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 24, color: T.soft,
                     opacity: fadeIn(frame, 6)}}>{indexNote}</div>
      ) : null}

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 26,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 28,
                     color: T.soft, opacity: fadeIn(frame, 96), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
