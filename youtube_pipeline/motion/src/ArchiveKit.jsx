import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {
  PaperSurface, PaperHead, Stage, Credit, PlaceChip,
  PAPER, INK, P, W, M, SAFE_BOTTOM, fade,
} from './v4';
import {EASE, useRevealUp} from './anim';

// ── 아카이브·외부 소스 장치 (2026-08-19) ────────────────────────────────
// B1M 은 과거 자료를 그냥 붙이지 않는다. 시대·출처를 화면에 명시하고,
// 화면비가 안 맞으면 액자에 넣고, 옛 자료는 옛 자료처럼 보이게 등급을 준다.

// 필름 그레인 + 미세 흔들림 — 옛 자료 느낌 (아주 절제해서)
const FilmGrain = ({opacity = 0.06, seed = 0}) => (
  <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, pointerEvents: 'none'}}>
    <defs>
      <filter id={`grain${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </defs>
    <rect width="1920" height="1080" filter={`url(#grain${seed})`} opacity={opacity} />
  </svg>
);

// 14) 아카이브 자료 — 옛 사진/뉴스릴. 시대 칩 + 흑백 등급 + 액자(비율 불일치 대응)
// era: 'bw' 흑백 | 'sepia' 세피아 | 'color' 원본
// fit: 'cover' 풀블리드 | 'frame' 액자(4:3·세로 자료)
export const ArchiveCard = ({
  image = '', video = '', videoStart = 0,
  era = 'bw', fit = 'cover',
  dateChip = '', // 우상단 시대 표기 (예: 'SEOUL · 1988')
  caption = '', // 하단 설명
  credit = '', // 우하단 출처 (필수에 가깝게 쓸 것)
  grain = true,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 옛 자료는 아주 느리게 밀려 들어온다 (Ken Burns)
  const z = 1.04 + (frame / 1200) * 0.06;
  const drift = Math.sin(frame / 260) * 5;
  const filter =
    era === 'bw' ? 'grayscale(1) contrast(1.06) brightness(0.98)'
      : era === 'sepia' ? 'sepia(0.55) contrast(1.04) saturate(0.85)'
        : 'none';

  const media = video ? (
    <OffthreadVideo src={staticFile(video)} startFrom={Math.round(videoStart * fps)}
      style={{width: '100%', height: '100%', objectFit: 'cover'}} />
  ) : image ? (
    <Img src={staticFile(image)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
  ) : null;

  return (
    <AbsoluteFill style={{background: '#0B0C0E'}}>
      {fit === 'frame' ? (
        <>
          {/* 비율이 안 맞는 옛 자료는 어두운 바탕 위 액자에 — 잘라내지 않는다 */}
          <div style={{position: 'absolute', inset: 0, background: '#14161A'}} />
          <div style={{
            position: 'absolute', top: 120, left: 480, width: 960, height: 700,
            border: '5px solid rgba(255,255,255,0.9)', overflow: 'hidden',
            boxShadow: '0 30px 70px rgba(0,0,0,0.55)',
            filter, transform: `scale(${1 + (z - 1) * 0.3})`,
            opacity: fade(frame, 0, 20),
          }}>
            {media}
          </div>
        </>
      ) : (
        <div style={{position: 'absolute', inset: 0, filter, transform: `scale(${z}) translateX(${drift}px)`}}>
          {media}
        </div>
      )}

      {/* 옛 자료 등급 — 비네팅 + 그레인 */}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)'}} />
      {grain ? <FilmGrain opacity={era === 'color' ? 0.04 : 0.075} seed={3} /> : null}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(8,10,12,.34) 0%, rgba(8,10,12,0) 26%, rgba(8,10,12,0) 62%, rgba(8,10,12,.76) 100%)'}} />

      <PlaceChip text={dateChip} opacity={fade(frame, 8)} />
      {caption ? (
        <Stage top={SAFE_BOTTOM - 104} style={{opacity: fade(frame, 18)}}>
          {/* 아카이브 캡션은 얇은 규칙선 위에 — "설명 자막"이 아니라 "자료 표기"로 읽히게 */}
          <div style={{width: 84, height: 1, background: 'rgba(255,255,255,0.45)', margin: '0 auto 22px'}} />
          <span style={{...W.label, fontSize: 32, letterSpacing: '0.06em'}}>{caption}</span>
        </Stage>
      ) : null}
      <Credit text={credit} opacity={fade(frame, 24)} />
    </AbsoluteFill>
  );
};

// 15) 외부 영상 인용 — 뉴스·기관 영상을 "빌려온 화면"으로 명시해 보여준다
// B1M 의 'COURTESY OF …' 문법. 화면비 불일치는 필러박스로 처리.
export const SourceClipCard = ({
  image = '', video = '', videoStart = 0,
  outlet = '', // 좌하단 매체명
  headline = '', // 화면 위 한 줄 요약
  dateChip = '',
  courtesy = '', // 우하단 'COURTESY OF …'
  pillarbox = false, // 세로/4:3 소스일 때
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inn = useRevealUp(10, 28, 24);
  const media = video ? (
    <OffthreadVideo src={staticFile(video)} startFrom={Math.round(videoStart * fps)}
      style={{width: '100%', height: '100%', objectFit: pillarbox ? 'contain' : 'cover'}} />
  ) : image ? (
    <Img src={staticFile(image)} style={{width: '100%', height: '100%', objectFit: pillarbox ? 'contain' : 'cover'}} />
  ) : null;

  return (
    <AbsoluteFill style={{background: '#0B0C0E'}}>
      {pillarbox ? (
        <>
          {/* 배경은 같은 소재를 크게 흐린 것 — 빈 검정보다 자연스럽다 */}
          <div style={{position: 'absolute', inset: 0, filter: 'blur(28px) brightness(0.5)', transform: 'scale(1.2)'}}>
            {media}
          </div>
          <div style={{position: 'absolute', inset: 0}}>{media}</div>
        </>
      ) : (
        <div style={{position: 'absolute', inset: 0}}>{media}</div>
      )}

      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(8,10,12,.3) 0%, rgba(8,10,12,0) 30%, rgba(8,10,12,0) 60%, rgba(8,10,12,.8) 100%)'}} />

      <PlaceChip text={dateChip} opacity={fade(frame, 6)} />

      {/* 인용 화면은 아래쪽에 어두운 띠를 하나 더 깔아 문장을 확실히 앉힌다 */}
      {headline || outlet ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: SAFE_BOTTOM - 220, height: 300, pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(8,10,12,0) 0%, rgba(8,10,12,.62) 46%, rgba(8,10,12,.72) 100%)'}} />
      ) : null}

      {outlet ? (
        <Stage top={SAFE_BOTTOM - 178} style={{opacity: fade(frame, 8)}}>
          <span style={{
            background: 'rgba(255,255,255,0.94)', color: INK, padding: '8px 14px 6px',
            fontFamily: 'A2Z Medium, sans-serif', fontSize: 27, letterSpacing: '0.14em',
          }}>{outlet}</span>
        </Stage>
      ) : null}
      {headline ? (
        <Stage top={SAFE_BOTTOM - 112} style={inn}>
          <div style={{...W.title, fontSize: 58, lineHeight: 1.24}}>{headline}</div>
        </Stage>
      ) : null}
      <Credit text={courtesy ? `COURTESY OF ${courtesy}` : ''} opacity={fade(frame, 20)} />
    </AbsoluteFill>
  );
};

// 16) 시대 비교 — 같은 자리를 과거/현재로 나란히 (히스토리 서사의 핵심 장치)
export const ThenNowCard = ({
  eyebrow = '', title = '',
  thenImage = '', thenLabel = '', thenEra = 'bw',
  nowImage = '', nowLabel = '',
  note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  // 라벨(패널 아래)과 note(하단)가 겹치지 않게 높이를 정해 둔다
  const CW = 780, CH = 412, TOP = 288;
  const gap = 40;
  const leftX = 960 - CW - gap / 2;
  const rightX = 960 + gap / 2;
  const Panel = ({img, label, x, delay, era}) => {
    const t = interpolate(frame, [delay, delay + 28], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
    });
    return (
      <>
        <div style={{
          position: 'absolute', left: x, top: TOP, width: CW, height: CH,
          overflow: 'hidden', background: '#1A1D21',
          boxShadow: '0 20px 46px rgba(20,24,30,0.18)',
          clipPath: `inset(0 ${(1 - t) * 100}% 0 0)`,
        }}>
          {img ? (
            <Img src={staticFile(img)} style={{
              width: '100%', height: '100%', objectFit: 'cover',
              filter: era === 'bw' ? 'grayscale(1) contrast(1.05)' : 'none',
              transform: `scale(${1.03 + (frame / 1400) * 0.05})`,
            }} />
          ) : null}
        </div>
        <div style={{position: 'absolute', left: x, top: TOP + CH + 20, width: CW, textAlign: 'center', opacity: fade(frame, delay + 18)}}>
          <span style={{...P.label, fontSize: 30, color: INK}}>{label}</span>
        </div>
      </>
    );
  };
  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      <Panel img={thenImage} label={thenLabel} x={leftX} delay={10} era={thenEra} />
      <Panel img={nowImage} label={nowLabel} x={rightX} delay={22} era="color" />
      <div style={{position: 'absolute', left: 960 - 1, top: TOP, width: 2, height: CH, background: PAPER}} />
      {note ? <Stage top={SAFE_BOTTOM - 38} style={{opacity: fade(frame, 44)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 44)} />
    </AbsoluteFill>
  );
};
