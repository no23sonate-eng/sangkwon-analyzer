import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, GRAY, glow, fadeIn, Kicker, Footer} from './v2shared';

// v2 스피어 히어로 카드 — 주인공(구형 공연장)을 실제 3D 도트 구체로.
// LED 표면 느낌의 포인트 구체 + 와이어프레임, 천천히 자전.
// annotations: [{label, value, hot}] 우측 리더 라인 컬럼.
// compare: {mainLabel, smallLabel, ratio} 를 주면 큰/작은 구체 비교 모드.
const DotSphere = ({radius = 3, count = 900, color = '#FAFF2E', opacity = 1, spin = 0}) => {
  const geo = useMemo(() => {
    const pts = [];
    // 피보나치 구 — 표면에 균일한 도트 (LED 스킨 느낌)
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = phi * i;
      pts.push(radius * Math.cos(t) * r, radius * y, radius * Math.sin(t) * r);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [radius, count]);
  const wire = useMemo(() => new THREE.EdgesGeometry(new THREE.SphereGeometry(radius, 18, 12)), [radius]);
  return (
    <group rotation={[0.12, spin, 0]}>
      <points geometry={geo}>
        <pointsMaterial color={color} size={radius * 0.035} transparent opacity={opacity} sizeAttenuation />
      </points>
      <lineSegments geometry={wire}>
        <lineBasicMaterial color={color} transparent opacity={0.14 * opacity} />
      </lineSegments>
      <mesh>
        <sphereGeometry args={[radius * 0.985, 32, 32]} />
        <meshBasicMaterial color="#0E0E06" transparent opacity={0.9 * opacity} />
      </mesh>
    </group>
  );
};

export const SphereHeroCard = ({
  kicker = '',
  sub = '',
  annotations = [],
  compare = null,
  caption = '',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = fadeIn(frame, 0, 16);
  const grow = spring({frame: frame - 6, fps, config: {damping: 200}, durationInFrames: 30});
  const spin = frame / 240;

  // 구체 화면 좌표 (카메라 세팅과 손튜닝으로 맞춘 앵커)
  const sphereCX = 477;
  const sphereCY = 462;

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      <ThreeCanvas
        width={1920}
        height={1080}
        style={{position: 'absolute', top: 0, left: 0}}
        gl={{alpha: true}}
        flat
        camera={{fov: 38, position: [0, 0, 11]}}
      >
        <ambientLight intensity={0.6} />
        {compare ? (
          <>
            <group position={[-2.6, 0.9, 0]} scale={[grow, grow, grow]}>
              <DotSphere radius={2.6} spin={spin} color="#9A9A9A" />
            </group>
            {/* 작은 구체는 큰 구체와 바닥 높이를 맞춘다 */}
            <group position={[3.2, 0.9 - 2.6 * (1 - (compare.ratio ?? 0.63)), 0]} scale={[grow, grow, grow]}>
              <DotSphere radius={2.6 * (compare.ratio ?? 0.63)} spin={spin} color="#FAFF2E" />
            </group>
          </>
        ) : (
          <group position={[-3.4, 0.55, 0]} scale={[grow, grow, grow]}>
            <DotSphere radius={2.2} spin={spin} color="#FAFF2E" />
          </group>
        )}
      </ThreeCanvas>

      <Kicker title={kicker} sub={sub} opacity={enter} />

      {compare ? (
        <>
          <div style={{position: 'absolute', left: 180, top: 800, width: 560, textAlign: 'center', opacity: fadeIn(frame, 34)}}>
            <div style={{fontFamily: 'A2Z Regular, sans-serif', fontSize: 42, color: GRAY, letterSpacing: '0.03em'}}>{compare.mainLabel}</div>
            {compare.mainSub ? <div style={{marginTop: 6, fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: MUTE}}>{compare.mainSub}</div> : null}
          </div>
          <div style={{position: 'absolute', left: 1120, top: 800, width: 560, textAlign: 'center', opacity: fadeIn(frame, 44)}}>
            <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 46, color: YELLOW, textShadow: glow(0.6), letterSpacing: '0.03em'}}>{compare.smallLabel}</div>
            {compare.smallSub ? <div style={{marginTop: 6, fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: WHITE}}>{compare.smallSub}</div> : null}
          </div>
        </>
      ) : (
        <>
          {/* 우측 주석 컬럼 + 구체로 향하는 리더 라인 */}
          <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
            {annotations.map((a, i) => {
              const yLab = 300 + i * 170;
              const o = fadeIn(frame, 34 + i * 10);
              // 구체 가장자리 앵커 — 주석 높이에 맞춰 각도 분산
              const ang = -0.5 + i * 0.42;
              const ax = sphereCX + Math.cos(ang) * 322;
              const ay = sphereCY + Math.sin(ang) * 322 * 0.95;
              return (
                <g key={i} opacity={o}>
                  <line x1={ax} y1={ay} x2={1280} y2={yLab + 22} stroke={a.hot ? YELLOW : '#4A4A4A'} strokeWidth={a.hot ? 2 : 1.4} />
                  <line x1={1280} y1={yLab + 22} x2={1330} y2={yLab + 22} stroke={a.hot ? YELLOW : '#4A4A4A'} strokeWidth={a.hot ? 2 : 1.4} />
                  <circle cx={ax} cy={ay} r={5} fill={a.hot ? YELLOW : '#4A4A4A'} />
                </g>
              );
            })}
          </svg>
          {annotations.map((a, i) => {
            const yLab = 300 + i * 170;
            return (
              <div key={i} style={{position: 'absolute', left: 1360, top: yLab - 26, opacity: fadeIn(frame, 34 + i * 10)}}>
                <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 29, letterSpacing: '0.08em', color: a.hot ? WHITE : MUTE}}>
                  {a.label}
                </div>
                <div style={{marginTop: 2, fontFamily: 'A2Z Medium, sans-serif', fontSize: a.hot ? 84 : 56, letterSpacing: '0.01em', color: a.hot ? YELLOW : GRAY, textShadow: a.hot ? glow(0.7) : 'none', fontVariantNumeric: 'tabular-nums'}}>
                  {a.value}
                </div>
              </div>
            );
          })}
        </>
      )}

      <Footer caption={caption} source={source} opacity={fadeIn(frame, 56)} />
    </AbsoluteFill>
  );
};
