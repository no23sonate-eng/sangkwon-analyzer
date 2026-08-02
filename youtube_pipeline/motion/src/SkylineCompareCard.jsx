import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_SOFT, YELLOW, TONES, CONTENT_BOTTOM, fadeIn} from './paper';

// 빌딩 실루엣 비교 카드 v2 — B1M Billionaires' Row 높이차트 정밀 재현.
// 실제 건물처럼 "인지 가능한 프로파일" 프리셋 + 건물마다 다른 톤 패밀리.
// buildings: [{label, value(0~1), note, hot, shape, tone(옵션: TONES 인덱스)}]
// shape: 'sphere'(구형 공연장) | 'arena'(낮은 돔) | 'slender'(초세장)
//        | 'setback'(계단형+첨탑) | 'taper'(테이퍼+안테나) | 'slab'(사각+코니스)
const Silhouette = ({cx, baseY, W, H, shape, fill, grow}) => {
  const h = H * grow;
  const top = baseY - h;
  const win = (x, y, w2, hgt) =>
    Array.from({length: Math.max(0, Math.floor(hgt / 30))}, (_, i) => (
      <line key={`w${i}`} x1={x + w2 * 0.18} y1={y + 22 + i * 30} x2={x + w2 * 0.82} y2={y + 22 + i * 30}
            stroke="#FFFFFF" strokeWidth={1.6} opacity={0.22} />
    ));
  switch (shape) {
    case 'sphere': {
      // 구형 공연장 — 지면에 살짝 묻힌 구 (라스베가스 스피어 프로파일)
      const r = Math.min(W * 0.78, h / 1.72);
      const cy = baseY - r * 0.86;
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} fill={fill} />
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`} fill="#000" opacity={0.10} />
          <ellipse cx={cx} cy={cy - r * 0.42} rx={r * 0.62} ry={r * 0.34} fill="#FFF" opacity={0.13} />
        </g>
      );
    }
    case 'arena': {
      const rw = W * 1.25, rh = h;
      return (
        <g>
          <path d={`M ${cx - rw / 2} ${baseY} A ${rw / 2} ${rh} 0 0 1 ${cx + rw / 2} ${baseY} Z`} fill={fill} />
          <line x1={cx - rw / 2 + 8} y1={baseY - rh * 0.32} x2={cx + rw / 2 - 8} y2={baseY - rh * 0.32} stroke="#FFF" strokeWidth={1.6} opacity={0.25} />
        </g>
      );
    }
    case 'slender': {
      const w = W * 0.34;
      return (
        <g>
          <rect x={cx - w / 2} y={top} width={w} height={h} fill={fill} />
          <rect x={cx - w * 0.36} y={top - h * 0.05} width={w * 0.72} height={h * 0.05} fill={fill} />
          <rect x={cx - w * 0.2} y={top - h * 0.09} width={w * 0.4} height={h * 0.04} fill={fill} />
          <line x1={cx} y1={top - h * 0.09} x2={cx} y2={top - h * 0.2} stroke={fill} strokeWidth={3} />
          {win(cx - w / 2, top, w, h)}
        </g>
      );
    }
    case 'setback': {
      const w1 = W * 0.92, w2 = W * 0.66, w3 = W * 0.4;
      const h1 = h * 0.52, h2 = h * 0.3, h3 = h * 0.18;
      return (
        <g>
          <rect x={cx - w1 / 2} y={baseY - h1} width={w1} height={h1} fill={fill} />
          <rect x={cx - w2 / 2} y={baseY - h1 - h2} width={w2} height={h2} fill={fill} />
          <rect x={cx - w3 / 2} y={baseY - h1 - h2 - h3} width={w3} height={h3} fill={fill} />
          <line x1={cx} y1={top} x2={cx} y2={top - h * 0.16} stroke={fill} strokeWidth={3.5} />
          {win(cx - w1 / 2, baseY - h1, w1, h1)}
          {win(cx - w2 / 2, baseY - h1 - h2, w2, h2)}
        </g>
      );
    }
    case 'taper': {
      const wb = W * 0.9, wt = W * 0.5;
      return (
        <g>
          <polygon points={`${cx - wb / 2},${baseY} ${cx + wb / 2},${baseY} ${cx + wt / 2},${top} ${cx - wt / 2},${top}`} fill={fill} />
          <line x1={cx} y1={top} x2={cx} y2={top - h * 0.18} stroke={fill} strokeWidth={3} />
          {win(cx - wb / 2, top + h * 0.1, wb, h * 0.85)}
        </g>
      );
    }
    default: { // slab
      const w = W * 0.8;
      return (
        <g>
          <rect x={cx - w / 2 - 6} y={top - 12} width={w + 12} height={12} fill={fill} />
          <rect x={cx - w / 2} y={top} width={w} height={h} fill={fill} />
          {win(cx - w / 2, top, w, h)}
        </g>
      );
    }
  }
};

export const SkylineCompareCard = ({
  title = '',
  sub = '',
  buildings = [],
  source = '',
  maxH = 420,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const baseY = CONTENT_BOTTOM - 58; // 바닥선을 화면 아래쪽으로
  const n = buildings.length;
  const slot = Math.min(340, 1500 / Math.max(1, n));
  const startX = (1920 - slot * n) / 2 + slot / 2;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {buildings.map((b, i) => {
          const grow = spring({frame: frame - 8 - i * 6, fps, config: {damping: 200}, durationInFrames: 36});
          const hot = Boolean(b.hot);
          const fill = hot ? YELLOW : TONES[(b.tone ?? i) % TONES.length];
          return (
            <g key={i}>
              {/* 접지 그림자 — 실루엣이 지면에 서 있다는 기준감 */}
              <ellipse cx={startX + i * slot} cy={baseY + 2} rx={Math.min(190, slot * 0.62) * (b.shape === 'sphere' ? 0.72 : 0.55)} ry={7}
                       fill={INK} opacity={0.13 * grow} />
              <Silhouette cx={startX + i * slot} baseY={baseY} W={Math.min(190, slot * 0.62)}
                          H={Math.max(50, maxH * (b.value ?? 0.5))} shape={b.shape || 'slab'} fill={fill} grow={grow} />
              {hot ? (
                <Silhouette cx={startX + i * slot} baseY={baseY} W={Math.min(190, slot * 0.62)}
                            H={Math.max(50, maxH * (b.value ?? 0.5))} shape={b.shape || 'slab'} fill="none" grow={grow} />
              ) : null}
            </g>
          );
        })}
        <line x1={startX - slot / 2 - 20} y1={baseY} x2={startX + slot * (n - 1) + slot / 2 + 20} y2={baseY} stroke={INK} strokeWidth={2.5} />
      </svg>
      {buildings.map((b, i) => {
        const cx = startX + i * slot;
        const hot = Boolean(b.hot);
        const o = fadeIn(frame, 24 + i * 6);
        const bH = Math.max(50, maxH * (b.value ?? 0.5));
        const bW = Math.min(190, slot * 0.62);
        let topY = baseY - bH;
        if (b.shape === 'sphere') {
          const r = Math.min(bW * 0.78, bH / 1.72);
          topY = baseY - r * 0.86 - r; // 구 꼭대기
        } else if (b.shape === 'setback' || b.shape === 'taper') topY -= bH * 0.18;
        else if (b.shape === 'slender') topY -= bH * 0.2;
        return (
          <React.Fragment key={i}>
            {b.note ? (
              <div style={{position: 'absolute', left: cx - slot / 2, width: slot, top: topY - 52, textAlign: 'center', opacity: o,
                           fontFamily: hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif', fontSize: 34, color: INK, fontVariantNumeric: 'tabular-nums'}}>
                {b.note}
              </div>
            ) : null}
            <div style={{position: 'absolute', left: cx - slot / 2 + 8, width: slot - 16, top: baseY + 18, textAlign: 'center', opacity: o}}>
              <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 24, lineHeight: 1.4, color: hot ? INK : INK_SOFT, letterSpacing: '0.03em', whiteSpace: 'pre-line'}}>
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
