import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {YELLOW, glow} from './v2shared';
import {themeOf, PaperBg, PaperTitle, PaperSource, CONTENT_BOTTOM, fadeIn, SP, LW} from './paper';

// 흐름 도식 카드 — 사업 구조·돈의 흐름·계산 과정을 노드+화살표로.
//
// **채널 테마로 옮겨 왔다.** 원래 v2 시절 카드라 배경이 순검정이고 강조색도
// 따로 놀았다. 같은 영상 안에서 이 두 컷만 다른 영상에서 온 것처럼 보였고,
// 출처 줄(우측 상단)도 없었다. 이제 다른 카드와 같은 테마·같은 자리를 쓴다.
// nodes: [{tag, label, value, sub, hot}] / arrows: [{label}] (노드 사이 n-1개)
// 마지막(hot) 노드만 옐로 — 시선이 결과로 흐르게(§11-3 화살표 문법).
// 한 점에서 갈라져 나가는 화살표. 시작점을 공유하고, 중간에서 한 번
// 부드럽게 꺾여 목표 높이로 간다 (건축 도면의 분기선 문법).
const Fork = ({x0, y0, x1, y1, grow, label, T}) => {
  const mx = x0 + (x1 - x0) * 0.55;
  const d = `M ${x0} ${y0} C ${mx} ${y0} ${mx} ${y1} ${x1 - 16} ${y1}`;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0,
                                            pointerEvents: 'none'}}>
      <path d={d} fill="none" stroke={T.ink} strokeWidth={LW.THIN}
            strokeLinecap="round" opacity={0.85}
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - grow} />
      {grow > 0.94 ? (
        <path d={`M ${x1 - 22} ${y1 - 9} L ${x1 - 4} ${y1} L ${x1 - 22} ${y1 + 9}`}
              fill="none" stroke={T.ink} strokeWidth={LW.THIN}
              strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {label ? (
        <text x={mx} y={(y0 + y1) / 2 - 12} textAnchor="middle"
              fontFamily="A2Z Light, sans-serif" fontSize={28} fill={T.soft}
              opacity={grow}>{label}</text>
      ) : null}
    </svg>
  );
};

export const YFlowCard = ({
  kicker = '',
  sub = '',
  nodes = [],
  arrows = [],
  caption = '',
  source = '',
  theme, bg = {},
  title = '',
  // branch=true 면 **첫 노드만 왼쪽**에 두고 나머지를 오른쪽에 위아래로 쌓는다.
  // '객실 수가 ADR 과 OCC 를 함께 정한다' 는 사슬이 아니라 **갈라짐**이다.
  // 한 줄로 늘어놓으면 ADR 다음에 OCC 가 온다는 순서가 생겨 버린다
  branch = false,
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
        // 갈라짐 배치 — 0번은 왼쪽 가운데, 나머지는 오른쪽에 위아래로
        const bN = Math.max(1, n - 1);
        const bH = Math.min(nodeH, (CONTENT_BOTTOM - bandTop - 40) / bN - 24);
        // 덩어리 폭 = 왼쪽 노드 + 화살표 + 오른쪽 노드. 그걸 화면 가운데에 놓는다.
        // 화살표 가운데를 1920/2 로 잡았더니 무게가 오른쪽으로 쏠렸다
        const bTotalW = nodeW * 2 + arrowW;
        const bLeft = (1920 - bTotalW) / 2;
        const bx = branch ? (i === 0 ? bLeft : bLeft + nodeW + arrowW) : null;
        const by = branch
          ? (i === 0
              ? nodeY
              : Math.round(bandTop + (CONTENT_BOTTOM - bandTop - (bH + 24) * bN + 24) / 2
                           + (i - 1) * (bH + 24)))
          : null;
        const x = branch ? bx : startX + i * (nodeW + arrowW);
        const pop = nodePop(i);
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute', top: branch ? by : nodeY, left: x,
                width: nodeW, height: branch && i > 0 ? bH : nodeH,
                border: `2.5px solid ${node.hot ? YELLOW : T.ink}`,
                borderRadius: 6,
                background: node.hot ? 'rgba(250,255,46,0.12)' : T.mute,
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
              <div style={{fontFamily: node.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                           fontSize: 36, letterSpacing: '0.02em', color: T.ink,
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
                <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 24,
                             letterSpacing: '0.02em', color: T.soft,
                             wordBreak: 'keep-all', textAlign: 'center', padding: '0 14px'}}>
                  {node.sub}
                </div>
              ) : null}
            </div>

            {/* 노드 사이 화살표 + 라벨.
                갈라짐일 때는 0번에서 **각 가지로** 하나씩 뻗는다 */}
            {branch
              ? (i > 0 ? (
                  // 한 점에서 갈라진다. 예전엔 가지마다 제 높이에서 곧게
                  // 뻗어서 **평행선 두 개**로 보였다 — 그건 갈라짐이 아니다
                  <Fork
                    x0={bLeft + nodeW}
                    y0={nodeY + nodeH / 2}
                    x1={bLeft + nodeW + arrowW}
                    y1={by + bH / 2}
                    grow={arrowGrow(i - 1)}
                    label={arrows[i - 1]?.label || ''}
                    T={T}
                  />
                ) : null)
              : (i < n - 1 ? (
                  <ArrowBetween
                    x={x + nodeW}
                    y={nodeY + nodeH / 2}
                    w={arrowW}
                    grow={arrowGrow(i)}
                    label={arrows[i]?.label || ''}
                    T={T}
                  />
                ) : null)}
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
        <line x1={pad} y1={30} x2={pad + lineW} y2={30} stroke={T.ink} strokeWidth={LW.THIN} opacity={0.6} />
        {grow > 0.85 ? (
          <path
            d={`M ${pad + lineW - 12} 22 L ${pad + lineW} 30 L ${pad + lineW - 12} 38`}
            fill="none" stroke={T.ink} strokeWidth={LW.THIN} opacity={0.6}
          />
        ) : null}
      </svg>
      {label ? (
        <div
          style={{
            position: 'absolute', top: y - 72, left: x, width: w,
            textAlign: 'center', fontFamily: 'A2Z Light, sans-serif',
            fontSize: 24, letterSpacing: '0.04em', color: T.soft,
            opacity: grow,
          }}
        >
          {label}
        </div>
      ) : null}
    </>
  );
};
