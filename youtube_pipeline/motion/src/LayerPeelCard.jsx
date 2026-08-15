import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, fadeIn} from './paper';
import {StampLabel} from './annotate';
import {projector} from './project3d';
import {fit, estWidth} from './layout';

// ── 레이어 벗기기 (실제 3D) ──────────────────────────────────────────────
// Cleo Abram 이 "덮여 있는 것"을 설명하는 방식 (design_reference §35-3 ①).
// 남극 편에서 얼음층을 통째로 들어 올려 아래 암반을 보여 준다.
// **벗겨 내는 동작 자체가 설명이다** — 다 벗긴 그림을 보여 주는 것과 전혀 다르다.
//
// 부동산에 그대로 맞는다. 지상/지하를 분리하고, 층별 용도를 벗겨서 보여 준다.
// `IsoDiagramCard`(§32-3)와 무엇이 다른가:
//   축측(SVG) = 각도가 고정. 층을 들어 올려도 겹침 순서를 손으로 관리해야 한다
//   이 카드    = **카메라가 실제로 돈다.** 깊이는 GPU 가 푼다
//
// 원칙은 3D 로 와도 그대로다 (§32-3).
//   단색 채움 + 명암만. 글로우·반사·피사계심도를 넣는 순간
//   "설명하려고 만든 모형"이 아니라 어설픈 렌더가 된다.
//   그래서 조명은 둘(ambient + directional)뿐이고 재질은 무광이다.
//
// layers: [{h, label, note, tone, hot}]  — **아래에서 위로** 쌓는 순서
//   h    두께 (단위는 자유. 라벨에 실제 값을 쓴다)
//   tone 팔레트 인덱스. hot 이면 옐로
// lift  : 다 벗겼을 때 층 사이 간격 (기본 0.55)
// spin  : 카메라가 도는 각도(도). 0 이면 고정
const PALETTE = ['#4B7BD6', '#3D6BBF', '#5C87DC', '#33578F', '#6E97E4'];

export const LayerPeelCard = ({
  title = '', sub = '',
  layers = [], lift = 0.55, spin = 16, tilt = 0.42, dist = 0,   // dist 0 = 자동
  cut = false,        // true 면 앞 절반을 덜어낸다 — 남은 면이 곧 단면 (§35-3 ②)
  cutAt = 34,         // 잘리기 시작하는 프레임
  ground = true, note = '',
  disclaimer = '도해 — 실제 치수와 다를 수 있음',
  theme = 'ink', align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const n = layers.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const W = 3.4, D0 = 2.6;                      // 판의 가로·세로 (고정)
  // 자르기 — 깊이를 절반으로 줄이고 뒤로 물리면 **앞면이 그대로 단면**이 된다.
  // three 의 클리핑 평면을 쓰지 않은 이유: 잘린 단면이 뚫린 채로 보여
  // "속이 빈 상자"가 된다. 도해에서는 속이 차 있어야 층이 읽힌다.
  const cutT = cut
    ? interpolate(frame, [cutAt, cutAt + 26], [0, 1],
                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;
  const eCut = cutT * cutT * (3 - 2 * cutT);
  const D = D0 * (1 - 0.5 * eCut);
  const dz = -D0 * 0.25 * eCut;

  // 아래에서 위로 쌓은 원래 위치
  const total = layers.reduce((a, l) => a + (l.h ?? 1), 0);
  let acc = -total / 2;
  const base = layers.map((l) => {
    const y = acc + (l.h ?? 1) / 2;
    acc += l.h ?? 1;
    return y;
  });

  // ① 붙어 있는 채로 잠깐 보여 주고 → ② 위 층부터 순서대로 들린다
  // 위에서부터 벗기는 게 맞다. 아래를 먼저 빼면 위가 무너지는 것처럼 읽힌다.
  const peel = layers.map((_, i) => {
    const rev = n - 1 - i;                       // 맨 위가 0번째로 들린다
    const t = interpolate(frame, [20 + rev * 12, 52 + rev * 12], [0, 1],
                          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    return t * t * (3 - 2 * t);
  });
  // 들린 층은 자기보다 아래 층 개수만큼 더 벌어진다 (등간격으로 펼쳐진다).
  // **가운데를 기준으로 벌어져야 한다.** 위로만 자라게 두면 벗길수록 타이틀을 덮는다
  // (첫 렌더에서 그랬다). 평균만큼 되빼면 무게중심이 제자리에 남는다.
  const raw = layers.map((_, i) => peel[i] * lift * i);
  const mid = raw.reduce((a, v) => a + v, 0) / n;
  const offset = raw.map((v) => v - mid);

  // 다 벗쳤을 때의 높이에 맞춰 카메라를 뒤로 뺀다. 안 그러면 화면을 넘친다
  const spread = total + lift * (n - 1);

  // 카메라 — 아주 천천히 돈다. 확 돌리면 "3D 자랑"이 되고 설명이 안 남는다
  const a = (spin * Math.PI / 180) * interpolate(frame, [0, 150], [-0.5, 0.5],
                                                 {extrapolateRight: 'extend'});
  // 모델이 **자막 안전영역(CONTENT_BOTTOM=820)을 넘지 않게** 뒤로 뺀다.
  // 첫 렌더에서 맨 아래 층 라벨이 y≈980 까지 내려갔다 — 거기는 자막 자리다.
  const rad = dist || (spread * 2.55 + 4.2);
  const camPos = [Math.sin(a) * rad, tilt * rad, Math.cos(a) * rad];
  // 카메라는 늘 원점을 본다 (R3F 기본값). **겨냥점을 옮기면 안 된다** —
  // three 쪽 lookAt 과 여기 투영이 어긋나 라벨이 도형에서 떨어진다.
  // 대신 **모델을 통째로 내린다.** 그러면 화면 위쪽에 타이틀 자리가 빈다.
  const proj = projector({pos: camPos, target: [0, 0, 0], fov: 38});
  const shiftY = spread * 0.02;

  const dark = T.bg !== '#EFEAE3';
  const edge = dark ? '#0B0E12' : '#23262B';

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <AbsoluteFill>
        <ThreeCanvas width={1920} height={1080}
                     camera={{position: camPos, fov: 38}}
                     style={{background: 'transparent'}}>
          <ambientLight intensity={0.62} />
          <directionalLight position={[6, 10, 6]} intensity={2.0} />

          {layers.map((l, i) => {
            const y = base[i] + offset[i] + shiftY;
            const col = l.hot ? YELLOW : PALETTE[(l.tone ?? i) % PALETTE.length];
            return (
              <group key={i} position={[0, y, dz]}>
                <mesh>
                  <boxGeometry args={[W, l.h ?? 1, D]} />
                  <meshStandardMaterial color={col} roughness={0.85} metalness={0} />
                </mesh>
                {/* 잘린 면은 **밝게** 칠한다. 깊이만 줄이면 "작아졌네"로 읽히지
                    "잘렸네"로 안 읽힌다 — 갓 자른 단면이 밝아야 칼이 지나간 게 보인다. */}
                {eCut > 0.02 ? (
                  <mesh position={[0, 0, D / 2 + 0.004]}>
                    <planeGeometry args={[W, l.h ?? 1]} />
                    <meshBasicMaterial color={l.hot ? '#FFFF9C' : '#A8C4F0'}
                                       transparent opacity={0.55 * eCut} />
                  </mesh>
                ) : null}
                {/* 모서리를 그어야 층 경계가 산다. 단색 면끼리 붙으면 경계가 안 보인다 */}
                <lineSegments>
                  <edgesGeometry args={[new THREE.BoxGeometry(W, l.h ?? 1, D)]} />
                  <lineBasicMaterial color={edge} transparent opacity={0.55} />
                </lineSegments>
              </group>
            );
          })}

          {/* 원래 자리 — 들린 층이 어디서 왔는지. 반투명 상자로 남긴다 */}
          {layers.map((l, i) => (offset[i] > 0.02 ? (
            <mesh key={`g${i}`} position={[0, base[i] + shiftY, dz]}>
              <boxGeometry args={[W * 1.001, l.h ?? 1, D * 1.001]} />
              <meshBasicMaterial color={dark ? '#5A6478' : '#9AA0A8'}
                                 transparent opacity={0.13} />
            </mesh>
          ) : null))}

          {ground ? (
            <mesh position={[0, -total / 2 - 0.02 + shiftY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[W * 2.6, D0 * 2.6]} />
              <meshBasicMaterial color={dark ? '#171D2B' : '#E2DDD6'} />
            </mesh>
          ) : null}
        </ThreeCanvas>
      </AbsoluteFill>

      {/* 라벨 — 3D 를 직접 투영해 붙인다 (project3d.js).
          층이 들리면 라벨도 같이 따라 올라가야 "저 층의 이름"으로 읽힌다 */}
      {layers.map((l, i) => {
        if (!l.label) return null;
        const rev = n - 1 - i;
        const o = fadeIn(frame, 42 + rev * 12);
        if (o <= 0.01) return null;
        const y = base[i] + offset[i] + shiftY;
        const p = proj([W / 2 + 0.15, y, D / 2 + dz]);   // 판의 오른쪽 앞 모서리
        if (!isFinite(p[0])) return null;
        const size = fit(l.label, 38, 460);
        const w = estWidth(l.label, size) + 44;
        const flip = p[0] + 24 + w > 1880;
        return (
          <div key={i} style={{position: 'absolute', top: p[1] - 34, opacity: o,
                               left: flip ? p[0] - 24 - w : p[0] + 24, width: w}}>
            <StampLabel top={l.label} sub={l.note} size={size} hot={l.hot}
                        align={flip ? 'right' : 'left'} />
          </div>
        );
      })}

      {/* 한 줄 메모는 **왼쪽 아래**. 라벨은 전부 오른쪽에 붙으므로 안 부딪히고,
          자막 안전영역(820) 위에 둔다 */}
      {note ? (
        <div style={{position: 'absolute', left: 150, right: 900, top: 748,
                     textAlign: 'left',
                     opacity: fadeIn(frame, 40 + n * 12),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft,
                     wordBreak: 'keep-all'}}>
          {note}
        </div>
      ) : null}

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
