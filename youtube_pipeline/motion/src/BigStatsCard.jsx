import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, NumberIn, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';

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
  const bandTop = title ? (sub ? 300 : 246) : 150;
  const hasSub = items.some((it) => it.sub);
  const blockH = 148 + 26 + 56 + (hasSub ? 44 : 0);      // 수치 + 라벨 (+ 보조줄)
  const TOPY = Math.round(bandTop + Math.max(0, (CONTENT_BOTTOM - bandTop - blockH) / 2));

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {items.slice(1).map((_, i) => (
          <line key={i} x1={startX + slot * (i + 1)} y1={TOPY - 12}
                x2={startX + slot * (i + 1)} y2={TOPY + blockH + 4}
                stroke={T.ink} strokeWidth={2} opacity={0.22 * fadeIn(frame, 10)} />
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
                <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                              fontSize: it.hot ? 148 : 124, color: T.ink,
                              fontVariantNumeric: 'tabular-nums'}}>
                  {/* "약", "최대" 같은 한정어는 **수치보다 작게**. 같은 크기로 두면
                      한정어가 수치만큼 세게 읽혀서 값이 흐려진다 */}
                  {it.prefix ? (
                    <span style={{fontSize: it.hot ? 58 : 50, marginRight: 10,
                                  color: T.soft,
                                  fontFamily: 'A2Z Light, sans-serif'}}>{it.prefix}</span>
                  ) : null}
                  {it.display}
                  <span style={{fontSize: it.hot ? 66 : 56, marginLeft: 6,
                                color: it.hot ? T.ink : T.soft}}>{it.unit}</span>
                </span>
              ) : (
                <NumberIn to={it.value ?? 0} start={14 + i * 12} dur={44}
                          decimals={it.decimals ?? 0} unit={it.unit} unitSize={0.45}
                          size={it.hot ? 148 : 124} color={T.ink} align="center"
                          underline={it.hot ? YELLOW : null} />
              )}
            </div>
            <div style={{marginTop: 26, fontFamily: it.hot ? 'Pretendard Bold, A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                         fontSize: 46, color: T.ink, wordBreak: 'keep-all'}}>
              {it.hot ? <span style={{background: 'rgba(250,255,46,0.8)', padding: '2px 12px'}}>{it.label}</span> : it.label}
            </div>
            {it.sub ? (
              <div style={{marginTop: 10, fontFamily: 'A2Z Light, sans-serif', fontSize: 34, color: T.soft, wordBreak: 'keep-all'}}>
                {it.sub}
              </div>
            ) : null}
          </div>
        );
      })}
      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: 792, textAlign: 'center',
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 34, color: T.soft,
                     opacity: fadeIn(frame, 56), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
