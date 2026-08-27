import React from 'react';
import {AbsoluteFill, Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, THEMES, PaperBg, PaperTitle, PaperSource, YELLOW, fadeIn, LW, OPTICAL_CENTER} from './paper';

// Vox 식 단계 카드 — 각 단계를 **사진 타일**로 세우고 화살표로 잇는다.
// 타일이 하나씩 서고, 그 사이를 진행 표시(점)가 따라 이동한다.
// 사진이 없는 단계는 아이콘 타일(톤 면 + 큰 픽토그램)로 대신한다.
//
// steps: [{photo?, icon?, label, sub, hot}]
const Pict = ({name, size = 96, T = THEMES.paper, stroke = T.ink}) => {
  const s = size, P = {stroke, strokeWidth: 3.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round'};
  switch (name) {
    case 'books':   // 책 — 세워진 책 세 권
      return (
        <g {...P}>
          <rect x={-s / 2} y={-s / 3} width={s / 4.4} height={s / 1.5} />
          <rect x={-s / 5} y={-s / 2.4} width={s / 4.4} height={s / 1.35} />
          <rect x={s / 12} y={-s / 3.6} width={s / 4.4} height={s / 1.6} />
          <line x1={-s / 1.9} y1={s / 2.6} x2={s / 1.9} y2={s / 2.6} />
        </g>
      );
    case 'press':   // 인쇄기 — 롤러에서 종이가 나온다
      return (
        <g {...P}>
          <rect x={-s / 2.2} y={-s / 3} width={s / 1.1} height={s / 2.6} rx={6} />
          <circle cx={-s / 5} cy={-s / 6} r={s / 12} />
          <circle cx={s / 5} cy={-s / 6} r={s / 12} />
          <path d={`M ${-s / 3.4} ${s / 6} L ${-s / 3.4} ${s / 2} L ${s / 3.4} ${s / 2} L ${s / 3.4} ${s / 6}`} />
          <line x1={-s / 5} y1={s / 3} x2={s / 5} y2={s / 3} opacity={0.6} />
        </g>
      );
    case 'crane':   // 타워크레인
      return (
        <g {...P}>
          <line x1={0} y1={-s / 2} x2={0} y2={s / 2} />
          <line x1={-s / 2.2} y1={-s / 2.6} x2={s / 2.2} y2={-s / 2.6} />
          <line x1={s / 4} y1={-s / 2.6} x2={s / 4} y2={-s / 8} />
          <line x1={-s / 2.2} y1={s / 2} x2={s / 2.2} y2={s / 2} />
          <line x1={-s / 6} y1={s / 2} x2={0} y2={-s / 2} opacity={0.5} />
        </g>
      );
    default:
      return <circle cx={0} cy={0} r={s / 2.6} {...P} />;
  }
};

export const PhotoStepsCard = ({
  title = '', sub = '', steps = [], source = '', arrows = [],
  // plain — **순서가 아닐 때.** 화살표·번호·진행점을 걷는다.
  // 서울역·명동·소공동 처럼 대등한 것들에 화살표를 그리면 "서울역 다음에
  // 명동" 으로 읽힌다. 대등한 것에 순서를 그리면 뜻이 틀어진다 (#166)
  plain = false,
  scale = 1,        // 타일 크기 배율
  gapScale = 1,     // 타일 사이 간격 배율,
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = steps.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const TW = Math.round(Math.min(plain ? 470 : 340, 1560 / n) * scale);   // 타일 폭
  const TH = Math.round(TW * 0.78);
  // 간격을 **화면을 채우도록** 잡으면 (1720 - TW*n)/(n-1) 타일이 좌우로
  // 흩어져 슬라이드처럼 읽힌다 — 셋이면 350px 이 벌어졌다 (#166).
  // 타일 폭에 비례해 묶어 두고, 벌리고 싶을 때만 gapScale 로 벌린다
  const gap = Math.max(48, TW * 0.28) * gapScale;
  const x0 = (1920 - (TW * n + gap * (n - 1))) / 2;
  const cy = OPTICAL_CENTER - 30;            // 타일 세로 중심
  const cx = (i) => x0 + i * (TW + gap) + TW / 2;

  const STEP = plain ? 10 : 26, T0 = 12;
  // 진행 점 — 타일이 선 뒤 다음 타일로 이동한다 (Vox 의 "따라가는" 리듬)
  const prog = interpolate(frame, [T0 + 14, T0 + STEP * (n - 1) + 14], [0, n - 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const dotI = Math.min(n - 1, prog);
  const dotX = cx(Math.floor(dotI)) + (cx(Math.min(n - 1, Math.floor(dotI) + 1)) - cx(Math.floor(dotI))) * (dotI % 1);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 타일을 잇는 선 + 화살촉 */}
        {(plain ? [] : steps.slice(0, -1)).map((_, i) => {
          const a = cx(i) + TW / 2 + 14, b = cx(i + 1) - TW / 2 - 14;
          const o = fadeIn(frame, T0 + STEP * i + 12);
          return (
            <g key={i} opacity={o}>
              <line x1={a} y1={cy} x2={b - 16} y2={cy} stroke={T.ink} strokeWidth={LW.BODY} />
              <polygon points={`${b},${cy} ${b - 18},${cy - 9} ${b - 18},${cy + 9}`} fill={T.ink} />
            </g>
          );
        })}
        {/* 진행 점 */}
        {plain ? null : (
          <circle cx={dotX} cy={cy} r={11} fill={YELLOW} stroke={T.ink} strokeWidth={LW.BODY}
                  opacity={fadeIn(frame, T0 + 10)} />
        )}
      </svg>

      {steps.map((st, i) => {
        const pop = spring({frame: frame - (T0 + STEP * i), fps, config: {damping: 200}, durationInFrames: 26});
        const x = cx(i) - TW / 2;
        const y = cy - TH / 2;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: x, top: y, width: TW, height: TH,
                         opacity: pop, transform: `translateY(${(1 - pop) * 18}px)`,
                         background: st.photo ? '#FFFFFF' : (st.hot ? YELLOW : T.tones[(i + 1) % T.tones.length]),
                         border: `3px solid ${T.ink}`, overflow: 'hidden',
                         boxShadow: '0 10px 28px rgba(35,38,43,0.20)',
                         display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              {st.photo ? (
                <Img src={staticFile(st.photo)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
              ) : (
                <svg width={TH * 0.62} height={TH * 0.62} viewBox="-60 -60 120 120">
                  <Pict T={T} name={st.icon} stroke={T.ink} />
                </svg>
              )}
            </div>
            {/* 단계 번호 — 순서가 있을 때만 */}
            {plain ? null : (
              <div style={{position: 'absolute', left: x - 14, top: y - 14, width: 54, height: 54,
                           borderRadius: 27, background: T.ink, color: '#FFF', opacity: pop,
                           display: 'flex', alignItems: 'center', justifyContent: 'center',
                           fontFamily: 'A2Z Medium, sans-serif', fontSize: 28}}>
                {i + 1}
              </div>
            )}
            <div style={{position: 'absolute', left: x - 30, width: TW + 60, top: y + TH + 26,
                         textAlign: 'center', opacity: fadeIn(frame, T0 + STEP * i + 6), wordBreak: 'keep-all'}}>
              <span style={{fontFamily: st.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                            fontSize: st.hot ? 46 : 42, color: T.ink, lineHeight: 1.25, padding: '2px 10px',
                            background: st.hot ? 'rgba(250,255,46,0.8)' : 'none',
                            boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'}}>
                {st.label}
              </span>
              {st.sub ? (
                <div style={{marginTop: 10, fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft}}>
                  {st.sub}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
