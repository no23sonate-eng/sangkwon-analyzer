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
// caps: B1M 이 **실사 위에** 지시를 얹을 때 쓰는 결 (§40-4).
// `REPLACE` `FIX THE ROOF` — 가는 산세리프에 자간이 아주 넓고 상자가 없다.
// **굵기로 이기지 않는다.** 얇은데도 읽히는 건 자간과 크기 덕이고, 그래서
// 사진을 덜 가린다. 검정 상자(§31-4)는 지도처럼 바탕이 시끄러울 때 쓰고,
// 깨끗한 실사 위에서는 상자가 오히려 화면을 두 조각으로 자른다.
//
// 한글에는 대문자가 없다. 옮겨올 수 있는 건 **얇기와 자간**이라 그 둘만 가져온다.
export const StampLabel = ({top, sub = '', size = 54, hot = false, align = 'left',
                            reveal = 1, box = true, caps = false}) => {
  const clip = `inset(0 ${(1 - Math.max(0, Math.min(1, reveal))) * 100}% 0 0)`;
  const bg = hot ? YELLOW : '#0B0E12';
  const fg = caps && !box ? (hot ? YELLOW : '#FFFFFF') : (hot ? INK : '#FFFFFF');
  const Row = ({text, s, weight}) => (
    <div style={{display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start'}}>
      <div style={{background: box ? bg : 'transparent', color: fg,
                   padding: box ? '4px 14px 6px' : 0,
                   fontFamily: caps
                     ? 'A2Z Light, sans-serif'
                     : weight === 'bold'
                     ? 'Pretendard Bold, A2Z Medium, sans-serif'
                     : 'Pretendard Bold, A2Z Regular, sans-serif',
                   fontSize: caps ? Math.round(s * 1.12) : s,
                   lineHeight: 1.16,
                   letterSpacing: caps ? '0.16em' : '-0.01em',
                   whiteSpace: 'nowrap', wordBreak: 'keep-all',
                   textShadow: box ? 'none'
                     : caps ? '0 2px 20px rgba(0,0,0,0.75)' : '0 2px 14px rgba(0,0,0,0.6)'}}>
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

// ── 형광펜 ───────────────────────────────────────────────────────────────
// B1M 이 기사를 인용할 때 핵심 구절에 긋는 것은 **밑줄이 아니라 형광펜**이다.
// (Chicago Sun-Times 인용 판에서 확인 — 연노랑이 두 줄에 걸쳐 글자를 감싼다)
// 밑줄은 "여기 봐라"지만 형광펜은 **"내가 이 부분을 읽고 있다"** 가 된다.
//
// 여러 줄에 걸친 인라인 하이라이트를 **왼쪽에서 오른쪽으로 한 획에** 긋는 게 관건인데,
// `box-decoration-break: clone` 을 쓰면 줄마다 따로 칠해져서 전부 동시에 차오른다.
// 기본값인 **slice** 를 그대로 두면 브라우저가 여러 줄을 한 띠로 이어 붙여 칠하므로,
// 1행을 끝까지 칠하고 2행으로 넘어간다 — 실제 형광펜이 지나가는 순서다.
//
// 색은 채널 옐로(#FAFF2E)보다 **연하게** 간다. 원색으로 칠하면 글자가 안 읽힌다.
export const HL_YELLOW = '#FAFA7A';

export const Highlighter = ({children, progress = 1, color = HL_YELLOW, pad = '0.08em'}) => {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <span style={{
      background: `linear-gradient(90deg, ${color} 0 100%)`,
      backgroundSize: `${p * 100}% 100%`,
      backgroundRepeat: 'no-repeat',
      boxDecorationBreak: 'slice',
      WebkitBoxDecorationBreak: 'slice',
      padding: `${pad} 0`,
    }}>
      {children}
    </span>
  );
};

// ── 치수선 ───────────────────────────────────────────────────────────────
// "15M" 을 굴착면 위에 세로 양방향 화살표로 박는 그 처리.
// 라벨 화살표(HandArrow)와 **역할이 다르다** — 저건 가리키는 것이고 이건 **재는 것**이다.
// 그래서 손맛을 주면 안 된다. 곧고, 양끝에 캡이 있고, 굵기가 일정하다.
export const DimLine = ({x1, y1, x2, y2, progress = 1, color = '#FFFFFF',
                          width = 4, cap = 20, label = '', labelSize = 54, opacity = 1}) => {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0.001) return null;
  const ex = x1 + (x2 - x1) * p, ey = y1 + (y2 - y1) * p;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;                 // 캡 방향
  const head = 16;
  const ux = dx / len, uy = dy / len;
  const arrow = (px, py, s) =>
    `${px},${py} ${px + ux * head * s - nx * head * 0.5},${py + uy * head * s - ny * head * 0.5} `
    + `${px + ux * head * s + nx * head * 0.5},${py + uy * head * s + ny * head * 0.5}`;
  return (
    <g opacity={opacity}>
      <line x1={x1 - nx * cap} y1={y1 - ny * cap} x2={x1 + nx * cap} y2={y1 + ny * cap}
            stroke={color} strokeWidth={width} />
      <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={width} />
      {p > 0.98 ? (
        <>
          <line x1={x2 - nx * cap} y1={y2 - ny * cap} x2={x2 + nx * cap} y2={y2 + ny * cap}
                stroke={color} strokeWidth={width} />
          <polygon points={arrow(x1, y1, 1)} fill={color} />
          <polygon points={arrow(x2, y2, -1)} fill={color} />
        </>
      ) : null}
      {label && p > 0.98 ? (() => {
        // 세로 치수선이면 글자를 **옆으로 밀어** 앉힌다. 중앙 정렬로 두면
        // 치수선이 글자 한가운데를 관통한다 (실제로 겪음).
        const vertical = Math.abs(dy) > Math.abs(dx);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        // 세로 치수선의 라벨은 **바깥쪽**(화면 중앙 반대편)으로 뺀다.
        // 예전엔 무조건 오른쪽에 놨는데, 도형 왼쪽에 그은 치수선이면 라벨이
        // 도형 위로 올라탔다 — 옐로 면에 흰 글씨가 얹혀 안 읽혔다 (#33).
        // 치수선은 늘 도형 바깥에 긋고 도형은 대개 가운데 있으니, 중앙에서
        // 멀어지는 쪽이 곧 도형 반대편이다.
        const wide = String(label).length * labelSize * 0.62;
        let flip = vertical && mx < 960;              // 왼쪽 치수선 → 라벨도 왼쪽
        if (vertical && flip && mx - cap - 26 - wide < 24) flip = false;   // 프레임 밖 방지
        if (vertical && !flip && mx + cap + 26 + wide > 1896) flip = true;
        const lx = vertical ? (flip ? mx - cap - 26 : mx + cap + 26) : mx;
        const ly = vertical ? my + labelSize * 0.34 : my - cap - 14;
        return (
          <text x={lx} y={ly} fill={color} fontSize={labelSize}
                textAnchor={vertical ? (flip ? 'end' : 'start') : 'middle'}
                style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                        paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.45)', strokeWidth: 6}}>
            {label}
          </text>
        );
      })() : null}
    </g>
  );
};

// ── 점선 테두리로 오려내기 ───────────────────────────────────────────────
// Cleo 가 사진 위에서 대상 하나를 집어낼 때 쓰는 처리 (design_reference §35-3 ③).
// Atlas 로봇을 흰 점선 사각형으로 감싸 배경에서 떼어 낸다.
//
// `DashCircle`(§32-4)과 언제 갈리나:
//   원  = "여기가 비었다 / 여기가 문제다"   — 지점을 가리킨다
//   사각 = **"이게 그거다"**                — 대상을 지목한다
// 모서리만 그리는 게 요령이다. 사각형을 통째로 그으면 액자가 되고,
// 모서리만 남기면 **조준선**이 된다.
export const DashBox = ({x, y, w, h, progress = 1, color = '#FFFFFF',
                          width = 4, corner = 0.26, frame = 0, opacity = 1}) => {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0.001) return null;
  const cw = w * corner, ch = h * corner;
  const g = 1 - p;                                // 들어올 때 살짝 벌어져 있다가 붙는다
  const ox = w * 0.06 * g, oy = h * 0.06 * g;
  const L = x - ox, R = x + w + ox, T = y - oy, B = y + h + oy;
  const seg = (a, b, c, d) => (
    <line x1={a} y1={b} x2={c} y2={d} stroke={color} strokeWidth={width}
          strokeLinecap="round" />
  );
  return (
    <g opacity={opacity * p}>
      {seg(L, T, L + cw, T)}{seg(L, T, L, T + ch)}
      {seg(R - cw, T, R, T)}{seg(R, T, R, T + ch)}
      {seg(L, B - ch, L, B)}{seg(L, B, L + cw, B)}
      {seg(R, B - ch, R, B)}{seg(R - cw, B, R, B)}
      {/* 모서리 사이는 점선으로 아주 옅게 이어 준다 — 안 이으면 네 조각으로 흩어진다 */}
      <rect x={L} y={T} width={R - L} height={B - T} fill="none"
            stroke={color} strokeWidth={2} strokeDasharray="10 12"
            opacity={0.45} strokeDashoffset={-frame * 0.4} />
    </g>
  );
};

// ── 감지 펄스 ────────────────────────────────────────────────────────────
// Cleo Abram 의 심해 중성미자 관측기 편(§36) — 성긴 점 배열 위 몇 개 노드가
// 반짝여 "여기서 신호가 잡혔다"를 말한다. DashCircle(§32-4, "비어 있다/문제다")과
// 다르다 — 저건 계속 돌며 결핍을 가리키고, 이건 **한 번 번지고 사라지는 사건**이다.
// loop 를 켜면 반복(연속 감지). 글로우 대신 **테두리 링**만 쓴다 — 이 프로젝트의
// 원칙(§32-3)이 3D 로 와도 그대로다: 채움에 광채를 넣으면 도해가 아니라 렌더가 된다.
export const PulseRing = ({cx, cy, r0 = 10, r1 = 46, frame = 0, start = 0, period = 34,
                            loop = true, color = YELLOW, width = 5, opacity = 1}) => {
  if (frame < start) return null;
  const raw = frame - start;
  const t = loop ? raw % period : raw;
  if (!loop && t >= period) return null;
  const p = Math.min(1, t / period);
  const r = r0 + (r1 - r0) * p;
  const op = opacity * (1 - p);
  if (op <= 0.01) return null;
  return <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={width} opacity={op} />;
};

// ── 거친 박스 제목 ────────────────────────────────────────────────────────
// B1M 의 안(案) 제목은 **검정 박스 위 흰 글자인데 박스 가장자리가 거칠다** (§40-7).
// `The Full Decant`, `Enhanced Maintenance and Improvement Plus`.
// 마커로 칠한 결이라 반듯한 사각형과 인상이 완전히 다르다 — 반듯하면 UI 배지고,
// 거칠면 사람이 종이에 칠해 놓은 것이 된다. 우리 판이 도면 결이라 후자가 맞다.
//
// **두 줄이면 박스도 두 개로 나뉜다.** 한 박스에 두 줄을 넣지 않는다 —
// 줄마다 폭이 달라지면서 손으로 칠한 느낌이 사는 게 요점이라, 한 덩어리로
// 감싸면 그 효과가 통째로 사라진다.
//
// 거칢은 SVG 로 그린다. CSS 로는 변이 있는 사각형을 못 만든다.
const roughRect = (w, h, seed, amp = 5) => {
  const j = (i) => {
    const x = Math.sin((seed * 17.3 + i * 39.7)) * 43758.5453;
    return (x - Math.floor(x) - 0.5) * 2 * amp;
  };
  const N = 7;                     // 변마다 점 7개. 더 늘리면 지저분해진다
  const pts = [];
  for (let i = 0; i < N; i++) pts.push([(w * i) / (N - 1), j(i)]);
  for (let i = 0; i < N; i++) pts.push([w + j(i + 20), (h * i) / (N - 1)]);
  for (let i = N - 1; i >= 0; i--) pts.push([(w * i) / (N - 1), h + j(i + 40)]);
  for (let i = N - 1; i >= 0; i--) pts.push([j(i + 60), (h * i) / (N - 1)]);
  return pts.map((p) => p.map((v) => Math.round(v * 10) / 10).join(',')).join(' ');
};

// lines: 문자열 배열. 줄마다 박스 하나.
export const RoughTitle = ({lines = [], kicker = '', size = 76, reveal = 1,
                            fill = '#0B0E12', color = '#FFFFFF', kickerColor = '#23262B',
                            align = 'center'}) => {
  const ls = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
  const PADX = Math.round(size * 0.34), PADY = Math.round(size * 0.14);
  return (
    <div style={{display: 'flex', flexDirection: 'column',
                 alignItems: align === 'left' ? 'flex-start' : 'center', gap: 10}}>
      {kicker ? (
        <div style={{fontFamily: 'A2Z Regular, sans-serif', fontSize: Math.round(size * 0.42),
                     color: kickerColor, letterSpacing: '0.02em', marginBottom: 6,
                     opacity: Math.min(1, reveal * 2)}}>
          {kicker}
        </div>
      ) : null}
      {ls.map((t, i) => {
        const on = Math.max(0, Math.min(1, reveal * ls.length - i));
        if (on <= 0.01) return null;
        return (
          <div key={i} style={{position: 'relative', display: 'inline-block',
                               padding: `${PADY}px ${PADX}px`,
                               clipPath: `inset(0 ${(1 - on) * 100}% 0 0)`}}>
            <svg style={{position: 'absolute', left: -6, top: -6,
                         width: 'calc(100% + 12px)', height: 'calc(100% + 12px)',
                         overflow: 'visible'}}
                 viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* viewBox 를 100×100 으로 두고 늘려 붙이면 변의 요철이 폭에 따라
                  달라져서 줄마다 다른 손맛이 난다 — 같은 도형을 복사한 티가 안 난다 */}
              <polygon points={roughRect(100, 100, i + 1, 2.4)} fill={fill} />
            </svg>
            <span style={{position: 'relative',
                          fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                          fontSize: size, lineHeight: 1.2, color,
                          letterSpacing: '-0.015em', whiteSpace: 'nowrap'}}>
              {t}
            </span>
          </div>
        );
      })}
    </div>
  );
};
