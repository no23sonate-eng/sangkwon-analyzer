import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {
  PaperSurface, PaperHead, Stage, Credit,
  INK, INK2, HAIR, AMBER, P, M, SAFE_BOTTOM, fade,
} from './v4';
import {DrawPath, EASE, stagger} from './anim';

// ── v4 장치 4차 — 거리·동선 도해 ────────────────────────────────────────
// "걸어서 2분" 같은 근접성은 실사로 증명하기 어렵다(항공사진이 없으면 엉뚱한
// 건물을 지목하게 된다). B1M 은 이럴 때 실사 대신 **개념 평면도**를 쓴다.
// 블록은 추상 도형으로 두고, 확실한 것(두 지점의 관계·소요시간)만 표기한다.

const DEFAULT_BLOCKS = [
  [300, 356, 210, 120], [540, 356, 150, 120], [720, 356, 240, 120],
  [1140, 336, 190, 140], [1360, 336, 170, 140], [1560, 356, 140, 120],
  [300, 596, 170, 130], [500, 596, 230, 130], [760, 596, 160, 130],
  [1100, 606, 200, 120], [1330, 606, 260, 120], [1620, 606, 90, 120],
];

// 17) 도보 거리 도해 — 두 지점 + 파선 동선 + 소요시간 칩 (개념 평면도)
export const PaperWalkCard = ({
  eyebrow = '', title = '',
  blocks = DEFAULT_BLOCKS,
  from = {x: 560, y: 530, label: '출발'},
  to = {x: 1400, y: 500, label: '도착'},
  waypoints = [], // 사이 경유점 [[x,y], ...] — 없으면 직선에 가깝게 꺾는다
  duration = '', // 예: '도보 2분'
  scale = '', // 예: '약 150m'
  note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();

  const pts = [[from.x, from.y], ...waypoints, [to.x, to.y]];
  const d = 'M' + pts.map(([x, y]) => `${x},${y}`).join('L');
  // 소요시간 칩은 동선의 가운데 마디에 앉힌다
  const mid = pts.length > 2 ? pts[Math.floor(pts.length / 2)]
    : [(from.x + to.x) / 2, (from.y + to.y) / 2];

  const chipOn = interpolate(frame, [52, 74], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
  });

  const Node = ({p, delay}) => {
    const t = interpolate(frame, [delay, delay + 22], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outBack,
    });
    return (
      <g opacity={fade(frame, delay)}>
        <circle cx={p.x} cy={p.y} r={30 * t} fill="none" stroke={AMBER} strokeWidth={1.4} opacity={0.55} />
        <circle cx={p.x} cy={p.y} r={11} fill={AMBER} />
      </g>
    );
  };

  return (
    <AbsoluteFill>
      <PaperSurface plot />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 도시 블록 — 추상 도형. 실제 형상이 아님을 note 로 명시한다 */}
        {blocks.map(([x, y, w, h], i) => (
          <rect
            key={i} x={x} y={y} width={w} height={h}
            fill="#E2E5EB" stroke={HAIR} strokeWidth={1}
            opacity={fade(frame, stagger(i, 2, 4))}
          />
        ))}
        {/* 동선 */}
        <DrawPath d={d} start={22} dur={40} length={2600}
          stroke={AMBER} strokeWidth={4} strokeDasharray="12 9" />
        <Node p={from} delay={14} />
        <Node p={to} delay={34} />
        {/* 소요시간 칩 → 동선 연결선 */}
        {duration ? (
          <line x1={mid[0]} y1={mid[1] - 34} x2={mid[0]} y2={mid[1] - 12}
            stroke={AMBER} strokeWidth={1.6} opacity={chipOn * 0.8} />
        ) : null}
      </svg>

      {/* 지점 이름은 블록 위에 놓일 수 있으므로 지면색 판을 깔아 읽히게 한다 */}
      {[{p: from, delay: 20}, {p: to, delay: 40}].map(({p, delay}, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.x - 240, width: 480, top: p.y + 32,
          textAlign: 'center', opacity: fade(frame, delay),
        }}>
          <span style={{
            display: 'inline-block', background: 'rgba(240,242,247,0.94)', padding: '4px 12px 2px',
            fontFamily: 'A2Z Medium, sans-serif', fontSize: 29, letterSpacing: '0.08em', color: INK,
          }}>
            {p.label}
          </span>
          {p.sub ? (
            <div style={{marginTop: 4}}>
              <span style={{...P.caption, fontSize: 20, background: 'rgba(240,242,247,0.94)', padding: '3px 10px 1px'}}>{p.sub}</span>
            </div>
          ) : null}
        </div>
      ))}

      {duration ? (
        <div style={{
          position: 'absolute', left: mid[0] - 170, width: 340, top: mid[1] - 86,
          textAlign: 'center', opacity: chipOn,
          transform: `translateY(${(1 - chipOn) * 10}px)`,
        }}>
          <span style={{
            display: 'inline-block', background: '#FFFFFF', border: `1.5px solid ${AMBER}`,
            padding: '11px 20px 9px', color: INK,
            fontFamily: 'A2Z Medium, sans-serif', fontSize: 32, letterSpacing: '0.06em',
            boxShadow: '0 10px 26px rgba(20,24,30,0.12)', whiteSpace: 'nowrap',
          }}>{duration}</span>
        </div>
      ) : null}

      {scale ? (
        <div style={{position: 'absolute', left: M, top: 742, opacity: fade(frame, 60)}}>
          <svg width={190} height={16}>
            <line x1={1} y1={8} x2={180} y2={8} stroke={INK2} strokeWidth={1.4} />
            <line x1={1} y1={2} x2={1} y2={14} stroke={INK2} strokeWidth={1.4} />
            <line x1={180} y1={2} x2={180} y2={14} stroke={INK2} strokeWidth={1.4} />
          </svg>
          <div style={{marginTop: 4, ...P.caption, fontSize: 19}}>{scale}</div>
        </div>
      ) : null}

      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      {note ? <Stage top={SAFE_BOTTOM - 38} style={{opacity: fade(frame, 62)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 62)} />
    </AbsoluteFill>
  );
};
