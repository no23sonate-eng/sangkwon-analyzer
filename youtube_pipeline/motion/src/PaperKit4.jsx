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
              <span style={{...P.caption, fontSize: 26, background: 'rgba(240,242,247,0.94)', padding: '3px 10px 1px'}}>{p.sub}</span>
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
          <div style={{marginTop: 4, ...P.caption, fontSize: 26}}>{scale}</div>
        </div>
      ) : null}

      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      {note ? <Stage top={SAFE_BOTTOM - 38} style={{opacity: fade(frame, 62)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 62)} />
    </AbsoluteFill>
  );
};

// 18) 막대 비교 — B1M 본편의 차트 문법(제도지 격자 + 회색 막대 + 주인공 강조).
// bars: [{label, value, text, hot, sub}] — value 는 상대 높이용 숫자
// shape: 'bar' 기본 | 'building' 이면 막대를 건물 실루엣(층선)으로 그린다
export const PaperBarCard = ({
  eyebrow = '', title = '',
  bars = [], unit = '', shape = 'bar',
  baselineLabel = '', note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = bars.length || 1;
  // 지반선 아래로 이름·부연이 들어가고 그 아래 note 가 온다.
  // 자막 안전영역(820)과 겹치지 않도록 지반선을 위로 올려 잡는다.
  const BASE = 668;
  const TOPY = 352; // 가장 높은 막대의 꼭대기
  const maxH = BASE - TOPY;
  const maxV = Math.max(...bars.map((b) => Number(b.value) || 0), 1);
  const slot = Math.min(240, 1500 / n);
  const bw = Math.min(168, slot * 0.68);
  const x0 = 960 - (slot * n) / 2 + (slot - bw) / 2;

  return (
    <AbsoluteFill>
      <PaperSurface plot />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 지반선 */}
        <DrawPath d={`M ${960 - (slot * n) / 2 - 60} ${BASE} L ${960 + (slot * n) / 2 + 60} ${BASE}`}
          start={2} dur={26} length={1600} stroke={INK} strokeWidth={2.4} />
        {bars.map((b, i) => {
          const h = maxH * ((Number(b.value) || 0) / maxV);
          const t = interpolate(frame, [stagger(i, 6, 12), stagger(i, 6, 12) + 30], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
          });
          const hh = h * t;
          const x = x0 + i * slot;
          const y = BASE - hh;
          const hot = Boolean(b.hot);
          const floors = shape === 'building' ? Math.max(2, Math.round(h / 34)) : 0;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={hh}
                fill={hot ? INK : '#D3D8DF'} stroke={hot ? INK : '#AEB5BE'} strokeWidth={1.4} />
              {/* 건물 모드 — 층선을 그어 "높이"가 층수로 읽히게 */}
              {floors ? Array.from({length: floors - 1}, (_, k) => {
                const fy = BASE - (h / floors) * (k + 1);
                return fy > y ? (
                  <line key={k} x1={x} y1={fy} x2={x + bw} y2={fy}
                    stroke={hot ? 'rgba(255,255,255,0.30)' : 'rgba(22,24,26,0.14)'} strokeWidth={1.2} />
                ) : null;
              }) : null}
              {/* 주인공 막대만 앰버 밑줄 — 지면 위 유일한 채색 */}
              {hot ? <rect x={x} y={BASE} width={bw} height={6} fill={AMBER} opacity={t} /> : null}
            </g>
          );
        })}
      </svg>

      {bars.map((b, i) => {
        const h = maxH * ((Number(b.value) || 0) / maxV);
        const x = x0 + i * slot;
        const hot = Boolean(b.hot);
        const o = fade(frame, stagger(i, 6, 30));
        return (
          <React.Fragment key={i}>
            {/* 값 — 막대 위 */}
            <div style={{position: 'absolute', left: x + bw / 2 - 170, width: 340, top: BASE - h - 74, textAlign: 'center', opacity: o}}>
              <span style={{
                ...P.valueM, fontSize: hot ? 50 : 40, color: hot ? INK : INK2, whiteSpace: 'nowrap',
              }}>{b.text || b.value}</span>
              {unit ? <span style={{...P.dim, fontSize: hot ? 26 : 22, marginLeft: 5}}>{unit}</span> : null}
            </div>
            {/* 이름 — 지반선 아래 */}
            <div style={{position: 'absolute', left: x + bw / 2 - 170, width: 340, top: BASE + 24, textAlign: 'center', opacity: o}}>
              <div style={{
                fontFamily: hot ? 'A2Z Medium, sans-serif' : 'A2Z Light, sans-serif',
                fontSize: 30, letterSpacing: '0.06em', color: hot ? INK : INK2,
              }}>{b.label}</div>
              {b.sub ? <div style={{marginTop: 5, ...P.caption, fontSize: 26}}>{b.sub}</div> : null}
            </div>
          </React.Fragment>
        );
      })}

      {baselineLabel ? (
        <div style={{position: 'absolute', left: M, top: BASE - 34, opacity: fade(frame, 40)}}>
          <span style={{...P.caption, fontSize: 26}}>{baselineLabel}</span>
        </div>
      ) : null}

      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      {note ? <Stage top={SAFE_BOTTOM - 38} style={{opacity: fade(frame, 56)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 56)} />
    </AbsoluteFill>
  );
};
