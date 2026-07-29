import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT} from './shared';

// 두 입장/두 항목을 좌우로 대비하는 카드 — 한쪽은 내용이 있고 한쪽은
// "확인되지 않음"류 공백일 때 비대칭이 시각적으로 드러난다(예: 하남시
// 설명 vs 스피어 측 공식 입장 미확인). leftLines/rightLines: string[].
// rightEmpty=true 면 오른쪽에 옅은 대시(—)와 emptyLabel 만 표시.
//
// leftImage/rightImage: 각 절반을 실사 배경으로 채우고(다크 오버레이)
// 그 위에 텍스트를 얹는다(2026-07-29 "미국은 이미지 위에, 런던도 이미지
// 얹어서 무산됐다는걸로" 피드백) — 화면을 절반씩 실제 사진으로 나눠
// 대비가 더 뚜렷해지게.
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
  leftImage = '',
  rightImage = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const leftOpacity = interpolate(frame, [16, 30], [0, 1], {extrapolateRight: 'clamp'});
  const rightOpacity = interpolate(frame, [34, 48], [0, 1], {extrapolateRight: 'clamp'});
  const captionOpacity = interpolate(frame, [40, 55], [0, 1], {extrapolateRight: 'clamp'});
  const imageOpacity = interpolate(frame, [0, 24], [0, 1], {extrapolateRight: 'clamp'});

  const COL_TOP = 370;
  const COL_W = 760;
  const GAP = 60;
  const LEFT_X = 1920 / 2 - GAP / 2 - COL_W;
  const RIGHT_X = 1920 / 2 + GAP / 2;

  const overlayStyle = {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    background: 'linear-gradient(180deg, rgba(5,7,10,.68) 0%, rgba(5,7,10,.7) 60%, rgba(5,7,10,.88) 100%)',
  };
  const hasImage = Boolean(leftImage || rightImage);
  // 사진의 밝은 하늘 위에 텍스트가 얹힐 때도 항상 읽히도록, 오버레이
  // 그라디언트만으로는 부족해 텍스트 블록 뒤에 별도 받침 패널을 깐다.
  const textPanel = {
    position: 'absolute', top: -28, left: -30, width: COL_W + 60, height: 360,
    borderRadius: 16, background: 'rgba(5,7,10,0.5)', backdropFilter: 'blur(1px)',
  };

  return (
    <AbsoluteFill style={BG_STYLE}>
      {!leftImage && !rightImage ? <GridBg /> : null}
      {leftImage ? (
        <div style={{position: 'absolute', top: 0, left: 0, width: 960, height: 1080, opacity: imageOpacity, overflow: 'hidden'}}>
          <Img src={staticFile(leftImage)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          <div style={overlayStyle} />
        </div>
      ) : null}
      {rightImage ? (
        <div style={{position: 'absolute', top: 0, left: 960, width: 960, height: 1080, opacity: imageOpacity, overflow: 'hidden'}}>
          <Img src={staticFile(rightImage)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          <div style={overlayStyle} />
        </div>
      ) : null}
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
        {hasImage ? <div style={textPanel} /> : null}
        <div style={{position: 'relative', fontSize: 26, marginBottom: 24, ...TEXT.label}}>{leftTitle}</div>
        {leftValue ? (
          <div style={{position: 'relative', fontSize: 80, color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif'}}>{leftValue}</div>
        ) : null}
        {leftLines.map((line, i) => (
          <div
            key={i}
            style={{
              position: 'relative', fontSize: 32, color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif',
              lineHeight: 1.6, marginBottom: 10,
            }}
          >
            {line}
          </div>
        ))}
      </div>

      <div style={{position: 'absolute', top: COL_TOP, left: RIGHT_X, width: COL_W, opacity: rightOpacity}}>
        {hasImage ? <div style={textPanel} /> : null}
        <div style={{position: 'relative', fontSize: 26, marginBottom: 24, ...TEXT.label}}>{rightTitle}</div>
        {rightValue ? (
          <div style={{position: 'relative', fontSize: 80, color: accent, fontFamily: 'A2Z Regular, sans-serif'}}>{rightValue}</div>
        ) : null}
        {rightEmpty ? (
          <div style={{position: 'relative'}}>
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
                position: 'relative', fontSize: 32, color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif',
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
