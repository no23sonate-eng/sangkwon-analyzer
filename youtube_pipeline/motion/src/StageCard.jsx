import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile,
        useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperSource, YELLOW, OPTICAL_CENTER, CONTENT_BOTTOM, fadeIn, SP} from './paper';

// ── 실사 위에 한 문장 ─────────────────────────────────────────────────────
// **이 채널의 기본 처리다.** 도형이 설명할 게 없는 문장, 그리고 그 대상의
// 실제 사진을 못 구한 자리는 전부 여기로 온다.
//
// 왜 기본이어야 하나: B1M 은 실사가 주인공이고 도형은 **구조를 설명할 때만**
// 나온다. 우리는 카드를 여든 종 만들어 놓고 자료를 못 구한 자리마다 도형으로
// 메웠다. 그래서 그래픽 64% / 실사 23% 가 됐고, 화면이 슬라이드처럼 됐다.
// 자료가 없으면 도형을 그릴 게 아니라 **어울리는 화면을 구해 와야 한다.**
//
// 규칙 (2026-08-26 확정):
//   · 글자는 화면 한가운데. 위아래로도 가운데
//   · 굵기는 **A2Z Light**. 실사 위에서 굵은 글씨는 자막처럼 보인다
//   · 강조할 낱말만 옐로. 한 화면에 한 군데
//   · 문장이 아니라 **명사·숫자**. 나머지는 자막이 말한다
//
// lines: ['서울 도심이', [{t: '격전지', hot: true}, {t: '가 되고 있다'}]]
//   문자열이면 그대로, 배열이면 조각마다 hot 을 줄 수 있다
export const StageCard = ({
  media = '',              // 사진 또는 영상 (mp4/webm/mov 자동 판별)
  lines = [],
  kicker = '',             // 위에 작게 한 줄 (연도·분류)
  note = '',               // 아래 작게 한 줄 (근거·가정)
  scrim = 0.5,             // 실사를 누르는 정도. 밝은 화면일수록 올린다
  size = 0,                // 글자 크기를 직접 정할 때
  align = 'center',
  source = '', theme,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(String(media));
  const src = /^https?:/.test(media) ? media : staticFile(media);
  // 아주 느린 확대 — 멎은 화면은 몇 초만 지나도 슬라이드로 읽힌다
  const zoom = interpolate(frame, [0, Math.max(1, durationInFrames)], [1, 1.05],
                           {extrapolateRight: 'clamp'});

  // 한 줄은 문자열이거나 조각 배열이다. 조각 **안에도** 문자열이 올 수 있는데
  // (`[['서울 도심이'], [...]]` 처럼) 그걸 안 풀면 s.t 가 undefined 라 렌더가
  // TypeError 로 죽는다 (#132). 양쪽 다 받아 준다
  const rows = lines
    .map((l) => (typeof l === 'string' ? [{t: l}] : (Array.isArray(l) ? l : [l])))
    .map((segs) => segs.map((s) => (typeof s === 'string' ? {t: s} : s)))
    .filter((segs) => segs.some((s) => s && s.t));
  const longest = Math.max(1, ...rows.map((r) => r.reduce((a, s) => a + s.t.length, 0)));
  // 한 줄이 화면을 넘지 않게. 한글은 글자수 × 크기 에 가깝다
  const FS = size || Math.min(96, Math.max(46, Math.floor(1560 / longest)));
  const blockH = rows.length * FS * 1.34 + (kicker ? 64 : 0) + (note ? 62 : 0);
  let top = Math.round(OPTICAL_CENTER - blockH / 2);
  if (top + blockH > CONTENT_BOTTOM) top = CONTENT_BOTTOM - blockH;
  if (top < 120) top = 120;

  const SH = '0 3px 26px rgba(0,0,0,0.86)';

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Light, sans-serif', background: '#0B0E12'}}>
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        {isVid
          ? <OffthreadVideo src={src} muted
                            style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          : <Img src={src} style={{width: '100%', height: '100%', objectFit: 'cover'}} />}
      </AbsoluteFill>
      {/* 위아래로 살짝 더 눌러 준다 — 가운데 글자가 앉을 자리 */}
      <AbsoluteFill style={{background: `rgba(11,14,18,${scrim})`}} />
      <AbsoluteFill style={{background:
        'radial-gradient(120% 78% at 50% 50%, rgba(11,14,18,0.28) 0%, rgba(11,14,18,0) 62%)'}} />

      <div style={{position: 'absolute', left: 140, right: 140, top,
                   textAlign: align, opacity: fadeIn(frame, 6, 18)}}>
        {kicker ? (
          <div style={{marginBottom: SP.NEAR, fontSize: 28, letterSpacing: '0.18em',
                       color: 'rgba(255,255,255,0.72)', textShadow: SH}}>
            {kicker}
          </div>
        ) : null}
        {rows.map((segs, i) => (
          <div key={i} style={{fontSize: FS, lineHeight: 1.34, color: '#FFFFFF',
                               textShadow: SH, wordBreak: 'keep-all',
                               opacity: fadeIn(frame, 8 + i * 7, 16),
                               transform: `translateY(${(1 - fadeIn(frame, 8 + i * 7, 16)) * 14}px)`}}>
            {segs.map((s, j) => (
              <span key={j} style={s.hot ? {color: YELLOW} : undefined}>{s.t}</span>
            ))}
          </div>
        ))}
        {note ? (
          <div style={{marginTop: SP.GAP, fontSize: 28, letterSpacing: '0.02em',
                       color: 'rgba(255,255,255,0.7)', textShadow: SH,
                       opacity: fadeIn(frame, 26), wordBreak: 'keep-all'}}>
            {note}
          </div>
        ) : null}
      </div>

      <PaperSource source={source} theme={theme} onPhoto />
    </AbsoluteFill>
  );
};
