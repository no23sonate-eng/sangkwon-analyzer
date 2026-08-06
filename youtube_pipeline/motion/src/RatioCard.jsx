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
    const maxV = Math.max(...items.map((i) => i.pct ?? 0), 1);
    const BW = 1080, x0 = (1920 - BW) / 2, y0 = 400;
    return (
      <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
        <PaperBg />
        <PaperTitle title={title} sub={sub} />
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          {items.map((it, i) => {
            const v = interpolate(frame, [14 + i * 10, 66 + i * 10], [0, it.pct ?? 0],
                                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
            const y = y0 + i * 122;
            return (
              <g key={i}>
                <rect x={x0} y={y} width={BW} height={54} fill={INK} opacity={0.07} rx={4} />
                <rect x={x0} y={y} width={BW * (v / maxV)} height={54} rx={4}
                      fill={it.hot ? YELLOW : TONES[(i + 1) % TONES.length]} />
              </g>
            );
          })}
        </svg>
        {items.map((it, i) => {
          const v = interpolate(frame, [14 + i * 10, 66 + i * 10], [0, it.pct ?? 0],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const y = y0 + i * 122;
          return (
            <React.Fragment key={i}>
              <div style={{position: 'absolute', left: x0, top: y - 46, opacity: fadeIn(frame, 10 + i * 10),
                           fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 34, color: INK}}>
                {it.label}
              </div>
              <div style={{position: 'absolute', left: x0, width: BW, top: y + 66, textAlign: 'right',
                           opacity: fadeIn(frame, 20 + i * 10)}}>
                <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 52, color: INK,
                              fontVariantNumeric: 'tabular-nums'}}>
                  {v.toFixed(it.decimals ?? 0)}<span style={{fontSize: 34}}>{unit}</span>
                </span>
                {it.sub ? (
                  <span style={{marginLeft: 14, fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: INK_SOFT}}>
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
  const R = 168;
  const slot = Math.min(760, 1600 / n);
  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg />
      <PaperTitle title={title} sub={sub} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {items.map((it, i) => {
          const cx = (1920 - slot * n) / 2 + slot / 2 + i * slot;
          const cy = 470;
          const v = interpolate(frame, [16 + i * 10, 70 + i * 10], [0, it.pct ?? 0],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const C = 2 * Math.PI * R;
          return (
            <g key={i}>
              {/* 바탕 링 */}
              <circle cx={cx} cy={cy} r={R} fill="none" stroke={INK} strokeWidth={3} opacity={0.28} />
              {/* 채움 — 얇은 면이 아니라 중심에서 자라는 원 (비중 = 면적) */}
              <circle cx={cx} cy={cy} r={R * Math.sqrt(Math.max(0, v) / 100)}
                      fill={it.hot ? YELLOW : TONES[(i + 1) % TONES.length]} opacity={it.hot ? 0.95 : 0.75} />
              {/* 진행 호 */}
              <circle cx={cx} cy={cy} r={R} fill="none" stroke={INK} strokeWidth={5}
                      strokeDasharray={`${C * (v / 100)} ${C}`}
                      transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round" />
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
            <div style={{position: 'absolute', left: cx - slot / 2, width: slot, top: 500 + 196, textAlign: 'center',
                         opacity: fadeIn(frame, 24 + i * 10)}}>
              <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 82, color: INK,
                            fontVariantNumeric: 'tabular-nums'}}>
                {v.toFixed(it.decimals ?? 1)}<span style={{fontSize: 48}}>{unit}</span>
              </span>
            </div>
            <div style={{position: 'absolute', left: cx - slot / 2, width: slot, top: 500 + 300, textAlign: 'center',
                         opacity: fadeIn(frame, 30 + i * 10)}}>
              <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 34, color: INK, wordBreak: 'keep-all'}}>
                {it.label}
              </div>
              {it.sub ? (
                <div style={{marginTop: 8, fontFamily: 'A2Z Light, sans-serif', fontSize: 27, color: INK_SOFT, wordBreak: 'keep-all'}}>
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
