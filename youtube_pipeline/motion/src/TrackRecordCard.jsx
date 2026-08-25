import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {PaperBg, PaperTitle, PaperSource, themeOf, INK, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';
import {flow, fit, estWidth} from './layout';

// ── 이력 카드 ────────────────────────────────────────────────────────────
// 부동산·건설 영상에서 계속 나오는 말이 "이 회사가 뭘 했는데?" 다.
// 그런데 레퍼런스 프로젝트는 **대부분 쓸 수 있는 사진이 없다** —
// 한남더힐·트리마제·에테르노 청담을 CC 로 구할 수 없다. (검색하면 호주 식료품점이 나온다)
//
// 사진이 없을 때 이름을 나열하는 방법은 두 가지뿐이다.
//   ① 그냥 텍스트로 늘어놓는다 → 목록으로 읽히고 무게가 안 실린다
//   ② **하나씩 도장 찍듯 떨어뜨린다** → 이력이 쌓이는 것으로 읽힌다
// 이 카드는 ②다. 각 항목이 왼쪽 기준선에서 밀려 나오며 순번이 먼저 찍힌다.
//
// name  : 회사·주체
// role  : 그 아래 한 줄 설명
// items : [{label, note}] — 레퍼런스
export const TrackRecordCard = ({
  title = '', sub = '',
  name = '', role = '',
  items = [],
  source = '', theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const n = items.length;

  const TOP = title ? (sub ? 300 : 244) : 190;
  const BOT = CONTENT_BOTTOM - 20;
  const L = flow({
    blocks: [
      {key: 'name', text: name, size: 76, maxWidth: 1500, lh: 1.15},
      {key: 'role', text: role, size: 36, maxWidth: 1400, gapBefore: 12},
      {key: 'list', height: n * 96, gapBefore: 46},
    ],
    top: TOP,
    bottom: BOT,
    gap: 24,
  });
  // flow 는 위에서부터 쌓기만 해서 항목이 적으면 아래가 통째로 빈다.
  // 쓴 높이를 재서 남는 만큼 절반 내린다 — 띠 한가운데에 앉게.
  const usedBot = L.list.top + n * 96 - 40;
  const DY = Math.max(0, Math.round((BOT - usedBot) / 2));

  // ── 가로 위치 ──
  // 예전엔 X=300 에 왼쪽으로 박아 놨더니 오른쪽이 휑했다. 가장 긴 줄을 재서
  // 덩어리째 가운데에 놓는다.
  const rowW = (it) => {
    const sz = fit(it.label || '', 56, 1100);
    return estWidth(it.label || '', sz) + (it.note ? 34 + estWidth(it.note, 30) : 0);
  };
  const widest = Math.max(estWidth(name, fit(name, 76, 1440)),
                          ...(n ? items.map(rowW) : [0]));
  // 덩어리의 실제 왼쪽 끝은 세로선(X-104), 오른쪽 끝은 X+widest.
  // 그 한가운데가 960 이 되도록 X 를 푼다.
  const X = Math.min(900, Math.max(220, Math.round(1012 - widest / 2)));

  // 순번은 **세로선 오른쪽**에 놓는다. 예전엔 선 한가운데에 겹쳐 찍혀서
  // 01·02 가 선에 먹혀 안 보였다 (검수 지적).
  const RULE_X = X - 104;
  const NUM_X = RULE_X + 16;
  const rowY = (i) => L.list.top + DY + i * 96;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      {/* 주체 이름 — 이력의 주어. 가장 크게 */}
      <div style={{position: 'absolute', left: X, width: 1500, top: L.name.top + DY,
                   opacity: fadeIn(frame, 4)}}>
        <div style={{fontFamily: 'A2Z Medium, sans-serif',
                     fontSize: fit(name, 76, 1440), color: T.ink, lineHeight: 1.15,
                     wordBreak: 'keep-all'}}>
          {name}
        </div>
      </div>
      {role ? (
        <div style={{position: 'absolute', left: X, width: 1400, top: L.role.top + DY,
                     opacity: fadeIn(frame, 12), fontFamily: 'A2Z Light, sans-serif',
                     fontSize: 36, color: T.soft, wordBreak: 'keep-all'}}>
          {role}
        </div>
      ) : null}

      {/* 기준선 — 항목이 여기 걸린다. 위에서 아래로 그어진다 */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {n > 0 ? (
        <line x1={RULE_X} y1={L.list.top + DY + 10} x2={RULE_X}
              y2={L.list.top + DY + 10 + (n * 96 - 40) * interpolate(
                frame, [26, 26 + Math.max(1, n * 8)], [0, 1],
                {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
              stroke={T.ink} strokeWidth={3} opacity={0.35} />
        ) : null}
      </svg>

      {items.map((it, i) => {
        const t = interpolate(frame, [30 + i * 11, 46 + i * 11], [0, 1],
                              {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const e = t * t * (3 - 2 * t);
        const y = rowY(i);
        const size = fit(it.label || '', 56, 1100);
        return (
          <React.Fragment key={i}>
            {/* 순번이 먼저 찍히고 */}
            <div style={{position: 'absolute', left: NUM_X, top: y + 4, width: 56,
                         textAlign: 'left', opacity: e,
                         fontFamily: 'A2Z Light, sans-serif', fontSize: 26, color: T.soft}}>
              {String(i + 1).padStart(2, '0')}
            </div>
            {/* 이름이 기준선에서 밀려 나온다 (페이드가 아니라 마스크) */}
            <div style={{position: 'absolute', left: X, top: y,
                         width: estWidth(it.label || '', size) + 40,
                         clipPath: `inset(0 ${(1 - e) * 100}% 0 0)`}}>
              <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: size,
                           color: T.ink, lineHeight: 1.2, whiteSpace: 'nowrap'}}>
                <span style={{background: it.hot ? YELLOW : 'none', color: it.hot ? INK : T.ink,
                              padding: it.hot ? '2px 12px' : 0}}>{it.label}</span>
              </div>
            </div>
            {it.note ? (
              <div style={{position: 'absolute', left: X + estWidth(it.label || '', size) + 34,
                           top: y + size * 0.42, opacity: fadeIn(frame, 38 + i * 11),
                           fontFamily: 'A2Z Light, sans-serif', fontSize: 30, color: T.soft,
                           whiteSpace: 'nowrap'}}>
                {it.note}
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
