import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {PAPER} from './paper';

// 컷 전환·강조 래퍼 — 카드를 다시 그리지 않고 **움직임만** 얹는다.
// B1M "Is This New York Skyscraper Cursed?" 에서 관찰한 3가지 동작:
//   ① 밀고 들어오기(push in)  — 하드컷 대신 방향을 가진 진입. 스프링으로 안착.
//   ② 서서히 밀기(slow push)  — 홀드 구간 내내 아주 느린 스케일 인. 정지 화면을 없앤다.
//   ③ 밀고 나가기(push out)   — 다음 컷이 같은 방향으로 이어받아 흐름이 끊기지 않음.
//
// dir     'left' | 'right' | 'up' | 'down'  — 진입/퇴장 방향
// enterF  진입에 쓰는 프레임 수 (기본 16 — 0.53초. 그 이상은 굼뜨게 느껴짐)
// exitF   퇴장 프레임 수 (0 이면 퇴장 없음 — 마지막 컷)
// push    홀드 구간 스케일 증가폭 (0.05 = 5%. 0.08 넘기면 "줌"으로 읽혀 과함)
// punchAt 이 프레임에서 한 번 더 강조 스케일. null 이면 없음
export const MotionShell = ({
  children, durationSec = 5, dir = 'left', enterF = 16, exitF = 0,
  push = 0.05, punchAt = null, punch = 0.04, bg = PAPER,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const total = Math.round(durationSec * fps);

  const sx = dir === 'left' ? 1 : dir === 'right' ? -1 : 0;
  const sy = dir === 'up' ? 1 : dir === 'down' ? -1 : 0;

  // ① 진입 — 화면 12% 만큼 밀려 들어오며 스프링으로 안착 (오버슛 없음: damping 200)
  const e = spring({frame, fps, config: {damping: 200, stiffness: 120}, durationInFrames: enterF});
  const ex = (1 - e) * sx * 230;
  const ey = (1 - e) * sy * 130;

  // ③ 퇴장 — 같은 방향으로 계속 밀려 나간다
  const o = exitF > 0
    ? interpolate(frame, [total - exitF, total], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;
  const ox = -o * o * sx * 320;
  const oy = -o * o * sy * 200;

  // ② 홀드 내내 아주 느린 스케일 인 + (선택) 한 번의 강조 푸시
  const slow = interpolate(frame, [0, total], [1, 1 + push], {extrapolateRight: 'clamp'});
  const hit = punchAt == null ? 0
    : spring({frame: frame - punchAt, fps, config: {damping: 200, stiffness: 90}, durationInFrames: 22});
  const scale = slow + hit * punch;

  return (
    <AbsoluteFill style={{background: bg, overflow: 'hidden'}}>
      <AbsoluteFill style={{
        transform: `translate(${ex + ox}px, ${ey + oy}px) scale(${scale})`,
        transformOrigin: '50% 50%',
      }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
