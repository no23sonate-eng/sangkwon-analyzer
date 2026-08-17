import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {YELLOW, glow} from './v2shared';
import {themeOf, PaperBg, PaperTitle, PaperSource, CONTENT_BOTTOM, fadeIn, SP} from './paper';

// 흐름 도식 카드 — 사업 구조·돈의 흐름·계산 과정을 노드+화살표로.
//
// **채널 테마로 옮겨 왔다.** 원래 v2 시절 카드라 배경이 순검정이고 강조색도
// 따로 놀았다. 같은 영상 안에서 이 두 컷만 다른 영상에서 온 것처럼 보였고,
// 출처 줄(우측 상단)도 없었다. 이제 다른 카드와 같은 테마·같은 자리를 쓴다.
// nodes: [{tag, label, value, sub, hot}] / arrows: [{label}] (노드 사이 n-1개)
// 마지막(hot) 노드만 옐로 — 시선이 결과로 흐르게(§11-3 화살표 문법).
export const YFlowCard = ({
  kicker = '',
  sub = '',
  nodes = [],
  arrows = [],
  caption = '',
  source = '',
  theme, bg = {},
  title = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = themeOf(theme);

  const n = nodes.length || 1;
  const nodeW = n >= 4 ? 340 : n === 3 ? 380 : 400;
  const nodeH = 250;
  const arrowW = n >= 4 ? 110 : n === 3 ? 190 : 300;
  const totalW = nodeW * n + arrowW * (n - 1);
  const startX = (1920 - totalW) / 2;
  // 띠 한가운데. 400 으로 박아 두면 제목이 없을 때도 같은 자리라 아래가 빈다
  const bandTop = (title || kicker) ? (sub ? 300 : 250) : 190;
  const nodeY = Math.round(bandTop + Math.max(0, (CONTENT_BOTTOM - bandTop - nodeH) / 2));

  const nodePop = (i) =>
    spring({frame: frame - 12 - i * 12, fps, config: {damping: 200}, durationInFrames: 24});
  const arrowGrow = (i) =>
    spring({frame: frame - 12 - i * 12 - 7, fps, config: {damping: 200}, durationInFrames: 16});

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title || kicker} sub={sub} theme={theme} />

      {nodes.map((node, i) => {
        const x = startX + i * (nodeW + arrowW);
        const pop = nodePop(i);
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute', top: nodeY, left: x, width: nodeW, height: nodeH,
                border: `2.5px solid ${node.hot ? YELLOW : T.ink}`,
                borderRadius: 6,
                background: node.hot ? 'rgba(250,255,46,0.12)' : T.mute,
                opacity: 1,
                opacity: pop,
                transform: `scale(${0.92 + 0.08 * pop})`,
                display: 'flex', flexDirection: 'column',
                justifyContent: 'center', alignItems: 'center', gap: 10,
              }}
            >
              {node.tag ? (
                <div
                  style={{
                    position: 'absolute', top: -17, left: 24,
                    padding: '3px 12px 1px', background: T.bg,
                    border: `2.5px solid ${node.hot ? YELLOW : T.ink}`,
                    fontFamily: 'A2Z Medium, sans-serif', fontSize: 24,
                    letterSpacing: '0.16em', color: node.hot ? YELLOW : T.soft,
                  }}
                >
                  {node.tag}
                </div>
              ) : null}
              <div style={{fontFamily: node.hot ? 'Pretendard Bold, A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                           fontSize: 38, letterSpacing: '0.02em', color: T.ink,
                           wordBreak: 'keep-all', textAlign: 'center', padding: '0 14px'}}>
                {node.label}
              </div>
              <div
                style={{
                  fontFamily: 'A2Z Medium, sans-serif',
                  fontSize: node.hot ? 74 : 58,
                  letterSpacing: '0.01em',
                  color: T.ink,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {node.value}
              </div>
              {node.sub ? (
                <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 27,
                             letterSpacing: '0.02em', color: T.soft,
                             wordBreak: 'keep-all', textAlign: 'center', padding: '0 14px'}}>
                  {node.sub}
                </div>
              ) : null}
            </div>

            {/* 노드 사이 화살표 + 라벨 */}
            {i < n - 1 ? (
              <ArrowBetween
                x={x + nodeW}
                y={nodeY + nodeH / 2}
                w={arrowW}
                grow={arrowGrow(i)}
                label={arrows[i]?.label || ''}
                T={T}
              />
            ) : null}
          </React.Fragment>
        );
      })}

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 30,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 32,
                     color: T.soft, opacity: fadeIn(frame, 12 + n * 12 + 16),
                     wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};

const ArrowBetween = ({x, y, w, grow, label, T}) => {
  const pad = 16;
  const lineW = Math.max(0, (w - pad * 2) * grow);
  return (
    <>
      <svg
        width={w}
        height={60}
        style={{position: 'absolute', top: y - 30, left: x}}
      >
        <line x1={pad} y1={30} x2={pad + lineW} y2={30} stroke={T.ink} strokeWidth={2.5} opacity={0.6} />
        {grow > 0.85 ? (
          <path
            d={`M ${pad + lineW - 12} 22 L ${pad + lineW} 30 L ${pad + lineW - 12} 38`}
            fill="none" stroke={T.ink} strokeWidth={2.5} opacity={0.6}
          />
        ) : null}
      </svg>
      {label ? (
        <div
          style={{
            position: 'absolute', top: y - 72, left: x, width: w,
            textAlign: 'center', fontFamily: 'A2Z Light, sans-serif',
            fontSize: 25, letterSpacing: '0.04em', color: T.soft,
            opacity: grow,
          }}
        >
          {label}
        </div>
      ) : null}
    </>
  );
};
