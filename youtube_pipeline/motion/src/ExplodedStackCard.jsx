import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, THEMES, PaperBg, PaperTitle, PaperSource, YELLOW, fadeIn} from './paper';

// 분해 적층 카드 — 건물 하나를 용도 구간별로 아이소메트릭 판으로 쪼개 위로 띄운다.
// SectionCard(정면 단면)와 같은 "한 건물"을 다루지만 시점·구성이 달라 화면이 반복되지 않는다.
// "이게 옆에 있는 게 아니라 위아래로 쌓여 있다"를 말할 때 쓴다.
// layers: [{label, sub, hot}] — 위에서 아래 순서 (지상 상층 → 지하)
const Slab = ({cx, cy, w, d, h, fill, o, T = THEMES.paper}) => {
  const top = `${cx - w / 2},${cy} ${cx},${cy - d / 2} ${cx + w / 2},${cy} ${cx},${cy + d / 2}`;
  return (
    <g opacity={o}>
      {/* 좌측면 */}
      <polygon points={`${cx - w / 2},${cy} ${cx},${cy + d / 2} ${cx},${cy + d / 2 + h} ${cx - w / 2},${cy + h}`}
               fill={fill} />
      <polygon points={`${cx - w / 2},${cy} ${cx},${cy + d / 2} ${cx},${cy + d / 2 + h} ${cx - w / 2},${cy + h}`}
               fill="#000" opacity={0.12} />
      {/* 우측면 */}
      <polygon points={`${cx + w / 2},${cy} ${cx},${cy + d / 2} ${cx},${cy + d / 2 + h} ${cx + w / 2},${cy + h}`}
               fill={fill} />
      <polygon points={`${cx + w / 2},${cy} ${cx},${cy + d / 2} ${cx},${cy + d / 2 + h} ${cx + w / 2},${cy + h}`}
               fill="#000" opacity={0.22} />
      {/* 윗면 */}
      <polygon points={top} fill={fill} />
      <polygon points={top} fill="#FFF" opacity={0.18} />
      {/* 외곽선 */}
      <polygon points={top} fill="none" stroke={T.ink} strokeWidth={2.5} />
      <polyline points={`${cx - w / 2},${cy} ${cx - w / 2},${cy + h} ${cx},${cy + d / 2 + h} ${cx + w / 2},${cy + h} ${cx + w / 2},${cy}`}
                fill="none" stroke={T.ink} strokeWidth={2.5} />
      <line x1={cx} y1={cy + d / 2} x2={cx} y2={cy + d / 2 + h} stroke={T.ink} strokeWidth={2} opacity={0.5} />
    </g>
  );
};

export const ExplodedStackCard = ({
  title = '', sub = '', layers = [], source = '',
  groundAfter = -1,   // 이 인덱스 다음부터 지하 (지반선을 그린다). -1이면 안 그림,
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = layers.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const CX = 700, W = 400, D = 120;   // D = 아이소메트릭 깊이(윗면 마름모의 세로 지름)
  const H = 36;                       // 판 두께
  const TOP = (title ? (sub ? 302 : 262) : 176);
  const BOTTOM = 796;
  // 판 하나가 세로로 차지하는 높이는 H 가 아니라 (D + H) 다. 이걸 빼먹으면
  // 판끼리 겹쳐서 셰브론처럼 보인다. 간격은 남는 공간을 n-1 로 나눠 자동 산정.
  const avail = BOTTOM - TOP;
  const GAP = Math.max(20, Math.min(64, (avail - D - H) / Math.max(1, n - 1) - H - D / 2));
  const PITCH = H + D / 2 + GAP;
  const cyOf = (i) => TOP + D / 2 + i * PITCH;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {layers.map((L, i) => {
          // 아래 판부터 자리를 잡고, 위 판일수록 늦게 떠오른다
          const rise = spring({frame: frame - 10 - (n - 1 - i) * 5, fps,
                               config: {damping: 200}, durationInFrames: 34});
          const cy = cyOf(i) + (1 - rise) * 40;
          return (
            <React.Fragment key={i}>
              {/* 판 사이 연결선 — 원래 한 덩어리였음을 보여준다 */}
              {i > 0 ? (
                <line x1={CX} y1={cy - GAP - D / 2 + 4} x2={CX} y2={cy - D / 2 - 4}
                      stroke={T.ink} strokeWidth={1.5} strokeDasharray="4 6" opacity={0.35 * rise} />
              ) : null}
              <Slab T={T} cx={CX} cy={cy} w={W} d={D} h={H}
                    fill={L.hot ? YELLOW : T.tones[(i + 1) % T.tones.length]} o={rise} />
            </React.Fragment>
          );
        })}
        {/* 지반선 */}
        {groundAfter >= 0 && groundAfter < n - 1 ? (
          <line x1={CX - W / 2 - 150} y1={cyOf(groundAfter) + D / 2 + H + GAP / 2}
                x2={CX + W / 2 + 620} y2={cyOf(groundAfter) + D / 2 + H + GAP / 2}
                stroke={T.ink} strokeWidth={3} opacity={0.7 * fadeIn(frame, 40)} />
        ) : null}
      </svg>

      {/* 라벨 — 판 오른쪽. 판 앞면 중앙 높이에 맞춘다 */}
      {layers.map((L, i) => {
        const cy = cyOf(i) + D / 4 + H / 2;   // 판 앞면 중앙
        return (
          <div key={i} style={{position: 'absolute', left: CX + W / 2 + 74, top: cy, width: 640,
                               transform: 'translateY(-50%)', opacity: fadeIn(frame, 22 + (n - 1 - i) * 5)}}>
            <div style={{fontFamily: L.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                         fontSize: 42, color: T.ink, lineHeight: 1.2, wordBreak: 'keep-all'}}>
              {L.hot ? <span style={{background: 'rgba(250,255,46,0.75)', padding: '2px 10px'}}>{L.label}</span> : L.label}
            </div>
            {L.sub ? (
              <div style={{marginTop: 6, fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft, wordBreak: 'keep-all'}}>
                {L.sub}
              </div>
            ) : null}
          </div>
        );
      })}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
