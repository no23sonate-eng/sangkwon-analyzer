import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_MUTE, INK_SOFT, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';

// 빌딩 실루엣 비교 카드 (Billionaires' Row 높이차트 문법).
// buildings: [{label, value(상대 0~1), note, hot, crown('flat'|'spire'|'antenna'|'dome')}]
// 실루엣이 바닥에서 자라나고, hot 은 옐로 채움 + 노트 강조.
const Silhouette = ({x, w, h, baseY, crown, fill, stroke, grow}) => {
  const top = baseY - h * grow;
  const cw = w * 0.34;
  let crownEl = null;
  if (crown === 'spire') {
    crownEl = <polygon points={`${x + w / 2 - cw / 2},${top} ${x + w / 2 + cw / 2},${top} ${x + w / 2},${top - 90 * grow}`} fill={fill} stroke={stroke} strokeWidth={2.5} />;
  } else if (crown === 'antenna') {
    crownEl = <line x1={x + w / 2} y1={top} x2={x + w / 2} y2={top - 70 * grow} stroke={stroke} strokeWidth={4} />;
  } else if (crown === 'dome') {
    crownEl = <path d={`M ${x + w * 0.1} ${top} A ${w * 0.4} ${w * 0.4} 0 0 1 ${x + w * 0.9} ${top}`} fill={fill} stroke={stroke} strokeWidth={2.5} />;
  }
  return (
    <g>
      {crownEl}
      <rect x={x} y={top} width={w} height={h * grow} fill={fill} stroke={stroke} strokeWidth={2.5} />
      {/* 창문 라인 — 수평 스트라이프로 절제 */}
      {Array.from({length: Math.max(0, Math.floor((h * grow) / 34) - 1)}, (_, i) => (
        <line key={i} x1={x + 7} y1={top + (i + 1) * 34} x2={x + w - 7} y2={top + (i + 1) * 34} stroke={stroke} strokeWidth={1} opacity={0.28} />
      ))}
    </g>
  );
};

export const SkylineCompareCard = ({
  title = '',
  sub = '',
  buildings = [],
  source = '',
  maxH = 430, // value=1 일 때 실루엣 높이(px)
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const baseY = CONTENT_BOTTOM - 96; // 라벨 2줄 공간을 남긴 바닥선
  const n = buildings.length;
  const W = Math.min(140, 700 / Math.max(1, n));
  const gap = Math.min(210, W * 1.5);
  const totalW = n * W + (n - 1) * gap;
  const startX = (1920 - totalW) / 2;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {buildings.map((b, i) => {
          const grow = spring({frame: frame - 8 - i * 6, fps, config: {damping: 200}, durationInFrames: 34});
          const x = startX + i * (W + gap);
          const hot = Boolean(b.hot);
          return (
            <Silhouette
              key={i} x={x} w={W} h={Math.max(40, maxH * (b.value ?? 0.5))} baseY={baseY}
              crown={b.crown || 'flat'} grow={grow}
              fill={hot ? YELLOW : INK_MUTE} stroke={INK}
            />
          );
        })}
        <line x1={startX - 70} y1={baseY} x2={startX + totalW + 70} y2={baseY} stroke={INK} strokeWidth={2.5} />
      </svg>
      {buildings.map((b, i) => {
        const x = startX + i * (W + gap);
        const hot = Boolean(b.hot);
        const o = fadeIn(frame, 22 + i * 6);
        return (
          <React.Fragment key={i}>
            {b.note ? (
              <div style={{position: 'absolute', left: x + W / 2 - 160, width: 320, top: baseY - Math.max(40, maxH * (b.value ?? 0.5)) - (b.crown === 'spire' ? 90 : b.crown === 'antenna' ? 70 : b.crown === 'dome' ? W * 0.42 : 0) - 62, textAlign: 'center', opacity: o, fontFamily: hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif', fontSize: 36, color: INK, fontVariantNumeric: 'tabular-nums'}}>
                {b.note}
              </div>
            ) : null}
            <div style={{position: 'absolute', left: x + W / 2 - 150, width: 300, top: baseY + 18, textAlign: 'center', opacity: o}}>
              <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 25, lineHeight: 1.35, color: hot ? INK : INK_SOFT, letterSpacing: '0.01em'}}>
                {b.label}
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
