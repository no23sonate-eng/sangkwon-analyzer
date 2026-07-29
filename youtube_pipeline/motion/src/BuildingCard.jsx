import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

// 아이소메트릭 빌딩 — pipeline/assets_lib.py 의 isometric_building_icon() 과
// 같은 등각(2:1) 기하 원리를 SVG로 재구현(진짜 그라디언트/그림자를 쓰기 위해).
const Building = ({scale, opacity, floors}) => {
  const floorLines = [];
  for (let i = 1; i < floors; i++) {
    const t = i / floors;
    const y1 = 180 + t * (520 - 180);
    const y2 = 120 + t * (460 - 120);
    floorLines.push(
      <line
        key={i}
        x1={210}
        y1={y1}
        x2={320}
        y2={y2}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1.4}
      />
    );
  }
  return (
    <svg
      width={420}
      height={520}
      viewBox="0 0 420 520"
      style={{
        filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.55))',
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center bottom',
      }}
    >
      <defs>
        <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3F6FC" />
          <stop offset="1" stopColor="#C9D6EC" />
        </linearGradient>
        <linearGradient id="right" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#D7E1F3" />
          <stop offset="1" stopColor="#A9BADA" />
        </linearGradient>
        <linearGradient id="left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8C9CC0" />
          <stop offset="1" stopColor="#69769A" />
        </linearGradient>
      </defs>
      <polygon points="210,60 320,120 210,180 100,120" fill="url(#top)" />
      <polygon points="210,180 320,120 320,460 210,520" fill="url(#right)" />
      <polygon points="210,180 100,120 100,460 210,520" fill="url(#left)" />
      <g>{floorLines}</g>
    </svg>
  );
};

export const BuildingCard = ({
  title = '',
  valuePrefix = '',
  valueTarget = 0,
  valueSuffix = '',
  floors = 8,
  accent = '#A9C6FF',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const iconIn = spring({frame, fps, config: {damping: 14, mass: 0.6}, durationInFrames: 24});
  const iconScale = interpolate(iconIn, [0, 1], [0.8, 1]);
  const iconOpacity = interpolate(iconIn, [0, 1], [0, 1]);

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const titleY = interpolate(frame, [0, 15], [12, 0], {extrapolateRight: 'clamp'});

  const countProgress = spring({
    frame: Math.max(0, frame - 20), fps, config: {damping: 200, mass: 1.4}, durationInFrames: 40,
  });
  const count = Math.round(interpolate(countProgress, [0, 1], [0, valueTarget]));
  const valueOpacity = interpolate(frame, [18, 26], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse 900px 700px at 50% 46%, #24304e 0%, #141c30 38%, #05070c 78%)',
        fontFamily: 'A2Z Medium, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute', top: 96, left: 0, width: '100%', textAlign: 'center',
          color: '#EEF2FA', fontSize: 44, opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {title}
      </div>

      <div
        style={{
          position: 'absolute', top: 380, left: 0, width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute', width: 620, height: 620, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(61,90,150,0.55) 0%, rgba(61,90,150,0.0) 70%)',
            filter: 'blur(6px)', opacity: iconOpacity,
          }}
        />
        <Building scale={iconScale} opacity={iconOpacity} floors={floors} />
      </div>

      <div
        style={{
          position: 'absolute', top: 900, left: 0, width: '100%', textAlign: 'center',
          color: accent, fontSize: 58, letterSpacing: '0.09em',
          textShadow: `0 0 30px ${accent}73`, opacity: valueOpacity,
        }}
      >
        {valuePrefix}{count}{valueSuffix}
      </div>
    </AbsoluteFill>
  );
};
