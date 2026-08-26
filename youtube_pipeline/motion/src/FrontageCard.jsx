import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, SP, LW, titleBottom} from './paper';
import {DimLine} from './annotate';
import {fit} from './layout';

// ── 접도 길이 = 광고판 크기 ──────────────────────────────────────────────
// "같은 면적이라도 직사각형일 때 보여지는 면이 더 넓다" 를 말로만 하면 안 남는다.
// 넓이가 같다는 것과 얼굴이 다르다는 것을 **동시에** 보여 줘야 한다.
//
// 그래서 한 칸에 두 단을 쌓는다.
//   위 = 평면(위에서 본 것). 도로에 닿는 변만 옐로. 같은 칸수 = 같은 면적
//   아래 = 정면(길에서 본 것). **그 변이 그대로 광고판 폭이 된다**
// 평면만 그리면 "면적이 같네"에서 끝나고, 정면만 그리면 "왜 다른데?"가 남는다.
// 두 단을 세로로 이어 붙여야 위의 변이 아래의 폭으로 **내려오는 게** 읽힌다.
//
// 격자 칸으로 그리는 이유: 4×4 와 8×2 가 같은 16칸이라는 걸 **세어서** 확인시킨다.
// 매끈한 사각형 두 개를 나란히 놓으면 면적이 같다는 말을 믿어야만 한다.
//
// options: [{label, w, d, note, hot}]  w = 도로에 닿는 변, d = 안쪽 깊이 (칸 수)
export const FrontageCard = ({
  title = '', sub = '',
  options = [], unit = '', floors = 2,
  note = '', theme = 'paper', align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  if (options.length < 2) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const TOP = title ? titleBottom(title, sub) + 22 : 178;
  const BOT = CONTENT_BOTTOM - 74;         // 아래 한 줄(note)을 위해 비워 둔다

  // 블록을 **위에서부터 흘려** 쌓는다 (layout.jsx flow 와 같은 원칙).
  // 좌표를 하나씩 박으면 한 곳을 고칠 때 옆이 깨진다 — 실제로 첫 렌더에서
  // 안 이름이 부제를 덮고 치수 숫자가 정면 박스를 관통했다.
  const LABEL_H = 112;     // 안 이름 + 면적 두 줄. 88 이면 두 줄이 서로 붙는다
  const GAP = 34;          // 평면 ↔ 정면. 옐로 변이 내려오는 통로
  const DIM_GAP = 84;      // 정면 ↔ 치수선. DimLine 라벨이 선 **위**에 앉으므로
                           // 이만큼 안 띄우면 숫자가 정면 박스를 뚫는다
  const NOTE_GAP = 40;

  const maxW = Math.max(...options.map((o) => o.w));
  const maxD = Math.max(...options.map((o) => o.d));
  const colW = 1920 / options.length;
  // 두 안이 화면 양 끝에 붙어 있었다 — 가운데로 당긴다
  const PULL = 0.66;
  const cxOf = (i) => Math.round(960 + (colW * (i + 0.5) - 960) * PULL);
  const fixed = LABEL_H + GAP + DIM_GAP + NOTE_GAP;

  // 정면 높이를 **칸 크기에서 유도**한다. 상수로 박아 두면 평면만 작아지고
  // 정면만 커져 둘의 축척이 어긋난다 — 같은 건물의 두 투영이라는 게 깨진다.
  const FL = Math.max(1, floors) * 0.72;
  // 칸 크기는 **두 안 공통**이어야 한다. 안마다 다르면 면적 비교가 무너진다
  const CELL = Math.max(20, Math.min(86, (colW - 130) / maxW,
                                     (BOT - TOP - fixed) / (maxD + FL)));

  const planH = maxD * CELL;
  const ELEV_H = FL * CELL;
  const blockH = fixed + planH + ELEV_H;
  // 위쪽에 몰려 있어서 아래가 비었다 (검수 지적 #23). 띠 한가운데 + 조금 더 아래
  const y0 = TOP + Math.max(0, (BOT - TOP - blockH) / 2) + 40;
  const labelTop = y0;
  const planBot = y0 + LABEL_H + planH;
  const elevTop = planBot + GAP;
  const dimY = elevTop + ELEV_H + DIM_GAP;
  const noteTop = dimY + NOTE_GAP;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {options.map((o, oi) => {
          const cx = cxOf(oi);
          const pw = o.w * CELL, pd = o.d * CELL;
          const px = cx - pw / 2, py = planBot - pd;
          const ew = o.w * CELL;           // **정면 폭 = 접도 변 길이.** 이게 요점이다
          const ex = cx - ew / 2;
          const base = oi * 10;

          const gridIn = interpolate(frame, [base + 6, base + 30], [0, 1],
                                     {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const edgeIn = interpolate(frame, [base + 32, base + 48], [0, 1],
                                     {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const dropIn = interpolate(frame, [base + 50, base + 72], [0, 1],
                                     {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const eD = dropIn * dropIn * (3 - 2 * dropIn);

          const cells = [];
          for (let r = 0; r < o.d; r++) {
            for (let c = 0; c < o.w; c++) {
              // 칸이 하나씩 채워진다 — 세어 보게 만드는 게 목적이라 한꺼번에 안 켠다
              const k = (r * o.w + c) / (o.w * o.d);
              const t = Math.max(0, Math.min(1, (gridIn - k * 0.6) / 0.4));
              cells.push(
                <rect key={`${r}-${c}`} x={px + c * CELL} y={py + r * CELL}
                      width={CELL - 3} height={CELL - 3}
                      fill={T.ink} opacity={0.13 * t} />
              );
            }
          }

          return (
            <g key={oi}>
              {cells}
              {/* 평면 외곽 */}
              <rect x={px} y={py} width={pw - 3} height={pd - 3} fill="none"
                    stroke={T.ink} strokeWidth={LW.BODY} opacity={0.55 * gridIn} />

              {/* 도로 — 접도 변 아래에 굵은 선 하나. "여기가 길이다" */}
              <line x1={px - 60} y1={planBot + 20} x2={px + pw + 40} y2={planBot + 20}
                    stroke={T.ink} strokeWidth={LW.BOLD} opacity={0.3 * gridIn} />

              {/* 접도 변 = 옐로. 한 화면에 강조는 이것뿐 */}
              <line x1={px} y1={planBot - 2} x2={px + pw - 3} y2={planBot - 2}
                    stroke={YELLOW} strokeWidth={LW.BOLD}
                    strokeDasharray={`${pw} ${pw}`} strokeDashoffset={pw * (1 - edgeIn)} />

              {/* 그 변이 아래로 **내려와** 정면의 폭이 된다 */}
              {eD > 0.01 ? (
                <>
                  <line x1={px} y1={planBot + 6} x2={ex} y2={elevTop - 6}
                        stroke={YELLOW} strokeWidth={LW.THIN} strokeDasharray="9 9" opacity={0.7 * eD} />
                  <line x1={px + pw - 3} y1={planBot + 6} x2={ex + ew - 3} y2={elevTop - 6}
                        stroke={YELLOW} strokeWidth={LW.THIN} strokeDasharray="9 9" opacity={0.7 * eD} />
                  <rect x={ex} y={elevTop} width={(ew - 3) * eD} height={ELEV_H}
                        fill={YELLOW} opacity={0.9} />
                  <rect x={ex} y={elevTop} width={(ew - 3) * eD} height={ELEV_H}
                        fill="none" stroke={T.ink} strokeWidth={LW.BODY} />
                  {/* 층 구분선 — 정면이 건물이라는 걸 알려 주는 최소한의 표시 */}
                  {Array.from({length: Math.max(0, floors - 1)}, (_, i) => (
                    <line key={i} x1={ex} y1={elevTop + ELEV_H * (i + 1) / floors}
                          x2={ex + (ew - 3) * eD} y2={elevTop + ELEV_H * (i + 1) / floors}
                          stroke={T.ink} strokeWidth={LW.THIN} opacity={0.35} />
                  ))}
                </>
              ) : null}

              {/* 접도 길이 치수 — 재는 것이므로 손맛 없이 (annotate.jsx DimLine 원칙) */}
              <DimLine x1={px} y1={dimY} x2={px + pw - 3} y2={dimY}
                       progress={eD} color={T.ink} width={3} cap={13}
                       label={`${o.w}${unit}`} labelSize={40} />
            </g>
          );
        })}
      </svg>

      {/* 안 이름 · 면적 — 면적을 나란히 찍어야 "같다"가 확인된다 */}
      {options.map((o, oi) => {
        const cx = cxOf(oi);
        const op = fadeIn(frame, oi * 10 + 8);
        return (
          <div key={oi} style={{position: 'absolute', left: cx - 300, width: 600, top: labelTop,
                                textAlign: 'center', opacity: op}}>
            <div style={{fontFamily: 'A2Z Medium, sans-serif',
                         fontSize: fit(o.label, 46, 560), color: o.hot ? T.ink : T.soft}}>
              {o.label}
            </div>
            {/* 이름 바로 밑에 4px 로 붙여 놨더니 두 줄이 한 덩어리로 뭉쳤다 */}
            <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif', fontSize: 28,
                         color: T.soft}}>
              면적 {o.w * o.d}칸 (동일)
            </div>
          </div>
        );
      })}

      {/* 정면 아래 한 줄 — "이만큼이 광고판" */}
      {options.map((o, oi) => {
        const cx = cxOf(oi);
        const op = fadeIn(frame, oi * 10 + 76);
        if (op <= 0.01 || !o.note) return null;
        return (
          <div key={oi} style={{position: 'absolute', left: cx - 300, width: 600,
                                top: noteTop, textAlign: 'center', opacity: op,
                                fontFamily: 'A2Z Medium, sans-serif',
                                fontSize: fit(o.note, 38, 560),
                                color: T.ink, opacity: o.hot ? 1 : 0.72}}>
            {o.note}
          </div>
        );
      })}

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 150, top: CONTENT_BOTTOM - 8,
                     textAlign: 'center', opacity: fadeIn(frame, 88),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: T.soft,
                     wordBreak: 'keep-all'}}>
          {note}
        </div>
      ) : null}

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
