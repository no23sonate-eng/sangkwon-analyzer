import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT} from './shared';
import {OrgDiagram} from './LogoOrgCard';

// B1M 데이터 테이블 레퍼런스(2026-07-29) 재현 — 얇은 구분선 + 우측 정렬
// 숫자. rows: [{label, value, note}], 행마다 순차적으로 페이드인.
// closingLine: 문장이 길 때(카드 지속시간이 김) 테이블이 다 뜬 채로
// 오래 정지해 있지 않도록, 전체 길이의 60% 지점에 요약 한 줄을 추가로
// 띄운다.
//
// intro: {parentLogo, parentLabel, children:[{logo,label}]} 를 주면
// 표가 뜨기 전에 로고 조직도를 먼저 보여주고(introFrames 프레임 동안)
// 크로스페이드로 표로 넘어간다(2026-07-29 "SBI홀딩스는 SBI증권과
// SBI신세이은행을 거느린 그룹" 문장에 맞는 화면 피드백 — 한 섹션 안에서
// 2단계로 처리해 타임라인 번호를 그대로 유지).
//
// tableTop: 표 블록 시작 y — 아래로 내려 화면 중앙쪽으로 옮길 때 사용.
// light=true: 흰(질감있는) 배경 + 검정 글자 + 실선 테두리 표(#10 피드백).
export const DataTable = ({
  title = '', rows = [], source = '', closingLine = '',
  tableTop = 260,
  intro = null, introFrames = 0,
  light = false,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const hasIntro = Boolean(intro);
  const introOpacity = hasIntro
    ? interpolate(frame, [introFrames - 6, introFrames + 14], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;
  const tableFrame = hasIntro ? Math.max(0, frame - introFrames) : frame;

  const titleOpacity = interpolate(tableFrame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const ROW_H = 96;
  const TABLE_TOP = tableTop;
  const TABLE_W = 1180;
  const LEFT = (1920 - TABLE_W) / 2;

  const titleColor = light ? '#1B1E22' : TEXT.title.color;
  const labelColor = light ? '#3A3E44' : TEXT.label.color;
  const valueColor = light ? '#0A0B0D' : TEXT.value.color;
  const noteColor = light ? '#6B6F76' : '#6B7078';
  const borderStrong = light ? 'rgba(10,11,13,0.35)' : 'rgba(255,255,255,0.18)';
  const borderSoft = light ? 'rgba(10,11,13,0.14)' : 'rgba(255,255,255,0.08)';

  return (
    <AbsoluteFill style={light ? {background: '#F4F1EC'} : BG_STYLE}>
      {light ? (
        <>
          <GridBg color="rgba(10,11,13,0.055)" />
          <div
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              background: 'radial-gradient(ellipse at 20% 15%, rgba(10,11,13,0.035), transparent 55%),'
                + 'radial-gradient(ellipse at 85% 85%, rgba(10,11,13,0.035), transparent 55%)',
            }}
          />
        </>
      ) : (
        <GridBg />
      )}

      {hasIntro ? (
        <OrgDiagram
          parentLogo={intro.parentLogo}
          parentLabel={intro.parentLabel}
          children={intro.children}
          opacity={introOpacity}
        />
      ) : null}

      <div
        style={{
          position: 'absolute', top: 90, left: 0, width: '100%', textAlign: 'center',
          fontSize: 34, opacity: titleOpacity, color: titleColor, fontFamily: 'A2Z Light, sans-serif',
          letterSpacing: '0.02em',
        }}
      >
        {title}
      </div>

      <div
        style={{
          position: 'absolute', top: TABLE_TOP, left: LEFT, width: TABLE_W,
          border: light ? `1px solid ${borderStrong}` : 'none',
          borderRadius: light ? 6 : 0,
          padding: light ? '0 28px' : 0,
        }}
      >
        <div style={{borderBottom: `1px solid ${borderStrong}`, paddingBottom: 14}} />
        {rows.map((row, i) => {
          const rowOpacity = interpolate(tableFrame, [20 + i * 8, 32 + i * 8], [0, 1], {
            extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
          });
          const rowX = interpolate(tableFrame, [20 + i * 8, 32 + i * 8], [16, 0], {
            extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                height: ROW_H, borderBottom: i < rows.length - 1 ? `1px solid ${borderSoft}` : 'none',
                opacity: rowOpacity, transform: `translateX(${rowX}px)`,
              }}
            >
              <div style={{fontSize: 30, color: labelColor, fontFamily: 'A2Z Light, sans-serif', letterSpacing: '0.02em'}}>
                {row.label}
              </div>
              <div style={{textAlign: 'right'}}>
                <span style={{fontSize: 38, color: valueColor, fontFamily: 'A2Z Regular, sans-serif', letterSpacing: '0.045em'}}>
                  {row.value}
                </span>
                {row.note ? (
                  <span style={{fontSize: 22, color: noteColor, marginLeft: 14, fontFamily: 'A2Z Light, sans-serif'}}>
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
            fontSize: 20, color: light ? '#7A7F86' : '#565C64', fontFamily: 'A2Z Light, sans-serif', fontStyle: 'italic',
            opacity: interpolate(tableFrame, [40, 55], [0, 1], {extrapolateRight: 'clamp'}),
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
            fontSize: 36, color: light ? '#1B1E22' : ACCENT, fontFamily: 'A2Z Regular, sans-serif', letterSpacing: '0.02em',
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
