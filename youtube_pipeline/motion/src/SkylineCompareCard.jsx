import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, THEMES, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, LW} from './paper';

// 빌딩 실루엣 비교 카드 v2 — B1M Billionaires' Row 높이차트 정밀 재현.
// 실제 건물처럼 "인지 가능한 프로파일" 프리셋 + 건물마다 다른 톤 패밀리.
// buildings: [{label, value(0~1), note, hot, shape, tone(옵션: T.tones 인덱스)}]
// shape: 'sphere'(구형 공연장) | 'arena'(낮은 돔) | 'slender'(초세장)
//        | 'setback'(계단형+첨탑) | 'taper'(테이퍼+안테나) | 'slab'(사각+코니스)
const Silhouette = ({cx, baseY, W, H, shape, fill, grow, T = THEMES.paper}) => {
  const h = H * grow;
  const top = baseY - h;
  const win = (x, y, w2, hgt) =>
    Array.from({length: Math.max(0, Math.floor(hgt / 30))}, (_, i) => (
      <line key={`w${i}`} x1={x + w2 * 0.18} y1={y + 22 + i * 30} x2={x + w2 * 0.82} y2={y + 22 + i * 30}
            stroke="#FFFFFF" strokeWidth={LW.HAIR} opacity={0.22} />
    ));
  switch (shape) {
    // ── 실제 건물을 알아볼 수 있게 만든 프로파일 (2026-08-06) ──
    case 'parc1': {
      // 여의도 파크원 — 높이가 다른 판상형 타워 3개(69·53·10층)가 한 덩어리로 서 있다.
      const w1 = W * 0.34, w2 = W * 0.30, w3 = W * 0.30;
      const g = W * 0.03;
      const x1 = cx - W / 2, x2 = x1 + w1 + g, x3 = x2 + w2 + g;
      const h2 = h * 0.76, h3 = h * 0.30;
      return (
        <g>
          <rect x={x1} y={baseY - h} width={w1} height={h} fill={fill} />
          <rect x={x2} y={baseY - h2} width={w2} height={h2} fill={fill} />
          <rect x={x3} y={baseY - h3} width={w3} height={h3} fill={fill} />
          {/* 파크원 특유의 수직 프레임 — 지붕 위로 솟은 붉은 기둥이 이 건물의 표식 */}
          {[[x1, w1, h], [x2, w2, h2], [x3, w3, h3]].map(([x, w, hh], k) => (
            <g key={k}>
              {[0.08, 0.5, 0.92].map((f, m) => (
                <rect key={m} x={x + w * f - w * 0.045} y={baseY - hh - hh * 0.06}
                      width={w * 0.09} height={hh * 0.06 + hh} fill={fill} />
              ))}
              <line x1={x + w * 0.5} y1={baseY - hh} x2={x + w * 0.5} y2={baseY} stroke="#FFF" strokeWidth={LW.THIN} opacity={0.3} />
              {win(x, baseY - hh, w, hh)}
            </g>
          ))}
        </g>
      );
    }
    case 'lotte': {
      // 롯데월드타워 — 밑이 넓지 않고 위로 갈수록 **오목하게** 좁아지는 555m 세장 타워.
      // 꼭대기는 한쪽이 잘려 비스듬한 왕관(라제트) 모양 + 첨탑.
      const wb = W * 0.46, wt = W * 0.13;
      const xb0 = cx - wb / 2, xb1 = cx + wb / 2;
      const xt0 = cx - wt / 2, xt1 = cx + wt / 2;
      return (
        <g>
          {/* 오목 곡선: 제어점을 안쪽으로 당겨 실루엣이 활처럼 휘게 */}
          <path d={`M ${xb0} ${baseY}
                    C ${cx - wb * 0.34} ${baseY - h * 0.42} ${xt0 - wt * 0.55} ${baseY - h * 0.78} ${xt0} ${top}
                    L ${xt1} ${top}
                    C ${xt1 + wt * 0.55} ${baseY - h * 0.78} ${cx + wb * 0.34} ${baseY - h * 0.42} ${xb1} ${baseY} Z`}
                fill={fill} />
          {/* 비스듬히 잘린 왕관 */}
          <polygon points={`${xt0},${top} ${xt1},${top} ${xt1},${top - h * 0.07} ${xt0},${top - h * 0.03}`} fill={fill} />
          <line x1={cx + wt * 0.28} y1={top - h * 0.06} x2={cx + wt * 0.28} y2={top - h * 0.15}
                stroke={fill} strokeWidth={LW.BODY} />
          <line x1={cx} y1={top} x2={cx} y2={baseY} stroke="#FFF" strokeWidth={LW.THIN} opacity={0.26} />
          {win(cx - wt * 0.9, top + h * 0.06, wt * 1.8, h * 0.88)}
        </g>
      );
    }
    case 'cluster': {
      // 더 파크사이드 서울 — 70m 로 높이가 묶인 중층 동이 여러 채 늘어선다.
      // "한 채가 아니라 여러 채"가 실루엣만으로 읽히는 게 핵심.
      const ns = 6;
      const gap = W * 0.028;
      const w = (W * 1.18 - gap * (ns - 1)) / ns;
      const span = w * ns + gap * (ns - 1);
      const ratio = [0.88, 1.0, 0.83, 0.96, 0.9, 0.78];
      return (
        <g>
          {/* 공유 저층부(포디엄) — 여러 동이 한 덩어리로 서 있다는 게 실루엣으로 읽힌다 */}
          <rect x={cx - span / 2 - w * 0.16} y={baseY - h * 0.2}
                width={span + w * 0.32} height={h * 0.2} fill={fill} />
          {Array.from({length: ns}, (_, k) => {
            const x = cx - span / 2 + k * (w + gap);
            const hh = h * ratio[k];
            return (
              <g key={k}>
                <rect x={x} y={baseY - hh} width={w} height={hh} fill={fill} />
                <rect x={x - 2} y={baseY - hh - 8} width={w + 4} height={8} fill={fill} />
                {win(x, baseY - hh, w, hh)}
              </g>
            );
          })}
        </g>
      );
    }
    case 'plan': {
      // 평면도 — 건물 실루엣 대신 위에서 본 한 세대. 면적 비교에 쓴다.
      // 가로/세로를 같이 키워야 "넓이"가 눈에 맞는다 (value 는 변 길이 = √면적비).
      const hh = h, w = hh * 1.34;
      const x = cx - w / 2, y = baseY - hh;
      const rooms = [[0.0, 0.0, 0.58, 0.62], [0.58, 0.0, 0.42, 0.34],
                     [0.58, 0.34, 0.42, 0.28], [0.0, 0.62, 1.0, 0.38]];
      return (
        <g>
          <rect x={x} y={y} width={w} height={hh} fill={fill} />
          <rect x={x} y={y} width={w} height={hh} fill="none" stroke={T.ink} strokeWidth={LW.BODY} />
          {rooms.map(([rx, ry, rw, rh], k) => (
            <rect key={k} x={x + rx * w} y={y + ry * hh} width={rw * w} height={rh * hh}
                  fill="none" stroke={T.ink} strokeWidth={LW.HAIR} opacity={0.55} />
          ))}
          {/* 현관 표시 */}
          <line x1={x + w * 0.10} y1={y + hh} x2={x + w * 0.26} y2={y + hh}
                stroke="#FFF" strokeWidth={LW.BOLD} />
        </g>
      );
    }
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
          <line x1={cx - rw / 2 + 8} y1={baseY - rh * 0.32} x2={cx + rw / 2 - 8} y2={baseY - rh * 0.32} stroke="#FFF" strokeWidth={LW.HAIR} opacity={0.25} />
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
          <line x1={cx} y1={top - h * 0.09} x2={cx} y2={top - h * 0.2} stroke={fill} strokeWidth={LW.BODY} />
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
          <line x1={cx} y1={top} x2={cx} y2={top - h * 0.16} stroke={fill} strokeWidth={LW.BODY} />
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
          <line x1={cx} y1={top} x2={cx} y2={top - h * 0.18} stroke={fill} strokeWidth={LW.BODY} />
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
  note = '',      // 하단 단서 조항 (예: 금액 기준이 달라 단순 비교 주의)
  maxH = 420,
  dark = false,   // 어두운 종이 톤 (연속되는 종이 카드 사이에 변주),
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme, dark);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 바닥선 아래에 라벨 두 줄이 들어가야 하므로 CONTENT_BOTTOM 에서 넉넉히 띄운다
  const baseY = CONTENT_BOTTOM - 80;
  const n = buildings.length;
  const slot = Math.min(520, 1520 / Math.max(1, n));   // 라벨 폭에 맞춰 간격 확보
  const startX = (1920 - slot * n) / 2 + slot / 2;
  // 첨탑형(slender/setback/taper)은 실루엣 위로 20% 더 솟는다 → 그만큼 최대 높이를 깎아
  // 꼭대기 수치(note)가 타이틀 블록과 겹치지 않게 한다.
  const headroom = (title ? (sub ? 285 : 224) : 130) + (note ? 80 : 36);
  const spire = buildings.some((b) => ['slender', 'setback', 'taper', 'lotte'].includes(b.shape)) ? 0.2 : 0;
  const MH = Math.min(maxH, (baseY - headroom - 54) / (1 + spire));

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg dark={dark} theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} dark={dark} theme={theme} align={align} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {buildings.map((b, i) => {
          const grow = spring({frame: frame - 8 - i * 6, fps, config: {damping: 200}, durationInFrames: 36});
          const hot = Boolean(b.hot);
          const fill = hot ? YELLOW : T.tones[(b.tone ?? i) % T.tones.length];
          return (
            <g key={i}>
              {/* 접지 그림자 — 실루엣이 지면에 서 있다는 기준감 */}
              <ellipse cx={startX + i * slot} cy={baseY + 2} rx={Math.min(190, slot * 0.62) * (b.shape === 'sphere' ? 0.72 : 0.55)} ry={7}
                       fill={T.ink} opacity={0.13 * grow} />
              <Silhouette T={T} cx={startX + i * slot} baseY={baseY} W={Math.min(190, slot * 0.62)}
                          H={Math.max(50, MH * (b.value ?? 0.5))} shape={b.shape || 'slab'} fill={fill} grow={grow} />
              {hot ? (
                <Silhouette T={T} cx={startX + i * slot} baseY={baseY} W={Math.min(190, slot * 0.62)}
                            H={Math.max(50, MH * (b.value ?? 0.5))} shape={b.shape || 'slab'} fill="none" grow={grow} />
              ) : null}
            </g>
          );
        })}
        <line x1={startX - slot / 2 - 20} y1={baseY} x2={startX + slot * (n - 1) + slot / 2 + 20} y2={baseY} stroke={T.ink} strokeWidth={LW.THIN} />
      </svg>
      {buildings.map((b, i) => {
        const cx = startX + i * slot;
        const hot = Boolean(b.hot);
        const o = fadeIn(frame, 24 + i * 6);
        const bH = Math.max(50, MH * (b.value ?? 0.5));
        const bW = Math.min(190, slot * 0.62);
        let topY = baseY - bH;
        if (b.shape === 'sphere') {
          const r = Math.min(bW * 0.78, bH / 1.72);
          topY = baseY - r * 0.86 - r; // 구 꼭대기
        } else if (b.shape === 'setback' || b.shape === 'taper') topY -= bH * 0.18;
        else if (b.shape === 'slender') topY -= bH * 0.2;
        else if (b.shape === 'lotte') topY -= bH * 0.11;
        else if (b.shape === 'parc1') topY -= bH * 0.06;
        else if (b.shape === 'plan') topY = baseY - bH;
        return (
          <React.Fragment key={i}>
            {b.note ? (
              <div style={{position: 'absolute', left: cx - (slot + 80) / 2, width: slot + 80, top: topY - 74, textAlign: 'center', opacity: o,
                           fontFamily: 'A2Z Medium, sans-serif', fontSize: 46, color: T.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
                {b.note}
              </div>
            ) : null}
            <div style={{position: 'absolute', left: cx - (slot - 24) / 2, width: slot - 24, top: baseY + 18, textAlign: 'center', opacity: o}}>
              <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 32, lineHeight: 1.35, color: hot ? T.ink : T.soft, letterSpacing: '0.02em', whiteSpace: 'pre-line', wordBreak: 'keep-all'}}>
                {b.label}
              </div>
            </div>
          </React.Fragment>
        );
      })}
      {/* 단서 조항 — 하단은 자막 자리라 **타이틀 바로 아래**에 둔다 */}
      {note ? (
        <div style={{position: 'absolute', left: 260, width: 1400, top: title ? (sub ? 302 : 232) : 120,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 24,
                     letterSpacing: '0.03em', color: T.soft, opacity: fadeIn(frame, 64),
                     wordBreak: 'keep-all'}}>
          {note}
        </div>
      ) : null}
      <PaperSource source={source} dark={dark} theme={theme} />
    </AbsoluteFill>
  );
};
