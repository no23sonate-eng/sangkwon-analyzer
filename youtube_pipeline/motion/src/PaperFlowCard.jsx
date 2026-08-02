import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_SOFT, YELLOW, fadeIn} from './paper';

// 종이 위 아이콘 플로우 (레퍼런스 Stocks→Cash 다이어그램 문법).
// nodes: [{icon, label, sub, hot}] — 좌→우 화살표 연결, hot 노드는 옐로 박스.
// arrows: ['화살표 위 라벨', ...] (nodes-1 개, 생략 가능)
// icon: 'money' | 'building' | 'gov' | 'doc' | 'person' | 'globe' | 'key' | 'clock'
const Icon = ({name, size = 74, stroke = INK}) => {
  const s = size, sw = 3.4;
  const P = {stroke, strokeWidth: sw, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round'};
  switch (name) {
    case 'money':
      return (
        <g {...P}>
          <rect x={-s / 2} y={-s / 3.2} width={s} height={s / 1.6} rx={6} />
          <circle cx={0} cy={0} r={s / 7} />
          <line x1={-s / 2.9} y1={0} x2={-s / 3.9} y2={0} />
          <line x1={s / 3.9} y1={0} x2={s / 2.9} y2={0} />
        </g>
      );
    case 'building':
      return (
        <g {...P}>
          <rect x={-s / 3.4} y={-s / 2} width={s / 1.7} height={s} />
          {[-1, 0, 1].map((r) => (
            <line key={r} x1={-s / 6} y1={(r * s) / 4.2} x2={s / 6} y2={(r * s) / 4.2} opacity={0.6} />
          ))}
        </g>
      );
    case 'gov':
      return (
        <g {...P}>
          <polygon points={`${-s / 2},${-s / 8} ${s / 2},${-s / 8} 0,${-s / 2}`} />
          <line x1={-s / 2.4} y1={-s / 8} x2={-s / 2.4} y2={s / 2.6} />
          <line x1={0} y1={-s / 8} x2={0} y2={s / 2.6} />
          <line x1={s / 2.4} y1={-s / 8} x2={s / 2.4} y2={s / 2.6} />
          <line x1={-s / 2} y1={s / 2.2} x2={s / 2} y2={s / 2.2} />
        </g>
      );
    case 'doc':
      return (
        <g {...P}>
          <rect x={-s / 3} y={-s / 2} width={s / 1.5} height={s} rx={4} />
          {[-1, 0, 1].map((r) => (
            <line key={r} x1={-s / 5} y1={(r * s) / 4.6} x2={s / 5} y2={(r * s) / 4.6} opacity={0.6} />
          ))}
        </g>
      );
    case 'person':
      return (
        <g {...P}>
          <circle cx={0} cy={-s / 4.2} r={s / 5.5} />
          <path d={`M ${-s / 2.6} ${s / 2} A ${s / 2.6} ${s / 2.6} 0 0 1 ${s / 2.6} ${s / 2}`} />
        </g>
      );
    case 'globe':
      return (
        <g {...P}>
          <circle cx={0} cy={0} r={s / 2.2} />
          <ellipse cx={0} cy={0} rx={s / 4.6} ry={s / 2.2} />
          <line x1={-s / 2.2} y1={0} x2={s / 2.2} y2={0} />
        </g>
      );
    case 'key':
      return (
        <g {...P}>
          <circle cx={-s / 4} cy={0} r={s / 5.5} />
          <line x1={-s / 12} y1={0} x2={s / 2.2} y2={0} />
          <line x1={s / 3.2} y1={0} x2={s / 3.2} y2={s / 6} />
          <line x1={s / 2.2} y1={0} x2={s / 2.2} y2={s / 5} />
        </g>
      );
    case 'clock':
      return (
        <g {...P}>
          <circle cx={0} cy={0} r={s / 2.2} />
          <polyline points={`0,${-s / 4.4} 0,0 ${s / 5},${s / 8}`} />
        </g>
      );
    default:
      return <circle cx={0} cy={0} r={s / 2.4} {...P} />;
  }
};

export const PaperFlowCard = ({title = '', sub = '', nodes = [], arrows = [], source = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = nodes.length;
  const BOX = 240;
  const gap = Math.min(190, (1620 - n * BOX) / Math.max(1, n - 1) || 0);
  const totalW = n * BOX + (n - 1) * gap;
  const startX = (1920 - totalW) / 2;
  const cy = 470;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      {nodes.map((nd, i) => {
        const x = startX + i * (BOX + gap);
        const hot = Boolean(nd.hot);
        const o = fadeIn(frame, 10 + i * 12);
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: x, top: cy - BOX / 2, width: BOX, height: BOX, opacity: o,
                         background: hot ? 'rgba(250,255,46,0.55)' : 'rgba(255,255,255,0.55)',
                         border: `3px solid ${INK}`, borderRadius: 10,
                         display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14}}>
              <svg width={100} height={100} viewBox="-50 -50 100 100">
                <Icon name={nd.icon} />
              </svg>
              <div style={{fontFamily: hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif', fontSize: 32, color: INK, textAlign: 'center', lineHeight: 1.25, padding: '0 12px'}}>
                {nd.label}
              </div>
            </div>
            {nd.sub ? (
              <div style={{position: 'absolute', left: x - 40, width: BOX + 80, top: cy + BOX / 2 + 16, textAlign: 'center', opacity: o,
                           fontFamily: 'A2Z Light, sans-serif', fontSize: 25, lineHeight: 1.35, color: INK_SOFT}}>
                {nd.sub}
              </div>
            ) : null}
            {i < n - 1 ? (
              <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, opacity: fadeIn(frame, 20 + i * 12)}}>
                <line x1={x + BOX + 12} y1={cy} x2={x + BOX + gap - 20} y2={cy} stroke={INK} strokeWidth={3} />
                <polygon points={`${x + BOX + gap - 8},${cy} ${x + BOX + gap - 26},${cy - 9} ${x + BOX + gap - 26},${cy + 9}`} fill={INK} />
                {arrows[i] ? (
                  <text x={x + BOX + gap / 2 - 4} y={cy - 20} textAnchor="middle"
                        style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 24, fill: INK_SOFT, letterSpacing: '0.04em'}}>
                    {arrows[i]}
                  </text>
                ) : null}
              </svg>
            ) : null}
          </React.Fragment>
        );
      })}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
