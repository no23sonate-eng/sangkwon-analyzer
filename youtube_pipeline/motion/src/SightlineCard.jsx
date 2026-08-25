import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';

// 조망 라인 카드 — "어디서 무엇이 보여야 하는가"를 옆에서 본 단면으로.
// 산 실루엣 + 관측점 + 시선(점선) + 규제 높이. 경관 심의·고도제한 설명용.
// viewer:{x,label} / peak:{x,label,ridgeLabel} / building:{x,w,h,label,note}
export const SightlineCard = ({
  title = '', sub = '',
  viewer = {x: 260, label: '반포대교 남단'},
  peak = {x: 1560, label: '남산', ridgeLabel: '7부능선'},
  building = {x: 1010, w: 190, h: 168, label: '', note: ''},
  source = '',
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const groundY = 720;

  // 산 실루엣 (좌→우 상승하는 봉우리)
  const mtW = 620, mtH = 268;
  const mx = peak.x, mTop = groundY - mtH;
  const ridgeY = groundY - mtH * 0.7;          // 7부능선
  const drawT = interpolate(frame, [26, 74], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // 시선: 관측자 눈높이 → 능선
  const eyeY = groundY - 40;
  const lineX = viewer.x + (mx - viewer.x) * drawT;
  const lineY = eyeY + (ridgeY - eyeY) * drawT;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 산 */}
        <path d={`M ${mx - mtW / 2} ${groundY} Q ${mx - mtW * 0.22} ${mTop + 30} ${mx} ${mTop}
                  Q ${mx + mtW * 0.26} ${mTop + 46} ${mx + mtW / 2} ${groundY} Z`}
              fill={T.tones[2]} opacity={fadeIn(frame, 6)} />
        {/* 7부능선 표시 */}
        <line x1={mx - mtW * 0.30} y1={ridgeY} x2={mx + mtW * 0.34} y2={ridgeY}
              stroke={T.ink} strokeWidth={2} strokeDasharray="6 6" opacity={0.55 * fadeIn(frame, 18)} />

        {/* 건물 — 규제 높이에 맞춰 낮게 */}
        <g opacity={fadeIn(frame, 12)}>
          <rect x={building.x - building.w / 2} y={groundY - building.h}
                width={building.w} height={building.h} fill={YELLOW} />
          <rect x={building.x - building.w / 2} y={groundY - building.h}
                width={building.w} height={building.h} fill="none" stroke={T.ink} strokeWidth={3} />
          {Array.from({length: Math.floor(building.h / 22)}, (_, i) => (
            <line key={i} x1={building.x - building.w / 2 + 8} y1={groundY - building.h + (i + 1) * 22}
                  x2={building.x + building.w / 2 - 8} y2={groundY - building.h + (i + 1) * 22}
                  stroke={T.ink} strokeWidth={1} opacity={0.22} />
          ))}
        </g>

        {/* 시선 — 건물 위를 스쳐 능선에 닿는다 */}
        <line x1={viewer.x} y1={eyeY} x2={lineX} y2={lineY}
              stroke={T.ink} strokeWidth={2.6} strokeDasharray="9 7" />
        {drawT > 0.98 ? (
          <circle cx={mx} cy={ridgeY} r={7} fill={T.ink} opacity={fadeIn(frame, 76)} />
        ) : null}

        {/* 관측자 */}
        <g opacity={fadeIn(frame, 2)}>
          <circle cx={viewer.x} cy={eyeY - 26} r={13} fill={T.ink} />
          <path d={`M ${viewer.x - 20} ${groundY} L ${viewer.x - 20} ${eyeY - 12}
                    A 20 20 0 0 1 ${viewer.x + 20} ${eyeY - 12} L ${viewer.x + 20} ${groundY} Z`} fill={T.ink} />
        </g>

        {/* 지반 */}
        <line x1={90} y1={groundY} x2={1830} y2={groundY} stroke={T.ink} strokeWidth={4} />
      </svg>

      {/* 라벨 */}
      <div style={{position: 'absolute', left: Math.max(24, Math.min(1920 - 444, viewer.x - 210)), width: 420, top: groundY + 22, textAlign: 'center',
                   opacity: fadeIn(frame, 8), fontFamily: 'A2Z Medium, sans-serif',
                   fontSize: 43, color: T.ink, wordBreak: 'keep-all'}}>
        {viewer.label}
      </div>
      <div style={{position: 'absolute', left: Math.max(24, Math.min(1920 - 444, mx - 210)), width: 420, top: groundY + 22, textAlign: 'center',
                   opacity: fadeIn(frame, 8), fontFamily: 'A2Z Medium, sans-serif',
                   fontSize: 43, color: T.ink}}>
        {peak.label}
      </div>
      <div style={{position: 'absolute', left: Math.max(24, Math.min(1920 - 504, mx - 240)), width: 480, top: groundY - mtH - 112, textAlign: 'center',
                   opacity: fadeIn(frame, 66), fontFamily: 'A2Z Regular, sans-serif', fontSize: 40, color: T.ink}}>
        <span style={{background: 'rgba(250,255,46,0.85)', padding: '4px 14px'}}>{peak.ridgeLabel}</span>
        <div style={{marginTop: 10, fontFamily: 'A2Z Light, sans-serif', fontSize: 35, color: T.soft, whiteSpace: 'nowrap'}}>
          이 선이 보여야 한다
        </div>
      </div>
      {building.label ? (
        <div style={{position: 'absolute', left: Math.max(24, Math.min(1920 - 484, building.x - 230)), width: 460, top: groundY - building.h - 108,
                     textAlign: 'center', opacity: fadeIn(frame, 20)}}>
          <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 45, color: T.ink}}>{building.label}</div>
          {building.note ? (
            <div style={{marginTop: 6, fontFamily: 'A2Z Light, sans-serif', fontSize: 35, color: T.soft}}>{building.note}</div>
          ) : null}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
