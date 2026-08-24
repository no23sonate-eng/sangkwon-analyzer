import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, fadeIn} from './paper';

// 면적 중첩 카드 — 넓이를 나란히 놓지 않고 **같은 모서리에 겹쳐** 그린다.
// 막대 3개를 좌→우로 세우는 문법과 달리, "몇 배"가 포개진 크기로 즉시 읽힌다.
// 면적(㎡·평·ha)이나 "몇 배" 비교 전용.
// items: [{label, value, sub, hot}] — 값 순서 무관, 큰 것부터 자동 정렬
export const AreaNestCard = ({
  title = '', sub = '', items = [], unit = '', source = '',
  multipleNote = '',   // 예: "3.3배" — 가운데에 크게 얹는다,
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  if (!items.length) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const sorted = [...items].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const maxV = sorted[0].value ?? 1;
  // 가장 큰 사각형을 기준 크기로, 나머지는 면적비의 제곱근만큼
  const BOX = 392;                      // 큰 사각형 한 변
  const CX = 640, BASE_Y = 776;         // 좌하단 기준점(공통 모서리)
  const side = (v) => BOX * Math.sqrt(Math.max(0, v) / maxV);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 기준 모서리 — 두 변이 만나는 자리를 명시 */}
        <line x1={CX - BOX / 2 - 40} y1={BASE_Y} x2={CX + BOX / 2 + 40} y2={BASE_Y}
              stroke={T.ink} strokeWidth={3} opacity={fadeIn(frame, 2)} />
        {sorted.map((it, i) => {
          const g = interpolate(frame, [12 + i * 12, 58 + i * 12], [0, 1],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const s = side(it.value) * g;
          const x = CX - BOX / 2;
          return (
            <g key={i}>
              <rect x={x} y={BASE_Y - s} width={s} height={s}
                    fill={it.hot ? YELLOW : T.tones[(i * 2 + 1) % T.tones.length]}
                    opacity={it.hot ? 0.92 : 0.55} />
              <rect x={x} y={BASE_Y - s} width={s} height={s}
                    fill="none" stroke={T.ink} strokeWidth={i === 0 ? 3 : 2.5}
                    strokeDasharray={it.hot ? undefined : '8 6'} />
            </g>
          );
        })}
      </svg>

      {/* 라벨 — 각 사각형의 윗변 오른쪽에서 뻗어 나가는 지시선 + 수치 */}
      {(() => {
        // 라벨을 사각형 모서리 높이에 그대로 두면, 값이 비슷한 두 항목의
        // 모서리가 붙어 라벨 두 덩어리가 포개진다 (2조 6,560억 / 7,657억 /
        // 4,135억 에서 뒤 둘이 그랬다). 모서리는 그대로 두고 **라벨만**
        // 아래로 밀어 최소 간격을 확보한 뒤, 리더선을 밀린 자리로 잇는다
        const MIN = 150;
        let last = -1e9;
        return sorted.map((it, i) => {
          const s = side(it.value);
          const yTop = BASE_Y - s;
          const ly = Math.max(yTop, last + MIN);
          last = ly;
          const xRight = CX - BOX / 2 + s;
          const o = fadeIn(frame, 34 + i * 12);
          return (
          <React.Fragment key={i}>
            <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, opacity: o}}>
              <line x1={xRight} y1={yTop} x2={CX + BOX / 2 + 84} y2={ly}
                    stroke={T.ink} strokeWidth={2} opacity={0.45} strokeDasharray="5 5" />
              <circle cx={xRight} cy={yTop} r={5} fill={T.ink} opacity={0.6} />
            </svg>
            <div style={{position: 'absolute', left: CX + BOX / 2 + 100, width: 700, top: ly,
                         transform: 'translateY(-50%)', opacity: o}}>
              <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 62, color: T.ink,
                           lineHeight: 1.05, fontVariantNumeric: 'tabular-nums'}}>
                {it.display ?? it.value}<span style={{fontSize: 38, marginLeft: 6}}>{unit}</span>
              </div>
              <div style={{marginTop: 6, fontFamily: it.hot ? 'Pretendard Bold, A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                           fontSize: 40, color: T.ink, lineHeight: 1.2, wordBreak: 'keep-all'}}>
                {it.label}
              </div>
              {it.sub ? (
                <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft, wordBreak: 'keep-all'}}>
                  {it.sub}
                </div>
              ) : null}
            </div>
          </React.Fragment>
          );
        });
      })()}

      {multipleNote ? (
        <div style={{position: 'absolute', left: 40, width: CX - BOX / 2 - 100, top: 452,
                     textAlign: 'right', opacity: fadeIn(frame, 70)}}>
          <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 56, color: T.ink,
                        background: 'rgba(250,255,46,0.8)', padding: '6px 20px'}}>
            {multipleNote}
          </span>
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
