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
  // ── 스크린샷 모드 (§40-8) ──
  // B1M 은 기사를 **재조판하지 않는다.** WSJ 지면도 gov.uk 보도자료도 실제
  // 화면을 그대로 쓰고, 거기에 스캔라인·색수차를 얹어 "화면을 카메라로 찍은 것"
  // 처럼 만든다. 재조판이 더 깨끗하지만 **증거력은 원본 화면이 세다** —
  // 내가 다시 친 글자는 결국 내 글자고, 원본 화면은 그쪽 지면이다.
  //
  // shot     스크린샷 이미지 경로. 주면 본문 조판 대신 이 판을 쓴다
  // marks    형광펜 칠할 자리. [{x, y, w, h}] 를 0~1 비율로 (스크린샷 기준)
  // 한글 기사는 재조판 쪽이 읽기 쉬울 때가 많아 두 모드를 **둘 다 남긴다.**
  shot = '', marks = [],
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
  const COLW = 1180;
  const size = fit(body, 40, COLW * 5.2, 0.66);

  const column = (
    <div style={{width: COLW, opacity: fadeIn(frame, 6),
                 fontFamily: serif ? 'Myeongjo, Georgia, serif' : 'A2Z Regular, sans-serif',
                 fontSize: size, lineHeight: 1.66, color: TEXT,
                 wordBreak: 'keep-all', textAlign: 'left'}}>
      {parts.map((p, i) => {
        const isHL = p.startsWith('«') && p.endsWith('»');
        const txt = isHL ? p.slice(1, -1) : p;
        if (isHL) {
          return <Highlighter key={i} progress={hl} color={HL_YELLOW}>{txt}</Highlighter>;
        }
        return <span key={i} style={{opacity: fade}}>{txt}</span>;
      })}
    </div>
  );

  if (shot) {
    // 지면은 화면 가로의 76% 정도. 꽉 채우면 "웹페이지를 띄운 화면"이 되고,
    // 판으로 얹어야 "내가 가져온 자료"가 된다 (§40-2 와 같은 이유)
    const SW = 1460;
    return (
      <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: T.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{position: 'relative', width: SW, opacity: s,
                     transform: `translateY(${(1 - s) * 16}px) scale(${0.99 + s * 0.01})`,
                     boxShadow: '0 26px 80px rgba(0,0,0,0.42)'}}>
          <Img src={/^https?:/.test(shot) ? shot : staticFile(shot)}
               style={{width: '100%', display: 'block'}} />
          {/* 형광펜 — 원문 위 좌표로 찍는다. 왼쪽에서 오른쪽으로 차오른다 */}
          {marks.map((m, i) => (
            <div key={i} style={{position: 'absolute',
                                 left: `${m.x * 100}%`, top: `${m.y * 100}%`,
                                 width: `${m.w * 100 * Math.min(1, Math.max(0, hl * marks.length - i))}%`,
                                 height: `${m.h * 100}%`,
                                 background: HL_YELLOW, mixBlendMode: 'multiply'}} />
          ))}
          {/* 스캔라인 + 색수차 — "화면을 찍었다" 는 신호. 아주 약하게만 */}
          <div style={{position: 'absolute', inset: 0, pointerEvents: 'none',
                       background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0 1px,'
                                 + ' rgba(0,0,0,0) 1px 3px)'}} />
          <div style={{position: 'absolute', inset: 0, pointerEvents: 'none',
                       boxShadow: 'inset 0 0 120px 26px rgba(0,0,0,0.22)'}} />
        </div>
        {(outlet || date) ? (
          <div style={{position: 'absolute', left: 0, right: 0, top: 74, textAlign: 'center',
                       opacity: fadeIn(frame, 4),
                       fontFamily: 'A2Z Medium, sans-serif',
                       fontSize: 28, letterSpacing: '0.14em', color: T.ink}}>
            {[outlet, date].filter(Boolean).join('  ')}
          </div>
        ) : null}
        <PaperSource source={source} theme={theme} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: T.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {/* 판 — 화면을 거의 다 덮게 두면 **무대가 사라진다.** 실제로 그렇게 만들어
          놨더니 먹 테마가 30px 짜리 테두리로만 남아 렌더 오류처럼 보였고,
          우상단 `Source :` 가 흰 종이 위 회색이라 안 읽혔다.
          지면은 무대 위에 **떠 있는 한 장**이어야 한다 — 그래야 인용이라는 게
          읽히고, 남는 여백에 출처가 제자리를 찾는다.
          높이는 내용이 정한다. 고정하면 문단 짧은 컷에서 아래가 텅 빈다. */}
      <div style={{background: PAPER, padding: '84px 120px 92px',
                   opacity: s,
                   transform: `translateY(${(1 - s) * 16}px) scale(${0.992 + s * 0.008})`,
                   boxShadow: '0 26px 80px rgba(0,0,0,0.38)',
                   display: 'flex', flexDirection: 'column', alignItems: 'center',
                   maxHeight: CONTENT_BOTTOM - 40}}>
        {/* 매체 + 날짜 — 지면 맨 위 머리글 */}
        {(outlet || date) ? (
          <div style={{opacity: fadeIn(frame, 4), marginBottom: 54, textAlign: 'center',
                       fontFamily: 'A2Z Medium, sans-serif',
                       fontSize: 28, letterSpacing: '0.14em', color: TEXT,
                       paddingBottom: 18, borderBottom: `2px solid ${TEXT}`,
                       minWidth: 360}}>
            {[outlet, date].filter(Boolean).join('  ')}
          </div>
        ) : null}

        {hasPortrait ? (
          <div style={{display: 'flex', alignItems: 'center', gap: 64}}>
            {/* 발언자 — 흑백. 컬러면 인물이 기사보다 세진다 */}
            <div style={{width: 280, textAlign: 'center', opacity: fadeIn(frame, 8)}}>
              <Img src={/^https?:/.test(portrait) ? portrait : staticFile(portrait)}
                   style={{width: 280, height: 340, objectFit: 'cover',
                           filter: 'grayscale(1) contrast(1.05)'}} />
              {who ? (
                <div style={{marginTop: 16, fontFamily: 'A2Z Medium, sans-serif',
                             fontSize: 24, color: TEXT, wordBreak: 'keep-all'}}>{who}</div>
              ) : null}
              {role ? (
                <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif',
                             fontSize: 20, color: '#7A8089', wordBreak: 'keep-all'}}>{role}</div>
              ) : null}
            </div>
            {column}
          </div>
        ) : column}
      </div>

      {/* 출처는 채널 규칙대로 **우측 상단 · Source :**. 예전엔 이 카드만
          지면 하단에 넣어서 다른 카드와 자리가 달랐다 */}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
