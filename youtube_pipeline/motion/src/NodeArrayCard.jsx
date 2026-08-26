import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, fadeIn} from './paper';
import {StampLabel, PulseRing} from './annotate';
import {projector} from './project3d';
import {fit, estWidth} from './layout';

// ── 노드 배열 (실제 3D) ──────────────────────────────────────────────────
// Cleo Abram "The Massive Machine Hidden in the Deep Ocean" 12:21 구간
// (design_reference §36) 에서 학습한 기법. **채널을 베끼는 게 아니라 기법을 옮긴다** —
// 그 영상은 심해 중성미자 관측기(KM3NeT류)를 보여 주지만, 여기 옮기는 건 그 소재가
// 아니라 **"성긴 점들 중 몇 개가 신호를 낸다 → 그 점들을 이으면 위치/경로가 나온다"**
// 는 그래픽 문법이다.
//
// LayerPeelCard/MassingCard 와 다른 점: 저 둘은 **덩어리(volume)** 를 다룬다
// (판을 벗기거나 발자국을 뽑아 올린다). 이건 **점(point)** 을 다룬다 — 대상이
// 연속된 면이 아니라 흩어진 개별 지점들의 집합일 때 쓴다.
//
// 부동산 쪽 용도(설계 당시 염두에 둔 것):
//   - 상권 안 CCTV/와이파이 유동인구 센서 배치 — "여기 세 곳이 피크를 잡는다"
//   - 지하철역 출구/환기구 네트워크 — 여러 개 중 특정 출구를 지목
//   - 동일 평형 세대가 반복되는 단지에서 특정 호실 하나만 강조
//
// cols×rows : 줄(string) 격자. 각 줄에 perString 개 노드가 세로로 달린다
// hits      : [{c, r, n, label, note}] — 신호가 잡힌 노드. **한 화면에 여럿이어도
//             된다**(레이어 카드의 "옐로 하나" 원칙과 다르다 — 여기선 여러 점을
//             잇는 게 요점이므로 hot 색 자체가 다수 등장해도 읽힌다)
// trail     : hits 를 순서대로 이어 그린다 — "이 점들로 위치를 역산했다"
const BASE = '#4B5768';

export const NodeArrayCard = ({
  title = '', sub = '',
  cols = 4, rows = 4, perString = 5,
  spacingX = 0.85, spacingY = 0.62,
  hits = [], trail = true, pulse = true,
  spin = 15, tilt = 0.32, dist = 0,
  note = '', disclaimer = '도해 — 실제 배치와 다를 수 있음',
  theme = 'ink', align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const dark = T.dark;

  const cx = (cols - 1) / 2, cz = (rows - 1) / 2;
  const H = (perString - 1) * spacingY;
  const strings = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      strings.push({c, r, x: (c - cx) * spacingX, z: (r - cz) * spacingX});
    }
  }

  // 가운데부터 바깥으로 줄이 자라난다 (§35 매싱 카드와 같은 문법 — 익숙해야 산만하지 않다)
  const maxD = Math.hypot(cx, cz) || 1;
  const growAt = (c, r) => {
    const d = Math.hypot(c - cx, r - cz) / maxD;
    return 10 + d * 34;
  };

  // 카메라 — 격자 전체가 자막 안전영역(CONTENT_BOTTOM) 위로 들어오게 뒤로 뺀다
  const spanX = (cols - 1) * spacingX, spanZ = (rows - 1) * spacingX;
  const spread = Math.max(spanX, spanZ, H);
  const a = (spin * Math.PI / 180) * interpolate(frame, [0, 150], [-0.5, 0.5],
                                                 {extrapolateRight: 'extend'});
  const rad = dist || (spread * 2.35 + 3.6);
  const camPos = [Math.sin(a) * rad, tilt * rad, Math.cos(a) * rad];
  const proj = projector({pos: camPos, target: [0, 0, 0], fov: 38});

  const hitKey = (h) => `${h.c}-${h.r}-${h.n}`;
  const hitSet = new Set(hits.map(hitKey));

  // 히트를 순서대로 잇는 궤적 — 길이 기준으로 자라난다 (DimLine 과 같은 원칙: 손맛 없이 곧게)
  const hitPos = hits.map((h) => {
    const s = strings[h.c * rows + h.r];
    return [s.x, -H / 2 + h.n * spacingY, s.z];
  });
  const trailStart = 34 + Math.max(0, hits.length - 1) * 0;
  const trailT = interpolate(frame, [trailStart, trailStart + 30], [0, 1],
                             {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const trailPts = (() => {
    if (!trail || hitPos.length < 2) return [];
    const segLens = [];
    for (let i = 1; i < hitPos.length; i++) {
      const [x0, y0, z0] = hitPos[i - 1], [x1, y1, z1] = hitPos[i];
      segLens.push(Math.hypot(x1 - x0, y1 - y0, z1 - z0));
    }
    const total = segLens.reduce((a2, b) => a2 + b, 0) || 1;
    let want = total * trailT, pts = [hitPos[0]];
    for (let i = 0; i < segLens.length; i++) {
      if (want >= segLens[i]) { pts.push(hitPos[i + 1]); want -= segLens[i]; }
      else {
        const t = want / segLens[i];
        const [x0, y0, z0] = hitPos[i], [x1, y1, z1] = hitPos[i + 1];
        pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t]);
        break;
      }
    }
    return pts;
  })();

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <AbsoluteFill>
        <ThreeCanvas width={1920} height={1080} camera={{position: camPos, fov: 38}}
                     style={{background: 'transparent'}}>
          <ambientLight intensity={0.68} />
          <directionalLight position={[5, 8, 6]} intensity={1.85} />

          {strings.map((s, si) => {
            const g = fadeIn(frame, growAt(s.c, s.r));
            if (g <= 0.01) return null;
            return (
              <group key={si} scale={[1, g, 1]}>
                <mesh position={[s.x, 0, s.z]}>
                  <cylinderGeometry args={[0.012, 0.012, H, 6]} />
                  <meshBasicMaterial color={dark ? '#3A4456' : '#C7CCD3'} transparent opacity={0.55} />
                </mesh>
                {Array.from({length: perString}, (_, n) => {
                  const hot = hitSet.has(`${s.c}-${s.r}-${n}`);
                  const y = -H / 2 + n * spacingY;
                  const breathe = hot ? 1 + 0.12 * Math.sin(frame * 0.22 + si) : 1;
                  return (
                    <mesh key={n} position={[s.x, y, s.z]} scale={[breathe, breathe, breathe]}>
                      <sphereGeometry args={[hot ? 0.09 : 0.05, 14, 14]} />
                      <meshStandardMaterial color={hot ? YELLOW : BASE}
                                            roughness={0.8} metalness={0} />
                    </mesh>
                  );
                })}
              </group>
            );
          })}

          {trailPts.length >= 2 ? (
            <line>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={trailPts.length}
                                  array={new Float32Array(trailPts.flat())} itemSize={3} />
              </bufferGeometry>
              <lineBasicMaterial color={YELLOW} transparent opacity={0.85} />
            </line>
          ) : null}
        </ThreeCanvas>
      </AbsoluteFill>

      {/* 펄스 링·라벨 — 3D 를 투영해 화면 좌표에 얹는다 */}
      {hits.map((h, i) => {
        const o = fadeIn(frame, growAt(h.c, h.r) + 18);
        if (o <= 0.01) return null;
        const p = proj(hitPos[i]);
        if (!isFinite(p[0])) return null;
        return (
          <React.Fragment key={i}>
            {pulse ? (
              <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
                <PulseRing cx={p[0]} cy={p[1]} frame={frame} start={growAt(h.c, h.r) + 14}
                          period={38} opacity={o} />
              </svg>
            ) : null}
            {h.label ? (() => {
              const size = fit(h.label, 34, 400);
              const w = estWidth(h.label, size) + 40;
              const flip = p[0] + 26 + w > 1880;
              return (
                <div style={{position: 'absolute', top: p[1] - 26, opacity: o,
                             left: flip ? p[0] - 26 - w : p[0] + 26, width: w}}>
                  <StampLabel top={h.label} sub={h.note} size={size} hot
                              align={flip ? 'right' : 'left'} />
                </div>
              );
            })() : null}
          </React.Fragment>
        );
      })}

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 900, top: 748, textAlign: 'left',
                     opacity: fadeIn(frame, 60), fontFamily: 'A2Z Light, sans-serif',
                     fontSize: 32, color: T.soft, wordBreak: 'keep-all'}}>
          {note}
        </div>
      ) : null}

      {disclaimer ? (
        <div style={{position: 'absolute', left: 44, top: 1028,
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 20, color: T.soft, opacity: 0.75}}>
          {disclaimer}
        </div>
      ) : null}

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
