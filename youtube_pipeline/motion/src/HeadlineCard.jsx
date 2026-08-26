import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, CONTENT_BOTTOM, SP, stageTop} from './paper';

// ── 문장 하나로 닫는 카드 ─────────────────────────────────────────────────
// 장을 넘기거나 결론을 박을 때. 두 줄까지, 도형 없음.
// 강조 구간이 필요하면 YHeadlineCard(형광펜) 쪽이다.
//
// **종이 시스템으로 옮긴 카드다.** 원래는 `shared` 계열(먹 배경 + GridBg)
// 이었고, `light` 인자로 흰 배경 전환까지 따로 갖고 있었다. 테마가 그 일을
// 하므로 뺐다 — 밝게 가려면 theme='paper', 무겁게 가려면 theme='ink' 다.
// 옛 인자(accent·light·framed·bgVideo)는 받되 무시한다. 이미 쓰인 데가 있어
// 지우면 그 컷이 조용히 기본값으로 돌아간다.
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

  // 긴 줄은 줄인다. 64 고정이라 긴 문장이 화면 밖으로 나갔다
  const size = (s) => Math.min(72, Math.max(40, Math.floor(1520 / Math.max(8, s.length) * 1.6)));

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} backdrop={bgImage} veil={0.88} {...bg} />
      <div style={{position: 'absolute', left: 200, width: 1520,
                   top: stageTop(line2 ? 200 : 100, {top: 150}),
                   textAlign: 'center', opacity: o, transform: `translateY(${y}px)`}}>
        <div style={{fontSize: size(line1), color: T.ink, lineHeight: 1.4,
                     fontFamily: 'A2Z Medium, sans-serif',
                     wordBreak: 'keep-all'}}>
          {line1}
        </div>
        {line2 ? (
          <div style={{marginTop: SP.TIGHT, fontSize: size(line2), color: T.soft,
                       fontFamily: 'A2Z Light, sans-serif', lineHeight: 1.4,
                       opacity: o2, wordBreak: 'keep-all'}}>
            {line2}
          </div>
        ) : null}
      </div>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
