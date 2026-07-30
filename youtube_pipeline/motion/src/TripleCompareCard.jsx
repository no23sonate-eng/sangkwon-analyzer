import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BG_STYLE, GridBg, TEXT, ACCENT} from './shared';

const PALETTE = ['#C98A9E', '#8FAD8B', '#7B9BC2'];

// 3자 비교 카드 — DataTable(세로 리스트)과 달리 세 개체를 나란히
// 세로 컬럼으로 배치해 "비교"가 한눈에 읽히게 한다(2026-07-30 "그래프는
// 기존이랑 동일하게 하지마" 피드백 — 표 반복 대신 나란히 컬럼 비교로).
// items: [{name, value, note, accent, image}] 최대 3개. image 를 주면
// 해당 컬럼 전체를 실사 배경으로 채우고(#25 "각 3개 지역 이미지를
// 뒷배경으로" 피드백) 텍스트는 받침 패널 위에 얹어 항상 읽히게 한다.
export const TripleCompareCard = ({title = '', items = [], source = '', accent = ACCENT}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {extrapolateRight: 'clamp'});

  const n = Math.min(items.length, 3) || 1;
  const COL_W = 420;
  const GAP = 70;
  const totalW = COL_W * n + GAP * (n - 1);
  const startX = (1920 - totalW) / 2;
  const COL_TOP = 340;
  const hasImages = items.some((it) => it.image);
  const imageOpacity = interpolate(frame, [0, 24], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={BG_STYLE}>
      {!hasImages ? <GridBg /> : null}

      {hasImages
        ? items.slice(0, 3).map((item, i) => {
            if (!item.image) return null;
            const x = startX + i * (COL_W + GAP) - GAP / 2;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute', top: 0, left: x, width: COL_W + GAP, height: 1080,
                  opacity: imageOpacity, overflow: 'hidden',
                }}
              >
                <Img src={staticFile(item.image)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                <div
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'linear-gradient(180deg, rgba(5,7,10,.68) 0%, rgba(5,7,10,.55) 45%, rgba(5,7,10,.88) 100%)',
                  }}
                />
              </div>
            );
          })
        : null}

      <div
        style={{
          position: 'absolute', top: 130, left: 0, width: '100%', textAlign: 'center',
          fontSize: 34, opacity: titleOpacity, ...TEXT.title,
        }}
      >
        {title}
      </div>

      {items.slice(0, 3).map((item, i) => {
        const x = startX + i * (COL_W + GAP);
        const delay = 18 + i * 12;
        const opacity = interpolate(frame, [delay, delay + 18], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
        const y = interpolate(frame, [delay, delay + 18], [16, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
        const color = item.accent || PALETTE[i % PALETTE.length];
        const labelColor = hasImages ? '#C7CBD3' : undefined;
        const valueColor = hasImages ? '#F4F6F9' : undefined;
        const noteColor = hasImages ? '#9CA3AC' : '#6B7078';
        return (
          <div key={i} style={{position: 'absolute', top: COL_TOP, left: x, width: COL_W, opacity, transform: `translateY(${y}px)`}}>
            {hasImages ? (
              <div
                style={{
                  position: 'absolute', top: -30, left: -20, width: COL_W + 40, height: 300,
                  borderRadius: 14, background: 'rgba(5,7,10,0.4)', backdropFilter: 'blur(1px)',
                }}
              />
            ) : null}
            <div style={{position: 'relative', width: 40, height: 4, background: color, margin: '0 auto 26px'}} />
            <div style={{position: 'relative', fontSize: 32, textAlign: 'center', marginBottom: 30, ...TEXT.label, ...(labelColor ? {color: labelColor} : {})}}>
              {item.name}
            </div>
            <div style={{position: 'relative', fontSize: 36, textAlign: 'center', lineHeight: 1.5, ...TEXT.value, ...(valueColor ? {color: valueColor} : {})}}>
              {item.value}
            </div>
            {item.note ? (
              <div style={{position: 'relative', fontSize: 26, textAlign: 'center', marginTop: 16, color: noteColor, fontFamily: 'A2Z Light, sans-serif'}}>
                {item.note}
              </div>
            ) : null}
          </div>
        );
      })}

      {n > 1 && !hasImages ? (
        <>
          {Array.from({length: n - 1}).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute', top: COL_TOP, left: startX + COL_W + GAP / 2 + i * (COL_W + GAP),
                width: 1, height: 340, background: 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </>
      ) : null}

      {source ? (
        <div
          style={{
            position: 'absolute', top: COL_TOP + 380, left: 0, width: '100%', textAlign: 'center',
            fontSize: 20, color: hasImages ? '#9CA3AC' : '#565C64', fontFamily: 'A2Z Light, sans-serif', fontStyle: 'italic',
            opacity: interpolate(frame, [50, 65], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          {source}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
