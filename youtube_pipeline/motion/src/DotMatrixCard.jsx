import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, stageTop, titleH, LW, SP} from './paper';

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
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const n = groups.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

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
  let PITCH = 30, nCol = 4;
  for (let pitch = 30; pitch >= 7; pitch -= 1) {
    const c = Math.max(4, Math.min(cols, Math.floor((slot - 24) / pitch)));
    if (Math.ceil(fitDots / c) * pitch <= AVAIL_H) { PITCH = pitch; nCol = c; break; }
    PITCH = pitch; nCol = c;                          // 끝까지 못 맞으면 최소 간격
  }
  const R = Math.max(2.5, PITCH / 3);
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
