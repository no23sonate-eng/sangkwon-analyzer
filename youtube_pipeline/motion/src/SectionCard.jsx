import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_SOFT, YELLOW, TONES, CONTENT_BOTTOM, fadeIn} from './paper';

// 건물 단면 카드 — 지상/지하를 지반선 기준으로 나눠 보여준다.
// 지하가 깊은 프로젝트(용산 파크사이드: 지하7·지상20)의 핵심 설명용.
// above:{floors,label,note} / below:{floors,label,note}
// bands:[{from,to,label,hot}] 층 구간 강조 (예: 지하1~지상4 리테일)
export const SectionCard = ({
  title = '', sub = '',
  above = {floors: 20, label: '지상', note: ''},
  below = {floors: 7, label: '지하', note: ''},
  bands = [],
  groundLabel = '지반',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const A = above.floors, B = below.floors;
  const H_ABOVE = 372, H_BELOW = 176;
  const groundY = 268 + H_ABOVE;          // 지반선
  const fhA = H_ABOVE / A;                // 지상 층고
  const fhB = H_BELOW / B;                // 지하 층고
  const W = 400, cx = 900, x0 = cx - W / 2;

  const growA = spring({frame: frame - 8, fps, config: {damping: 200}, durationInFrames: 34});
  const growB = spring({frame: frame - 24, fps, config: {damping: 200}, durationInFrames: 32});

  // 층 인덱스 → y (지상 1층이 지반 바로 위)
  const yAbove = (f) => groundY - f * fhA;
  const yBelow = (f) => groundY + f * fhB;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* ── 지상부 ── */}
        <g clipPath="url(#clipAbove)">
          <rect x={x0} y={groundY - H_ABOVE * growA} width={W} height={H_ABOVE * growA} fill={TONES[2]} opacity={0.9} />
          {Array.from({length: A}, (_, i) => (
            <line key={`a${i}`} x1={x0} y1={yAbove(i + 1)} x2={x0 + W} y2={yAbove(i + 1)}
                  stroke="#FFF" strokeWidth={1} opacity={0.35 * growA} />
          ))}
        </g>
        <defs>
          <clipPath id="clipAbove">
            <rect x={x0} y={groundY - H_ABOVE} width={W} height={H_ABOVE} />
          </clipPath>
          <clipPath id="clipBelow">
            <rect x={x0} y={groundY} width={W} height={H_BELOW} />
          </clipPath>
        </defs>

        {/* ── 지하부 (지반 아래 · 톤을 더 어둡게) ── */}
        <g clipPath="url(#clipBelow)">
          <rect x={x0} y={groundY} width={W} height={H_BELOW * growB} fill={TONES[3]} opacity={0.92} />
          {Array.from({length: B}, (_, i) => (
            <line key={`b${i}`} x1={x0} y1={yBelow(i + 1)} x2={x0 + W} y2={yBelow(i + 1)}
                  stroke="#FFF" strokeWidth={1} opacity={0.22 * growB} />
          ))}
        </g>

        {/* 강조 밴드 — from/to 는 층수(음수 = 지하) */}
        {bands.map((bd, i) => {
          const yTop = bd.to >= 0 ? yAbove(bd.to) : yBelow(-bd.to - 1);
          const yBot = bd.from >= 0 ? yAbove(bd.from - 1) : yBelow(-bd.from);
          const o = fadeIn(frame, 46 + i * 8);
          return (
            <rect key={i} x={x0} y={yTop} width={W} height={Math.max(4, yBot - yTop)}
                  fill={bd.hot ? YELLOW : '#FFF'} opacity={(bd.hot ? 0.85 : 0.35) * o} />
          );
        })}

        {/* 외곽선 + 지반선 */}
        <rect x={x0} y={groundY - H_ABOVE} width={W} height={H_ABOVE} fill="none" stroke={INK} strokeWidth={3} opacity={growA} />
        <rect x={x0} y={groundY} width={W} height={H_BELOW} fill="none" stroke={INK} strokeWidth={3} strokeDasharray="7 5" opacity={growB} />
        <line x1={x0 - 190} y1={groundY} x2={x0 + W + 190} y2={groundY} stroke={INK} strokeWidth={4} />
      </svg>

      {/* 지상/지하 수치 — 좌측에 크게 */}
      {[['above', above, groundY - H_ABOVE / 2, growA], ['below', below, groundY + H_BELOW / 2, growB]].map(([k, o, y, g]) => (
        <div key={k} style={{position: 'absolute', left: 150, top: y - 62, width: 400, textAlign: 'right', opacity: fadeIn(frame, k === 'above' ? 20 : 34)}}>
          <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 30, color: INK_SOFT, letterSpacing: '0.05em'}}>{o.label}</div>
          <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 72, color: INK, lineHeight: 1.1}}>
            {o.floors}<span style={{fontSize: 42}}>층</span>
          </div>
          {o.note ? (
            <div style={{marginTop: 2, fontFamily: 'A2Z Light, sans-serif', fontSize: 27, color: INK_SOFT}}>{o.note}</div>
          ) : null}
        </div>
      ))}

      {/* 밴드 라벨 — 우측 */}
      {bands.map((bd, i) => {
        const yTop = bd.to >= 0 ? yAbove(bd.to) : yBelow(-bd.to - 1);
        const yBot = bd.from >= 0 ? yAbove(bd.from - 1) : yBelow(-bd.from);
        return (
          <div key={i} style={{position: 'absolute', left: x0 + W + 78, top: (yTop + yBot) / 2 - 26, width: 480,
                               opacity: fadeIn(frame, 50 + i * 8)}}>
            <div style={{fontFamily: bd.hot ? 'Pretendard Bold, A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                         fontSize: 34, color: INK, wordBreak: 'keep-all'}}>{bd.label}</div>
          </div>
        );
      })}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
