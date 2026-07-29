import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

// B1M 실측 레퍼런스(2026-07-29, 다크 그리드 + 3D 건물 비교 장면) 분석 결과:
// 화려한 글로우/네온이 아니라 "제도 도면" 톤 — 짙은 차콜 배경에 옅은 격자,
// 채도 낮은(desaturated) 회색조 매스, 그림자도 아주 은은하게만. 배경에
// 얇은 격자를 깔아 "빈 배경" 느낌을 없앤다(레퍼런스의 청사진 그리드 참고).
const GridBg = () => {
  const lines = [];
  const step = 80;
  for (let x = step; x < 1920; x += step) {
    lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={1080} />);
  }
  for (let y = step; y < 1080; y += step) {
    lines.push(<line key={`h${y}`} x1={0} y1={y} x2={1920} y2={y} />);
  }
  return (
    <svg
      width={1920} height={1080}
      style={{position: 'absolute', top: 0, left: 0}}
    >
      <g stroke="rgba(255,255,255,0.05)" strokeWidth={1}>{lines}</g>
    </svg>
  );
};

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
        stroke="rgba(0,0,0,0.28)"
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
        filter: 'drop-shadow(0 18px 22px rgba(0,0,0,0.4))',
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center bottom',
      }}
    >
      <defs>
        <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E7E9ED" />
          <stop offset="1" stopColor="#C3C7CF" />
        </linearGradient>
        <linearGradient id="right" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#B7BBC3" />
          <stop offset="1" stopColor="#8E939D" />
        </linearGradient>
        <linearGradient id="left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6B707A" />
          <stop offset="1" stopColor="#54585F" />
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
        background: 'linear-gradient(180deg, #15171b 0%, #0a0b0d 100%)',
        fontFamily: 'A2Z Medium, sans-serif',
      }}
    >
      <GridBg />
      <div
        style={{
          position: 'absolute', top: 96, left: 0, width: '100%', textAlign: 'center',
          color: '#C7CBD3', fontSize: 36, opacity: titleOpacity,
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
        <Building scale={iconScale} opacity={iconOpacity} floors={floors} />
      </div>

      <div
        style={{
          position: 'absolute', top: 890, left: 0, width: '100%', textAlign: 'center',
          opacity: valueOpacity,
        }}
      >
        <div
          style={{
            display: 'inline-block', color: '#EDEFF3', fontSize: 46, letterSpacing: '0.06em',
          }}
        >
          {valuePrefix}{count}{valueSuffix}
        </div>
        <div style={{width: 64, height: 2, background: accent, margin: '14px auto 0'}} />
      </div>
    </AbsoluteFill>
  );
};
