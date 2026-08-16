import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';
import {StampLabel} from './annotate';
import {fit} from './layout';

// ── 공유지분 → 분할 불가 → 경매 ─────────────────────────────────────────
// 부동산 콘텐츠에서 반복해서 나오는데 시청자에겐 낯선 개념이다.
// "여러 명이 나눠 갖고 있는데 나눌 수가 없어서 법원이 판다" — 이 문장은
// 세 번을 읽어야 이해되지만, 그림으로는 **세 컷이면 끝난다.**
//
//   ① 한 필지에 지분이 여러 개 — 칸을 나눠 각자 색을 준다
//   ② 자르려고 선을 그어 본다 → **선이 건물을 관통한다.** 그래서 못 자른다
//   ③ 그래서 통째로 판다 — 전체가 옐로로 바뀌고 도장이 찍힌다
//
// ②가 이 카드의 핵심이다. "합의가 안 된다"는 사람 얘기라 그림이 안 되지만,
// **"선을 그으면 건물이 잘린다"는 건 눈으로 보인다.** 물리적으로 못 나눈다는 걸
// 말이 아니라 도형으로 보여 주는 게 이 카드가 존재하는 이유다.
//
// n     : 지분권자 수
// cutAt / bidAt : ②·③이 시작하는 프레임
const SHARE_TONES = ['#8F97A3', '#B9BFC9', '#6E747C', '#A8B0BC', '#5C6470'];

export const ShareSplitCard = ({
  title = '', sub = '',
  n = 6, ownerLabel = '지분권자',
  cutLabel = '물리적 분할 불가', bidLabel = '법원 경매 · 공개 입찰',
  cutAt = 40, bidAt = 86,
  note = '', theme = 'paper', align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const dark = T.bg !== '#EFEAE3';

  const TOP = title ? (sub ? 300 : 246) : 178;
  const BOT = CONTENT_BOTTOM - 96;
  // 오른쪽에 문구가 앉을 자리를 남긴다 — 필지 안에 쓰면 지분 칸과 겹쳐 안 읽힌다
  const PW = 760, PH = Math.min(340, BOT - TOP - 120);
  const PX = 150;
  const PY = TOP + Math.max(0, (BOT - TOP - PH - 60) / 2) + 60;

  // 지분 칸 — 격자로 자른다. 실제 지분은 면적이 제각각이지만,
  // 여기서 말하려는 건 비율이 아니라 **"여럿이다"** 라서 균등하게 나눈다
  const cols = Math.ceil(Math.sqrt(n * 2.2));
  const rows = Math.ceil(n / cols);
  const cw = PW / cols, ch = PH / rows;

  const cutT = interpolate(frame, [cutAt, cutAt + 26], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const bidT = interpolate(frame, [bidAt, bidAt + 22], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const eB = bidT * bidT * (3 - 2 * bidT);

  // 건물 — 필지 한가운데. 자르는 선이 **반드시 이걸 지나가게** 놓는다
  const bw = PW * 0.30, bh = PH * 0.52;
  const bx = PX + PW / 2 - bw / 2, by = PY + PH / 2 - bh / 2;
  const cutX = PX + PW / 2;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* ① 지분 칸 */}
        {Array.from({length: n}, (_, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          const t = fadeIn(frame, 6 + i * 3);
          // 마지막 줄이 덜 찼으면 남은 칸을 나눠 채운다 — 필지에 빈 구멍이 생기면 안 된다
          const inRow = Math.min(cols, n - r * cols);
          const w = PW / inRow;
          return (
            <g key={i}>
              <rect x={PX + (i % cols >= inRow ? 0 : (i - r * cols) * w)} y={PY + r * ch}
                    width={w - 3} height={ch - 3}
                    fill={SHARE_TONES[i % SHARE_TONES.length]}
                    opacity={(dark ? 0.55 : 0.4) * t * (1 - eB * 0.85)} />
            </g>
          );
        })}

        {/* 필지 외곽 */}
        <rect x={PX} y={PY} width={PW - 3} height={PH - 3} fill="none"
              stroke={T.ink} strokeWidth={4} opacity={0.6 * fadeIn(frame, 4)} />

        {/* ③ 통째로 팔린다 — 전체가 옐로. 지분 색은 위에서 이미 흐려진다 */}
        {eB > 0.01 ? (
          <rect x={PX} y={PY} width={PW - 3} height={PH - 3}
                fill={YELLOW} opacity={0.55 * eB} />
        ) : null}

        {/* 건물 — 필지 위에 실선. 자르는 선이 여기를 지나야 한다 */}
        <rect x={bx} y={by} width={bw} height={bh}
              fill={dark ? '#2B3240' : '#FFFFFF'} opacity={0.9 * fadeIn(frame, 16)}
              stroke={T.ink} strokeWidth={3} />
        <text x={bx + bw / 2} y={by + 40} textAnchor="middle" fill={T.soft}
              fontSize={30} opacity={fadeIn(frame, 20)}
              style={{fontFamily: 'A2Z Light, sans-serif'}}>건물</text>

        {/* ② 자르려는 선 — 위아래에서 자라 들어와 건물 앞에서 멈추지 않고 관통한다 */}
        {cutT > 0.01 ? (
          <>
            <line x1={cutX} y1={PY - 26} x2={cutX} y2={PY - 26 + (PH + 52) * cutT}
                  stroke="#D94A2B" strokeWidth={5} strokeDasharray="16 12" opacity={0.95} />
            {cutT > 0.96 ? (
              <>
                {/* 관통 지점에 X — "여기서 막힌다" */}
                <g stroke="#D94A2B" strokeWidth={7} strokeLinecap="round"
                   opacity={fadeIn(frame, cutAt + 24)}>
                  <line x1={cutX - 26} y1={by + bh / 2 - 26} x2={cutX + 26} y2={by + bh / 2 + 26} />
                  <line x1={cutX + 26} y1={by + bh / 2 - 26} x2={cutX - 26} y2={by + bh / 2 + 26} />
                </g>
              </>
            ) : null}
          </>
        ) : null}
      </svg>

      {/* 지분권자 수 — 필지 위 */}
      <div style={{position: 'absolute', left: PX, top: PY - 62, opacity: fadeIn(frame, 8),
                   fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 38,
                   color: T.ink}}>
        {ownerLabel} {n}명 · 한 필지
      </div>

      {/* ② 라벨 — 빨강 X 옆. 상자 없이 (한 화면에 도장은 ③ 하나만) */}
      {cutT > 0.96 ? (
        <div style={{position: 'absolute', left: PX + PW + 56, top: by + bh / 2 - 34, width: 720,
                     opacity: fadeIn(frame, cutAt + 26),
                     fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif',
                     fontSize: fit(cutLabel, 42, 620), color: '#D94A2B', whiteSpace: 'nowrap'}}>
          {cutLabel}
        </div>
      ) : null}

      {/* ③ 도장 — 결론. 한 화면에 hot 은 이것뿐 */}
      {eB > 0.4 ? (
        <div style={{position: 'absolute', left: PX, top: PY + PH + 26,
                     opacity: fadeIn(frame, bidAt + 10)}}>
          <StampLabel top={bidLabel} size={44} hot align="left" />
        </div>
      ) : null}

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 150, top: CONTENT_BOTTOM - 6,
                     textAlign: 'center', opacity: fadeIn(frame, bidAt + 24),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 30, color: T.soft,
                     wordBreak: 'keep-all'}}>
          {note}
        </div>
      ) : null}

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
