import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MotionShell} from './MotionShell';
import {CARDS} from './cardRegistry';

// 아무 카드나 이름으로 받아 MotionShell 로 감싸 렌더한다.
// scene_props.json 에 `motion: {dir, push, punchAt, exitSec}` 만 넣으면
// render_parkside.py 가 이 컴포지션으로 돌린다 — 카드 코드는 안 건드린다.
export const MotionWrap = ({card = '', props = {}, motion = {}, durationSec = 5}) => {
  const C = CARDS[card];
  if (!C) return <AbsoluteFill style={{background: '#300'}} />;
  const {dir = 'left', push = 0.04, punchAt = null, punch = 0.04, exitSec = 0, bg} = motion;
  return (
    <MotionShell durationSec={durationSec} dir={dir} push={push}
                 punchAt={punchAt == null ? null : Math.round(punchAt * 30)}
                 punch={punch} exitF={Math.round(exitSec * 30)}
                 bg={bg || (props.image || props.photo ? '#0b0e12' : undefined)}>
      <C {...props} durationSec={durationSec} />
    </MotionShell>
  );
};
