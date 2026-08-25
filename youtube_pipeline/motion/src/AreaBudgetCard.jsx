import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, ValueChip, YELLOW, CONTENT_BOTTOM, fadeIn, SP} from './paper';
import {fit} from './layout';

// ── 면적 예산 ─────────────────────────────────────────────────────────────
// "대지가 200평이 채 안 되기 때문에 자주식 주차도 쉽지 않습니다" —
// 이 문장은 **면적이 무엇에 먹히는가**에 대한 이야기다. 그런데 지금까지는
// 숫자만 띄우고 넘어갔다. 197평이 얼마나 작은지는 197 이라는 글자에 안 들어 있다.
//
// B1M 이 432 Park Avenue 에서 `25% Reserved for equipment` 를 보여 준 방식이
// 답이다 — **형상 위에 그 몫을 직접 칠한다.** 전체를 그려 놓고 하나씩 떼어 가면
// 남는 게 눈에 보이고, "쉽지 않다" 가 왜 쉽지 않은지가 그림으로 끝난다.
//
// 세로 막대가 아니라 **평면 사각형**으로 그리는 이유: 대지는 면적이고, 면적을
// 길이로 바꾸면 "얼마나 좁은지" 가 안 나온다. 사각형이 채워지는 걸 봐야
// 남은 자리가 얼마나 되는지 몸으로 읽힌다.
//
// total   전체 면적 (숫자) + unit
// items   [{area, label, note, hot}] — 위에서부터 띠로 쌓인다. 합이 total 을
//         넘으면 **넘친 만큼이 붉게 삐져나온다.** 안 들어간다는 걸 그림으로 말한다
export const AreaBudgetCard = ({
  title = '', sub = '',
  total = 100, unit = '평', totalLabel = '',
  items = [],
  caption = '', source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  if (!items.length) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const bandTop = title ? (sub ? 296 : 244) : 168;
  const BOT = CONTENT_BOTTOM - (caption ? 74 : 0);
  const H = Math.min(470, BOT - bandTop - SP.BLOCK);
  const W = Math.round(H * 1.36);                 // 대지는 대개 가로가 조금 길다
  const X = 300, Y = Math.round(bandTop + (BOT - bandTop - H) / 2);

  const used = items.reduce((a, b) => a + (b.area || 0), 0);
  const over = Math.max(0, used - total);
  const rest = Math.max(0, total - used);

  // 띠는 하나씩 차례로 쌓인다 — 동시에 나타나면 "이만큼 먹힌다" 는 순서가 사라진다
  const step = 26;
  const at = (i) => interpolate(frame, [18 + i * step, 18 + i * step + 22], [0, 1],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  let acc = 0;
  const bands = items.map((it, i) => {
    const y0 = Y + (acc / total) * H;
    const h = ((it.area || 0) / total) * H * at(i);
    acc += it.area || 0;
    return {...it, y0, h, i};
  });

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 대지 — 점선 테두리. 확정된 경계가 아니라 "이만큼이 전부" 라는 틀이다 */}
        <rect x={X} y={Y} width={W} height={H} fill="none"
              stroke={T.ink} strokeWidth={3} strokeDasharray="12 9"
              opacity={0.75 * fadeIn(frame, 4)} />

        {bands.map((b) => (
          <g key={b.i}>
            <rect x={X} y={b.y0} width={W} height={Math.max(0, b.h)}
                  fill={b.hot ? YELLOW : T.tones[b.i % T.tones.length]}
                  opacity={b.hot ? 1 : 0.9} />
            <line x1={X} y1={b.y0} x2={X + W} y2={b.y0}
                  stroke={T.bg} strokeWidth={2} opacity={0.6} />
          </g>
        ))}

        {/* 넘친 몫 — 대지 밖으로 삐져나온다. "안 들어간다" 를 글자 없이 말한다 */}
        {over > 0 ? (
          <rect x={X} y={Y + H} width={W} height={(over / total) * H * at(items.length - 1)}
                fill={T.ink} opacity={0.9} />
        ) : null}

        {/* 남는 자리 — 아무것도 안 칠한 채 남겨 둔다. 칠하면 그것도 용도가 된다 */}
        {rest > 0 && at(items.length - 1) > 0.9 ? (
          <g opacity={fadeIn(frame, 18 + items.length * step)}>
            <line x1={X + 18} y1={Y + (used / total) * H + 16}
                  x2={X + W - 18} y2={Y + H - 16}
                  stroke={T.soft} strokeWidth={2} opacity={0.4} />
          </g>
        ) : null}
      </svg>

      {/* 전체 크기 — 대지 왼쪽 위 */}
      <div style={{position: 'absolute', left: X, top: Y - 62, opacity: fadeIn(frame, 4)}}>
        <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 46,
                      color: T.ink, fontVariantNumeric: 'tabular-nums'}}>
          {total}{unit}
        </span>
        {totalLabel ? (
          <span style={{marginLeft: SP.NEAR, fontFamily: 'A2Z Light, sans-serif',
                        fontSize: 30, color: T.soft}}>{totalLabel}</span>
        ) : null}
      </div>

      {/* 범례 — 띠와 같은 순서로. 띠 옆에 직접 쓰면 얇은 띠에서 글자가 넘친다 */}
      <div style={{position: 'absolute', left: X + W + 90, top: Y - 8,
                   width: 1920 - (X + W + 90) - 140}}>
        {bands.map((b) => (
          <div key={b.i} style={{display: 'flex', alignItems: 'baseline', gap: SP.NEAR,
                                 marginBottom: SP.GAP, opacity: at(b.i)}}>
            <span style={{width: 26, height: 26, borderRadius: 3, flexShrink: 0,
                          alignSelf: 'center',
                          background: b.hot ? YELLOW : T.tones[b.i % T.tones.length]}} />
            <div>
              <div style={{fontFamily: b.hot
                             ? 'A2Z Medium, sans-serif'
                             : 'A2Z Regular, sans-serif',
                           fontSize: fit(b.label || '', 40, 620), color: T.ink,
                           wordBreak: 'keep-all'}}>
                {b.label}
              </div>
              {b.note ? (
                <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif',
                             fontSize: 26, color: T.soft, wordBreak: 'keep-all'}}>
                  {b.note}
                </div>
              ) : null}
            </div>
            <div style={{marginLeft: 'auto'}}>
              <ValueChip size={30} hot={b.hot} theme={theme}>{b.area}{unit}</ValueChip>
            </div>
          </div>
        ))}

        {/* 결론 한 줄 — 남거나 넘치거나.
            **항목이 전체를 정확히 채우면 안 쓴다.** 마지막 항목이 곧 잔여인데
            아래에 "남는 면적 0평" 이 또 뜨면 읽는 사람이 둘을 견주게 된다 */}
        {(over > 0 || rest >= 1) && at(items.length - 1) > 0.9 ? (
          <div style={{marginTop: SP.BLOCK, paddingTop: SP.GAP,
                       borderTop: `2px solid ${T.ink}`,
                       opacity: fadeIn(frame, 18 + items.length * step)}}>
            <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft}}>
              {over > 0 ? '모자란 면적' : '남는 면적'}
            </span>
            <span style={{marginLeft: SP.GAP, fontFamily: 'A2Z Medium, sans-serif',
                          fontSize: 54, color: over > 0 ? T.ink : T.ink,
                          fontVariantNumeric: 'tabular-nums'}}>
              {over > 0 ? `-${Math.round(over)}` : Math.round(rest)}{unit}
            </span>
          </div>
        ) : null}
      </div>

      {caption ? (
        <div style={{position: 'absolute', left: X, width: W, top: Y + H + SP.GAP,
                     textAlign: 'left', fontFamily: 'A2Z Light, sans-serif', fontSize: 27,
                     color: T.soft, opacity: fadeIn(frame, 20 + items.length * step),
                     wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
