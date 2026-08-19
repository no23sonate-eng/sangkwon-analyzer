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

// ── 모션 예산 (2026-08-19, 사용자 지시) ─────────────────────────────────
// "모션이 다 똑같으면 안 된다. 강조할 때만 들어가야 한다."
//
// 문제: 지금까지는 모든 요소가 26프레임 동안 똑같이 밀려 올라오며 페이드했다.
// 전부가 움직이면 아무것도 강조되지 않는다.
//
// 해결: **일반 등장은 사실상 컷**으로 줄이고, 움직임은 그 화면의 주인공
// (카운트업·선 드로잉·막대 성장·형광펜)에만 남긴다.
//
//   still  — 전부 컷. 빠르게 넘기는 구간
//   accent — 기본. 일반 요소는 컷에 가깝게, 주인공 연출만 살린다
//   full   — 예전 방식. 막의 첫 장면처럼 "펼쳐 보일" 때만
//
// 모드는 장면 props 의 motion 으로 정하고, Root 에서 렌더 직전에 심는다.
// (Remotion 은 한 프레임을 한 트리로 그리므로 모듈 변수로 안전하다)
const MODE = {current: 'accent'};
export const setMotionMode = (m) => {
  MODE.current = m === 'still' || m === 'full' ? m : 'accent';
};
export const getMotionMode = () => MODE.current;

// 일반 등장의 길이·거리를 모드에 따라 줄인다
const genericDur = (dur) => (MODE.current === 'full' ? dur : MODE.current === 'still' ? 1 : Math.min(dur, 8));
const genericDist = (dist) => (MODE.current === 'full' ? dist : MODE.current === 'still' ? 0 : Math.min(dist, 8));
// 주인공 연출(카운트업·드로잉·성장)은 still 에서만 끈다
export const accentDur = (dur) => (MODE.current === 'still' ? 1 : dur);
export const genericFadeLen = (len) =>
  (MODE.current === 'full' ? len : MODE.current === 'still' ? 1 : Math.min(len, 6));

const ramp = (frame, start, dur, easing) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

// 아래에서 밀려 올라오며 나타남 — 가장 많이 쓰는 등장
export const useRevealUp = (start = 0, dur = 26, dist = 34) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, start, genericDur(dur), EASE.outExpo);
  const d = genericDist(dist);
  return {opacity: t, transform: d ? `translateY(${(1 - t) * d}px)` : 'none'};
};

// 스태거 — 목록이 순차로 등장할 때 지연을 계산
export const stagger = (i, step = 5, base = 0) => {
  if (MODE.current === 'still') return 0;
  if (MODE.current === 'accent') return base + i * Math.min(step, 3);
  return base + i * step;
};

// 숫자 카운트업 — 정수는 천단위 콤마, 소수는 자릿수 고정
export const useCountUp = (target, start = 8, dur = 44, decimals = 0) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, start, accentDur(dur), EASE.outQuint);
  const v = target * t;
  return decimals === 0
    ? Math.round(v).toLocaleString('en-US')
    : v.toFixed(decimals);
};

// 마스크 와이프 — 콘텐츠가 "닦여 나오는" 연출 (타이포·바에 쓴다)
export const Wipe = ({start = 0, dur = 26, dir = 'left', children, style}) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, start, accentDur(dur), EASE.outExpo);
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
  const t = ramp(frame, start, accentDur(dur), EASE.outExpo);
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
