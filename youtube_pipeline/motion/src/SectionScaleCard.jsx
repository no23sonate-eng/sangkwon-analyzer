import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, SP, LW, titleBottom} from './paper';
import {fit} from './layout';

// ── 단면 · 사람 스케일 ────────────────────────────────────────────────────
// "층고가 낮으면 큰 조형물을 못 세우고, 조명을 위에서 떨어뜨릴 자리가 안
// 나온다" — **원인 하나에 결과가 셋**인 문장이다. 지금까지 이런 문장은 회색
// 사각형 하나 띄우고 나레이션이 전부 지고 갔다. 그건 설명이 아니라 자막이다.
//
// B1M 이 이럴 때 하는 것은 **단면을 그리고 그 안에 물건을 넣어 보는 것**이다.
// 사람이 서 있고, 조형물이 천장에 닿아 잘리고, 조명 빛이 퍼질 자리가 없다.
// 말로 "좁다"고 하는 것과 **안 들어가는 걸 보여 주는 것**은 다른 일이다.
//
// 지켜야 할 것 하나: **미터로 그린다.** 눈대중으로 그리면 두 안(案)의 차이가
// 내가 정한 그림이 되고, 미터로 그리면 차이가 실제 값이 된다. 층고 3.2m 와
// 5.6m 는 비율이 정해져 있고 그 비율대로만 보여야 한다.
//
// cases: [{label, floors: [m, m…], void: 몇 층까지 뚫렸나(0=안 뚫림), note}]
// probes: [{h: m, label, kind: 'art'|'light'|'wall'}]  — 넣어 볼 물건
//   art   조형물 — 세로로 선다. 천장에 닿으면 잘린다
//   light 조명 — 천장에서 아래로 퍼진다. 퍼질 높이가 모자라면 원뿔이 뭉개진다
//   wall  영상 벽 — 벽면 높이를 그대로 쓴다
export const SectionScaleCard = ({
  title = '', sub = '',
  cases = [], probes = [],
  humanH = 1.7,
  caption = '', source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = cases.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const bandTop = title ? titleBottom(title, sub) + 26 : 180;
  // 아래에 들어갈 것을 **먼저 빼고** 단면 높이를 정한다. 캡션 자리를 안 빼면
  // 안 이름과 캡션이 같은 줄에 겹친다 (실제로 겹쳤다) — 그렇다고 캡션을
  // 자막 안전영역 아래로 내리면 자막과 싸운다
  const NAMEH = caption ? 156 : 104;
  const BOT = CONTENT_BOTTOM - NAMEH;
  const TOP = bandTop + SP.GAP;
  // 두 안 중 더 높은 쪽이 화면 높이를 정한다 — 각자 자기 높이에 맞추면
  // 층고가 다른데도 같아 보인다. 그게 이 카드가 막아야 할 바로 그 착시다.
  const maxM = Math.max(...cases.map((c) => (c.floors || []).reduce((a, b) => a + b, 0)), 1);
  const PXM = (BOT - TOP) / maxM;                 // 1m 가 몇 px 인가
  const slot = Math.min(560, 1720 / n);
  const x0 = (1920 - slot * n) / 2;
  const CW = Math.min(slot - 120, 300);           // 단면 한 칸의 가로

  const grow = spring({frame: frame - 8, fps, config: {damping: 200, mass: 0.9}});
  const probeIn = interpolate(frame, [34, 62], [0, 1],
                              {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // 사람 — 알아볼 수 있으면 된다. 자세히 그리면 단면보다 사람이 세진다
  const human = (hpx) => {
    const w = hpx * 0.26;
    return `M ${-w * 0.16},0 L ${-w * 0.16},${-hpx * 0.42} L ${-w * 0.5},${-hpx * 0.62} `
         + `L ${-w * 0.34},${-hpx * 0.72} L ${-w * 0.16},${-hpx * 0.62} `
         + `L ${-w * 0.16},${-hpx * 0.80} A ${w * 0.19} ${w * 0.19} 0 1 1 ${w * 0.16},${-hpx * 0.80} `
         + `L ${w * 0.16},${-hpx * 0.62} L ${w * 0.34},${-hpx * 0.72} `
         + `L ${w * 0.5},${-hpx * 0.62} L ${w * 0.16},${-hpx * 0.42} L ${w * 0.16},0 Z`;
  };

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 물건은 **방 안에서만** 보여야 한다. 안 자르면 빛 원뿔이 벽을 뚫고
            나가 치수선까지 덮는다 — 단면이 아니라 그냥 겹친 도형이 된다 */}
        <defs>
          {cases.map((c, ci) => {
            const fl = c.floors || [];
            const cx = x0 + slot * ci + slot / 2;
            const totalM = fl.reduce((a, b) => a + b, 0);
            return (
              <clipPath key={ci} id={`ssc-room${ci}`}>
                <rect x={cx - CW / 2} y={BOT - totalM * PXM} width={CW} height={totalM * PXM} />
              </clipPath>
            );
          })}
        </defs>
        {cases.map((c, ci) => {
          const fl = c.floors || [];
          const cx = x0 + slot * ci + slot / 2;
          const L = cx - CW / 2, R = cx + CW / 2;
          const totalM = fl.reduce((a, b) => a + b, 0);
          const base = BOT;
          // 층 경계 y 를 아래에서부터 쌓는다
          const ys = [base];
          let acc = 0;
          fl.forEach((h) => { acc += h; ys.push(base - acc * PXM * grow); });
          const voidTo = c.void || 0;              // 몇 층까지 뚫렸나
          const clearM = voidTo > 1
            ? fl.slice(0, voidTo).reduce((a, b) => a + b, 0)
            : fl[0];
          const clearPx = clearM * PXM * grow;

          return (
            <g key={ci}>
              {/* 바닥·슬래브 — 뚫린 구간의 슬래브는 점선으로만 남긴다.
                  아예 안 그리면 "원래 한 층짜리" 로 읽혀서 뚫었다는 게 안 보인다 */}
              {ys.map((y, i) => {
                if (i === 0) {
                  return <rect key={i} x={L - 16} y={y} width={CW + 32} height={10} fill={T.ink} />;
                }
                const opened = i <= voidTo && i < ys.length - 1;
                return (
                  <rect key={i} x={L} y={y - 8} width={CW} height={8}
                        fill={opened ? 'none' : T.ink}
                        stroke={opened ? T.ink : 'none'} strokeWidth={LW.THIN}
                        strokeDasharray={opened ? '10 8' : undefined}
                        opacity={opened ? 0.45 : 1} />
                );
              })}
              {/* 좌우 벽 */}
              <rect x={L - 10} y={ys[ys.length - 1]} width={10} height={base - ys[ys.length - 1]}
                    fill={T.ink} opacity={0.9} />
              <rect x={R} y={ys[ys.length - 1]} width={10} height={base - ys[ys.length - 1]}
                    fill={T.ink} opacity={0.9} />

              {/* 사람 — 축척의 기준. 이게 없으면 단면은 그냥 사각형이다 */}
              <path d={human(humanH * PXM * grow)} fill={T.soft}
                    transform={`translate(${L + CW * 0.22}, ${base})`} opacity={0.95} />

              {/* 넣어 보는 물건 — 방 안으로 잘린다 */}
              <g clipPath={`url(#ssc-room${ci})`}>
              {probes.map((p, pi) => {
                const hpx = p.h * PXM;
                const px0 = L + CW * (0.46 + pi * 0.3);
                const over = p.h > clearM + 0.001;      // 천장에 닿는가
                const drawH = Math.min(hpx, clearPx) * probeIn;
                const col = over ? T.soft : YELLOW;
                if (p.kind === 'light') {
                  // 조명 — 천장에서 내려오는 빛. 퍼지려면 높이가 있어야 한다
                  const spread = Math.min(hpx, clearPx) * 0.38 * probeIn;
                  const top = base - clearPx + 8;
                  return (
                    <g key={pi} opacity={probeIn}>
                      <circle cx={px0} cy={top + 6} r={7} fill={T.ink} />
                      <path d={`M ${px0},${top + 6} L ${px0 - spread},${base} L ${px0 + spread},${base} Z`}
                            fill={col} opacity={over ? 0.14 : 0.3} />
                    </g>
                  );
                }
                if (p.kind === 'wall') {
                  return (
                    <rect key={pi} x={R - 10 - 16} y={base - drawH} width={16} height={drawH}
                          fill={col} opacity={over ? 0.5 : 0.95} />
                  );
                }
                // 조형물 — 천장에 걸리면 잘린 자리에 사선을 긋는다.
                // "안 들어간다" 를 글자로 쓰지 않고 그림으로 말한다
                return (
                  <g key={pi}>
                    <rect x={px0 - hpx * 0.13} y={base - drawH}
                          width={hpx * 0.26} height={drawH}
                          fill={col} opacity={over ? 0.7 : 1} />
                    {over && probeIn > 0.7 ? (
                      <g stroke={T.ink} strokeWidth={LW.BODY} opacity={0.9}>
                        <line x1={px0 - hpx * 0.24} y1={base - clearPx + 14}
                              x2={px0 + hpx * 0.24} y2={base - clearPx - 14} />
                        <line x1={px0 - hpx * 0.24} y1={base - clearPx - 14}
                              x2={px0 + hpx * 0.24} y2={base - clearPx + 14} />
                      </g>
                    ) : null}
                  </g>
                );
              })}
              </g>

              {/* 유효 높이 치수 — 도면 문법: 가는 선 + 양끝 짧은 수직 마크 */}
              {grow > 0.9 ? (
                <g stroke={T.ink} strokeWidth={LW.THIN} opacity={0.85 * fadeIn(frame, 26)}>
                  <line x1={R + 34} y1={base} x2={R + 34} y2={base - clearPx} />
                  <line x1={R + 24} y1={base} x2={R + 44} y2={base} />
                  <line x1={R + 24} y1={base - clearPx} x2={R + 44} y2={base - clearPx} />
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* 치수값 · 안 이름 — SVG 밖에서 얹어야 한글 자간이 제대로 먹는다 */}
      {cases.map((c, ci) => {
        const fl = c.floors || [];
        const cx = x0 + slot * ci + slot / 2;
        const voidTo = c.void || 0;
        const clearM = voidTo > 1
          ? fl.slice(0, voidTo).reduce((a, b) => a + b, 0)
          : fl[0];
        const clearPx = clearM * PXM;
        return (
          <React.Fragment key={ci}>
            <div style={{position: 'absolute', left: cx + CW / 2 + 54,
                         top: BOT - clearPx / 2 - 26, opacity: fadeIn(frame, 30)}}>
              <span style={{fontFamily: 'A2Z Medium, sans-serif',
                            fontSize: 36, color: c.hot ? T.ink : T.soft,
                            fontVariantNumeric: 'tabular-nums'}}>
                {clearM}m
              </span>
            </div>
            <div style={{position: 'absolute', left: cx - slot / 2, width: slot,
                         top: BOT + 26, textAlign: 'center', opacity: fadeIn(frame, 20 + ci * 6)}}>
              <div style={{fontFamily: 'A2Z Medium, sans-serif',
                           fontSize: fit(c.label || '', 42, slot - 20), color: T.ink,
                           wordBreak: 'keep-all'}}>
                {c.label}
              </div>
              {c.note ? (
                <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                             fontSize: 28, color: T.soft, wordBreak: 'keep-all'}}>
                  {c.note}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 26,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 28,
                     color: T.soft, opacity: fadeIn(frame, 64), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
