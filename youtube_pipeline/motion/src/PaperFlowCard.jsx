import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_SOFT, YELLOW, fadeIn} from './paper';

// 종이 위 아이콘 플로우 (레퍼런스 Stocks→Cash 다이어그램 문법).
// nodes: [{icon, label, sub, hot}] — 좌→우 화살표 연결, hot 노드는 옐로 박스.
// arrows: ['화살표 위 라벨', ...] (nodes-1 개, 생략 가능)
// icon: 'money' | 'building' | 'gov' | 'doc' | 'person' | 'globe' | 'key' | 'clock'
const Icon = ({name, size = 74, stroke = INK}) => {
  const s = size, sw = 2.8;
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
        const cxN = x + BOX / 2;
        const hot = Boolean(nd.hot);
        const o = fadeIn(frame, 10 + i * 12);
        const iconScale = hot ? 1.22 : 1;
        return (
          <React.Fragment key={i}>
            {/* 자유 배치 아이콘 (박스 없음 — 레퍼런스 문법) */}
            <div style={{position: 'absolute', left: cxN - 80, top: cy - 150, width: 160, height: 160, opacity: o,
                         display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <svg width={150} height={150} viewBox="-50 -50 100 100" style={{transform: `scale(${iconScale})`}}>
                <Icon name={nd.icon} stroke={INK} />
              </svg>
            </div>
            {/* 라벨 — hot 은 옐로 하이라이트 바를 뒤에 깐다 */}
            <div style={{position: 'absolute', left: cxN - BOX / 2 - 20, width: BOX + 40, top: cy + 26, textAlign: 'center', opacity: o}}>
              <span style={{fontFamily: hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif', fontSize: hot ? 38 : 33,
                            color: INK, lineHeight: 1.3, padding: '2px 10px',
                            background: hot ? 'rgba(250,255,46,0.75)' : 'none', boxDecorationBreak: 'clone'}}>
                {nd.label}
              </span>
              {nd.sub ? (
                <div style={{marginTop: 12, fontFamily: 'A2Z Light, sans-serif', fontSize: 25, lineHeight: 1.35, color: INK_SOFT, letterSpacing: '0.02em'}}>
                  {nd.sub}
                </div>
              ) : null}
            </div>
            {i < n - 1 ? (
              <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, opacity: fadeIn(frame, 20 + i * 12)}}>
                <line x1={x + BOX - 6} y1={cy - 64} x2={x + BOX + gap + 4} y2={cy - 64} stroke={INK} strokeWidth={2.4} />
                <polygon points={`${x + BOX + gap + 16},${cy - 64} ${x + BOX + gap + 1},${cy - 71} ${x + BOX + gap + 1},${cy - 57}`} fill={INK} />
                {arrows[i] ? (
                  <text x={x + BOX + gap / 2} y={cy - 82} textAnchor="middle"
                        style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 23, fill: INK_SOFT, letterSpacing: '0.06em'}}>
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
