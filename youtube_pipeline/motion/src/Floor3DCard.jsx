import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {useA2ZFonts} from './Fonts';

// 3D 테스트 카드 — 층별 임대료 구조를 실제 3D(Three.js)로 표현.
// 색은 채널 실측 레몬 옐로(style_guide.md) 단일 강조 + 순블랙 캔버스.
const BLACK = '#0A0A0A';
const YELLOW = '#FAFF2E';
const WHITE = '#F5F5F0';
const MUTE = '#5F5F5F';

const glow = (strength = 1) =>
  [
    `0 0 ${8 * strength}px rgba(250,255,46,0.85)`,
    `0 0 ${22 * strength}px rgba(250,255,46,0.4)`,
    `0 0 ${60 * strength}px rgba(250,255,46,0.18)`,
  ].join(', ');

// 층 하나 = 박스 + 크리스프 엣지 라인. hot(1층)만 옐로 발광.
const Floor = ({y, height = 0.85, hot = false, basement = false, scaleIn = 1}) => {
  const w = 4.6;
  const d = 3.2;
  const geo = useMemo(() => new THREE.BoxGeometry(w, height, d), [height]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  return (
    <group position={[0, y, 0]} scale={[scaleIn, scaleIn, scaleIn]}>
      <mesh geometry={geo}>
        <meshStandardMaterial
          color={hot ? YELLOW : basement ? '#14161B' : '#1D2025'}
          emissive={hot ? YELLOW : '#000000'}
          emissiveIntensity={hot ? 1.35 : 0}
          transparent={basement}
          opacity={basement ? 0.4 : 1}
          roughness={0.85}
          metalness={0}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={hot ? YELLOW : basement ? '#565B66' : '#4A4E56'} />
      </lineSegments>
    </group>
  );
};

// 지면 — 반투명 플레인 + 그리드 라인(지하가 아래로 비쳐 보이게).
const Ground = () => {
  const lines = useMemo(() => {
    const pts = [];
    const S = 14;
    const step = 1;
    for (let i = -S; i <= S; i += step) {
      pts.push(new THREE.Vector3(-S, 0, i), new THREE.Vector3(S, 0, i));
      pts.push(new THREE.Vector3(i, 0, -S), new THREE.Vector3(i, 0, S));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  return (
    <group position={[0, 0, 0]}>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color="#FFFFFF" transparent opacity={0.07} />
      </lineSegments>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[28, 28]} />
        <meshBasicMaterial color={BLACK} transparent opacity={0.35} />
      </mesh>
    </group>
  );
};

const Scene = ({frame, fps}) => {
  // 층이 아래→위 순서로 솟아오르는 스프링 (지하 → 1F → 2F → 3F)
  const pop = (delay) =>
    spring({frame: frame - delay, fps, config: {damping: 200}, durationInFrames: 26});
  // 카메라 미세 궤도 회전 (정지 프레임에서도 각도 잡힘, 영상에선 천천히 돔)
  const orbit = interpolate(frame, [0, 300], [-0.28, -0.08]);
  const camR = 17;
  const camX = Math.sin(orbit + Math.PI / 4.4) * camR;
  const camZ = Math.cos(orbit + Math.PI / 4.4) * camR;

  return (
    <>
      <perspectiveCamera />
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 9, 4]} intensity={1.1} />
      <pointLight position={[3.4, 1.3, 3.2]} intensity={hotLightIntensity(frame, fps)} color={YELLOW} distance={9} />
      <group position={[0, -1.15, 0]}>
        <Ground />
        {/* 지하 1층 — 지면 아래, 반투명 */}
        <Floor y={-0.62} basement scaleIn={pop(0)} />
        {/* 지상 1~3층 (약간의 층간 갭으로 분해도 느낌) */}
        <Floor y={0.52} hot scaleIn={pop(7)} />
        <Floor y={1.52} scaleIn={pop(13)} />
        <Floor y={2.52} scaleIn={pop(19)} />
      </group>
      <CameraRig x={camX} z={camZ} />
    </>
  );
};

const hotLightIntensity = (frame, fps) =>
  8 * spring({frame: frame - 7, fps, config: {damping: 200}, durationInFrames: 26});

// R3F 에서 default 카메라를 직접 움직이는 소형 리그
const CameraRig = ({x, z}) => {
  const set = (state) => {
    state.camera.position.set(x, 7.2, z);
    state.camera.lookAt(0, -0.35, 0);
  };
  return <Invalidate onFrame={set} />;
};
import {useThree} from '@react-three/fiber';
const Invalidate = ({onFrame}) => {
  const state = useThree();
  onFrame(state);
  return null;
};

// 리더 라인 — 3D 층 모서리에서 라벨까지 얇은 라인 + 틱
const Leader = ({x1, y1, x2, y2, hot = false, o = 1}) => (
  <g opacity={o}>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={hot ? YELLOW : '#4A4A4A'} strokeWidth={hot ? 2 : 1.4} />
    <line x1={x2} y1={y2} x2={x2 + 46} y2={y2} stroke={hot ? YELLOW : '#4A4A4A'} strokeWidth={hot ? 2 : 1.4} />
    <circle cx={x1} cy={y1} r={5} fill={hot ? YELLOW : '#4A4A4A'} />
  </g>
);

export const Floor3DCard = ({
  kicker = '층별 임대료 구조',
  sub = '같은 건물 · 같은 평수 기준',
  caption = '접근성이 만드는 격차 — 1층 기준가 대비',
  source = '자료: 자체 실측 DB',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}, durationInFrames: 24});
  const labelIn = (d) =>
    interpolate(frame, [d, d + 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const rows = [
    {tag: '2F', name: '2층', pct: '55%', y: 268, d: 46},
    {tag: '1F', name: '1층', pct: '100%', y: 438, hot: true, d: 34},
    {tag: 'B1', name: '지하 1층', pct: '45%', y: 668, d: 58},
  ];

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      <ThreeCanvas
        width={1920}
        height={1080}
        style={{position: 'absolute', top: 0, left: 0}}
        gl={{alpha: true}}
        flat
        camera={{fov: 32, position: [8, 5.6, 8]}}
      >
        <Scene frame={frame} fps={fps} />
      </ThreeCanvas>

      {/* 좌상단 킥커 — 옐로 도트 + 2단 타이틀 */}
      <div style={{position: 'absolute', top: 92, left: 120, opacity: enter}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <div style={{width: 10, height: 10, borderRadius: '50%', background: YELLOW, boxShadow: glow(0.7)}} />
          <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 40, letterSpacing: '0.12em', color: WHITE}}>
            {kicker}
          </span>
        </div>
        <div
          style={{
            marginTop: 14, marginLeft: 28,
            fontFamily: 'A2Z Light, sans-serif', fontSize: 27,
            letterSpacing: '0.1em', color: MUTE,
          }}
        >
          {sub}
        </div>
      </div>

      {/* 리더 라인 (3D 층 → 우측 라벨) */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <Leader x1={1215} y1={452} x2={1300} y2={268 + 14} o={labelIn(46)} />
        <Leader x1={1230} y1={548} x2={1300} y2={438 + 24} hot o={labelIn(34)} />
        <Leader x1={1200} y1={688} x2={1300} y2={668 + 14} o={labelIn(58)} />
      </svg>

      {/* 우측 라벨 컬럼 — 층 태그 / 이름 / 퍼센트 (디테일 타이포) */}
      {rows.map((r) => (
        <div key={r.tag} style={{position: 'absolute', left: 1364, top: r.y - 22, opacity: labelIn(r.d)}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 20}}>
            <span
              style={{
                fontFamily: 'A2Z Medium, sans-serif',
                fontSize: 26,
                letterSpacing: '0.18em',
                color: r.hot ? YELLOW : '#8A8A8A',
                border: `1.5px solid ${r.hot ? YELLOW : '#3A3A3A'}`,
                padding: '4px 10px 2px',
                boxShadow: r.hot ? glow(0.35) : 'none',
              }}
            >
              {r.tag}
            </span>
            <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 30, letterSpacing: '0.06em', color: r.hot ? WHITE : MUTE}}>
              {r.name}
            </span>
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: 'A2Z Medium, sans-serif',
              fontSize: r.hot ? 130 : 76,
              lineHeight: 1.1,
              letterSpacing: '0.01em',
              color: r.hot ? YELLOW : '#7A7A7A',
              textShadow: r.hot ? glow(0.8) : 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {r.pct}
          </div>
        </div>
      ))}

      {/* 좌하단 캡션 + 출처 */}
      <div style={{position: 'absolute', left: 120, bottom: 330, opacity: labelIn(70)}}>
        <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 36, letterSpacing: '0.05em', color: WHITE}}>
          {caption}
        </div>
        <div style={{marginTop: 16, fontFamily: 'A2Z Light, sans-serif', fontSize: 25, letterSpacing: '0.08em', color: MUTE}}>
          {source}
        </div>
      </div>
    </AbsoluteFill>
  );
};
