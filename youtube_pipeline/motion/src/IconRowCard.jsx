import React from 'react';
import {AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, MediaBg} from './shared';

// 픽토그램 행 — Iconify 에서 미리 받아온 raw SVG 마크업(색은 이미 각
// 항목의 accent 로 구워져 있음)을 그대로 꽂아 넣는다. B1M 톤(§18)이라
// 글로우 없이, 항목별 순차 스프링 팝인만 준다. items: [{svg, label}].
//
// bgVideo/bgImage: 실사 위에 픽토그램을 얹는다(2026-07-29 "야스섬을
// 이미지로 얹어서 보여주고, 그 위에 픽토그램" 피드백). 사진 위에서도
// 읽히게 아이콘마다 살짝 어두운 받침 카드를 깐다.
export const IconRowCard = ({
  title = '', subtitle = '', items = [],
  bgVideo = '', bgImage = '', bgVideoStart = 0,
  framed = false, innerGap = null,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const hasMedia = Boolean(bgVideo || bgImage);

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const titleColor = framed ? '#1B1E22' : TEXT.title.color;
  const subtitleColor = framed ? '#3A3E44' : TEXT.label.color;
  const n = items.length || 1;
  const side = Math.min(220, Math.round(760 / n));
  const autoGap = (1920 - side * n) / (n + 1);
  // innerGap: 항목이 적을 때(2개) 기본 배치는 화면 가장자리 쪽으로 퍼지는데,
  // 값을 주면 아이콘 사이 간격만 좁혀 그룹을 화면 중앙으로 모은다
  // (2026-07-29 "#7 픽토그램 2개 중간으로 좀 더" 피드백).
  const gap = innerGap != null ? innerGap : autoGap;
  const startX = innerGap != null ? (1920 - (side * n + gap * (n - 1))) / 2 : autoGap;

  return (
    <AbsoluteFill style={hasMedia ? {backgroundColor: '#05070a'} : BG_STYLE}>
      {hasMedia ? (
        <MediaBg video={bgVideo} image={bgImage} videoStart={bgVideoStart} framed={framed} />
      ) : (
        <GridBg />
      )}
      <div
        style={{
          position: 'absolute', top: framed ? 52 : 90, left: 0, width: '100%', textAlign: 'center',
          fontSize: 42, opacity: titleOpacity, ...TEXT.title, color: titleColor,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            position: 'absolute', top: framed ? 100 : 150, left: 0, width: '100%', textAlign: 'center',
            fontSize: 32, opacity: titleOpacity, ...TEXT.label, color: subtitleColor,
          }}
        >
          {subtitle}
        </div>
      ) : null}

      {items.map((item, i) => {
        const startDelay = hasMedia ? 40 : 12;
        const pop = spring({frame: Math.max(0, frame - startDelay - i * 8), fps, config: {damping: 13, mass: 0.6}, durationInFrames: 20});
        const scale = interpolate(pop, [0, 1], [0.6, 1]);
        const opacity = interpolate(pop, [0, 1], [0, 1]);
        const x = startX + i * (side + gap);
        return (
          <div key={i} style={{position: 'absolute', top: 420, left: x, width: side, textAlign: 'center'}}>
            {hasMedia ? (
              <div
                style={{
                  position: 'absolute', top: -20, left: side / 2 - (side + 40) / 2,
                  width: side + 40, height: side + 80, borderRadius: 18,
                  background: 'rgba(6,8,10,0.42)', backdropFilter: 'blur(2px)',
                  opacity, transform: `scale(${scale})`,
                }}
              />
            ) : null}
            <div
              style={{width: side, height: side, opacity, transform: `scale(${scale})`, position: 'relative'}}
              dangerouslySetInnerHTML={{__html: item.svg}}
            />
            <div style={{marginTop: 22, fontSize: 36, opacity, position: 'relative', ...TEXT.value}}>{item.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
