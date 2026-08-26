import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, SP, LW, titleBottom} from './paper';
import {fit} from './layout';

// ── 두 갈래를 좌우 판으로 ──────────────────────────────────────────────
// "570억을 회수하는 두 갈래" 처럼 **둘 중 하나가 아니라 둘 다** 인 구조가 있다.
// 갈림길(ForkPathCard)은 하나를 고르는 그림이라 여기엔 안 맞는다 — 나란히
// 놓고 둘 다 살아 있다는 걸 보여 줘야 한다.
//
// 가운데 얇은 세로선 하나로 갈라 두 판을 만든다. 판이 서로 밀며 자리를 잡고,
// 강조할 쪽만 옐로 밑줄이 그어진다. 목록 카드와 달리 **좌우 무게가 같다** —
// 그게 "두 갈래" 라는 말의 그림이다.
//
// panels: [{tag, label, note, hot}]
export const TwoPanelCard = ({
  title = '', sub = '', panels = [],
  divider = '',            // 가운데 선 위에 얹는 짧은 말 ("또는", "?")
  source = '', caption = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ps = panels.slice(0, 2);
  if (ps.length < 2) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const bandTop = title ? titleBottom(title, sub) + 26 : 200;
  const midY = Math.round((bandTop + CONTENT_BOTTOM) / 2);
  const HALF = 400;                    // 판 하나의 반폭
  const GAP = 70;                      // 가운데 선에서 판까지

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 가운데 선 — 위아래로 자란다. 이 한 줄이 '갈라진다' 를 말한다 */}
        <line x1={960} y1={midY - 150 * fadeIn(frame, 8, 18)} x2={960}
              y2={midY + 150 * fadeIn(frame, 8, 18)}
              stroke={T.ink} strokeWidth={LW.BODY} opacity={0.4} />
        {ps.map((p, i) => {
          if (!p.hot) return null;
          const e = spring({frame: frame - (34 + i * 8), fps, config: {damping: 200}});
          const cx = 960 + (i === 0 ? -1 : 1) * (GAP + HALF);
          return (
            <line key={i} x1={cx - 190 * e} y1={midY + 18} x2={cx + 190 * e} y2={midY + 18}
                  stroke={YELLOW} strokeWidth={10} />
          );
        })}
      </svg>

      {ps.map((p, i) => {
        const dir = i === 0 ? -1 : 1;
        const e = spring({frame: frame - (14 + i * 10), fps, config: {damping: 190, mass: 0.7}});
        const cx = 960 + dir * (GAP + HALF);
        return (
          <div key={i} style={{position: 'absolute', left: cx - HALF, width: HALF * 2,
                               top: midY - 132, textAlign: 'center',
                               opacity: e,
                               transform: `translateX(${(1 - e) * dir * 42}px)`}}>
            {p.tag ? (
              <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 28,
                           letterSpacing: '0.2em', color: p.hot ? YELLOW : T.soft}}>
                {p.tag}
              </div>
            ) : null}
            <div style={{marginTop: SP.NEAR,
                         fontFamily: 'A2Z Medium, sans-serif',
                         fontSize: fit(p.label, 72, HALF * 2 - 40), lineHeight: 1.15,
                         color: T.ink, letterSpacing: '-0.02em', wordBreak: 'keep-all'}}>
              {p.label}
            </div>
            {p.note ? (
              <div style={{marginTop: SP.BLOCK, fontFamily: 'A2Z Light, sans-serif',
                           fontSize: 32, lineHeight: 1.45, color: T.soft,
                           wordBreak: 'keep-all', padding: '0 30px'}}>
                {p.note}
              </div>
            ) : null}
          </div>
        );
      })}

      {divider ? (
        <div style={{position: 'absolute', left: 960 - 90, width: 180, top: midY - 22,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 28,
                     letterSpacing: '0.1em', color: T.soft, background: T.bg,
                     padding: '6px 0', opacity: fadeIn(frame, 26)}}>
          {divider}
        </div>
      ) : null}

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 20,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 32,
                     color: T.soft, opacity: fadeIn(frame, 60), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
