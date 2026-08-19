import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';
import {DimLine} from './annotate';
import {fit} from './layout';

// ── 단면 도해 ────────────────────────────────────────────────────────────
// B1M 의 Culebra Cut 단면 프레임에서 읽은 문법 (§32-3 ②).
//   파란 배경 + 격자 · **주황 채움**으로 파낸 단면 · **흰 점선**으로 "원래 계획"
//   라벨은 도형 안에 흰 글씨 · 우하단에 면책 문구
// 색이 딱 두 개(바탕 파랑 / 채움 주황)뿐이라는 게 핵심이다. 지층마다 색을 다르게 하면
// 지질도가 되지 개념 설명이 안 된다 — **파낸 곳과 안 판 곳**만 구분되면 된다.
//
// `IsoDiagramCard` 와 역할이 다르다.
//   축측 = "이게 어떻게 생겼나" (덩어리·배치)
//   단면 = **"얼마나 깊나 / 어디를 얼마나 팠나"** (깊이·경계)
// 지하 7층, 터널, 절토, 표고차 — 깊이가 이야기의 주인공일 때 이쪽이다.
//
// 좌표는 **실제 단위**로 준다 (x = 거리 m, y = 표고 m. 음수가 지하).
// 그래야 "지하 7층 = -28m" 같은 값을 그대로 넣고 축이 알아서 맞는다.
//
// ground : [[x, y], …]  지표면 프로파일 (왼→오른)
// cut    : [[x, y], …]  파낸 뒤의 면. ground 아래로 내려가는 구간이 채워진다
// plan   : [[x, y], …]  점선으로 그릴 대안 (원래 계획 / 법정 상한 등)
// bands  : [{from, to, label}]  표고 구간 띠 (지층·층수 구간)
// marks  : [{x, y, label, side}]
export const SectionDiagramCard = ({
  title = '', sub = '',
  ground = [], cut = [], plan = [], planLabel = '',
  bands = [], marks = [], dim = null,
  unit = 'm', note = '',
  disclaimer = '단면 도해 — 실제 지반 조건과 다를 수 있음',
  theme = 'blueprint', align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const all = [...ground, ...cut, ...plan];
  if (all.length < 2) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const yLo = Math.min(...ys), yHi = Math.max(...ys);
  const pad = (yHi - yLo) * 0.14 || 5;

  const L = 210, R = 1830;
  const TOP = title ? (sub ? 300 : 246) : 170;
  const BOT = CONTENT_BOTTOM - 40;
  const SX = (x) => L + (x - x0) / ((x1 - x0) || 1) * (R - L);
  const SY = (y) => BOT - (y - (yLo - pad)) / ((yHi + pad - yLo + pad) || 1) * (BOT - TOP);

  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'} ${SX(p[0])} ${SY(p[1])}`).join(' ');
  const len = (pts) => pts.reduce((a, p, i) => i
    ? a + Math.hypot(SX(p[0]) - SX(pts[i - 1][0]), SY(p[1]) - SY(pts[i - 1][1])) : 0, 0);

  // ① 지표선이 왼쪽에서 그어진다 → ② 파낸 면이 채워진다 → ③ 점선 계획이 나타난다
  const gT = interpolate(frame, [6, 34], [0, 1],
                         {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const cT = interpolate(frame, [30, 58], [0, 1],
                         {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const eC = cT * cT * (3 - 2 * cT);
  const pT = interpolate(frame, [56, 76], [0, 1],
                         {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // 파낸 부분 = ground 와 cut 사이. cut 을 되짚어 닫으면 폐곡선이 된다.
  const cutPoly = cut.length > 1
    ? `${path(cut)} ${[...ground].reverse().map((p) => `L ${SX(p[0])} ${SY(p[1])}`).join(' ')} Z`
    : '';

  const gLen = len(ground);
  const CUT_FILL = '#E8892B';         // 주황. 파랑 바탕의 보색이라 파낸 곳만 튄다

  const ticks = [];
  {
    const span = yHi + pad - (yLo - pad);
    const NICE = [1, 2, 5, 10, 20, 25, 50, 100];
    const step = NICE.find((v) => span / v <= 9) ?? 100;
    for (let y = Math.ceil((yLo - pad) / step) * step; y <= yHi + pad; y += step) ticks.push(y);
  }

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 표고 눈금 — "재는 판"이라는 약속을 먼저 깐다 */}
        {ticks.map((y, i) => (
          <g key={y} opacity={fadeIn(frame, 2 + i)}>
            <line x1={L - 14} y1={SY(y)} x2={R} y2={SY(y)}
                  stroke={T.ink} strokeWidth={y === 0 ? 2 : 1}
                  opacity={y === 0 ? 0.4 : 0.12} />
            <text x={L - 24} y={SY(y) + 9} textAnchor="end" fill={T.soft} fontSize={26}
                  style={{fontFamily: 'A2Z Light, sans-serif'}}>{y}{unit}</text>
          </g>
        ))}

        {/* 표고 구간 띠 — 지층·층수 구간 */}
        {bands.map((b, i) => (
          <g key={i} opacity={fadeIn(frame, 10 + i * 4)}>
            <rect x={L} y={SY(b.to)} width={R - L} height={Math.abs(SY(b.from) - SY(b.to))}
                  fill={b.hot ? YELLOW : T.ink} opacity={b.hot ? 0.16 : 0.07} />
            {b.label ? (
              <text x={L + 18} y={(SY(b.from) + SY(b.to)) / 2 + 9} textAnchor="start"
                    fill={T.soft} fontSize={26}
                    style={{fontFamily: 'A2Z Light, sans-serif'}}>{b.label}</text>
            ) : null}
          </g>
        ))}

        {/* ② 파낸 단면 — 주황 하나로 끝낸다. 지층마다 색을 다르게 하면 지질도가 된다 */}
        {cutPoly ? (
          <g opacity={eC}>
            <path d={cutPoly} fill={CUT_FILL} opacity={0.9} />
            <path d={path(cut)} fill="none" stroke={CUT_FILL} strokeWidth={4} />
          </g>
        ) : null}

        {/* ① 지표선 */}
        {ground.length > 1 ? (
          <path d={path(ground)} fill="none" stroke={T.ink} strokeWidth={5}
                strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray={`${gLen} ${gLen}`} strokeDashoffset={gLen * (1 - gT)} />
        ) : null}

        {/* ③ 점선 = 원래 계획. 실선(실제)과 **선 종류로** 구분한다 — 색을 또 쓰면 셋이 된다 */}
        {plan.length > 1 ? (
          <path d={path(plan)} fill="none" stroke={T.ink} strokeWidth={3}
                strokeDasharray="16 12" opacity={0.75 * pT} />
        ) : null}

        {dim ? (
          <DimLine x1={SX(dim.x)} y1={SY(dim.from)} x2={SX(dim.x)} y2={SY(dim.to)}
                   progress={interpolate(frame, [62, 80], [0, 1],
                                         {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
                   color={T.ink} width={3} cap={14} label={dim.label} labelSize={42} />
        ) : null}
      </svg>

      {marks.map((m, i) => {
        const o = fadeIn(frame, 66 + i * 6);
        if (o <= 0.01) return null;
        const right = m.side !== 'left';
        return (
          <div key={i} style={{position: 'absolute', top: SY(m.y) - 20,
                               left: right ? SX(m.x) + 16 : undefined,
                               right: right ? undefined : 1920 - SX(m.x) + 16,
                               opacity: o, whiteSpace: 'nowrap',
                               fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                               fontSize: fit(m.label, 34, 480), color: T.ink}}>
            {m.label}
          </div>
        );
      })}

      {planLabel && plan.length > 1 ? (
        <div style={{position: 'absolute', left: L, top: TOP - 44, opacity: fadeIn(frame, 60),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 27, color: T.soft}}>
          ┈┈ {planLabel}
        </div>
      ) : null}

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 150, top: CONTENT_BOTTOM - 4,
                     textAlign: align === 'left' ? 'left' : 'center',
                     opacity: fadeIn(frame, 76),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 30, color: T.soft,
                     wordBreak: 'keep-all'}}>
          {note}
        </div>
      ) : null}

      {disclaimer ? (
        <div style={{position: 'absolute', left: 44, top: 1028,
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 20, color: T.soft,
                     opacity: 0.75}}>
          {disclaimer}
        </div>
      ) : null}

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
