import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, SP} from './paper';
import {fit} from './layout';

// ── 대지 한 필지 (실제 3D) ──────────────────────────────────────────────
// "대지 197평" 을 숫자만 띄우면 크기가 안 남는다. **땅 한 장을 실제로 눕혀 놓고**
// 그 한가운데에 면적을 얹으면 "이만한 땅"이 된다.
//
// 평면(SVG 사각형)이 아니라 3D 로 가는 이유: 살짝 기운 판이 하나 놓이면
// 그게 **땅**으로 읽힌다. 정면 사각형은 그냥 도형이다.
//
// 값은 두 번째 줄에 따로 붙인다 (평당가처럼). 면적과 단가는 성격이 달라서
// 같은 크기로 나란히 두면 둘 다 안 읽힌다.
export const SitePlotCard = ({
  title = '', sub = '',
  area = '', areaUnit = '평',
  second = '', secondLabel = '',
  ratio = 1.55,               // 필지 가로세로 비. 정사각이면 1
  spin = 12, tilt = 0.52,
  note = '', theme = 'paper', align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const dark = T.dark;

  const W = 9.0, D = W / ratio;
  const a = (spin * Math.PI / 180) * interpolate(frame, [0, 150], [-0.5, 0.5],
                                                 {extrapolateRight: 'extend'});
  const rad = 14.2;
  const camPos = [Math.sin(a) * rad, tilt * rad, Math.cos(a) * rad];

  const grow = interpolate(frame, [6, 40], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const e = grow * grow * (3 - 2 * grow);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <AbsoluteFill>
        <ThreeCanvas width={1920} height={1080} camera={{position: camPos, fov: 38}}
                     style={{background: 'transparent'}}>
          <ambientLight intensity={0.72} />
          <directionalLight position={[5, 9, 6]} intensity={1.7} />
          {/* 필지 판 — 얇은 상자. 두께가 있어야 "땅 한 덩어리"로 보인다 */}
          <mesh position={[0, 0, 0]} scale={[e, 1, e]}>
            <boxGeometry args={[W, 0.42, D]} />
            <meshStandardMaterial color={YELLOW} roughness={0.85} metalness={0} />
          </mesh>
          <lineSegments scale={[e, 1, e]}>
            <edgesGeometry args={[new THREE.BoxGeometry(W, 0.42, D)]} />
            <lineBasicMaterial color={dark ? '#0B0E12' : '#23262B'} transparent opacity={0.6} />
          </lineSegments>
          {/* 주변 지면 — 필지가 어딘가에 놓여 있다는 최소한의 바닥 */}
          <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[W * 1.5, D * 1.7]} />
            <meshBasicMaterial color={dark ? '#1A1F29' : '#E4DFD7'} />
          </mesh>
        </ThreeCanvas>
      </AbsoluteFill>

      {/* 면적 — 판 한가운데. 3D 위에 얹되 화면 정중앙에 고정한다.
          투영으로 따라다니게 하면 판이 돌 때 글자가 흔들려 읽기 힘들다 */}
      {area ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 470,
                     textAlign: 'center', opacity: fadeIn(frame, 30)}}>
          <span style={{fontFamily: 'A2Z Medium, sans-serif',
                        fontSize: 132, lineHeight: 1, color: '#1B1E24',
                        letterSpacing: '-0.02em',
                        textShadow: '0 2px 18px rgba(250,255,46,0.55)'}}>
            {area}
            <span style={{fontSize: 54, marginLeft: 6}}>{areaUnit}</span>
          </span>
        </div>
      ) : null}

      {second ? (
        <div style={{position: 'absolute', left: 0, right: 0,
                     top: CONTENT_BOTTOM - 84 - (secondLabel ? 44 : 0) - (note ? 62 : 0),
                     textAlign: 'center', opacity: fadeIn(frame, 48)}}>
          <div style={{fontFamily: 'A2Z Medium, sans-serif',
                       fontSize: fit(second, 62, 1200), color: T.ink, letterSpacing: '-0.01em'}}>
            {second}
          </div>
          {secondLabel ? (
            <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: 28, color: T.soft}}>{secondLabel}</div>
          ) : null}
        </div>
      ) : null}

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 150, top: CONTENT_BOTTOM - 26,
                     textAlign: 'center', opacity: fadeIn(frame, 60),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: T.soft}}>
          {note}
        </div>
      ) : null}

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
