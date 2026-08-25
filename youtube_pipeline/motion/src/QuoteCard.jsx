import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperSource, YELLOW, CONTENT_BOTTOM, SP} from './paper';

// ── 인용구 ────────────────────────────────────────────────────────────────
// **말한 사람이 있는 문장**에 쓴다. 기사 본문을 놓고 형광펜을 긋는 건
// ArticleCard, 기사 제목만 옮기는 건 NewsHeadlineCard.
//
// **종이 시스템으로 옮긴 카드다.** (원래 `shared` 먹 배경)
// 인용문은 흰 종이 판 위에 올린다 — 무대에 바로 적으면 내가 쓴 말인지
// 남이 한 말인지 구분이 안 간다. 사진은 판 오른쪽에 걸치되 흑백으로
// 눌러 둔다. 컬러면 인물이 말보다 세진다.
//
// quote2 — 같은 사람의 두 번째 말. 절반 지점에서 넘어간다
export const QuoteCard = ({
  quote = '', quote2 = '', name = '', role = '', photo = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const T = themeOf(theme);
  const PAPER = '#FFFFFF', TEXT = '#16181C';

  const mark = interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  const qo = interpolate(frame, [10, 26], [0, 1], {extrapolateRight: 'clamp'});
  const qy = interpolate(frame, [10, 26], [14, 0], {extrapolateRight: 'clamp'});
  const attr = interpolate(frame, [30, 42], [0, 1], {extrapolateRight: 'clamp'});

  const has2 = Boolean(quote2);
  const s2 = Math.round(durationInFrames * 0.5);
  const o1 = has2 ? interpolate(frame, [s2, s2 + 12], [1, 0],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
  const o2 = has2 ? interpolate(frame, [s2 + 6, s2 + 22], [0, 1],
                                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;

  const hasPhoto = Boolean(photo);
  const size = Math.min(52, Math.max(34, Math.floor(3400 / Math.max(20, quote.length))));

  const body = (txt, o, dy) => (
    <div style={{position: 'absolute', left: 0, right: 0, top: 132, opacity: o,
                 transform: `translateY(${dy}px)`,
                 fontFamily: 'Myeongjo, Georgia, serif', fontSize: size, lineHeight: 1.62,
                 color: TEXT, whiteSpace: 'pre-line', wordBreak: 'keep-all'}}>
      {txt}
    </div>
  );

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <PaperBg theme={theme} {...bg} />

      <div style={{position: 'relative', display: 'flex', alignItems: 'stretch',
                   background: PAPER, boxShadow: '0 26px 80px rgba(0,0,0,0.34)',
                   maxWidth: 1560, maxHeight: CONTENT_BOTTOM - 80}}>
        <div style={{position: 'relative', width: hasPhoto ? 1080 : 1280,
                     padding: '72px 88px 84px', minHeight: 460}}>
          <div style={{fontFamily: 'Myeongjo, Georgia, serif', fontSize: 132, lineHeight: 0.7,
                       color: YELLOW, opacity: mark}}>“</div>
          {body(quote, qo * o1, qy)}
          {has2 ? body(quote2, o2, interpolate(o2, [0, 1], [14, 0])) : null}

          <div style={{position: 'absolute', left: 88, bottom: 56, opacity: attr}}>
            <div style={{width: 48, height: 3, background: YELLOW, marginBottom: SP.NEAR}} />
            <div style={{fontFamily: 'A2Z Medium, sans-serif',
                         fontSize: 30, color: TEXT}}>{name}</div>
            {role ? (
              <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif',
                           fontSize: 25, color: '#7A8089'}}>{role}</div>
            ) : null}
          </div>
        </div>

        {hasPhoto ? (
          <div style={{width: 400, opacity: interpolate(frame, [18, 42], [0, 1],
                                                        {extrapolateRight: 'clamp'})}}>
            <Img src={/^https?:/.test(photo) ? photo : staticFile(photo)}
                 style={{width: '100%', height: '100%', objectFit: 'cover',
                         filter: 'grayscale(1) contrast(1.04)'}} />
          </div>
        ) : null}
      </div>

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
