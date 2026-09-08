import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, PaperCaption,
        YELLOW, CONTENT_BOTTOM, fadeIn, LW, FS} from './paper';

// ── 층 쌓기 ───────────────────────────────────────────────────────────────
// 한 건물 안에서 **층이 곧 기능**인 곳을 그린다.
//
// 니시아자부가 36층인 이유는 전망이 아니라 기능 분리다 — 1층 클리닉,
// 2·3층 돌봄, 4층 돌봄사업소, 9층 대욕장, 35·36층 다이닝. 이걸 말로 하면
// 층수의 나열이 되고, 그리면 **위아래로 옮겨 다니는 한 사람의 동선**이 된다.
// 그래서 이 카드는 이 영상에서 여러 번 돌아온다 — 3장에서 세우고,
// 5·6·7장에서 해당 층만 켠다. 매번 같은 탑이라 같은 건물로 읽힌다.
//
// 높이 기준선(markM)도 같은 탑 위에 긋는다. 60m 를 글자로 "두 배가 넘는다"
// 고 쓰는 대신 그 선을 실제로 긋고 탑이 그 위로 한참 더 올라가게 둔다.
//
// **미터로 그린다.** 층 높이는 heightM/floors 로 일정하게 잡는다. 층마다
// 실제 층고가 다르지만 그건 공개되지 않았고, 눈대중으로 다르게 그리면
// 그 차이가 내가 지어낸 값이 된다.
//
// props
//   floors    총 층수 (지상)
//   heightM   전체 높이(m). 축과 기준선이 이 값을 쓴다
//   zones     [{from, to, label, note, hot}] — from~to 층을 띠로 칠한다
//   markM     [{m, label}] — 높이 기준선. 점선 + 라벨
//   human     바닥에 1.7m 사람. 축척의 기준은 숫자가 아니라 사람이다
export const FloorStackCard = ({
  title = '', sub = '',
  floors = 36, heightM = 125,
  zones = [], markM = [],
  human = true,
  durationSec = 5,
  caption = '', source = '', theme, align = 'center', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);

  const BOT = CONTENT_BOTTOM - 34;
  const TOP = title ? 330 : 236;
  const H = BOT - TOP;                     // 탑 전체 높이(px)
  const mpp = H / heightM;                 // 1m 가 몇 px 인가
  const fH = H / floors;                   // 한 층
  // 띠·라벨이 없는 컷에서는 오른쪽이 통째로 빈다. 그럴 땐 탑을 가운데로
  // 옮기고 넓힌다 — 라벨 자리를 비워 두는 건 라벨이 있을 때 얘기다
  const bare = zones.length === 0;
  const TW = bare ? 420 : 320;
  const TX = bare ? (1920 - TW) / 2 : 372;
  const yOfFloor = (f) => BOT - f * fH;    // f층 **바닥**
  const yOfM = (m) => BOT - m * mpp;

  // 탑이 아래에서 위로 자란다. 층이 쌓이는 순서 그대로
  const rise = interpolate(frame, [6, 46], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const grownTo = BOT - H * rise;

  // ── 띠가 켜지는 속도는 **컷 길이가 정한다** ────────────────────────────
  // 처음엔 50 + i*7 프레임으로 못 박아 뒀다. 그런데 이 카드가 붙는 컷 중엔
  // 2.7초(81프레임)짜리가 있다 — 마지막 띠(35·36층 다이닝)가 90프레임에
  // 켜지니 그 컷에서는 **영영 안 나온다.** 컷이 짧으면 빨리 다 켠다
  // 스틸은 frame 78 에서 뽑는다(render_parkside). 그보다 늦게 켜지는 띠는
  // 검수 시트에 아예 안 나오고, 2.7초짜리 컷에서는 본편에서도 안 나온다.
  // **70프레임 안에 다 켠다** — 2.3초면 다섯 개가 차례로 서기에 충분하다
  const total = Math.max(30, Math.round(durationSec * 30));
  const zEnd = Math.min(62, total - 10);
  const zAt = (i) => (zones.length < 2 ? Math.max(8, zEnd - 12)
                      : Math.max(8, zEnd - (zones.length - 1 - i) * ((zEnd - 24) / (zones.length - 1))));

  // ── 라벨 자리 ─────────────────────────────────────────────────────────
  // 아래로만 밀면 안 된다. 1·2·3·4층 띠는 바닥에 몰려 있어서, 겹치지 말라고
  // 96px 씩 내리면 마지막 라벨이 **자막 안전선 아래로** 내려간다 (실제로
  // 1F 라벨이 y=1000 까지 내려갔다). 아래로 민 뒤, 넘친 만큼 전체를 올린다
  const GAP = 92, LIM = CONTENT_BOTTOM - 66, HI = TOP + 16;
  const order = zones
    .map((z, i) => ({i, y: (yOfFloor(z.to) + yOfFloor(z.from - 1)) / 2}))
    .sort((a, b) => a.y - b.y);
  const labY = {};
  // ① 위에서 아래로 — 겹치면 아래로 민다
  let prev = -1e9;
  for (const e of order) { labY[e.i] = Math.max(e.y, prev + GAP); prev = labY[e.i]; }
  // ② 아래에서 위로 — 자막 안전선을 넘은 만큼 **되올린다.**
  // ①만 돌리면 바닥에 몰린 띠(1·2·3·4층)의 라벨이 줄줄이 화면 밖으로 나간다.
  // 한 번 내려 보고 넘치면 다시 올리는 두 번 훑기가 있어야 자리가 잡힌다
  let next = LIM + GAP;
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k].i;
    labY[i] = Math.max(HI, Math.min(labY[i], next - GAP));
    next = labY[i];
  }

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      {title ? <PaperTitle title={title} sub={sub} theme={theme} align={align} /> : null}

      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <defs>
          {/* 자라는 동안만 위를 가린다. 다 자라면 마스크가 방해되지 않게 전체를 연다 */}
          <clipPath id="fs-grow">
            <rect x="0" y={grownTo} width="1920" height={BOT - grownTo + 4} />
          </clipPath>
        </defs>

        {/* 지반선 */}
        <line x1={TX - 120} y1={BOT} x2={1560} y2={BOT}
              stroke={T.ink} strokeWidth={LW.THIN} opacity={0.5} />

        <g clipPath="url(#fs-grow)">
          {/* 층 슬래브 — 한 장씩 그린다. 통짜 상자로 그리면 '층'이 안 보인다 */}
          {[...Array(floors)].map((_, i) => (
            <line key={i} x1={TX} y1={yOfFloor(i + 1)} x2={TX + TW} y2={yOfFloor(i + 1)}
                  stroke={T.ink} strokeWidth={1} opacity={0.22} />
          ))}
          <rect x={TX} y={TOP} width={TW} height={H} fill="none"
                stroke={T.ink} strokeWidth={LW.THIN} opacity={0.75} />

          {/* 기능 띠 */}
          {zones.map((z, i) => {
            const y = yOfFloor(z.to), h = Math.max(4, (z.to - z.from + 1) * fH);
            const on = fadeIn(frame, zAt(i), 12);
            return (
              <g key={i} opacity={on}>
                <rect x={TX} y={y} width={TW} height={h}
                      fill={z.hot ? YELLOW : T.ink}
                      opacity={z.hot ? 1 : 0.24} />
                <rect x={TX} y={y} width={TW} height={h} fill="none"
                      stroke={T.ink} strokeWidth={z.hot ? LW.THIN : 1} />
              </g>
            );
          })}
        </g>

        {/* 높이 기준선 — 탑을 가로질러 오른쪽 라벨까지 이어 긋는다 */}
        {markM.map((m, i) => {
          const y = yOfM(m.m);
          return (
            <g key={i} opacity={fadeIn(frame, 62 + i * 8, 12)}>
              <line x1={TX - 96} y1={y} x2={1500} y2={y}
                    stroke={T.ink} strokeWidth={LW.THIN} strokeDasharray="10 8" opacity={0.62} />
            </g>
          );
        })}

        {/* 띠 → 라벨 지시선 */}
        {zones.map((z, i) => {
          const y = (yOfFloor(z.to) + yOfFloor(z.from - 1)) / 2;
          return (
            <polyline key={i}
                      points={`${TX + TW},${y} ${TX + TW + 44},${y} ${TX + TW + 78},${labY[i]} ${TX + TW + 108},${labY[i]}`}
                      fill="none" stroke={T.ink} strokeWidth={LW.HAIR} opacity={0.5 * fadeIn(frame, zAt(i) + 4, 12)} />
          );
        })}

        {/* 사람 1.7m — 축척의 기준 */}
        {human ? (() => {
          const hh = Math.max(6, 1.7 * mpp), x = TX - 46;
          return (
            <g opacity={fadeIn(frame, 44, 14)}>
              <circle cx={x} cy={BOT - hh * 0.86} r={hh * 0.15} fill={T.ink} />
              <line x1={x} y1={BOT - hh * 0.72} x2={x} y2={BOT} stroke={T.ink} strokeWidth={2} />
            </g>
          );
        })() : null}
      </svg>

      {/* 층·기능 라벨 */}
      {zones.map((z, i) => (
        <div key={i} style={{position: 'absolute', left: TX + TW + 118, top: labY[i] - 34,
                             width: 620, opacity: fadeIn(frame, zAt(i) + 6, 12)}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
            <span style={{fontFamily: 'A2Z Bold, A2Z Medium, sans-serif', fontSize: FS.LABEL,
                          color: T.ink, letterSpacing: '-0.01em',
                          background: z.hot ? YELLOW : 'transparent',
                          padding: z.hot ? '2px 10px' : 0}}>
              {z.from === z.to ? `${z.from}F` : `${z.from}–${z.to}F`}
            </span>
            <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: FS.LABEL,
                          color: T.ink, letterSpacing: '-0.01em', wordBreak: 'keep-all'}}>
              {z.label}
            </span>
          </div>
          {z.note ? (
            <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: FS.SMALL,
                         color: T.soft, wordBreak: 'keep-all'}}>{z.note}</div>
          ) : null}
        </div>
      ))}

      {/* 높이 기준선 라벨 — 선 위에 얹는다 */}
      {markM.map((m, i) => (
        <div key={i} style={{position: 'absolute', left: TX - 96, top: yOfM(m.m) - 44,
                             width: 420, opacity: fadeIn(frame, 64 + i * 8, 12)}}>
          <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: FS.SMALL,
                       color: T.soft, wordBreak: 'keep-all'}}>{m.label}</div>
        </div>
      ))}

      {/* 전체 높이 — 탑 왼쪽 위 */}
      <div style={{position: 'absolute', left: TX - 250, top: TOP - 12, width: 230,
                   textAlign: 'right', opacity: fadeIn(frame, 30, 14)}}>
        <div style={{fontFamily: 'A2Z Bold, A2Z Medium, sans-serif', fontSize: FS.HERO,
                     color: T.ink, letterSpacing: '-0.03em', lineHeight: 1}}>
          {heightM}<span style={{fontSize: FS.LEAD}}>m</span>
        </div>
        <div style={{marginTop: 6, fontFamily: 'A2Z Light, sans-serif', fontSize: FS.SMALL,
                     color: T.soft}}>지상 {floors}층</div>
      </div>

      {caption ? <PaperCaption theme={theme}>{caption}</PaperCaption> : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
