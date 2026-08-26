import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, NumberIn, ValueChip, YELLOW, CONTENT_BOTTOM, fadeIn, SP, stageTop, titleH, LW, titleBottom} from './paper';

// 큰 수치만 남긴 카드 — 도형을 걷어내고 숫자 2~3개로 끝낸다.
// 격자·막대가 오히려 지저분해지는 구간에서 쓴다.
// items: [{value, unit, label, sub, hot, decimals}]
export const BigStatsCard = ({title = '', sub = '', items = [], source = '', caption = '',
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const n = items.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;
  const slot = Math.min(720, 1680 / n);
  const startX = (1920 - slot * n) / 2;

  // 세로도 가운데로 맞춘다. 예전엔 top 을 464 로 박아 놔서 **아래가 텅 비었다** —
  // 가로만 가운데면 "가운데 정렬"이 아니라 "위쪽에 붙은 가운데"다.
  // 쓸 수 있는 띠는 [타이틀 아래 ~ 자막 안전영역 위] 이고, 그 한가운데에 블록을 놓는다.
  const bandTop = title ? titleBottom(title, sub) + 22 : 150;
  const hasSub = items.some((it) => it.sub);
  const blockH = 148 + SP.GAP + 56 + (hasSub ? 44 : 0);      // 수치 + 라벨 (+ 보조줄)
  // 수치가 **하나뿐이면** 제목과 수치가 한 덩어리다. 둘 사이를 띠 절반만큼
  // 벌려 놓으면 제목은 위에 떠 있고 숫자는 아래에 떨어져 두 화면처럼 읽힌다.
  // 여럿일 때는 칸을 나눠 견주는 그림이라 띠 한가운데가 맞다.
  const one = n === 1 && Boolean(title);
  // 제목 + 사이 + 수치를 **한 덩어리**로 보고 통째로 화면 가운데에 앉힌다.
  // 제목만 위에 못 박아 두면 눈에는 전체가 위로 쏠린 것으로 보인다
  const headH = one ? (title ? 122 : 0) : titleH(title, sub);
  const GAP_HEAD = title ? SP.BLOCK : 0;
  const stackY = stageTop(headH + GAP_HEAD + blockH, {top: 120});
  const TOPY = stackY + headH + GAP_HEAD;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      {one ? (
        <div style={{position: 'absolute', top: stackY, left: 0, width: 1920,
                     textAlign: 'center', opacity: fadeIn(frame, 0),
                     fontFamily: 'A2Z Medium, sans-serif',
                     fontSize: 80, letterSpacing: '-0.01em', color: T.ink,
                     wordBreak: 'keep-all'}}>
          {title}
        </div>
      ) : (
        <PaperTitle title={title} sub={sub} theme={theme} align={align} top={stackY} />
      )}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {items.slice(1).map((_, i) => (
          <line key={i} x1={startX + slot * (i + 1)} y1={TOPY - 12}
                x2={startX + slot * (i + 1)} y2={TOPY + blockH + 4}
                stroke={T.ink} strokeWidth={LW.THIN} opacity={0.22 * fadeIn(frame, 10)} />
        ))}
      </svg>
      {items.map((it, i) => {
        const v = interpolate(frame, [14 + i * 12, 62 + i * 12], [0, it.value ?? 0],
                              {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <div key={i} style={{position: 'absolute', left: startX + i * slot, width: slot, top: TOPY,
                               textAlign: 'center', opacity: fadeIn(frame, 8 + i * 12)}}>
            {/* 강조 수치만 밑줄까지 그어 "확정"시킨다 — §27 */}
            <div style={{lineHeight: 1}}>
              {it.display != null ? (
                <span style={{fontFamily: 'A2Z Medium, sans-serif',
                              fontSize: it.hot ? 148 : 124, color: T.ink,
                              fontVariantNumeric: 'tabular-nums'}}>
                  {/* "약", "최대" 같은 한정어는 **수치보다 작게**. 같은 크기로 두면
                      한정어가 수치만큼 세게 읽혀서 값이 흐려진다 */}
                  {it.prefix ? (
                    <span style={{fontSize: it.hot ? 58 : 50, marginRight: 10,
                                  color: T.soft,
                                  fontFamily: 'A2Z Light, sans-serif'}}>{it.prefix}</span>
                  ) : null}
                  {/* chip 을 주면 값이 색 박스에 들어간다 (§40-6).
                      도해 옆에 붙는 수치처럼 **배경에서 떼어 내야** 할 때 쓴다 */}
                  {it.chip ? (
                    <ValueChip size={it.hot ? 118 : 96} hot={it.hot} theme={theme}>
                      {it.display}{it.unit}
                    </ValueChip>
                  ) : (
                    <>
                      {it.display}
                      <span style={{fontSize: it.hot ? 66 : 56, marginLeft: 6,
                                    color: it.hot ? T.ink : T.soft}}>{it.unit}</span>
                    </>
                  )}
                </span>
              ) : (
                <NumberIn to={it.value ?? 0} start={14 + i * 12} dur={44}
                          decimals={it.decimals ?? 0} unit={it.unit} unitSize={0.45}
                          size={it.hot ? 148 : 124} color={T.ink} align="center"
                          underline={it.hot ? YELLOW : null} />
              )}
            </div>
            <div style={{marginTop: SP.GAP, fontFamily: it.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                         fontSize: 46, color: T.ink, wordBreak: 'keep-all'}}>
              {/* 칩을 쓰면 라벨은 맨 글자로 둔다 — 값도 옐로, 라벨도 옐로면
                  강조가 두 군데로 갈려서 아무것도 강조가 안 된다 (§40-6) */}
              {it.hot && !it.chip
                ? <span style={{background: YELLOW, color: '#1B1E24',
                                padding: '2px 14px'}}>{it.label}</span>
                : it.label}
            </div>
            {it.sub ? (
              <div style={{marginTop: SP.NEAR, fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft, wordBreak: 'keep-all'}}>
                {it.sub}
              </div>
            ) : null}
          </div>
        );
      })}
      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: 792, textAlign: 'center',
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft,
                     opacity: fadeIn(frame, 56), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
