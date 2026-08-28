import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

// 우주로 빨려드는 효과 — 검정 바탕에 흰 별뿐. 다른 색은 쓰지 않는다.
//
// 두 층으로 나눈다. 하나로 만들려다 두 번 실패했다:
//   · 위상을 균등하게 주면 첫 프레임이 중앙에 몰린다 (사진 같지 않다)
//   · 첫 프레임을 면적 균등으로 맞추면, 순환할 때 별들이 한꺼번에
//     중심으로 되감겨 뭉친다
// 두 요구가 서로 다른 분포를 원하므로 층을 나누는 게 맞다.
//
//   A. 정지 별밭  — 원본 사진처럼 화면을 꽉 채운 점. 가속하며 바깥으로
//                  흩어져 나가고 사라진다. "빨려드는" 시작을 담당한다.
//   B. 워프 스트림 — 중심에서 계속 태어나 흘러나가는 선. A 가 비는 만큼
//                  차오른다. 3초 내내 끊이지 않게 하는 층이다.
export const StarWarpCard = ({
  fieldCount = 1800, // A 정지 별밭
  warpCount = 900, // B 워프 스트림
  seed = 7,
  speed = 1.0,
  trail = 0.85,
  holdSec = 0.28, // 처음 이만큼은 사진처럼 멈춰 있다
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames, width: W, height: H} = useVideoConfig();
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.hypot(cx, cy);
  const rMin = 2.4;
  const L = Math.log((maxR * 1.25) / rMin);

  const {field, warp} = useMemo(() => {
    let s = seed >>> 0;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    // A — 면적 균등(P(r) ∝ r)이라야 화면이 고르게 찬다
    const field = Array.from({length: fieldCount}, () => ({
      ang: rnd() * Math.PI * 2,
      r0: Math.sqrt(rnd()) * maxR * 1.02 + 1,
      mag: Math.pow(rnd(), 2.4),
    }));
    // B — 위상 균등이라야 흐름이 끊이지 않는다
    const warp = Array.from({length: warpCount}, () => ({
      ang: rnd() * Math.PI * 2,
      phase: rnd(),
      mag: Math.pow(rnd(), 2.2),
    }));
    return {field, warp};
  }, [fieldCount, warpCount, seed, maxR]);

  const t = frame / fps;
  const dur = durationInFrames / fps;
  // 가속 곡선 — 멈춤 → 서서히 → 급격히
  const prog = (x) => interpolate(x, [0, holdSec, dur], [0, 0.01, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const p = prog(t);
  const pPrev = prog(Math.max(0, t - 1 / fps));

  // A 의 확대율 — 지수로 커진다
  const zoomAt = (x) => Math.exp(3.9 * speed * x) - 1;
  const zoom = zoomAt(p);
  const zoomPrev = zoomAt(pPrev);

  // B 의 누적 회전수
  const cyclesAt = (x) => 2.0 * speed * (Math.exp(2.6 * x) - 1) / (Math.exp(2.6) - 1);
  const cycles = cyclesAt(p);
  const dCycles = Math.max(0, cycles - cyclesAt(pPrev));

  // B 는 A 가 비기 시작할 때 차오른다
  const warpIn = interpolate(t, [holdSec + 0.15, dur * 0.55], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const Streak = ({x1, y1, x2, y2, w, o}) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="#FFFFFF" strokeWidth={w} strokeLinecap="round" opacity={o} />
  );

  return (
    <AbsoluteFill style={{background: '#000000'}}>
      <svg width={W} height={H} style={{position: 'absolute', top: 0, left: 0}}>
        {/* A — 원본 별밭이 바깥으로 흩어진다 */}
        {field.map((st, i) => {
          const r = st.r0 * (1 + zoom);
          if (r > maxR * 1.3) return null;
          const co = Math.cos(st.ang);
          const si = Math.sin(st.ang);
          const len = Math.min(st.r0 * (zoom - zoomPrev) * trail, maxR * 0.55);
          const x2 = cx + co * r;
          const y2 = cy + si * r;
          const gone = interpolate(r, [maxR * 0.95, maxR * 1.25], [1, 0], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const o = (0.34 + st.mag * 0.66) * gone;
          if (o < 0.02) return null;
          return (
            <Streak key={`f${i}`}
              x1={cx + co * (r - len)} y1={cy + si * (r - len)} x2={x2} y2={y2}
              w={0.9 + st.mag * 1.8} o={o} />
          );
        })}

        {/* B — 중심에서 계속 태어나는 워프 스트림 */}
        {warpIn > 0.01 ? warp.map((st, i) => {
          const u = (cycles + st.phase) % 1;
          const r = rMin * Math.exp(u * L);
          if (r > maxR * 1.2) return null;
          const co = Math.cos(st.ang);
          const si = Math.sin(st.ang);
          const len = Math.min(r * L * dCycles * trail, maxR * 0.55);
          const born = interpolate(r, [rMin, rMin * 16], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const gone = interpolate(r, [maxR * 0.92, maxR * 1.18], [1, 0], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const o = (0.3 + st.mag * 0.7) * born * gone * warpIn;
          if (o < 0.02) return null;
          return (
            <Streak key={`w${i}`}
              x1={cx + co * (r - len)} y1={cy + si * (r - len)}
              x2={cx + co * r} y2={cy + si * r}
              w={0.9 + st.mag * 1.7} o={o} />
          );
        }) : null}
      </svg>
    </AbsoluteFill>
  );
};
