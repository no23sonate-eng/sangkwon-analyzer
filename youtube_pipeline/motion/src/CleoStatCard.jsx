import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {
  BLACK, YELLOW, WHITE, GRAY, MUTE, LINE, M, SAFE_BOTTOM_Y,
  T, Canvas, Kicker, Haze, shapeGlow, fadeIn, useDrift,
} from './v2shared';
import {DrawPath, Wipe, useCountUp, useRevealUp, stagger, EASE} from './anim';
import {interpolate} from 'remotion';

// 빅넘버 카드 (v3) — 숫자 하나가 주인공.
// 개선점: 라벨↔숫자 크기 격차 확대, 큰 숫자 자간 음수, 글자 발광 제거,
// 숫자 뒤 헤이즈로 존재감, 좌측 규칙선으로 그리드 고정, 상시 드리프트.
export const CleoStatCard = ({
  kicker = '',
  label = '',
  valueTarget = 0,
  valueSuffix = '',
  valueText = '',
  decimals = 1,
  caption = '',
  bars = [],
  source = '',
  bgImage = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const drift = useDrift(5, 520);
  const enter = fadeIn(frame, 0, 14);
  const counted = useCountUp(valueTarget, 10, 46, decimals);
  const shown = valueText || counted;
  const labelIn = useRevealUp(6, 24, 26);
  const valueIn = useRevealUp(10, 30, 46);
  const capIn = useRevealUp(38, 26, 20);

  // 숫자 길이에 따라 크기를 낮춰 화면 밖으로 나가지 않게
  const len = String(shown).length + valueSuffix.length;
  const size = len > 10 ? 190 : len > 7 ? 240 : 300;

  const numX = M;
  const numY = 330;

  return (
    <AbsoluteFill style={{background: BLACK}}>
      {bgImage ? (
        <>
          <Img src={staticFile(bgImage)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.04 + (drift.scale - 1) * 6})`}} />
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,9,11,.86) 0%, rgba(8,9,11,.62) 45%, rgba(8,9,11,.92) 100%)'}} />
        </>
      ) : (
        <Canvas />
      )}

      <Kicker title={kicker} opacity={enter} />

      {/* 숫자 뒤 헤이즈 — 텍스트 발광 대신 */}
      <div style={{opacity: enter * 0.9}}>
        <Haze x={numX + size * 0.9} y={numY + size * 0.42} r={520} opacity={0.085} />
      </div>

      {/* 좌측 세로 규칙선 — 그리드를 눈에 보이게 잡아준다 */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <DrawPath
          d={`M ${M - 34} ${numY - 40} L ${M - 34} ${numY + size * 0.62}`}
          start={4} dur={30} length={600}
          stroke={YELLOW} strokeWidth={3}
        />
      </svg>

      <div style={{position: 'absolute', left: numX, top: numY - 78, ...labelIn}}>
        <span style={{...T.label, fontSize: 40, color: WHITE, letterSpacing: '0.06em'}}>{label}</span>
      </div>

      <div style={{position: 'absolute', left: numX, top: numY, ...valueIn}}>
        <span style={{...T.valueXL, fontSize: size, color: WHITE}}>{shown}</span>
        <span style={{...T.valueXL, fontSize: size * 0.42, color: YELLOW, marginLeft: 14, letterSpacing: '-0.01em'}}>
          {valueSuffix}
        </span>
      </div>

      {caption ? (
        <div style={{position: 'absolute', left: numX, top: numY + size * 1.06, ...capIn}}>
          <div style={{...T.body, fontSize: 38, color: GRAY}}>{caption}</div>
        </div>
      ) : null}

      {/* 우측 보조 막대 — 있을 때만, 강조 1개 외에는 전부 무채색 */}
      {bars.length ? (
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          {bars.map((b, i) => {
            const maxV = Math.max(...bars.map((x) => x.value), 1);
            const bw = 104;
            const gap = 74;
            const x = 1920 - M - bars.length * bw - (bars.length - 1) * gap + i * (bw + gap);
            const grow = interpolate(frame, [stagger(i, 6, 16), stagger(i, 6, 16) + 30], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
            });
            const h = (b.value / maxV) * 320 * grow;
            const yTop = 640 - h;
            return (
              <g key={b.name}>
                <rect
                  x={x} y={yTop} width={bw} height={h} rx={3}
                  fill={b.hot ? YELLOW : '#3A3E44'}
                  style={b.hot ? {filter: shapeGlow(0.8)} : undefined}
                />
                <text x={x + bw / 2} y={yTop - 20} textAnchor="middle" fill={b.hot ? WHITE : GRAY}
                  style={{...T.valueS, fontSize: 33}} opacity={grow}>{b.display}</text>
                <text x={x + bw / 2} y={676} textAnchor="middle" fill={b.hot ? GRAY : MUTE}
                  style={{...T.caption, fontSize: 26}} opacity={grow}>{b.name}</text>
              </g>
            );
          })}
          <line x1={1920 - M - 700} y1={644} x2={1920 - M} y2={644} stroke={LINE} strokeWidth={1.5} opacity={enter} />
        </svg>
      ) : null}

      {source ? (
        <div style={{position: 'absolute', left: M, top: SAFE_BOTTOM_Y - 44, opacity: fadeIn(frame, 46)}}>
          <span style={T.caption}>{source}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
