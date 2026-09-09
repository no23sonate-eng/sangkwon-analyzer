import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, PaperCaption, YELLOW, CONTENT_BOTTOM, fadeIn, stageTop, titleH, LW, SP} from './paper';

// 점 격자 카드 — 숫자를 막대 길이가 아니라 **개수 그 자체**로 보여준다.
// 청약 경쟁률(모집 대 접수)처럼 "몇 대 몇"이 셀 수 있는 양일 때, 점이 하나씩
// 찍히는 것만으로 초과 물량이 눈에 들어온다.
// groups: [{label, value, sub, hot}] / perDot: 점 하나가 몇을 뜻하는지
export const DotMatrixCard = ({
  title = '', sub = '', groups = [], perDot = 10, cols = 13,
  // merge=true 면 **한 덩어리**로 그린다.
  // 두 블록을 나란히 놓으면 '590 과 147' 이라는 두 수의 비교가 되는데,
  // 원래 하려던 말은 '737 중에 147 이 꺼졌다' 다. 전체를 먼저 깔고
  // 그중 일부를 흐리게 해야 **사라졌다는 게** 보인다
  merge = false,
  unit = '', source = '', caption = '',
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
  // over — 이름·숫자를 점판 **위 한가운데**에 얹는다. 점 아래에 두면
  // 눈이 판을 다 훑고 내려가서야 무엇을 센 건지 알게 된다 (#3)
  over = false,
  // legend='right' — 점판은 **왼쪽**, 이름·숫자는 **오른쪽에 세로로** 쌓는다.
  // over 로 판 위에 얹었더니 글자가 점을 가려 정작 센 것이 안 보였다 (#3).
  // 판과 범례가 자리를 나눠 가지면 둘 다 온전히 보인다
  legend = '',
  // shape='person' — 점 대신 사람 모양. 'auto' 면 셀 것이 열 개 이하일 때만
  shape = 'auto',
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const n = groups.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  // ── 세는 수가 몇 개뿐일 때: 점이 아니라 사람으로 ────────────────────────
  // 이 카드의 문법은 **깔린 판** 이다 — 수백 개 중 얼마가 켜졌나. 그런데
  // '다섯 중 하나' 를 같은 문법으로 그리면 지름 70px 짜리 동그라미 다섯 개가
  // 화면 왼쪽에 옹기종기 모이고 오른쪽에 글자가 따로 서서, 판도 아니고
  // 그림도 아닌 것이 된다 (#1). 셀 것이 열 몇 개 안쪽이면 **사람 모양**으로
  // 크게 그린다 — 어차피 이 컷이 세는 건 사람이다.
  // 세로 배치도 뒤집는다: 수치가 위, 사람이 아래, 바닥선 하나에 나란히.
  const dotCount = groups.reduce((a, g) => a + Math.max(1, Math.round(g.value / perDot)), 0);
  const asPeople = shape === 'person' || (shape === 'auto' && dotCount <= 10);
  if (asPeople) {
    const BASE = CONTENT_BOTTOM - 44;
    const headH = titleH(title, sub);
    const heads = groups.filter((g) => g.display);
    const headBlock = heads.length ? 58 + 132 + SP.GAP : 0;
    const top = (title ? headH + 56 : 0) + (title ? 150 : 210);
    // 사람 키는 남은 높이와 가로 폭 양쪽에 맞춘다 (몸 폭 0.455H · 사이 0.30H)
    const WU = 0.455, GU = 0.30;
    const H = Math.min(
      360,
      BASE - (top + headBlock) - 20,
      Math.floor(1560 / (WU * dotCount + GU * Math.max(0, dotCount - 1))),
    );
    const W = H * WU, GAP = H * GU;
    const totalW = dotCount * W + (dotCount - 1) * GAP;
    const x0 = (1920 - totalW) / 2;
    // 어느 자리가 어느 그룹 몫인지 — 앞 그룹부터 채운다
    const owner = [];
    for (const g of groups) {
      const nd = Math.max(1, Math.round(g.value / perDot));
      for (let k = 0; k < nd; k++) owner.push(g);
    }
    return (
      <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
        <PaperBg theme={theme} {...bg} />
        <PaperTitle title={title} sub={sub} theme={theme} align={align} />
        {heads.length ? (
          <div style={{position: 'absolute', left: 180, width: 1560, top,
                       textAlign: 'center'}}>
            {heads.map((g, gi) => (
              <div key={gi} style={{marginTop: gi ? SP.GAP : 0,
                                    opacity: fadeIn(frame, 4 + gi * 10)}}>
                <div style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 40,
                             color: T.soft, letterSpacing: '0.01em'}}>{g.label}</div>
                <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Medium, sans-serif',
                             fontSize: 132, lineHeight: 1.04, color: T.ink,
                             letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums'}}>
                  {g.display}<span style={{fontSize: 64, marginLeft: 6}}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          <line x1={x0 - 40} y1={BASE + 2} x2={x0 + totalW + 40} y2={BASE + 2}
                stroke={T.ink} strokeWidth={LW.THIN} opacity={0.35 * fadeIn(frame, 6)} />
          {owner.map((g, k) => {
            const o = fadeIn(frame, 14 + k * 7, 12);
            if (o <= 0) return null;
            const gone = g.gone;
            return (
              <g key={k} opacity={o * (gone ? 0.34 : 1)}
                 transform={`translate(${x0 + k * (W + GAP)} ${BASE - H}) scale(${W / 100} ${H / 220})`}>
                <g fill={gone ? T.tones[0] : (g.hot ? YELLOW : T.tones[3])}
                   stroke={gone ? 'none' : T.ink} strokeWidth={g.hot ? 4 : 3}
                   strokeLinejoin="round">
                  <circle cx={50} cy={30} r={27} />
                  <path d="M50 64 c-21 0-35 15-35 35 v50 h70 v-50 c0-20-14-35-35-35 z" />
                  <rect x={20} y={146} width={23} height={74} rx={7} />
                  <rect x={57} y={146} width={23} height={74} rx={7} />
                </g>
              </g>
            );
          })}
        </svg>
        {caption ? <PaperCaption theme={theme}>{caption}</PaperCaption> : null}
        <PaperSource source={source} theme={theme} />
      </AbsoluteFill>
    );
  }

  // 열 수와 점 크기를 그대로 믿지 않는다. 737개를 1:1 로 그리라고 하면
  // 격자가 화면 밖으로 나가는데 **렌더는 성공한다** — 시트에서야 안다.
  // 폭과 높이 양쪽에 맞을 때까지 점 간격을 줄인다. 점 개수는 안 건드린다:
  // 개수가 곧 뜻이라 임의로 줄이면 그림이 거짓말이 된다
  const side = legend === 'right';
  // 옆에 범례를 세우면 판이 쓸 수 있는 폭이 절반으로 준다. 대신 아래
  // 라벨 자리는 필요 없어져 높이를 다 쓴다
  const FIELD_L = 190, FIELD_W = 840;                 // 왼쪽 점판이 쓰는 자리
  const LEG_L = 1120, LEG_W = 620;                    // 오른쪽 범례
  const bandTop = title ? 330 : 210;
  const slot = side ? FIELD_W : Math.min(760, 1560 / n);
  const AVAIL_H = CONTENT_BOTTOM - bandTop - (side ? 20 : 96);   // 아래 수치·라벨 자리
  const dotsAll = groups.reduce((s, g) => s + Math.max(1, Math.round(g.value / perDot)), 0);
  const maxDots = Math.max(...groups.map((g) => Math.max(1, Math.round(g.value / perDot))));
  // **merge 면 이어 붙인 전체 개수로 재야 한다.** 예전엔 가장 큰 그룹(590)
  // 기준으로 자리를 맞춰 놓고 737개를 그렸다 — 아래 두 줄이 자막 영역까지
  // 흘러내렸는데 렌더는 그대로 성공했다 (#3)
  const fitDots = merge ? dotsAll : maxDots;
  // **위에서부터 내려온다.** 예전엔 30 에서 시작해서, 점이 몇 개 안 되는
  // 판(‘다섯 중 하나’ 같은)도 지름 20px 짜리 좁쌀로 그려졌다. 셀 게 적을수록
  // 점은 커야 한다 — 적은 수를 세는 판에서 점이 작으면 셀 것이 없어 보인다
  let PITCH = 30, nCol = 4;
  for (let pitch = 108; pitch >= 7; pitch -= 1) {
    const c = Math.max(4, Math.min(cols, Math.floor((slot - 24) / pitch)));
    if (Math.ceil(fitDots / c) * pitch <= AVAIL_H) { PITCH = pitch; nCol = c; break; }
    PITCH = pitch; nCol = c;                          // 끝까지 못 맞으면 최소 간격
  }
  // 점 반지름이 PITCH/3 이면 점 사이 틈이 지름의 절반뿐이라, 수백 개가
  // 깔린 판은 셀 수 있는 알갱이가 아니라 **덩어리**로 뭉쳐 보인다 (#237).
  // 조금 줄여 틈을 벌린다 — 세라고 만든 판이니 알갱이가 떨어져 보여야 한다
  const R = Math.max(2.5, PITCH * 0.28);
  const blockW = nCol * PITCH;
  const startX = side ? FIELD_L + FIELD_W / 2 : (1920 - slot * n) / 2 + slot / 2;
  // 그룹마다 행 수가 달라도 수치·라벨은 **가장 큰 격자 아래 한 줄**에 맞춘다.
  // 제각각 높이에 두면 격자 크기 차이가 아니라 배치 실수처럼 보인다.
  const maxRows = merge
    ? Math.ceil(dotsAll / nCol)
    : Math.max(...groups.map((g) => Math.ceil(Math.max(1, Math.round(g.value / perDot)) / nCol)));
  // 격자 높이를 안 뒤에야 자리를 정할 수 있다. 판(과 아래 라벨)을 한
  // 덩어리로 보고 띠 가운데에 앉힌다
  const fieldH = (maxRows - 1) * PITCH + R * 2;
  const TOP = stageTop(fieldH + (side ? 0 : 96), {top: bandTop}) + R;
  const LABEL_Y = TOP + (maxRows - 1) * PITCH + R + 38;
  const FIELD_MID = TOP + ((maxRows - 1) * PITCH) / 2;
  // 점이 순서대로 찍히는 속도 (그룹마다 살짝 시차)
  const dotsOf = (v) => Math.max(1, Math.round(v / perDot));

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {merge ? (() => {
          // 한 격자에 이어 붙인다. 앞 그룹부터 채우고, 각 점의 색은
          // 그 점이 어느 그룹 몫인지로 정한다
          const cx0 = (side ? FIELD_L + (FIELD_W - nCol * PITCH) / 2
                            : (1920 - nCol * PITCH) / 2) + PITCH / 2;
          const per = 52 / Math.max(1, dotsAll);
          let acc = 0;
          const bands = groups.map((g) => {
            const nd = Math.max(1, Math.round(g.value / perDot));
            const from = acc; acc += nd;
            return {g, from, to: acc};
          });
          return Array.from({length: dotsAll}, (_, k) => {
            const o = fadeIn(frame, 16 + k * per, 6);
            if (o <= 0) return null;
            const b = bands.find((x) => k >= x.from && k < x.to) || bands[0];
            const r = Math.floor(k / nCol), c = k % nCol;
            const gone = b.g.gone;                 // 사라진 몫 — 흐린 회색
            return (
              <circle key={k} cx={cx0 + c * PITCH} cy={TOP + r * PITCH} r={R}
                      fill={gone ? T.tones[0] : (b.g.hot ? YELLOW : T.tones[3])}
                      stroke={gone ? 'none' : T.ink} strokeWidth={LW.HAIR}
                      opacity={o * (gone ? 0.34 : 1)} />
            );
          });
        })() : groups.map((g, gi) => {
          const total = dotsOf(g.value);
          const cx0 = startX + gi * slot - blockW / 2 + PITCH / 2;
          const t0 = 16 + gi * 14;
          const per = 46 / total;              // 전체 46프레임 안에 다 찍힌다
          return (
            <g key={gi}>
              {Array.from({length: total}, (_, k) => {
                const o = fadeIn(frame, t0 + k * per, 6);
                if (o <= 0) return null;
                const r = Math.floor(k / nCol), c = k % nCol;
                return (
                  <circle key={k} cx={cx0 + c * PITCH} cy={TOP + r * PITCH} r={R}
                          fill={g.hot ? YELLOW : T.tones[3]} stroke={T.ink} strokeWidth={LW.HAIR}
                          opacity={o} />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* 범례를 오른쪽에 세로로 — 위에서 아래로 groups 순서 그대로.
          점 색을 그대로 앞에 찍어 어느 색이 무엇인지 글자 없이 잇는다 */}
      {side ? (
        <div style={{position: 'absolute', left: LEG_L, width: LEG_W,
                     top: FIELD_MID, transform: 'translateY(-50%)'}}>
          {groups.map((g, gi) => (
            <div key={gi} style={{marginTop: gi ? SP.BAND : 0,
                                  opacity: fadeIn(frame, 26 + gi * 16)}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                <svg width={26} height={26} style={{flex: 'none'}}>
                  <circle cx={13} cy={13} r={11}
                          fill={g.gone ? T.tones[0] : (g.hot ? YELLOW : T.tones[3])}
                          stroke={g.gone ? 'none' : T.ink} strokeWidth={LW.THIN}
                          opacity={g.gone ? 0.34 : 1} />
                </svg>
                <div style={{fontFamily: g.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                             fontSize: 44, color: T.ink, wordBreak: 'keep-all'}}>{g.label}</div>
              </div>
              <div style={{marginTop: SP.TIGHT, marginLeft: 42,
                           fontFamily: 'A2Z Medium, sans-serif', fontSize: 96, color: T.ink,
                           lineHeight: 1.02, letterSpacing: '-0.02em',
                           fontVariantNumeric: 'tabular-nums'}}>
                {(g.display ?? g.value).toLocaleString?.() ?? g.display ?? g.value}
                <span style={{fontSize: 52, marginLeft: 4}}>{unit}</span>
              </div>
              {g.sub ? (
                <div style={{marginTop: 6, marginLeft: 42, fontFamily: 'A2Z Light, sans-serif',
                             fontSize: 32, color: T.soft, wordBreak: 'keep-all'}}>{g.sub}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : groups.map((g, gi) => {
        const L = merge ? (1920 - nCol * PITCH) / 2 + gi * (nCol * PITCH / groups.length)
                        : startX + gi * slot - slot / 2;
        const Wd = merge ? nCol * PITCH / groups.length : slot;
        return (
          <div key={gi} style={{position: 'absolute', left: L, width: Wd,
                                top: over ? FIELD_MID - 84 : LABEL_Y, textAlign: 'center',
                                opacity: fadeIn(frame, 26 + gi * 14),
                                // 점 위에 그냥 얹으면 글자가 점에 파묻힌다.
                                // 상자를 그리면 판에 딱지를 붙인 꼴이라,
                                // 글자 뒤만 바탕색으로 부드럽게 눌러 준다
                                ...(over ? {padding: '18px 8px', background:
                                  `linear-gradient(180deg, ${T.bg}00 0%, ${T.bg}f2 16%, ${T.bg}f2 84%, ${T.bg}00 100%)`} : {})}}>
            {/* **이름이 먼저, 숫자가 다음.** 숫자를 위에 두면 무엇을 세는
                숫자인지 모르는 채로 읽게 된다 — #3 "남은 객실을 위로 올리고
                그 아래 590실" */}
            <div style={{fontFamily: g.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                         fontSize: 42, color: T.ink, wordBreak: 'keep-all'}}>
              {g.label}
            </div>
            <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Medium, sans-serif',
                         fontSize: 76, color: T.ink,
                         lineHeight: 1.05, fontVariantNumeric: 'tabular-nums'}}>
              {(g.display ?? g.value).toLocaleString?.() ?? g.display ?? g.value}
              <span style={{fontSize: 46, marginLeft: 4}}>{unit}</span>
            </div>
            {g.sub ? (
              <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: 32, color: T.soft, wordBreak: 'keep-all'}}>
                {g.sub}
              </div>
            ) : null}
          </div>
        );
      })}

      {caption ? (
        <div style={{position: 'absolute', left: 0, width: 1920, top: TOP - 62, textAlign: 'center',
                     opacity: fadeIn(frame, 10), fontFamily: 'A2Z Light, sans-serif',
                     fontSize: 32, color: T.soft, letterSpacing: '0.04em'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
