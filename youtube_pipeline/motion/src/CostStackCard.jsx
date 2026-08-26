import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, TONES, DARK_TONES, CONTENT_BOTTOM, fadeIn, SP, LW} from './paper';

// ── 쌓여서 총액이 되는 그래프 (워터폴) ────────────────────────────────
// "낙찰가 541.5억에 취득세와 기타 비용을 더하면 570억" 같은 말은
// 숫자 세 개를 나열하면 **더한다는 사실만 남고 얼마나 붙는지가 안 남는다.**
// 조각을 하나씩 위로 쌓아 총액 선까지 닿게 하면, 취득세가 붙는 두께가
// 눈으로 읽힌다 — B1M 이 공사비를 설명할 때 쓰는 문법.
//
// **얇은 조각 문제.** 541.5 : 25 : 3.5 처럼 비율이 극단이면 위 두 조각이
// 몇 픽셀이 되고, 이름표가 서로 위에 얹힌다 (실제로 겹쳤다). 이름표를
// 조각 한가운데 그대로 두는 방식은 이 데이터에서 못 쓴다.
// 그래서 **이름표는 최소 간격을 강제해 아래부터 밀어 올리고, 조각까지는
// 지시선(leader)으로 잇는다.** 신문 도표가 쓰는 해법이고 비율에 안 흔들린다.
//
// parts: [{value, display, prefix, label, hot}]  — 아래부터 순서대로 쌓인다
export const CostStackCard = ({
  title = '', sub = '', parts = [], unit = '억원',
  totalLabel = '합계', totalDisplay = null,
  source = '', caption = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!parts.length) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const dark = T.paper !== '#EFEAE3';
  const tones = dark ? DARK_TONES : TONES;

  const total = parts.reduce((a, p) => a + (p.value || 0), 0);
  const bandTop = title ? (sub ? 300 : 250) : 190;
  const baseY = CONTENT_BOTTOM - 30;
  const colTop = bandTop + 70;                 // 총액 선이 놓일 높이
  const colH = baseY - colTop;

  const BAR_X = 880, BAR_W = 280;
  // 컷이 짧아도 총액까지 다 보여야 한다 — 마지막 조각이 74프레임(2.5초)에 앉는다
  const STEP = 16;

  let acc = 0;
  const rows = parts.map((p, i) => {
    const from = acc;
    acc += p.value || 0;
    return {...p, i,
            y0: baseY - (from / total) * colH,
            y1: baseY - (acc / total) * colH,
            g: spring({frame: frame - (16 + i * STEP), fps, config: {damping: 200, mass: 0.75}})};
  });

  // ── 이름표 세로 배치: 아래부터 최소 간격을 지키며 밀어 올린다 ──
  // 그리고 **천장을 넘으면 통째로 내린다.** 밀어 올리기만 하면 맨 위 이름표가
  // 부제 위로 올라타 버린다 (실제로 올라탔다). 띠 안에 들어올 때까지 평행이동.
  const LAB_GAP = 116;
  const CEIL = bandTop + 30;
  const labY = [];
  for (let i = 0; i < rows.length; i++) {
    const want = (rows[i].y0 + rows[i].y1) / 2;
    const floor = i === 0 ? baseY - 46 : labY[i - 1] - LAB_GAP;
    labY.push(Math.min(want, floor));
  }
  const over = CEIL - labY[labY.length - 1];
  if (over > 0) for (let i = 0; i < labY.length; i++) labY[i] += over;

  const totalIn = fadeIn(frame, 16 + parts.length * STEP + 10);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <line x1={BAR_X - 40} y1={baseY} x2={BAR_X + BAR_W + 520} y2={baseY}
              stroke={T.ink} strokeWidth={LW.THIN} opacity={0.35 * fadeIn(frame, 6)} />

        {rows.map((r, i) => {
          const h = (r.y0 - r.y1) * r.g;
          return (
            <rect key={i} x={BAR_X} y={r.y0 - h} width={BAR_W} height={Math.max(0, h)}
                  fill={r.hot ? YELLOW : tones[i % tones.length]}
                  fillOpacity={r.hot ? 0.95 : 0.75}
                  stroke={T.ink} strokeWidth={LW.BODY} />
          );
        })}

        {/* 지시선 — 밀어 올린 이름표에서 조각 한가운데로. 팔꿈치 한 번만 꺾는다 */}
        {rows.map((r, i) => {
          const mid = (r.y0 + r.y1) / 2;
          const o = fadeIn(frame, 26 + i * STEP);
          const elbow = BAR_X - 52;
          return (
            <polyline key={i} fill="none" stroke={T.ink} strokeWidth={LW.THIN} opacity={0.45 * o}
                      points={`${BAR_X - 190},${labY[i]} ${elbow},${labY[i]} ${BAR_X - 6},${mid}`} />
          );
        })}

        {/* 총액 선 — 다 쌓인 뒤에 오른쪽으로 뻗는다 */}
        <line x1={BAR_X} y1={colTop}
              x2={BAR_X + BAR_W + interpolate(totalIn, [0, 1], [0, 420])} y2={colTop}
              stroke={T.ink} strokeWidth={LW.BODY} strokeDasharray="10 8" opacity={0.85 * totalIn} />
      </svg>

      {/* 이름 + 값 — 기둥 왼쪽, 오른쪽 정렬 (지시선 시작점에 맞는다) */}
      {rows.map((r, i) => (
        <div key={i} style={{position: 'absolute', right: 1920 - (BAR_X - 200),
                             top: labY[i] - 40, width: 560, textAlign: 'right',
                             opacity: fadeIn(frame, 26 + i * STEP)}}>
          <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 31, lineHeight: 1.2,
                       color: T.soft, wordBreak: 'keep-all'}}>{r.label}</div>
          <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Medium, sans-serif',
                       fontSize: 46, lineHeight: 1, color: T.ink,
                       fontVariantNumeric: 'tabular-nums'}}>
            {r.prefix ? <span style={{fontSize: 30, color: T.soft, marginRight: 7,
                                      fontFamily: 'A2Z Light, sans-serif'}}>{r.prefix}</span> : null}
            {r.display ?? r.value}
            <span style={{fontSize: 27, color: T.soft, marginLeft: 6}}>{unit}</span>
          </div>
        </div>
      ))}

      {/* 합계 — 총액 선 오른쪽. 막대 위에 숫자를 올리지 않는다는 규칙 그대로 */}
      <div style={{position: 'absolute', left: BAR_X + BAR_W + SP.BLOCK,
                   top: colTop - 52, width: 560, textAlign: 'left', opacity: totalIn}}>
        <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 30, lineHeight: 1,
                     letterSpacing: '0.14em', color: T.soft}}>{totalLabel}</div>
        {/* 총액 선이 지나는 높이를 비워 둔다 — 옐로 박스가 선을 물면 둘 다 지저분해진다 */}
        <div style={{marginTop: SP.GAP, fontFamily: 'A2Z Medium, sans-serif',
                     fontSize: 92, lineHeight: 1.05, color: '#1B1E24',
                     fontVariantNumeric: 'tabular-nums'}}>
          <span style={{background: YELLOW, padding: '0 14px'}}>
            {totalDisplay ?? Math.round(total * 10) / 10}
            <span style={{fontSize: 42, marginLeft: 8}}>{unit}</span>
          </span>
        </div>
      </div>

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 26,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 32,
                     color: T.soft, opacity: fadeIn(frame, 70), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
