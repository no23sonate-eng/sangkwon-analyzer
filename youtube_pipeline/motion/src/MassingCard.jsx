import React from 'react';
import {AbsoluteFill, delayRender, continueRender, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, fadeIn} from './paper';
import {StampLabel} from './annotate';
import {projector} from './project3d';
import {fit, estWidth} from './layout';

// ── 실제 건물 매싱 ───────────────────────────────────────────────────────
// §35-5 에서 "모델이 없어 원시 도형만 가능하다" 고 적었는데 **그건 틀렸다.**
// 건물의 진짜 평면 모양은 OSM 에 있다. 그걸 뽑아 올리면(extrude)
// 박스가 아니라 **그 블록의 실제 형상**이 나온다.
// 발자국은 `scripts/fetch_buildings.py` 가 미터 좌표로 받아 둔다.
//
// 이게 왜 중요한가: 부동산에서 "여기가 어떤 동네인가"는 지도로도 반쯤밖에 안 된다.
// 지도는 **평면**이라 "빽빽한 저층 사이에 20층이 선다"가 안 보인다.
// 매싱은 그걸 한 장으로 보여 준다.
//
// **정직함이 여기서 특히 중요하다.** 한국 OSM 은 층수 입력이 드물어
// (이태원 일대 119동 중 116동이 높이 태그 없음) 주변 건물 높이는 대부분 추정이다.
// 그래서 추정 높이 건물은 **채도를 낮춰** 그리고, 화면에 비율을 밝힌다.
//
// data     : fetch_buildings.py 가 만든 json 경로
// hot      : {ring:[[x,z]…], h, label} — 대상 건물. 손으로 정확히 넣는다
// spin/tilt: 카메라
export const MassingCard = ({
  title = '', sub = '',
  data = '', hot = null,
  spin = 20, tilt = 0.40, dist = 0, north = true,
  note = '', theme = 'ink', align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const [set, setSet] = React.useState(null);
  const [handle] = React.useState(() => delayRender('건물 발자국 로드'));

  React.useEffect(() => {
    if (!data) { continueRender(handle); return; }
    fetch(/^https?:/.test(data) ? data : staticFile(data))
      .then((r) => r.json())
      .then((j) => { setSet(j); continueRender(handle); })
      .catch(() => continueRender(handle));
  }, [data, handle]);

  const dark = T.bg !== '#EFEAE3';
  const blds = set?.buildings ?? [];
  // 지면 반경은 **실제로 그려지는 건물 범위**에서 뽑는다. 요청 반경(set.radius)을
  // 그대로 쓰면 keep 으로 잘린 만큼 바닥만 넓어져 매스가 접시 위 부스러기처럼 보인다
  const R = React.useMemo(() => {
    if (!blds.length) return set?.radius ?? 250;
    const far = Math.max(...blds.map(
      (b) => Math.max(...b.ring.map(([x, z]) => Math.hypot(x, z)))));
    return Math.max(40, far * 1.12);
  }, [blds, set]);

  // 발자국(미터) → three Shape. y 위, xz 평면
  const shapeOf = (ring) => {
    const s = new THREE.Shape();
    ring.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
    s.closePath();
    return s;
  };

  // 카메라 — 반경에 맞춰 뒤로. 아주 천천히 돈다
  const a = (spin * Math.PI / 180) * interpolate(frame, [0, 150], [-0.5, 0.5],
                                                 {extrapolateRight: 'extend'});
  // 뒤로 충분히 빼야 매스가 타이틀을 안 덮는다. 2.05 로 두면 화면 위쪽 건물이
  // 부제를 가린다 (성수 렌더에서 발견) — 카메라 각도가 낮을수록 더 밀어야 한다
  const rad = dist || R * 2.75;
  const camPos = [Math.sin(a) * rad, tilt * rad, Math.cos(a) * rad];
  const proj = projector({pos: camPos, target: [0, 0, 0], fov: 38});

  // 건물이 바닥에서 자라 올라온다. 가운데부터 바깥으로 번진다
  const grow = (b, i) => {
    const d = Math.hypot(...b.ring[0]) / R;                 // 중심에서의 거리 0~1
    const t = interpolate(frame, [8 + d * 34, 40 + d * 34], [0, 1],
                          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    return t * t * (3 - 2 * t);
  };

  const ctxCol = dark ? '#4A5670' : '#B9BFC9';    // 주변 건물 — 채도를 낮춘다
  const estCol = dark ? '#3D4860' : '#CBD0D8';    // 높이가 추정인 건물은 더 낮춘다
  const est = blds.filter((b) => b.est).length;

  const hotShape = hot?.ring ? shapeOf(hot.ring) : null;
  const hotGrow = interpolate(frame, [46, 78], [0, 1],
                              {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const hg = hotGrow * hotGrow * (3 - 2 * hotGrow);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <AbsoluteFill>
        <ThreeCanvas width={1920} height={1080} camera={{position: camPos, fov: 38}}
                     style={{background: 'transparent'}}>
          <ambientLight intensity={0.66} />
          <directionalLight position={[R * 0.6, R, R * 0.5]} intensity={1.9} />

          {/* 지면 */}
          <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[R * 1.05, 64]} />
            <meshBasicMaterial color={dark ? '#151B27' : '#E4DFD8'} />
          </mesh>

          {/* 주변 건물 — extrude 는 xy 평면에 만들어지므로 x축으로 -90도 눕힌다 */}
          {blds.map((b, i) => {
            const g = grow(b, i);
            if (g <= 0.01) return null;
            return (
              <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                <extrudeGeometry args={[shapeOf(b.ring),
                                        {depth: Math.max(0.6, b.h * g), bevelEnabled: false}]} />
                <meshStandardMaterial color={b.est ? estCol : ctxCol}
                                      roughness={0.95} metalness={0} />
              </mesh>
            );
          })}

          {/* 대상 건물 — 옐로. 한 화면에 하나만 (§31-4) */}
          {hotShape && hg > 0.01 ? (
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <extrudeGeometry args={[hotShape,
                                      {depth: Math.max(0.6, (hot.h ?? 70) * hg),
                                       bevelEnabled: false}]} />
              <meshStandardMaterial color={YELLOW} roughness={0.8} metalness={0} />
            </mesh>
          ) : null}
        </ThreeCanvas>
      </AbsoluteFill>

      {/* 대상 라벨 — 3D 를 투영해 꼭대기에 붙인다 */}
      {hot?.label && hg > 0.5 ? (() => {
        const cx = hot.ring.reduce((s, p) => s + p[0], 0) / hot.ring.length;
        const cz = hot.ring.reduce((s, p) => s + p[1], 0) / hot.ring.length;
        const p = proj([cx, (hot.h ?? 70) * hg, cz]);
        if (!isFinite(p[0])) return null;
        const size = fit(hot.label, 44, 560);
        const w = estWidth(hot.label, size) + 44;
        return (
          <div style={{position: 'absolute', left: Math.min(1860 - w, Math.max(40, p[0] - w / 2)),
                       top: Math.max(title ? (sub ? 330 : 276) : 190, p[1] - 128), width: w,
                       opacity: fadeIn(frame, 76)}}>
            <StampLabel top={hot.label} sub={hot.note} size={size} hot align="left" />
          </div>
        );
      })() : null}

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 900, top: 748, textAlign: 'left',
                     opacity: fadeIn(frame, 84),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: T.soft,
                     wordBreak: 'keep-all'}}>
          {note}
        </div>
      ) : null}

      {/* 추정 비율을 반드시 밝힌다. 주변 건물 높이는 대부분 추측이다 */}
      {blds.length ? (
        <div style={{position: 'absolute', left: 44, top: 1028,
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 20, color: T.soft,
                     opacity: 0.78}}>
          건물 {blds.length}동 · 주변 높이 추정 {Math.round(est / blds.length * 100)}% —
          발자국은 실제, 높이는 도해
        </div>
      ) : null}

      <PaperSource source={source || set?.source || ''} theme={theme} />
    </AbsoluteFill>
  );
};
