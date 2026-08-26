import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, ValueChip, CONTENT_BOTTOM, fadeIn, SP, LW} from './paper';
import {fit, estWidth} from './layout';

// ── 실루엣 비교 ───────────────────────────────────────────────────────────
// B1M 은 건물을 비교할 때 **실제 형상 실루엣**을 쓴다 (§40-9).
// One World Trade Centre 의 첨탑, Empire State Building 의 계단식 후퇴,
// 111W57 의 뾰족함이 전부 살아 있다. 우리 `ShapeCompareCard` 는 추상 사각형이라
// "396억 vs 541억" 같은 값 비교엔 맞지만 **건물을 비교할 때는 형상이 있어야** 한다.
//
// 왜 형상이 필요한가: 사각형 두 개는 "높이가 다르다" 까지만 말한다. 실루엣은
// 거기에 **"이건 저 건물이다"** 를 얹는다. 아는 건물이 하나라도 섞여 있으면
// 나머지 건물의 크기가 그 하나를 기준으로 즉시 읽힌다 — 축척이 공짜로 생긴다.
//
// 실루엣은 프로젝트마다 **직접 그려 넣는다.** 사진에서 자동으로 윤곽을 따는 건
// 거리 사진에서는 신뢰할 수 없다 (배경 건물과 붙어 나온다). 대신 경로는
// 0~100 정사각 좌표계로 그려 두고 여기서 실제 높이에 맞춰 늘린다.
//
// items: [{path, hm, label, value, hot, tone}]
//   path  0~100 × 0~100 좌표계의 SVG path. **바닥이 y=100, 위가 y=0**
//   hm    실제 높이(m). 이걸로 세로 축척을 잡는다. 없으면 전부 같은 높이
//   value 실루엣 아래 색 칩에 들어갈 값 ("1:24", "435m")
export const SilhouetteCompareCard = ({
  title = '', sub = '',
  items = [], baseline = true,
  caption = '', source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = items.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const bandTop = title ? (sub ? 300 : 250) : 170;
  const hasVal = items.some((it) => it.value);
  // 아래에서부터 자리를 뺀다: 값 칩 → 이름 → 바닥선
  const VALH = hasVal ? 74 : 0;
  const NAMEH = 78;
  const BOT = CONTENT_BOTTOM - VALH - NAMEH;
  const TOP = bandTop + SP.GAP;
  const H = BOT - TOP;                       // 가장 높은 건물이 쓸 높이

  const maxH = Math.max(...items.map((it) => it.hm || 1));
  const slot = Math.min(360, 1680 / n);
  const x0 = (1920 - slot * n) / 2;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 바닥선 하나로 정렬 — 이게 없으면 실루엣이 공중에 뜬다 */}
        {baseline ? (
          <line x1={x0 - 30} y1={BOT} x2={x0 + slot * n + 30} y2={BOT}
                stroke={T.ink} strokeWidth={LW.BODY} opacity={0.85 * fadeIn(frame, 6)} />
        ) : null}
        {items.map((it, i) => {
          const e = spring({frame: frame - (12 + i * 7), fps,
                            config: {damping: 200, mass: 0.8}});
          if (e <= 0.001) return null;
          const hh = H * ((it.hm || maxH) / maxH) * e;
          // 가로는 세로에 매다는 게 기본이지만 **바닥을 둔다.**
          // 9m 건물을 78m 옆에 세우면 가로도 9/78 이 되어 실오라기가 된다
          // (실제로 그렇게 나왔다). 높이 비교에서 가로까지 엄밀할 이유는 없고,
          // 안 보이면 비교 자체가 성립하지 않는다.
          // 폭이 논점인 컷은 wm(실제 폭)을 주면 그 비율로 그린다 — 그때는
          // 바닥을 적용하지 않는다. 축척을 말해 놓고 어기면 안 된다.
          const cw = it.wm
            ? Math.min(slot - 30, (H / maxH) * it.wm * e)
            : Math.min(slot - 40, Math.max(64, hh * 0.42));
          const cx = x0 + slot * i + slot / 2;
          const tone = it.hot ? T.ink : (it.tone || T.tones[i % T.tones.length]);
          return (
            <g key={i} transform={`translate(${cx - cw / 2}, ${BOT - hh}) scale(${cw / 100}, ${hh / 100})`}>
              {/* path 를 안 주면 **아무것도 안 그려진다.** #40 이 그랬다 —
                  바닥선과 이름만 남고 건물 두 채가 통째로 사라진 채
                  렌더가 [ok] 로 끝났다. 형상을 모르면 납작한 덩어리로라도
                  세운다. 높이 비교는 그것만으로도 성립한다 */}
              <path d={it.path || 'M0 100 L0 6 L100 6 L100 100 Z'} fill={tone} />
            </g>
          );
        })}
      </svg>

      {items.map((it, i) => {
        const o = fadeIn(frame, 30 + i * 7);
        if (o <= 0.01) return null;
        const cx = x0 + slot * i + slot / 2;
        return (
          <div key={i} style={{position: 'absolute', left: cx - slot / 2, width: slot,
                               top: BOT + 16, textAlign: 'center', opacity: o}}>
            <div style={{fontFamily: it.hot
                           ? 'A2Z Medium, sans-serif'
                           : 'A2Z Regular, sans-serif',
                         fontSize: fit(it.label || '', 34, slot - 16),
                         lineHeight: 1.22, color: T.ink, wordBreak: 'keep-all'}}>
              {it.label}
            </div>
            {it.value ? (
              <div style={{marginTop: SP.NEAR}}>
                <ValueChip size={34} hot={it.hot} theme={theme}>{it.value}</ValueChip>
              </div>
            ) : null}
          </div>
        );
      })}

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 26,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 30,
                     color: T.soft, opacity: fadeIn(frame, 60), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};

// ── 윤곽 모음 ─────────────────────────────────────────────────────────────
// 0~100 정사각 좌표계. 바닥 y=100, 꼭대기 y=0. 프로젝트가 늘면 여기에 더한다.
// **정확한 도면이 아니라 알아볼 수 있는 실루엣**이 목표다 — 형상의 성격
// (계단식인지, 뾰족한지, 통짜인지)만 맞으면 축척은 hm 이 잡는다.
export const OUTLINE = {
  // 통짜 판상 — 저층 상가/오피스
  slab: 'M12,100 L12,16 L88,16 L88,100 Z',
  // 계단식 후퇴 — 옛 마천루(엠파이어 스테이트 결)
  setback: 'M8,100 L8,52 L24,52 L24,30 L40,30 L40,12 L46,12 L46,4 L54,4 L54,12 L60,12 '
         + 'L60,30 L76,30 L76,52 L92,52 L92,100 Z',
  // 초슬림 — 좁고 아주 높고 꼭대기가 가늘어진다 (111W57 결)
  slim: 'M38,100 L38,88 L30,88 L30,76 L44,76 L46,10 L50,0 L54,10 L56,76 L70,76 L70,88 '
      + 'L62,88 L62,100 Z',
  // 저층 박스 + 셋백 한 단 — 성수동 근생 결
  lowrise: 'M6,100 L6,40 L70,40 L70,22 L94,22 L94,100 Z',
  // 첨탑 있는 타워
  spire: 'M20,100 L20,24 L48,24 L48,8 L50,0 L52,8 L52,24 L80,24 L80,100 Z',
};
