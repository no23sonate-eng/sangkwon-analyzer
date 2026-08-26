import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {YELLOW, glow} from './v2shared';
import {themeOf, PaperBg, PaperTitle, PaperSource, CONTENT_BOTTOM, fadeIn} from './paper';
import {estWidth} from './layout';

// 데이터 테이블 — 얇은 구분선 + 좌측 라벨 / 우측정렬 값.
// **채널 테마로 옮겨 왔다** (YFlowCard 와 같은 이유). 원래 v2 시절 카드라
// 배경이 순검정이라 같은 영상 안에서 이 컷만 튀었고 출처 줄도 없었다.
// rows: [{label, value, note, hot}] — hot 값만 옐로 발광.
// closingLine: 마지막에 옐로로 떠오르는 요약 문장(선택).
export const YTableCard = ({
  kicker = '',
  sub = '',
  rows = [],
  closingLine = '',
  caption = '',
  source = '',
  title = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const enter = fadeIn(frame, 0, 14);

  const n = rows.length || 1;
  const rowH = n > 3 ? 118 : 138;
  // 1280 은 너무 넓어서 왼쪽 이름과 오른쪽 값이 화면 양 끝으로 갈라졌다
  // ("크래프톤" 과 "사옥 신축" 이 서로 남처럼 보였다 — 검수 지적 #117).
  // 그렇다고 폭을 860 으로 **고정**해 놓으니 이번엔 줄 끝이 내용보다 230px 쯤
  // 더 뻗어서, 표는 가운데인데 글자 덩어리는 왼쪽으로 쏠려 보였다.
  // 폭은 **내용이 정하게** 한다 — 가장 긴 이름과 가장 긴 값을 재서 그만큼만 긋고,
  // 그 덩어리를 화면 한가운데 놓는다. 그래야 진짜 가운데로 읽힌다.
  const PADL = 10, GUTTER = 46, PADR = 30;
  const nameW = Math.max(...rows.map((r) => estWidth(r.label || '', 34)), 120);
  const valW = Math.max(...rows.map((r) =>
    estWidth(r.value || '', r.hot ? 52 : 44)
    + (r.note ? 20 + estWidth(r.note, 27) : 0)), 160);
  // 이름 칸 폭을 정해 두고 값은 그 바로 옆에서 시작한다 — 양 끝 정렬을 하면
  // 이름과 값이 서로 남처럼 보인다
  const NAMEW = PADL + nameW + GUTTER;
  const tableW = Math.min(1400, Math.max(620, NAMEW + valW + PADR));
  const left = Math.round((1920 - tableW) / 2);
  const closingSpace = closingLine ? 110 : 0;
  // 제목이 붙으면 그 아래 띠 한가운데에 표를 앉힌다
  const bandTop = (title || kicker) ? (sub ? 300 : 250) : 200;
  const top = Math.round(bandTop + Math.max(0,
    (CONTENT_BOTTOM - bandTop - (n * rowH + closingSpace)) / 2));

  const closingIn = interpolate(
    frame,
    [Math.round(durationInFrames * 0.45), Math.round(durationInFrames * 0.45) + 18],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title || kicker} sub={sub} theme={theme} />

      {rows.map((r, i) => {
        const rowIn = spring({frame: frame - 12 - i * 8, fps, config: {damping: 200}, durationInFrames: 22});
        const y = top + i * rowH;
        return (
          <div key={i} style={{position: 'absolute', top: y, left, width: tableW, height: rowH, opacity: rowIn}}>
            <div style={{position: 'absolute', bottom: 0, left: 0, width: tableW, height: 1, background: T.ink, opacity: 0.16}} />
            {i === 0 ? (
              <div style={{position: 'absolute', top: 0, left: 0, width: tableW, height: 1, background: T.ink, opacity: 0.16}} />
            ) : null}
            <div
              style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 10,
                fontFamily: 'A2Z Light, sans-serif', fontSize: 32,
                letterSpacing: '0.05em', color: r.hot ? T.ink : T.soft,
              }}
            >
              {r.label}
            </div>
            <div
              style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                left: NAMEW, textAlign: 'left',
              }}
            >
              <span
                style={{
                  fontFamily: 'A2Z Medium, sans-serif',
                  fontSize: r.hot ? 52 : 44,
                  letterSpacing: '0.02em',
                  color: r.hot ? YELLOW : T.ink,
                  textShadow: r.hot ? glow(0.6) : 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {r.value}
              </span>
              {r.note ? (
                <span
                  style={{
                    marginLeft: 20, fontFamily: 'A2Z Light, sans-serif',
                    fontSize: 24, letterSpacing: '0.04em', color: T.soft,
                  }}
                >
                  {r.note}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}

      {closingLine ? (
        <div
          style={{
            position: 'absolute', top: top + n * rowH + 52, left, width: tableW,
            textAlign: 'center',
            fontFamily: 'A2Z Regular, sans-serif', fontSize: 42,
            letterSpacing: '0.04em', color: T.ink,
            opacity: closingIn,
          }}
        >
          {closingLine}
        </div>
      ) : null}

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 26,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 32,
                     color: T.soft, opacity: fadeIn(frame, 12 + n * 8 + 14), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
