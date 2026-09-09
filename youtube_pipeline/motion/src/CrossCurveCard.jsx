import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, PaperCaption,
        YELLOW, CONTENT_BOTTOM, fadeIn, LW, FS, useFitEnd, useFade} from './paper';

// ── 교차 곡선 ─────────────────────────────────────────────────────────────
// 두 값이 시간 위에서 **자리를 바꾸는** 순간을 그린다.
// 막대 두 개로는 "지금 누가 크냐" 밖에 안 남는다. 앞지르는 건 **기울기**라
// 선으로 그려야 보이고, 앞지르는 **시점**은 두 선이 만나는 자리로만 보인다.
//
// 니시아자부 편 후크가 이 카드를 쓴다 — 한국은 지금 20%, 일본은 29%.
// 숫자만 보면 일본이 훨씬 앞선 얘기인데, 2045년에 한국이 넘어선다.
// "우리가 더 빠르다" 를 글자로 쓰지 않고 기울기로 보이게 하는 자리다.
//
// 그리는 순서가 곧 뜻이다:
//   ① 두 선이 왼쪽부터 함께 자라고
//   ② 교차점에서 멈칫하며 표식이 서고
//   ③ 끝점 라벨이 붙는다
// 한꺼번에 띄우면 "앞질렀다" 가 아니라 "이렇게 생겼다" 가 된다.
//
// props
//   xTicks   축에 적을 해 (전부 적지 않는다 — 뜻이 있는 해만)
//   series   [{label, points: [[x,y],…], hot, endLabel}]
//            hot 인 계열이 주인공. 굵은 먹선. 나머지는 흐린 선
//   cross    {x, label} 교차점. 이 카드에서 **노랑은 여기 한 군데뿐이다**
//   note     곡선 모양이 실측이 아니라 전망이면 반드시 적는다
export const CrossCurveCard = ({
  title = '', sub = '',
  xFrom = 2000, xTo = 2050, xTicks = [],
  yFrom = 0, yTo = 40, yUnit = '%',
  series = [], cross = null,
  caption = '', note = '',
  source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const fitEnd = useFitEnd();
  const fade = useFade();
  const T = themeOf(theme);

  // 판. 아래는 자막 안전선(904)에서 캡션 두 줄을 빼고 잡는다
  // R 이 1690 이었다. 끝점 라벨은 px(마지막해)+26 에서 폭 260 으로 그리니까
  // 1716~1976 — **화면(1920) 밖으로 나갔다.** '37%' 의 오른쪽이 잘렸다 (#6).
  // 판을 왼쪽으로 물려 라벨 자리를 화면 안에 확보한다
  const L = 250, R = 1500, TOP = title ? 356 : 268, BOT = CONTENT_BOTTOM - 118;
  const px = (x) => L + ((x - xFrom) / (xTo - xFrom)) * (R - L);
  const py = (y) => BOT - ((y - yFrom) / (yTo - yFrom)) * (BOT - TOP);

  // 선이 자라는 구간. 26프레임(0.87초)이면 눈이 왼쪽부터 따라간다
  const grow = interpolate(frame, [10, fitEnd(62)], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const crossX = cross ? (cross.x - xFrom) / (xTo - xFrom) : 1;
  // 교차 표식은 선이 그 지점을 **지난 뒤에** 선다. 미리 서 있으면
  // 선이 표식을 향해 끌려간 것처럼 보여 인과가 뒤집힌다
  const atCross = grow >= crossX * 0.99;

  const path = (pts) => pts
    .map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)} ${py(p[1]).toFixed(1)}`)
    .join(' ');

  // ── 끝점 라벨 자리 ────────────────────────────────────────────────────
  // 예전엔 62px 씩 밀었다. 그런데 주인공 계열의 덩어리는 이름(40px, 줄높이
  // ~48) + 끝값(64px, ~72) = 120px 이다. 62 로 밀면 다음 계열 이름이 앞
  // 계열의 끝값 위에 그대로 얹힌다 — #6 에서 '일본' 이 '37%' 를 덮어써서
  // 글자가 겹쳐 찍혔다. 덩어리마다 제 높이로 띄운다
  const blockH = (s) => 48 + (s.endLabel ? (s.hot ? 76 : 60) : 0);
  const PADY = 22;
  const ends = series
    .map((s, i) => ({i, s, h: blockH(s), y: py(s.points[s.points.length - 1][1])}))
    .sort((a, b) => a.y - b.y);
  const endTop = {};                       // 덩어리 윗머리
  let floorY = TOP - 52;
  for (const e of ends) {
    endTop[e.i] = Math.max(e.y - 26, floorY);
    floorY = endTop[e.i] + e.h + PADY;
  }
  // 아래로만 밀면 마지막 덩어리가 자막 안전선을 넘는다 — 넘친 만큼 되올린다
  let ceilY = CONTENT_BOTTOM - 40;
  for (let k = ends.length - 1; k >= 0; k--) {
    const e = ends[k];
    endTop[e.i] = Math.max(TOP - 52, Math.min(endTop[e.i], ceilY - e.h));
    ceilY = endTop[e.i] - PADY;
  }

  return (
    <AbsoluteFill>
      <PaperBg theme={theme} {...bg} />
      {title ? <PaperTitle title={title} sub={sub} theme={theme} /> : null}

      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {/* 가로 눈금 — 값을 읽으라는 게 아니라 기울기를 재라는 선이라 아주 흐리게 */}
        {[...Array(5)].map((_, i) => {
          const y = TOP + ((BOT - TOP) / 4) * i;
          return <line key={i} x1={L} y1={y} x2={R} y2={y}
                       stroke={T.ink} strokeWidth={1} opacity={0.09} />;
        })}
        {/* 눈금에 값을 적는다. 기울기만 보라고 숫자를 다 뺐더니 '37%' 가
            판의 어디쯤인지 잴 데가 없었다 */}
        {[...Array(5)].map((_, i) => {
          const v = yTo - ((yTo - yFrom) / 4) * i;
          const y = TOP + ((BOT - TOP) / 4) * i;
          return (
            <text key={'v' + i} x={L - 22} y={y + 9} textAnchor="end"
                  fill={T.soft} opacity={0.75 * fade(6)}
                  style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 29}}>
              {Math.round(v)}
            </text>
          );
        })}
        <line x1={L} y1={BOT} x2={R} y2={BOT}
              stroke={T.ink} strokeWidth={LW.THIN} opacity={0.55} />

        {/* 해 눈금 */}
        {xTicks.map((x) => (
          <g key={x} opacity={fade(4)}>
            <line x1={px(x)} y1={BOT} x2={px(x)} y2={BOT + 12}
                  stroke={T.ink} strokeWidth={LW.THIN} opacity={0.5} />
          </g>
        ))}

        {/* 교차점 세로 안내선 — 표식보다 먼저 서면 정답을 미리 알려 주는 셈이라 같이 세운다 */}
        {cross && atCross ? (
          <line x1={px(cross.x)} y1={TOP - 18} x2={px(cross.x)} y2={BOT}
                stroke={T.ink} strokeWidth={LW.HAIR} strokeDasharray="7 9"
                opacity={0.42 * fade(0, 8)} />
        ) : null}

        {/* 선 */}
        {series.map((s, i) => (
          <path key={i} d={path(s.points)} fill="none"
                stroke={T.ink}
                strokeWidth={s.hot ? LW.BOLD : LW.BODY}
                strokeLinecap="round" strokeLinejoin="round"
                opacity={s.hot ? 1 : 0.34}
                pathLength={1} strokeDasharray={1} strokeDashoffset={1 - grow} />
        ))}

        {/* 교차 표식 — 이 화면에서 노랑은 여기 하나다 */}
        {cross && atCross ? (
          <g opacity={fade(0, 10)}>
            <circle cx={px(cross.x)} cy={py(crossY(series, cross.x))} r={19}
                    fill={YELLOW} stroke={T.ink} strokeWidth={LW.BODY} />
          </g>
        ) : null}

        {/* 끝점 */}
        {series.map((s, i) => {
          const p = s.points[s.points.length - 1];
          return grow > 0.985 ? (
            <circle key={i} cx={px(p[0])} cy={py(p[1])} r={s.hot ? 11 : 8}
                    fill={T.bg} stroke={T.ink} strokeWidth={LW.THIN}
                    opacity={(s.hot ? 1 : 0.45) * fade(0, 8)} />
          ) : null;
        })}
      </svg>

      {/* 해 라벨 — SVG 밖에 두어야 한글 자간이 브라우저 텍스트와 같아진다 */}
      {xTicks.map((x) => (
        <div key={x} style={{position: 'absolute', top: BOT + 24, left: px(x) - 90,
                             width: 180, textAlign: 'center',
                             fontFamily: 'A2Z Light, sans-serif', fontSize: FS.MICRO + 4,
                             color: T.soft, opacity: fade(6)}}>
          {x}
        </div>
      ))}

      {/* 계열 이름 + 끝값. 선 끝 오른쪽에 붙는다 — 범례를 따로 두면 눈이 두 번 움직인다 */}
      {series.map((s, i) => {
        const p = s.points[s.points.length - 1];
        return grow > 0.985 ? (
          <div key={i} style={{position: 'absolute', left: px(p[0]) + 26,
                               top: endTop[i], width: 340,
                               opacity: fade(0, 10)}}>
            <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: FS.LABEL,
                         color: s.hot ? T.ink : T.soft, letterSpacing: '-0.01em'}}>
              {s.label}
            </div>
            {s.endLabel ? (
              <div style={{marginTop: 2, fontFamily: 'A2Z Bold, A2Z Medium, sans-serif',
                           fontSize: s.hot ? FS.LEAD : FS.BODY,
                           color: s.hot ? T.ink : T.soft, letterSpacing: '-0.02em'}}>
                {s.endLabel}
              </div>
            ) : null}
          </div>
        ) : null;
      })}

      {/* 교차점 라벨 */}
      {cross && atCross && cross.label ? (
        // 교차점이 오른쪽 끝에 가까우면 라벨을 왼쪽으로 물린다.
        // 가운데 정렬로 두면 화면 밖으로 나가거나 끝점 라벨과 부딪힌다
        <div style={{position: 'absolute',
                     left: Math.min(px(cross.x) - 170, R - 380), top: TOP - 96,
                     width: 340,
                     textAlign: px(cross.x) > R - 220 ? 'right' : 'center',
                     opacity: fade(0, 10)}}>
          <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: FS.LEAD,
                       color: T.ink, letterSpacing: '-0.02em'}}>
            {cross.label}
          </div>
        </div>
      ) : null}

      {yUnit ? (
        <div style={{position: 'absolute', left: L - 66, top: TOP - 48,
                     fontFamily: 'A2Z Light, sans-serif', fontSize: FS.MICRO,
                     color: T.soft, opacity: fade(6)}}>
          {yUnit}
        </div>
      ) : null}

      {caption || note ? (
        <PaperCaption theme={theme}>{[caption, note].filter(Boolean).join('  ·  ')}</PaperCaption>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};

// 교차점의 y. 주인공 계열에서 그 해의 값을 선형보간해 찾는다 —
// 표식을 손으로 찍으면 선과 어긋나고, 어긋난 표식은 그래프 전체를 의심하게 만든다
function crossY(series, x) {
  const s = series.find((v) => v.hot) || series[0];
  if (!s) return 0;
  const p = s.points;
  for (let i = 1; i < p.length; i++) {
    if (x <= p[i][0]) {
      const f = (x - p[i - 1][0]) / (p[i][0] - p[i - 1][0] || 1);
      return p[i - 1][1] + f * (p[i][1] - p[i - 1][1]);
    }
  }
  return p[p.length - 1][1];
}
