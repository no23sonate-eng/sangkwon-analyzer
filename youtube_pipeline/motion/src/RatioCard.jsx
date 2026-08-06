import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, INK, INK_SOFT, YELLOW, TONES, CONTENT_BOTTOM, fadeIn} from './paper';

// 비율 비교 카드 — B1M "큰 원 하나로 비중" 문법.
// items:[{label, pct, sub, hot}] — 원 안이 pct 만큼 채워지고 숫자 카운트업.
// mode='bar' 면 원 대신 가로 막대(경쟁률·배수처럼 100% 넘는 값에 적합).
export const RatioCard = ({
  title = '', sub = '', items = [], mode = 'circle', unit = '%', source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = items.length;

  if (mode === 'bar') {
    // 한 행 = [라벨 ......... 수치 보조] / 그 아래 막대.
    // 수치를 막대 아래가 아니라 라벨과 같은 줄에 두어야 다음 행과 안 겹친다.
    const maxV = Math.max(...items.map((i) => i.pct ?? 0), 1);
    const BW = 1140, x0 = (1920 - BW) / 2;
    const y0 = 372, ROW = 172, BH = 58;
    const rowY = (i) => y0 + i * ROW;
    return (
      <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
        <PaperBg />
        <PaperTitle title={title} sub={sub} />
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          {items.map((it, i) => {
            const v = interpolate(frame, [14 + i * 10, 66 + i * 10], [0, it.pct ?? 0],
                                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
            const y = rowY(i);
            return (
              <g key={i}>
                <rect x={x0} y={y} width={BW} height={BH} fill={INK} opacity={0.07} rx={4} />
                <rect x={x0} y={y} width={Math.max(3, BW * (v / maxV))} height={BH} rx={4}
                      fill={it.hot ? YELLOW : TONES[(i + 1) % TONES.length]} />
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
              <div style={{position: 'absolute', left: x0, top: y - 62, opacity: fadeIn(frame, 10 + i * 10),
                           fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 45, color: INK}}>
                {it.label}
              </div>
              <div style={{position: 'absolute', left: x0, width: BW, top: y - 70, textAlign: 'right',
                           opacity: fadeIn(frame, 20 + i * 10)}}>
                <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 65, color: INK,
                              fontVariantNumeric: 'tabular-nums'}}>
                  {v.toFixed(it.decimals ?? 0)}<span style={{fontSize: 43}}>{unit}</span>
                </span>
                {it.sub ? (
                  <span style={{marginLeft: 16, fontFamily: 'A2Z Light, sans-serif', fontSize: 35, color: INK_SOFT}}>
                    {it.sub}
                  </span>
                ) : null}
              </div>
            </React.Fragment>
          );
        })}
        <PaperSource source={source} />
      </AbsoluteFill>
    );
  }

  // ── 원형 모드 ──
  // 채움을 "중심에서 자라는 작은 원"으로 하면 8.1% 같은 낮은 비중이 점처럼 보인다.
  // 파이 조각(원 전체 대비 부채꼴)이 낮은 비중에서도 읽힌다 — B1M 도넛 문법.
  const R = 142;
  const CY = 516;   // 파이 중심 — 라벨(위)·수치(아래) 사이
  const slot = Math.min(560, 1600 / n);
  const wedge = (cx, cy, pct) => {
    const a = 2 * Math.PI * Math.min(99.999, Math.max(0, pct)) / 100;
    const x = cx + R * Math.sin(a), y = cy - R * Math.cos(a);
    return `M ${cx} ${cy} L ${cx} ${cy - R} A ${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${x} ${y} Z`;
  };
  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {items.map((it, i) => {
          const cx = (1920 - slot * n) / 2 + slot / 2 + i * slot;
          const cy = CY;
          const v = interpolate(frame, [16 + i * 10, 70 + i * 10], [0, it.pct ?? 0],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <g key={i}>
              {/* 전체(=100%) 바탕 면 */}
              <circle cx={cx} cy={cy} r={R} fill={INK} opacity={0.07} />
              {/* 비중 = 파이 조각 */}
              <path d={wedge(cx, cy, v)} fill={it.hot ? YELLOW : TONES[(i + 1) % TONES.length]}
                    opacity={it.hot ? 1 : 0.85} />
              <path d={wedge(cx, cy, v)} fill="none" stroke={INK} strokeWidth={2.5} opacity={0.9} />
              {/* 외곽 링 */}
              <circle cx={cx} cy={cy} r={R} fill="none" stroke={INK} strokeWidth={3} opacity={0.35} />
            </g>
          );
        })}
      </svg>
      {items.map((it, i) => {
        const cx = (1920 - slot * n) / 2 + slot / 2 + i * slot;
        const v = interpolate(frame, [16 + i * 10, 70 + i * 10], [0, it.pct ?? 0],
                              {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: cx - slot / 2, width: slot, top: CY + R + 22, textAlign: 'center',
                         opacity: fadeIn(frame, 24 + i * 10)}}>
              <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 104, color: INK,
                            fontVariantNumeric: 'tabular-nums'}}>
                {v.toFixed(it.decimals ?? 1)}<span style={{fontSize: 62}}>{unit}</span>
              </span>
            </div>
            <div style={{position: 'absolute', left: cx - slot / 2, width: slot, top: 236, textAlign: 'center',
                         opacity: fadeIn(frame, 30 + i * 10)}}>
              <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 45, color: INK, wordBreak: 'keep-all'}}>
                {it.label}
              </div>
              {it.sub ? (
                <div style={{marginTop: 8, fontFamily: 'A2Z Light, sans-serif', fontSize: 36, color: INK_SOFT, wordBreak: 'keep-all'}}>
                  {it.sub}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
      <PaperSource source={source} />
    </AbsoluteFill>
  );
};
