import React from 'react';
import {AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {YELLOW, fadeIn, PaperSource} from './paper';
import {estWidth} from './layout';

// ── 전후 와이프 ──────────────────────────────────────────────────────────
// 부동산 영상에서 가장 강한 한 컷은 **같은 프레임의 전/후**다. 두 장을 좌우로
// 나란히 놓으면 "다른 사진 두 장"이지만, 한 화면을 손잡이가 훑고 지나가면
// **같은 자리가 바뀐 것**이 된다. 정보량은 같은데 체감이 다르다.
//
// 규칙
//  - 손잡이는 **한 번에 끝까지 가지 않는다.** 60% 에서 잠깐 멈췄다가 마저 간다.
//    멈추는 순간이 있어야 눈이 비교를 한다.
//  - 라벨은 손잡이를 따라다니지 않고 **양쪽 끝에 고정**한다. 따라다니면 읽을 수 없다.
//  - 두 장의 화각이 다르면 이 문법은 거짓말이 된다. `align` 으로 한쪽만 미세 보정하고,
//    그래도 안 맞으면 이 카드를 쓰지 않는다.
const SHADOW = '0 3px 20px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6)';

export const BeforeAfterCard = ({
  before = '', after = '',
  beforeLabel = '이전', afterLabel = '이후',
  beforeNote = '', afterNote = '',
  headline = '',
  align = {x: 0, y: 0, zoom: 1},   // after 만 미세 보정 (px, px, 배율)
  startSec = 0.6,                  // before 를 먼저 보여 주는 시간
  pauseAt = 0.6,                   // 손잡이가 멈추는 지점 (0~1)
  source = '', theme,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();

  // 손잡이 진행: [대기] → 0→pauseAt → [정지] → pauseAt→1
  const s = Math.round(startSec * 30);
  const p = interpolate(frame, [s, s + 40, s + 62, s + 96], [0, pauseAt, pauseAt, 1],
                        {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // 손잡이는 **오른쪽에서 왼쪽으로** 지나간다.
  // 화면은 '이전' 으로 시작하고 '이후' 가 오른쪽에서 밀고 들어온다 —
  // 그래야 왼쪽=이전 / 오른쪽=이후 라는 읽기 순서가 라벨과 맞는다.
  const X = 1920 * (1 - p);

  const kb = interpolate(frame, [0, 300], [1.0, 1.05], {extrapolateRight: 'clamp'});
  const imgStyle = (extra) => ({
    position: 'absolute', left: 0, top: 0, width: 1920, height: 1080,
    objectFit: 'cover', ...extra,
  });

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: '#0b0e12', overflow: 'hidden'}}>
      {/* 바닥에 '이전' 을 깔고, '이후' 를 손잡이 오른쪽만 남겨 덮는다 */}
      <Img src={staticFile(before)} style={imgStyle({transform: `scale(${kb})`})} />
      <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${X}px)`}}>
        <Img src={staticFile(after)}
             style={imgStyle({transform: `translate(${align.x || 0}px, ${align.y || 0}px) scale(${kb * (align.zoom || 1)})`})} />
      </div>

      {/* 손잡이 — 선 + 가운데 그립 */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <line x1={X} y1={0} x2={X} y2={1080} stroke="#FFFFFF" strokeWidth={4} opacity={0.95} />
        <circle cx={X} cy={540} r={30} fill={YELLOW} stroke="#12151a" strokeWidth={3} />
        <polygon points={`${X - 10},${540} ${X - 2},${534} ${X - 2},${546}`} fill="#12151a" />
        <polygon points={`${X + 10},${540} ${X + 2},${534} ${X + 2},${546}`} fill="#12151a" />
      </svg>

      <div style={{position: 'absolute', inset: 0,
                   background: 'linear-gradient(180deg, rgba(11,14,18,0.5) 0%, rgba(11,14,18,0) 24%, '
                             + 'rgba(11,14,18,0) 62%, rgba(11,14,18,0.6) 100%)'}} />

      {/* 라벨 — 양쪽 끝에 고정. 손잡이가 지나가면 그쪽 라벨이 흐려진다 */}
      {[[beforeLabel, beforeNote, 'left', 1 - Math.max(0, (p - 0.62) / 0.38)],
        [afterLabel, afterNote, 'right', Math.min(1, p / 0.25)]].map(([lb, nt, side, o], i) => (
        <div key={i} style={{position: 'absolute', top: 132, [side]: 84, textAlign: side,
                             opacity: Math.max(0.18, o) * fadeIn(frame, 6)}}>
          <div style={{display: 'inline-block',
                       fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 54,
                       color: '#FFFFFF', textShadow: SHADOW, letterSpacing: '0.02em'}}>
            {lb}
          </div>
          {nt ? (
            <div style={{marginTop: 8, fontFamily: 'A2Z Light, sans-serif', fontSize: 32,
                         color: '#E4E8EE', textShadow: SHADOW}}>{nt}</div>
          ) : null}
        </div>
      ))}

      {headline ? (
        <div style={{position: 'absolute', left: 160, width: 1600, top: 660, textAlign: 'center',
                     opacity: fadeIn(frame, 70)}}>
          <span style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 60,
                        color: '#12151a', background: YELLOW, padding: '8px 22px',
                        boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
                        wordBreak: 'keep-all'}}>
            {headline}
          </span>
        </div>
      ) : null}

      {/* 출처는 우측 **상단** · `Source : …` — 채널 규칙.
          사진 카드만 하단에 있어서 컷이 넘어갈 때마다 출처가 위아래로
          튀었다 */}
      <PaperSource source={source} theme={theme} onPhoto />
    </AbsoluteFill>
  );
};
