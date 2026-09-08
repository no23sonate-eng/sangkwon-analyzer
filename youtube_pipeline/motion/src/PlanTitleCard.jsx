import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, fadeIn, LW} from './paper';
import {RoughTitle} from './annotate';

// 안(案) 제목 판 — §40-7. 거친 검정 박스 위 흰 글자, 줄마다 박스가 나뉜다.
// 배경엔 옛 도면·평면을 아주 옅게 깔 수 있다 (bg.backdrop + veil 0.94~0.96).
//
// ── 2026-09-08 · 장 제목이 작았다 ──────────────────────────────────────
//  ① 크기가 92/72 두 단으로 못 박혀 있었다. '식사' '돌봄' '특징' 처럼 두 글자
//     짜리 장 제목이 1920 화면 한가운데 92px 상자로 떠 있어, 장이 넘어간다는
//     신호가 아니라 **작은 라벨** 로 읽혔다. 제일 긴 줄에 맞춰 폭을 채운다
//  ② 장 번호를 글자 위에 그냥 얹어 뒀다. 이 채널 규칙은 **세로 줄 오른쪽에
//     01/02** 다 — 줄을 긋고 그 오른쪽에 두 자리로 건다
export const PlanTitleCard = ({
  kicker = '', lines = [], sub = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const ls = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);

  // 한글은 자간을 빼도 글자당 대략 1em 을 먹는다. 가장 긴 줄이 무대 폭
  // (1400) 을 채우는 크기를 구하고, 위아래로만 막는다
  const longest = Math.max(1, ...ls.map((t) => String(t).length));
  const cap = ls.length === 1 ? 168 : 138;   // 한 줄뿐이면 그 한 줄이 화면 전부다
  const size = Math.max(66, Math.min(cap, Math.floor(1400 / longest)));

  // 장 번호는 두 자리로 — 1 과 12 가 섞이면 자릿수가 흔들려 목차로 안 읽힌다
  const no = kicker === '' || kicker == null
    ? '' : (/^\d+$/.test(String(kicker)) ? String(kicker).padStart(2, '0') : String(kicker));

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <PaperBg theme={theme} {...bg} />
      <div style={{position: 'relative', textAlign: 'center'}}>
        {no ? (
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center',
                       gap: 22, marginBottom: 40, opacity: fadeIn(frame, 2, 14)}}>
            <div style={{width: LW.THIN, height: 68, background: T.ink, opacity: 0.85}} />
            <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 60,
                         letterSpacing: '0.04em', color: T.ink, lineHeight: 1,
                         fontVariantNumeric: 'tabular-nums'}}>
              {no}
            </div>
          </div>
        ) : null}
        <RoughTitle lines={ls} size={size}
                    reveal={fadeIn(frame, 6, 26)}
                    fill={T.ink} color={T.bg} kickerColor={T.ink} />
        {sub ? (
          <div style={{marginTop: 40, fontFamily: 'A2Z Light, sans-serif', fontSize: 34,
                       color: T.soft, opacity: fadeIn(frame, 34), wordBreak: 'keep-all'}}>
            {sub}
          </div>
        ) : null}
      </div>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
