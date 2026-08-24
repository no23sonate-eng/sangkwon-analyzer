import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, PaperCaption, YELLOW, CONTENT_BOTTOM, fadeIn, SP} from './paper';

// ── 공식 한 줄 ────────────────────────────────────────────────────────────
// "총 매도·매수금액을 객실 수로 나눠서 평가한다" 처럼 **계산 자체가 내용**인
// 문장. 이걸 도형으로 풀면 오히려 멀어진다 — 나눗셈은 나눗셈으로 보여야 한다.
//
// 처음엔 이 자리에 교환 모션 카드(양쪽이 물건을 맞바꾸는 그림)를 썼는데,
// 나눗셈이 아니라 **맞바꾸기**로 읽혔다. 화살표가 오가면 "주고받는다" 가 되지
// "나눈다" 가 안 된다.
//
// 그래서 분수 그대로 세운다. 가로선 하나, 위에 분자, 아래에 분모, 오른쪽에
// 등호와 결과. 순서도 그대로다 — 분자 → 선 → 분모 → 등호 → 결과.
//
// top/bottom : 분자·분모 (라벨과 값)
// result     : 결과 (강조)
export const FormulaCard = ({
  title = '',
  top = {}, bottom = {}, result = {},
  caption = '', source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const inTop = spring({frame: frame - 8, fps, config: {damping: 200}});
  const bar = interpolate(frame, [20, 34], [0, 1],
                          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const inBot = spring({frame: frame - 30, fps, config: {damping: 200}});
  const eq = interpolate(frame, [48, 60], [0, 1],
                         {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const inRes = spring({frame: frame - 56, fps, config: {damping: 200, mass: 0.8}});

  // 분수 폭은 위아래 글자 중 긴 쪽이 정한다
  const longest = Math.max(String(top.value || '').length, String(bottom.value || '').length);
  const size = Math.min(96, Math.max(54, Math.round(760 / Math.max(5, longest))));
  const FW = Math.max(420, longest * size * 0.62);

  const CY = title ? 500 : 460;
  const term = (v, l, o, dy) => (
    <div style={{textAlign: 'center', opacity: o, transform: `translateY(${dy}px)`}}>
      <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: size,
                   color: T.ink, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
                   wordBreak: 'keep-all'}}>{v}</div>
      {l ? (
        <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                     fontSize: 30, color: T.soft, wordBreak: 'keep-all'}}>{l}</div>
      ) : null}
    </div>
  );

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />

      {title ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: 190, textAlign: 'center',
                     fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 44,
                     color: T.ink, opacity: fadeIn(frame, 0), wordBreak: 'keep-all'}}>
          {title}
        </div>
      ) : null}

      <div style={{position: 'absolute', left: 0, width: 1920, top: CY,
                   transform: 'translateY(-50%)',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   gap: SP.BLOCK}}>
        {/* 분수 */}
        <div style={{width: FW, display: 'flex', flexDirection: 'column',
                     alignItems: 'stretch', gap: SP.NEAR}}>
          {term(top.value, top.label, inTop, (1 - inTop) * 18)}
          <div style={{height: 5, background: T.ink, transformOrigin: 'left center',
                       transform: `scaleX(${bar})`}} />
          {term(bottom.value, bottom.label, inBot, (1 - inBot) * -18)}
        </div>

        <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                     fontSize: size * 0.8, color: T.soft, opacity: eq}}>=</div>

        {/* 결과 — 여기만 노랑 */}
        <div style={{textAlign: 'center', opacity: inRes,
                     transform: `scale(${0.94 + inRes * 0.06})`}}>
          <div style={{display: 'inline-block', background: YELLOW, color: '#1B1E24',
                       padding: '10px 26px',
                       fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                       fontSize: size, lineHeight: 1.14,
                       fontVariantNumeric: 'tabular-nums', wordBreak: 'keep-all'}}>
            {result.value}
          </div>
          {result.label ? (
            <div style={{marginTop: SP.NEAR, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: 32, color: T.soft, wordBreak: 'keep-all'}}>
              {result.label}
            </div>
          ) : null}
        </div>
      </div>

      <PaperCaption theme={theme} opacity={fadeIn(frame, 70)}>{caption}</PaperCaption>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
