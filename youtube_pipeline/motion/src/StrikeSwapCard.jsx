import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, themeOf, YELLOW, CONTENT_BOTTOM, fadeIn, stageTop, titleH, LW} from './paper';
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

  const fromSize = fit(from, 82, 1200);
  // 새 값이 너무 커서 화면을 다 먹었다 (검수 지적) — 한 단 줄인다
  const toSize = fit(to, 104, 1240);
  const ARROW_H = 118;
  const headH = titleH(title, sub);
  const bodyH = fromSize * 1.35 + ARROW_H + toSize * 1.05
    + (toLabel ? 16 + 48 : 0) + (note ? 72 + 44 : 0);
  // 제목·교체·주석을 한 덩어리로 보고 화면 가운데. 예전엔 제목을 위에
  // 못 박고 본문을 그 밑에 붙여서 아래가 통째로 비었다
  const stackY = stageTop(headH + (title ? 56 : 0) + bodyH, {top: 140});
  const top = stackY + headH + (title ? 56 : 0);
  // 아래 한 줄(note)은 블록 바닥을 따라간다 — 자막 안전영역 안에서만
  // 옛 값 → 화살표 → 새 값. 화살표가 들어갈 자리를 사이에 확보한다
  const toTop = top + fromSize * 1.35 + ARROW_H;
  const blockBot = toTop + toSize * 1.05 + (toLabel ? 16 + 48 : 0);
  // 아래 한 줄(금액)은 블록에서 더 떼어 놓는다 — 붙어 있으면 새 값의 일부로 읽힌다
  const noteTop = Math.min(CONTENT_BOTTOM - 40, blockBot + 72);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      {image ? (
        <div style={{position: 'absolute', inset: 0, opacity: 0.16}}>
          <Img src={/^https?:/.test(image) ? image : staticFile(image)}
               style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </div>
      ) : null}
      <PaperTitle title={title} sub={sub} theme={theme} align={align} top={stackY} />

      {/* ① 옛 값 + ② 취소선.
          선을 SVG 로 따로 그었더니 estWidth 추정이 한글에서 25% 넘게 커서
          글자 끝을 120px 지나 뻗었다. 선을 **글자 안에** inline-block 자식으로
          넣으면 실제 글자 폭을 그대로 따라간다 — 추정이 필요 없다. */}
      <div style={{position: 'absolute', left: 0, right: 0, top,
                   textAlign: center ? 'center' : 'left',
                   paddingLeft: center ? 0 : 150,
                   opacity: fadeIn(frame, 2)}}>
        <div style={{position: 'relative', display: 'inline-block',
                     fontFamily: 'A2Z Medium, sans-serif',
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
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: T.soft,
                     whiteSpace: 'nowrap'}}>
          {fromLabel}
        </div>
      ) : null}

      {/* ②-b 갈아치운다는 걸 화살표로 못 박는다. 취소선만으론 '지웠다' 까지고
          '이걸로 바뀌었다' 가 안 남는다 (검수 지적 #85) */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <g opacity={s2 > 0.9 ? fadeIn(frame, READ + STRIKE + 2) : 0}>
          <line x1={center ? 960 : 190} y1={top + fromSize * 1.35 + 12}
                x2={center ? 960 : 190} y2={top + fromSize * 1.35 + ARROW_H - 40}
                stroke={T.ink} strokeWidth={LW.BOLD} opacity={0.75} />
          <path d={`M ${(center ? 960 : 190) - 20} ${top + fromSize * 1.35 + ARROW_H - 50}
                    L ${center ? 960 : 190} ${top + fromSize * 1.35 + ARROW_H - 20}
                    L ${(center ? 960 : 190) + 20} ${top + fromSize * 1.35 + ARROW_H - 50} Z`}
                fill={T.ink} opacity={0.75} />
        </g>
      </svg>

      {/* ③ 새 값이 아래에서 올라온다.
          간격이 fromSize×1.24 였는데 옛 값 줄높이가 1.1 이라 **14px 밖에 안 남았다.**
          한글은 받침까지 꽉 차고 새 값은 옐로 배경까지 있어서, 두 줄이 서로
          물려 보였다 (#85 이지스↔교보AIM). 한 줄 높이만큼 확실히 띄운다. */}
      <div style={{position: 'absolute', left: 0, right: 0,
                   top: toTop,
                   textAlign: center ? 'center' : 'left',
                   paddingLeft: center ? 0 : 150,
                   opacity: r2, transform: `translateY(${(1 - r2) * 26}px)`}}>
        <div style={{fontFamily: 'A2Z Medium, sans-serif',
                     fontSize: toSize, color: T.ink, lineHeight: 1.05,
                     letterSpacing: '-0.03em', whiteSpace: 'nowrap'}}>
          <span style={{background: YELLOW, color: '#23262B', padding: '0 12px 4px',
                        boxDecorationBreak: 'clone'}}>{to}</span>
        </div>
        {toLabel ? (
          <div style={{marginTop: 16,
                       fontFamily: 'A2Z Medium, sans-serif',
                       fontSize: 46, color: T.ink, whiteSpace: 'nowrap',
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
