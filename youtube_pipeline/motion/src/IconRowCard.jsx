import React from 'react';
import {AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT} from './shared';

// 픽토그램 행 — Iconify 에서 미리 받아온 raw SVG 마크업(색은 이미 각
// 항목의 accent 로 구워져 있음)을 그대로 꽂아 넣는다. B1M 톤(§18)이라
// 글로우 없이, 항목별 순차 스프링 팝인만 준다. items: [{svg, label}].
export const IconRowCard = ({title = '', subtitle = '', items = []}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const n = items.length || 1;
  const side = Math.min(220, Math.round(760 / n));
  const gap = (1920 - side * n) / (n + 1);

  return (
    <AbsoluteFill style={BG_STYLE}>
      <GridBg />
      <div
        style={{
          position: 'absolute', top: 90, left: 0, width: '100%', textAlign: 'center',
          fontSize: 34, opacity: titleOpacity, ...TEXT.title,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            position: 'absolute', top: 150, left: 0, width: '100%', textAlign: 'center',
            fontSize: 20, opacity: titleOpacity, ...TEXT.label,
          }}
        >
          {subtitle}
        </div>
      ) : null}

      {items.map((item, i) => {
        const pop = spring({frame: Math.max(0, frame - 12 - i * 8), fps, config: {damping: 13, mass: 0.6}, durationInFrames: 20});
        const scale = interpolate(pop, [0, 1], [0.6, 1]);
        const opacity = interpolate(pop, [0, 1], [0, 1]);
        const x = gap * (i + 1) + side * i;
        return (
          <div key={i} style={{position: 'absolute', top: 420, left: x, width: side, textAlign: 'center'}}>
            <div
              style={{width: side, height: side, opacity, transform: `scale(${scale})`}}
              dangerouslySetInnerHTML={{__html: item.svg}}
            />
            <div style={{marginTop: 22, fontSize: 26, opacity, ...TEXT.value}}>{item.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
