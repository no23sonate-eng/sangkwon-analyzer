import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, LW} from './paper';

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
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const A = above.floors, B = below.floors;
  // 타이틀 폰트가 커지면서 서브 문구가 건물 꼭대기에 닿아 도형을 아래로 내리고
  // 총 높이를 줄였다 (지하 바닥이 자막 안전영역 820 을 넘지 않는 선에서).
  const H_ABOVE = 340, H_BELOW = 160;
  const groundY = 300 + H_ABOVE;          // 지반선
  const fhA = H_ABOVE / A;                // 지상 층고
  const fhB = H_BELOW / B;                // 지하 층고
  const W = 400, cx = 900, x0 = cx - W / 2;
  const DIM_X = x0 - 76;                  // 좌측 치수선 x

  const growA = spring({frame: frame - 8, fps, config: {damping: 200}, durationInFrames: 34});
  const growB = spring({frame: frame - 24, fps, config: {damping: 200}, durationInFrames: 32});

  // 층 인덱스 → y (지상 1층이 지반 바로 위)
  const yAbove = (f) => groundY - f * fhA;
  const yBelow = (f) => groundY + f * fhB;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* ── 지상부 ── */}
        <g clipPath="url(#clipAbove)">
          <rect x={x0} y={groundY - H_ABOVE * growA} width={W} height={H_ABOVE * growA} fill={T.tones[2]} opacity={0.9} />
          {Array.from({length: A}, (_, i) => (
            <line key={`a${i}`} x1={x0} y1={yAbove(i + 1)} x2={x0 + W} y2={yAbove(i + 1)}
                  stroke="#FFF" strokeWidth={LW.HAIR} opacity={0.35 * growA} />
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
          <rect x={x0} y={groundY} width={W} height={H_BELOW * growB} fill={T.tones[3]} opacity={0.92} />
          {Array.from({length: B}, (_, i) => (
            <line key={`b${i}`} x1={x0} y1={yBelow(i + 1)} x2={x0 + W} y2={yBelow(i + 1)}
                  stroke="#FFF" strokeWidth={LW.HAIR} opacity={0.22 * growB} />
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
        <rect x={x0} y={groundY - H_ABOVE} width={W} height={H_ABOVE} fill="none" stroke={T.ink} strokeWidth={LW.BODY} opacity={growA} />
        <rect x={x0} y={groundY} width={W} height={H_BELOW} fill="none" stroke={T.ink} strokeWidth={LW.BODY} strokeDasharray="7 5" opacity={growB} />
        <line x1={x0 - 190} y1={groundY} x2={x0 + W + 190} y2={groundY} stroke={T.ink} strokeWidth={LW.BODY} />

        {/* 치수선 — 숫자가 어느 구간을 가리키는지 눈으로 잇는다 (끝에 짧은 틱) */}
        {[[groundY - H_ABOVE, groundY, growA, 20], [groundY, groundY + H_BELOW, growB, 34]].map(([yA, yB, g, t], i) => (
          <g key={i} stroke={T.ink} strokeWidth={LW.THIN} opacity={0.55 * fadeIn(frame, t)}>
            <line x1={DIM_X} y1={yA} x2={DIM_X} y2={yB} />
            <line x1={DIM_X - 12} y1={yA} x2={DIM_X + 12} y2={yA} />
            <line x1={DIM_X - 12} y1={yB} x2={DIM_X + 12} y2={yB} />
          </g>
        ))}
      </svg>

      {/* 지상/지하 수치 — 치수선 왼쪽, 각 구간의 정확한 세로 중심에 맞춘다.
          (translateY(-50%) 로 블록 높이와 무관하게 중앙 정렬) */}
      {[['above', above, groundY - H_ABOVE / 2], ['below', below, groundY + 10]].map(([k, o, y]) => (
        // 지상은 구간 중앙 정렬. 지하는 구간(160px)보다 글자 블록이 커서 중앙에 두면
        // 지반선 위로 올라가므로 지반선 바로 아래에 위쪽을 맞춘다.
        <div key={k} style={{position: 'absolute', left: DIM_X - 28 - 420, top: y, width: 420,
                             transform: k === 'above' ? 'translateY(-50%)' : 'none', textAlign: 'right',
                             opacity: fadeIn(frame, k === 'above' ? 20 : 34)}}>
          <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 36, color: T.soft, letterSpacing: '0.05em', lineHeight: 1.1}}>{o.label}</div>
          <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 80, color: T.ink, lineHeight: 1.08}}>
            {o.floors}<span style={{fontSize: 54}}>층</span>
          </div>
          {o.note ? (
            <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: 36, color: T.soft, lineHeight: 1.2}}>{o.note}</div>
          ) : null}
        </div>
      ))}

      {/* 밴드 라벨 — 우측 */}
      {bands.map((bd, i) => {
        const yTop = bd.to >= 0 ? yAbove(bd.to) : yBelow(-bd.to - 1);
        const yBot = bd.from >= 0 ? yAbove(bd.from - 1) : yBelow(-bd.from);
        return (
          <div key={i} style={{position: 'absolute', left: x0 + W + 78, top: (yTop + yBot) / 2 - 30, width: 640,
                               opacity: fadeIn(frame, 50 + i * 8)}}>
            <div style={{fontFamily: bd.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                         fontSize: 42, color: T.ink, wordBreak: 'keep-all'}}>{bd.label}</div>
          </div>
        );
      })}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
