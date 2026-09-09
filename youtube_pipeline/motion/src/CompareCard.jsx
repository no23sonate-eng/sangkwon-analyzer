import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, PaperCaption,
        CONTENT_BOTTOM, fadeIn, stageTop, titleH, FS, LW, SP} from './paper';

// 두 입장/두 항목을 좌우로 대비하는 카드.
// rightEmpty=true 면 오른쪽에 옅은 대시(—)와 emptyLabel 만 — 한쪽이
// "확인되지 않음" 일 때 그 비대칭이 화면에 그대로 남는다.
// leftImage/rightImage 를 주면 각 절반을 실사로 채우고 글자를 얹는다.
//
// ── 2026-09-09 · 판을 다시 짰다 ────────────────────────────────────────
// 검수에서 보니 세 가지가 어긋나 있었다.
//  ① 내용이 화면 **위쪽 60%** 에만 몰렸다. COL_TOP 이 370 으로 박혀 있어
//     아래가 통째로 비었다 → 블록 높이를 재서 시각 중심에 앉힌다
//  ② 가운데 구분선이 `rgba(255,255,255,0.12)` 였다. **크림 종이 위에서는
//     흰 선이 안 보인다.** 비교 카드인데 두 덩이가 그냥 흩어져 있었다
//     → 테마 잉크로 긋고, 위아래로 짧은 삐침을 둬 '자'처럼 보이게 한다
//  ③ 값이 80px 이었다. 이 카드의 주인공은 값인데 제목(46)과 차이가 적어
//     위계가 안 섰다 → FS.HERO(104) 로 올리고 길면 자동으로 줄인다
export const CompareCard = ({
  title = '', sub = '',
  leftTitle = '', leftLines = [], leftValue = '',
  rightTitle = '', rightLines = [], rightValue = '',
  rightEmpty = false, emptyLabel = '확인되지 않음',
  caption = '',
  leftImage = '', rightImage = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);

  const titleOpacity = fadeIn(frame, 0);
  const leftOpacity = fadeIn(frame, 14);
  const rightOpacity = fadeIn(frame, 28);
  const captionOpacity = fadeIn(frame, 40);
  const imageOpacity = interpolate(frame, [0, 24], [0, 1], {extrapolateRight: 'clamp'});

  const hasImage = Boolean(leftImage || rightImage);

  // ── 자리 ────────────────────────────────────────────────────────────
  // 값이 길면(‘약 2,600만 원’) 104px 로는 두 줄이 된다. 글자수로 줄인다 —
  // 두 값의 크기는 **같아야** 비교가 성립하므로 긴 쪽에 맞춘다
  const longest = Math.max(String(leftValue).length, String(rightValue).length);
  const vSize = longest > 12 ? 62 : longest > 8 ? 78 : longest > 5 ? 92 : FS.HERO;

  const lineN = Math.max(leftLines.length, rightEmpty ? 2 : rightLines.length);
  const blockH = 44 + vSize * 1.1 + lineN * 46 + (caption ? 54 : 0);
  // ── 2026-09-09 · 제목과 두 칸이 따로 앉아 있었다 ────────────────────────
  // 제목은 PaperTitle 이 제 기본값(150)에, 두 칸은 stageTop 으로 각자 자리를
  // 잡았다. 그래서 위쪽 60% 에 다 몰리고 아래가 통째로 비었다 (#3).
  // 제목 + 사이 + 두 칸을 **한 덩어리**로 재서 통째로 시각 중심에 앉힌다
  const headH = title && !hasImage ? titleH(title, sub) : 0;
  const HEAD_GAP = headH ? SP.BAND : 0;
  const stackY = stageTop(headH + HEAD_GAP + blockH, {top: 150});
  const COL_TOP = hasImage ? 370 : stackY + headH + HEAD_GAP;

  const COL_W = 560, GAP = 150;
  const LEFT_X = 1920 / 2 - GAP / 2 - COL_W;
  const RIGHT_X = 1920 / 2 + GAP / 2;
  const ruleH = blockH - (caption ? 54 : 0) + 24;

  const overlayStyle = {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    background: 'linear-gradient(180deg, rgba(5,7,10,.68) 0%, rgba(5,7,10,.7) 60%, rgba(5,7,10,.88) 100%)',
  };
  const textPanel = hasImage ? {
    position: 'absolute', top: -28, left: -30, width: COL_W + 60, height: 360,
    background: 'rgba(5,7,10,0.62)', backdropFilter: 'blur(1px)',
  } : null;

  const Col = ({x, name, value, lines, empty, o}) => (
    // 칸 안 글자가 왼쪽 정렬이라, 왼 칸은 가운데 선에서 멀찍이 떨어지고
    // 오른 칸은 선에 딱 붙어 두 덩이가 흩어져 보였다. 칸마다 가운데로 모으면
    // 두 값이 선을 사이에 두고 마주 본다 — 견주는 그림이 그제야 성립한다
    <div style={{position: 'absolute', top: COL_TOP, left: x, width: COL_W,
                 textAlign: 'center', opacity: o}}>
      {textPanel ? <div style={textPanel} /> : null}
      <div style={{position: 'relative', fontFamily: 'A2Z Light, sans-serif',
                   fontSize: FS.SMALL, letterSpacing: '0.02em',
                   color: hasImage ? '#C9CEd6' : T.soft, marginBottom: SP.NEAR}}>
        {name}
      </div>
      {value ? (
        <div style={{position: 'relative', fontFamily: 'A2Z Medium, sans-serif',
                     fontSize: vSize, lineHeight: 1.05, letterSpacing: '-0.03em',
                     color: hasImage ? '#EDEFF3' : T.ink, whiteSpace: 'nowrap'}}>
          {value}
        </div>
      ) : null}
      {empty ? (
        <div style={{position: 'relative', marginTop: SP.NEAR}}>
          <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 54,
                       color: hasImage ? '#B8BDC5' : T.soft}}>—</div>
          <div style={{fontFamily: 'A2Z Regular, sans-serif', fontSize: FS.LABEL,
                       color: hasImage ? '#FFFFFF' : T.soft, marginTop: 12}}>{emptyLabel}</div>
        </div>
      ) : lines.filter(Boolean).map((line, i) => (
        <div key={i} style={{position: 'relative', fontFamily: 'A2Z Light, sans-serif',
                             fontSize: FS.SMALL, lineHeight: 1.45, marginTop: i ? 6 : SP.NEAR,
                             color: hasImage ? '#FFFFFF' : T.soft, wordBreak: 'keep-all'}}>
          {line}
        </div>
      ))}
    </div>
  );

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      {leftImage ? (
        <div style={{position: 'absolute', top: 0, left: 0, width: 960, height: 1080,
                     opacity: imageOpacity, overflow: 'hidden'}}>
          <Img src={staticFile(leftImage)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          <div style={overlayStyle} />
        </div>
      ) : null}
      {rightImage ? (
        <div style={{position: 'absolute', top: 0, left: 960, width: 960, height: 1080,
                     opacity: imageOpacity, overflow: 'hidden'}}>
          <Img src={staticFile(rightImage)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          <div style={overlayStyle} />
        </div>
      ) : null}

      {title ? (
        hasImage
          ? <div style={{position: 'absolute', top: 96, left: 0, width: 1920, textAlign: 'center',
                         fontFamily: 'A2Z Medium, sans-serif', fontSize: FS.LEAD,
                         color: '#EDEFF3', opacity: titleOpacity}}>{title}</div>
          // stackY 를 안 넘기면 제목만 PaperTitle 기본값(150)에 남는다.
          // 두 칸은 stackY 로 내려가 있으니 제목과 300px 넘게 벌어져
          // "위에 제목 하나, 가운데 표 하나" 두 화면처럼 읽혔다 (#33·#121)
          : <PaperTitle title={title} sub={sub} theme={theme} top={stackY} />
      ) : null}

      {/* 가운데 자 — 두 값을 가르는 선. 위아래 삐침이 있어야 '가른다'로 읽힌다 */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <g opacity={0.44 * fadeIn(frame, 10)}>
          <line x1={960} y1={COL_TOP - 24} x2={960} y2={COL_TOP + ruleH}
                stroke={hasImage ? '#FFFFFF' : T.ink} strokeWidth={LW.THIN} />
          <line x1={946} y1={COL_TOP - 24} x2={974} y2={COL_TOP - 24}
                stroke={hasImage ? '#FFFFFF' : T.ink} strokeWidth={LW.HAIR} />
          <line x1={946} y1={COL_TOP + ruleH} x2={974} y2={COL_TOP + ruleH}
                stroke={hasImage ? '#FFFFFF' : T.ink} strokeWidth={LW.HAIR} />
        </g>
      </svg>

      <Col x={LEFT_X} name={leftTitle} value={leftValue} lines={leftLines}
           empty={false} o={leftOpacity} />
      <Col x={RIGHT_X} name={rightTitle} value={rightValue} lines={rightLines}
           empty={rightEmpty} o={rightOpacity} />

      {caption ? (
        hasImage
          ? <div style={{position: 'absolute', bottom: 1080 - CONTENT_BOTTOM + 10, left: 0,
                         width: 1920, textAlign: 'center', fontFamily: 'A2Z Light, sans-serif',
                         fontSize: FS.MICRO, color: '#C9CED6', opacity: captionOpacity}}>{caption}</div>
          : <PaperCaption theme={theme} opacity={captionOpacity}>{caption}</PaperCaption>
      ) : null}
      <PaperSource source={source} theme={theme} onPhoto={hasImage} />
    </AbsoluteFill>
  );
};
