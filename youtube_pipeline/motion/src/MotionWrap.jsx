import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MotionShell} from './MotionShell';
import {CARDS} from './cardRegistry';
import {themeOf} from './paper';

// 아무 카드나 이름으로 받아 MotionShell 로 감싸 렌더한다.
// scene_props.json 에 `motion: {dir, push, punchAt, exitSec}` 만 넣으면
// render_parkside.py 가 이 컴포지션으로 돌린다 — 카드 코드는 안 건드린다.
// 화면 전체가 어두운 실사인 카드들. 이것만 바탕이 검정이다.
const DARK_CARDS = new Set([
  'AnnotatedShotCard', 'FullBleedCard', 'SectionPhotoCard', 'PhotoSplitCard',
  'SphereHeroCard', 'ElevatorCard',
]);

export const MotionWrap = ({card = '', props = {}, motion = {}, durationSec = 5}) => {
  const C = CARDS[card];
  if (!C) return <AbsoluteFill style={{background: '#300'}} />;
  const {dir = 'left', push = 0.04, punchAt = null, punch = 0.04, exitSec = 0, bg} = motion;
  // 밀려 들어오는 동안 드러날 수 있는 바탕색. MotionShell 이 스케일로 메우지만
  // 안전망으로 카드 테마를 따라간다. **`props.image` 유무로 판정하면 안 된다** —
  // MapCard 도 image 를 받는데 밝은 카드라 검은 띠가 생겼다 (샘플 v2 에서 확인).
  // 어두운 전면 실사 카드는 이름으로 고정한다.
  return (
    <MotionShell durationSec={durationSec} dir={dir} push={push}
                 punchAt={punchAt == null ? null : Math.round(punchAt * 30)}
                 punch={punch} exitF={Math.round(exitSec * 30)}
                 bg={bg || (DARK_CARDS.has(card) ? '#0b0e12' : themeOf(props.theme).bg)}>
      <C {...props} durationSec={durationSec} />
    </MotionShell>
  );
};
