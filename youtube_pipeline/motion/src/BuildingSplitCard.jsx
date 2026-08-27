import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, PaperCaption, YELLOW,
        fadeIn, stageTop, titleBottom, SP, LW} from './paper';

// ── 한 건물을 층으로 가른다 ───────────────────────────────────────────────
// "1~5층은 사무실, 6층부터 호텔" 처럼 **한 덩어리 안에서 용도가 나뉠 때**.
//
// ExplodedStackCard 와 갈라지는 지점: 저건 판을 **떼어 내서** 쌓는다 —
// 구성 요소를 세는 그림이다. 이건 떼어 내지 않는다. 건물은 하나로 서 있고
// 그 안에 선이 그어진다. "같은 건물인데 층마다 쓰임이 다르다" 가 요점일 때
// 판을 분해하면 서로 다른 건물처럼 읽힌다 (#38).
//
// 실루엣은 SilhouetteCompareCard 와 같은 문법(0~100 정규화 path)을 쓴다 —
// 한 영상 안에서 건물이 두 가지 꼴로 그려지면 같은 건물로 안 읽힌다.
//
// bands: [{label, note, hot, span}]  아래에서 위로. span 은 층수 비중(기본 1)
export const BuildingSplitCard = ({
  title = '', sub = '', bands = [], caption = '',
  path = 'M0 100 L0 0 L100 0 L100 100 Z',   // 기본은 그냥 네모
  source = '', theme, align = 'center', bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = Math.max(1, bands.length);

  // 건물은 **가운데에서 조금 왼쪽**. 오른쪽은 이름이 앉을 자리다
  const BW = 420, BH = 620;
  const BX = 700 - BW / 2;
  const top = stageTop(BH, {top: titleBottom(title, sub, align) + SP.BLOCK});

  const total = bands.reduce((a, b) => a + (b.span || 1), 0);
  // 아래에서 위로 쌓는다 — 1층이 아래다
  let acc = 0;
  const rows = bands.map((b) => {
    const h = BH * ((b.span || 1) / total);
    const y = top + BH - acc - h;
    acc += h;
    return {...b, y, h};
  });

  const grow = spring({frame: frame - 8, fps, config: {damping: 200}, durationInFrames: 28});

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <defs>
          <clipPath id="bsc-body">
            <path d={path} transform={`translate(${BX} ${top}) scale(${BW / 100} ${BH / 100})`} />
          </clipPath>
        </defs>
        {/* 건물이 바닥에서 자란다 */}
        <g clipPath="url(#bsc-body)">
          {rows.map((r, i) => {
            const o = fadeIn(frame, 16 + i * 10, 18);
            return (
              <rect key={i} x={BX} y={r.y} width={BW} height={r.h}
                    fill={r.hot ? YELLOW : T.tones[(i + 2) % T.tones.length]}
                    opacity={(r.hot ? 1 : 0.9) * o} />
            );
          })}
        </g>
        {/* 외곽선은 한 번만 — 건물은 하나다 */}
        <path d={path} transform={`translate(${BX} ${top}) scale(${BW / 100} ${BH / 100})`}
              fill="none" stroke={T.ink} strokeWidth={LW.BODY}
              opacity={0.9 * interpolate(grow, [0, 1], [0, 1])} />
        {/* 층 경계 + 이름으로 나가는 리더선 */}
        {rows.slice(0, -1).map((r, i) => (
          <line key={i} x1={BX} y1={r.y} x2={BX + BW} y2={r.y}
                stroke={T.ink} strokeWidth={LW.THIN} opacity={0.55 * fadeIn(frame, 22 + i * 10)} />
        ))}
        {rows.map((r, i) => (
          <line key={`l${i}`} x1={BX + BW} y1={r.y + r.h / 2}
                x2={1180} y2={r.y + r.h / 2}
                stroke={T.ink} strokeWidth={LW.HAIR}
                opacity={0.45 * fadeIn(frame, 26 + i * 10)} />
        ))}
      </svg>

      {/* 이름은 **오른쪽**. 왼쪽에 층수를 세로로 세우면 눈이 두 번 움직인다 */}
      {rows.map((r, i) => (
        <div key={i} style={{position: 'absolute', left: 1210, width: 620,
                             top: r.y + r.h / 2 - 44,
                             opacity: fadeIn(frame, 28 + i * 10)}}>
          <div style={{fontFamily: r.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                       fontSize: 54, color: T.ink, lineHeight: 1.2, wordBreak: 'keep-all'}}>
            {r.label}
          </div>
          {r.note ? (
            <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: 36, color: T.soft, wordBreak: 'keep-all'}}>
              {r.note}
            </div>
          ) : null}
        </div>
      ))}

      <PaperCaption theme={theme} opacity={fadeIn(frame, 58)}>{caption}</PaperCaption>
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
