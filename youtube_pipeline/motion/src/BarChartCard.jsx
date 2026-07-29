import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT} from './shared';

// 세로 막대 그래프 카드 — 수치 나열(표)보다 비교가 바로 눈에 들어와야 할
// 때(2026-07-29 "#16/#18/#19 그래프로 만들어줘, 비교가 잘 되게" 피드백).
// bars: [{label, value, displayValue}] — value 는 막대 높이 계산용 숫자,
// displayValue 는 막대 위에 표시할 텍스트(단위 포함, 생략 시 value 표시).
// light=true: #10/#19 계열 화이트 톤. 항목이 2~3개일 때도 항상 화면
// 가운데에 그룹으로 정렬된다(#18 "가운데 정렬" 피드백).
const PALETTE = ['#C98A9E', '#8FAD8B', '#7B9BC2', '#C9A86A'];

export const BarChartCard = ({
  title = '', bars = [], source = '', closingLine = '',
  light = false, accent = ACCENT,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  const titleColor = light ? '#1B1E22' : TEXT.title.color;
  const labelColor = light ? '#3A3E44' : TEXT.label.color;
  const valueColor = light ? '#0A0B0D' : TEXT.value.color;
  const baseLineColor = light ? 'rgba(10,11,13,0.35)' : 'rgba(255,255,255,0.18)';

  const BASELINE = 760;
  const MAX_BAR_H = 380;
  const n = bars.length || 1;
  const maxValue = Math.max(...bars.map((b) => Math.abs(b.value) || 0), 1);

  const side = Math.min(240, Math.round(900 / n));
  const gap = 70;
  const totalW = side * n + gap * (n - 1);
  const startX = (1920 - totalW) / 2;

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

      <div
        style={{
          position: 'absolute', top: 90, left: 0, width: '100%', textAlign: 'center',
          fontSize: 34, opacity: titleOpacity, color: titleColor, fontFamily: 'A2Z Light, sans-serif',
          letterSpacing: '0.02em',
        }}
      >
        {title}
      </div>

      <div style={{position: 'absolute', top: BASELINE, left: startX, width: totalW, height: 1, background: baseLineColor}} />

      {bars.map((bar, i) => {
        const delay = 18 + i * 10;
        const grow = spring({frame: Math.max(0, frame - delay), fps, config: {damping: 16, mass: 0.8}, durationInFrames: 26});
        const ratio = (Math.abs(bar.value) || 0) / maxValue;
        const barH = Math.round(MAX_BAR_H * ratio * grow);
        const opacity = interpolate(grow, [0, 1], [0, 1]);
        const x = startX + i * (side + gap);
        const color = bar.color || PALETTE[i % PALETTE.length];
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute', top: BASELINE - barH, left: x, width: side, height: barH,
                background: color, borderRadius: '4px 4px 0 0', opacity,
              }}
            />
            <div
              style={{
                position: 'absolute', top: BASELINE - barH - 46, left: x, width: side, textAlign: 'center',
                fontSize: 32, color: valueColor, fontFamily: 'A2Z Regular, sans-serif', letterSpacing: '0.02em',
                opacity,
              }}
            >
              {bar.displayValue ?? bar.value}
            </div>
            <div
              style={{
                position: 'absolute', top: BASELINE + 22, left: x, width: side, textAlign: 'center',
                fontSize: 24, color: labelColor, fontFamily: 'A2Z Light, sans-serif', letterSpacing: '0.02em',
                opacity,
              }}
            >
              {bar.label}
            </div>
          </React.Fragment>
        );
      })}

      {source ? (
        <div
          style={{
            position: 'absolute', top: BASELINE + 90, left: startX,
            fontSize: 20, color: light ? '#7A7F86' : '#565C64', fontFamily: 'A2Z Light, sans-serif', fontStyle: 'italic',
            opacity: interpolate(frame, [40, 55], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          {source}
        </div>
      ) : null}

      {closingLine ? (
        <div
          style={{
            position: 'absolute', top: BASELINE + 100, left: 0, width: '100%', textAlign: 'center',
            fontSize: 36, color: light ? '#1B1E22' : accent, fontFamily: 'A2Z Regular, sans-serif', letterSpacing: '0.02em',
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
