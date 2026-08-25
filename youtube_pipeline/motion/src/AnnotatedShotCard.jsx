import React from 'react';
import {AbsoluteFill, Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {YELLOW, INK, PaperSource, CONTENT_BOTTOM, fadeIn} from './paper';
import {estWidth, fit} from './layout';
import {HandArrow, DashCircle, DashBox, StampLabel} from './annotate';

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

const ease = (t) => {
  // 0~1 밖으로 나가면 안 된다. 음수를 그대로 넣으면 t²(3-2t) 가 **양수로 튀어**
  // 카메라가 아직 이동 중인데 라벨이 미리 떠 버린다 (실제로 겪음).
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

export const AnnotatedShotCard = ({
  image = '',
  imageRatio = 1.778,
  title = '', titleSub = '',
  beats = [],
  leadIn = 0.7,             // 첫 지점으로 들어가기 전 넓게 보여 주는 시간(초)
  pointer = 'arrow',        // 'arrow'(B1M 손그림 화살표) | 'ring'(도면식 링+직선)
                            // 'circle' 점선 원 = "여기가 문제다"
                            // 'box'    점선 사각 = **"이게 그거다"** (Cleo, §35-3 ③)
                            // 비트별로 b.pointer 로 덮어쓸 수 있다
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

  // 화면 위에서의 지점 좌표 (라벨·화살표를 여기에 건다)
  const px = (b) => 960 + (b.x - cx) * imgW;
  const py = (b) => 540 + (b.y - cy) * imgH;

  // 라벨이 붙는 방향. 화면 밖으로 나갈 방향이면 반대로 뒤집는다 —
  // 화살표와 라벨이 **같은 함수를 봐야** 서로 어긋나지 않는다.
  const dirOf = (b) => {
    let d = b.side === 'left' ? [-1, 0] : b.side === 'up' ? [0, -1]
          : b.side === 'down' ? [0, 1] : [1, 0];
    const w = estWidth(b.label || '', 54) + 44;
    if (d[0] > 0 && px(b) + 250 + w > 1860) d = [-1, 0];
    else if (d[0] < 0 && px(b) - 250 - w < 60) d = [1, 0];
    return d;
  };

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
          const grow = done ? 1 : ease(Math.min(1, settled / RING_F));
          if (grow <= 0) return null;
          const X = px(b), Y = py(b);
          const o = done ? 1 - ease(tMove) : 1;
          const col = b.hot ? YELLOW : '#FFFFFF';
          const mode = b.pointer || pointer;
          const dir = dirOf(b, i);
          const lineT = done ? 1 : ease(Math.min(1, (settled - RING_F) / LINE_F));

          if (mode === 'box') {
            // 대상을 사각으로 오려낸다. b.w / b.h 는 원본 이미지 기준 비율
            const bw = (b.w || 0.18) * imgW, bh = (b.h || 0.18) * imgH;
            return (
              <g key={i} opacity={o}>
                <DashBox x={X - bw / 2} y={Y - bh / 2} w={bw} h={bh}
                         progress={grow} color={col} frame={frame} />
              </g>
            );
          }
          if (mode === 'circle') {
            // 점선 원 — "여기가 비었다 / 여기가 문제다". 대상을 감싼다
            return (
              <g key={i} opacity={o}>
                <DashCircle cx={X} cy={Y} r={b.r || 96} progress={grow}
                            color={col} frame={frame} />
              </g>
            );
          }
          if (mode === 'arrow') {
            // B1M 기본형 — 라벨 쪽에서 대상까지 휜 화살표가 자라난다.
            // 링을 먼저 조이지 않는다. 화살표 하나가 링+지시선 역할을 다 한다.
            const sx = X + dir[0] * 236, sy = Y + dir[1] * 236 - 26;
            const tx = X - dir[0] * 30, ty = Y - dir[1] * 30;
            // 휘는 방향은 좌우에 따라 뒤집어야 늘 대상을 감싸며 들어간다
            const bow = (dir[0] !== 0 ? 74 : 92) * (dir[0] < 0 || dir[1] < 0 ? -1 : 1);
            return (
              <g key={i} opacity={o}>
                <HandArrow from={[sx, sy]} to={[tx, ty]} progress={grow}
                           bow={bow} color={col} width={15} head={40} />
              </g>
            );
          }
          // 'ring' — 도면·배치도용. 정확히 한 점을 찍어야 할 때만 쓴다
          const r = 62 - 30 * grow;
          const L = 150;
          const ex = X + dir[0] * L * lineT, ey = Y + dir[1] * L * lineT;
          return (
            <g key={i} opacity={o}>
              <circle cx={X} cy={Y} r={r} fill="none" stroke={col} strokeWidth={3}
                      opacity={0.35 + 0.65 * grow} />
              <circle cx={X} cy={Y} r={7} fill={col} />
              {lineT > 0.01 ? (
                <line x1={X + dir[0] * 34} y1={Y + dir[1] * 34} x2={ex} y2={ey}
                      stroke={col} strokeWidth={3} />
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* 라벨 — 화살표(또는 지시선) 끝에서 **밀려 나온다** (페이드가 아니라 마스크) */}
      {beats.map((b, i) => {
        if (i > idx || i < idx - 1) return null;
        const done = i === idx - 1;
        if (done && tMove >= 1) return null;
        const mode = b.pointer || pointer;
        // 화살표는 자라는 동안 이미 방향을 말해 주므로 라벨을 조금 일찍 띄운다
        const delay = mode === 'arrow' ? RING_F * 0.7 : RING_F + LINE_F;
        const lt = done ? 1 : ease(Math.min(1, (settled - delay) / LABEL_F));
        if (lt <= 0.01) return null;
        const dir = dirOf(b, i);
        const size = fit(b.label || '', 54, 560);
        const w = estWidth(b.label || '', size) + 44;
        const gap = mode === 'arrow' ? 250 : 162;
        const X = px(b) + dir[0] * gap, Y = py(b) + dir[1] * gap;
        const anchorX = dir[0] < 0 ? X - w : X;
        return (
          <div key={i} style={{position: 'absolute', left: anchorX, top: Y - 52,
                               width: w, opacity: done ? 1 - ease(tMove) : 1}}>
            {/* caps 를 주면 상자 없이 얇은 글씨 + 넓은 자간 (§40-4).
                깨끗한 실사 위에는 이쪽이 맞다 — 상자는 화면을 두 조각으로 자른다 */}
            <StampLabel top={b.label} sub={b.sub} size={size} hot={b.hot}
                        reveal={lt} box={b.box !== false} caps={b.caps === true} />
          </div>
        );
      })}

      {title ? (
        <div style={{position: 'absolute', top: 84, left: 0, width: 1920, textAlign: 'center',
                     opacity: fadeIn(frame, 0)}}>
          <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 66,
                       color: '#FFFFFF', textShadow: SHADOW, letterSpacing: '-0.01em'}}>{title}</div>
          {titleSub ? (
            <div style={{marginTop: 12, fontFamily: 'A2Z Light, sans-serif', fontSize: 34,
                         color: '#D8DDE4', textShadow: SHADOW}}>{titleSub}</div>
          ) : null}
        </div>
      ) : null}

      {/* 진행 표시 — 몇 군데 중 몇 번째인지. 타이틀 아래에 붙여 자막 영역을 피한다.
          **지점이 하나면 안 그린다** — 홀로 뜬 노란 조각은 진행을 뜻하지 못하고
          그냥 화면에 뭔가 잘못 남은 것처럼 보인다 (실제로 그렇게 보였다) */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0,
                                              display: beats.length > 1 ? 'block' : 'none'}}>
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

      {/* 출처는 채널 규칙대로 **우측 상단 · Source :**.
          이 카드만 지면 하단에 넣어 두어 다른 카드와 자리가 달랐다 */}
      <PaperSource source={source} theme="ink" />

      {debug ? (
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          <rect x={0} y={CONTENT_BOTTOM} width={1920} height={1080 - CONTENT_BOTTOM}
                fill="#FF0044" opacity={0.14} />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
