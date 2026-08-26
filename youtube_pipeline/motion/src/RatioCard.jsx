import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, stageTop, titleH, LW, PaperCaption} from './paper';

// 비율 비교 카드 — B1M "큰 원 하나로 비중" 문법.
// items:[{label, pct, sub, hot}] — 원 안이 pct 만큼 채워지고 숫자 카운트업.
// mode='bar' 면 원 대신 가로 막대(경쟁률·배수처럼 100% 넘는 값에 적합).
export const RatioCard = ({
  title = '', sub = '', items = [], mode = 'circle', unit = '%', source = '',
  single = false,   // 원 하나에 여러 몫을 겹쳐 그린다 (포함관계)
  caption = '',     // 가정·근거
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const n = items.length;

  if (mode === 'bar') {
    // 한 행 = [라벨 ......... 수치 보조] / 그 아래 막대.
    // 수치를 막대 아래가 아니라 라벨과 같은 줄에 두어야 다음 행과 안 겹친다.
    const maxV = Math.max(...items.map((i) => i.pct ?? 0), 1);
    const BW = 1140, x0 = (1920 - BW) / 2;
    const ROW = 190, BH = 62;
    const y0 = stageTop(titleH(title, sub) + 64 + items.length * ROW - (ROW - BH - 60),
                        {top: 150}) + titleH(title, sub) + 64;
    const rowY = (i) => y0 + i * ROW;
    return (
      <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
        <PaperBg theme={theme} {...bg} />
        <PaperTitle title={title} sub={sub} theme={theme} align={align} />
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          {items.map((it, i) => {
            const v = interpolate(frame, [14 + i * 10, 66 + i * 10], [0, it.pct ?? 0],
                                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
            const y = rowY(i);
            return (
              <g key={i}>
                <rect x={x0} y={y} width={BW} height={BH} fill={T.ink} opacity={0.07} rx={4} />
                <rect x={x0} y={y} width={Math.max(3, BW * (v / maxV))} height={BH} rx={4}
                      fill={it.hot ? YELLOW : T.tones[(i + 1) % T.tones.length]} />
              </g>
            );
          })}
        </svg>
        {items.map((it, i) => {
          const v = interpolate(frame, [14 + i * 10, 66 + i * 10], [0, it.pct ?? 0],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const y = rowY(i);
          return (
            <React.Fragment key={i}>
              <div style={{position: 'absolute', left: x0, top: y - 78, opacity: fadeIn(frame, 10 + i * 10), lineHeight: 1,
                           fontFamily: 'A2Z Medium, sans-serif', fontSize: 42, color: T.ink}}>
                {it.label}
              </div>
              <div style={{position: 'absolute', left: x0, width: BW, top: y - 92, textAlign: 'right',
                           opacity: fadeIn(frame, 20 + i * 10)}}>
                <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 64, color: T.ink,
                              fontVariantNumeric: 'tabular-nums'}}>
                  {Number(v.toFixed(it.decimals ?? 0)).toLocaleString('ko-KR')}<span style={{fontSize: 42}}>{unit}</span>
                </span>
                {it.sub ? (
                  <span style={{marginLeft: 16, fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft}}>
                    {it.sub}
                  </span>
                ) : null}
              </div>
            </React.Fragment>
          );
        })}
        <PaperCaption theme={theme} opacity={fadeIn(frame, 60)}>{caption}</PaperCaption>
      <PaperSource source={source} theme={theme} />
      </AbsoluteFill>
    );
  }

  // ── 원형 모드 ──
  // 채움을 "중심에서 자라는 작은 원"으로 하면 8.1% 같은 낮은 비중이 점처럼 보인다.
  // 파이 조각(원 전체 대비 부채꼴)이 낮은 비중에서도 읽힌다 — B1M 도넛 문법.
  // 반지름은 개수를 따라간다. 하나뿐인데 142 로 그리면 화면이 텅 빈 채
  // 가운데에 작은 원 하나가 뜬다 — 도표가 주인공인 컷에서 그러면 안 된다.
  const R = n === 1 ? 236 : (n === 2 ? 190 : 142);
  // 파이 중심. 라벨(위)·수치(아래)를 합쳐 한 덩어리로 앉힌다
  const CY = stageTop(titleH(title, sub) + 64 + 430, {top: 150})
    + titleH(title, sub) + 64 + 215;
  // one=true 면 **원 하나에 여러 몫**을 겹쳐 그린다. 큰 것부터 깔고 작은 것을
  // 위에 얹으면 "전체 안의 부문, 그 안의 세부" 가 한 원에서 읽힌다.
  // 동심원(AreaNestCard)은 크기를 견주는 그림이고, 이건 **몫**을 나누는 그림이다
  const one = mode === 'circle' && items.length > 1 && single;
  const slot = one ? 1600 : Math.min(560, 1600 / n);
  const wedge = (cx, cy, pct) => {
    const a = 2 * Math.PI * Math.min(99.999, Math.max(0, pct)) / 100;
    const x = cx + R * Math.sin(a), y = cy - R * Math.cos(a);
    return `M ${cx} ${cy} L ${cx} ${cy - R} A ${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${x} ${y} Z`;
  };
  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {one ? (
          <g>
            <circle cx={960} cy={CY} r={R} fill={T.ink} opacity={0.07} />
            {[...items].map((it, i) => ({it, i}))
              .sort((a, b) => (b.it.pct ?? 0) - (a.it.pct ?? 0))
              .map(({it, i}) => {
                const v = interpolate(frame, [16 + i * 10, 70 + i * 10], [0, it.pct ?? 0],
                                      {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
                return (
                  <g key={i}>
                    <path d={wedge(960, CY, v)}
                          fill={it.hot ? YELLOW : T.tones[(i + 1) % T.tones.length]}
                          opacity={it.hot ? 1 : 0.9} />
                    {/* 중심에서 나가는 분할선 — 몫의 경계를 못 박는다 */}
                    <path d={wedge(960, CY, v)} fill="none" stroke={T.ink}
                          strokeWidth={LW.BODY} opacity={0.9} />
                  </g>
                );
              })}
            <circle cx={960} cy={CY} r={R} fill="none" stroke={T.ink}
                    strokeWidth={LW.BODY} opacity={0.4} />
          </g>
        ) : items.map((it, i) => {
          const cx = (1920 - slot * n) / 2 + slot / 2 + i * slot;
          const cy = CY;
          const v = interpolate(frame, [16 + i * 10, 70 + i * 10], [0, it.pct ?? 0],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <g key={i}>
              {/* 전체(=100%) 바탕 면 */}
              <circle cx={cx} cy={cy} r={R} fill={T.ink} opacity={0.07} />
              {/* 비중 = 파이 조각 */}
              <path d={wedge(cx, cy, v)} fill={it.hot ? YELLOW : T.tones[(i + 1) % T.tones.length]}
                    opacity={it.hot ? 1 : 0.85} />
              <path d={wedge(cx, cy, v)} fill="none" stroke={T.ink} strokeWidth={LW.THIN} opacity={0.9} />
              {/* 외곽 링 */}
              <circle cx={cx} cy={cy} r={R} fill="none" stroke={T.ink} strokeWidth={LW.BODY} opacity={0.35} />
            </g>
          );
        })}
      </svg>
      {items.map((it, i) => {
        // one 모드에서는 원이 하나뿐이므로 라벨을 원 아래에 나란히 편다.
        // 안 그러면 라벨이 전부 화면 밖 같은 자리로 간다
        const lw = one ? 1600 / n : slot;
        const cx = one
          ? 160 + lw * (i + 0.5)
          : (1920 - slot * n) / 2 + slot / 2 + i * slot;
        const v = interpolate(frame, [16 + i * 10, 70 + i * 10], [0, it.pct ?? 0],
                              {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: cx - (one ? 1600 / n : slot) / 2,
                         width: one ? 1600 / n : slot, top: CY + R + 22, textAlign: 'center',
                         opacity: fadeIn(frame, 24 + i * 10)}}>
              <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 96, color: T.ink,
                            fontVariantNumeric: 'tabular-nums'}}>
                {v.toFixed(it.decimals ?? 1)}<span style={{fontSize: 54}}>{unit}</span>
              </span>
            </div>
            <div style={{position: 'absolute', left: cx - slot / 2, width: slot, top: 288, textAlign: 'center',
                         opacity: fadeIn(frame, 30 + i * 10)}}>
              <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 42, color: T.ink, wordBreak: 'keep-all'}}>
                {it.label}
              </div>
              {it.sub ? (
                <div style={{marginTop: 8, fontFamily: 'A2Z Light, sans-serif', fontSize: 36, color: T.soft, wordBreak: 'keep-all'}}>
                  {it.sub}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
      <PaperCaption theme={theme} opacity={fadeIn(frame, 60)}>{caption}</PaperCaption>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
