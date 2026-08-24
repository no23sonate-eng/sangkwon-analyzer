import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, YELLOW, CONTENT_BOTTOM, SP} from './paper';

// ── 언론 헤드라인 인용 ────────────────────────────────────────────────────
// 기사 **제목**을 그대로 옮겨 적는 카드. 본문까지 놓고 형광펜을 긋는 건
// ArticleCard 쪽이다. 여긴 "이런 기사가 났다" 한 줄이면 될 때.
//
// **종이 시스템으로 옮긴 카드다.** 원래는 `shared` 먹 배경이었다.
// 종이 위에서는 기사 제목이 **흰 종이 판** 위에 얹혀야 인용으로 읽힌다.
// 무대에 바로 적으면 내가 쓴 제목인지 기사 제목인지 구분이 안 간다.
//
// outlet2/headline2 를 주면 절반 지점에서 두 번째 매체로 넘어간다
export const NewsHeadlineCard = ({
  outlet = '', date = '', headline = '',
  outlet2 = '', date2 = '', headline2 = '',
  bgImage = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const T = themeOf(theme);

  const has2 = Boolean(headline2);
  const s2 = Math.round(durationInFrames * 0.5);
  const o1 = interpolate(frame, [10, 26], [0, 1], {extrapolateRight: 'clamp'})
    * (has2 ? interpolate(frame, [s2, s2 + 12], [1, 0],
                          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1);
  const o2 = has2
    ? interpolate(frame, [s2 + 6, s2 + 22], [0, 1],
                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;

  const Block = ({o, ol, dt, hl}) => (
    <div style={{position: 'absolute', left: 300, width: 1320, top: 300, opacity: o,
                 transform: `translateY(${interpolate(o, [0, 1], [10, 0])}px)`,
                 background: '#FFFFFF', padding: '64px 76px 72px',
                 boxShadow: '0 24px 70px rgba(0,0,0,0.30)'}}>
      <div style={{display: 'flex', alignItems: 'center', marginBottom: SP.GAP}}>
        <div style={{width: 6, height: 34, background: YELLOW, marginRight: 18}} />
        <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                      fontSize: 30, letterSpacing: '0.08em', color: '#16181C'}}>
          {ol}
        </span>
        {dt ? (
          <span style={{marginLeft: SP.NEAR, fontFamily: 'A2Z Light, sans-serif',
                        fontSize: 28, color: '#7A8089'}}>{dt}</span>
        ) : null}
      </div>
      <div style={{fontFamily: 'Myeongjo, Georgia, serif', fontSize: 52,
                   lineHeight: 1.42, color: '#16181C', wordBreak: 'keep-all'}}>
        {hl}
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} backdrop={bgImage} veil={0.9} {...bg} />
      <Block o={o1} ol={outlet} dt={date} hl={headline} />
      {has2 ? <Block o={o2} ol={outlet2} dt={date2} hl={headline2} /> : null}
      <PaperSource source={source || [outlet, date].filter(Boolean).join(' ')} theme={theme} />
    </AbsoluteFill>
  );
};
