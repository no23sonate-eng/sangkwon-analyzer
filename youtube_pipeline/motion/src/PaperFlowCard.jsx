import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, THEMES, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, LW} from './paper';

// 종이 위 아이콘 플로우 (레퍼런스 Stocks→Cash 다이어그램 문법).
// nodes: [{icon, label, sub, hot}] — 좌→우 화살표 연결, hot 노드는 옐로 박스.
// arrows: ['화살표 위 라벨', ...] (nodes-1 개, 생략 가능)
// icon: 'money' | 'building' | 'gov' | 'doc' | 'person' | 'globe' | 'key' | 'clock'
const Icon = ({name, size = 74, T = THEMES.paper, stroke = T.ink}) => {
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

// exchange 모드 — 두 주체가 주고받는 구조를 명시 (선형 나열보다 계약 관계에 적합)
// exchange: {left:{icon,label,sub}, right:{icon,label,sub}, give:'좌→우 라벨', get:'우→좌 라벨'}
const Party = ({cx, cy, node, o, T = THEMES.paper}) => (
  <>
    <div style={{position: 'absolute', left: cx - 150, top: cy - 210, width: 300, height: 200, opacity: o,
                 display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {node.logo ? (
        // 로고가 있으면 로고를 쓴다 (아이콘보다 주체가 즉시 읽힘)
        <Img src={staticFile(node.logo)}
             style={{maxWidth: 260, maxHeight: 180, objectFit: 'contain'}} />
      ) : node.wordmark ? (
        <div style={{width: 236, height: 152, border: `4px solid ${T.ink}`, display: 'flex',
                     alignItems: 'center', justifyContent: 'center',
                     fontFamily: 'A2Z Medium, sans-serif', fontSize: 84,
                     letterSpacing: '0.04em', color: T.ink}}>
          {node.wordmark}
        </div>
      ) : (
        <svg width={190} height={190} viewBox="-50 -50 100 100">
          <Icon T={T} name={node.icon} stroke={T.ink} />
        </svg>
      )}
    </div>
    <div style={{position: 'absolute', left: cx - 220, width: 440, top: cy + 14, textAlign: 'center', opacity: o}}>
      <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 50, color: T.ink, lineHeight: 1.3, wordBreak: 'keep-all'}}>{node.label}</div>
      {node.sub ? (
        <div style={{marginTop: 10, fontFamily: 'A2Z Light, sans-serif', fontSize: 34, lineHeight: 1.35, color: T.soft}}>{node.sub}</div>
      ) : null}
    </div>
  </>
);

// layout='steps'  — 좌하 → 우상으로 한 칸씩 올라가는 계단. 경력·단계적 상승용.
// layout='vertical' — 위에서 아래로. 아이콘 왼쪽, 설명 오른쪽. 갈래·순차 회수용.
// 둘 다 "좌→우 한 줄"과 화면 구성이 달라 같은 카드가 반복되는 느낌을 줄인다.
export const PaperFlowCard = ({
  title = '', sub = '', nodes = [], arrows = [], exchange = null, layout = 'row', source = '',
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const n = nodes.length;
  const BOX = 240;
  const gap = Math.min(190, (1620 - n * BOX) / Math.max(1, n - 1) || 0);
  const totalW = n * BOX + (n - 1) * gap;
  const startX = (1920 - totalW) / 2;
  const cy = 572; // 타이틀 아래~하단 사이 광학 중심

  if (!exchange && layout === 'steps' && n) {
    // 계단 — 판 위에 아이콘이 서고, 오른쪽 위로 한 칸씩 올라간다
    const SW = Math.min(320, 1500 / n);              // 계단 한 칸 너비
    const x0 = (1920 - SW * n) / 2;
    const baseY = CONTENT_BOTTOM - 40;
    // 가장 높은 칸의 라벨(아이콘 위 2줄)이 타이틀 아래에서 시작하도록 계단 높이를 정한다
    const titleBottom = title ? (sub ? 285 : 224) : 130;
    const SH = Math.max(48, Math.min(96, (baseY - titleBottom - 286) / n));
    const topOf = (i) => baseY - (i + 1) * SH;
    return (
      <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
        <PaperBg theme={theme} {...bg} />
        <PaperTitle title={title} sub={sub} theme={theme} align={align} />
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          {nodes.map((nd, i) => {
            const o = fadeIn(frame, 10 + i * 12);
            const x = x0 + i * SW, y = topOf(i);
            return (
              <g key={i} opacity={o}>
                <rect x={x} y={y} width={SW} height={baseY - y}
                      fill={nd.hot ? YELLOW : T.tones[(i + 1) % T.tones.length]} opacity={nd.hot ? 0.95 : 0.4} />
                <polyline points={`${x},${baseY} ${x},${y} ${x + SW},${y}`}
                          fill="none" stroke={T.ink} strokeWidth={LW.BODY} />
              </g>
            );
          })}
          <line x1={x0 - 60} y1={baseY} x2={x0 + SW * n + 60} y2={baseY} stroke={T.ink} strokeWidth={LW.BODY} />
        </svg>
        {nodes.map((nd, i) => {
          const o = fadeIn(frame, 14 + i * 12);
          const x = x0 + i * SW, y = topOf(i);
          return (
            <React.Fragment key={i}>
              <div style={{position: 'absolute', left: x, width: SW, top: y - 150, height: 130, opacity: o,
                           display: 'flex', alignItems: 'flex-end', justifyContent: 'center'}}>
                <svg width={124} height={124} viewBox="-50 -50 100 100">
                  <Icon T={T} name={nd.icon} stroke={T.ink} />
                </svg>
              </div>
              <div style={{position: 'absolute', left: x - 40, width: SW + 80, top: y - 142,
                           transform: 'translateY(-100%)', textAlign: 'center', opacity: o, wordBreak: 'keep-all'}}>
                <span style={{fontFamily: nd.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                              fontSize: nd.hot ? 46 : 40, color: T.ink, lineHeight: 1.25, padding: '2px 10px',
                              background: nd.hot ? 'rgba(250,255,46,0.75)' : 'none',
                              boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'}}>
                  {nd.label}
                </span>
                {nd.sub ? (
                  <div style={{marginTop: 8, fontFamily: 'A2Z Light, sans-serif', fontSize: 31, color: T.soft}}>
                    {nd.sub}
                  </div>
                ) : null}
              </div>
            </React.Fragment>
          );
        })}
        <PaperSource source={source} theme={theme} />
      </AbsoluteFill>
    );
  }

  if (!exchange && layout === 'vertical' && n) {
    const TOP = title ? (sub ? 316 : 274) : 190;
    const ROW = Math.min(160, (CONTENT_BOTTOM - 30 - TOP) / n);
    const IX = 560;                       // 아이콘 열 x
    return (
      <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
        <PaperBg theme={theme} {...bg} />
        <PaperTitle title={title} sub={sub} theme={theme} align={align} />
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          {nodes.map((nd, i) => {
            if (i === n - 1) return null;
            const y = TOP + i * ROW + ROW / 2;
            return (
              <g key={i} opacity={fadeIn(frame, 20 + i * 12)}>
                <line x1={IX} y1={y + 52} x2={IX} y2={y + ROW - 70} stroke={T.ink} strokeWidth={2.4} />
                <polygon points={`${IX},${y + ROW - 54} ${IX - 8},${y + ROW - 72} ${IX + 8},${y + ROW - 72}`} fill={T.ink} />
              </g>
            );
          })}
        </svg>
        {nodes.map((nd, i) => {
          const y = TOP + i * ROW + ROW / 2;
          const o = fadeIn(frame, 10 + i * 12);
          return (
            <React.Fragment key={i}>
              <div style={{position: 'absolute', left: IX - 70, top: y, width: 140, height: 140,
                           transform: 'translateY(-50%)', opacity: o,
                           display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <svg width={132} height={132} viewBox="-50 -50 100 100">
                  <Icon T={T} name={nd.icon} stroke={T.ink} />
                </svg>
              </div>
              <div style={{position: 'absolute', left: IX + 96, width: 780, top: y,
                           transform: 'translateY(-50%)', opacity: o, wordBreak: 'keep-all'}}>
                <span style={{fontFamily: nd.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                              fontSize: nd.hot ? 50 : 45, color: T.ink, lineHeight: 1.25, padding: '2px 10px',
                              background: nd.hot ? 'rgba(250,255,46,0.75)' : 'none',
                              boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'}}>
                  {nd.label}
                </span>
                {nd.sub ? (
                  <div style={{marginTop: 8, fontFamily: 'A2Z Light, sans-serif', fontSize: 34, color: T.soft}}>
                    {nd.sub}
                  </div>
                ) : null}
              </div>
            </React.Fragment>
          );
        })}
        <PaperSource source={source} theme={theme} />
      </AbsoluteFill>
    );
  }

  if (exchange) {
    const cy = 566;
    const LX = 500, RX = 1420;
    const AX0 = LX + 250, AX1 = RX - 250;
    const oL = fadeIn(frame, 8), oR = fadeIn(frame, 16);
    const oGive = fadeIn(frame, 30), oGet = fadeIn(frame, 46);
    return (
      <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
        <PaperBg theme={theme} {...bg} />
        <PaperTitle title={title} sub={sub} theme={theme} align={align} />
        <Party T={T} cx={LX} cy={cy} node={exchange.left} o={oL} />
        <Party T={T} cx={RX} cy={cy} node={exchange.right} o={oR} />
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          {/* 위 화살표: 좌 → 우 (주는 것) */}
          <g opacity={oGive}>
            <line x1={AX0} y1={cy - 96} x2={AX1 - 14} y2={cy - 96} stroke={T.ink} strokeWidth={LW.THIN} />
            <polygon points={`${AX1},${cy - 96} ${AX1 - 17},${cy - 104} ${AX1 - 17},${cy - 88}`} fill={T.ink} />
          </g>
          {/* 아래 화살표: 우 → 좌 (받는 것) */}
          <g opacity={oGet}>
            <line x1={AX1} y1={cy - 22} x2={AX0 + 14} y2={cy - 22} stroke={T.ink} strokeWidth={LW.THIN} />
            <polygon points={`${AX0},${cy - 22} ${AX0 + 17},${cy - 30} ${AX0 + 17},${cy - 14}`} fill={T.ink} />
          </g>
        </svg>
        {exchange.give ? (
          <div style={{position: 'absolute', left: AX0 - 60, width: AX1 - AX0 + 120, bottom: 1080 - (cy - 116), textAlign: 'center', opacity: oGive, lineHeight: 1.65}}>
            <span style={{fontFamily: 'A2Z Regular, sans-serif', fontSize: 46, color: T.ink, letterSpacing: '0.02em', wordBreak: 'keep-all',
                          background: 'rgba(250,255,46,0.75)', padding: '4px 14px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'}}>
              {exchange.give}
            </span>
          </div>
        ) : null}
        {exchange.get ? (
          <div style={{position: 'absolute', left: AX0, width: AX1 - AX0, top: cy + 6, textAlign: 'center', opacity: oGet}}>
            <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 42, color: T.ink, letterSpacing: '0.02em', wordBreak: 'keep-all'}}>
              {exchange.get}
            </span>
          </div>
        ) : null}
        <PaperSource source={source} theme={theme} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />
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
                <Icon T={T} name={nd.icon} stroke={T.ink} />
              </svg>
            </div>
            {/* 라벨 — hot 은 옐로 하이라이트 바를 뒤에 깐다 */}
            <div style={{position: 'absolute', left: cxN - BOX / 2 - 50, width: BOX + 100, top: cy + 26, textAlign: 'center', opacity: o, wordBreak: 'keep-all'}}>
              <span style={{fontFamily: hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif', fontSize: hot ? 52 : 44,
                            color: T.ink, lineHeight: 1.3, padding: '2px 10px',
                            background: hot ? 'rgba(250,255,46,0.75)' : 'none', boxDecorationBreak: 'clone'}}>
                {nd.label}
              </span>
              {nd.sub ? (
                <div style={{marginTop: 12, fontFamily: 'A2Z Light, sans-serif', fontSize: 34, lineHeight: 1.35, color: T.soft, letterSpacing: '0.02em'}}>
                  {nd.sub}
                </div>
              ) : null}
            </div>
            {i < n - 1 ? (
              <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, opacity: fadeIn(frame, 20 + i * 12)}}>
                <line x1={x + BOX - 6} y1={cy - 64} x2={x + BOX + gap + 4} y2={cy - 64} stroke={T.ink} strokeWidth={2.4} />
                <polygon points={`${x + BOX + gap + 16},${cy - 64} ${x + BOX + gap + 1},${cy - 71} ${x + BOX + gap + 1},${cy - 57}`} fill={T.ink} />
                {arrows[i] ? (
                  <text x={x + BOX + gap / 2} y={cy - 82} textAnchor="middle"
                        style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 31, fill: T.soft, letterSpacing: '0.06em'}}>
                    {arrows[i]}
                  </text>
                ) : null}
              </svg>
            ) : null}
          </React.Fragment>
        );
      })}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
