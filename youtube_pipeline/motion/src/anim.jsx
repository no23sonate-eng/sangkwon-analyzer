import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';

// ── 모션 프리미티브 (2026-08-19) ───────────────────────────────────────
// 지금까지는 spring + fade 뿐이라 "떠오르고 끝"이었다. 모션그래픽의 기본
// 문법(이징 곡선·마스크 리빌·선 드로잉·카운트업·스태거)을 갖춘다.

// 이징 — 방송 그래픽은 대부분 "빠르게 나가고 천천히 멎는" 곡선을 쓴다.
export const EASE = {
  outExpo: Easing.bezier(0.16, 1, 0.3, 1), // 기본 등장
  outQuint: Easing.bezier(0.22, 1, 0.36, 1), // 숫자 카운트
  inOut: Easing.bezier(0.65, 0, 0.35, 1), // 전환
  outBack: Easing.bezier(0.34, 1.4, 0.64, 1), // 살짝 오버슈트
};

const ramp = (frame, start, dur, easing) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

// 아래에서 밀려 올라오며 나타남 — 가장 많이 쓰는 등장
export const useRevealUp = (start = 0, dur = 26, dist = 34) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, start, dur, EASE.outExpo);
  return {opacity: t, transform: `translateY(${(1 - t) * dist}px)`};
};

// 스태거 — 목록이 순차로 등장할 때 지연을 계산
export const stagger = (i, step = 5, base = 0) => base + i * step;

// 숫자 카운트업 — 정수는 천단위 콤마, 소수는 자릿수 고정
export const useCountUp = (target, start = 8, dur = 44, decimals = 0) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, start, dur, EASE.outQuint);
  const v = target * t;
  return decimals === 0
    ? Math.round(v).toLocaleString('en-US')
    : v.toFixed(decimals);
};

// 마스크 와이프 — 콘텐츠가 "닦여 나오는" 연출 (타이포·바에 쓴다)
export const Wipe = ({start = 0, dur = 26, dir = 'left', children, style}) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, start, dur, EASE.outExpo);
  const pct = (1 - t) * 100;
  const inset =
    dir === 'left' ? `inset(0 ${pct}% 0 0)`
      : dir === 'up' ? `inset(${pct}% 0 0 0)`
        : `inset(0 0 ${pct}% 0)`;
  return <div style={{...style, clipPath: inset, WebkitClipPath: inset}}>{children}</div>;
};

// 선 드로잉 — path 가 그려지는 연출 (차트·리더라인·연결선)
export const DrawPath = ({d, start = 0, dur = 32, length = 2000, ...rest}) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, start, dur, EASE.outExpo);
  return (
    <path
      d={d}
      fill="none"
      strokeDasharray={length}
      strokeDashoffset={length * (1 - t)}
      {...rest}
    />
  );
};

// 값이 바뀔 때 쓰는 크로스페이드 (2단계 전환 카드용)
export const useCrossfade = (switchFrame, dur = 14) => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [switchFrame, switchFrame + dur], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.inOut,
  });
  const inn = interpolate(frame, [switchFrame + dur * 0.4, switchFrame + dur * 1.6], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
  });
  return {out, in: inn};
};
