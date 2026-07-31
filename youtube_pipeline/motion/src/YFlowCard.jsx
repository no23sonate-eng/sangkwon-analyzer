import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, GRAY, LINE, glow, fadeIn, Kicker, Footer, PerspectiveFloor} from './v2shared';

// v2 흐름 도식 카드 — 사업 구조·돈의 흐름·계산 과정을 노드+화살표로.
// nodes: [{tag, label, value, sub, hot}] / arrows: [{label}] (노드 사이 n-1개)
// 마지막(hot) 노드만 옐로 — 시선이 결과로 흐르게(§11-3 화살표 문법).
export const YFlowCard = ({
  kicker = '',
  sub = '',
  nodes = [],
  arrows = [],
  caption = '',
  source = '',
  floor = true,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = fadeIn(frame, 0, 14);

  const n = nodes.length || 1;
  const nodeW = n >= 4 ? 340 : 400;
  const nodeH = 250;
  const arrowW = n >= 4 ? 110 : 150;
  const totalW = nodeW * n + arrowW * (n - 1);
  const startX = (1920 - totalW) / 2;
  const nodeY = 400;

  const nodePop = (i) =>
    spring({frame: frame - 12 - i * 12, fps, config: {damping: 200}, durationInFrames: 24});
  const arrowGrow = (i) =>
    spring({frame: frame - 12 - i * 12 - 7, fps, config: {damping: 200}, durationInFrames: 16});

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      {floor ? <PerspectiveFloor opacity={enter} /> : null}
      <Kicker title={kicker} sub={sub} opacity={enter} />

      {nodes.map((node, i) => {
        const x = startX + i * (nodeW + arrowW);
        const pop = nodePop(i);
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute', top: nodeY, left: x, width: nodeW, height: nodeH,
                border: `1.5px solid ${node.hot ? YELLOW : LINE}`,
                borderRadius: 6,
                background: node.hot ? 'rgba(250,255,46,0.06)' : 'rgba(255,255,255,0.02)',
                boxShadow: node.hot ? '0 0 26px rgba(250,255,46,0.28)' : 'none',
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
                    padding: '3px 12px 1px', background: BLACK,
                    border: `1.5px solid ${node.hot ? YELLOW : LINE}`,
                    fontFamily: 'A2Z Medium, sans-serif', fontSize: 22,
                    letterSpacing: '0.16em', color: node.hot ? YELLOW : '#6A6A6A',
                  }}
                >
                  {node.tag}
                </div>
              ) : null}
              <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 31, letterSpacing: '0.06em', color: node.hot ? WHITE : GRAY}}>
                {node.label}
              </div>
              <div
                style={{
                  fontFamily: 'A2Z Medium, sans-serif',
                  fontSize: node.hot ? 74 : 58,
                  letterSpacing: '0.01em',
                  color: node.hot ? YELLOW : WHITE,
                  textShadow: node.hot ? glow(0.7) : 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {node.value}
              </div>
              {node.sub ? (
                <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 25, letterSpacing: '0.04em', color: MUTE}}>
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
              />
            ) : null}
          </React.Fragment>
        );
      })}

      <Footer caption={caption} source={source} opacity={fadeIn(frame, 12 + n * 12 + 16)} />
    </AbsoluteFill>
  );
};

const ArrowBetween = ({x, y, w, grow, label}) => {
  const pad = 16;
  const lineW = Math.max(0, (w - pad * 2) * grow);
  return (
    <>
      <svg
        width={w}
        height={60}
        style={{position: 'absolute', top: y - 30, left: x}}
      >
        <line x1={pad} y1={30} x2={pad + lineW} y2={30} stroke="#5A5A5A" strokeWidth={2} />
        {grow > 0.85 ? (
          <path
            d={`M ${pad + lineW - 12} 22 L ${pad + lineW} 30 L ${pad + lineW - 12} 38`}
            fill="none" stroke="#5A5A5A" strokeWidth={2}
          />
        ) : null}
      </svg>
      {label ? (
        <div
          style={{
            position: 'absolute', top: y - 72, left: x, width: w,
            textAlign: 'center', fontFamily: 'A2Z Light, sans-serif',
            fontSize: 23, letterSpacing: '0.06em', color: MUTE,
            opacity: grow,
          }}
        >
          {label}
        </div>
      ) : null}
    </>
  );
};
