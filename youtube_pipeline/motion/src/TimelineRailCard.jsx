import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';

// 연도 레일 카드 — 가로 연도축 위에 기간 막대와 사건 마커.
// "좌→우로 아이콘 3개"류와 달리 **실제 시간 축**이 있어서, 기간의 길이 차이나
// 사건 간격이 눈에 보인다. 공정 일정·연혁·기간 비교에 쓴다.
//
// axis: {from, to, step}          — 연도 범위와 눈금 간격
// rails: [{label, from, to, note, hot, events:[{at, label, sub, hot}]}]
//   from/to 를 주면 기간 막대, events 만 주면 점만 찍힌다.
export const TimelineRailCard = ({
  title = '', sub = '',
  axis = {from: 2000, to: 2030, step: 5},
  tickLabels = null,   // 눈금 라벨을 직접 지정 (월 단위 일정표 등)
  rails = [],
  source = '',
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const n = rails.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  // 레일 이름이 있으면 왼쪽에 자리를 비우고, 이름이 없는 일정표는 화면 가운데로 편다.
  const hasLabel = rails.some((r) => r.label);
  const X0 = hasLabel ? 400 : 250, X1 = hasLabel ? 1780 : 1670;
  const LIFT = (j) => 82 + ((j + 1) % 2) * 108;  // 사건 라벨 높이를 번갈아 — 가까운 사건끼리 안 겹침
  const px = (y) => X0 + ((y - axis.from) / (axis.to - axis.from)) * (X1 - X0);
  // 축 라벨(top = AXIS_Y + 22, 34px)까지 자막 안전영역(CONTENT_BOTTOM) 위에 들어와야 한다
  const AXIS_Y = CONTENT_BOTTOM - 66;
  const ROW = n === 1 ? 0 : Math.min(190, (AXIS_Y - 400) / (n - 1));
  const railY = (i) => (n === 1 ? AXIS_Y - 140 : 400 + i * ROW);

  const ticks = [];
  for (let y = axis.from; y <= axis.to; y += axis.step) ticks.push(y);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 연도 눈금 — 세로 가이드가 먼저 깔린다 */}
        {ticks.map((y, i) => (
          <line key={`t${i}`} x1={px(y)} y1={366} x2={px(y)} y2={AXIS_Y}
                stroke={T.ink} strokeWidth={1} opacity={0.14 * fadeIn(frame, 4)} />
        ))}
        {/* 축 */}
        <line x1={X0 - 40} y1={AXIS_Y} x2={X1 + 40} y2={AXIS_Y}
              stroke={T.ink} strokeWidth={3} opacity={fadeIn(frame, 2)} />
        {ticks.map((y, i) => (
          <line key={`m${i}`} x1={px(y)} y1={AXIS_Y} x2={px(y)} y2={AXIS_Y + 12}
                stroke={T.ink} strokeWidth={2} opacity={fadeIn(frame, 2)} />
        ))}

        {rails.map((r, i) => {
          const y = railY(i);
          const grow = interpolate(frame, [16 + i * 12, 62 + i * 12], [0, 1],
                                   {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const fill = r.hot ? YELLOW : T.tones[(i + 1) % T.tones.length];
          const x0 = px(r.from ?? axis.from), x1 = px(r.to ?? axis.to);
          return (
            <g key={i}>
              {r.from != null ? (
                <>
                  <rect x={x0} y={y - 34} width={Math.max(4, (x1 - x0) * grow)} height={68} rx={4} fill={fill} />
                  <rect x={x0} y={y - 34} width={Math.max(4, (x1 - x0) * grow)} height={68} rx={4}
                        fill="none" stroke={T.ink} strokeWidth={2.5} />
                </>
              ) : (
                <line x1={x0} y1={y} x2={x0 + (x1 - x0) * grow} y2={y}
                      stroke={T.ink} strokeWidth={4} strokeLinecap="round" />
              )}
              {(r.events || []).map((e, j) => {
                const ex = px(e.at);
                if (ex > x0 + (x1 - x0) * grow + 2) return null;
                const o = fadeIn(frame, 40 + i * 12 + j * 8);
                return (
                  <g key={j} opacity={o}>
                    <line x1={ex} y1={y - 34} x2={ex} y2={y - LIFT(j) + 16} stroke={T.ink} strokeWidth={2} opacity={0.5} />
                    <circle cx={ex} cy={y} r={e.hot ? 17 : 12}
                            fill={e.hot ? YELLOW : '#FFF'} stroke={T.ink} strokeWidth={3.5} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* 연도 라벨 */}
      {ticks.map((y, i) => (
        <div key={i} style={{position: 'absolute', left: px(y) - 100, width: 200, top: AXIS_Y + 22,
                             textAlign: 'center', opacity: fadeIn(frame, 6),
                             fontFamily: 'A2Z Regular, sans-serif', fontSize: 34, color: T.soft}}>
          {tickLabels ? (tickLabels[i] ?? '') : y}
        </div>
      ))}

      {/* 레일 라벨(왼쪽) · 기간 노트(막대 오른쪽) · 사건 라벨(마커 위) */}
      {rails.map((r, i) => {
        const y = railY(i);
        const o = fadeIn(frame, 20 + i * 12);
        return (
          <React.Fragment key={i}>
            {r.label ? (
              <div style={{position: 'absolute', left: 30, width: X0 - 106, top: y, transform: 'translateY(-50%)',
                           textAlign: 'right', opacity: o,
                           fontFamily: r.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                           fontSize: 42, color: T.ink, lineHeight: 1.2, wordBreak: 'keep-all'}}>
                {r.label}
              </div>
            ) : null}
            {r.note ? (
              <div style={{position: 'absolute', left: px(r.to ?? axis.to) + 26, width: 400, top: y,
                           transform: 'translateY(-50%)', opacity: fadeIn(frame, 56 + i * 12),
                           fontFamily: 'A2Z Medium, sans-serif', fontSize: 46, color: T.ink,
                           whiteSpace: 'nowrap'}}>
                {r.note}
              </div>
            ) : null}
            {(r.events || []).map((e, j) => (
              <div key={j} style={{position: 'absolute', left: px(e.at) - 200, width: 400, top: y - LIFT(j),
                                   transform: 'translateY(-100%)', textAlign: 'center',
                                   opacity: fadeIn(frame, 44 + i * 12 + j * 8)}}>
                <div style={{fontFamily: e.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                             fontSize: 40, color: T.ink, lineHeight: 1.2, wordBreak: 'keep-all'}}>
                  {e.hot ? <span style={{background: 'rgba(250,255,46,0.75)', padding: '2px 10px'}}>{e.label}</span> : e.label}
                </div>
                {e.sub ? (
                  <div style={{marginTop: 6, fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft, wordBreak: 'keep-all'}}>
                    {e.sub}
                  </div>
                ) : null}
              </div>
            ))}
          </React.Fragment>
        );
      })}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
