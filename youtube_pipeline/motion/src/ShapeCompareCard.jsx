import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';
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
  items = [], unit = '',
  note = '', theme = 'paper', align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  if (!items.length) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const TOP = title ? (sub ? 300 : 246) : 178;
  const BOT = CONTENT_BOTTOM - (note ? 78 : 30);
  const LABEL_H = 74, DIM_H = 92;
  const colW = 1920 / items.length;

  const maxW = Math.max(...items.map((o) => o.w));
  const maxH = Math.max(...items.map((o) => o.h));
  // 같은 축척 — 항목마다 배율이 다르면 "둘을 비교"가 성립하지 않는다
  // 한 칸짜리면 화면을 훨씬 넉넉히 쓴다 — 둘을 나란히 놓을 때만 좁혀야 한다
  const pad = items.length > 1 ? 230 : 620;
  const K = Math.min((colW - pad) / maxW, (BOT - TOP - LABEL_H - DIM_H) / maxH);

  const blockH = LABEL_H + maxH * K + DIM_H;
  const y0 = TOP + Math.max(0, (BOT - TOP - blockH) / 2);
  const baseY = y0 + LABEL_H + maxH * K;      // 바닥선 — 전부 여기 맞춰 세운다

  const dark = T.bg !== '#EFEAE3';
  const FILL = dark ? '#4A5568' : '#C3C9D2';
  const FILL2 = dark ? '#3A4657' : '#AEB6C1';

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {items.map((o, i) => {
          const w = o.w * K, h = o.h * K;
          const cx = colW * (i + 0.5);
          const x = cx - w / 2, y = baseY - h;
          const t = interpolate(frame, [6 + i * 10, 34 + i * 10], [0, 1],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const e = t * t * (3 - 2 * t);
          const n = Math.max(1, o.split || 1);
          return (
            <g key={i} opacity={e}>
              {Array.from({length: n}, (_, k) => (
                <rect key={k} x={x} y={y + (h / n) * k} width={w} height={h / n}
                      fill={o.hot ? (k % 2 ? '#E8ED4A' : YELLOW)
                                  : (k % 2 ? FILL2 : FILL)}
                      stroke={T.ink} strokeWidth={3} />
              ))}
              {/* 바닥선 — 둘이 같은 지면에 서 있다는 걸 보여야 높이 비교가 된다 */}
              <line x1={x - 46} y1={baseY} x2={x + w + 46} y2={baseY}
                    stroke={T.ink} strokeWidth={4} opacity={0.35} />

              {o.dim === 'bottom' ? (
                <DimLine x1={x} y1={baseY + 62} x2={x + w} y2={baseY + 62}
                         progress={e} color={T.ink} width={3} cap={13}
                         label={o.dimLabel || `${o.w}${unit}`} labelSize={38} />
              ) : null}
              {o.dim === 'left' ? (
                <DimLine x1={x - 46} y1={baseY} x2={x - 46} y2={y}
                         progress={e} color={T.ink} width={3} cap={13}
                         label={o.dimLabel || `${o.h}${unit}`} labelSize={38} />
              ) : null}
            </g>
          );
        })}
      </svg>

      {items.map((o, i) => {
        const cx = 1920 / items.length * (i + 0.5);
        const op = fadeIn(frame, 8 + i * 10);
        if (!o.label) return null;
        return (
          <div key={i} style={{position: 'absolute', left: cx - 420, width: 840, top: y0,
                               textAlign: 'center', opacity: op,
                               fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                               fontSize: fit(o.label, 48, 800),
                               color: o.hot ? T.ink : T.soft, wordBreak: 'keep-all'}}>
            {o.label}
            {o.note ? (
              <div style={{marginTop: 6, fontFamily: 'A2Z Light, sans-serif',
                           fontSize: 27, color: T.soft}}>{o.note}</div>
            ) : null}
          </div>
        );
      })}

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 150, top: CONTENT_BOTTOM - 26,
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
