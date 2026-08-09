import React from 'react';
import {CONTENT_BOTTOM} from './paper';

// ── 레이아웃 엔진 ────────────────────────────────────────────────────────
// 이 세션에서 낸 수정의 대부분이 "top: 900 → 302", "AXIS_Y −40 → −66" 같은
// **좌표 손질**이었다. 하나 고치면 옆이 깨지고, 렌더해 봐야 알 수 있었다.
//
// 원인은 카드마다 y 를 상수로 박아 둔 것. 블록을 **흐르게** 만들면
//   - "조금 내려" = gap 하나 바꾸기
//   - 자막 안전영역 침범 = 구조적으로 불가능
// 이 된다. 좌표를 고치는 대신 **배치 규칙을 고치는** 방식으로 바꾼다.
//
// 텍스트를 실제로 재는 건 렌더 전에 못 하므로, 폰트 메트릭으로 결정론적으로
// 추정한다 (한글 1.0em / 라틴·숫자 0.56em). 카드 폭이 넉넉해 이 정도면 충분하고,
// 어긋나면 qa_check.py 의 픽셀 검사가 잡는다.

const CH_KO = 1.0, CH_LATIN = 0.56;

export const estWidth = (text, fontSize) =>
  String(text || '').split('').reduce(
    (a, c) => a + fontSize * (c.charCodeAt(0) > 0x1100 ? CH_KO : CH_LATIN), 0);

export const estLines = (text, fontSize, maxWidth) =>
  Math.max(1, Math.ceil(estWidth(text, fontSize) / Math.max(1, maxWidth)));

// 블록 한 개의 높이. {text, size, lh, maxWidth} 또는 {height}
export const blockHeight = (b) => {
  if (b == null) return 0;
  if (b.height != null) return b.height;
  if (!b.text) return 0;
  const lh = b.lh ?? 1.25;
  return Math.ceil(estLines(b.text, b.size, b.maxWidth ?? 1600) * b.size * lh);
};

/**
 * 위에서부터 블록을 흘려 y 좌표를 계산한다.
 *
 * blocks : [{key, text?, size?, lh?, maxWidth?, height?, gapBefore?}]
 * top    : 시작 y
 * bottom : 넘으면 안 되는 y (기본 = 자막 안전영역 위)
 * gap    : 기본 간격
 *
 * 총 높이가 bottom 을 넘으면 **간격부터 줄이고**, 그래도 넘치면 넘친 만큼을
 * 리턴값의 `overflow` 로 알려 준다 (카드가 폰트를 줄이는 데 쓴다).
 */
export const flow = ({blocks, top, bottom = CONTENT_BOTTOM, gap = 24, minGap = 8}) => {
  const hs = blocks.map(blockHeight);
  const gaps = blocks.map((b, i) => (i === 0 ? 0 : (b.gapBefore ?? gap)));
  const need = hs.reduce((a, h) => a + h, 0) + gaps.reduce((a, g) => a + g, 0);
  const room = bottom - top;

  let k = 1;
  if (need > room) {
    const gsum = gaps.reduce((a, g) => a + g, 0);
    const hsum = need - gsum;
    // 간격만 줄여서 들어갈 수 있으면 그렇게 한다 (글자 크기는 마지막 수단)
    k = gsum > 0 ? Math.max(0, Math.min(1, (room - hsum) / gsum)) : 0;
  }
  const scaled = gaps.map((g, i) => (i === 0 ? 0 : Math.max(minGap, g * k)));

  let y = top;
  const out = {};
  blocks.forEach((b, i) => {
    y += scaled[i];
    out[b.key] = {top: Math.round(y), height: hs[i]};
    y += hs[i];
  });
  out._end = Math.round(y);
  out._overflow = Math.max(0, Math.round(y - bottom));
  return out;
};

/**
 * 남은 자리에 맞춰 폰트 크기를 줄인다 — 라벨이 길어져도 레이아웃이 안 깨지게.
 * 카드 안에서 `fit(텍스트, 기준크기, 폭, 최소크기)` 로 쓴다.
 */
export const fit = (text, size, maxWidth, floor = 0.7) => {
  const w = estWidth(text, size);
  if (w <= maxWidth) return size;
  return Math.max(size * floor, Math.floor(size * maxWidth / w));
};

/** 개발 중에만 켜는 가이드 — 자막 안전영역과 흐름 경계를 눈으로 확인한다. */
export const LayoutGuide = ({show = false, marks = []}) => {
  if (!show) return null;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0, pointerEvents: 'none'}}>
      <rect x={0} y={CONTENT_BOTTOM} width={1920} height={1080 - CONTENT_BOTTOM}
            fill="#FF0044" opacity={0.12} />
      <line x1={0} y1={CONTENT_BOTTOM} x2={1920} y2={CONTENT_BOTTOM} stroke="#FF0044" strokeWidth={2} />
      {marks.map((y, i) => (
        <line key={i} x1={0} y1={y} x2={1920} y2={y} stroke="#00A0FF" strokeWidth={1} opacity={0.6} />
      ))}
    </svg>
  );
};
