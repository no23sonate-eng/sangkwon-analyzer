import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT} from './shared';

// 숫자 하나가 주인공인 카드 — 금액/개소/연도 등 단일 지표 강조.
// 문장이 길어(카드 지속시간이 김) 사실이 두 단계로 나뉠 때는
// value2/subtitle2 를 주면 전체 길이의 절반 지점 즈음에 2단계로
// 전환되어, 긴 시간 동안 화면이 죽어있지 않게 한다.
export const StatCard = ({
  title = '',
  value = '',
  subtitle = '',
  caption = '',
  value2 = '',
  subtitle2 = '',
  accent = ACCENT,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const titleY = interpolate(frame, [0, 15], [12, 0], {extrapolateRight: 'clamp'});

  const valueIn = spring({frame: Math.max(0, frame - 10), fps, config: {damping: 16, mass: 0.7}, durationInFrames: 22});
  const valueOpacity = interpolate(valueIn, [0, 1], [0, 1]);
  const valueScale = interpolate(valueIn, [0, 1], [0.9, 1]);

  const subOpacity = interpolate(frame, [26, 38], [0, 1], {extrapolateRight: 'clamp'});

  // 2단계 전환 — durationInFrames 의 48% 지점에서 시작해 부드럽게 크로스페이드.
  const stage2Start = Math.round(durationInFrames * 0.48);
  const hasStage2 = Boolean(value2);
  const stage1Opacity = hasStage2
    ? interpolate(frame, [stage2Start, stage2Start + 12], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 1;
  const stage2Opacity = hasStage2
    ? interpolate(frame, [stage2Start + 6, stage2Start + 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;
  const stage2Scale = interpolate(stage2Opacity, [0, 1], [0.94, 1]);

  return (
    <AbsoluteFill style={BG_STYLE}>
      <GridBg />
      <div
        style={{
          position: 'absolute', top: 90, left: 0, width: '100%', textAlign: 'center',
          fontSize: 34, opacity: titleOpacity, transform: `translateY(${titleY}px)`, ...TEXT.title,
        }}
      >
        {title}
      </div>

      <div
        style={{
          position: 'absolute', top: 430, left: 0, width: '100%', textAlign: 'center',
          opacity: valueOpacity * stage1Opacity, transform: `scale(${valueScale})`,
        }}
      >
        <div style={{fontSize: 96, ...TEXT.value}}>{value}</div>
        <div style={{width: 84, height: 2, background: accent, margin: '22px auto 0'}} />
      </div>

      <div
        style={{
          position: 'absolute', top: 610, left: 0, width: '100%', textAlign: 'center',
          fontSize: 30, opacity: subOpacity * stage1Opacity, ...TEXT.label,
        }}
      >
        {subtitle}
      </div>

      {caption ? (
        <div
          style={{
            position: 'absolute', top: 670, left: 0, width: '100%', textAlign: 'center',
            fontSize: 22, color: '#5C636D', fontFamily: 'A2Z Light, sans-serif',
            opacity: subOpacity * stage1Opacity,
          }}
        >
          {caption}
        </div>
      ) : null}

      {hasStage2 ? (
        <>
          <div
            style={{
              position: 'absolute', top: 430, left: 0, width: '100%', textAlign: 'center',
              opacity: stage2Opacity, transform: `scale(${stage2Scale})`,
            }}
          >
            <div style={{fontSize: 96, ...TEXT.value}}>{value2}</div>
            <div style={{width: 84, height: 2, background: accent, margin: '22px auto 0'}} />
          </div>
          <div
            style={{
              position: 'absolute', top: 610, left: 0, width: '100%', textAlign: 'center',
              fontSize: 30, opacity: stage2Opacity, ...TEXT.label,
            }}
          >
            {subtitle2}
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
