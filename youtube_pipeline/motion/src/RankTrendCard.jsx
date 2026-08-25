import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';

// 순위 추이 카드 — "몇 위 → 몇 위 → 1위" 처럼 낮을수록 좋은 값을 다룬다.
// 일반 라인차트와 달리 y축을 뒤집어(1위가 맨 위) 상승으로 읽히게 한다.
// points: [{x:'2023', rank:2, label?}] / best: 축 상단 순위(기본 1)
export const RankTrendCard = ({
  title = '', sub = '',
  points = [],
  worst = null,          // 축 하단 순위 (미지정 시 최대 rank + 1)
  best = 1,
  unit = '위',
  highlightLast = true,
  caption = '',
  source = '',
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const n = points.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const lo = worst ?? Math.max(...points.map((p) => p.rank)) + 1;
  const X0 = 420, X1 = 1500, Y0 = 452, Y1 = 630;
  const px = (i) => (n === 1 ? (X0 + X1) / 2 : X0 + (i * (X1 - X0)) / (n - 1));
  const py = (r) => Y0 + ((r - best) / Math.max(1, lo - best)) * (Y1 - Y0);

  // 선이 좌→우로 그려지는 진행도 (구간당 22프레임)
  const SEG = 22, T0 = 16;
  const prog = interpolate(frame, [T0, T0 + SEG * (n - 1)], [0, n - 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // 그려진 폴리라인 정점
  const pts = [];
  for (let i = 0; i < n; i++) {
    if (prog >= i) pts.push([px(i), py(points[i].rank)]);
    else if (prog > i - 1) {
      const t = prog - (i - 1);
      pts.push([px(i - 1) + (px(i) - px(i - 1)) * t,
                py(points[i - 1].rank) + (py(points[i].rank) - py(points[i - 1].rank)) * t]);
      break;
    } else break;
  }

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 1위 기준선 — 목표선 */}
        <line x1={X0 - 130} y1={py(best)} x2={X1 + 130} y2={py(best)}
              stroke={T.ink} strokeWidth={2} strokeDasharray="7 6" opacity={0.4} />
        {/* 세로 가이드 */}
        {points.map((p, i) => (
          <line key={`g${i}`} x1={px(i)} y1={py(best) - 20} x2={px(i)} y2={Y1 + 38}
                stroke={T.ink} strokeWidth={1} opacity={0.13} />
        ))}
        {/* 추이선 */}
        {pts.length > 1 ? (
          <polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
                    fill="none" stroke={T.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {/* 정점 마커 */}
        {points.map((p, i) => {
          if (prog < i - 0.02) return null;
          const hot = highlightLast && i === n - 1;
          const o = fadeIn(frame, T0 + SEG * i - 4, 10);
          const r = hot ? 24 : 12;
          return (
            <g key={i} opacity={o}>
              {hot ? <circle cx={px(i)} cy={py(p.rank)} r={r + 16} fill={YELLOW} opacity={0.55} /> : null}
              <circle cx={px(i)} cy={py(p.rank)} r={r} fill={hot ? YELLOW : T.tones[3]} stroke={T.ink} strokeWidth={3.5} />
            </g>
          );
        })}
      </svg>

      {/* 각 점의 순위 숫자 (위) + 연도 (아래) */}
      {points.map((p, i) => {
        if (prog < i - 0.02) return null;
        const hot = highlightLast && i === n - 1;
        const o = fadeIn(frame, T0 + SEG * i + 2, 12);
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: px(i) - 180, width: 360, top: py(p.rank) - (hot ? 150 : 126),
                         textAlign: 'center', opacity: o}}>
              <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: hot ? 110 : 84,
                            color: T.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums'}}>
                {p.rank}<span style={{fontSize: hot ? 60 : 47}}>{unit}</span>
              </span>
            </div>
            <div style={{position: 'absolute', left: px(i) - 180, width: 360, top: Y1 + 54, textAlign: 'center', opacity: o}}>
              <div style={{fontFamily: hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                           fontSize: 45, color: hot ? T.ink : T.soft, letterSpacing: '0.02em'}}>
                {p.x}
              </div>
              {p.label ? (
                <div style={{marginTop: 8, fontFamily: 'A2Z Light, sans-serif', fontSize: 34, color: T.soft, wordBreak: 'keep-all'}}>
                  {p.label}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
      {caption ? (
        <div style={{position: 'absolute', left: 0, width: 1920, top: CONTENT_BOTTOM - 58, textAlign: 'center',
                     opacity: fadeIn(frame, T0 + SEG * n + 6), fontFamily: 'A2Z Regular, sans-serif',
                     fontSize: 38, color: T.ink, wordBreak: 'keep-all'}}>
          <span style={{background: 'rgba(250,255,46,0.75)', padding: '4px 16px'}}>{caption}</span>
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
