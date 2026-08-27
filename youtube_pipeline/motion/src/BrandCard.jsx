import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, themeOf, YELLOW, CONTENT_BOTTOM, fadeIn, titleBottom} from './paper';
import {flow, fit} from './layout';

// ── 브랜드 카드 ──────────────────────────────────────────────────────────
// 회사·브랜드가 나올 때 **이름을 자막으로만 흘리면 남지 않는다.**
// B1M 은 시공사·설계사가 나올 때마다 로고를 화면에 한 번 박고 지나간다.
// 로고는 반드시 누끼(투명 배경)여야 한다 — 흰 사각형이 남으면 종이 위에 얹힌
// 스티커처럼 보이고, 어두운 테마에서는 아예 판때기가 된다.
// (누끼는 scripts/fetch_sources.py --logo 가 만든다)
//
// 두 가지 배치만 있다. 셋 이상 두면 다시 지겨워진다.
//   layout='split'  로고+한 줄 왼쪽 / 대표 이미지 오른쪽   ← 사진이 있을 때
//   layout='mark'   로고를 화면 가운데 크게 한 번 박는다   ← 사진이 없을 때
//
// logo  : 누끼 PNG 경로 (public/ 기준)
// name  : 로고가 없을 때 대신 쓰는 워드마크
// line  : 한 줄 설명 ("런던 기반 인테리어 설계사")
// tags  : ['1999 설립', '런던'] — 작은 칩
// photo : 대표 이미지
export const BrandCard = ({
  title = '', sub = '',
  logo = '', name = '', line = '', tags = [], photo = '',
  layout = '', logoScale = 1, logoInvert = 'auto', source = '', theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
  tracking = false,   // 한글 이름은 -1 로 조이면 글자가 붙는다 (#159)
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = themeOf(theme);
  const mode = layout || (photo ? 'split' : 'mark');

  // 어두운 테마에서 검정 로고는 안 보인다. 하지만 **컬러 로고를 뒤집으면 색이 망가진다**
  // (빨간 로고가 청록이 된다). 그래서 자동은 "어두운 테마 + 단색 로고" 일 때만이고,
  // 컬러 로고는 어댑트할 때 fetch_sources 가 알려주는 대로 logoInvert:false 를 준다.
  const inv = logoInvert === true || (logoInvert === 'auto' && T.dark);
  const logoFilter = inv ? 'invert(1) brightness(1.6)' : 'none';

  const src = (p) => (p && /^https?:/.test(p) ? p : staticFile(p));

  // 로고는 튀지 않게 — 살짝 올라오며 자리를 잡는다 (오버슛 없음)
  const s = spring({frame, fps, config: {damping: 200, mass: 0.7}});
  const logoY = interpolate(s, [0, 1], [18, 0]);

  // ── mark: 가운데 한 방 ────────────────────────────────────────────
  if (mode === 'mark') {
    const rule = interpolate(frame, [16, 34], [0, 1],
                             {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    return (
      <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
        <PaperBg theme={theme} {...bg} />
        <PaperTitle title={title} sub={sub} theme={theme} align={align} />
        <div style={{position: 'absolute', left: 0, right: 0,
                     top: title ? titleBottom(title, sub) + 106 : 300,
                     display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div style={{height: 200, display: 'flex', alignItems: 'center',
                       opacity: s, transform: `translateY(${logoY}px)`}}>
            {logo ? (
              <Img src={src(logo)} style={{maxHeight: 200 * logoScale, maxWidth: 1100 * logoScale,
                                           objectFit: 'contain',
                                           filter: logoFilter}} />
            ) : (
              <div style={{fontFamily: 'A2Z Medium, sans-serif',
                           fontSize: fit(name, 92, 1400), color: T.ink,
                           letterSpacing: tracking ? '0.02em' : -1}}>
                {name}
              </div>
            )}
          </div>
          <div style={{width: 120 * rule, height: 8, background: YELLOW, marginTop: 34}} />
          {line ? (
            <div style={{marginTop: 30, maxWidth: 1300, textAlign: 'center',
                         opacity: fadeIn(frame, 26),
                         fontFamily: 'A2Z Light, sans-serif', fontSize: 42, color: T.soft,
                         lineHeight: 1.4, wordBreak: 'keep-all'}}>
              {line}
            </div>
          ) : null}
          {tags.length ? (
            <div style={{marginTop: 26, display: 'flex', gap: 14}}>
              {tags.map((tg, i) => (
                <div key={i} style={{opacity: fadeIn(frame, 34 + i * 6),
                                     border: `2px solid ${T.ink}`, borderRadius: 999,
                                     padding: '8px 22px', fontSize: 24, color: T.ink,
                                     whiteSpace: 'nowrap'}}>{tg}</div>
              ))}
            </div>
          ) : null}
        </div>
        <PaperSource source={source} theme={theme} />
      </AbsoluteFill>
    );
  }

  // ── split: 왼쪽 정보 / 오른쪽 사진 ────────────────────────────────
  const PX = 1010;                                   // 사진 시작 x
  const PW = 1920 - PX;
  const top = title ? titleBottom(title, sub) + 44 : 240;
  const L = flow({
    blocks: [
      {key: 'logo', height: 132},
      {key: 'line', text: line, size: 44, maxWidth: 820, gapBefore: 40, lh: 1.4},
      {key: 'tags', height: tags.length ? 52 : 0, gapBefore: tags.length ? 30 : 0},
    ],
    top, bottom: CONTENT_BOTTOM - 20, gap: 20,
  });

  // 사진은 오른쪽에서 밀려 들어오며 아주 천천히 계속 밀린다
  const w = interpolate(frame, [4, 30], [0, 1],
                        {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ew = w * w * (3 - 2 * w);
  const push = 1 + frame * 0.00016;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <div style={{position: 'absolute', left: PX, top: 0, width: PW, height: 1080,
                   overflow: 'hidden', clipPath: `inset(0 0 0 ${(1 - ew) * 100}%)`}}>
        {photo ? (
          <Img src={src(photo)} style={{width: PW * push, height: 1080 * push,
                                        objectFit: 'cover',
                                        transform: `translate(${-PW * (push - 1) / 2}px, ${-1080 * (push - 1) / 2}px)`}} />
        ) : null}
      </div>

      <div style={{position: 'absolute', left: 150, top: L.logo.top, height: 132,
                   width: 820, display: 'flex', alignItems: 'center',
                   opacity: s, transform: `translateY(${logoY}px)`}}>
        {logo ? (
          <Img src={src(logo)} style={{maxHeight: 132 * logoScale, maxWidth: 780 * logoScale,
                                       objectFit: 'contain', objectPosition: 'left center',
                                       filter: logoFilter}} />
        ) : (
          <div style={{fontFamily: 'A2Z Medium, sans-serif',
                       fontSize: fit(name, 72, 780), color: T.ink,
                       letterSpacing: tracking ? '0.02em' : -1,
                       wordBreak: 'keep-all'}}>
            {name}
          </div>
        )}
      </div>

      {line ? (
        <div style={{position: 'absolute', left: 150, top: L.line.top, width: 820,
                     opacity: fadeIn(frame, 20),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 42, color: T.soft,
                     lineHeight: 1.4, wordBreak: 'keep-all'}}>
          {line}
        </div>
      ) : null}

      {tags.length ? (
        <div style={{position: 'absolute', left: 150, top: L.tags.top, width: 820,
                     display: 'flex', gap: 12, flexWrap: 'wrap'}}>
          {tags.map((tg, i) => (
            <div key={i} style={{opacity: fadeIn(frame, 30 + i * 6),
                                 border: `2px solid ${T.ink}`, borderRadius: 999,
                                 padding: '7px 20px', fontSize: 24, color: T.ink,
                                 whiteSpace: 'nowrap'}}>{tg}</div>
          ))}
        </div>
      ) : null}

      {source && photo ? (
        <div style={{position: 'absolute', right: 0, bottom: 0, width: 700, height: 96,
                     background: 'linear-gradient(to top left, rgba(0,0,0,0.55), rgba(0,0,0,0))'}} />
      ) : null}
      <PaperSource source={source} theme={photo ? 'ink' : theme} />
    </AbsoluteFill>
  );
};
