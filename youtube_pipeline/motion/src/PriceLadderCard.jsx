import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, ValueChip, YELLOW, CONTENT_BOTTOM, fadeIn, SP} from './paper';

// ── 비어 있던 칸에 들어앉는다 ─────────────────────────────────────────────
// "롯데호텔 서울 위, 시그니엘 아래. 그 사이가 비어 있었고 더그랜드롯데가
//  그 자리를 가져간다."
//
// 이건 가격 비교가 아니라 **자리 이야기**다. 막대 세 개로 그리면 "얘가 중간이네"
// 로 끝나고, 정작 중요한 "그 자리가 원래 비어 있었다" 는 사라진다.
// 순서가 결론을 만든다:
//   ① 기존 두 칸만 그어진다        — 위아래가 먼저 있다
//   ② 그 사이가 점선으로 드러난다  — **여기가 비어 있다**
//   ③ 새 브랜드가 그 칸에 앉는다   — 채워지는 걸 본다
// ②를 빼면 이 카드는 그냥 막대그래프다. ②가 이 카드의 전부다.
//
// rungs : [{name, price, priceLabel, note}]  price 는 숫자 (칸 높이 결정)
// fill  : 새로 들어앉는 칸의 index. -1 이면 그냥 사다리만 그린다
// axisLabel : 세로축이 무엇인지 (예: '1박 기준 공시 요금')
export const PriceLadderCard = ({
  title = '', sub = '',
  rungs = [], fill = -1, axisLabel = '',
  caption = '', source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const list = rungs.slice(0, 5);
  if (list.length === 0) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const bandTop = title ? (sub ? 296 : 244) : 172;
  const BOT = CONTENT_BOTTOM - (caption ? 58 : 0);

  const LX = 430, RX = 1500;
  // 칸 이름이 칸 **위**에 붙으므로 맨 위 칸은 제목에서 한 줄만큼 떨어뜨린다
  const yTop = bandTop + 86, yBot = BOT - 18;

  const ps = list.map((r) => Number(r.price) || 0);
  const hi = Math.max(...ps), lo = Math.min(...ps);
  // 0 부터 그리지 않는다. 사다리는 **칸 사이 간격**을 보여주는 그림이고,
  // 0 을 넣으면 세 칸이 위쪽에 몰려 붙어 버려 사이가 비었다는 게 안 보인다.
  // 대신 축이 0 이 아니라는 걸 axisLabel 로 반드시 밝힌다
  const span = Math.max(1, hi - lo);
  const yOf = (p) => yBot - ((p - lo) / span) * (yBot - yTop);

  // ① 기존 칸 → ② 빈 칸 점선 → ③ 새 칸
  const draw = interpolate(frame, [8, 40], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const hole = interpolate(frame, [48, 66], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const seat = spring({frame: frame - 78, fps, config: {damping: 200, mass: 0.8}});

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 사다리 기둥 — 위에서 아래로 그어진다 */}
        <line x1={LX} y1={yTop} x2={LX} y2={yTop + (yBot - yTop) * draw}
              stroke={T.ink} strokeWidth={3} opacity={0.5} />

        {list.map((r, i) => {
          const y = yOf(Number(r.price) || 0);
          const isNew = i === fill;
          // 새 칸은 ③ 에서만 실선. 그 전엔 ② 의 점선(빈 칸)이다
          const a = isNew ? seat : draw;
          if (a <= 0.01 && !(isNew && hole > 0)) return null;
          if (isNew && seat < 0.02) {
            return (
              <g key={i}>
                <line x1={LX} y1={y} x2={LX + (RX - LX) * hole} y2={y}
                      stroke={T.ink} strokeWidth={4} strokeDasharray="16 14" opacity={0.55 * hole} />
              </g>
            );
          }
          return (
            <g key={i}>
              {isNew ? (
                // 앉는 순간을 보이게 — 칸이 살짝 위에서 내려온다
                <line x1={LX} y1={y - (1 - a) * 26} x2={LX + (RX - LX) * a} y2={y - (1 - a) * 26}
                      stroke={YELLOW} strokeWidth={12} opacity={a} />
              ) : null}
              <line x1={LX} y1={isNew ? y - (1 - a) * 26 : y}
                    x2={LX + (RX - LX) * a} y2={isNew ? y - (1 - a) * 26 : y}
                    stroke={T.ink} strokeWidth={isNew ? 4 : 3} opacity={isNew ? a : 0.8 * a} />
            </g>
          );
        })}
      </svg>

      {/* 이름은 칸 **위**에, 금액은 칸 오른쪽 끝에.
          채널 규칙대로 막대 위에 숫자를 얹지 않는다 — 금액은 칸 끝으로 뺀다 */}
      {list.map((r, i) => {
        const y = yOf(Number(r.price) || 0);
        const isNew = i === fill;
        const a = isNew ? seat : draw;
        const dy = isNew ? -(1 - a) * 26 : 0;
        if (isNew && seat < 0.02) {
          return (
            <div key={i} style={{position: 'absolute', left: LX + 26, top: y - 52,
                                 opacity: 0.6 * hole,
                                 fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft}}>
              비어 있던 자리
            </div>
          );
        }
        return (
          <div key={i} style={{position: 'absolute', left: LX + 26, width: RX - LX - 26,
                               top: y + dy - (isNew ? 62 : 54), opacity: a,
                               display: 'flex', alignItems: 'flex-end',
                               justifyContent: 'space-between', gap: SP.GAP}}>
            <div>
              <span style={{fontFamily: 'A2Z Medium, sans-serif',
                            fontSize: isNew ? 46 : 38, color: T.ink, wordBreak: 'keep-all'}}>
                {r.name}
              </span>
              {r.note ? (
                <span style={{marginLeft: SP.NEAR, fontFamily: 'A2Z Light, sans-serif',
                              fontSize: 27, color: T.soft}}>{r.note}</span>
              ) : null}
            </div>
            {r.priceLabel ? (
              isNew
                ? <ValueChip size={38} hot theme={theme}>{r.priceLabel}</ValueChip>
                : <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 34, color: T.ink,
                                fontVariantNumeric: 'tabular-nums'}}>{r.priceLabel}</span>
            ) : null}
          </div>
        );
      })}

      {/* 축이 0 에서 시작하지 않는다는 걸 밝힌다 */}
      {axisLabel ? (
        <div style={{position: 'absolute', left: LX - 300, width: 280, top: yTop - 4,
                     textAlign: 'right', fontFamily: 'A2Z Light, sans-serif', fontSize: 28,
                     color: T.soft, opacity: fadeIn(frame, 6), wordBreak: 'keep-all'}}>
          {axisLabel}
        </div>
      ) : null}

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 26,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 29,
                     color: T.soft, opacity: fadeIn(frame, 96), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
