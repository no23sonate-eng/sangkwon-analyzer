import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, SP} from './paper';

// ── 대형 타이포 헤드라인 ──────────────────────────────────────────────────
// 문장 일부만 강조해서 한 줄로 못을 박는 카드.
//
// **종이 시스템으로 옮긴 카드다.** 원래는 v2(먹 배경 + 옐로 발광 + 원근 바닥)
// 였는데, 한 영상 안에서 종이 카드와 번갈아 나오니 두 채널을 이어 붙인 것처럼
// 보였다. 실제로 더그랜드롯데 편 182컷 중 76컷이 v2 계열이었다.
//
// 옮기면서 바꾼 것:
//   발광(textShadow) → **형광펜 띠.** 발광은 어두운 바탕에서만 성립한다.
//                      크림 종이 위에서는 글자가 번져 흐릿해 보이기만 한다.
//   원근 바닥        → 종이 격자. 바닥 그리드는 먹 배경의 장치였다
//   흰 글자          → T.ink. 테마가 바뀌면 같이 따라간다
//
// lines: [[{t: '소득 ', hot: false}, {t: '전국 1위', hot: true}], [...]]
export const YHeadlineCard = ({
  kicker = '', sub = '', lines = [], caption = '',
  bgImage = '',                 // 실사를 뒤에 깔 때 (베일은 PaperBg 가 씌운다)
  floor = true,                 // (옛 인자 — 종이에서는 격자가 그 역할이라 무시한다)
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = themeOf(theme);
  const enter = fadeIn(frame, 0, 14);

  const n = lines.length || 1;
  // 줄 길이에 맞춰 자동 축소 — 한 줄이 화면을 넘어 어중간하게 꺾이지 않게
  const maxLen = Math.max(1, ...lines.map((segs) => segs.reduce((a, s) => a + s.t.length, 0)));
  const fontSize = Math.min(n > 2 ? 108 : 142, Math.floor(1560 / maxLen));
  const totalH = n * fontSize * 1.3;
  const capH = caption ? 78 : 0;
  // 제목 덩어리를 본문 영역 한가운데에. 예전엔 470 고정이라 자막 안전선을
  // 모르고 있었고, 캡션이 붙으면 아래가 눌렸다
  const top = Math.max(kicker ? 250 : 190, (CONTENT_BOTTOM - totalH - capH) / 2);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Medium, sans-serif'}}>
      <PaperBg theme={theme} backdrop={bgImage} veil={0.9} {...bg} />

      {kicker ? (
        <div style={{position: 'absolute', left: 120, top: 150, opacity: enter}}>
          <div style={{display: 'flex', alignItems: 'center', gap: SP.NEAR}}>
            <div style={{width: 46, height: 5, background: YELLOW}} />
            <span style={{fontFamily: 'A2Z Medium, sans-serif',
                          fontSize: 34, letterSpacing: '0.06em', color: T.ink,
                          wordBreak: 'keep-all'}}>{kicker}</span>
          </div>
          {sub ? (
            <div style={{marginTop: SP.TIGHT, marginLeft: 66,
                         fontFamily: 'A2Z Light, sans-serif', fontSize: 28,
                         color: T.soft, wordBreak: 'keep-all'}}>{sub}</div>
          ) : null}
        </div>
      ) : null}

      <div style={{position: 'absolute', top, left: 120, width: 1680}}>
        {lines.map((segs, i) => {
          const slide = spring({frame: frame - 8 - i * 9, fps,
                                config: {damping: 200}, durationInFrames: 24});
          return (
            <div key={i} style={{fontSize, lineHeight: 1.3, letterSpacing: '0.01em',
                                 opacity: slide, transform: `translateY(${(1 - slide) * 42}px)`,
                                 wordBreak: 'keep-all'}}>
              {segs.map((s, j) => {
                if (!s.hot) return <span key={j} style={{color: T.ink}}>{s.t}</span>;
                // 형광펜은 글자보다 **늦게** 그어진다. 같이 나오면 그냥 노란
                // 글자로 읽히고, 뒤늦게 그어져야 "여기다" 라는 손짓이 된다
                const p = Math.max(0, Math.min(1, (frame - (16 + i * 9)) / 16));
                return (
                  <span key={j} style={{
                    color: T.ink,
                    background: `linear-gradient(90deg, ${YELLOW} 0 100%)`,
                    backgroundSize: `${p * 100}% 100%`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: '0 100%',
                    boxDecorationBreak: 'clone',
                    WebkitBoxDecorationBreak: 'clone',
                    padding: '0.04em 0.06em',
                  }}>{s.t}</span>
                );
              })}
            </div>
          );
        })}
        {caption ? (
          <div style={{marginTop: SP.GAP, fontFamily: 'A2Z Light, sans-serif',
                       fontSize: 34, letterSpacing: '0.04em', color: T.soft,
                       opacity: fadeIn(frame, 8 + n * 9 + 10), wordBreak: 'keep-all'}}>
            {caption}
          </div>
        ) : null}
      </div>

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
