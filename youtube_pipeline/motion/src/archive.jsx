import React from 'react';
import {Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame} from 'remotion';

// ── 옛 자료를 영상으로 보이게 하기 ────────────────────────────────────────
// 1938년 반도호텔, 1970년 청와대, 1979년 개관식. 이런 대목에서 쓸 수 있는 건
// **정지 사진 한 장**뿐이다. 그런데 그걸 그냥 띄우면 화면이 멎고, 멎는 순간
// 시청자는 화면을 안 본다 (§ 살아 있는 배경과 같은 문제).
//
// 사진을 영상처럼 만드는 건 "천천히 확대"가 아니다. 그건 슬라이드쇼다.
// 필름이 영상으로 읽히는 이유는 **프레임마다 미세하게 다르기 때문**이다.
// 그래서 여섯 가지를 겹친다:
//
//   ① 게이트 흔들림  필름이 게이트에서 1~2px 떨린다. 이게 제일 크다.
//                    이것만 있어도 정지 사진이 "돌아가는 필름"이 된다
//   ② 움직이는 그레인 매 프레임 위치가 바뀌는 입자. 고정된 그레인은 얼룩이다
//   ③ 먼지·스크래치  가끔 세로 실선이 몇 프레임 지나간다. 늘 있으면 무늬가 된다
//   ④ 밝기 깜빡임    광량이 ±3% 흔들린다. 초당 6~8회 — 그 이상은 고장으로 보인다
//   ⑤ 비네팅         렌즈 가장자리가 어두워지고 살짝 흐려진다
//   ⑥ 탈색           채도를 빼고 살짝 따뜻하게. 흑백으로 완전히 빼면 오히려 밋밋하다
//
// **난수는 절대 Math.random 으로 만들지 않는다.** Remotion 은 프레임마다
// 컴포넌트를 다시 그리므로 매번 다른 값이 나오고, 렌더할 때마다 결과가 달라져
// 이어 붙이면 화면이 지직거린다. 프레임 번호를 넣으면 늘 같은 값이 나오는
// 결정적 잡음을 쓴다.
const noise = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);                       // 0~1
};
const signed = (n) => noise(n) * 2 - 1;           // -1~1

// era  'film'  1930~60년대 · 흔들림과 먼지가 세다
//      'video' 1980~90년대 방송 · 주사선이 있고 흔들림은 약하다
//      'photo' 옛 사진 스캔 · 흔들림만 아주 약하게
const PRESET = {
  film:  {weave: 2.2, grain: 0.16, dust: 1.0, flicker: 0.035, sat: 0.28, sepia: 0.30, scan: 0},
  video: {weave: 0.6, grain: 0.10, dust: 0.2, flicker: 0.020, sat: 0.62, sepia: 0.06, scan: 0.16},
  photo: {weave: 0.8, grain: 0.09, dust: 0.3, flicker: 0.012, sat: 0.45, sepia: 0.22, scan: 0},
};

// 켄번스 — 사진 안을 **천천히 가로지른다.** 확대만 하면 줌이고,
// 가로지르면 카메라가 있는 것처럼 읽힌다
export const ArchiveFilm = ({
  src = '', video = false, era = 'film',
  zoom = 0.10,                 // 진행 중 커지는 폭
  pan = [0, 0],                // 진행 중 이동 (px). [x, y]
  durationF = 150,             // 이 컷의 프레임 수 (켄번스 속도 계산용)
  gate = 0,                    // 0 이면 꽉 채움. 1.333 이면 4:3 게이트(좌우 검은 띠)
  style = {},
}) => {
  const frame = useCurrentFrame();
  const P = PRESET[era] || PRESET.film;
  if (!src) return null;
  const url = /^https?:/.test(src) ? src : staticFile(src);

  // ① 게이트 흔들림 — 3프레임마다 새 위치로. 매 프레임 바꾸면 지직거린다
  const g = Math.floor(frame / 3);
  const wx = signed(g) * P.weave;
  const wy = signed(g + 91) * P.weave;

  // 켄번스
  const t = Math.min(1, frame / Math.max(1, durationF));
  const s = 1 + zoom * t;
  const px = pan[0] * t, py = pan[1] * t;

  // ④ 깜빡임 — 4프레임 주기
  const f = Math.floor(frame / 4);
  const bright = 1 + signed(f + 17) * P.flicker;

  // ③ 먼지 — 40프레임에 한 번쯤, 3프레임만. 세로 실선 한두 개
  const dustSlot = Math.floor(frame / 3);
  const showDust = noise(dustSlot * 7.3) < 0.08 * P.dust;
  const dustX = noise(dustSlot * 3.1) * 100;
  const dustH = 20 + noise(dustSlot * 5.7) * 50;
  const dustY = noise(dustSlot * 11.3) * 70;

  const media = video
    ? <OffthreadVideo src={url} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    : <Img src={url} style={{width: '100%', height: '100%', objectFit: 'cover'}} />;

  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden',
                 background: '#0B0C0E', ...style}}>
      {/* 4:3 게이트 — 1980년 이전 자료는 화면비가 다르다. 억지로 늘리면
          사람이 홀쭉해지고, 그게 "가짜 자료" 로 보이는 제일 흔한 이유다 */}
      <div style={{position: 'absolute', top: 0, bottom: 0,
                   left: gate ? `${(1 - (gate / (16 / 9))) * 50}%` : 0,
                   right: gate ? `${(1 - (gate / (16 / 9))) * 50}%` : 0,
                   overflow: 'hidden'}}>
        <div style={{position: 'absolute', inset: -8,
                     transform: `translate(${wx + px}px, ${wy + py}px) scale(${s})`,
                     filter: `saturate(${P.sat}) sepia(${P.sepia}) `
                           + `brightness(${bright}) contrast(1.06)`}}>
          {media}
        </div>

        {/* ⑤ 비네팅 + 가장자리 흐림 — 필름 게이트 */}
        <div style={{position: 'absolute', inset: 0, pointerEvents: 'none',
                     boxShadow: 'inset 0 0 120px 34px rgba(0,0,0,0.66)'}} />

        {/* ② 그레인 — 프레임마다 위치가 바뀐다 */}
        <svg width="100%" height="100%" style={{position: 'absolute', inset: 0,
                                                opacity: P.grain, mixBlendMode: 'overlay',
                                                pointerEvents: 'none'}}>
          <filter id={`ag${frame % 8}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"
                          seed={frame % 8} />
          </filter>
          <rect width="100%" height="100%" filter={`url(#ag${frame % 8})`} />
        </svg>

        {/* 주사선 — 방송 자료일 때만 */}
        {P.scan ? (
          <div style={{position: 'absolute', inset: 0, pointerEvents: 'none',
                       background: 'repeating-linear-gradient(0deg,'
                                 + ` rgba(0,0,0,${P.scan}) 0 1px, rgba(0,0,0,0) 1px 3px)`}} />
        ) : null}

        {/* ③ 먼지 — 세로 실선 */}
        {showDust ? (
          <div style={{position: 'absolute', left: `${dustX}%`, top: `${dustY}%`,
                       width: 1.5, height: `${dustH}%`,
                       background: 'rgba(255,255,255,0.55)', pointerEvents: 'none'}} />
        ) : null}
      </div>
    </div>
  );
};

// 자료의 연도·출처를 화면 안에 박는 표. 아카이브 화면에는 이게 있어야
// "가져온 자료" 로 읽힌다 — 없으면 그냥 필터 먹인 사진이다
export const ArchiveStamp = ({label = '', year = '', theme, opacity = 1}) => {
  const frame = useCurrentFrame();
  if (!label && !year) return null;
  const o = opacity * interpolate(frame, [8, 24], [0, 1],
                                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // 이름이 크고 연도가 그 아래. 예전엔 한 줄에 연도 28px · 이름 24px 로
  // 나란히 있었는데, **이걸 휴대폰으로 본다.** 그 크기는 화면에서 사라진다.
  // 무엇을 보고 있는지가 먼저고 언제인지가 다음이므로 이름을 위로 올린다 (#42)
  const SH = '0 2px 14px rgba(0,0,0,0.92)';
  return (
    <div style={{position: 'absolute', left: 96, bottom: 240, opacity: o,
                 fontFamily: 'A2Z Light, sans-serif'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
        <span style={{width: 12, height: 12, borderRadius: '50%',
                      background: '#FAFF2E', boxShadow: '0 0 14px rgba(250,255,46,0.7)'}} />
        {label ? (
          <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 66,
                        letterSpacing: '-0.01em', color: '#FFFFFF',
                        textShadow: SH, wordBreak: 'keep-all'}}>
            {label}
          </span>
        ) : null}
      </div>
      {year ? (
        <div style={{marginLeft: 30, marginTop: 6, fontFamily: 'A2Z Regular, sans-serif',
                     fontSize: 38, letterSpacing: '0.1em',
                     color: 'rgba(255,255,255,0.86)', textShadow: SH}}>
          {year}
        </div>
      ) : null}
    </div>
  );
};
