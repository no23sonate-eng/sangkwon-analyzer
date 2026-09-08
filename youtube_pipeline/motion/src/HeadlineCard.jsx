import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, YELLOW, SP, stageTop, fadeIn} from './paper';

// ── 문장 하나로 닫는 카드 ─────────────────────────────────────────────────
// 장을 넘기거나 결론을 박을 때. 두 줄까지, 도형 없음.
// 강조 구간이 필요하면 YHeadlineCard(형광펜) 쪽이다.
//
// **종이 시스템으로 옮긴 카드다.** 원래는 `shared` 계열(먹 배경 + GridBg)
// 이었고 `light` 인자로 흰 배경 전환까지 따로 갖고 있었다. 테마가 그 일을
// 하므로 뺐다. 옛 인자(accent·light·framed·bgVideo)는 받되 무시한다 —
// 이미 쓰인 데가 있어 지우면 그 컷이 조용히 기본값으로 돌아간다.
//
// ── 2026-09-09 · 크기와 못 ────────────────────────────────────────────
//  ① 글자 크기 상한이 72 로 못 박혀 있었다. '세탁' 두 글자짜리 컷이
//     1920 화면 한가운데 72px 로 떠 있어, 판이 비었다기보다 **글자를
//     빠뜨린 것처럼** 보였다. 한 줄이면 150 까지 키운다
//  ② 아무 표시가 없어 글자가 허공에 뜬다 → 위에 짧은 노란 못을 박는다.
//     이 채널이 제목에 쓰는 것과 같은 표시라 낯설지 않다
export const HeadlineCard = ({
  line1 = '', line2 = '',
  bgImage = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);

  const o = interpolate(frame, [0, 18], [0, 1], {extrapolateRight: 'clamp'});
  const y = interpolate(frame, [0, 18], [16, 0], {extrapolateRight: 'clamp'});
  const o2 = interpolate(frame, [16, 34], [0, 1], {extrapolateRight: 'clamp'});
  const grow = Math.max(0, Math.min(1, (frame - 2) / 16));

  // 글자수로 맞추되 **상한을 줄 수에 따라 다르게** 둔다.
  // 한 줄짜리는 그 한 줄이 화면 전부라 크게, 두 줄이면 둘이 같이 읽혀야 한다
  const fit = (s, max) =>
    Math.min(max, Math.max(38, Math.floor(1560 / Math.max(2, s.length) * 1.62)));
  const s1 = fit(line1, line2 ? 92 : 150);
  const s2 = line2 ? Math.min(fit(line2, 86), s1) : 0;
  const blockH = s1 * 1.32 + (line2 ? s2 * 1.36 + SP.TIGHT : 0) + 46;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} backdrop={bgImage} veil={0.9} {...bg} />
      <div style={{position: 'absolute', left: 180, width: 1560,
                   top: stageTop(blockH, {top: 150}),
                   textAlign: 'center', opacity: o, transform: `translateY(${y}px)`}}>
        <div style={{width: 96 * grow, height: 8, background: YELLOW,
                     margin: '0 auto 30px'}} />
        <div style={{fontSize: s1, color: T.ink, lineHeight: 1.24,
                     fontFamily: 'A2Z Medium, sans-serif', letterSpacing: '-0.025em',
                     wordBreak: 'keep-all'}}>
          {line1}
        </div>
        {line2 ? (
          <div style={{marginTop: SP.TIGHT, fontSize: s2, color: T.soft,
                       fontFamily: 'A2Z Light, sans-serif', lineHeight: 1.3,
                       letterSpacing: '-0.02em',
                       opacity: o2, wordBreak: 'keep-all'}}>
            {line2}
          </div>
        ) : null}
      </div>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
