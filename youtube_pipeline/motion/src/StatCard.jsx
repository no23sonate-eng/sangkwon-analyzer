import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, PaperCaption, NumberIn,
        CONTENT_BOTTOM, fadeIn, SP, stageTop, titleH} from './paper';

// ── 숫자 하나가 주인공 ────────────────────────────────────────────────────
// 금액·개소·연도처럼 **한 문장에 결론이 하나**일 때. 두 개면 BigStatsCard.
//
// **종이 시스템으로 옮긴 카드다.** 원래는 또 다른 계열(`shared` 의
// BG_STYLE·GridBg·TEXT)이었다. 이 저장소엔 배경 계열이 셋 있었고
// (종이 / v2 먹 / shared 먹), 한 영상에 셋이 섞이니 채널이 셋으로 보였다.
//
// value2/subtitle2 — 문장이 길어 카드가 오래 서 있을 때 전체 길이의 48%
// 지점에서 2단계로 넘어간다. 화면이 죽지 않게 하려는 장치라 그대로 뒀다.
//
// bgImage — 뒤에 실사를 깐다. PaperBg 가 베일을 씌우므로 숫자는 계속 읽힌다.
// 옛 코드에는 bgVideo·bgInset·framed 가 있었는데, 배경마다 글자색을 손으로
// 갈아 끼우는 분기가 넷이었다. 테마가 색을 정하는 지금은 필요 없다.
export const StatCard = ({
  title = '', value = '', subtitle = '', caption = '',
  value2 = '', subtitle2 = '',
  // count — 값을 **굴려서** 올린다. "15개월" 처럼 기간·개수가 결론일 때,
  // 숫자가 제자리에서 나타나는 것보다 세어 올라가는 편이 문장에 맞는다.
  // 주면 value 대신 이 쪽이 그려진다
  count = null, countUnit = '', countDecimals = 0,
  bgImage = '', veil = null,
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const T = themeOf(theme);

  const valueIn = spring({frame: Math.max(0, frame - 10), fps,
                          config: {damping: 200, mass: 0.7}, durationInFrames: 22});

  const stage2Start = Math.round(durationInFrames * 0.48);
  const has2 = Boolean(value2);
  const o1 = has2
    ? interpolate(frame, [stage2Start, stage2Start + 12], [1, 0],
                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 1;
  const o2 = has2
    ? interpolate(frame, [stage2Start + 6, stage2Start + 22], [0, 1],
                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;

  // 숫자가 길면 줄인다. 96 고정이라 '2조 6,560억원' 같은 값이 화면을 넘었다
  const size = (v) => Math.min(150, Math.max(76, Math.floor(1560 / Math.max(4, String(v).length))));

  // 제목과 수치를 한 덩어리로 보고 화면 가운데. 예전엔 214·388 로 못 박혀
  // 있어서 긴 숫자가 들어오면 덩어리가 아래로 처졌다
  const headH = title ? 76 : 0;
  const bodyH = size(String(count != null ? count : value)) * 1.1
    + (subtitle ? SP.GAP + 52 : 0);
  const stackY = stageTop(headH + (title ? SP.BLOCK : 0) + bodyH, {top: 140});
  const valueY = stackY + headH + (title ? SP.BLOCK : 0);
  const onPhoto = Boolean(bgImage);
  const ink = onPhoto ? '#FFFFFF' : T.ink;
  const soft = onPhoto ? 'rgba(255,255,255,0.82)' : T.soft;
  const sh = onPhoto ? {textShadow: '0 3px 20px rgba(0,0,0,0.85)'} : {};

  // 2단계로 넘어간 뒤에도 굴러 올라간 숫자가 남으면 안 된다 — count 는 1단계만
  const stage = (v, s, o, scale, roll = false) => (
    <div style={{position: 'absolute', left: 0, width: 1920, top: valueY, textAlign: 'center',
                 opacity: o, transform: `scale(${scale})`}}>
      {roll && count != null ? (
        <div style={{fontSize: 0, ...sh}}>
          <NumberIn to={Number(count)} start={10} dur={40} decimals={countDecimals}
                    unit={countUnit} size={size(String(count) + countUnit)}
                    color={ink} align="center" />
        </div>
      ) : (
      <div style={{fontFamily: 'A2Z Medium, sans-serif',
                   fontSize: size(v), lineHeight: 1.1, color: ink,
                   fontVariantNumeric: 'tabular-nums', wordBreak: 'keep-all', ...sh}}>
        {v}
      </div>
      )}
      {s ? (
        <div style={{marginTop: SP.GAP, fontFamily: 'A2Z Regular, sans-serif',
                     fontSize: 44, color: soft, wordBreak: 'keep-all', ...sh}}>{s}</div>
      ) : null}
    </div>
  );

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      {/* 영상을 깔 때는 베일을 걷는다. 0.88 이면 배경이 안 보인다 */}
      <PaperBg theme={theme} backdrop={bgImage}
               veil={veil == null ? (bgImage ? 0.42 : 0.88) : veil} {...bg} />

      {title ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: stackY, textAlign: 'center',
                     fontFamily: 'A2Z Medium, sans-serif',
                     fontSize: 44, color: ink, opacity: fadeIn(frame, 0), ...sh,
                     wordBreak: 'keep-all'}}>
          {title}
        </div>
      ) : null}

      {stage(value, subtitle, valueIn * o1, interpolate(valueIn, [0, 1], [0.94, 1]), true)}
      {has2 ? stage(value2, subtitle2, o2, interpolate(o2, [0, 1], [0.94, 1])) : null}

      <PaperCaption theme={theme} opacity={fadeIn(frame, 30) * o1}>{caption}</PaperCaption>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
