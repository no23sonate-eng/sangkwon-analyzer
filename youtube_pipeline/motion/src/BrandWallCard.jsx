import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, staticFile, interpolate,
        useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperSource, YELLOW, fadeIn, SP} from './paper';

// ── 이름 위에 얼굴 ────────────────────────────────────────────────────────
// 여럿을 **나란히** 놓되 순서도 단계도 없을 때. 브랜드 넷, 시설 셋처럼
// 서로 대등한 것들이다.
//
// PhotoStepsCard 와 갈라지는 지점: 저건 **단계**라 화살표와 번호가 붙는다.
// 여기에는 둘 다 없다 — 화살표를 붙이면 "만다린 다음에 리츠칼튼" 처럼
// 읽힌다. 대등한 것에 순서를 그리면 뜻이 틀어진다.
//
// 화면을 세로로 쪼개 끝까지 채우고, 이름은 각 칸 **한가운데**. B1M 이
// 여러 대상을 한 화면에 세울 때 쓰는 판이다 — 여백을 두면 슬라이드가 되고,
// 꽉 채우면 화면이 된다.
//
// items: [{media, name, sub, hot}]  media 는 사진 또는 영상
export const BrandWallCard = ({
  items = [],
  gap = 6,          // 칸 사이 틈. 0 이면 통짜 한 장처럼 보인다
  scrim = 0.42,     // 이름이 앉을 자리를 눌러 준다
  size = 0,         // 이름 크기를 직접 정할 때
  source = '', theme,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const n = Math.max(1, items.length);
  const W = (1920 - gap * (n - 1)) / n;

  // 이름이 칸을 넘지 않게. 한글은 글자수 × 크기 에 가깝다
  const longest = Math.max(2, ...items.map((it) => String(it.name || '').length));
  const FS = size || Math.min(62, Math.max(30, Math.floor((W * 0.86) / longest)));

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Light, sans-serif', background: '#0B0E12'}}>
      {items.map((it, i) => {
        const src = /^https?:/.test(it.media || '') ? it.media : staticFile(it.media || '');
        const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(String(it.media || ''));
        const x = i * (W + gap);
        // 칸마다 시차를 두고 선다. 넷이 한꺼번에 뜨면 판때기로 보인다
        const o = fadeIn(frame, 4 + i * 8, 18);
        // 아주 느린 확대 — 멎은 화면은 몇 초만 지나도 슬라이드로 읽힌다
        const zoom = interpolate(frame, [0, Math.max(1, durationInFrames)], [1, 1.06],
                                 {extrapolateRight: 'clamp'});
        return (
          <div key={i} style={{position: 'absolute', left: x, top: 0, width: W, height: 1080,
                               overflow: 'hidden', opacity: o}}>
            <div style={{width: '100%', height: '100%', transform: `scale(${zoom})`}}>
              {it.media ? (isVid
                ? <OffthreadVideo src={src} muted
                                  style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                : <Img src={src} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
              ) : null}
            </div>
            <div style={{position: 'absolute', inset: 0, background: `rgba(11,14,18,${scrim})`}} />
            {/* 이름이 앉는 띠만 한 번 더 누른다. 칸마다 사진 밝기가 다르면
                같은 스크림으로는 어떤 칸은 읽히고 어떤 칸은 안 읽힌다 —
                골프 시뮬레이터처럼 흰 화면이 들어오면 특히 그렇다 */}
            <div style={{position: 'absolute', inset: 0, background:
              'linear-gradient(180deg, rgba(11,14,18,0) 24%, rgba(11,14,18,0.58) 50%,'
              + ' rgba(11,14,18,0) 76%)'}} />
            {/* 이름은 칸 한가운데. 위아래로도 가운데 */}
            <div style={{position: 'absolute', left: 0, right: 0, top: '50%',
                         transform: `translateY(-50%) translateY(${(1 - o) * 12}px)`,
                         textAlign: 'center', padding: '0 18px'}}>
              {/* 로고가 있으면 이름 위에 올린다 — 마크가 먼저 눈에 들어오고
                  이름이 그걸 읽어 준다. 로고는 배경색이 제각각이라 흰 칩에 얹는다 */}
              {it.logo ? (
                <div style={{margin: '0 auto 18px', width: Math.min(W * 0.62, 260), height: 92,
                             background: '#FFFFFF', borderRadius: 4,
                             display: 'flex', alignItems: 'center', justifyContent: 'center',
                             padding: '10px 16px', boxShadow: '0 10px 30px rgba(0,0,0,0.35)'}}>
                  <Img src={/^https?:/.test(it.logo) ? it.logo : staticFile(it.logo)}
                       style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}} />
                </div>
              ) : null}
              <div style={{fontSize: FS, lineHeight: 1.24, color: it.hot ? YELLOW : '#FFFFFF',
                           textShadow: '0 3px 24px rgba(0,0,0,0.9)', wordBreak: 'keep-all'}}>
                {it.name}
              </div>
              {it.sub ? (
                <div style={{marginTop: SP.NEAR, fontSize: Math.round(FS * 0.46),
                             letterSpacing: '0.04em', color: 'rgba(255,255,255,0.76)',
                             textShadow: '0 2px 16px rgba(0,0,0,0.9)', wordBreak: 'keep-all'}}>
                  {it.sub}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      <PaperSource source={source} theme={theme} onPhoto />
    </AbsoluteFill>
  );
};
