import React from 'react';
import {YELLOW, INK} from './paper';

// ── 주석 프리미티브 (B1M 썸네일 48장 분석에서) ────────────────────────────
// B1M 이 사진 위에 뭔가를 가리킬 때 쓰는 도구는 사실 네 개뿐이다.
//   ① 손으로 그린 듯한 **휜 화살표** — 라벨에서 대상까지. 가장 많이 쓰인다
//   ② **점선 원** — "여기가 비어 있다 / 여기가 문제다"
//   ③ **검정 상자 + 흰 대문자** 라벨. 배경이 어떻든 무조건 읽힌다
//   ④ 지도 위 **경로선**
// 지금까지 내 카드는 ③ 없이 링+직선만 썼다. 직선 지시선은 도면처럼 정확하지만
// 사진 위에서는 심심하고, 무엇보다 **어디를 봐야 하는지 덜 강하게 말한다.**
//
// 규칙: 화살표는 손맛이 있어야 하지만 흔들리면 안 된다.
// 곡선 하나(2차 베지어) + 끝으로 갈수록 얇아지는 획. 그게 전부다.

// 꼬리가 굵고 끝이 뾰족한 획을 폴리곤으로 만든다.
// stroke 로 그리면 굵기가 일정해서 손으로 그린 느낌이 안 난다.
const taperPath = (x0, y0, x1, y1, bow, w0, w1) => {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;               // 법선 — 이쪽으로 휜다
  const cx = mx + nx * bow, cy = my + ny * bow;      // 제어점

  const N = 26;
  const L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    // 접선
    const tx = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
    const ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
    const tl = Math.hypot(tx, ty) || 1;
    const w = (w0 + (w1 - w0) * t) / 2;
    L.push([x - (ty / tl) * w, y + (tx / tl) * w]);
    R.push([x + (ty / tl) * w, y - (tx / tl) * w]);
  }
  return 'M' + L.map((p) => p.join(',')).join('L')
       + 'L' + R.reverse().map((p) => p.join(',')).join('L') + 'Z';
};

// from(라벨 쪽) → to(대상). progress 0~1 로 자라난다.
// bow 는 휘는 정도. 0 이면 직선 — 쓰지 말 것, 그럴 거면 화살표를 안 쓰는 게 낫다.
export const HandArrow = ({from, to, progress = 1, bow = 70,
                           color = '#FFFFFF', width = 15, head = 40, opacity = 1}) => {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0.001) return null;
  // 자라나는 동안 끝점은 아직 도착하지 않았다
  const x1 = from[0] + (to[0] - from[0]) * p;
  const y1 = from[1] + (to[1] - from[1]) * p;
  const d = taperPath(from[0], from[1], x1, y1, bow * p, width, width * 0.22);

  // 촉은 다 자란 뒤에 붙는다
  const hp = Math.max(0, (p - 0.82) / 0.18);
  const dx = x1 - from[0], dy = y1 - from[1];
  const len = Math.hypot(dx, dy) || 1;
  // 베지어 끝 접선 ≈ (끝점 - 제어점)
  const mx = (from[0] + x1) / 2, my = (from[1] + y1) / 2;
  const cx = mx + (-dy / len) * bow * p, cy = my + (dx / len) * bow * p;
  const ax = x1 - cx, ay = y1 - cy;
  const al = Math.hypot(ax, ay) || 1;
  const ux = ax / al, uy = ay / al;
  const h = head * hp;
  const px = -uy, py = ux;
  const tip = `${x1},${y1} ${x1 - ux * h - px * h * 0.42},${y1 - uy * h - py * h * 0.42} `
            + `${x1 - ux * h + px * h * 0.42},${y1 - uy * h + py * h * 0.42}`;

  return (
    <g opacity={opacity}>
      <path d={d} fill={color} />
      {hp > 0.01 ? <polygon points={tip} fill={color} /> : null}
    </g>
  );
};

// 점선 원 — "여기가 비었다 / 여기가 문제다". 살짝 돈다(아주 느리게).
export const DashCircle = ({cx, cy, r = 90, progress = 1, color = YELLOW,
                            width = 6, frame = 0, opacity = 1}) => {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0.001) return null;
  const C = 2 * Math.PI * r;
  return (
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={width}
            strokeDasharray={`${C * 0.055} ${C * 0.045}`}
            strokeDashoffset={-frame * 0.5}
            opacity={opacity * p}
            style={{transformOrigin: `${cx}px ${cy}px`, transform: `scale(${0.88 + 0.12 * p})`}} />
  );
};

// 검정 상자 + 흰 대문자. B1M 라벨의 기본형.
// two-tier: 작은 한정어 줄 위 / 큰 본체 줄 아래. ("WORLD'S LARGEST NAVAL BASE" / "$4BN")
// hot 이면 노랑 상자 + 검정 글씨 — 한 화면에 **하나만** 써야 효과가 있다.
export const StampLabel = ({top, sub = '', size = 54, hot = false, align = 'left',
                            reveal = 1, box = true}) => {
  const clip = `inset(0 ${(1 - Math.max(0, Math.min(1, reveal))) * 100}% 0 0)`;
  const bg = hot ? YELLOW : '#0B0E12';
  const fg = hot ? INK : '#FFFFFF';
  const Row = ({text, s, weight}) => (
    <div style={{display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start'}}>
      <div style={{background: box ? bg : 'transparent', color: fg,
                   padding: box ? '4px 14px 6px' : 0,
                   fontFamily: weight === 'bold'
                     ? 'Pretendard Bold, A2Z Medium, sans-serif'
                     : 'Pretendard Bold, A2Z Regular, sans-serif',
                   fontSize: s, lineHeight: 1.16, letterSpacing: '-0.01em',
                   whiteSpace: 'nowrap', wordBreak: 'keep-all',
                   textShadow: box ? 'none' : '0 2px 14px rgba(0,0,0,0.6)'}}>
        {text}
      </div>
    </div>
  );
  return (
    <div style={{clipPath: clip, display: 'inline-block'}}>
      {sub ? <Row text={sub} s={Math.round(size * 0.52)} weight="regular" /> : null}
      <div style={{marginTop: sub ? 4 : 0}}>
        <Row text={top} s={size} weight="bold" />
      </div>
    </div>
  );
};
