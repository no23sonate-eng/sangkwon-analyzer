import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, PaperCaption,
        YELLOW, CONTENT_BOTTOM, fadeIn, SP} from './paper';

// 기간 비교를 "달력 아이콘 개수"로 보여주는 카드 — 42개월(달력 42개)이
// 화살표를 지나 21개월(달력 21개)로 반토막 나는 걸 아이콘 개수 차이로
// 즉물적으로 읽히게 한다(2026-07-30 "#1 42개월 화살표 21개월, 달력
// 여러 개에서 21개월이 개수가 더 작게" 피드백 — BarChartCard 반복 회피).
const CalendarIcon = ({size = 44, color = '#C7CBD3', opacity = 1}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{opacity, display: 'block'}}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" fill="none" stroke={color} strokeWidth="1.7" />
    <rect x="3" y="5" width="18" height="5" rx="2.5" fill={color} />
    <line x1="8" y1="2.6" x2="8" y2="7" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <line x1="16" y1="2.6" x2="16" y2="7" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const CalendarGrid = ({count, cols, cell, gap, color, startFrame, perIcon, frame, x, topY}) => {
  const rows = Math.ceil(count / cols);
  return (
    <div style={{position: 'absolute', top: topY, left: x, width: cols * (cell + gap) - gap}}>
      {Array.from({length: count}).map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const opacity = interpolate(
          frame,
          [startFrame + i * perIcon, startFrame + i * perIcon + 8],
          [0, 1],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
        );
        return (
          <div key={i} style={{position: 'absolute', top: r * (cell + gap), left: c * (cell + gap)}}>
            <CalendarIcon size={cell} color={color} opacity={opacity} />
          </div>
        );
      })}
      <div style={{height: rows * (cell + gap)}} />
    </div>
  );
};

export const CalendarCompareCard = ({
  title = '',
  leftCount = 42,
  rightCount = 21,
  leftValue = '42개월',
  rightValue = '21개월',
  leftLabel = '기존',
  rightLabel = '패스트트랙',
  closingLine = '', caption = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const {durationInFrames} = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});

  const COLS = 7;
  const CELL = 46;
  const GAP = 14;
  const GRID_W = COLS * (CELL + GAP) - GAP;
  const GRID_TOP = 290;
  const LEFT_X = 330;
  const RIGHT_X = 1920 - 330 - GRID_W;

  const LEFT_START = 15;
  const PER_ICON = 1.4;
  const leftDone = LEFT_START + leftCount * PER_ICON + 8;
  const arrowOpacity = interpolate(frame, [leftDone, leftDone + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const arrowX = interpolate(arrowOpacity, [0, 1], [-24, 0]);
  const RIGHT_START = leftDone + 16;
  const rightDone = RIGHT_START + rightCount * PER_ICON + 8;

  const leftNumOpacity = interpolate(frame, [LEFT_START + 12, LEFT_START + 26], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const rightNumOpacity = interpolate(frame, [RIGHT_START + 12, RIGHT_START + 26], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const closingStart = Math.max(Math.round(durationInFrames * 0.6), rightDone + 20);
  const closingOpacity = interpolate(frame, [closingStart, closingStart + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const NUM_TOP = GRID_TOP + 6 * (CELL + GAP) + 40;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />

      <div
        style={{
          position: 'absolute', top: 110, left: 0, width: '100%', textAlign: 'center',
          fontSize: 34, opacity: titleOpacity, color: T.ink, fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
        }}
      >
        {title}
      </div>

      <CalendarGrid
        count={leftCount} cols={COLS} cell={CELL} gap={GAP} color="#C98A9E"
        startFrame={LEFT_START} perIcon={PER_ICON} frame={frame} x={LEFT_X} topY={GRID_TOP}
      />
      <CalendarGrid
        count={rightCount} cols={COLS} cell={CELL} gap={GAP} color="#8FAD8B"
        startFrame={RIGHT_START} perIcon={PER_ICON} frame={frame} x={RIGHT_X} topY={GRID_TOP}
      />

      {/* 중앙 화살표 */}
      <div
        style={{
          position: 'absolute', top: GRID_TOP + 150, left: 880, width: 160, textAlign: 'center',
          opacity: arrowOpacity, transform: `translateX(${arrowX}px)`,
        }}
      >
        <svg width="160" height="60" viewBox="0 0 160 60">
          <line x1="10" y1="30" x2="128" y2="30" stroke={YELLOW} strokeWidth="5" strokeLinecap="round" />
          <path d="M122 12 L150 30 L122 48" fill="none" stroke={YELLOW} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div style={{position: 'absolute', top: NUM_TOP, left: LEFT_X, width: GRID_W, textAlign: 'center', opacity: leftNumOpacity}}>
        <div style={{fontSize: 54, color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif', letterSpacing: '0.03em'}}>{leftValue}</div>
        <div style={{fontSize: 28, marginTop: 12, color: T.soft, fontFamily: 'A2Z Light, sans-serif'}}>{leftLabel}</div>
      </div>
      <div style={{position: 'absolute', top: NUM_TOP, left: RIGHT_X, width: GRID_W, textAlign: 'center', opacity: rightNumOpacity}}>
        <div style={{fontSize: 54, color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif', letterSpacing: '0.03em'}}>{rightValue}</div>
        <div style={{fontSize: 28, marginTop: 12, color: T.soft, fontFamily: 'A2Z Light, sans-serif'}}>{rightLabel}</div>
      </div>

      {closingLine ? (
        <div
          style={{
            position: 'absolute', top: NUM_TOP + 150, left: 0, width: '100%', textAlign: 'center',
            fontSize: 36, color: T.ink, fontFamily: 'A2Z Regular, sans-serif', letterSpacing: '0.02em',
            opacity: closingOpacity,
          }}
        >
          {closingLine}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
