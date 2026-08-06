import React from 'react';
import {AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {YELLOW, fadeIn} from './paper';

// 실측 단면 도면 위에 치수·강조를 얹는 카드.
// 도식으로 그린 SectionCard 와 달리 **실제 단면 렌더**를 쓰므로, 지상 타워와
// 지하 주차층이 어떤 모습인지 그대로 보인다. 사용자가 준 공식 SECTIONAL LAYOUT 기준.
//
// groundRatio : 이미지 세로에서 지반선이 놓인 비율 (0~1)
// above/below : {floors, label, note}
// bands       : [{y0, y1, label, hot}] — 화면 세로 비율(0~1) 구간을 강조
const SHADOW = '0 2px 20px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.6)';

export const SectionPhotoCard = ({
  title = '', sub = '',
  image = 'parkside/sectional.jpg',
  imageRatio = 2.124,      // 잘라낸 도면의 가로/세로
  groundRatio = 0.7132,    // 도면 안에서 지반(광장 레벨)이 놓인 세로 비율
  groundY = 596,           // 그 지반을 화면 어느 높이에 둘지 — 이 한 값으로 전체가 정렬된다
  above = {floors: 20, label: '지상', note: ''},
  below = {floors: 7, label: '지하', note: ''},
  bands = [],
  source = '',
  kenBurns = true,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  // cover 로 깔면 지반이 화면 아래쪽(y≈770)에 박혀서 지하 수치가 자막 영역으로 밀린다.
  // 대신 폭에 맞춰 깔고, **지반이 groundY 에 오도록 위아래 위치를 계산**한다.
  // 도면 아래가 남는 자리는 배경색이 되어 자막 영역으로 쓰인다.
  const zoom = kenBurns ? interpolate(frame, [0, 300], [1.0, 1.05], {extrapolateRight: 'clamp'}) : 1;
  const imgW = 1920 * zoom;
  const imgH = imgW / imageRatio;
  const imgLeft = (1920 - imgW) / 2;
  const imgTop = groundY - groundRatio * imgH;
  const yOf = (f) => imgTop + f * imgH;          // 도면 세로 비율 → 화면 y
  const draw = interpolate(frame, [10, 42], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const DIM_X = 300;                 // 치수선 x
  const TOP_Y = 262;                 // 지상 치수 시작 (타워 꼭대기 근처)
  const BOT_Y = Math.round(imgTop + imgH);  // 지하 치수 끝 = 도면 바닥

  const Dim = ({y0, y1, o}) => (
    <g stroke="#FFFFFF" strokeWidth={2.5} opacity={0.85 * o}>
      <line x1={DIM_X} y1={y0} x2={DIM_X} y2={y1} />
      <line x1={DIM_X - 14} y1={y0} x2={DIM_X + 14} y2={y0} />
      <line x1={DIM_X - 14} y1={y1} x2={DIM_X + 14} y2={y1} />
    </g>
  );

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: '#12151a'}}>
      <Img src={staticFile(image)}
           style={{position: 'absolute', left: imgLeft, top: imgTop, width: imgW, height: imgH}} />
      {/* 원본 도면에도 캡션이 빽빽해서, 전체를 한 겹 눌러 우리 오버레이가 위로 오게 한다 */}
      <div style={{position: 'absolute', inset: 0, background: 'rgba(11,14,18,0.34)'}} />
      <div style={{position: 'absolute', inset: 0,
                   background: 'linear-gradient(180deg, rgba(11,14,18,0.82) 0%, rgba(11,14,18,0.30) 24%, rgba(11,14,18,0) 40%)'}} />
      <div style={{position: 'absolute', inset: 0,
                   background: 'linear-gradient(90deg, rgba(11,14,18,0.86) 0%, rgba(11,14,18,0.46) 22%, rgba(11,14,18,0) 42%)'}} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 강조 구간 */}
        {bands.map((b, i) => {
          const o = fadeIn(frame, 44 + i * 8);
          return (
            <rect key={i} x={0} y={yOf(b.y0)} width={1920} height={yOf(b.y1) - yOf(b.y0)}
                  fill={b.hot ? YELLOW : '#FFFFFF'} opacity={(b.hot ? 0.22 : 0.12) * o} />
          );
        })}
        {/* 지반선 — 좌에서 우로 그어진다 */}
        <line x1={0} y1={groundY} x2={1920 * draw} y2={groundY}
              stroke={YELLOW} strokeWidth={4} />
        <Dim y0={TOP_Y} y1={groundY} o={fadeIn(frame, 22)} />
        <Dim y0={groundY} y1={BOT_Y} o={fadeIn(frame, 34)} />
      </svg>

      {/* 타이틀 */}
      <div style={{position: 'absolute', top: 92, left: 0, width: 1920, textAlign: 'center', opacity: fadeIn(frame, 0)}}>
        <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 68,
                     letterSpacing: '-0.01em', color: '#FFFFFF', textShadow: SHADOW}}>
          {title}
        </div>
        {sub ? (
          <div style={{marginTop: 12, fontFamily: 'A2Z Light, sans-serif', fontSize: 36,
                       letterSpacing: '0.06em', color: '#E4E8EE', textShadow: SHADOW}}>
            {sub}
          </div>
        ) : null}
      </div>

      {/* 지상 / 지하 수치 — 치수선 왼쪽 */}
      {[['above', above, (TOP_Y + groundY) / 2, 22], ['below', below, (groundY + BOT_Y) / 2, 34]].map(([k, o, y, t]) => (
        <div key={k} style={{position: 'absolute', left: 40, width: DIM_X - 76, top: y,
                             transform: 'translateY(-50%)', textAlign: 'right', opacity: fadeIn(frame, t)}}>
          <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 40, color: '#D8DDE4',
                       letterSpacing: '0.05em', lineHeight: 1.1, textShadow: SHADOW}}>{o.label}</div>
          <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 100,
                       color: '#FFFFFF', lineHeight: 1.06, textShadow: SHADOW}}>
            {o.floors}<span style={{fontSize: 58}}>층</span>
          </div>
          {o.note ? (
            <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: 34,
                         color: '#D8DDE4', lineHeight: 1.2, textShadow: SHADOW}}>{o.note}</div>
          ) : null}
        </div>
      ))}

      {/* 강조 구간 라벨 — 우측 */}
      {bands.map((b, i) => (
        <div key={i} style={{position: 'absolute', right: 84, width: 900, top: yOf(b.y0) - 14,
                             transform: 'translateY(-100%)', textAlign: 'right',
                             opacity: fadeIn(frame, 50 + i * 8)}}>
          <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 46,
                        color: b.hot ? '#12151a' : '#FFFFFF', wordBreak: 'keep-all',
                        background: b.hot ? YELLOW : 'rgba(11,14,18,0.88)', padding: '6px 18px',
                        boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
                        textShadow: b.hot ? 'none' : SHADOW}}>
            {b.label}
          </span>
        </div>
      ))}

      {source ? (
        <div style={{position: 'absolute', right: 96, top: 816, textAlign: 'right',
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 29, letterSpacing: '0.06em',
                     color: '#FFFFFF', opacity: 0.8 * fadeIn(frame, 40), textShadow: SHADOW}}>
          {source}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
