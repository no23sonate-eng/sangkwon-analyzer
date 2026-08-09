import React from 'react';
import {AbsoluteFill, Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {YELLOW, INK, CONTENT_BOTTOM, fadeIn} from './paper';
import {estWidth, fit} from './layout';

// ── 움직이는 카메라 + 현장 주석 ──────────────────────────────────────────
// 지금까지 43컷이 전부 "정지 화면에 요소가 페이드로 얹히는" 한 문법이었다.
// B1M 이 항공샷·배치도 위에서 늘 하는 것은 그게 아니라:
//   ① 카메라가 **계속 움직인다** — 넓게 잡았다가 한 곳으로 밀고 들어간다
//   ② 멈추는 지점마다 **주석이 그려진다** — 표적 링 → 지시선 → 라벨 순서로
//   ③ 다음 지점으로 **이어서** 움직인다. 컷을 끊지 않는다
// 화면이 살아 있으면서 정보가 순서대로 쌓인다. 정지 카드로는 안 되는 일이다.
//
// beats: [{x, y, zoom, label, sub, side, hot, hold}]
//   x,y   원본 이미지 안의 목표 지점 (0~1 비율)
//   zoom  그 순간의 배율 (1 = 화면에 꽉 참)
//   side  라벨이 붙는 방향 'right'|'left'|'up'|'down'
//   hold  그 지점에서 머무는 초 (기본 1.6)
//
// 주석 순서를 지키는 게 핵심이다. 세 개가 동시에 뜨면 "표시"지만,
// 링 → 선 → 글자 순으로 오면 "가리키는 동작"이 된다.
const SHADOW = '0 3px 20px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.7)';

const MOVE_F = 34;          // 지점 사이 이동 프레임
const RING_F = 12;          // 표적 링이 조여드는 시간
const LINE_F = 12;          // 지시선이 그어지는 시간
const LABEL_F = 12;         // 라벨이 밀려 나오는 시간

const ease = (t) => t * t * (3 - 2 * t);

export const AnnotatedShotCard = ({
  image = '',
  imageRatio = 1.778,
  title = '', titleSub = '',
  beats = [],
  leadIn = 0.7,             // 첫 지점으로 들어가기 전 넓게 보여 주는 시간(초)
  scrim = 0,                // 바탕을 평평하게 누르는 정도.
                            // 도면·조감도처럼 **원본에 이미 캡션이 박혀 있는 판**은
                            // 0.3~0.4 로 눌러야 내 주석이 위로 올라온다. 사진은 0.
  source = '',
  debug = false,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!beats.length) return <AbsoluteFill style={{background: '#0b0e12'}} />;

  // ── 카메라 타임라인 ──
  // 각 비트는 [이동 MOVE_F] + [정지 hold] 로 구성. 이동은 이징, 정지는 아주 느린
  // 드리프트(1.5%)를 줘 화면이 완전히 멈추지 않게 한다.
  const lead = Math.round(leadIn * fps);
  const segs = beats.map((b) => ({move: MOVE_F, hold: Math.round((b.hold ?? 1.6) * fps)}));

  let acc = lead;
  const starts = segs.map((s) => {
    const st = acc;
    acc += s.move + s.hold;
    return st;
  });

  // 지금 어느 비트에 있는지 + 그 안에서의 진행도
  let idx = 0, tMove = 0;
  const t = frame;
  for (let i = 0; i < segs.length; i++) {
    if (t >= starts[i]) {
      idx = i;
      tMove = Math.min(1, Math.max(0, (t - starts[i]) / segs[i].move));
    }
  }
  const beatT = t - starts[idx];                       // 비트 시작 이후 프레임
  const settled = Math.max(0, beatT - segs[idx].move); // 정지 구간 진행 프레임

  const from = idx === 0
    ? {x: 0.5, y: 0.5, zoom: 1.0}
    : {x: beats[idx - 1].x, y: beats[idx - 1].y, zoom: beats[idx - 1].zoom ?? 1.6};
  const to = {x: beats[idx].x, y: beats[idx].y, zoom: beats[idx].zoom ?? 1.6};
  const e = ease(tMove);
  const drift = 1 + Math.min(settled, 200) / 200 * 0.015;   // 정지 중 아주 느린 밀기

  const rawX = from.x + (to.x - from.x) * e;
  const rawY = from.y + (to.y - from.y) * e;
  const zoom = (from.zoom + (to.zoom - from.zoom) * e) * drift;

  // 이미지를 화면보다 크게 깔고, 목표 지점이 화면 중앙에 오도록 민다.
  // zoom=1 이 "화면을 딱 덮는" 크기여야 원본 해상도를 낭비하지 않는다.
  // (세로로 긴 이미지에 16:9 기준 배율을 곱하면 처음부터 1.3배 확대돼 뭉갠다)
  const coverW = Math.max(1920, 1080 * imageRatio);
  const imgW = coverW * zoom;
  const imgH = imgW / imageRatio;
  // 카메라를 원본 밖으로 못 나가게 묶는다. 안 묶으면 가장자리 비트에서
  // 화면에 검은 띠가 생긴다 (실제 카메라가 플레이트 끝에 닿는 것과 같은 동작).
  const halfX = 960 / imgW, halfY = 540 / imgH;
  const clamp = (v, h) => (h >= 0.5 ? 0.5 : Math.min(1 - h, Math.max(h, v)));
  const cx = clamp(rawX, halfX);
  const cy = clamp(rawY, halfY);
  const left = 960 - cx * imgW;
  const top = 540 - cy * imgH;

  // 화면 위에서의 지점 좌표 (라벨·링을 여기에 건다)
  const px = (b) => 960 + (b.x - cx) * imgW;
  const py = (b) => 540 + (b.y - cy) * imgH;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: '#0b0e12', overflow: 'hidden'}}>
      <Img src={staticFile(image)}
           style={{position: 'absolute', left, top, width: imgW, height: imgH}} />
      {scrim > 0 ? (
        <div style={{position: 'absolute', inset: 0, background: `rgba(11,14,18,${scrim})`}} />
      ) : null}
      <div style={{position: 'absolute', inset: 0,
                   background: 'linear-gradient(180deg, rgba(11,14,18,0.62) 0%, rgba(11,14,18,0) 26%, '
                             + 'rgba(11,14,18,0) 58%, rgba(11,14,18,0.55) 100%)'}} />

      {/* 주석은 **지금 보는 지점만** 남긴다.
          직전 지점은 카메라가 떠나는 동안만 흐려지며 사라진다 — 계속 남겨 두면
          카메라가 움직인 뒤 엉뚱한 건물 위에 얹혀 오독을 만든다. */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {beats.map((b, i) => {
          if (i > idx) return null;
          const prev = i === idx - 1;
          if (i < idx - 1) return null;
          const done = prev;
          if (prev && tMove >= 1) return null;
          const ring = done ? 1 : ease(Math.min(1, settled / RING_F));
          if (ring <= 0) return null;
          const X = px(b), Y = py(b);
          const r = 62 - 30 * ring;
          const o = done ? 1 - ease(tMove) : 1;
          const col = b.hot ? YELLOW : '#FFFFFF';

          const lineT = done ? 1 : ease(Math.min(1, (settled - RING_F) / LINE_F));
          const dir = b.side === 'left' ? [-1, 0] : b.side === 'up' ? [0, -1]
                    : b.side === 'down' ? [0, 1] : [1, 0];
          const L = 150;
          const ex = X + dir[0] * L * lineT, ey = Y + dir[1] * L * lineT;

          return (
            <g key={i} opacity={o}>
              <circle cx={X} cy={Y} r={r} fill="none" stroke={col} strokeWidth={3}
                      opacity={0.35 + 0.65 * ring} />
              <circle cx={X} cy={Y} r={7} fill={col} />
              {lineT > 0.01 ? (
                <line x1={X + dir[0] * 34} y1={Y + dir[1] * 34} x2={ex} y2={ey}
                      stroke={col} strokeWidth={3} />
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* 라벨 — 지시선 끝에서 **밀려 나온다** (페이드가 아니라 마스크 슬라이드) */}
      {beats.map((b, i) => {
        if (i > idx || i < idx - 1) return null;
        const done = i === idx - 1;
        if (done && tMove >= 1) return null;
        const lt = done ? 1 : ease(Math.min(1, (settled - RING_F - LINE_F) / LABEL_F));
        if (lt <= 0.01) return null;
        let dir = b.side === 'left' ? [-1, 0] : b.side === 'up' ? [0, -1]
                : b.side === 'down' ? [0, 1] : [1, 0];
        const size = fit(b.label || '', 52, 560);
        const w = estWidth(b.label || '', size) + 40;
        // 화면 밖으로 나갈 방향이면 반대쪽으로 뒤집는다 — 가장자리 비트에서 라벨이 잘린다
        if (dir[0] > 0 && px(b) + 162 + w > 1860) dir = [-1, 0];
        else if (dir[0] < 0 && px(b) - 162 - w < 60) dir = [1, 0];
        const X = px(b) + dir[0] * 162, Y = py(b) + dir[1] * 162;
        const anchorX = dir[0] < 0 ? X - w : X;
        return (
          <div key={i} style={{position: 'absolute', left: anchorX, top: Y - 34,
                               width: w, opacity: done ? 1 - ease(tMove) : 1,
                               clipPath: `inset(0 ${(1 - lt) * 100}% 0 0)`}}>
            <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: size,
                         color: b.hot ? INK : '#FFFFFF', lineHeight: 1.2, whiteSpace: 'nowrap',
                         background: b.hot ? YELLOW : 'transparent',
                         padding: b.hot ? '4px 14px' : 0,
                         textShadow: b.hot ? 'none' : SHADOW}}>
              {b.label}
            </div>
            {b.sub ? (
              <div style={{marginTop: 6, fontFamily: 'A2Z Light, sans-serif', fontSize: 32,
                           color: '#E4E8EE', whiteSpace: 'nowrap', textShadow: SHADOW}}>
                {b.sub}
              </div>
            ) : null}
          </div>
        );
      })}

      {title ? (
        <div style={{position: 'absolute', top: 84, left: 0, width: 1920, textAlign: 'center',
                     opacity: fadeIn(frame, 0)}}>
          <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 66,
                       color: '#FFFFFF', textShadow: SHADOW, letterSpacing: '-0.01em'}}>{title}</div>
          {titleSub ? (
            <div style={{marginTop: 12, fontFamily: 'A2Z Light, sans-serif', fontSize: 34,
                         color: '#D8DDE4', textShadow: SHADOW}}>{titleSub}</div>
          ) : null}
        </div>
      ) : null}

      {/* 진행 표시 — 몇 군데 중 몇 번째인지. 타이틀 아래에 붙여 자막 영역을 피한다 */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {beats.map((b, i) => {
          const on = i <= idx;
          const cx0 = 960 - (beats.length - 1) * 22 + i * 44;
          return (
            <rect key={i} x={cx0 - (on ? 16 : 8)} y={(title ? 244 : 96)}
                  width={on ? 32 : 16} height={5} rx={2.5}
                  fill={on ? YELLOW : '#FFFFFF'} opacity={on ? 0.95 : 0.35} />
          );
        })}
      </svg>

      {source ? (
        <div style={{position: 'absolute', right: 44, top: 1028, textAlign: 'right',
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 23, letterSpacing: '0.05em',
                     color: '#FFFFFF', opacity: 0.8 * fadeIn(frame, 30), textShadow: SHADOW}}>
          {source}
        </div>
      ) : null}

      {debug ? (
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          <rect x={0} y={CONTENT_BOTTOM} width={1920} height={1080 - CONTENT_BOTTOM}
                fill="#FF0044" opacity={0.14} />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
