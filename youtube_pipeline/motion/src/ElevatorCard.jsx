import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_SOFT, YELLOW, TONES, fadeIn} from './paper';

// 엘리베이터 카드 — "집에서 엘리베이터를 타고 내려가면 …" 을 그대로 그린다.
// 하나의 코어 안에서 케이지가 층을 따라 **내려가고**, 멈추는 층의 라벨이 켜진다.
// 적층 구조를 보여주는 다른 카드(단면·분해)와 달리 **이동**이 주어라, 서비스가
// 한 건물 안에서 이어진다는 뜻이 그림과 맞는다.
//
// stops: [{label, sub, hot}] — 위에서 아래 순서
export const ElevatorCard = ({title = '', sub = '', stops = [], source = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = stops.length;
  if (!n) return <AbsoluteFill><PaperBg /></AbsoluteFill>;

  const TOP = title ? (sub ? 316 : 272) : 190;
  const BOT = 790;
  const ROW = (BOT - TOP) / n;
  const yOf = (i) => TOP + ROW * (i + 0.5);

  const SHAFT_X = 560, SHAFT_W = 190;
  const CAGE_H = Math.min(118, ROW * 0.62);

  // 층마다 잠시 멈춘다 — 이동 34프레임 + 정지 26프레임
  const MOVE = 34, HOLD = 26, T0 = 18;
  const seg = MOVE + HOLD;
  const t = Math.max(0, frame - T0);
  const k = Math.min(n - 1, Math.floor(t / seg));
  const local = Math.min(1, (t - k * seg) / MOVE);
  const ease = local * local * (3 - 2 * local);
  const cageY = k === 0 ? yOf(0) : yOf(k - 1) + (yOf(k) - yOf(k - 1)) * ease;
  const arrived = (i) => t >= i * seg + MOVE * 0.9;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 층 슬래브 — 코어 좌우로 뻗는다 */}
        {stops.map((s, i) => {
          const y = yOf(i), on = arrived(i);
          const o = fadeIn(frame, 6 + i * 6);
          return (
            <g key={i}>
              <rect x={250} y={y - ROW / 2 + 8} width={1420} height={ROW - 16}
                    fill={on && s.hot ? YELLOW : TONES[(i + 1) % TONES.length]}
                    opacity={(on ? (s.hot ? 0.92 : 0.62) : 0.14) * o} />
              <line x1={250} y1={y + ROW / 2 - 8} x2={1670} y2={y + ROW / 2 - 8}
                    stroke={INK} strokeWidth={2} opacity={0.35 * o} />
            </g>
          );
        })}
        {/* 승강로 */}
        <rect x={SHAFT_X} y={TOP} width={SHAFT_W} height={BOT - TOP}
              fill="#FFF" opacity={0.55} stroke={INK} strokeWidth={3} />
        {/* 케이지 */}
        <g opacity={fadeIn(frame, T0 - 8)}>
          <rect x={SHAFT_X + 12} y={cageY - CAGE_H / 2} width={SHAFT_W - 24} height={CAGE_H}
                fill={INK} rx={4} />
          <line x1={SHAFT_X + SHAFT_W / 2} y1={cageY - CAGE_H / 2 + 10}
                x2={SHAFT_X + SHAFT_W / 2} y2={cageY + CAGE_H / 2 - 10}
                stroke="#FFF" strokeWidth={2} opacity={0.5} />
          {/* 아래로 가는 화살표 */}
          <polygon points={`${SHAFT_X + SHAFT_W / 2},${cageY + CAGE_H / 2 + 26}
                            ${SHAFT_X + SHAFT_W / 2 - 13},${cageY + CAGE_H / 2 + 6}
                            ${SHAFT_X + SHAFT_W / 2 + 13},${cageY + CAGE_H / 2 + 6}`}
                   fill={INK} opacity={k < n - 1 ? 0.55 : 0} />
        </g>
        {/* 코어 상단 라벨 배경 */}
        <line x1={SHAFT_X} y1={TOP} x2={SHAFT_X + SHAFT_W} y2={TOP} stroke={INK} strokeWidth={4} />
      </svg>

      {stops.map((s, i) => {
        const y = yOf(i), on = arrived(i);
        return (
          <div key={i} style={{position: 'absolute', left: SHAFT_X + SHAFT_W + 62, width: 860, top: y,
                               transform: 'translateY(-50%)',
                               opacity: on ? 1 : 0.35, transition: 'none'}}>
            <div style={{fontFamily: s.hot ? 'Pretendard Bold, A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                         fontSize: 48, color: INK, lineHeight: 1.2, wordBreak: 'keep-all'}}>
              {s.label}
            </div>
            {s.sub ? (
              <div style={{marginTop: 6, fontFamily: 'A2Z Light, sans-serif', fontSize: 34, color: INK_SOFT}}>
                {s.sub}
              </div>
            ) : null}
          </div>
        );
      })}
      {/* 좌측 층 표시 */}
      {stops.map((s, i) => (
        <div key={i} style={{position: 'absolute', left: 280, width: SHAFT_X - 340, top: yOf(i),
                             transform: 'translateY(-50%)', textAlign: 'right',
                             opacity: arrived(i) ? 0.95 : 0.3,
                             fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 36, color: INK}}>
          {s.floor || ''}
        </div>
      ))}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
