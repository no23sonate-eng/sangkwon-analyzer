import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, PaperKicker, PaperCaption,
        YELLOW, CONTENT_BOTTOM, fadeIn, SP, stageTop} from './paper';

// v2 가로 랭킹 바 — 항목명이 긴 한국어 비교에 유리한 수평 막대.
// 1위(hot)만 옐로 발광, 나머지 뮤트그레이. 순위 번호·증감 주석 포함.
// rows: [{name, value, display, hot, delta}] — delta 예: '↗ 증가세'
export const YRankBarsCard = ({
  kicker = '', sub = '', rows = [], tight = false, caption = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = themeOf(theme);
  const enter = fadeIn(frame, 0, 14);
  const maxVal = Math.max(...rows.map((r) => r.value), 1);

  // 킥커와 하단 캡션 사이에 행이 다 들어가게 계산
  // tight — 행을 좁히고 묶음을 화면 가운데로. 항목이 넷쯤이면 기본 간격에서
  // 위아래가 벌어져 목록이 화면에 흩어진 것처럼 보인다
  const rowH0 = Math.min(rows.length > 4 ? 82 : 108,
                         (CONTENT_BOTTOM - 70 - (kicker ? 300 : 230)) / Math.max(1, rows.length));
  const rowHT = tight ? Math.round(rowH0 * 0.78) : rowH0;
  const headH = kicker ? (sub ? 116 : 76) : 0;
  const top = tight
    ? stageTop(headH + 56 + rows.length * rowHT, {top: 150}) + headH + 56
    : (kicker ? 300 : 230);
  const rowH = tight ? rowHT : Math.min(rows.length > 4 ? 82 : 108,
                        (CONTENT_BOTTOM - 70 - top) / Math.max(1, rows.length));
  // 세로 기준선은 **왼쪽 끝**에 세우고 01/02 를 그 오른쪽에 붙인다.
  // 원래는 막대 시작선에 세워서 순위 번호가 선 왼쪽에 떠 있었는데,
  // 채널 규칙은 번호가 선 오른쪽에 붙는 것이다. 선이 목록의 왼쪽 모서리를
  // 잡아 줘야 항목명 길이가 달라도 줄이 흔들리지 않는다
  const ruleX = 120;
  const numX = ruleX + 22;
  const nameX = ruleX + 96;
  const barX = 560;
  const barMaxW = 880;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperKicker title={kicker} sub={sub} theme={theme} opacity={enter} />

      {/* 세로 기준선 하나만 — 데이터잉크 최소. 목록의 왼쪽 모서리다 */}
      <div
        style={{
          position: 'absolute', top: top - 18, left: ruleX,
          width: 2, height: rows.length * rowH + 20, background: T.ink,
          opacity: 0.55 * enter,
        }}
      />

      {rows.map((r, i) => {
        const grow = spring({frame: frame - 12 - i * 7, fps, config: {damping: 200}, durationInFrames: 30});
        const w = Math.max(6, (r.value / maxVal) * barMaxW * grow);
        const y = top + i * rowH;
        return (
          <React.Fragment key={r.name}>
            {/* 순위 + 항목명 */}
            <div style={{position: 'absolute', top: y + 4, left: numX,
                         width: barX - numX - 30, whiteSpace: 'nowrap', opacity: grow}}>
              <span
                style={{
                  fontFamily: 'A2Z Medium, sans-serif', fontSize: 24,
                  letterSpacing: '0.12em', color: r.hot ? T.ink : T.soft,
                  display: 'inline-block', width: 74,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontFamily: r.hot ? 'A2Z Regular, sans-serif' : 'A2Z Light, sans-serif',
                  fontSize: 36, letterSpacing: '0.04em', color: r.hot ? T.ink : T.soft,
                }}
              >
                {r.name}
              </span>
            </div>
            {/* 막대 */}
            <div
              style={{
                position: 'absolute', top: y, left: barX, width: w, height: 44,
                                background: r.hot ? YELLOW : T.tones[0],
                border: `2px solid ${T.ink}`,
              }}
            />
            {/* 값 + 증감 주석 */}
            <div
              style={{
                position: 'absolute', top: y + 2, left: barX + w + 28,
                display: 'flex', alignItems: 'baseline', gap: 20, opacity: grow,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  fontFamily: 'A2Z Medium, sans-serif',
                  fontSize: r.hot ? 44 : 36,
                  letterSpacing: '0.02em',
                  color: T.ink,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {r.display}
              </span>
              {r.delta ? (
                <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 24, letterSpacing: '0.05em', color: r.hot ? T.ink : T.soft}}>
                  {r.delta}
                </span>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
      <PaperCaption theme={theme} opacity={fadeIn(frame, 12 + rows.length * 7 + 14)}>{caption}</PaperCaption>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
