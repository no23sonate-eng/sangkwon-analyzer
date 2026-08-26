import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, ValueChip, YELLOW, CONTENT_BOTTOM, fadeIn, SP} from './paper';

// ── 같은 돈을 더 넓은 바닥에 펴면 얇아진다 ────────────────────────────────
// "디럭스는 슈페리어보다 49% 넓은데 요금은 10%만 비싸다. 그래서 ㎡당 단가는
//  22,892원에서 16,879원으로 오히려 떨어진다."
//
// 이 문장의 함정: 숫자만 보면 **디럭스가 더 비싸다.** 실제로 더 비싸다.
// 그런데 결론은 "더 싸다" 다. 단위가 바뀌었기 때문인데, 막대 두 개로 그리면
// 그 단위 전환이 안 보이고 그냥 앞뒤가 안 맞는 그래프가 된다.
//
// 그래서 **나누는 걸 그리지 않고 펴 바르는 걸 그린다.**
//   ① 방 두 개를 진짜 면적 비율로 그린다  — 디럭스가 눈에 띄게 넓다
//   ② 요금을 같은 크기의 칸으로 쌓아 그 바닥에 깐다 — 개수는 10%만 많다
//   ③ 넓은 방에는 **빈 바닥이 남는다** ← 이게 ㎡당 단가 하락이다
// 빈 바닥이 곧 결론이다. 말로 "단가가 떨어진다" 고 하기 전에 이미 보인다.
//
// items : [{name, area, areaLabel, price, priceLabel, unit, unitLabel}]
//   area   ㎡ (숫자). 방 크기는 이 값의 **면적 비율**로 그린다
//   price  요금 (숫자). 칸 개수를 정하는 데만 쓴다
//   unit   ㎡당 단가 — **받는다.** 여기서 나누지 않는다 (반올림이 출처마다 다르다)
// hot   강조할 항목 index. 보통 "의외로 싼 쪽"
export const UnitDensityCard = ({
  title = '', sub = '',
  items = [], hot = -1,
  blockLabel = '',            // 칸 하나가 얼마인지 (예: '한 칸 = 5만원')
  caption = '', source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const list = items.slice(0, 3);
  if (list.length === 0) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const bandTop = title ? (sub ? 300 : 248) : 176;
  const BOT = CONTENT_BOTTOM - (caption ? 62 : 0);

  const NAMEH = 96;                       // 방 이름 + 면적 + 요금
  const FOOTH = 128;                      // 아래 ㎡당 단가 칩
  const roomBand = BOT - bandTop - NAMEH - FOOTH;

  // ① 면적 비율대로. 방은 가로:세로를 통일한 직사각형으로 그린다 — 실제 평면은
  // 제각각이지만 모양이 다르면 면적 비교가 흐려진다. 여기서 비교하는 건 넓이다.
  // 가로로 납작하게(2.2) 잡는다. 제목·칩을 빼고 나면 세로가 250px 밖에 안 남아
  // 정사각형에 가깝게 잡으면 방이 우표만 해지고 가로는 절반이 논다
  const AR = 2.2;
  const dims = list.map((it) => {
    const a = Math.max(1, Number(it.area) || 1);
    return {w: Math.sqrt(a * AR), h: Math.sqrt(a / AR)};
  });
  const gapPx = 150;
  const totalW = dims.reduce((s, d) => s + d.w, 0);
  const maxH = Math.max(...dims.map((d) => d.h));
  const availW = 1560 - gapPx * (list.length - 1);
  const scale = Math.min(availW / totalW, roomBand / maxH);

  const px = dims.map((d) => ({w: d.w * scale, h: d.h * scale}));
  const rowW = px.reduce((s, d) => s + d.w, 0) + gapPx * (list.length - 1);
  const x0 = (1920 - rowW) / 2;
  const baseY = bandTop + NAMEH + roomBand;      // 바닥선 — 방들을 아래로 맞춘다

  // ② 칸 하나 — **모든 방에서 같은 크기, 같은 금액.**
  // 처음엔 방마다 칸 수에 맞춰 격자를 다시 짰는데, 그러면 칸 크기가 방마다
  // 달라져서 두 방 다 꽉 찬 것처럼 보였다. 이 카드가 말하려던 "빈 바닥" 이
  // 통째로 사라진 것이다. 칸이 같은 크기여야 비교가 성립한다.
  //
  // 기준은 **㎡당 단가가 제일 높은 방**. 그 방이 딱 채워지도록 칸 값을 정하면,
  // 나머지 방이 비는 만큼이 곧 ㎡당 단가가 낮은 만큼이다 — 눈금 없이 비율이 맞는다
  const dens = list.map((it) => (Number(it.price) || 0) / Math.max(1, Number(it.area) || 1));
  const ri = dens.indexOf(Math.max(...dens));
  const blockArea = Math.max(0.05, (Number(list[ri].area) || 1) / 60);   // ㎡/칸
  const per = blockArea * dens[ri];                                      // 원/칸
  const bs = Math.sqrt(blockArea) * scale;                               // 칸 한 변 (px)

  const grow = spring({frame: frame - 6, fps, config: {damping: 200, mass: 0.9}});
  const pour = interpolate(frame, [26, 74], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  let cx = x0;
  const laid = px.map((d, i) => {
    const at = cx;
    cx += d.w + gapPx;
    return {...d, x: at, it: list[i]};
  });

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {laid.map((r, i) => {
          const h = r.h * grow;
          const y = baseY - h;
          const on = i === hot;
          // 칸 크기는 고정(bs). 방 폭에 몇 개 들어가는지가 방마다 다를 뿐이다
          const n = Math.max(1, Math.round((Number(r.it.price) || 0) / per));
          const bc = Math.max(1, Math.floor(r.w / bs));
          const bw = r.w / bc, bh = bs;
          const shown = Math.round(n * pour);
          return (
            <g key={i}>
              {/* 방 — 테두리만. 채우면 아래 깔리는 칸이 안 보인다 */}
              <rect x={r.x} y={y} width={r.w} height={h}
                    fill={T.tones[0]} opacity={0.55}
                    stroke={T.ink} strokeWidth={on ? 4 : 2.5} />
              {/* ② 요금을 칸으로 깔기 — 바닥부터 왼쪽→오른쪽, 아래→위 */}
              {Array.from({length: shown}, (_, k) => {
                const bcol = k % bc, brow = Math.floor(k / bc);
                const bx = r.x + bcol * bw;
                const by = baseY - (brow + 1) * bh;
                if (by < y) return null;             // 방 밖으로는 안 쌓는다
                return (
                  <rect key={k} x={bx + 1.2} y={by + 1.2}
                        width={Math.max(0, bw - 2.4)} height={Math.max(0, bh - 2.4)}
                        fill={on ? YELLOW : T.ink} opacity={on ? 1 : 0.82} />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* 방 이름 + 면적 — 방 위에 */}
      {laid.map((r, i) => (
        <div key={i} style={{position: 'absolute', left: r.x, width: r.w,
                             top: baseY - r.h - NAMEH + 4, textAlign: 'center',
                             opacity: fadeIn(frame, 4 + i * 4)}}>
          <div style={{fontFamily: 'A2Z Medium, sans-serif',
                       fontSize: 36, color: T.ink, wordBreak: 'keep-all'}}>
            {r.it.name}
          </div>
          {/* 면적과 요금은 한 줄로 붙인다. 요금을 방 아래로 내렸더니 칩까지
              세 줄이 되어 방 높이를 250px 밑으로 밀어냈다 */}
          {(r.it.areaLabel || r.it.priceLabel) ? (
            <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: 28, color: T.soft, fontVariantNumeric: 'tabular-nums'}}>
              {[r.it.areaLabel, r.it.priceLabel].filter(Boolean).join('  ·  ')}
            </div>
          ) : null}
        </div>
      ))}

      {/* ㎡당 단가 — 방 아래. 결론이라 칩으로 박는다 */}
      {laid.map((r, i) => (
        <div key={i} style={{position: 'absolute', left: r.x - 40, width: r.w + 80,
                             top: baseY + SP.NEAR, textAlign: 'center',
                             opacity: fadeIn(frame, 78 + i * 5)}}>
          <ValueChip size={r.it.unit && String(r.it.unit).length > 11 ? 40 : 48}
                     hot={i === hot} theme={theme}>
            {r.it.unit}
          </ValueChip>
          {r.it.unitLabel ? (
            <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: 24, color: T.soft}}>{r.it.unitLabel}</div>
          ) : null}
        </div>
      ))}

      {/* 칸 하나가 얼마인지 — 안 적으면 칸이 그냥 무늬가 된다 */}
      {blockLabel ? (
        <div style={{position: 'absolute', right: 96, top: bandTop - 8,
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 24, color: T.soft,
                     opacity: fadeIn(frame, 30)}}>
          {blockLabel}
        </div>
      ) : null}

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 22,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 28,
                     color: T.soft, opacity: fadeIn(frame, 92), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
