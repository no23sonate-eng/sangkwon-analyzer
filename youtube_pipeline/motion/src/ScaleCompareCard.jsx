import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, THEMES, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, LW} from './paper';
import {fit} from './layout';

// ── 절대 스케일 비교 ─────────────────────────────────────────────────────
// `SkylineCompareCard` 는 **상대 비교**다 (value 0~1). 그래서 "11조 vs 4조"처럼
// 서로를 재는 데는 맞지만, **"그래서 이게 얼마나 큰데?"** 에는 답을 못 한다.
//
// 이 카드는 다르다. 모든 대상을 **실제 미터**로 놓고, 아는 것 옆에 세운다.
//   - 왼쪽에 미터 눈금 축 (10m 단위 격자)
//   - 바닥에 **사람 1.7m** — 절대 스케일의 기준점. 이게 있어야 숫자가 몸으로 온다
//   - 높이가 자라 올라가고, 다 자란 뒤 치수선이 위로 훑으며 숫자가 도착한다
//
// items: [{label, meters, shape, note, hot}]
// 알려진 기준을 하나 섞어 주는 게 요령이다 (남산 262m / 63빌딩 249m / 10층 30m).
const HUMAN_M = 1.7;

const Figure = ({x, baseY, mpp, o, T = THEMES.paper}) => {
  // 사람 — 1.7m 를 그대로 환산한다. **최소 크기로 늘리지 않는다.**
  // 늘리는 순간 이 카드의 유일한 존재 이유(정직한 스케일)가 깨진다.
  // 너무 작아 안 보이면 그게 정보다 — 옆의 라벨이 대신 말해 준다.
  const h = HUMAN_M / mpp;
  const head = h * 0.16, body = h * 0.52, leg = h * 0.32;
  const w = Math.max(2, h * 0.10);
  return (
    <g opacity={o}>
      <circle cx={x} cy={baseY - h + head / 2} r={head / 2} fill={T.ink} />
      <rect x={x - w} y={baseY - h + head} width={w * 2} height={body} rx={w * 0.6} fill={T.ink} />
      <rect x={x - w} y={baseY - leg} width={w * 0.8} height={leg} fill={T.ink} />
      <rect x={x + w * 0.2} y={baseY - leg} width={w * 0.8} height={leg} fill={T.ink} />
    </g>
  );
};

const Body = ({cx, baseY, w, h, shape, fill, T = THEMES.paper}) => {
  const top = baseY - h;
  const floors = Math.max(0, Math.floor(h / 22));
  const lines = Array.from({length: floors}, (_, i) => (
    <line key={i} x1={cx - w / 2 + 4} y1={baseY - 22 * (i + 1)} x2={cx + w / 2 - 4} y2={baseY - 22 * (i + 1)}
          stroke="#FFF" strokeWidth={LW.HAIR} opacity={0.20} />
  ));
  switch (shape) {
    case 'hill':   // 산 — 능선
      return (
        <g>
          <path d={`M ${cx - w * 0.95} ${baseY} Q ${cx - w * 0.2} ${top - h * 0.04} ${cx} ${top}
                    Q ${cx + w * 0.35} ${top + h * 0.1} ${cx + w * 0.95} ${baseY} Z`} fill={fill} />
        </g>
      );
    case 'tower':  // 세장 타워 + 첨탑
      return (
        <g>
          <rect x={cx - w * 0.34} y={top} width={w * 0.68} height={h} fill={fill} />
          <line x1={cx} y1={top} x2={cx} y2={top - h * 0.07} stroke={fill} strokeWidth={LW.BODY} />
          {lines}
        </g>
      );
    case 'cluster': {  // 여러 동
      const n = 4, g = w * 0.04, bw = (w - g * (n - 1)) / n;
      const r = [1, 0.92, 0.97, 0.86];
      return (
        <g>
          {Array.from({length: n}, (_, k) => (
            <rect key={k} x={cx - w / 2 + k * (bw + g)} y={baseY - h * r[k]}
                  width={bw} height={h * r[k]} fill={fill} />
          ))}
          {lines}
        </g>
      );
    }
    default:       // 판상
      return (
        <g>
          <rect x={cx - w / 2} y={top} width={w} height={h} fill={fill} />
          {lines}
        </g>
      );
  }
};

export const ScaleCompareCard = ({
  title = '', sub = '',
  items = [],
  axisStep = 50,           // 눈금 간격(m)
  unit = 'm',
  showHuman = true,
  source = '',
  theme, align = 'center',
  bg = {},   // PaperBg 로 그대로 넘어간다: {backdrop, veil, blur, dir}
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = items.length;
  if (!n) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const baseY = CONTENT_BOTTOM - 74;
  const topRoom = (title ? (sub ? 300 : 240) : 150);
  const maxM = Math.max(...items.map((i) => i.meters || 0), axisStep);
  // 눈금 하나 여유를 두고 축을 잡는다 — 꼭대기 수치가 잘리지 않게
  const room = baseY - topRoom;
  const rawMax = maxM * 1.12;
  // 눈금 간격은 라벨이 안 겹치게 자동으로 키운다 (최소 56px 간격).
  // 지정값을 그대로 쓰면 500m 대 그래프에서 눈금이 13줄로 뭉갠다.
  const NICE = [10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = NICE.find((v) => v >= axisStep && room / (rawMax / v) >= 56)
            ?? NICE[NICE.length - 1];
  const axisMax = Math.ceil(rawMax / step) * step;
  const mpp = room / axisMax;                    // 미터당 픽셀
  const yOf = (m) => baseY - m * mpp;

  const AX = 176;                                 // 눈금 축 x
  const span = 1920 - AX - 150;
  const slot = span / n;
  const cxOf = (i) => AX + 70 + slot * i + slot / 2;
  const bodyW = Math.min(190, slot * 0.5);

  const ticks = [];
  for (let m = step; m <= axisMax; m += step) ticks.push(m);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 미터 격자 — 먼저 깔려서 "재는 판"이라는 걸 알린다 */}
        {ticks.map((m, i) => {
          const o = fadeIn(frame, 2 + i * 2);
          return (
            <g key={m} opacity={o}>
              <line x1={AX} y1={yOf(m)} x2={1860} y2={yOf(m)} stroke={T.ink} strokeWidth={LW.HAIR} opacity={0.13} />
              <line x1={AX - 12} y1={yOf(m)} x2={AX} y2={yOf(m)} stroke={T.ink} strokeWidth={LW.THIN} opacity={0.5} />
            </g>
          );
        })}
        <line x1={AX} y1={topRoom} x2={AX} y2={baseY} stroke={T.ink} strokeWidth={LW.THIN} opacity={0.4} />
        <line x1={AX - 40} y1={baseY} x2={1880} y2={baseY} stroke={T.ink} strokeWidth={LW.BODY} />

        {items.map((it, i) => {
          const grow = spring({frame: frame - 14 - i * 7, fps, config: {damping: 200}, durationInFrames: 40});
          const h = (it.meters || 0) * mpp * grow;
          const fill = it.hot ? YELLOW : T.tones[(it.tone ?? i + 1) % T.tones.length];
          return (
            <g key={i}>
              {it.shape !== 'hill' ? (
                <ellipse cx={cxOf(i)} cy={baseY + 2} rx={bodyW * 0.55} ry={6}
                         fill={T.ink} opacity={0.12 * grow} />
              ) : null}
              <Body T={T} cx={cxOf(i)} baseY={baseY} w={bodyW} h={h} shape={it.shape || 'slab'} fill={fill} />
              {it.hot ? (
                <Body T={T} cx={cxOf(i)} baseY={baseY} w={bodyW} h={h} shape={it.shape || 'slab'} fill="none" />
              ) : null}
            </g>
          );
        })}

        {/* 사람 — 절대 스케일의 기준. 바닥선 왼쪽 끝에 세운다 */}
        {showHuman ? <Figure T={T} x={AX + 34} baseY={baseY} mpp={1 / mpp} o={fadeIn(frame, 34)} /> : null}
      </svg>

      {/* 눈금 숫자 */}
      {ticks.map((m, i) => (
        <div key={m} style={{position: 'absolute', left: 0, width: AX - 22, top: yOf(m) - 20,
                             textAlign: 'right', opacity: 0.75 * fadeIn(frame, 2 + i * 2),
                             fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: T.soft,
                             fontVariantNumeric: 'tabular-nums'}}>
          {m}{unit}
        </div>
      ))}
      {showHuman ? (
        <div style={{position: 'absolute', left: AX + 58, top: baseY - 46, opacity: fadeIn(frame, 40),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 24, color: T.soft}}>
          사람 1.7{unit}
        </div>
      ) : null}

      {/* 대상별 수치 — 다 자란 뒤에 도착한다 */}
      {items.map((it, i) => {
        const grow = spring({frame: frame - 14 - i * 7, fps, config: {damping: 200}, durationInFrames: 40});
        const shown = interpolate(frame, [30 + i * 7, 66 + i * 7], [0, it.meters || 0],
                                  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const y = yOf((it.meters || 0) * grow);
        const o = fadeIn(frame, 30 + i * 7);
        const labelSize = fit(it.label || '', 34, slot - 20);
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: cxOf(i) - slot / 2, width: slot, top: y - 76,
                         textAlign: 'center', opacity: o}}>
              <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 52,
                            color: T.ink, fontVariantNumeric: 'tabular-nums'}}>
                {Math.round(shown).toLocaleString('ko-KR')}<span style={{fontSize: 34}}>{unit}</span>
              </span>
            </div>
            <div style={{position: 'absolute', left: cxOf(i) - slot / 2, width: slot, top: baseY + 18,
                         textAlign: 'center', opacity: o}}>
              <div style={{fontFamily: it.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                           fontSize: labelSize, color: it.hot ? T.ink : T.soft, lineHeight: 1.3,
                           wordBreak: 'keep-all'}}>
                {it.label}
              </div>
              {it.note ? (
                <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: 26, color: T.soft}}>
                  {it.note}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
