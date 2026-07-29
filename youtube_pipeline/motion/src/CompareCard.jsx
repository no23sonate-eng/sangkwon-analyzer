import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT} from './shared';

// 두 입장/두 항목을 좌우로 대비하는 카드 — 한쪽은 내용이 있고 한쪽은
// "확인되지 않음"류 공백일 때 비대칭이 시각적으로 드러난다(예: 하남시
// 설명 vs 스피어 측 공식 입장 미확인). leftLines/rightLines: string[].
// rightEmpty=true 면 오른쪽에 옅은 대시(—)와 emptyLabel 만 표시.
export const CompareCard = ({
  title = '',
  leftTitle = '',
  leftLines = [],
  rightTitle = '',
  rightLines = [],
  rightEmpty = false,
  emptyLabel = '확인되지 않음',
  leftValue = '',
  rightValue = '',
  caption = '',
  accent = ACCENT,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const leftOpacity = interpolate(frame, [16, 30], [0, 1], {extrapolateRight: 'clamp'});
  const rightOpacity = interpolate(frame, [34, 48], [0, 1], {extrapolateRight: 'clamp'});
  const captionOpacity = interpolate(frame, [40, 55], [0, 1], {extrapolateRight: 'clamp'});

  const COL_TOP = 320;
  const COL_W = 760;
  const GAP = 60;
  const LEFT_X = 1920 / 2 - GAP / 2 - COL_W;
  const RIGHT_X = 1920 / 2 + GAP / 2;

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

      {/* 중앙 구분선 */}
      <div
        style={{
          position: 'absolute', top: COL_TOP, left: 1920 / 2, width: 1,
          height: 420, background: 'rgba(255,255,255,0.12)',
        }}
      />

      <div style={{position: 'absolute', top: COL_TOP, left: LEFT_X, width: COL_W, opacity: leftOpacity}}>
        <div style={{fontSize: 26, marginBottom: 24, ...TEXT.label}}>{leftTitle}</div>
        {leftValue ? (
          <div style={{fontSize: 80, color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif'}}>{leftValue}</div>
        ) : null}
        {leftLines.map((line, i) => (
          <div
            key={i}
            style={{
              fontSize: 32, color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif',
              lineHeight: 1.6, marginBottom: 10,
            }}
          >
            {line}
          </div>
        ))}
      </div>

      <div style={{position: 'absolute', top: COL_TOP, left: RIGHT_X, width: COL_W, opacity: rightOpacity}}>
        <div style={{fontSize: 26, marginBottom: 24, ...TEXT.label}}>{rightTitle}</div>
        {rightValue ? (
          <div style={{fontSize: 80, color: accent, fontFamily: 'A2Z Regular, sans-serif'}}>{rightValue}</div>
        ) : null}
        {rightEmpty ? (
          <div>
            <div style={{fontSize: 56, color: '#4A4F57', fontFamily: 'A2Z Light, sans-serif'}}>—</div>
            <div style={{fontSize: 28, color: '#5C636D', fontFamily: 'A2Z Light, sans-serif', marginTop: 14}}>
              {emptyLabel}
            </div>
          </div>
        ) : (
          rightLines.map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: 32, color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif',
                lineHeight: 1.6, marginBottom: 10,
              }}
            >
              {line}
            </div>
          ))
        )}
      </div>

      {caption ? (
        <div
          style={{
            position: 'absolute', top: COL_TOP + 340, left: LEFT_X,
            fontSize: 20, color: '#565C64', fontFamily: 'A2Z Light, sans-serif', fontStyle: 'italic',
            opacity: captionOpacity,
          }}
        >
          {caption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
