import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, PaperKicker, PaperCaption,
        YELLOW, CONTENT_BOTTOM, fadeIn, SP, LW} from './paper';

// v2 좌석 도트 카드 — 좌석 수를 "실제 도트 수"로 보여준다 (● = perDot 석).
// 아레나 반원 배열: 무대(하단) 주위로 도트가 켜지며 차오른다.
// arenas: [{label, count, sub, hot}] 1개(단독) 또는 2개(나란히 비교).
const buildArena = (count, perDot, cx, cy, scale = 1) => {
  const dots = [];
  const need = Math.ceil(count / perDot);
  let r = 120 * scale;
  const dotGap = 30 * scale;
  while (dots.length < need && r < 2000) {
    const arc = Math.PI * 1.1; // 198도 부채꼴
    const n = Math.max(6, Math.floor((r * arc) / dotGap));
    for (let i = 0; i <= n && dots.length < need; i += 1) {
      const a = Math.PI + (Math.PI - arc) / 2 + (arc * i) / n; // 아래를 비운 위쪽 부채꼴
      dots.push([cx + r * Math.cos(a), cy + r * Math.sin(a) * 0.72]);
    }
    r += dotGap;
  }
  return {dots, maxR: r};
};

export const SeatDotsCard = ({
  kicker = '', sub = '', arenas = [], perDot = 50, caption = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const enter = fadeIn(frame, 0, 14);
  const single = arenas.length <= 1;
  const scale = single ? 1 : 0.62;

  const layouts = useMemo(
    () =>
      arenas.map((a, i) => {
        const cx = single ? 960 : i === 0 ? 520 : 1400;
        const cy = single ? 620 : 600;
        return {...a, ...buildArena(a.count, perDot, cx, cy, scale), cx, cy};
      }),
    [arenas, perDot, single, scale]
  );

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperKicker title={kicker} sub={sub} theme={theme} opacity={enter} />

      {layouts.map((a, ai) => {
        const total = a.dots.length;
        // 도트가 무대에서부터 차오르는 진행률
        const lit = Math.floor(
          interpolate(frame, [12 + ai * 6, 78 + ai * 6], [0, total], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        );
        const hot = a.hot !== false; // 기본 옐로
        const dotR = single ? 8 : 5.5;
        return (
          <React.Fragment key={ai}>
            <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
              {/* 무대 */}
              <rect
                x={a.cx - 90 * scale} y={a.cy - 20 * scale}
                width={180 * scale} height={40 * scale}
                rx={6}
                fill="none" stroke={T.soft} strokeWidth={LW.HAIR}
                opacity={enter}
              />
              {a.dots.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x} cy={y} r={dotR}
                  fill={i < lit ? (hot ? YELLOW : T.tones[0]) : T.ink}
                  stroke={i < lit && hot ? T.ink : 'none'} strokeWidth={1.2}
                  opacity={i < lit ? 1 : 0.14}
                  style={i < lit && hot ? {filter: 'drop-shadow(0 0 4px rgba(250,255,46,0.6))'} : undefined}
                />
              ))}
            </svg>
            <div
              style={{
                position: 'absolute', left: a.cx - 350, top: single ? 760 : 738, width: 700,
                textAlign: 'center', opacity: fadeIn(frame, 30 + ai * 6),
              }}
            >
              <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 46, letterSpacing: '0.03em', color: T.ink, fontVariantNumeric: 'tabular-nums'}}>
                {a.label}
              </span>
              {a.subLabel ? (
                <span style={{marginLeft: 20, fontFamily: 'A2Z Light, sans-serif', fontSize: 30, letterSpacing: '0.04em', color: T.soft}}>
                  {a.subLabel}
                </span>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}

      {/* 범례 — 도트 하나의 의미 */}
      <div style={{position: 'absolute', right: 120, top: 100, display: 'flex', alignItems: 'center', gap: 14, opacity: fadeIn(frame, 24)}}>
        <div style={{width: 14, height: 14, borderRadius: '50%', background: YELLOW, border: `2px solid ${T.ink}`}} />
        <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 27, letterSpacing: '0.06em', color: T.soft}}>
          = {perDot.toLocaleString()}석
        </span>
      </div>
      <PaperCaption theme={theme} opacity={fadeIn(frame, 60)}>{caption}</PaperCaption>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
