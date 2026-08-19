// ── 디자인 개선 레이어 (2026-08-19, 디자인 레인) ────────────────────────
// 완성된 123컷을 **건드리지 않고** 개선안을 켜고 끌 수 있게 만든 스위치.
// MotionWrap 이 props.upgrade 를 받아 여기 모드를 심고, paper.jsx 의 공용
// 부품들이 이 값을 읽는다. 끄면(기본) 완성본과 100% 동일하게 렌더된다.
//
// 개선 항목은 B1M 본편 558프레임 실측(quality_probe)에서 나온 것들이다.
//   G  실사 등급 — 전면 워시 스크림을 줄이고 비네팅·주변부 폴오프로 대체
//   T  타이포 하한 — 26px (폰에서 읽히는 최소)
//   S  출처 위치 — 우상단 → 우하단 초소형 (B1M 상시 장치)
//   Y  옐로 면적 — 큰 면을 채우지 않고 획·형광펜으로 (B1M 은 면을 안 칠한다)

const MODE = {current: new Set()};

// 'G,T,S,Y' 또는 true(전부) 또는 '' (끔)
export const setUpgrade = (v) => {
  if (v === true || v === 'all') {
    MODE.current = new Set(['G', 'T', 'S', 'Y']);
  } else if (typeof v === 'string' && v) {
    MODE.current = new Set(v.toUpperCase().split(/[,\s]+/).filter(Boolean));
  } else {
    MODE.current = new Set();
  }
};
export const up = (flag) => MODE.current.has(flag);
export const anyUpgrade = () => MODE.current.size > 0;

// T — 폰 가독 하한. 26px 아래로 내려가지 않게 올린다.
export const tsize = (px) => (up('T') ? Math.max(26, px) : px);

// G — 실사 위 워시. 완성본은 veil 0.4~0.9 로 화면 전체를 덮어 계조가 죽는다.
// 글이 앉는 자리만 눌러야 사진이 산다.
export const veilOf = (veil) => (up('G') ? Math.min(veil, veil * 0.55) : veil);

// G — 소재 자체 등급 (B1M 실사는 우리보다 밝고 채도가 높다)
export const gradeFilter = (blur) => {
  const b = blur ? `blur(${blur}px) ` : '';
  return up('G') ? `${b}contrast(1.05) saturate(1.12) brightness(1.04)` : (b ? b.trim() : 'none');
};

// G — 비네팅 + 아래쪽 그라디언트. 전면 워시 대신 이걸로 글자 자리를 만든다.
export const GradeOverlay = ({dark = false}) => {
  if (!up('G')) return null;
  return (
    <>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 96% 108% at 50% 46%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.22) 100%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(8,10,12,.26) 0%, rgba(8,10,12,0) 30%, '
          + 'rgba(8,10,12,.06) 58%, rgba(8,10,12,.66) 100%)',
      }} />
    </>
  );
};

// Y — 큰 면을 옐로로 채우면 화면이 싸 보인다. 채움은 아주 옅게 두고
// 윤곽과 밑줄로 강조한다 (B1M 문법). 작은 칩·형광펜은 그대로 둔다.
export const yellowFill = (color, area = 'large') => {
  if (!up('Y') || area !== 'large') return color;
  return 'rgba(250,255,46,0.16)';
};
export const yellowStroke = (ink) => (up('Y') ? ink : 'none');
