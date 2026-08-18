import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperSource, CONTENT_BOTTOM, fadeIn} from './paper';
import {Highlighter, HL_YELLOW} from './annotate';
import {fit} from './layout';

// ── 기사 발췌 판 ─────────────────────────────────────────────────────────
// B1M 이 근거를 댈 때 쓰는 판. (Chicago Sun-Times 2022-04-26 인용 프레임에서 그대로 읽었다)
//
//                  CHICAGO SUNTIMES APRIL 26TH, 2022      ← 매체+날짜. 대문자·볼드·작게·가운데
//   [흑백 인물]    ▒▒핵심 구절에 형광펜▒▒ 나머지 원문은 그대로 흐른다…
//    Dick Durbin   …원문이 계속된다. 읽으라고 준 게 아니다.
//  United States   …이만큼 있다는 것 자체가 "진짜 기사"라는 증거다.
//     Senator
//
// **내 기존 QuoteCard 와 결정적으로 다른 점**: 저건 인용구만 크게 뽑는다.
// 이건 **원문 덩어리를 통째로 놓고 그 안에서 형광펜으로 좁혀 들어간다.**
// 인용구만 뽑으면 "네가 고른 말"이지만, 원문을 놓고 칠하면 "기사에 그렇게 적혀 있다"가 된다.
// 신뢰가 거기서 갈린다. 부동산은 특히 그렇다.
//
// 순서가 곧 내용이다.
//   ① 판이 얹힌다 (아주 짧게 — 이건 주인공이 아니다)
//   ② 형광펜이 왼쪽에서 오른쪽으로 그어진다  ← 여기가 이 카드의 전부
//   ③ (dim) 칠하지 않은 문장이 흐려진다 — 칠한 데만 남는다
//
// body : 문단. 형광펜 칠할 구간은 **`«…»` 로 감싼다.**
//        "«핵심 구절» 나머지 원문" — 여러 군데 감싸도 된다.
export const ArticleCard = ({
  outlet = '', date = '',
  body = '',
  portrait = '', who = '', role = '',
  dim = true,                 // ③ 칠하지 않은 부분을 흐리게
  serif = true,               // 기사 원문은 세리프가 맞다. 보도자료·공문은 false
  theme, source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = themeOf(theme);

  // 종이 판은 늘 흰색이다. 크림 배경이든 먹 배경이든 **기사는 흰 종이 위에 있어야**
  // 인용이라는 게 읽힌다. 테마는 판 바깥(무대)에만 적용한다.
  const PAPER = '#FFFFFF';
  const TEXT = '#16181C';

  const s = spring({frame, fps, config: {damping: 200, mass: 0.6}});
  const HL_START = 22, HL_LEN = 40;
  const hl = interpolate(frame, [HL_START, HL_START + HL_LEN], [0, 1],
                         {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fade = dim
    ? interpolate(frame, [HL_START + HL_LEN + 8, HL_START + HL_LEN + 30], [1, 0.34],
                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 1;

  // «…» 로 감싼 구간만 형광펜. 나머지는 dim 대상.
  const parts = String(body).split(/(«[^»]*»)/g).filter((x) => x !== '');
  const hasPortrait = Boolean(portrait);
  // 본문 단 폭은 1180px 로 묶는다. 화면 폭을 다 쓰면 한 줄이 너무 길어 눈이 되돌아오지 못하고,
  // 무엇보다 **신문처럼 안 보인다** — 신문은 단이 좁다. B1M 도 화면의 절반 조금 넘게 쓴다.
  const PADX = 120;
  const COLW = 1180;
  const COLX = hasPortrait ? 470 : (1920 - COLW) / 2;
  const size = fit(body, 40, COLW * 5.2, 0.66);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: T.bg}}>
      {/* 판 — 화면을 거의 다 덮되 가장자리를 남겨 "얹힌 종이"로 읽히게 */}
      <div style={{position: 'absolute', left: 40, top: 40, right: 40, bottom: 40,
                   background: PAPER, opacity: s,
                   transform: `translateY(${(1 - s) * 14}px) scale(${0.995 + s * 0.005})`,
                   boxShadow: '0 18px 60px rgba(0,0,0,0.30)'}} />

      {/* 매체 + 날짜 */}
      {(outlet || date) ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 128, textAlign: 'center',
                     opacity: fadeIn(frame, 4),
                     fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                     fontSize: 30, letterSpacing: '0.04em', color: TEXT}}>
          {[outlet, date].filter(Boolean).join('  ')}
        </div>
      ) : null}

      {/* 발언자 — 흑백. 컬러면 인물이 기사보다 세진다 */}
      {hasPortrait ? (
        <div style={{position: 'absolute', left: PADX, top: 210, width: 280,
                     textAlign: 'center', opacity: fadeIn(frame, 8)}}>
          <Img src={/^https?:/.test(portrait) ? portrait : staticFile(portrait)}
               style={{width: 280, height: 340, objectFit: 'cover',
                       filter: 'grayscale(1) contrast(1.05)'}} />
          {who ? (
            <div style={{marginTop: 16, fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                         fontSize: 26, color: TEXT, wordBreak: 'keep-all'}}>{who}</div>
          ) : null}
          {role ? (
            <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: 22, color: '#7A8089', wordBreak: 'keep-all'}}>{role}</div>
          ) : null}
        </div>
      ) : null}

      {/* 원문 — 통째로 놓는다 */}
      <div style={{position: 'absolute', left: COLX, top: 196, width: COLW,
                   height: CONTENT_BOTTOM - 150,
                   display: 'flex', alignItems: 'center',
                   opacity: fadeIn(frame, 6),
                   fontFamily: serif
                     ? 'Myeongjo, Georgia, serif'
                     : 'A2Z Regular, sans-serif',
                   fontSize: size, lineHeight: 1.66, color: TEXT,
                   wordBreak: 'keep-all', textAlign: 'left'}}>
        <div>
        {parts.map((p, i) => {
          const isHL = p.startsWith('«') && p.endsWith('»');
          const txt = isHL ? p.slice(1, -1) : p;
          if (isHL) {
            return <Highlighter key={i} progress={hl} color={HL_YELLOW}>{txt}</Highlighter>;
          }
          return <span key={i} style={{opacity: fade}}>{txt}</span>;
        })}
        </div>
      </div>

      {/* 출처는 채널 규칙대로 **우측 상단 · Source :**. 예전엔 이 카드만
          지면 하단에 넣어서 다른 카드와 자리가 달랐다 */}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
