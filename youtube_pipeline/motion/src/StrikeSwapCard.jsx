import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, themeOf, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';
import {fit} from './layout';

// ── 값이 갈아치워지는 카드 ────────────────────────────────────────────────
// B1M 썸네일에서 가장 강한 한 장이 "~~30 HOURS~~ / 6 HOURS" 였다.
// 두 수치를 나란히 놓는 비교(SkylineCompare)와 **완전히 다른 동작**이다:
//   비교는 "둘 중 어느 쪽이 큰가" 를 묻고,
//   이건 "옛날 값은 죽었다" 를 선언한다. 취소선이 그 선언이다.
//
// 그래서 순서가 중요하다.
//   ① 옛 값이 먼저 혼자 서 있다 (관객이 읽을 시간을 준다)
//   ② 선이 **왼쪽에서 오른쪽으로** 그어진다 — 지우는 동작
//   ③ 새 값이 그 아래에서 올라온다
// 셋을 동시에 하면 그냥 "두 숫자" 가 된다.
//
// from/to : 문자열 그대로 쓴다 ('30시간' / '6시간'). 카운트업이 아니다 —
//           이건 시간이 흘러 값이 변한 게 아니라 **대체된** 것이다.
export const StrikeSwapCard = ({
  title = '', sub = '',
  from = '', fromLabel = '',
  to = '', toLabel = '',
  note = '', image = '',
  theme, align = 'center', source = '',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const center = align !== 'left';

  const READ = 26;                       // 옛 값을 읽는 시간
  const STRIKE = 16;                     // 선이 그어지는 시간
  const strike = interpolate(frame, [READ, READ + STRIKE], [0, 1],
                             {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const s2 = strike * strike * (3 - 2 * strike);
  const rise = interpolate(frame, [READ + STRIKE + 4, READ + STRIKE + 26], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const r2 = rise * rise * (3 - 2 * rise);

  const fromSize = fit(from, 96, 1300);
  const toSize = fit(to, 168, 1500);
  const top = title ? (sub ? 330 : 280) : 250;
  // 아래 한 줄(note)은 블록 바닥을 따라간다 — 자막 안전영역 안에서만
  const blockBot = top + fromSize * 1.62 + toSize * 1.05 + (toLabel ? 16 + 48 : 0);
  const noteTop = Math.min(CONTENT_BOTTOM - 44, blockBot + 40);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      {image ? (
        <div style={{position: 'absolute', inset: 0, opacity: 0.16}}>
          <Img src={/^https?:/.test(image) ? image : staticFile(image)}
               style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </div>
      ) : null}
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      {/* ① 옛 값 + ② 취소선.
          선을 SVG 로 따로 그었더니 estWidth 추정이 한글에서 25% 넘게 커서
          글자 끝을 120px 지나 뻗었다. 선을 **글자 안에** inline-block 자식으로
          넣으면 실제 글자 폭을 그대로 따라간다 — 추정이 필요 없다. */}
      <div style={{position: 'absolute', left: 0, right: 0, top,
                   textAlign: center ? 'center' : 'left',
                   paddingLeft: center ? 0 : 150,
                   opacity: fadeIn(frame, 2)}}>
        <div style={{position: 'relative', display: 'inline-block',
                     fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                     fontSize: fromSize, color: T.ink, opacity: 0.66, lineHeight: 1.1,
                     whiteSpace: 'nowrap', letterSpacing: '-0.02em'}}>
          {from}
          <div style={{position: 'absolute', left: -10, top: '52%',
                       width: `calc((100% + 20px) * ${s2})`, height: 7,
                       background: T.ink, opacity: 1}} />
        </div>
      </div>
      {fromLabel ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: top - 42,
                     textAlign: center ? 'center' : 'left',
                     paddingLeft: center ? 0 : 150, opacity: fadeIn(frame, 6),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 30, color: T.soft,
                     whiteSpace: 'nowrap'}}>
          {fromLabel}
        </div>
      ) : null}

      {/* ③ 새 값이 아래에서 올라온다.
          간격이 fromSize×1.24 였는데 옛 값 줄높이가 1.1 이라 **14px 밖에 안 남았다.**
          한글은 받침까지 꽉 차고 새 값은 옐로 배경까지 있어서, 두 줄이 서로
          물려 보였다 (#85 이지스↔교보AIM). 한 줄 높이만큼 확실히 띄운다. */}
      <div style={{position: 'absolute', left: 0, right: 0,
                   top: top + fromSize * 1.62,
                   textAlign: center ? 'center' : 'left',
                   paddingLeft: center ? 0 : 150,
                   opacity: r2, transform: `translateY(${(1 - r2) * 26}px)`}}>
        <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                     fontSize: toSize, color: T.ink, lineHeight: 1.05,
                     letterSpacing: '-0.03em', whiteSpace: 'nowrap'}}>
          <span style={{background: YELLOW, color: '#23262B', padding: '2px 20px 8px',
                        boxDecorationBreak: 'clone'}}>{to}</span>
        </div>
        {toLabel ? (
          <div style={{marginTop: 16,
                       fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                       fontSize: 48, color: T.ink, whiteSpace: 'nowrap',
                       letterSpacing: '-0.01em'}}>
            {toLabel}
          </div>
        ) : null}
      </div>

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 150,
                     top: noteTop, textAlign: center ? 'center' : 'left',
                     opacity: fadeIn(frame, READ + STRIKE + 30),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft,
                     wordBreak: 'keep-all'}}>
          {note}
        </div>
      ) : null}

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
