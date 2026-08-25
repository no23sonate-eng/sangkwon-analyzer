import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';

// [테스트] 기사 헤드라인 카드 — B1M "NYT 헤드라인을 B-roll 위에 얹는" 문법.
// 웹페이지를 스크롤하지 않고, 헤드라인만 뽑아 실사 위에 얹는다.
// 화면 글자 수가 줄고 훨씬 시네마틱. accent 구문만 옐로.
// props: outlet, headline[{t, hot}], date, image(motion/public 상대경로)
const YELLOW = '#FAFF2E';

export const NewsQuoteCard = ({
  outlet = '',
  headline = [],
  date = '',
  image = '',
  durationSec = 8,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 아주 느린 푸시인 — 정지 화면 느낌을 없애되 과하지 않게
  const zoom = interpolate(frame, [0, durationSec * fps], [1.0, 1.07], {extrapolateRight: 'clamp'});
  const ease = (t) => Math.max(0, Math.min(1, t)) ** 2 * (3 - 2 * Math.max(0, Math.min(1, t)));
  const oOutlet = ease((frame - 6) / 16);
  const rise = spring({frame: frame - 14, fps, config: {damping: 200}, durationInFrames: 26});

  return (
    <AbsoluteFill style={{background: '#0A0A0A', fontFamily: 'A2Z Regular, sans-serif'}}>
      {image ? (
        <Img src={staticFile(image)}
             style={{position: 'absolute', width: '100%', height: '100%', objectFit: 'cover',
                     transform: `scale(${zoom})`, filter: 'grayscale(0.35)'}} />
      ) : null}
      {/* 좌측에서 오는 어두운 그라디언트 — 글자가 앉을 자리 */}
      <div style={{position: 'absolute', inset: 0,
                   background: 'linear-gradient(100deg, rgba(8,9,11,0.92) 0%, rgba(8,9,11,0.86) 42%, rgba(8,9,11,0.35) 72%, rgba(8,9,11,0.15) 100%)'}} />

      <div style={{position: 'absolute', left: 130, top: 300, width: 1180}}>
        {/* 매체명 + 날짜 */}
        <div style={{display: 'flex', alignItems: 'center', gap: 20, opacity: oOutlet, marginBottom: 30}}>
          <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 38, color: '#FFFFFF', letterSpacing: '0.02em'}}>
            {outlet}
          </span>
          <span style={{width: 1, height: 30, background: 'rgba(255,255,255,0.35)'}} />
          <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 30, color: '#B9BFC9', letterSpacing: '0.04em'}}>
            {date}
          </span>
        </div>
        {/* 헤드라인 — 줄 단위로 아래에서 올라옴 */}
        {headline.map((line, i) => {
          const r = spring({frame: frame - 16 - i * 7, fps, config: {damping: 200}, durationInFrames: 28});
          return (
            <div key={i} style={{opacity: r, transform: `translateY(${(1 - r) * 22}px)`,
                                 fontFamily: 'A2Z Medium, sans-serif', fontSize: 66,
                                 lineHeight: 1.42, letterSpacing: '-0.01em', wordBreak: 'keep-all'}}>
              {line.map((seg, j) => (
                <span key={j} style={{color: seg.hot ? YELLOW : '#FFFFFF',
                                      textShadow: '0 2px 20px rgba(0,0,0,0.6)'}}>
                  {seg.t}
                </span>
              ))}
            </div>
          );
        })}
        {/* 밑줄 — 헤드라인 등장 후 좌→우로 그어진다 */}
        <div style={{marginTop: 34, height: 3, background: YELLOW, opacity: 0.9,
                     width: `${rise * 210}px`, boxShadow: '0 0 14px rgba(250,255,46,0.4)'}} />
      </div>
    </AbsoluteFill>
  );
};
