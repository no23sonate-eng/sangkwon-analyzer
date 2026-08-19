import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {
  BLACK, YELLOW, WHITE, GRAY, MUTE, LINE, M, T,
  Canvas, Kicker, Footer, Haze, shapeGlow, fadeIn,
} from './v2shared';
import {DrawPath, EASE, stagger, useRevealUp} from './anim';

// 층 스택 선도면 (v3) — B1M "얇은 흰 선도면 + 치수선" 문법.
// 개선점: 층이 아래에서부터 와이프로 채워지고, 치수선은 실제로 그려지며,
// 강조 구간은 발광 대신 헤이즈 + 얇은 옐로 윤곽으로 처리.
export const FloorStackCard = ({
  kicker = '',
  sub = '',
  floors = [],
  dimension = null,
  caption = '',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const enter = fadeIn(frame, 0, 14);

  const n = floors.length || 1;
  const fh = Math.min(88, Math.round(500 / n));
  const bw = 560;
  const bx = M + 380; // 좌측에 치수 라벨이 들어갈 폭을 확보
  const baseY = 720;

  const hotIdx = floors.map((f, i) => (f.hot ? i : -1)).filter((i) => i >= 0);
  const hotTop = hotIdx.length ? baseY - (Math.max(...hotIdx) + 1) * fh : 0;
  const hotBottom = hotIdx.length ? baseY - Math.min(...hotIdx) * fh : 0;
  const dimIn = useRevealUp(stagger(n, 5, 22), 26, 16);

  return (
    <AbsoluteFill style={{background: BLACK}}>
      <Canvas />
      <Kicker title={kicker} sub={sub} opacity={enter} />

      {hotIdx.length ? (
        <div style={{opacity: fadeIn(frame, 16)}}>
          <Haze x={bx + bw / 2} y={(hotTop + hotBottom) / 2} r={430} opacity={0.075} />
        </div>
      ) : null}

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 지면선 — 그려지듯 */}
        <DrawPath d={`M ${bx - 150} ${baseY} L ${bx + bw + 330} ${baseY}`} start={2} dur={30} length={1200}
          stroke={LINE} strokeWidth={2} />

        {floors.map((f, i) => {
          const y = baseY - (i + 1) * fh;
          const hot = Boolean(f.hot);
          const t = interpolate(frame, [stagger(i, 5, 10), stagger(i, 5, 10) + 24], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
          });
          return (
            <g key={i}>
              {/* 층 판 — 좌→우로 열린다 */}
              <rect
                x={bx} y={y} width={bw * t} height={fh}
                fill={hot ? 'rgba(250,255,46,0.07)' : 'rgba(255,255,255,0.016)'}
              />
              <rect
                x={bx} y={y} width={bw * t} height={fh}
                fill="none"
                stroke={hot ? YELLOW : '#343A41'}
                strokeWidth={hot ? 2 : 1.2}
                style={hot ? {filter: shapeGlow(0.5)} : undefined}
              />
              {/* 슬래브 구분 — 얇은 선 */}
              {Array.from({length: 6}, (_, k) => (
                <line
                  key={k}
                  x1={bx + (bw / 7) * (k + 1)} y1={y + fh * 0.3}
                  x2={bx + (bw / 7) * (k + 1)} y2={y + fh * 0.74}
                  stroke={hot ? 'rgba(250,255,46,0.32)' : '#2A3037'} strokeWidth={1.2}
                  opacity={t}
                />
              ))}
            </g>
          );
        })}

        {/* 치수선 — 실제로 그려진다 */}
        {dimension && hotIdx.length ? (
          <g>
            <DrawPath d={`M ${bx - 58} ${hotBottom} L ${bx - 58} ${hotTop}`}
              start={stagger(n, 5, 18)} dur={26} length={600} stroke={WHITE} strokeWidth={1.8} />
            <line x1={bx - 72} y1={hotTop} x2={bx - 44} y2={hotTop} stroke={WHITE} strokeWidth={1.8} opacity={dimIn.opacity} />
            <line x1={bx - 72} y1={hotBottom} x2={bx - 44} y2={hotBottom} stroke={WHITE} strokeWidth={1.8} opacity={dimIn.opacity} />
          </g>
        ) : null}
      </svg>

      {/* 층 라벨 — 건물 우측, 우측 정렬 그리드 */}
      {floors.map((f, i) => {
        const y = baseY - (i + 1) * fh;
        const hot = Boolean(f.hot);
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: bx + bw + 40, top: y + fh / 2 - 19,
              display: 'flex', alignItems: 'center', gap: 16,
              opacity: fadeIn(frame, stagger(i, 5, 14)), whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                fontFamily: 'A2Z Medium, sans-serif', fontSize: 21, letterSpacing: '0.14em',
                color: hot ? YELLOW : '#565C64',
                border: `1.2px solid ${hot ? 'rgba(250,255,46,0.55)' : '#2E3238'}`,
                padding: '4px 9px 2px', borderRadius: 2,
              }}
            >
              {f.name}
            </span>
            <span style={{...T.label, fontSize: 28, color: hot ? WHITE : MUTE}}>{f.tenant}</span>
          </div>
        );
      })}

      {/* 치수 값 — 건물 좌측, 우측 정렬 */}
      {dimension && hotIdx.length ? (
        <div
          style={{
            position: 'absolute', left: M, width: bx - 96 - M, top: (hotTop + hotBottom) / 2 - 50,
            textAlign: 'right', whiteSpace: 'nowrap', ...dimIn,
          }}
        >
          <div style={{...T.valueM, fontSize: 68}}>{dimension.label}</div>
          {dimension.sub ? <div style={{marginTop: 8, ...T.caption, fontSize: 26}}>{dimension.sub}</div> : null}
        </div>
      ) : null}

      <Footer caption={caption} source={source} opacity={fadeIn(frame, stagger(n, 5, 26))} />
    </AbsoluteFill>
  );
};
