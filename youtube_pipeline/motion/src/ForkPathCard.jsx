import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, OPTICAL_CENTER, fadeIn, SP, LW} from './paper';

// ── 갈림길 ────────────────────────────────────────────────────────────
// "이미 다른 브랜드들이 보여준 방식을 따라갈지 / 올리브영만의 공간 콘텐츠를
// 만들지" — 영상의 마지막 질문이다. 이걸 실사 두 컷으로 넘기면 그냥 두 장면이
// 지나갈 뿐, **둘 중 하나라는 구조**가 안 남는다.
//
// 그래서 줄기 하나가 둘로 갈라지는 그림으로 바꾼다. 중요한 건 **어느 쪽도
// 고르지 않는 것** — 결말을 정해주지 않는 컷이라 양쪽 다 열어 둔다.
// (decided 를 주면 그 가지만 옐로로 확정된다. 지금 컷에선 안 쓴다.)
//
// branches: [{label, note}]  — 위/아래 두 갈래
export const ForkPathCard = ({
  title = '', sub = '', trunkLabel = '',
  branches = [], decided = null,     // 0 | 1 | null(미정)
  question = '', source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const bs = branches.slice(0, 2);
  if (bs.length < 2) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const bandTop = title ? (sub ? 300 : 250) : 190;
  // 갈라지는 지점이 곧 이 그림의 가운데다. 띠 중간이 아니라 화면 가운데
  const midY = Math.max(bandTop + 120, OPTICAL_CENTER);
  const SPREAD = 190;                // 갈래 간 세로 벌어짐
  const X0 = 210, XF = 760, X1 = 1180;   // 줄기 시작 · 분기점 · 가지 끝

  const trunk = interpolate(frame, [10, 34], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const split = interpolate(frame, [32, 62], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const path = (dy) => {
    const yEnd = midY + dy;
    // 분기점에서 부드럽게 꺾인다 — 직각으로 꺾으면 도표가 아니라 배선도가 된다
    return `M ${XF} ${midY} C ${XF + 130} ${midY}, ${XF + 130} ${yEnd}, ${X1} ${yEnd}`;
  };

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 줄기 */}
        <line x1={X0} y1={midY} x2={X0 + (XF - X0) * trunk} y2={midY}
              stroke={T.ink} strokeWidth={LW.BOLD} strokeLinecap="round" />
        <circle cx={XF} cy={midY} r={11} fill={T.paper} stroke={T.ink} strokeWidth={LW.BOLD}
                opacity={trunk > 0.98 ? 1 : 0} />

        {/* 두 갈래 */}
        {bs.map((b, i) => {
          const dy = i === 0 ? -SPREAD : SPREAD;
          const on = decided == null || decided === i;
          return (
            <g key={i} opacity={on ? 1 : 0.32}>
              <path d={path(dy)} fill="none"
                    stroke={decided === i ? YELLOW : T.ink}
                    strokeWidth={decided === i ? 9 : 5} strokeLinecap="round"
                    strokeDasharray={620} strokeDashoffset={620 * (1 - split)} />
              {decided === i ? (
                <path d={path(dy)} fill="none" stroke={T.ink} strokeWidth={LW.THIN}
                      strokeDasharray={620} strokeDashoffset={620 * (1 - split)} />
              ) : null}
              {/* 가지 끝 화살촉 */}
              {split > 0.9 ? (
                <path d={`M ${X1 - 2} ${midY + dy - 13} L ${X1 + 24} ${midY + dy} L ${X1 - 2} ${midY + dy + 13} Z`}
                      fill={decided === i ? YELLOW : T.ink}
                      stroke={T.ink} strokeWidth={LW.THIN}
                      opacity={fadeIn(frame, 62)} />
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* 줄기 이름표 — 선 아래. 위에 두면 분기점 물음표와 같은 띠에 얹힌다 */}
      {trunkLabel ? (
        <div style={{position: 'absolute', left: X0, top: midY + SP.NEAR, width: XF - X0 - 60,
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 32, letterSpacing: '0.08em',
                     color: T.soft, opacity: fadeIn(frame, 14), wordBreak: 'keep-all'}}>
          {trunkLabel}
        </div>
      ) : null}

      {/* 가지 이름표 — 화살촉 오른쪽 */}
      {bs.map((b, i) => {
        const dy = i === 0 ? -SPREAD : SPREAD;
        const on = decided == null || decided === i;
        return (
          <div key={i} style={{position: 'absolute', left: X1 + SP.BLOCK, top: midY + dy - 58,
                               width: 1920 - (X1 + SP.BLOCK) - 120,
                               opacity: (on ? 1 : 0.4) * fadeIn(frame, 56 + i * 8)}}>
            <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 46,
                         lineHeight: 1.15, color: T.ink, wordBreak: 'keep-all'}}>
              {decided === i
                ? <span style={{background: YELLOW, color: '#1B1E24', padding: '2px 14px'}}>{b.label}</span>
                : b.label}
            </div>
            {b.note ? (
              <div style={{marginTop: SP.NEAR, fontFamily: 'A2Z Light, sans-serif', fontSize: 32,
                           lineHeight: 1.4, color: T.soft, wordBreak: 'keep-all'}}>
                {b.note}
              </div>
            ) : null}
          </div>
        );
      })}

      {/* 미정이면 분기점 위에 물음표 하나 — 답을 주지 않는다는 표시 */}
      {decided == null && question ? (
        <div style={{position: 'absolute', left: XF - 170, width: 340, top: midY - 104,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 32,
                     letterSpacing: '0.16em', color: T.soft, opacity: fadeIn(frame, 70)}}>
          {question}
        </div>
      ) : null}

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
