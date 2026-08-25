import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn} from './paper';
import {DimLine} from './annotate';
import {fit} from './layout';

// ── 마당이 하는 일 (사람 → 마당 → 건물) ─────────────────────────────────
// "마당이 있으면 파사드를 주변 간섭 없이 볼 수 있다" 는 **거리의 이야기**다.
// 사진으로는 절대 안 보인다 — 사진은 이미 어떤 거리에서 찍힌 한 장이라
// "거리가 있어서 다 보인다"를 스스로 증명하지 못한다.
//
// 그래서 옆에서 본 그림으로 만든다. 사람 → (마당) → 건물 을 가로로 놓고,
// 사람 눈에서 건물 **위아래 끝으로** 두 줄을 그으면 시야각이 그대로 보인다.
// 마당이 없으면(withYard=false) 사람이 건물에 붙고, 두 줄이 벌어져
// **건물 윗부분이 시야 밖으로 나간다** — 그게 이 카드가 말하려는 전부다.
export const YardViewCard = ({
  title = '', sub = '',
  yard = 320,                  // 마당 폭(px). 0 이면 건물에 붙는다
  buildingH = 300, buildingW = 200,
  personLabel = '방문객', yardLabel = '마당', buildingLabel = '파사드',
  verdict = '',                // 아래 결론 한 줄
  clipped = false, center = false,             // true 면 "얼굴이 잘린다"를 빨강으로 표시
  note = '', theme = 'paper', align = 'center', source = '', bg = {},
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const T = themeOf(theme);
  const dark = T.bg !== '#EFEAE3';

  const GY = 640;                                  // 지면
  // 전체 폭(사람~건물 오른쪽)을 재서 화면 가운데에 놓는다.
  // 왼쪽에 붙여 두면 오른쪽이 휑해 "그래픽이 한쪽에 몰렸다"로 읽힌다
  const SPAN = Math.max(60, yard) + buildingW;
  const PX = center ? Math.round((1920 - SPAN) / 2) : 300;
  const PH = 96;                                   // 사람 키 (스케일 기준)
  const BX = PX + Math.max(60, yard);              // 건물 왼쪽 면
  const EY = GY - PH * 0.88;                       // 눈높이

  const bTop = GY - buildingH;
  const t1 = interpolate(frame, [8, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const t2 = interpolate(frame, [30, 58], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const e2 = t2 * t2 * (3 - 2 * t2);

  // 시선 두 줄 — 눈에서 건물 아래끝·위끝으로. 화면 밖까지 늘려 그린다
  const ray = (ty) => {
    const dx = BX - PX, dy = ty - EY;
    const k = (1860 - PX) / (dx || 1);
    return [PX + dx * k * e2, EY + dy * k * e2];
  };
  const rTop = ray(bTop), rBot = ray(GY);
  const ink = T.ink;
  const RED = '#D94A2B';

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} align={align} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 지면 */}
        <line x1={120} y1={GY} x2={1800} y2={GY} stroke={ink} strokeWidth={4} opacity={0.4} />

        {/* 시선 — 아래로 깔고 그 위에 도형을 얹는다 */}
        {e2 > 0.01 ? (
          <g opacity={0.9}>
            <path d={`M ${PX} ${EY} L ${rTop[0]} ${rTop[1]} L ${rBot[0]} ${rBot[1]} Z`}
                  fill={clipped ? RED : YELLOW} opacity={0.14} />
            <line x1={PX} y1={EY} x2={rTop[0]} y2={rTop[1]}
                  stroke={clipped ? RED : ink} strokeWidth={3} strokeDasharray="12 9" />
            <line x1={PX} y1={EY} x2={rBot[0]} y2={rBot[1]}
                  stroke={clipped ? RED : ink} strokeWidth={3} strokeDasharray="12 9" />
          </g>
        ) : null}

        {/* 건물 — 파사드 면만 옐로 */}
        <g opacity={t1}>
          <rect x={BX} y={bTop} width={buildingW} height={buildingH}
                fill={dark ? '#39424F' : '#C3C9D2'} stroke={ink} strokeWidth={3} />
          <rect x={BX} y={bTop} width={16} height={buildingH} fill={YELLOW} stroke={ink} strokeWidth={2} />
        </g>

        {/* 사람 — 픽토그램. 머리 + 몸통이면 사람으로 읽힌다 */}
        <g opacity={t1} fill={ink}>
          <circle cx={PX} cy={GY - PH} r={15} />
          <rect x={PX - 12} y={GY - PH + 20} width={24} height={PH - 34} rx={11} />
        </g>

        {/* 마당 치수 — 재는 것이므로 손맛 없이 */}
        {yard > 0 ? (
          <DimLine x1={PX + 18} y1={GY + 54} x2={BX - 4} y2={GY + 54}
                   progress={t1} color={ink} width={3} cap={12}
                   label={yardLabel} labelSize={34} />
        ) : null}
      </svg>

      <div style={{position: 'absolute', left: PX - 110, width: 220, top: GY - 172,
                   textAlign: 'center', opacity: fadeIn(frame, 14),
                   fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: T.soft}}>
        {personLabel}
      </div>
      <div style={{position: 'absolute', left: BX - 60, width: 320, top: 0,
                   marginTop: Math.max(200, bTop - 58), textAlign: 'center',
                   opacity: fadeIn(frame, 20),
                   fontFamily: 'A2Z Medium, sans-serif',
                   fontSize: 34, color: T.ink}}>
        {buildingLabel}
      </div>

      {verdict ? (
        <div style={{position: 'absolute', left: 150, right: 150, top: CONTENT_BOTTOM - 76,
                     textAlign: 'center', opacity: fadeIn(frame, 62),
                     fontFamily: 'A2Z Medium, sans-serif',
                     fontSize: fit(verdict, 44, 1500),
                     color: clipped ? RED : T.ink, wordBreak: 'keep-all'}}>
          {verdict}
        </div>
      ) : null}

      {note ? (
        <div style={{position: 'absolute', left: 150, right: 150, top: CONTENT_BOTTOM - 18,
                     textAlign: 'center', opacity: fadeIn(frame, 70),
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 28, color: T.soft}}>
          {note}
        </div>
      ) : null}

      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
