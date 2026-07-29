import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT} from './shared';

// 실제 언론사 헤드라인을 인용하는 카드 — 스크린샷이 아니라 실측 헤드라인
// 텍스트를 타이포로 재구성한다(출처 표기 필수). 좌측 세로 액센트 바 +
// 매체명·날짜 배지 + 헤드라인 텍스트. outlet2/headline2 를 주면
// StatCard 와 같은 방식으로 절반 지점에 2단계 전환(두 매체 헤드라인을
// 잇달아 보여줄 때 — 예: "경기일보 → 파이낸셜뉴스").
const Block = ({outlet, date, headline, opacity, accent}) => {
  const y = interpolate(opacity, [0, 1], [10, 0]);
  return (
    <div style={{position: 'absolute', top: 400, left: 260, width: 1400, opacity, transform: `translateY(${y}px)`}}>
      <div style={{display: 'flex', alignItems: 'center', marginBottom: 28}}>
        <div style={{width: 5, height: 34, background: accent, marginRight: 18}} />
        <div style={{fontSize: 26, ...TEXT.label}}>
          {outlet}
          {date ? <span style={{color: '#565C64', marginLeft: 12}}>{date}</span> : null}
        </div>
      </div>
      <div
        style={{
          fontSize: 44, color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif',
          letterSpacing: '0.01em', lineHeight: 1.45, paddingLeft: 23,
        }}
      >
        {headline}
      </div>
    </div>
  );
};

export const NewsHeadlineCard = ({
  outlet = '',
  date = '',
  headline = '',
  outlet2 = '',
  date2 = '',
  headline2 = '',
  accent = ACCENT,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const hasStage2 = Boolean(headline2);
  const stage2Start = Math.round(durationInFrames * 0.5);
  const stage1Opacity = interpolate(frame, [10, 26], [0, 1], {extrapolateRight: 'clamp'})
    * (hasStage2
      ? interpolate(frame, [stage2Start, stage2Start + 12], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
      : 1);
  const stage2Opacity = hasStage2
    ? interpolate(frame, [stage2Start + 6, stage2Start + 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;

  return (
    <AbsoluteFill style={BG_STYLE}>
      <GridBg />
      <Block outlet={outlet} date={date} headline={headline} opacity={stage1Opacity} accent={accent} />
      {hasStage2 ? (
        <Block outlet={outlet2} date={date2} headline={headline2} opacity={stage2Opacity} accent={accent} />
      ) : null}
    </AbsoluteFill>
  );
};
