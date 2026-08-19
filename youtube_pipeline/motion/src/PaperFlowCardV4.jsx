import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {
  PaperSurface, PaperHead, Credit,
  PAPER, INK, INK2, INK3, HAIR, AMBER, P, M, SAFE_BOTTOM, fade,
} from './v4';
import {DrawPath, EASE, stagger, useRevealUp} from './anim';

// v4 · 지면 흐름도 — 원인→결과, 소유권 이전, 계산 과정.
// 박스는 얇은 검정 선. 결과 노드만 앰버 규칙선으로 표시(색을 칠하지 않는다).
export const PaperFlowCardV4 = ({
  eyebrow = '',
  title = '',
  nodes = [],
  arrows = [],
  note = '',
  credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = nodes.length || 1;
  const nodeW = n >= 3 ? 400 : 440;
  const nodeH = 236;
  const gap = n >= 3 ? 130 : 220;
  const totalW = nodeW * n + gap * (n - 1);
  const startX = (1920 - totalW) / 2;
  const nodeY = 400;

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} plot />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {nodes.map((node, i) => {
          const x = startX + i * (nodeW + gap);
          const t = interpolate(frame, [stagger(i, 10, 8), stagger(i, 10, 8) + 26], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
          });
          const hot = Boolean(node.hot);
          return (
            <g key={i}>
              <rect x={x} y={nodeY} width={nodeW} height={nodeH}
                fill={hot ? 'rgba(217,154,31,0.08)' : 'rgba(255,255,255,0.55)'}
                stroke={hot ? INK : '#B4BAC2'} strokeWidth={hot ? 2 : 1.2} opacity={t} />
              {hot ? (
                <DrawPath d={`M ${x} ${nodeY + nodeH} L ${x + nodeW} ${nodeY + nodeH}`}
                  start={stagger(i, 10, 16)} dur={22} length={nodeW}
                  stroke={AMBER} strokeWidth={5} />
              ) : null}
            </g>
          );
        })}

        {/* 연결선 — 그려지듯, 얇게 */}
        {nodes.slice(0, -1).map((_, i) => {
          const x = startX + i * (nodeW + gap) + nodeW;
          const y = nodeY + nodeH / 2;
          return (
            <g key={i}>
              <DrawPath d={`M ${x + 22} ${y} L ${x + gap - 30} ${y}`}
                start={stagger(i, 10, 20)} dur={18} length={gap} stroke={INK2} strokeWidth={1.6} />
              <path d={`M ${x + gap - 42} ${y - 8} L ${x + gap - 28} ${y} L ${x + gap - 42} ${y + 8}`}
                fill="none" stroke={INK2} strokeWidth={1.6}
                opacity={fade(frame, stagger(i, 10, 32))} />
            </g>
          );
        })}
      </svg>

      {/* 노드 텍스트 */}
      {nodes.map((node, i) => {
        const x = startX + i * (nodeW + gap);
        // 박스와 글자를 같은 프레임에 시작한다. 예전엔 글자가 4프레임 늦어
        // "빈 박스가 먼저 뜨는" 구간이 생겼다 (모션 검수에서 확인).
        const inn = useRevealUp(stagger(i, 10, 8), 22, 16);
        const hot = Boolean(node.hot);
        return (
          <div key={i} style={{position: 'absolute', left: x, top: nodeY, width: nodeW, height: nodeH,
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12, ...inn}}>
            {node.tag ? (
              <div style={{
                position: 'absolute', top: -14, left: 22, background: PAPER, padding: '0 10px',
                fontFamily: 'A2Z Medium, sans-serif', fontSize: 26, letterSpacing: '0.18em', color: hot ? INK : INK3,
              }}>{node.tag}</div>
            ) : null}
            <div style={{...P.label, fontSize: 30}}>{node.label}</div>
            <div style={{...P.valueM, fontSize: hot ? 68 : 56}}>{node.value}</div>
            {node.sub ? <div style={{...P.caption, fontSize: 27}}>{node.sub}</div> : null}
          </div>
        );
      })}

      {/* 화살표 라벨 */}
      {arrows.map((a, i) =>
        a?.label ? (
          <div key={i} style={{
            position: 'absolute', left: startX + i * (nodeW + gap) + nodeW, width: gap,
            top: nodeY + nodeH / 2 - 54, textAlign: 'center',
            opacity: fade(frame, stagger(i, 10, 26)),
          }}>
            <span style={{...P.caption, fontSize: 27}}>{a.label}</span>
          </div>
        ) : null
      )}

      {note ? (
        <div style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', top: SAFE_BOTTOM - 56, opacity: fade(frame, stagger(n, 10, 24))}}>
          <span style={P.caption}>{note}</span>
        </div>
      ) : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 50)} />