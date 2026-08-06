import React from 'react';
import {AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, PAPER, INK, INK_SOFT, YELLOW, fadeIn} from './paper';

// 주고받기 — **순서대로 움직이는** 교환 카드.
// 정지된 화살표 두 개를 한꺼번에 보여주는 대신,
//   ① 좌 → 우 화살표가 그어지고 그 위로 픽토그램이 건너간다
//   ② 다 건너간 뒤 우 → 좌 화살표가 반대로 그어지고 픽토그램이 돌아온다
// 무엇을 주고 무엇을 받는지가 시간 순서로 읽힌다. 글자는 최소로.
//
// left/right: {logo|wordmark, label, sub}
// give/get:   {icon, label, sub}   ← 화살표를 타고 건너가는 것
const Pict = ({name, size = 92, stroke = INK}) => {
  const s = size;
  const P = {stroke, strokeWidth: 3.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round'};
  switch (name) {
    case 'base':   // 기지 — 낮은 동 여러 채 + 울타리
      return (
        <g {...P}>
          <rect x={-s / 2} y={-s / 6} width={s / 3} height={s / 2.4} />
          <rect x={-s / 10} y={-s / 3.2} width={s / 3} height={s / 1.75} />
          <rect x={s / 4.2} y={-s / 12} width={s / 4.2} height={s / 2.8} />
          <line x1={-s / 1.75} y1={s / 3.4} x2={s / 1.75} y2={s / 3.4} />
        </g>
      );
    case 'land':   // 땅 — 필지 4개
      return (
        <g {...P}>
          <polygon points={`${-s / 1.9},${s / 8} 0,${-s / 3.4} ${s / 1.9},${s / 8} 0,${s / 2.2}`} />
          <line x1={-s / 1.9} y1={s / 8} x2={s / 1.9} y2={s / 8} opacity={0.55} />
          <line x1={0} y1={-s / 3.4} x2={0} y2={s / 2.2} opacity={0.55} />
        </g>
      );
    case 'height': // 용적률 — 층이 쌓인 건물 + 위로 향한 화살표
      return (
        <g {...P}>
          <rect x={-s / 2} y={-s / 2.6} width={s / 2.2} height={s / 1.22} />
          {[1, 2, 3].map((k) => (
            <line key={k} x1={-s / 2} y1={-s / 2.6 + k * (s / 4.4)} x2={-s / 2 + s / 2.2} y2={-s / 2.6 + k * (s / 4.4)}
                  opacity={0.55} />
          ))}
          <line x1={s / 3.6} y1={s / 2.2} x2={s / 3.6} y2={-s / 1.9} />
          <polyline points={`${s / 3.6 - s / 9},${-s / 3.4} ${s / 3.6},${-s / 1.9} ${s / 3.6 + s / 9},${-s / 3.4}`} />
        </g>
      );
    case 'mountain': // 남산 — 능선 두 봉우리 + N서울타워
      return (
        <g {...P}>
          <line x1={-s / 1.7} y1={s / 2.4} x2={s / 1.7} y2={s / 2.4} />
          <path d={`M ${-s / 1.75} ${s / 2.4} Q ${-s / 5} ${-s / 6} ${s / 12} ${s / 2.4}`} opacity={0.55} />
          <path d={`M ${-s / 6} ${s / 2.4} Q ${s / 5.5} ${-s / 2.6} ${s / 1.75} ${s / 2.4}`} />
          <line x1={s / 5.5} y1={-s / 2.6} x2={s / 5.5} y2={-s / 1.5} />
          <line x1={s / 5.5 - s / 14} y1={-s / 1.5} x2={s / 5.5 + s / 14} y2={-s / 1.5} />
        </g>
      );
    default:
      return <circle cx={0} cy={0} r={s / 2.6} {...P} />;
  }
};

// 좌우 당사자 — 로고(또는 워드마크) 위, 이름 아래.
const LOGO_TOP = 262, LOGO_H = 156, LABEL_TOP = 436;
const Party = ({cx, node, o}) => (
  <>
    <div style={{position: 'absolute', left: cx - 150, top: LOGO_TOP, width: 300, height: LOGO_H, opacity: o,
                 display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {node.logo ? (
        <Img src={staticFile(node.logo)} style={{maxWidth: 280, maxHeight: LOGO_H, objectFit: 'contain'}} />
      ) : (
        <div style={{width: 236, height: 148, border: `4px solid ${INK}`, display: 'flex',
                     alignItems: 'center', justifyContent: 'center',
                     fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 84,
                     letterSpacing: '0.04em', color: INK}}>
          {node.wordmark}
        </div>
      )}
    </div>
    <div style={{position: 'absolute', left: cx - 185, width: 370, top: LABEL_TOP, textAlign: 'center', opacity: o}}>
      <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 52, color: INK,
                   lineHeight: 1.2, wordBreak: 'keep-all'}}>{node.label}</div>
      {node.sub ? (
        <div style={{marginTop: 8, fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: INK_SOFT,
                     wordBreak: 'keep-all'}}>{node.sub}</div>
      ) : null}
    </div>
  </>
);

export const ExchangeMotionCard = ({
  title = '', sub = '', left = {}, right = {}, give = {}, get: got = {}, source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const LX = 300, RX = 1620;          // 당사자 중심
  const AX0 = 520, AX1 = 1400;        // 화살표 구간 (당사자 사이)
  const Y_GIVE = 600, Y_GET = 730;    // 위 = 주는 것 / 아래 = 받는 것

  // ① 좌→우 (18~66)  ② 우→좌 (86~134)
  const t1 = interpolate(frame, [18, 66], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const t2 = interpolate(frame, [86, 134], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ease = (t) => t * t * (3 - 2 * t);
  const e1 = ease(t1), e2 = ease(t2);

  // 이동하는 물건은 [픽토그램 | 이름] 가로 칩. 세로를 적게 먹어야 두 레인이 겹치지 않는다.
  // 화살촉이 앞서 그어지고 칩이 그 뒤를 따라온다 — 선은 칩 뒤로 숨는다.
  const textW = (s, px) => (s || '').split('').reduce(
    (a, c) => a + px * (c.charCodeAt(0) > 0x1100 ? 1.0 : 0.56), 0);
  const chipW = (item) => 92 + 16 + Math.max(textW(item.label, 46), textW(item.sub, 34)) + 28;

  const Lane = ({y, from, to, t, item, delay, flip}) => {
    const tip = from + (to - from) * t;
    const dir = flip ? -1 : 1;
    const CW = chipW(item);
    const cx = tip - dir * (CW / 2 + 26);
    const on = t > 0.001;
    return (
      <>
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          {on ? (
            <>
              <line x1={from} y1={y} x2={tip} y2={y} stroke={INK} strokeWidth={3} />
              <polygon points={`${tip},${y} ${tip - dir * 22},${y - 11} ${tip - dir * 22},${y + 11}`} fill={INK} />
            </>
          ) : null}
        </svg>
        <div style={{position: 'absolute', left: cx - CW / 2, top: y - 52, width: CW, height: 104,
                     display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
                     background: PAPER, opacity: fadeIn(frame, delay)}}>
          <svg width={92} height={92} viewBox="-60 -60 120 120" style={{flex: '0 0 auto'}}>
            <Pict name={item.icon} stroke={INK} />
          </svg>
          <div style={{textAlign: 'left'}}>
            <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 46,
                         color: INK, lineHeight: 1.15, whiteSpace: 'nowrap'}}>
              <span style={{background: item.hot ? YELLOW : 'none', padding: item.hot ? '2px 10px' : 0}}>
                {item.label}
              </span>
            </div>
            {item.sub ? (
              <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: 34,
                           color: INK_SOFT, whiteSpace: 'nowrap'}}>{item.sub}</div>
            ) : null}
          </div>
        </div>
      </>
    );
  };

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      <Party cx={LX} node={left} o={fadeIn(frame, 6)} />
      <Party cx={RX} node={right} o={fadeIn(frame, 12)} />
      <Lane y={Y_GIVE} from={AX0} to={AX1} t={e1} item={give} delay={18} flip={false} />
      <Lane y={Y_GET} from={AX1} to={AX0} t={e2} item={got} delay={86} flip />
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
