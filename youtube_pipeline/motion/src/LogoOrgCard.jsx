import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, CONTENT_BOTTOM, SP, LW, stageTop} from './paper';

// 로고 조직도 — "A는 B와 C를 거느린 그룹입니다" 류 문장을 그림으로.
// 부모 로고가 위 중앙, 자회사 로고가 그 아래 좌우로. 실제 로고는 배경색이
// 제각각이라 흰 칩 위에 얹어 항상 또렷하게 보이게 한다.
// opacity 를 밖에서 주면(DataTable intro 단계처럼) 전체를 크로스페이드로
// 끼워넣을 수 있다.
export const OrgDiagram = ({parentLogo, parentLabel, children = [], items = null,
                           theme, frame: frameOverride, opacity = 1, top = 232}) => {
  const T = themeOf(theme);
  // 데이터를 `children` 으로 받던 카드다. React 예약 이름이라 props 껍데기를
  // 자동으로 읽을 때 통째로 빠진다 — `items` 를 정식 이름으로 두고
  // `children` 은 이미 쓰인 컷을 위해 남긴다
  const kids = (items && items.length ? items : children) || [];
  const localFrame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frame = frameOverride ?? localFrame;

  const parentPop = spring({frame, fps, config: {damping: 13, mass: 0.6}, durationInFrames: 20});
  const parentScale = interpolate(parentPop, [0, 1], [0.7, 1]);
  const parentOpacity = interpolate(parentPop, [0, 1], [0, 1]);
  const lineOpacity = interpolate(frame, [16, 30], [0, 1], {extrapolateRight: 'clamp'});

  // 상자를 키웠다 (2026-08-26). 300×150 은 1920 화면에서 작아 보이고,
  // 로고가 상자 안에서 다시 78% 로 줄어드니 실제 로고는 234px 밖에 안 됐다.
  const PARENT_W = 500;
  const PARENT_H = 232;
  const CHILD_W = 430;
  const CHILD_H = 216;
  const CX = 1920 / 2;
  const PARENT_TOP = top;
  const CHILD_TOP = PARENT_TOP + 380;
  const CHILD_GAP = 340;
  const BRANCH_Y = PARENT_TOP + PARENT_H + 55; // 부모-자식 사이 분기점

  // 로고는 배경색이 제각각이라 흰 칩 위에 얹어야 항상 또렷하다.
  // 종이 무대에서도 마찬가지다 — 크림 위에 흰 칩이면 경계가 살짝 서고,
  // 그 경계가 '가져다 붙인 로고' 라는 표시가 된다
  const chip = {
    background: '#FFFFFF', borderRadius: 4,
    boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
    border: `1px solid ${T.ink}22`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity}}>
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, opacity: lineOpacity}}>
        {/* 부모→분기점→자식 순서로 내려가야 하는데 가로선을 자식 박스
            상단(CHILD_TOP)에 그려서 자식과 겹쳐 보이던 버그(2026-07-29
            "가로 획 라인이 아래로 내려가 있어" 피드백) — 분기점(BRANCH_Y)에서
            가로로 갈라진 뒤 그 아래로 내려가야 자연스럽다. */}
        <path
          d={`M ${CX} ${PARENT_TOP + PARENT_H} V ${BRANCH_Y} M ${CX - CHILD_GAP} ${BRANCH_Y} H ${CX + CHILD_GAP} M ${CX - CHILD_GAP} ${BRANCH_Y} V ${CHILD_TOP} M ${CX + CHILD_GAP} ${BRANCH_Y} V ${CHILD_TOP}`}
          stroke={T.ink} strokeWidth={LW.THIN} opacity={0.45} fill="none"
        />
      </svg>

      <div
        style={{
          position: 'absolute', top: PARENT_TOP, left: CX - PARENT_W / 2, width: PARENT_W, height: PARENT_H,
          opacity: parentOpacity, transform: `scale(${parentScale})`, ...chip,
        }}
      >
        {parentLogo ? (
          <Img src={/^https?:/.test(parentLogo) ? parentLogo : staticFile(parentLogo)}
               style={{width: '78%', height: '68%', objectFit: 'contain'}} />
        ) : (
          <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 56, color: '#242830',
                        letterSpacing: '-0.01em'}}>
            {parentLabel || '\u00A0'}
          </span>
        )}
      </div>
      {parentLabel && parentLogo ? (
        <div
          style={{
            position: 'absolute', top: PARENT_TOP + PARENT_H + 14, left: CX - PARENT_W / 2, width: PARENT_W,
            textAlign: 'center', fontSize: 30, opacity: parentOpacity, color: T.ink,
            fontFamily: 'A2Z Medium, sans-serif',
          }}
        >
          {parentLabel}
        </div>
      ) : null}

      {kids.map((child, i) => {
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
              {child.logo ? (
                <Img src={/^https?:/.test(child.logo) ? child.logo : staticFile(child.logo)}
                     style={{width: '76%', height: '64%', objectFit: 'contain'}} />
              ) : (
                <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 20, color: '#9AA0A8'}}>
                  로고 자리
                </span>
              )}
            </div>
            <div
              style={{
                position: 'absolute', top: CHILD_TOP + CHILD_H + 14, left: x - CHILD_W / 2, width: CHILD_W,
                textAlign: 'center', fontSize: 30, opacity: childOpacity, color: T.soft,
                fontFamily: 'A2Z Light, sans-serif',
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
export const LogoOrgCard = ({title = '', subtitle = '', parentLogo = '', parentLabel = '',
                             items = [], children = [], source = '', theme, bg = {}}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  // 제목·부제를 **높이로** 계산해 도식을 그만큼 내린다. 예전엔 부제가 212,
  // 부모 상자가 232 로 못 박혀 있어 상자가 부제를 덮었다 (#129)
  const headH = (title ? 60 : 0) + (subtitle ? 46 : 0);
  const headTop = 150;
  const BLOCK = 640;      // 부모(232) + 내림(148) + 자식(216) + 이름(44)
  const dTop = stageTop(BLOCK, {top: headTop + headH + (headH ? SP.BLOCK : 0)});
  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      {title ? (
        <div style={{position: 'absolute', top: headTop, left: 0, width: '100%', textAlign: 'center',
                     fontSize: 42, opacity: titleOpacity, color: T.ink,
                     fontFamily: 'A2Z Medium, sans-serif'}}>
          {title}
        </div>
      ) : null}
      {subtitle ? (
        <div style={{position: 'absolute', top: headTop + (title ? 60 : 0), left: 0, width: '100%',
                     textAlign: 'center', fontSize: 30, opacity: titleOpacity, color: T.soft,
                     fontFamily: 'A2Z Light, sans-serif'}}>
          {subtitle}
        </div>
      ) : null}
      <OrgDiagram parentLogo={parentLogo} parentLabel={parentLabel} top={dTop}
                  items={items} children={children} theme={theme} />
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
