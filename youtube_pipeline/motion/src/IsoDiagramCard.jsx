import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';
import {fit} from './layout';
import {DimLine} from './annotate';

// ── 얕은 3D 축측 도해 ────────────────────────────────────────────────────
// B1M 이 "이게 어떻게 생겼는지" 를 설명할 때 쓰는 판. 프레임에서 두 종류를 봤다.
//   ① 파란 단색 덩어리 + 격자 바닥판 (댐·지형·구조물)
//   ② 슬래브에 말뚝이 박히고 "18,500 m³" 가 위에 붙는 것 (공법)
// 둘 다 **평면 아이콘이 아니라 얕은 3D** 다. 그런데 렌더가 아니다 —
// 단색 채움 + 밝기만 다른 면 세 개(윗면·좌면·우면)로 끝난다.
//
// 왜 얕은 3D 인가: 평면 도형은 "기호"로 읽히고, 실사 렌더는 "완성 이미지"로 읽힌다.
// 그 사이에 **"설명하려고 만든 모형"** 이라는 자리가 있고, 축측 도해가 거기다.
// 모형이라 틀려도 되고, 그래서 과감하게 단순화할 수 있다.
//
// 그리고 B1M 은 이런 판 우하단에 늘 작게 적는다 — `FOR ILLUSTRATIVE PURPOSES ONLY`.
// 도해는 실측이 아니라는 걸 밝히는 것이다. 이 카드는 그걸 기본값으로 켜 둔다.
//
// blocks: [{x, z, w, d, h, tone, hot, label}]
//   x,z  바닥 격자 위 위치 (칸 단위, 0이 가운데)
//   w,d  가로·세로 칸수 · h 높이 (칸수)
// dim:  {from:[x,z,y], to:[x,z,y], label} — 치수선 하나 (선택)

const ISO_X = [0.866, 0.5];      // 축측 투영 — 30도
const ISO_Z = [-0.866, 0.5];
const ISO_Y = [0, -1];

export const IsoDiagramCard = ({
  title = '', sub = '',
  blocks = [], grid = 9, cell = 92, groundY = 0,
  dim = null,
  note = '', disclaimer = '도해 — 실제 치수와 다를 수 있음',
  theme, align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);

  const CX = 960;
  const CY = 640 + groundY;
  const P = (x, y, z) => [
    CX + (x * ISO_X[0] + z * ISO_Z[0]) * cell,
    CY + (x * ISO_X[1] + z * ISO_Z[1] + y * ISO_Y[1]) * cell,
  ];

  // 면 세 개. 같은 색의 명도만 바꾼다 — 조명을 흉내 내면 도해가 아니라 렌더가 된다.
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };

  const ground = [];
  for (let i = -grid; i <= grid; i++) {
    ground.push([P(i, 0, -grid), P(i, 0, grid)]);
    ground.push([P(-grid, 0, i), P(grid, 0, i)]);
  }

  // 그리는 순서. **지하(h<0)가 먼저다** — 지상보다 뒤에 있어야 얹힌 것으로 읽힌다.
  // x+z 로만 잡으면 지하 슬래브가 타워를 덮어 버린다 (실제로 겪음).
  const order = blocks.map((b, i) => ({b, i})).sort((a, c) => {
    const ua = (a.b.h ?? 1) < 0 ? 0 : 1;
    const uc = (c.b.h ?? 1) < 0 ? 0 : 1;
    if (ua !== uc) return ua - uc;
    return (a.b.x + a.b.z) - (c.b.x + c.b.z);
  });

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 바닥 격자가 먼저 깔린다 — "여기가 지면"이라는 약속 */}
        <g stroke={T.ink} strokeWidth={1} opacity={0.16}>
          {ground.map(([a, c], i) => (
            <line key={i} x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]}
                  opacity={fadeIn(frame, Math.floor(i / 6))} />
          ))}
        </g>

        {order.map(({b, i}) => {
          // 덩어리는 바닥에서 자라 올라온다. 순서대로.
          const g = interpolate(frame, [12 + i * 8, 34 + i * 8], [0, 1],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const e = g * g * (3 - 2 * g);
          if (e <= 0.001) return null;
          const h = (b.h ?? 1) * e;
          const {x = 0, z = 0, w = 1, d = 1} = b;
          const base = b.hot ? YELLOW : (T.tones[(b.tone ?? i) % T.tones.length]);
          // 지하는 윗면이 지면(y=0)이고 벽이 아래로 내려간다.
          // 지상과 같은 식을 쓰면 윗면이 바닥에 붙어 뒤집힌 상자가 된다.
          const yTop = h < 0 ? 0 : h;
          const yBot = h < 0 ? h : 0;
          const top = [P(x, yTop, z), P(x + w, yTop, z), P(x + w, yTop, z + d), P(x, yTop, z + d)];
          const left = [P(x, yTop, z + d), P(x + w, yTop, z + d), P(x + w, yBot, z + d), P(x, yBot, z + d)];
          const right = [P(x + w, yTop, z), P(x + w, yTop, z + d), P(x + w, yBot, z + d), P(x + w, yBot, z)];
          const pts = (a) => a.map((p) => p.join(',')).join(' ');
          return (
            <g key={i}>
              <polygon points={pts(left)} fill={shade(base, 0.72)} />
              <polygon points={pts(right)} fill={shade(base, 0.86)} />
              <polygon points={pts(top)} fill={base} />
            </g>
          );
        })}

        {dim ? (
          <DimLine
            x1={P(dim.from[0], dim.from[2] ?? 0, dim.from[1])[0]}
            y1={P(dim.from[0], dim.from[2] ?? 0, dim.from[1])[1]}
            x2={P(dim.to[0], dim.to[2] ?? 0, dim.to[1])[0]}
            y2={P(dim.to[0], dim.to[2] ?? 0, dim.to[1])[1]}
            progress={interpolate(frame, [40, 58], [0, 1],
                                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
            color={T.ink} width={3} cap={16} label={dim.label} labelSize={46} />
        ) : null}
      </svg>

      {/* 덩어리 라벨 — 도형이 다 자란 뒤에 붙는다 */}
      {order.map(({b, i}) => {
        if (!b.label) return null;
        // 지하 라벨은 덩어리 **아래쪽**에. 위에 붙이면 지면 위 글자가 되어 지하가 안 읽힌다.
        const under = (b.h ?? 1) < 0;
        const p = P(b.x + (b.w ?? 1) / 2, under ? b.h : (b.h ?? 1), b.z + (b.d ?? 1) / 2);
        const o = fadeIn(frame, 38 + i * 8);
        return (
          <div key={i} style={{position: 'absolute', left: p[0] - 200, top: p[1] + (under ? 14 : -62),
                               width: 400, textAlign: 'center', opacity: o,
                               fontFamily: 'A2Z Medium, sans-serif',
                               fontSize: fit(b.label, 34, 380), color: T.ink,
                               wordBreak: 'keep-all'}}>
            {b.label}
          </div>
        );
      })}

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 150, top: CONTENT_BOTTOM - 56,
                     textAlign: align === 'left' ? 'left' : 'center',
                     opacity: fadeIn(frame, 52),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft,
                     wordBreak: 'keep-all'}}>
          {note}
        </div>
      ) : null}

      {/* B1M 이 도해마다 다는 면책 문구. 정직함이 장치로 박혀 있어야 매번 빠뜨리지 않는다 */}
      {disclaimer ? (
        <div style={{position: 'absolute', left: 44, top: 1028,
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 20, color: T.soft,
                     opacity: 0.75}}>
          {disclaimer}
        </div>
      ) : null}

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
