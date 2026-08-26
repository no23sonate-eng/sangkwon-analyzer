import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, fadeIn} from './paper';
import {RoughTitle} from './annotate';

// 안(案) 제목 판 — §40-7. 거친 검정 박스 위 흰 글자, 줄마다 박스가 나뉜다.
// 배경엔 옛 도면·평면을 아주 옅게 깔 수 있다 (bg.backdrop + veil 0.94~0.96).
export const PlanTitleCard = ({
  kicker = '', lines = [], sub = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const ls = Array.isArray(lines) ? lines : [lines];
  const size = ls.some((t) => (t || '').length > 14) ? 72 : 92;
  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <PaperBg theme={theme} {...bg} />
      <div style={{position: 'relative', textAlign: 'center'}}>
        <RoughTitle lines={ls} kicker={kicker} size={size}
                    reveal={fadeIn(frame, 6, 26)}
                    fill={T.ink} color={T.bg} kickerColor={T.ink} />
        {sub ? (
          <div style={{marginTop: 34, fontFamily: 'A2Z Light, sans-serif', fontSize: 32,
                       color: T.soft, opacity: fadeIn(frame, 34), wordBreak: 'keep-all'}}>
            {sub}
          </div>
        ) : null}
      </div>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
