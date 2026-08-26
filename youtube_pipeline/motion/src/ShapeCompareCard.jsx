import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, SP, LW} from './paper';
import {DimLine} from './annotate';
import {fit} from './layout';

// ── 도형 두 개를 나란히 놓고 재기 ───────────────────────────────────────
// `FrontageCard`(§38)가 평면+정면 두 단을 쌓는 무거운 카드라면, 이건 **한 단**이다.
// "직사각형이 한쪽 면이 길다", "층고가 낮다", "위아래가 나뉜다" 처럼
// **도형 하나로 끝나는 말**에 쓴다. 카드가 무거우면 3초짜리 컷에 안 맞는다.
//
// 각 항목:
//   {w, h, label, dim, split, tone, hot}
//   w,h   비율 (같은 축척으로 그린다 — 둘의 크기를 비교하는 게 요점이므로)
//   dim   'bottom' | 'left' | null — 치수 화살표를 어디에 그을지
//   split 2 이상이면 그 수만큼 가로로 나눠 색을 다르게 (층 구분)
//
// 원칙은 그대로다: 단색 채움 + 외곽선, 강조는 옐로 하나 (§32-3).
export const ShapeCompareCard = ({
  title = '', sub = '',
  items = [], unit = '', numbered = false,   // true 면 막대 오른쪽에 01·02
  shrink = null,   // {from, at, dur} — 높이가 이 값에서 제 높이로 내려앉는다
  nudge = 0,       // 덩어리를 통째로 세로로 밀 픽셀 (+면 아래로)
  divide = 0,      // >0 이면 도형 안을 세로선으로 N 등분 (지분으로 쪼개진 필지)
  note = '', theme = 'paper', align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  if (!items.length) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const TOP = title ? (sub ? 300 : 246) : 178;
  const BOT = CONTENT_BOTTOM - (note ? 112 : 56);
  // 아래 치수선 자리는 **쓸 때만** 뗀다. 늘 92px 를 떼 놨더니 dim='left' 만
  // 쓰는 카드에서 그 자리가 통째로 놀고 도형만 작아졌다 (#98 은 도형이
  // 화면 높이의 18% 였다). 라벨 줄도 마찬가지로 있을 때만 센다.
  const hasLabel = items.some((o) => o.label || o.note);
  const hasBottomDim = items.some((o) => o.dim === 'bottom');
  const LABEL_H = hasLabel ? (numbered ? 24 : 118) : 0;
  // 치수선 라벨은 선 **위**에 앉는다. 바닥선과 치수선이 64px 밖에 안 떨어져
  // 있으면 글자 윗머리가 바닥선을 물어 안 읽힌다 (#18 "한 변이 곧다" 가
  // 바닥선 위에 얹혔다). 글자 한 줄 높이만큼 더 내린다.
  const DIM_DROP = 112;
  const DIM_H = hasBottomDim ? DIM_DROP + 52 : 24;
  const colW = 1920 / items.length;
  // 칸 한가운데에 그대로 세우면 두 막대가 480 / 1440 으로 화면 양 끝에 붙는다.
  // 가운데 쪽으로 당겨 한 덩어리로 읽히게 한다 (검수 지적 #4·#34).
  const PULL = items.length > 1 ? 0.62 : 1;
  const cxOf = (i) => Math.round(960 + (colW * (i + 0.5) - 960) * PULL);

  const maxW = Math.max(...items.map((o) => o.w));
  const maxH = Math.max(...items.map((o) => o.h));
  // 같은 축척 — 항목마다 배율이 다르면 "둘을 비교"가 성립하지 않는다
  // 한 칸짜리면 화면을 훨씬 넉넉히 쓴다 — 둘을 나란히 놓을 때만 좁혀야 한다
  const pad = numbered ? 620 : (items.length > 1 ? 230 : 620);
  const K = Math.min((colW - pad) / maxW, (BOT - TOP - LABEL_H - DIM_H) / maxH);

  const blockH = LABEL_H + maxH * K + DIM_H;
  const y0 = TOP + Math.max(0, (BOT - TOP - blockH) / 2) + nudge;
  const baseY = y0 + LABEL_H + maxH * K;      // 바닥선 — 전부 여기 맞춰 세운다

  const dark = T.dark;
  const FILL = dark ? '#4A5568' : '#C3C9D2';
  const FILL2 = dark ? '#3A4657' : '#AEB6C1';

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {items.map((o, i) => {
          const t = interpolate(frame, [6 + i * 10, 34 + i * 10], [0, 1],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const e = t * t * (3 - 2 * t);
          // "층고가 낮다"는 정지 그림으로는 비교 대상이 없어 안 와닿는다.
          // **높은 데서 내려앉는 걸 보여 주면** 낮다는 게 몸으로 읽힌다
          const sk = shrink ? interpolate(frame, [shrink.at, shrink.at + (shrink.dur || 30)],
                                          [1, 0], {extrapolateLeft: 'clamp',
                                                   extrapolateRight: 'clamp'}) : 0;
          const es = sk * sk * (3 - 2 * sk);

          const w = o.w * K;
          // 시작 높이(shrink.from)에서 제 높이로 내려앉는다. 바닥은 고정
          const h = shrink ? o.h * K * (1 + (shrink.from / o.h - 1) * es) : o.h * K;
          const cx = cxOf(i);
          const x = cx - w / 2, y = baseY - h;
          const n = Math.max(1, o.split || 1);
          return (
            <g key={i} opacity={e}>
              {/* shrink 가 걸리면 위에서 눌러 내린다 */}
              {Array.from({length: n}, (_, k) => (
                <rect key={k} x={x} y={y + (h / n) * k} width={w} height={h / n}
                      fill={o.hot ? (k % 2 ? '#E8ED4A' : YELLOW)
                                  : (k % 2 ? FILL2 : FILL)}
                      stroke={T.ink} strokeWidth={LW.BODY} />
              ))}
              {/* 바닥선 — 둘이 같은 지면에 서 있다는 걸 보여야 높이 비교가 된다 */}
              <line x1={x - 46} y1={baseY} x2={x + w + 46} y2={baseY}
                    stroke={T.ink} strokeWidth={LW.BODY} opacity={0.35} />

              {/* 지분 분할 — 한 필지가 여러 명 것이라는 걸 칸으로 보여 준다.
                  ShareSplitCard 와 같은 말을 하되 그림이 겹치지 않게 (검수 지적 #71) */}
              {divide > 1 ? (
                <g opacity={0.55 * e}>
                  {Array.from({length: divide - 1}, (_, k) => (
                    <line key={k} x1={x + (w * (k + 1)) / divide} y1={y}
                          x2={x + (w * (k + 1)) / divide} y2={baseY}
                          stroke={T.ink} strokeWidth={LW.THIN} strokeDasharray="6 5" />
                  ))}
                </g>
              ) : null}

              {o.dim === 'bottom' ? (
                <DimLine x1={x} y1={baseY + DIM_DROP} x2={x + w} y2={baseY + DIM_DROP}
                         progress={e} color={T.ink} width={3} cap={13}
                         label={o.dimLabel || `${o.w}${unit}`} labelSize={38} />
              ) : null}
              {o.dim === 'left' ? (
                <DimLine x1={x - 74} y1={baseY} x2={x - 74} y2={y}
                         progress={e} color={T.ink} width={3} cap={13}
                         label={o.dimLabel || `${o.h}${unit}`} labelSize={38} />
              ) : null}
            </g>
          );
        })}
      </svg>

      {items.map((o, i) => {
        const cx = cxOf(i);
        const op = fadeIn(frame, 8 + i * 10);
        if (!o.label) return null;
        const w = o.w * K;
        const h = shrink ? o.h * K : o.h * K;
        // **값을 막대 위에 올리지 않는다.** 막대 꼭대기에 얹으면 도형과 글자가
        // 붙어 둘 다 답답해지고, 막대가 짧을 때는 아예 겹친다.
        // 값은 막대 **오른쪽 옆**에 세로 가운데로 놓고, 순번은 그 위에 작게.
        if (numbered) {
          const bx = cx + w / 2 + SP.GAP;
          return (
            <div key={i} style={{position: 'absolute', left: bx, width: 460,
                                 top: baseY - h / 2 - 52, opacity: op, textAlign: 'left'}}>
              <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 24,
                           letterSpacing: '0.16em', color: T.soft, marginBottom: SP.TIGHT}}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{fontFamily: 'A2Z Medium, sans-serif',
                           fontSize: fit(o.label, 56, 420),
                           color: o.hot ? T.ink : T.soft, letterSpacing: '-0.01em'}}>
                {o.label}
              </div>
              {o.note ? (
                <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                             fontSize: 24, color: T.soft}}>{o.note}</div>
              ) : null}
            </div>
          );
        }
        return (
          <div key={i} style={{position: 'absolute', left: cx - 420, width: 840, top: y0,
                               textAlign: 'center', opacity: op,
                               fontFamily: 'A2Z Medium, sans-serif',
                               fontSize: fit(o.label, 48, 800),
                               color: o.hot ? T.ink : T.soft, wordBreak: 'keep-all'}}>
            {o.label}
            {o.note ? (
              <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                           fontSize: 24, color: T.soft}}>{o.note}</div>
            ) : null}
          </div>
        );
      })}

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 150, top: CONTENT_BOTTOM - 62,
                     textAlign: 'center', opacity: fadeIn(frame, 52),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft,
                     wordBreak: 'keep-all'}}>
          {note}
        </div>
      ) : null}

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
