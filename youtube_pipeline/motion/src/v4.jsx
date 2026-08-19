import React from 'react';
import {Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// ── v4 디자인 시스템 — The B1M 본편 실측 기반 (2026-08-19) ─────────────
// v2/v3(검정+네온옐로)는 실은 Cleo/Stewart Hicks 계열이었다. B1M 본편
// 프레임 162장을 다시 보고 색을 실측한 결과는 정반대였다:
//   · 화면의 대부분이 실사 풀블리드 — 그래픽은 조연
//   · 그래픽은 "밝은 지면"(실측 #F2F1F9~#EDF0F7) 위 얇은 검정 선 = 제도 도면
//   · 강조는 아주 드물게 앰버(#C6A21A 계열)
//   · 우상단 지역 칩, 우하단 초소형 크레딧이 상시 장치
// → 표면(Surface)을 둘로 나눈다: PAPER(밝은 지면) / FOOTAGE(실사 풀블리드)

export const PAPER = '#F0F2F7'; // 그래픽 지면 (실측 평균)
export const PAPER_WARM = '#EFEBE3'; // 문서·기사·인터뷰용 따뜻한 지면
export const INK = '#16181A'; // 본문 잉크
export const INK2 = '#5C6167'; // 보조 잉크
export const INK3 = '#8B9099'; // 캡션
export const HAIR = '#C7CBD2'; // 얇은 선
export const AMBER = '#D99A1F'; // 지면 위 강조 스트로크 (B1M 오렌지 대응)
export const BRAND = '#FAFF2E'; // 채널 옐로 — 지면에선 "형광펜"으로만
export const NIGHT = '#0E1114'; // 실사 위 오버레이·칩

// 레이아웃 — 지면은 여백이 넓다 (B1M 도면 특징)
export const M = 150;
export const SAFE_BOTTOM = 820;

// 타이포 — 지면(잉크)용 / 실사(화이트)용
// 한글은 어절 단위로 끊어야 한다. keep-all 이 없으면 "소유권 이전"이
// "소유 / 권 이전"으로 갈라진다 — 모든 타이포 토큰에 기본으로 넣는다.
export const KO = {wordBreak: 'keep-all', overflowWrap: 'break-word'};

export const P = {
  eyebrow: {...KO, fontFamily: 'A2Z Medium, sans-serif', fontSize: 24, letterSpacing: '0.22em', color: INK2},
  title: {...KO, fontFamily: 'A2Z Regular, sans-serif', fontSize: 46, letterSpacing: '0.01em', color: INK},
  body: {...KO, fontFamily: 'A2Z Light, sans-serif', fontSize: 30, letterSpacing: '0.02em', color: INK},
  label: {...KO, fontFamily: 'A2Z Light, sans-serif', fontSize: 25, letterSpacing: '0.08em', color: INK2},
  caption: {...KO, fontFamily: 'A2Z Light, sans-serif', fontSize: 21, letterSpacing: '0.06em', color: INK3},
  dim: {...KO, fontFamily: 'A2Z Regular, sans-serif', fontSize: 26, letterSpacing: '0.1em', color: INK2},
  valueXL: {fontFamily: 'A2Z Medium, sans-serif', fontSize: 250, letterSpacing: '-0.035em', color: INK, lineHeight: 0.92, fontVariantNumeric: 'tabular-nums'},
  valueL: {fontFamily: 'A2Z Medium, sans-serif', fontSize: 120, letterSpacing: '-0.02em', color: INK, lineHeight: 1, fontVariantNumeric: 'tabular-nums'},
  valueM: {fontFamily: 'A2Z Medium, sans-serif', fontSize: 64, letterSpacing: '-0.01em', color: INK, fontVariantNumeric: 'tabular-nums'},
};

export const W = {
  title: {...KO, fontFamily: 'A2Z Medium, sans-serif', fontSize: 92, letterSpacing: '-0.01em', color: '#FFFFFF', textShadow: '0 2px 26px rgba(0,0,0,0.55)'},
  label: {...KO, fontFamily: 'A2Z Regular, sans-serif', fontSize: 34, letterSpacing: '0.14em', color: '#FFFFFF', textShadow: '0 2px 16px rgba(0,0,0,0.6)'},
  caption: {...KO, fontFamily: 'A2Z Light, sans-serif', fontSize: 22, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.72)'},
};

export const fade = (frame, start, len = 14) =>
  interpolate(frame, [start, start + len], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

// ── 지면(PAPER) 표면 ──────────────────────────────────────────────────
// 아주 옅은 종이 결 + 미세한 비네팅. 격자는 도면 카드에서만 켠다.
export const PaperSurface = ({tone = PAPER, plot = false}) => (
  <>
    <div style={{position: 'absolute', inset: 0, background: tone}} />
    <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
      <defs>
        {/* 제도지 격자 — 0.045 는 사실상 안 보였다(quality_probe: edge 변화 0).
            B1M 의 차트 지면에는 격자가 분명히 보인다. 잔격자 + 굵은 격자 2단 */}
        <pattern id="v4plot" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0 L0 0 0 40" fill="none" stroke="rgba(22,24,26,0.10)" strokeWidth="1" />
        </pattern>
        <pattern id="v4plotMajor" width="200" height="200" patternUnits="userSpaceOnUse">
          <path d="M200 0 L0 0 0 200" fill="none" stroke="rgba(22,24,26,0.17)" strokeWidth="1.2" />
        </pattern>
        <radialGradient id="v4vig" cx="50%" cy="45%" r="75%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.07" />
        </radialGradient>
        <filter id="v4tex">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
      {plot ? <rect width="1920" height="1080" fill="url(#v4plot)" /> : null}
      {plot ? <rect width="1920" height="1080" fill="url(#v4plotMajor)" /> : null}
      <rect width="1920" height="1080" fill="url(#v4vig)" />
      <rect width="1920" height="1080" filter="url(#v4tex)" opacity="0.035" />
    </svg>
  </>
);

// ── 실사(FOOTAGE) 표면 ────────────────────────────────────────────────
// 느린 줌 + 하단 그라디언트(자막·크레딧 가독성). 텍스트는 흰색.
export const FootageSurface = ({image = '', video = '', videoStart = 0, scrim = 'bottom', softEdge = true}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const z = 1.05 + (frame / 900) * 0.05; // 아주 느린 줌인
  // 등급 — B1M 실사는 우리보다 밝고 채도가 높다(quality_probe 실측).
  // 스크림으로 전체를 덮어 눌러버리면 계조가 죽으므로, 화면을 덮는 대신
  // 소재 자체를 살짝 올리고 어둡게 하는 일은 비네팅·부분 그라디언트에 맡긴다.
  const style = {
    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
    transform: `scale(${z})`, filter: 'contrast(1.05) saturate(1.12) brightness(1.03)',
  };
  const grad =
    scrim === 'full'
      // full = 화면 중앙에 글이 오는 경우. 전면 워시(.38~.78) 대신
      // 위·아래만 눌러 가운데 계조를 남긴다
      ? 'linear-gradient(180deg, rgba(8,10,12,.58) 0%, rgba(8,10,12,.20) 30%, rgba(8,10,12,.20) 58%, rgba(8,10,12,.74) 100%)'
      : 'linear-gradient(180deg, rgba(8,10,12,.26) 0%, rgba(8,10,12,0) 32%, rgba(8,10,12,.06) 60%, rgba(8,10,12,.70) 100%)';
  return (
    <>
      {video ? (
        <OffthreadVideo src={staticFile(video)} startFrom={Math.round(videoStart * fps)} style={style} />
      ) : image ? (
        <Img src={staticFile(image)} style={style} />
      ) : (
        <div style={{position: 'absolute', inset: 0, background: NIGHT}} />
      )}
      {/* 주변부 소프트 폴오프 — 영상은 렌즈 특성상 가장자리가 살짝 무르다.
          정지 사진을 그대로 쓰면 화면 전체가 균일하게 날카로워 그래픽처럼 보인다
          (quality_probe: 엣지 밀도가 B1M 대비 과다). 가운데는 건드리지 않는다 */}
      {softEdge && (image || video) ? (
        <div style={{
          position: 'absolute', inset: 0, overflow: 'hidden',
          maskImage: 'radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 46%, rgba(0,0,0,1) 92%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 46%, rgba(0,0,0,1) 92%)',
        }}>
          <div style={{position: 'absolute', inset: 0, filter: 'blur(4px)', transform: 'scale(1.02)'}}>
            {video ? (
              <OffthreadVideo src={staticFile(video)} startFrom={Math.round(videoStart * fps)} style={style} />
            ) : (
              <Img src={staticFile(image)} style={style} />
            )}
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', inset: 0, background: grad}} />
      {/* 비네팅 — 가장자리만 떨어뜨려 시선을 가운데로. 계조는 유지된다 */}
      <div style={{position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.34) 100%)'}} />
    </>
  );
};

// ── 상시 장치 ─────────────────────────────────────────────────────────
// 우상단 지역/시점 칩 — B1M 이 늘 쓰는 장치 (PARIS, COLOGNE 1945 …)
export const PlaceChip = ({text, dark = true, opacity = 1}) =>
  text ? (
    <div
      style={{
        position: 'absolute', top: 62, right: M, opacity,
        background: dark ? 'rgba(14,17,20,0.82)' : 'rgba(255,255,255,0.9)',
        padding: '9px 16px 7px',
        fontFamily: 'A2Z Medium, sans-serif', fontSize: 21, letterSpacing: '0.2em',
        color: dark ? '#FFFFFF' : INK,
      }}
    >
      {text}
    </div>
  ) : null;

// 우하단 초소형 출처 크레딧
export const Credit = ({text, dark = true, opacity = 1}) =>
  text ? (
    <div
      style={{
        position: 'absolute', bottom: 26, right: M, opacity,
        fontFamily: 'A2Z Light, sans-serif', fontSize: 17, letterSpacing: '0.12em',
        color: dark ? 'rgba(255,255,255,0.55)' : INK3,
      }}
    >
      {text}
    </div>
  ) : null;

// 지면 헤더 — 기본 중앙 정렬 (B1M 지면은 대개 가운데로 모은다)
export const PaperHead = ({eyebrow = '', title = '', opacity = 1, align = 'center'}) => (
  <div style={{position: 'absolute', top: 104, left: M, right: M, opacity, textAlign: align}}>
    {eyebrow ? <div style={P.eyebrow}>{eyebrow}</div> : null}
    {title ? <div style={{...P.title, marginTop: 12}}>{title}</div> : null}
    <div style={{margin: align === 'center' ? '24px auto 0' : '24px 0 0', width: align === 'center' ? 220 : '100%', height: 1, background: HAIR}} />
  </div>
);

// 중앙 콘텐츠 무대 — 킥커 아래 ~ 자막 안전영역 사이를 세로 가운데로 쓴다
export const Stage = ({top = 300, children, style}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top, textAlign: 'center', ...style}}>
    {children}
  </div>
);

// 형광펜 — 지면 위에서 채널 옐로를 쓰는 유일한 방법 (B1M 신문 하이라이트 문법)
export const Mark = ({children, on = 1}) => (
  <span
    style={{
      background: `linear-gradient(180deg, transparent 12%, ${BRAND} 12%, ${BRAND} 88%, transparent 88%)`,
      backgroundSize: `${on * 100}% 100%`,
      backgroundRepeat: 'no-repeat',
      padding: '0 4px',
    }}
  >
    {children}
  </span>
);
