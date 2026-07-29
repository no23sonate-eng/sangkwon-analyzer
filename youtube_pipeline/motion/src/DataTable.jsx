import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT} from './shared';

// B1M 데이터 테이블 레퍼런스(2026-07-29) 재현 — 얇은 구분선 + 우측 정렬
// 숫자. rows: [{label, value, note}], 행마다 순차적으로 페이드인.
// closingLine: 문장이 길 때(카드 지속시간이 김) 테이블이 다 뜬 채로
// 오래 정지해 있지 않도록, 전체 길이의 60% 지점에 요약 한 줄을 추가로
// 띄운다(예: "그 정도 체급의 회사입니다").
export const DataTable = ({title = '', rows = [], source = '', closingLine = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const ROW_H = 96;
  const TABLE_TOP = 260;
  const TABLE_W = 1180;
  const LEFT = (1920 - TABLE_W) / 2;

  return (
    <AbsoluteFill style={BG_STYLE}>
      <GridBg />
      <div
        style={{
          position: 'absolute', top: 90, left: 0, width: '100%', textAlign: 'center',
          fontSize: 34, opacity: titleOpacity, ...TEXT.title,
        }}
      >
        {title}
      </div>

      <div style={{position: 'absolute', top: TABLE_TOP, left: LEFT, width: TABLE_W}}>
        <div style={{borderBottom: '1px solid rgba(255,255,255,0.18)', paddingBottom: 14}} />
        {rows.map((row, i) => {
          const rowOpacity = interpolate(frame, [20 + i * 8, 32 + i * 8], [0, 1], {
            extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
          });
          const rowX = interpolate(frame, [20 + i * 8, 32 + i * 8], [16, 0], {
            extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                height: ROW_H, borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                opacity: rowOpacity, transform: `translateX(${rowX}px)`,
              }}
            >
              <div style={{fontSize: 30, ...TEXT.label}}>{row.label}</div>
              <div style={{textAlign: 'right'}}>
                <span style={{fontSize: 38, ...TEXT.value}}>{row.value}</span>
                {row.note ? (
                  <span style={{fontSize: 22, color: '#6B7078', marginLeft: 14, fontFamily: 'A2Z Light, sans-serif'}}>
                    {row.note}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {source ? (
        <div
          style={{
            position: 'absolute', top: TABLE_TOP + rows.length * ROW_H + 40, left: LEFT,
            fontSize: 20, color: '#565C64', fontFamily: 'A2Z Light, sans-serif', fontStyle: 'italic',
            opacity: interpolate(frame, [40, 55], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          {source}
        </div>
      ) : null}

      {closingLine ? (
        <div
          style={{
            position: 'absolute', top: TABLE_TOP + rows.length * ROW_H + 110, left: 0,
            width: '100%', textAlign: 'center',
            fontSize: 36, color: ACCENT, fontFamily: 'A2Z Regular, sans-serif', letterSpacing: '0.02em',
            opacity: interpolate(
              frame,
              [Math.round(durationInFrames * 0.6), Math.round(durationInFrames * 0.6) + 20],
              [0, 1],
              {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
            ),
          }}
        >
          {closingLine}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
