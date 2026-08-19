import React from 'react';
import {useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT, MediaBg, TEXT_SHADOW} from './shared';

// 숫자 하나가 주인공인 카드 — 금액/개소/연도 등 단일 지표 강조.
// 문장이 길어(카드 지속시간이 김) 사실이 두 단계로 나뉠 때는
// value2/subtitle2 를 주면 전체 길이의 절반 지점 즈음에 2단계로
// 전환되어, 긴 시간 동안 화면이 죽어있지 않게 한다.
//
// bgVideo/bgImage: motion/public/ 기준 상대경로를 주면 합성 배경(그리드+
// 그라디언트) 대신 실사를 배경으로 깔고 그 위에 통계를 얹는다(B1M
// 레퍼런스, 2026-07-29 "#0 영상을 #1 배경으로" 피드백). bgInset=true 면
// 전체화면이 아니라 화면 중앙에 작게(포인트 컷처럼) 배치한다(#9 "돈 내는
// 영상" 피드백 — 전체 배경 말고 중앙에).
export const StatCard = ({
  title = '',
  value = '',
  subtitle = '',
  caption = '',
  value2 = '',
  subtitle2 = '',
  accent = ACCENT,
  bgVideo = '',
  bgImage = '',
  bgVideoStart = 0,
  bgInset = false,
  framed = false,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const hasMedia = Boolean(bgVideo || bgImage);

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const titleY = interpolate(frame, [0, 15], [12, 0], {extrapolateRight: 'clamp'});

  const valueIn = spring({frame: Math.max(0, frame - 10), fps, config: {damping: 16, mass: 0.7}, durationInFrames: 22});
  const valueOpacity = interpolate(valueIn, [0, 1], [0, 1]);
  const valueScale = interpolate(valueIn, [0, 1], [0.9, 1]);

  const subOpacity = interpolate(frame, [26, 38], [0, 1], {extrapolateRight: 'clamp'});
  const insetOpacity = interpolate(frame, [30, 46], [0, 1], {extrapolateRight: 'clamp'});

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
    <AbsoluteFill style={hasMedia ? {backgroundColor: '#05070a'} : BG_STYLE}>
      {hasMedia ? (
        <div style={{opacity: bgInset ? insetOpacity : 1}}>
          <MediaBg video={bgVideo} image={bgImage} videoStart={bgVideoStart} inset={bgInset} overlay framed={framed} />
        </div>
      ) : (
        <GridBg />
      )}
      <div
        style={{
          position: 'absolute', top: 90, left: 0, width: '100%', textAlign: 'center',
          fontSize: 44, opacity: titleOpacity, transform: `translateY(${titleY}px)`,
          ...TEXT.title, color: framed ? '#1B1E22' : TEXT.title.color,
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
        <div style={{fontSize: hasMedia && !bgInset && !framed ? 104 : 96, ...TEXT.value,
                      ...(hasMedia && !bgInset && !framed ? {textShadow: TEXT_SHADOW} : {})}}>{value}</div>
      </div>

      <div
        style={{
          position: 'absolute', top: 610, left: 0, width: '100%', textAlign: 'center',
          fontSize: 46, opacity: subOpacity * stage1Opacity, ...TEXT.label,
          ...(hasMedia && !bgInset && !framed ? {color: '#FFFFFF', textShadow: TEXT_SHADOW} : {}),
        }}
      >
        {subtitle}
      </div>

      {caption ? (
        <div
          style={{
            position: 'absolute', top: 692, left: 0, width: '100%', textAlign: 'center',
            fontSize: 34, fontFamily: 'A2Z Regular, sans-serif',
            ...(hasMedia && !bgInset && !framed ? {color: '#E4E8ED', textShadow: TEXT_SHADOW} : {color: '#6B7280'}),
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
            <div style={{fontSize: hasMedia && !bgInset && !framed ? 104 : 96, ...TEXT.value,
                          ...(hasMedia && !bgInset && !framed ? {textShadow: TEXT_SHADOW} : {})}}>{value2}</div>
          </div>
          <div
            style={{
              position: 'absolute', top: 610, left: 0, width: '100%', textAlign: 'center',
              fontSize: 46, opacity: stage2Opacity, ...TEXT.label,
              ...(hasMedia && !bgInset && !framed ? {color: '#FFFFFF', textShadow: TEXT_SHADOW} : {}),
            }}
          >
            {subtitle2}
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
