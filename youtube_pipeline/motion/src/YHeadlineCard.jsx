import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, GRAY, M, T, Canvas, Kicker, fadeIn, useDrift} from './v2shared';
import {Wipe, stagger} from './anim';

// 대형 타이포 헤드라인 (v3).
// 개선점: 글자 발광 제거(옐로는 색으로만 강조), 줄 단위 마스크 와이프로
// "닦여 나오는" 등장, 강조 단어 아래 얇은 옐로 규칙선, 실사 배경엔
// 느린 줌 드리프트로 정지 화면을 없앰.
export const YHeadlineCard = ({
  kicker = '',
  sub = '',
  lines = [],
  caption = '',
  bgImage = '',
  floor = true, // 하위 호환 — 무시(캔버스가 질감 담당)
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const drift = useDrift(7, 600);
  const enter = fadeIn(frame, 0, 14);

  const n = lines.length || 1;
  const maxLen = Math.max(1, ...lines.map((segs) => segs.reduce((a, s) => a + s.t.length, 0)));
  const fontSize = Math.min(n > 2 ? 108 : 146, Math.floor(1560 / maxLen));
  const lh = fontSize * 1.26;
  const blockH = n * lh;
  const top = 470 - blockH / 2;

  return (
    <AbsoluteFill style={{background: BLACK}}>
      {bgImage ? (
        <>
          <Img
            src={staticFile(bgImage)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              transform: `scale(${1.06 + (drift.scale - 1) * 8}) translate(${drift.x * 0.4}px, ${drift.y * 0.4}px)`,
            }}
          />
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,9,11,.84) 0%, rgba(8,9,11,.55) 45%, rgba(8,9,11,.92) 100%)'}} />
        </>
      ) : (
        <Canvas />
      )}

      {kicker ? <Kicker title={kicker} sub={sub} opacity={enter} /> : null}

      <div style={{position: 'absolute', top, left: M, width: 1920 - M * 2}}>
        {lines.map((segs, i) => (
          <Wipe key={i} start={stagger(i, 8, 6)} dur={30} dir="left" style={{height: lh}}>
            <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize, lineHeight: `${lh}px`, letterSpacing: '-0.015em'}}>
              {segs.map((s, j) => (
                <span key={j} style={{color: s.hot ? YELLOW : WHITE, position: 'relative'}}>
                  {s.t}
                </span>
              ))}
            </div>
          </Wipe>
        ))}
        {caption ? (
          <div style={{marginTop: 40, opacity: fadeIn(frame, 6 + n * 8 + 14)}}>
            <div style={{...T.body, fontSize: 36, color: GRAY}}>{caption}</div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
