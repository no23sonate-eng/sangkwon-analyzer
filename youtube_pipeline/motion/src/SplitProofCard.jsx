import React from 'react';
import {AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, fadeIn, LW} from './paper';
import {HandArrow} from './annotate';
import {fit} from './layout';

// ── 실물-도해 연결 (스플릿) ─────────────────────────────────────────────
// Cleo Abram "What If You Just Keep Digging?" 썸네일에서 학습한 기법(design_reference §37).
// 좌측은 **실제 사진**(콜라 초심층 시추공 뚜껑, "12,226 метров" 각인) — 반박 불가능한
// 실물 증거. 우측은 **일러스트 단면**(지층 그라디언트 + 좁은 시추관 + 끝에 값 라벨).
// 둘을 손그림 화살표 하나가 이어 **"이 실물이 저 도해다"**를 한 화면에서 선언한다.
//
// `SectionDiagramCard`(§32-3②)와 다른 점: 저건 **판 곳/안 판 곳 두 색**만 쓰는
// 순수 개념도다 ("지층마다 색을 다르게 하면 지질도가 된다"는 원칙). 이건 일부러
// 반대로 간다 — **지층 그라디언트를 쓴다.** 실물 사진과 짝을 이루므로 "진짜 땅속처럼
// 보이는 것"이 오히려 신뢰를 만든다. 그래서 순수 개념 설명이 아니라 **"실물이 있다"는
// 걸 증명하는 자리**에서만 쓴다 — 매물 등기·인허가 서류·초석 명판처럼 실물 근거가
// 있고, 그 의미를 옆에서 도해로 풀어줘야 할 때.
//
// photo  : 실물 사진 staticFile 경로 — 이 카드의 존재 이유. 없으면 그리지 않는다
// layers : 우측 단면 색 밴드. [{color, h}] 위(지표)에서 아래로. h 는 상대 비율
// shaft  : 0~1, 층 전체 높이 중 관이 뚫린 비율 (위에서부터)
// value / valueLabel : 관 끝에 붙는 굵은 라벨 ("12.2 KM" / "콜라 시추공")
export const SplitProofCard = ({
  title = '', sub = '',
  photo = '', photoCaption = '',
  layers = [], shaft = 0.55, tipColor = '',
  value = '', valueLabel = '',
  note = '', disclaimer = '도해 — 실제 비례와 다를 수 있음',
  theme = 'ink', align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  if (!photo || !layers.length) return <AbsoluteFill><PaperBg theme={theme} {...bg} /></AbsoluteFill>;

  const TOP = title ? (sub ? 300 : 246) : 170;
  const BOT = 900;
  const midX = 968;

  const total = layers.reduce((a, l) => a + l.h, 0) || 1;
  let acc = 0;
  const bands = layers.map((l) => {
    const y0 = TOP + (acc / total) * (BOT - TOP);
    acc += l.h;
    const y1 = TOP + (acc / total) * (BOT - TOP);
    return {...l, y0, y1};
  });

  const shaftX = midX + 260;
  const shaftW = 26;
  const shaftBot = TOP + shaft * (BOT - TOP);
  const drawT = interpolate(frame, [18, 46], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const eD = drawT * drawT * (3 - 2 * drawT);
  const shaftY = TOP + (shaftBot - TOP) * eD;

  const photoIn = interpolate(frame, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const arrowT = interpolate(frame, [40, 64], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const valOp = fadeIn(frame, 62);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />

      {/* 좌 — 실물 사진. 세로로 살짝 밀려 들어온다 */}
      <div style={{position: 'absolute', left: 0, top: TOP - 20, width: midX, height: BOT - TOP + 20,
                   overflow: 'hidden', opacity: photoIn,
                   transform: `translateX(${(1 - photoIn) * -40}px)`}}>
        <Img src={/^https?:/.test(photo) ? photo : staticFile(photo)}
             style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        {photoCaption ? (
          <div style={{position: 'absolute', left: 24, bottom: 20,
                       fontFamily: 'A2Z Medium, sans-serif', fontSize: 24,
                       color: '#FFFFFF', textShadow: '0 2px 10px rgba(0,0,0,0.7)'}}>
            {photoCaption}
          </div>
        ) : null}
      </div>

      {/* 우 — 단면. 지층 그라디언트를 일부러 쓴다(§37) */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <clipPath id="spc-right"><rect x={midX + 40} y={TOP - 20} width={1920 - midX - 40} height={BOT - TOP + 20} /></clipPath>
        <g clipPath="url(#spc-right)">
          {bands.map((b, i) => (
            <rect key={i} x={midX + 40} y={b.y0} width={1920 - midX - 80} height={b.y1 - b.y0}
                  fill={b.color} opacity={fadeIn(frame, 4 + i * 5)} />
          ))}
        </g>
        {/* 시추관 */}
        <g opacity={eD > 0.02 ? 1 : 0}>
          <rect x={shaftX - shaftW / 2} y={bands[0]?.y0 ?? TOP} width={shaftW}
                height={Math.max(0, shaftY - (bands[0]?.y0 ?? TOP))} fill="#1B1E24" opacity={0.92} />
          {eD > 0.9 ? (
            <circle cx={shaftX} cy={shaftY} r={shaftW * 0.62} fill={tipColor || '#4B7BD6'} />
          ) : null}
          <line x1={shaftX} y1={bands[0]?.y0 ?? TOP} x2={shaftX} y2={shaftY}
                stroke={T.bg} strokeWidth={LW.THIN} opacity={0.35} />
        </g>
      </svg>

      {/* 값 라벨 — 관 끝. 상자 없이 굵은 흰 글씨 + 어두운 외곽선(반딕라인과 같은 문법) */}
      {value && eD > 0.9 ? (
        <div style={{position: 'absolute', left: shaftX - 4, top: shaftY + 14, opacity: valOp,
                     textAlign: 'center', transform: 'translateX(-50%)'}}>
          <div style={{fontFamily: 'A2Z Medium, sans-serif',
                       fontSize: fit(value, 58, 460), color: '#FFFFFF', whiteSpace: 'nowrap',
                       textShadow: '0 2px 4px rgba(0,0,0,0.55), 0 0 22px rgba(0,0,0,0.5)'}}>
            {value}
          </div>
          {valueLabel ? (
            <div style={{marginTop: 4, fontFamily: 'A2Z Light, sans-serif', fontSize: 24, color: T.soft}}>
              {valueLabel}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 이음새를 가로지르는 손그림 화살표 — "이 실물이 저 도해다" */}
      {arrowT > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
          <HandArrow from={[midX - 120, TOP + 40]} to={[midX + 150, TOP + 180]}
                     progress={arrowT} bow={-60} color={!T.dark ? '#23262B' : '#FFFFFF'}
                     width={16} head={42} />
        </svg>
      ) : null}

      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 150, top: 940, textAlign: 'center',
                     opacity: fadeIn(frame, 70), fontFamily: 'A2Z Light, sans-serif',
                     fontSize: 28, color: T.soft, wordBreak: 'keep-all'}}>
          {note}
        </div>
      ) : null}

      {disclaimer ? (
        <div style={{position: 'absolute', left: 44, top: 1028,
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 20, color: T.soft, opacity: 0.75}}>
          {disclaimer}
        </div>
      ) : null}

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
