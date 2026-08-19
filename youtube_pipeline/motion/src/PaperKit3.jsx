import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {useA2ZFonts} from './Fonts';
import {
  PaperSurface, PaperHead, Stage, Credit, PlaceChip, FootageSurface,
  PAPER, INK, INK2, INK3, HAIR, AMBER, BRAND, P, W, M, SAFE_BOTTOM, fade,
} from './v4';
import {DrawPath, EASE, stagger, useRevealUp} from './anim';

// ── v4 장치 3차 — B1M 12편 분석에서 미구현으로 남겨둔 문법 ───────────────
export const BLUE = '#2E5C9A'; // 기술 도면의 주인공/수위 채색 (B1M 매스모델 네이비)

// 10) 실사 위 흰 박스 라벨 — 대상 부위를 짚는 작은 라벨 (B1M "SUPERCONDUCTING MAGNET")
// labels: [{x, y, text}] — 화면 좌표(1920x1080) 기준
export const FootageLabelCard = ({
  image = '', video = '', place = '', credit = '',
  concept = '', // 화면 중앙 좌측의 개념어 (B1M "SAFETY")
  labels = [],
  scrim = 'bottom',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const conceptIn = useRevealUp(10, 30, 26);
  return (
    <AbsoluteFill>
      <FootageSurface image={image} video={video} scrim={scrim} />
      <PlaceChip text={place} opacity={fade(frame, 6)} />

      {concept ? (
        <div style={{position: 'absolute', left: M, top: 470, ...conceptIn}}>
          <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 96, letterSpacing: '0.06em', color: '#FFFFFF', textShadow: '0 2px 30px rgba(0,0,0,0.55)'}}>
            {concept}
          </span>
        </div>
      ) : null}

      {/* 지시선 — 라벨은 반드시 대상과 연결한다 (§21 규칙 5).
          l.to = [x, y] 를 주면 라벨에서 그 점까지 얇은 흰 선 + 점을 찍는다 */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {labels.map((l, i) => {
          if (!l.to) return null;
          const [tx, ty] = l.to;
          const o = fade(frame, stagger(i, 8, 22));
          return (
            <g key={i} opacity={o}>
              <line x1={l.x} y1={l.y} x2={tx} y2={ty} stroke="#FFFFFF" strokeWidth={1.8} opacity={0.85} />
              <circle cx={tx} cy={ty} r={6} fill="none" stroke="#FFFFFF" strokeWidth={2} />
              <circle cx={tx} cy={ty} r={2.4} fill="#FFFFFF" />
            </g>
          );
        })}
      </svg>

      {labels.map((l, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: l.x, top: l.y, transform: 'translate(-50%, -50%)',
            background: '#FFFFFF', padding: '10px 18px 8px',
            fontFamily: 'A2Z Medium, sans-serif', fontSize: 24, letterSpacing: '0.12em', color: INK,
            opacity: fade(frame, stagger(i, 8, 18)), whiteSpace: 'nowrap',
            boxShadow: '0 6px 22px rgba(0,0,0,0.28)',
          }}
        >
          {l.text}
        </div>
      ))}
      <Credit text={credit} opacity={fade(frame, 22)} />
    </AbsoluteFill>
  );
};

// 11) 위성 위 권역·루트 — 반투명 권역 채색 + 흰 파선 루트 (B1M 마그레브 문법)
// regions: [{cx, cy, rx, ry, label}] / route: [[x,y], ...] 화면 좌표
export const SatelliteRouteCard = ({
  image = '', video = '', place = '', credit = '',
  title = '', regions = [], route = null, routeLabel = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const routeD = route ? 'M' + route.map(([x, y]) => `${x},${y}`).join('L') : null;
  return (
    <AbsoluteFill>
      <FootageSurface image={image} video={video} scrim="bottom" />
      <PlaceChip text={place} opacity={fade(frame, 6)} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {regions.map((r, i) => {
          const t = interpolate(frame, [stagger(i, 8, 10), stagger(i, 8, 10) + 26], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
          });
          return (
            <g key={i} opacity={t}>
              {/* 권역은 흰 얇은 윤곽 + 거의 비치지 않는 채움.
                  B1M 은 위성 위에서 형광색 덩어리를 쓰지 않는다.
                  hot: true 인 권역 하나만 앰버로 올린다 */}
              {/* 어두운 그림자 획을 먼저 깔아 밝은 하늘 위에서도 윤곽이 보이게 */}
              <ellipse cx={r.cx} cy={r.cy} rx={r.rx * t} ry={r.ry * t}
                fill="none" stroke="rgba(8,10,12,0.45)" strokeWidth={r.hot ? 5 : 4.2}
                strokeDasharray={r.hot ? undefined : '9 7'} />
              <ellipse cx={r.cx} cy={r.cy} rx={r.rx * t} ry={r.ry * t}
                fill={r.hot ? 'rgba(217,154,31,0.16)' : 'rgba(255,255,255,0.10)'}
                stroke={r.hot ? AMBER : '#FFFFFF'} strokeWidth={r.hot ? 2.6 : 2.2}
                strokeDasharray={r.hot ? undefined : '9 7'} />
              <circle cx={r.cx} cy={r.cy} r={4} fill={r.hot ? AMBER : '#FFFFFF'} />
            </g>
          );
        })}
        {routeD ? (
          <DrawPath d={routeD} start={26} dur={40} length={3000}
            stroke="#FFFFFF" strokeWidth={3} strokeDasharray="14 10" />
        ) : null}
      </svg>

      {regions.map((r, i) => (
        <div key={i} style={{position: 'absolute', left: r.cx - 220, width: 440, top: r.cy - r.ry - 62, textAlign: 'center', opacity: fade(frame, stagger(i, 8, 20))}}>
          <span style={{
            ...W.label, fontSize: 27, textShadow: 'none',
            background: 'rgba(14,17,20,0.78)', padding: '8px 14px 6px', display: 'inline-block',
          }}>{r.label}</span>
        </div>
      ))}

      {title || routeLabel ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: SAFE_BOTTOM - 220, bottom: 0, pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(8,10,12,0) 0%, rgba(8,10,12,.55) 42%, rgba(8,10,12,.72) 100%)'}} />
      ) : null}
      {title ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: SAFE_BOTTOM - 150, textAlign: 'center', opacity: fade(frame, 40)}}>
          <span style={{...W.title, fontSize: 62}}>{title}</span>
        </div>
      ) : null}
      {routeLabel ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: SAFE_BOTTOM - 66, textAlign: 'center', opacity: fade(frame, 46)}}>
          <span style={{...W.caption, fontSize: 26, letterSpacing: '0.1em'}}>{routeLabel}</span>
        </div>
      ) : null}
      <Credit text={credit} opacity={fade(frame, 22)} />
    </AbsoluteFill>
  );
};

// 12) 매스 모델 — 흰 블록 도시에 주인공만 네이비 (B1M 실측 문법)
// blocks: [{x, z, w, d, h}] 격자 좌표(정수), subject: 같은 형식 1개
const Massing = ({blocks, subject, grow}) => {
  const boxes = useMemo(() => blocks, [blocks]);
  return (
    <group>
      {/* 지면 판 */}
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[15, 15]} />
        <meshStandardMaterial color="#E6EAF0" />
      </mesh>
      {boxes.map((b, i) => (
        <mesh key={i} position={[b.x, (b.h * grow) / 2, b.z]}>
          <boxGeometry args={[b.w, Math.max(0.02, b.h * grow), b.d]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.85} metalness={0} />
        </mesh>
      ))}
      {subject ? (
        <mesh position={[subject.x, (subject.h * grow) / 2, subject.z]}>
          <boxGeometry args={[subject.w, Math.max(0.02, subject.h * grow), subject.d]} />
          <meshStandardMaterial color={BLUE} roughness={0.6} metalness={0} />
        </mesh>
      ) : null}
    </group>
  );
};

export const PaperMassingCard = ({
  eyebrow = '', title = '',
  blocks = null, subject = null,
  label = '', sub = '', note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [10, 50], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo});
  const spin = -0.5 + interpolate(frame, [0, 300], [0, 0.16]);
  const R = 30; // 도시 전체가 화면에 들어오도록 충분히 뒤로

  const defaultBlocks = useMemo(() => {
    const out = [];
    for (let gx = -2; gx <= 2; gx += 1) {
      for (let gz = -2; gz <= 2; gz += 1) {
        if (gx === 0 && gz === 0) continue;
        const seed = Math.abs((gx * 7 + gz * 13) % 5);
        out.push({x: gx * 2.2, z: gz * 2.2, w: 1.6, d: 1.6, h: 0.6 + seed * 0.3});
      }
    }
    return out;
  }, []);
  const bl = blocks || defaultBlocks;
  const sub3d = subject || {x: 0, z: 0, w: 1.7, d: 1.7, h: 3.2};

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} />
      <ThreeCanvas
        width={1920} height={1080}
        style={{position: 'absolute', top: 0, left: 0}}
        gl={{alpha: true}} flat
        camera={{fov: 24, position: [Math.sin(spin) * R, 15, Math.cos(spin) * R]}}
      >
        <ambientLight intensity={0.72} />
        <directionalLight position={[8, 14, 6]} intensity={1.15} />
        <directionalLight position={[-6, 8, -4]} intensity={0.35} />
        <group position={[0, 2.0, 0]}>
          <Massing blocks={bl} subject={sub3d} grow={grow} />
        </group>
      </ThreeCanvas>

      {/* 텍스트 가독성용 상·하단 스크림 — 3D 위에 흰 안개를 얇게 */}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(240,242,247,0.96) 0%, rgba(240,242,247,0.55) 16%, rgba(240,242,247,0) 30%, rgba(240,242,247,0) 56%, rgba(240,242,247,0.9) 70%, rgba(240,242,247,0.98) 100%)'}} />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />

      {label ? (
        <Stage top={SAFE_BOTTOM - 168} style={{opacity: fade(frame, 40)}}>
          <div style={{...P.valueM, fontSize: 56, color: BLUE}}>{label}</div>
          {sub ? <div style={{marginTop: 12, ...P.label, fontSize: 27}}>{sub}</div> : null}
        </Stage>
      ) : null}
      {note ? <Stage top={SAFE_BOTTOM - 54} style={{opacity: fade(frame, 48)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 48)} />
    </AbsoluteFill>
  );
};

// 13) 지하·지상 단면 — 지반선을 기준으로 위아래 층을 그린다 (부동산 필수)
// above: [{name, tenant, hot}] 1F부터 / below: [{name, tenant, hot}] B1부터
export const PaperSectionCard = ({
  eyebrow = '', title = '',
  above = [], below = [],
  dimension = null, note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const fh = 74;
  const bw = 520;
  const bx = (1920 - bw) / 2;
  const groundY = 560;
  const dimIn = useRevealUp(stagger(above.length + below.length, 5, 22), 26, 14);

  const Floor = ({f, y, i, under}) => {
    const t = interpolate(frame, [stagger(i, 5, 8), stagger(i, 5, 8) + 26], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
    });
    const hot = Boolean(f.hot);
    return (
      <g>
        {hot ? <rect x={bx} y={y} width={bw * t} height={fh} fill="rgba(217,154,31,0.12)" /> : null}
        {under && !hot ? <rect x={bx} y={y} width={bw * t} height={fh} fill="rgba(46,92,154,0.06)" /> : null}
        <rect x={bx} y={y} width={bw * t} height={fh}
          fill="none" stroke={hot ? INK : under ? '#93A3BA' : '#A9AFB8'}
          strokeWidth={hot ? 2 : 1.2} strokeDasharray={under && !hot ? '6 4' : undefined} />
      </g>
    );
  };

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} plot />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {above.map((f, i) => (
          <Floor key={`a${i}`} f={f} y={groundY - (i + 1) * fh} i={i} under={false} />
        ))}
        {below.map((f, i) => (
          <Floor key={`b${i}`} f={f} y={groundY + i * fh} i={above.length + i} under />
        ))}

        {/* 지반선 + 해칭 — 지상/지하를 가르는 기준 */}
        <DrawPath d={`M ${bx - 250} ${groundY} L ${bx + bw + 380} ${groundY}`} start={2} dur={28} length={1300}
          stroke={INK} strokeWidth={2.6} />
        {Array.from({length: 30}, (_, i) => (
          <line key={i}
            x1={bx - 240 + i * 40} y1={groundY + 3}
            x2={bx - 254 + i * 40} y2={groundY + 17}
            stroke={INK3} strokeWidth={1} opacity={fade(frame, 14)} />
        ))}

        {/* 치수선 */}
        {dimension ? (
          <g>
            <DrawPath d={`M ${bx - 96} ${groundY + below.length * fh} L ${bx - 96} ${groundY - above.length * fh}`}
              start={26} dur={30} length={800} stroke={INK} strokeWidth={1.6} />
            {[groundY - above.length * fh, groundY + below.length * fh].map((yy, k) => (
              <line key={k} x1={bx - 112} y1={yy} x2={bx - 80} y2={yy} stroke={INK} strokeWidth={1.6} opacity={dimIn.opacity} />
            ))}
          </g>
        ) : null}
      </svg>

      {/* 층 라벨 */}
      {[...above.map((f, i) => ({f, y: groundY - (i + 1) * fh, i})),
        ...below.map((f, i) => ({f, y: groundY + i * fh, i: above.length + i}))].map(({f, y, i}) => (
        <div key={i} style={{
          position: 'absolute', left: bx + bw + 40, top: y + fh / 2 - 15,
          display: 'flex', alignItems: 'center', gap: 14,
          opacity: fade(frame, stagger(i, 5, 12)), whiteSpace: 'nowrap',
        }}>
          <span style={{
            fontFamily: 'A2Z Medium, sans-serif', fontSize: 18, letterSpacing: '0.14em',
            color: f.hot ? INK : INK3, border: `1px solid ${f.hot ? INK : '#C7CBD2'}`, padding: '4px 8px 2px',
          }}>{f.name}</span>
          <span style={{...P.label, fontSize: 25, color: f.hot ? INK : INK3}}>{f.tenant}</span>
        </div>
      ))}

      {dimension ? (
        <div style={{
          position: 'absolute', left: M, width: bx - 140 - M,
          top: groundY - (above.length * fh) / 2 - 30, textAlign: 'right', whiteSpace: 'nowrap', ...dimIn,
        }}>
          <div style={{...P.valueM, fontSize: 58}}>{dimension.label}</div>
          {dimension.sub ? <div style={{marginTop: 8, ...P.dim, fontSize: 24}}>{dimension.sub}</div> : null}
        </div>
      ) : null}

      {note ? <Stage top={SAFE_BOTTOM - 54} style={{opacity: fade(frame, 48)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 48)} />
    </AbsoluteFill>
  );
};
