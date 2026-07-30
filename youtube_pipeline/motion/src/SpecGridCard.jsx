import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, MediaBg} from './shared';

// 스펙시트형 카드 — DataTable(세로 리스트 표)과는 다른 리듬을 주기 위한
// 2x2(또는 그 이하) 그리드 배치(2026-07-30 "그래프는 기존이랑 동일하게
// 하지마" 피드백 — 표 반복 대신 쿼드런트 스펙시트로). items: [{label,
// value, note}] 최대 4개. 십자 구분선으로 4분할, 각 칸은 라벨 위·값 아래.
export const SpecGridCard = ({title = '', items = [], source = '', bgImage = '', bgVideo = ''}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});
  // 배경 실사(#30 "하남 관련 이미지" 피드백)일 때는 글자를 더 희고
  // 약간 크게 올려 사진 위에서도 또렷하게 읽히게 한다.
  const hasMedia = Boolean(bgImage || bgVideo);
  const labelColor = hasMedia ? '#E4E7EC' : undefined;
  const valueColor = hasMedia ? '#FFFFFF' : undefined;
  const noteColor = hasMedia ? '#D3D7DD' : '#8A9099';

  const GRID_TOP = 300;
  const GRID_W = 1240;
  const GRID_H = 480;
  const COLS = 2;
  const cellW = GRID_W / COLS;
  const cellH = GRID_H / Math.ceil((items.length || 1) / COLS);
  const left = (1920 - GRID_W) / 2;

  return (
    <AbsoluteFill style={BG_STYLE}>
      {hasMedia ? <MediaBg video={bgVideo} image={bgImage} /> : <GridBg />}

      <div
        style={{
          position: 'absolute', top: 130, left: 0, width: '100%', textAlign: 'center',
          fontSize: hasMedia ? 36 : 34, opacity: titleOpacity, ...TEXT.title,
          ...(hasMedia ? {color: '#F2F4F7'} : {}),
        }}
      >
        {title}
      </div>

      <div style={{position: 'absolute', top: GRID_TOP, left, width: GRID_W, height: GRID_H}}>
        {/* 십자 구분선 */}
        <div style={{position: 'absolute', top: 0, left: cellW, width: 1, height: GRID_H, background: hasMedia ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}} />
        <div style={{position: 'absolute', top: cellH, left: 0, width: GRID_W, height: 1, background: hasMedia ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}} />

        {items.slice(0, 4).map((item, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const delay = 15 + i * 10;
          const opacity = interpolate(frame, [delay, delay + 16], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
          const y = interpolate(frame, [delay, delay + 16], [14, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
          return (
            <div
              key={i}
              style={{
                position: 'absolute', top: row * cellH, left: col * cellW, width: cellW, height: cellH,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                opacity, transform: `translateY(${y}px)`,
              }}
            >
              <div style={{fontSize: hasMedia ? 30 : 28, marginBottom: 18, ...TEXT.label, ...(labelColor ? {color: labelColor} : {})}}>{item.label}</div>
              <div style={{fontSize: hasMedia ? 48 : 44, ...TEXT.value, textAlign: 'center', ...(valueColor ? {color: valueColor} : {})}}>{item.value}</div>
              {item.note ? (
                <div style={{fontSize: 26, marginTop: 10, color: noteColor, fontFamily: 'A2Z Light, sans-serif'}}>
                  {item.note}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {source ? (
        <div
          style={{
            position: 'absolute', top: GRID_TOP + GRID_H + 30, left, fontSize: 20, color: hasMedia ? '#B9Bec6' : '#565C64',
            fontFamily: 'A2Z Light, sans-serif', fontStyle: 'italic',
            opacity: interpolate(frame, [50, 65], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          {source}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
