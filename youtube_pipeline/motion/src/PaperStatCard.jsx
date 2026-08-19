import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {
  PaperSurface, PaperHead, Credit, Mark,
  PAPER, INK, INK2, HAIR, AMBER, P, M, SAFE_BOTTOM, fade,
} from './v4';
import {DrawPath, useCountUp, useRevealUp, EASE} from './anim';
import {interpolate} from 'remotion';

// v4 · 지면 빅넘버 — 밝은 도면 지면 위 검정 숫자.
// 강조는 발광이 아니라 (1) 앰버 규칙선 (2) 형광펜 마크 두 가지뿐.
export const PaperStatCard = ({
  eyebrow = '',
  title = '',
  label = '',
  valueTarget = 0,
  valueText = '',
  valueSuffix = '',
  decimals = 0,
  caption = '',
  markCaption = false, // 캡션에 형광펜
  note = '',
  credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const counted = useCountUp(valueTarget, 12, 46, decimals);
  const shown = valueText || counted;
  const labelIn = useRevealUp(8, 24, 22);
  const valueIn = useRevealUp(12, 30, 40);
  const capIn = useRevealUp(40, 26, 18);
  const markOn = interpolate(frame, [46, 70], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
  });

  const len = String(shown).length + valueSuffix.length;
  const size = len > 10 ? 165 : len > 7 ? 205 : 250;
  const numY = 356;

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} plot />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />

      {label ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: numY - 58, textAlign: 'center', ...labelIn}}>
          <span style={{...P.label, fontSize: 30}}>{label}</span>
        </div>
      ) : null}

      <div style={{position: 'absolute', left: 0, right: 0, top: numY, textAlign: 'center', ...valueIn}}>
        <span style={{...P.valueXL, fontSize: size}}>{shown}</span>
        <span style={{...P.valueXL, fontSize: size * 0.4, color: INK2, marginLeft: 12}}>{valueSuffix}</span>
      </div>

      {/* 앰버 규칙선 — 숫자 아래 중앙 */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <DrawPath
          d={`M 760 ${numY + size * 0.98} L 1160 ${numY + size * 0.98}`}
          start={26} dur={30} length={420} stroke={AMBER} strokeWidth={4}
        />
      </svg>

      {caption ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: numY + size * 0.98 + 36, textAlign: 'center', ...capIn}}>
          <span style={{...P.body, fontSize: 34}}>
            {markCaption ? <Mark on={markOn}>{caption}</Mark> : caption}
          </span>
        </div>
      ) : null}

      {note ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: SAFE_BOTTOM - 60, textAlign: 'center', opacity: fade(frame, 52)}}>
          <span style={P.caption}>{note}</span>
        </div>
      ) : null}

      <Credit text={credit} dark={false} opacity={fade(frame, 52)} />
    </AbsoluteFill>
  );
};
