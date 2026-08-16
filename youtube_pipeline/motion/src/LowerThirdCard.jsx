import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, staticFile, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {YELLOW, fadeIn} from './paper';
import {fit, estWidth} from './layout';

// ── 실사 위에 얹는 번호 + 문구 ──────────────────────────────────────────
// "첫 번째, 경쟁자가 없었습니다" 같은 **열거형 문장**이 이 영상에 계속 나온다.
// 지금까지는 이런 컷을 종이 카드로 만들거나 실사만 틀었는데, 둘 다 아깝다 —
// 종이 카드로 만들면 화면이 또 베이지가 되고, 실사만 틀면 몇 번째인지가 안 남는다.
//
// 그래서 **실사(사진·영상)를 화면 전체로 깔고 그 위에 번호와 문구만** 얹는다.
// 방송 자막(lower third)의 문법이지만 위치는 가운데 아래 셋째 지점이 아니라
// **가운데**다 — 유튜브는 하단 260px 이 자막·컨트롤에 먹히기 때문이다.
//
// 번호를 큰 옐로 숫자로 두는 이유: 열거라는 걸 글자보다 숫자가 먼저 말한다.
// num 을 비우면 그냥 문구만 나온다 (질문 컷·전환 컷에 쓴다).
//
// media : jpg/png 면 사진, mp4 면 영상. 확장자로 자동 판별
// tone  : 'dark' 면 어둡게 눌러 흰 글씨, 'light' 면 밝게 눌러 검은 글씨
const isVid = (s) => /\.(mp4|webm|mov)(\?|$)/i.test(String(s));

export const LowerThirdCard = ({
  media = '', num = '', label = '', sub = '',
  tone = 'dark', scrim = 0.5, align = 'center',
  kicker = '',                 // 번호 대신 쓰는 짧은 말머리 ("결론", "정리")
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const dark = tone !== 'light';
  const fg = dark ? '#FFFFFF' : '#1B1E24';

  // 아주 느린 푸시인 — 멎지 않게. 이징 없이 등속 (§32-5)
  const k = 1.04 + (frame / 150) * 0.03;
  const src = media ? (/^https?:/.test(media) ? media : staticFile(media)) : '';
  const box = {position: 'absolute', left: '50%', top: '50%', width: 1920, height: 1080,
               objectFit: 'cover',
               transform: `translate(-50%,-50%) scale(${k})`};

  const numIn = interpolate(frame, [4, 22], [0, 1],
                            {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const labSize = fit(label, 78, 1500);
  const left = align === 'left';

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: dark ? '#0B0E12' : '#EFEAE3'}}>
      {src ? (
        <AbsoluteFill style={{overflow: 'hidden'}}>
          {isVid(src) ? <OffthreadVideo src={src} muted style={box} />
                      : <Img src={src} style={box} />}
        </AbsoluteFill>
      ) : null}

      {/* 스크림 — 가운데를 더 눌러 글씨가 앉을 자리를 만든다.
          전면을 균일하게 덮으면 사진이 죽고, 안 덮으면 글씨가 안 읽힌다 */}
      <AbsoluteFill style={{background: dark
        ? `radial-gradient(120% 78% at 50% 50%, rgba(0,0,0,${scrim + 0.16}) 0%, rgba(0,0,0,${scrim * 0.55}) 62%, rgba(0,0,0,${scrim * 0.3}) 100%)`
        : `radial-gradient(120% 78% at 50% 50%, rgba(255,255,255,${scrim + 0.22}) 0%, rgba(255,255,255,${scrim * 0.6}) 62%, rgba(255,255,255,${scrim * 0.3}) 100%)`}} />

      <AbsoluteFill style={{display: 'flex', flexDirection: 'column',
                            alignItems: left ? 'flex-start' : 'center',
                            justifyContent: 'center',
                            padding: left ? '0 0 90px 150px' : '0 150px 90px',
                            textAlign: left ? 'left' : 'center'}}>
        {num ? (
          <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                       fontSize: 128, lineHeight: 1, color: YELLOW,
                       letterSpacing: '-0.03em',
                       opacity: numIn,
                       transform: `translateY(${(1 - numIn) * 16}px)`,
                       textShadow: dark ? '0 4px 30px rgba(0,0,0,0.55)' : 'none',
                       WebkitTextStroke: dark ? '0' : '2px #1B1E24'}}>
            {num}
          </div>
        ) : kicker ? (
          <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 30,
                       letterSpacing: '0.22em', color: YELLOW, opacity: numIn,
                       marginBottom: 14}}>
            {kicker}
          </div>
        ) : null}

        {label ? (
          <div style={{marginTop: num ? 18 : 0,
                       fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                       fontSize: labSize, lineHeight: 1.2, color: fg,
                       letterSpacing: '-0.015em', wordBreak: 'keep-all',
                       maxWidth: 1560,
                       opacity: fadeIn(frame, num || kicker ? 16 : 6),
                       textShadow: dark ? '0 3px 24px rgba(0,0,0,0.6)'
                                        : '0 2px 14px rgba(255,255,255,0.7)'}}>
            {label}
          </div>
        ) : null}

        {sub ? (
          <div style={{marginTop: 20, fontFamily: 'A2Z Light, sans-serif',
                       fontSize: 36, lineHeight: 1.4,
                       color: dark ? 'rgba(255,255,255,0.82)' : 'rgba(27,30,36,0.72)',
                       wordBreak: 'keep-all', maxWidth: 1400,
                       opacity: fadeIn(frame, 30),
                       textShadow: dark ? '0 2px 16px rgba(0,0,0,0.6)' : 'none'}}>
            {sub}
          </div>
        ) : null}
      </AbsoluteFill>

      {/* 출처는 채널 규칙대로 **우측 위 · Source :** (paper.jsx PaperSource 와 같은 자리) */}
      {source ? (
        <div style={{position: 'absolute', right: 44, top: 34, textAlign: 'right', maxWidth: 760,
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 23, letterSpacing: '0.04em',
                     lineHeight: 1.3, color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(27,30,36,0.55)',
                     opacity: fadeIn(frame, 40), wordBreak: 'keep-all'}}>
          {/^\s*source\s*:/i.test(source) ? source : `Source : ${source}`}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
