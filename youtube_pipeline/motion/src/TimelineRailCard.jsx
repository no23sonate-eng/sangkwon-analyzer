import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, stageTop, titleH, LW} from './paper';

// 연도 레일 카드 — 가로 연도축 위에 기간 막대와 사건 마커.
// "좌→우로 아이콘 3개"류와 달리 **실제 시간 축**이 있어서, 기간의 길이 차이나
// 사건 간격이 눈에 보인다. 공정 일정·연혁·기간 비교에 쓴다.
//
// axis: {from, to, step}          — 연도 범위와 눈금 간격
// rails: [{label, from, to, note, hot, events:[{at, label, sub, hot}]}]
//   from/to 를 주면 기간 막대, events 만 주면 점만 찍힌다.
// 재생 머리가 x 에 닿는 프레임. 점·이음선·이름이 **같은 시각**에 떠야
// 그 셋이 한 사건으로 읽힌다
const reachAt = (x, x0, x1, t0, t1) => {
  const f = x1 === x0 ? 0 : Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
  return t0 + f * (t1 - t0);
};

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
  const headH = titleH(title, sub);
  // 레일 시작을 400 에 못 박아 두니 레일이 하나뿐인 컷은 화면 아래에
  // 홀로 떠 있고 위가 텅 비었다. 레일 묶음을 한 덩어리로 앉힌다
  const RAIL_H = n === 1 ? 0 : Math.min(190, (AXIS_Y - 400) / (n - 1)) * (n - 1);
  // 레일 묶음을 화면 가운데에 앉히면 아래 연도축과 멀어져 **둘이 다른
  // 그림처럼** 보인다. 연도축에서 한 뼘 위에 붙인다 (#48)
  const RAIL_GAP = 150;
  const railTop = Math.max(headH + (title ? 64 : 0) + 190,
                           AXIS_Y - RAIL_GAP - RAIL_H);
  const ROW = n === 1 ? 0 : RAIL_H / (n - 1);
  const railY = (i) => railTop + i * ROW;

  const ticks = [];
  for (let y = axis.from; y <= axis.to; y += axis.step) ticks.push(y);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align}
                  top={stageTop(headH + (title ? 64 : 0) + RAIL_H + 120, {top: 150})} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 연도 눈금 — 세로 가이드가 먼저 깔린다 */}
        {ticks.map((y, i) => (
          <line key={`t${i}`} x1={px(y)} y1={366} x2={px(y)} y2={AXIS_Y}
                stroke={T.ink} strokeWidth={LW.HAIR} opacity={0.14 * fadeIn(frame, 4)} />
        ))}
        {/* 축 */}
        <line x1={X0 - 40} y1={AXIS_Y} x2={X1 + 40} y2={AXIS_Y}
              stroke={T.ink} strokeWidth={LW.BODY} opacity={fadeIn(frame, 2)} />
        {ticks.map((y, i) => (
          <line key={`m${i}`} x1={px(y)} y1={AXIS_Y} x2={px(y)} y2={AXIS_Y + 12}
                stroke={T.ink} strokeWidth={LW.THIN} opacity={fadeIn(frame, 2)} />
        ))}

        {rails.map((r, i) => {
          const y = railY(i);
          const SWEEP0 = 10 + i * 10, SWEEP1 = 74 + i * 10;
          const grow = interpolate(frame, [SWEEP0, SWEEP1], [0, 1],
                                   {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const fill = r.hot ? YELLOW : T.tones[(i + 1) % T.tones.length];
          const x0 = px(r.from ?? axis.from), x1 = px(r.to ?? axis.to);
          return (
            <g key={i}>
              {r.from != null ? (
                <>
                  <rect x={x0} y={y - 34} width={Math.max(4, (x1 - x0) * grow)} height={68} rx={4} fill={fill} />
                  <rect x={x0} y={y - 34} width={Math.max(4, (x1 - x0) * grow)} height={68} rx={4}
                        fill="none" stroke={T.ink} strokeWidth={LW.THIN} />
                </>
              ) : (
                <>
                  <line x1={x0} y1={y} x2={x0 + (x1 - x0) * grow} y2={y}
                        stroke={T.ink} strokeWidth={LW.BODY} strokeLinecap="round" />
                  {/* 쓸고 지나가는 앞머리 — 시간이 '지금 여기까지 왔다' 를
                      한 점으로 보여 준다. 선만 자라면 길이가 변할 뿐 흐르지 않는다 */}
                  {grow > 0.02 && grow < 0.995 ? (
                    <circle cx={x0 + (x1 - x0) * grow} cy={y} r={9}
                            fill={YELLOW} stroke={T.ink} strokeWidth={LW.THIN} />
                  ) : null}
                </>
              )}
              {(r.events || []).map((e, j) => {
                const ex = px(e.at);
                if (ex > x0 + (x1 - x0) * grow + 2) return null;
                // **점이 뜨는 시각은 재생 머리가 그 해에 닿는 시각이다.**
                // 예전엔 40+i*12+j*8 이라는 별도 일정으로 떴다 (아래 글자도
                // 마찬가지였는데, 글자 쪽에는 재생 머리 조건이 아예 없어서
                // 점도 이음선도 없이 라벨만 허공에 떠 있었다 — #48 '국영')
                const o = fadeIn(frame, reachAt(ex, x0, x1, SWEEP0, SWEEP1), 8);
                return (
                  <g key={j} opacity={o}>
                    <line x1={ex} y1={y - 34} x2={ex} y2={y - LIFT(j) + 16} stroke={T.ink} strokeWidth={LW.THIN} opacity={0.5} />
                    <circle cx={ex} cy={y} r={e.hot ? 17 : 12}
                            fill={e.hot ? YELLOW : '#FFF'} stroke={T.ink} strokeWidth={LW.BODY} />
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
                             fontFamily: 'A2Z Regular, sans-serif', fontSize: 32, color: T.soft}}>
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
                                   // 이름은 **점과 같이** 뜬다. 이음선 없이 글자만
                                   // 먼저 뜨면 어느 해를 가리키는지 알 수 없다
                                   opacity: fadeIn(frame,
                                     reachAt(px(e.at), px(r.from ?? axis.from), px(r.to ?? axis.to),
                                             10 + i * 10, 74 + i * 10) + 2, 8)}}>
                <div style={{fontFamily: e.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                             fontSize: 36, color: T.ink, lineHeight: 1.2, wordBreak: 'keep-all'}}>
                  {/* 형광펜 위 글자는 늘 먹이다. 청사진 테마에서 T.ink 는
                      거의 흰색이라 노란 면에 흰 글자가 됐다 (#48·#50) */}
                  {e.hot
                    ? <span style={{background: 'rgba(250,255,46,0.85)', padding: '2px 10px',
                                    color: '#23262B'}}>{e.label}</span>
                    : e.label}
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
