import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT} from './shared';

// 로고 조직도 — "A는 B와 C를 거느린 그룹입니다" 류 문장을 그림으로.
// 부모 로고가 위 중앙, 자회사 로고가 그 아래 좌우로. 실제 로고는 배경색이
// 제각각이라 흰 칩 위에 얹어 항상 또렷하게 보이게 한다.
// opacity 를 밖에서 주면(DataTable intro 단계처럼) 전체를 크로스페이드로
// 끼워넣을 수 있다.
export const OrgDiagram = ({parentLogo, parentLabel, children = [], frame: frameOverride, opacity = 1}) => {
  const localFrame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frame = frameOverride ?? localFrame;

  const parentPop = spring({frame, fps, config: {damping: 13, mass: 0.6}, durationInFrames: 20});
  const parentScale = interpolate(parentPop, [0, 1], [0.7, 1]);
  const parentOpacity = interpolate(parentPop, [0, 1], [0, 1]);
  const lineOpacity = interpolate(frame, [16, 30], [0, 1], {extrapolateRight: 'clamp'});

  const PARENT_W = 300;
  const PARENT_H = 150;
  const CHILD_W = 230;
  const CHILD_H = 120;
  const CX = 1920 / 2;
  const PARENT_TOP = 260;
  const CHILD_TOP = 560;
  const CHILD_GAP = 300;

  const chip = {
    background: '#F4F1EC', borderRadius: 14,
    boxShadow: '0 20px 44px rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity}}>
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, opacity: lineOpacity}}>
        <path
          d={`M ${CX} ${PARENT_TOP + PARENT_H} V ${PARENT_TOP + PARENT_H + 55} M ${CX - CHILD_GAP} ${CHILD_TOP} H ${CX + CHILD_GAP} M ${CX - CHILD_GAP} ${CHILD_TOP} V ${PARENT_TOP + PARENT_H + 55} M ${CX + CHILD_GAP} ${CHILD_TOP} V ${PARENT_TOP + PARENT_H + 55}`}
          stroke="rgba(255,255,255,0.28)" strokeWidth={2} fill="none"
        />
      </svg>

      <div
        style={{
          position: 'absolute', top: PARENT_TOP, left: CX - PARENT_W / 2, width: PARENT_W, height: PARENT_H,
          opacity: parentOpacity, transform: `scale(${parentScale})`, ...chip,
        }}
      >
        <Img src={staticFile(parentLogo)} style={{width: '78%', height: '68%', objectFit: 'contain'}} />
      </div>
      {parentLabel ? (
        <div
          style={{
            position: 'absolute', top: PARENT_TOP + PARENT_H + 14, left: CX - PARENT_W / 2, width: PARENT_W,
            textAlign: 'center', fontSize: 24, opacity: parentOpacity, ...TEXT.value,
          }}
        >
          {parentLabel}
        </div>
      ) : null}

      {children.map((child, i) => {
        const x = CX + (i === 0 ? -CHILD_GAP : CHILD_GAP);
        const childPop = spring({frame: Math.max(0, frame - 26 - i * 6), fps, config: {damping: 13, mass: 0.6}, durationInFrames: 18});
        const childScale = interpolate(childPop, [0, 1], [0.7, 1]);
        const childOpacity = interpolate(childPop, [0, 1], [0, 1]);
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute', top: CHILD_TOP, left: x - CHILD_W / 2, width: CHILD_W, height: CHILD_H,
                opacity: childOpacity, transform: `scale(${childScale})`, ...chip,
              }}
            >
              <Img src={staticFile(child.logo)} style={{width: '76%', height: '64%', objectFit: 'contain'}} />
            </div>
            <div
              style={{
                position: 'absolute', top: CHILD_TOP + CHILD_H + 14, left: x - CHILD_W / 2, width: CHILD_W,
                textAlign: 'center', fontSize: 22, opacity: childOpacity, ...TEXT.label,
              }}
            >
              {child.label}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// 독립 카드로도 쓸 수 있게 등록 — 기본 배경/타이틀 포함.
export const LogoOrgCard = ({title = '', subtitle = '', parentLogo = '', parentLabel = '', children = []}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
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
            position: 'absolute', top: 140, left: 0, width: '100%', textAlign: 'center',
            fontSize: 20, opacity: titleOpacity, ...TEXT.label,
          }}
        >
          {subtitle}
        </div>
      ) : null}
      <OrgDiagram parentLogo={parentLogo} parentLabel={parentLabel} children={children} />
    </AbsoluteFill>
  );
};
