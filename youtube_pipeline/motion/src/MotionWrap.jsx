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
  // **모션은 기본값이 "없음"이다.**
  // 예전엔 여기 기본값(dir·push)이 박혀 있어서 motion 을 안 준 컷까지 전부
  // 밀려 들어왔다. 123컷 전부에 전환이 걸린 셈이고, 실제로 "화면 전환마다
  // 다 있다" 는 지적을 받았다. 전환이 늘 있으면 전환이 아무 뜻도 없다 —
  // 챕터가 바뀌거나 숫자가 뒤집히는 자리에서만 움직여야 그게 신호가 된다.
  // 그래서 motion 을 명시한 컷만 움직인다. 나머지는 하드컷이다.
  // `motion: {still: true}` 이면 **완전히 정지한다.**
  // 기본값(모션 없음)도 1.2%/컷 만큼은 밀리는데, 그건 "죽은 화면" 을 피하려는
  // 장치다. 후크처럼 사진 한 장으로 못을 박는 컷에서는 그 미세한 밀림조차
  // 시선을 흔든다 — 그럴 땐 아예 세운다
  //
  // ── 2026-08-29 · 화면 전환 모션을 끈다 ────────────────────────────────
  // 105컷에 같은 밀기가 걸려 있었다. 방향을 2~3컷마다 바꿔 흐름을 만든다는
  // 설계였는데, **이어 붙여 보면 그게 어지럽다.** 컷마다 화면이 통째로
  // 움직이니 눈이 매번 다시 자리를 잡아야 한다.
  //
  // 없애는 건 **화면 전환**이지 움직임 전체가 아니다. 숫자가 세어 오르고
  // 글자가 떠오르고 막대가 자라는 건 그대로다 — 그건 그 컷이 말하려는
  // 내용의 일부다. 사진의 느린 줌도 카드가 저마다 갖고 있어 그대로 산다.
  // 화면 전체를 미는 것만 뺀다.
  //
  // `motion: {transition: true}` 를 명시한 컷만 예외로 민다. 챕터가 바뀌는
  // 자리처럼 **전환 자체가 신호**일 때만 쓴다
  const move = Boolean(motion && motion.transition);
  const {dir = 'left', push = 0, punchAt = null, punch = 0.04, exitSec = 0, bg} = motion || {};
  const slow = move ? (push || 0.035) : 0;
  const enterF = move ? 16 : 0;
  // 밀려 들어오는 동안 드러날 수 있는 바탕색. MotionShell 이 스케일로 메우지만
  // 안전망으로 카드 테마를 따라간다. **`props.image` 유무로 판정하면 안 된다** —
  // MapCard 도 image 를 받는데 밝은 카드라 검은 띠가 생겼다 (샘플 v2 에서 확인).
  // 어두운 전면 실사 카드는 이름으로 고정한다.
  return (
    <MotionShell durationSec={durationSec} dir={dir} push={slow} enterF={enterF}
                 punchAt={punchAt == null ? null : Math.round(punchAt * 30)}
                 punch={punch} exitF={move ? Math.round(exitSec * 30) : 0}
                 bg={bg || (DARK_CARDS.has(card) ? '#0b0e12' : themeOf(props.theme).bg)}>
      <C {...props} durationSec={durationSec} />
    </MotionShell>
  );
};
