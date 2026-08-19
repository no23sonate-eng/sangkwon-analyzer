import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {
  PaperSurface, PaperHead, Credit,
  PAPER, INK, INK2, INK3, HAIR, AMBER, P, M, SAFE_BOTTOM, fade,
} from './v4';
import {DrawPath, EASE, stagger, useRevealUp} from './anim';

// v4 · 지면 입면도 — 건물 층 구성을 제도 도면처럼.
// B1M 의 "얇은 검정 선 + 치수선 + 작은 라벨" 문법을 밝은 지면에 그대로.
// floors: [{name, tenant, hot}] 아래층부터. dimension: {label, sub}
export const PaperElevationCard = ({
  eyebrow = '',
  title = '',
  floors = [],
  dimension = null,
  note = '',
  credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = floors.length || 1;
  const fh = Math.min(84, Math.round(480 / n));
  const bw = 500;
  const bx = (1920 - bw) / 2; // 건물을 화면 중앙에
  const baseY = 736;

  const hotIdx = floors.map((f, i) => (f.hot ? i : -1)).filter((i) => i >= 0);
  const hotTop = hotIdx.length ? baseY - (Math.max(...hotIdx) + 1) * fh : 0;
  const hotBottom = hotIdx.length ? baseY - Math.min(...hotIdx) * fh : 0;
  const dimIn = useRevealUp(stagger(n, 5, 24), 26, 14);

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} plot />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 지반선 — 도면답게 굵기 차등 */}
        <DrawPath d={`M ${bx - 230} ${baseY} L ${bx + bw + 380} ${baseY}`} start={2} dur={28} length={1300}
          stroke={INK} strokeWidth={2.4} />
        {/* 지반 해칭 */}
        {Array.from({length: 26}, (_, i) => (
          <line key={i}
            x1={bx - 220 + i * 42} y1={baseY + 3}
            x2={bx - 236 + i * 42} y2={baseY + 19}
            stroke={INK3} strokeWidth={1} opacity={fade(frame, 14)} />
        ))}

        {floors.map((f, i) => {
          const y = baseY - (i + 1) * fh;
          const hot = Boolean(f.hot);
          const t = interpolate(frame, [stagger(i, 5, 8), stagger(i, 5, 8) + 26], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
          });
          return (
            <g key={i}>
              {/* 주인공 층은 **속을 채운 검은 덩어리**로.
                  선만으로 그리면 화면에 잉크가 거의 없어 B1M 지면보다 훨씬
                  묽게 보인다 (quality_probe: ink 0.037 vs B1M 0.058~0.205) */}
              {hot ? <rect x={bx} y={y} width={bw * t} height={fh} fill={INK} /> : null}
              <rect x={bx} y={y} width={bw * t} height={fh}
                fill="none" stroke={hot ? INK : '#A9AFB8'} strokeWidth={hot ? 2 : 1.2} />
              {/* 층 경계 — 덩어리로 칠하면 층 수가 안 보이므로 밝은 선으로 되살린다 */}
              {hot ? (
                <line x1={bx} y1={y + fh} x2={bx + bw * t} y2={y + fh}
                  stroke="rgba(255,255,255,0.46)" strokeWidth={1.8} />
              ) : null}
              {/* 창 분할 — 어두운 덩어리 위에서는 밝은 선으로 뒤집는다 */}
              {Array.from({length: 7}, (_, k) => (
                <line key={k}
                  x1={bx + (bw / 8) * (k + 1)} y1={y + fh * 0.26}
                  x2={bx + (bw / 8) * (k + 1)} y2={y + fh * 0.76}
                  stroke={hot ? 'rgba(255,255,255,0.30)' : '#C7CBD2'} strokeWidth={1} opacity={t} />
              ))}
            </g>
          );
        })}

        {/* 치수선 — 좌측, 화살촉 포함 */}
        {dimension && hotIdx.length ? (
          <g>
            <DrawPath d={`M ${bx - 96} ${hotBottom} L ${bx - 96} ${hotTop}`}
              start={stagger(n, 5, 18)} dur={26} length={620} stroke={INK} strokeWidth={1.6} />
            {[hotTop, hotBottom].map((yy, k) => (
              <g key={k} opacity={dimIn.opacity}>
                <line x1={bx - 112} y1={yy} x2={bx - 80} y2={yy} stroke={INK} strokeWidth={1.6} />
                <line x1={bx - 96} y1={yy} x2={bx} y2={yy} stroke={HAIR} strokeWidth={1} strokeDasharray="5 5" />
              </g>
            ))}
          </g>
        ) : null}
      </svg>

      {/* 층 라벨 — 우측, 지시선과 함께 */}
      {floors.map((f, i) => {
        const y = baseY - (i + 1) * fh;
        const hot = Boolean(f.hot);
        return (
          <div key={i}
            style={{
              position: 'absolute', left: bx + bw + 46, top: y + fh / 2 - 16,
              display: 'flex', alignItems: 'center', gap: 14,
              opacity: fade(frame, stagger(i, 5, 12)), whiteSpace: 'nowrap',
            }}
          >
            <span style={{
              fontFamily: 'A2Z Medium, sans-serif', fontSize: 26, letterSpacing: '0.14em',
              color: hot ? INK : INK3,
              border: `1px solid ${hot ? INK : '#C7CBD2'}`, padding: '4px 8px 2px',
            }}>{f.name}</span>
            <span style={{...P.label, fontSize: 30, color: hot ? INK : INK3}}>{f.tenant}</span>
          </div>
        );
      })}

      {/* 치수 값 */}
      {dimension && hotIdx.length ? (
        <div style={{
          position: 'absolute', left: M, width: bx - 140 - M, top: (hotTop + hotBottom) / 2 - 44,
          textAlign: 'right', whiteSpace: 'nowrap', ...dimIn,
        }}>
          <div style={{...P.valueM, fontSize: 62}}>{dimension.label}</div>
          {dimension.sub ? <div style={{marginTop: 8, ...P.dim}}>{dimension.sub}</div> : null}
        </div>
      ) : null}

      {note ? (
        <div style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', top: SAFE_BOTTOM - 56, opacity: fade(frame, 48)}}>
          <span style={P.caption}>{note}</span>
        </div>
      ) : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 48)} />
    </AbsoluteFill>
  );
};
