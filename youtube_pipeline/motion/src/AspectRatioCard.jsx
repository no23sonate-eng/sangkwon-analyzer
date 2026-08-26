import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, SP, LW} from './paper';

// ── 같은 면적, 다른 비율 ───────────────────────────────────────────────
// "4×4 정사각형보다 8×2 직사각형이 사람 눈에 더 길게 들어온다" 는 말은
// **말로 하면 안 믿기고 그림으로 보면 즉시 믿긴다.** 실사를 깔아 봐야
// 아무 설명이 안 되는 컷이라 도형으로 바꾼다.
//
// 핵심은 두 도형의 **면적을 실제로 똑같이** 그리는 것이다. 눈속임이면
// 논지가 무너진다. 그래서 w·h 를 받아 면적 = w*h 가 같은지 검산하고,
// 같은 화소면적을 갖도록 스케일을 하나로 공유한다.
//
// 아래에 접하는 변(전면 폭)만 옐로로 굵게 덧그어 "보이는 길이"를 분리한다 —
// 면적은 같은데 옐로 길이가 다르다는 게 이 카드의 전부다.
//
// items: [{w, h, label, note, hot}]  (w·h 는 실제 치수, 단위 무관)
export const AspectRatioCard = ({
  title = '', sub = '', items = [], unit = 'm',
  frontLabel = '전면 폭', source = '', caption = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (items.length < 2) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const bandTop = title ? (sub ? 300 : 250) : 170;
  const bandH = CONTENT_BOTTOM - bandTop;

  // 두 도형이 **한 스케일**을 공유해야 면적 비교가 성립한다.
  const maxW = Math.max(...items.map((it) => it.w));
  const maxH = Math.max(...items.map((it) => it.h));
  const slot = 1680 / items.length;
  // 아래 글자 블록이 차지할 높이를 **먼저 떼어 놓고** 남은 만큼만 도형에 준다.
  // 도형 크기부터 정하면 수치·라벨이 자막 안전영역을 넘거나 캡션과 겹친다 —
  // 실제로 한 번 겹쳤다.
  const LABEL_H = 138;                                  // 전면폭 수치줄 + 라벨줄
  const CAP_H = caption ? 56 : 0;
  const DIM_H = 62;                                     // 도형 위 치수 라벨 자리
  const drawH = bandH - DIM_H - LABEL_H - CAP_H;
  const s = Math.min((slot - 200) / maxW, drawH / maxH);
  // 바닥선을 하나로 공유한다 — 서로 다른 높이에 떠 있으면 비교가 안 된다
  const baseY = bandTop + DIM_H + drawH;

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {items.map((it, i) => {
          const w = it.w * s;
          const h = it.h * s;
          const cx = 120 + slot * i + slot / 2;
          const x = cx - w / 2;
          const y = baseY - h;
          const gi = spring({frame: frame - (16 + i * 10), fps,
                             config: {damping: 190, mass: 0.7}});
          const front = spring({frame: frame - (46 + i * 10), fps,
                                config: {damping: 200, mass: 0.8}});
          return (
            <g key={i}>
              {/* 면적 도형 — 아래에서 자라 올라온다 (땅에 앉는 느낌) */}
              <rect x={x} y={baseY - h * gi} width={w} height={h * gi}
                    fill={it.hot ? 'rgba(250,255,46,0.16)' : T.mute}
                    fillOpacity={it.hot ? 1 : 0.3}
                    stroke={T.ink} strokeWidth={LW.BODY} />
              {/* 격자 — 같은 면적이라는 걸 칸 수로 확인시킨다 */}
              {gi > 0.98 && it.grid !== false ? (
                <g opacity={0.28 * fadeIn(frame, 34 + i * 10)}>
                  {Array.from({length: Math.max(0, Math.round(it.w) - 1)}, (_, k) => (
                    <line key={'v' + k} x1={x + ((k + 1) / it.w) * w} y1={y}
                          x2={x + ((k + 1) / it.w) * w} y2={baseY}
                          stroke={T.ink} strokeWidth={LW.HAIR} />
                  ))}
                  {Array.from({length: Math.max(0, Math.round(it.h) - 1)}, (_, k) => (
                    <line key={'h' + k} x1={x} y1={y + ((k + 1) / it.h) * h}
                          x2={x + w} y2={y + ((k + 1) / it.h) * h}
                          stroke={T.ink} strokeWidth={LW.HAIR} />
                  ))}
                </g>
              ) : null}
              {/* 전면 폭 — 아래 변만 옐로로 덧그어 "눈에 들어오는 길이"를 뽑는다 */}
              <line x1={x} y1={baseY + 3} x2={x + w * front} y2={baseY + 3}
                    stroke={YELLOW} strokeWidth={LW.BOLD} strokeLinecap="butt" />
              <line x1={x} y1={baseY + 3} x2={x + w * front} y2={baseY + 3}
                    stroke={T.ink} strokeWidth={LW.THIN} />
            </g>
          );
        })}
      </svg>

      {items.map((it, i) => {
        const w = it.w * s;
        const h = it.h * s;
        const cx = 120 + slot * i + slot / 2;
        return (
          <React.Fragment key={i}>
            {/* 치수 라벨은 도형 **위**에 — 도형 안에 넣으면 격자와 겹친다 */}
            <div style={{position: 'absolute', left: cx - slot / 2, width: slot,
                         top: baseY - h - 56, textAlign: 'center',
                         fontFamily: 'A2Z Light, sans-serif', fontSize: 38, color: T.soft,
                         opacity: fadeIn(frame, 22 + i * 10)}}>
              {it.w} × {it.h}{unit}
            </div>
            {/* 전면 폭 수치 — 옐로 선 바로 아래, 붙지 않게 SP.NEAR 만큼 띄운다 */}
            <div style={{position: 'absolute', left: cx - slot / 2, width: slot,
                         top: baseY + SP.NEAR, textAlign: 'center',
                         opacity: fadeIn(frame, 52 + i * 10)}}>
              {/* 수치와 이름을 한 줄에 붙인다 — 두 줄로 쪼개면 아래 글자 블록이
                  길어지고 그만큼 도형이 작아진다. 도형이 주인공인 카드다 */}
              <div style={{fontFamily: 'A2Z Medium, sans-serif',
                           fontSize: 58, lineHeight: 1, color: T.ink,
                           fontVariantNumeric: 'tabular-nums'}}>
                {it.w}{unit}
                <span style={{marginLeft: SP.NEAR, fontFamily: 'A2Z Light, sans-serif',
                              fontSize: 30, letterSpacing: '0.12em', color: T.soft}}>
                  {frontLabel}
                </span>
              </div>
              {it.label ? (
                <div style={{marginTop: SP.NEAR, fontSize: 40, color: T.ink,
                             fontFamily: it.hot ? 'A2Z Medium, sans-serif' : 'A2Z Regular, sans-serif',
                             wordBreak: 'keep-all'}}>
                  {it.hot
                    ? <span style={{background: YELLOW, color: '#1B1E24', padding: '2px 14px'}}>{it.label}</span>
                    : it.label}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: baseY + LABEL_H,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 34,
                     color: T.soft, opacity: fadeIn(frame, 66), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
