import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, glow, fadeIn, Kicker, Footer, Canvas, shapeGlow, T} from './v2shared';

// 개수를 아이콘 개수로 보여주는 카드 (§21 기본층).
// "한 상권에 매장이 N개" 처럼 수가 적을 때 — 블록/도트보다 대상이 무엇인지
// 바로 읽히게 픽토그램을 실제 개수만큼 놓는다. 하나만 hotIndex 로 강조 가능.
const PinIcon = ({size = 1, color, glowOn}) => (
  <svg width={92 * size} height={116 * size} viewBox="0 0 92 116">
    {/* 지도 핀 + 안쪽 매장 창문 — 얇은 선 스타일(B1M 선도면 톤) */}
    <path
      d="M46 6 C25 6 8 23 8 44 C8 72 46 110 46 110 C46 110 84 72 84 44 C84 23 67 6 46 6 Z"
      fill="none" stroke={color} strokeWidth={4}
      style={glowOn ? {filter: shapeGlow(0.7)} : undefined}
    />
    <rect x={28} y={30} width={36} height={26} fill="none" stroke={color} strokeWidth={3.5} />
    <line x1={28} y1={40} x2={64} y2={40} stroke={color} strokeWidth={3} />
  </svg>
);

export const IconCountCard = ({
  kicker = '',
  sub = '',
  count = 6,
  label = '',
  hotIndex = -1, // 특정 하나만 옐로로 강조 (없으면 전부 옐로)
  caption = '',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = fadeIn(frame, 0, 14);

  const cols = count <= 6 ? count : Math.ceil(count / 2);
  const rows = Math.ceil(count / cols);
  const cell = count <= 6 ? 250 : 190;
  const size = count <= 6 ? 1.25 : 0.95;
  const gridW = cols * cell;
  const startX = (1920 - gridW) / 2;
  const startY = 300;

  // 숫자는 아이콘이 다 놓인 뒤에 뜬다 (형태 → 숫자 순서)
  const shown = Math.floor(
    interpolate(frame, [14, 14 + count * 8], [0, count], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    })
  );

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      <Canvas />
      <Kicker title={kicker} sub={sub} opacity={enter} />

      {Array.from({length: count}, (_, i) => {
        const pop = spring({frame: frame - 14 - i * 8, fps, config: {damping: 200}, durationInFrames: 20});
        const on = i < shown || pop > 0.05;
        const isHot = hotIndex < 0 ? true : i === hotIndex;
        const col = !on ? '#242424' : isHot ? YELLOW : '#5A5A5A';
        const x = startX + (i % cols) * cell + (cell - 92 * size) / 2;
        const y = startY + Math.floor(i / cols) * (cell * 0.92);
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, opacity: 0.25 + 0.75 * pop, transform: `scale(${0.85 + 0.15 * pop})`}}>
            <PinIcon size={size} color={col} glowOn={on && isHot} />
          </div>
        );
      })}

      {/* 개수 — 아이콘 아래 중앙, 화이트(옐로는 아이콘이 담당) */}
      <div
        style={{
          position: 'absolute', left: 0, width: 1920,
          top: startY + rows * (cell * 0.92) + 34,
          textAlign: 'center', opacity: fadeIn(frame, 14 + count * 8),
        }}
      >
        <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 132, color: WHITE, letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums'}}>
          {shown}
        </span>
        {label ? (
          <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 58, color: WHITE, marginLeft: 14}}>
            {label}
          </span>
        ) : null}
      </div>

      <Footer caption={caption} source={source} opacity={fadeIn(frame, 20 + count * 8)} />
    </AbsoluteFill>
  );
};
