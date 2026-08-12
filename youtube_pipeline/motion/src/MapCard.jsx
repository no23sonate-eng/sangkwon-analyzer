import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, YELLOW, INK, CONTENT_BOTTOM, fadeIn} from './paper';
import {StampLabel} from './annotate';
import {fit, estWidth} from './layout';

// ── 지도 ─────────────────────────────────────────────────────────────────
// **부동산 채널인데 지도가 한 장도 없었다.** 43컷짜리 파크사이드 편에도 없다.
// "용산 유엔사 부지"라고 말해도 그게 서울 어디인지 화면이 답을 안 했다.
// 위치를 말로만 하면 아는 사람만 알아듣는다 — 그건 설명이 아니다.
//
// 지도는 `scripts/fetch_map.py` 가 타일을 받아 만든다. 그때 찍히는 `bounds` 를
// 그대로 넣으면 **위경도로 핀을 찍을 수 있다.** 픽셀을 눈대중으로 맞추지 않는다 —
// 그렇게 하면 지도를 다시 뽑을 때마다 전부 다시 맞춰야 한다.
//
// 순서 (B1M 이 지도를 쓰는 방식)
//   ① 넓게 깔고 **천천히 밀고 들어간다** — "여기가 어디인지"를 먼저 준다
//   ② 영역이 칠해진다 — 대상 부지
//   ③ 경로선이 그어진다 — 동선·연결
//   ④ 핀이 떨어지고 라벨이 붙는다
// 넷을 동시에 띄우면 지도가 아니라 "정보가 잔뜩 얹힌 그림"이 된다.
//
// bounds : [west, south, east, north] — fetch_map.py 가 찍어 준다
// pins   : [{lat, lon, label, sub, hot, side}]
// area   : {points: [[lat,lon], …], label}
// route  : {points: [[lat,lon], …], label, dashed}
// zoomTo : [lat, lon, 배율] — 여기로 밀고 들어간다 (생략하면 가운데로 살짝만)
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));

export const MapCard = ({
  image = '', bounds = null,
  title = '', sub = '',
  pins = [], area = null, route = null,
  zoomTo = null, zoomFrom = 1.0,
  scrim = 0,
  theme, align = 'center', source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = themeOf(theme);
  const dark = T.bg !== '#EFEAE3';

  // 위경도 → 지도 이미지 안의 0~1 좌표. 세로는 메르카토르라 선형이 아니다.
  const toXY = (lat, lon) => {
    if (!bounds) return [0.5, 0.5];
    const [w, s, e, n] = bounds;
    const x = (lon - w) / (e - w);
    const y = (merc(n) - merc(lat)) / (merc(n) - merc(s));
    return [x, y];
  };

  // ── 카메라 ──
  // 지도는 배경이 아니라 **주인공**이라 드리프트(§32-5)보다 크게 움직인다.
  // 그래도 이징은 아주 완만하게 — 확 당기면 지도를 읽을 시간이 없다.
  const push = interpolate(frame, [0, 150], [0, 1],
                           {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const eased = push * push * (3 - 2 * push);
  const zTo = zoomTo ? zoomTo[2] ?? 1.5 : 1.12;
  const k = zoomFrom + (zTo - zoomFrom) * eased;
  const [fx, fy] = zoomTo ? toXY(zoomTo[0], zoomTo[1]) : [0.5, 0.5];
  // 목표 지점이 화면 가운데로 오도록 민다 (배율이 커질수록 더 많이)
  const tx = (0.5 - (0.5 + (fx - 0.5) * eased)) * 1920 * k;
  const ty = (0.5 - (0.5 + (fy - 0.5) * eased)) * 1080 * k;

  // 화면 좌표 = 지도 0~1 좌표에 카메라를 먹인 값
  const SX = (x) => 960 + (x - 0.5) * 1920 * k + tx;
  const SY = (y) => 540 + (y - 0.5) * 1080 * k + ty;
  const px = (lat, lon) => { const [x, y] = toXY(lat, lon); return [SX(x), SY(y)]; };

  const areaT = interpolate(frame, [14, 40], [0, 1],
                            {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const routeT = interpolate(frame, [26, 62], [0, 1],
                             {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const areaPts = area?.points?.map(([la, lo]) => px(la, lo).join(',')).join(' ');
  const routePts = route?.points?.map(([la, lo]) => px(la, lo));
  // 경로선은 **그어지는 게 보여야** 한다. dasharray 로 길이를 잘라 늘린다.
  const routeLen = routePts
    ? routePts.reduce((acc, p, i) => i ? acc + Math.hypot(p[0] - routePts[i - 1][0],
                                                         p[1] - routePts[i - 1][1]) : 0, 0)
    : 0;

  const inkOnMap = dark ? '#F2F0EC' : '#1B1E23';

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: T.bg,
                          overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
        <Img src={/^https?:/.test(image) ? image : staticFile(image)}
             style={{position: 'absolute', left: 960 - 960 * k + tx, top: 540 - 540 * k + ty,
                     width: 1920 * k, height: 1080 * k, objectFit: 'cover',
                     filter: dark ? 'invert(1) hue-rotate(180deg) brightness(0.92)' : 'none'}} />
      </div>
      {scrim > 0 ? (
        <div style={{position: 'absolute', inset: 0, background: `${T.bg}`, opacity: scrim}} />
      ) : null}

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* ② 영역 — 부지. 테두리가 먼저 나타나고 채움이 따라온다 */}
        {areaPts ? (
          <g>
            <polygon points={areaPts} fill={YELLOW} opacity={0.26 * areaT} />
            <polygon points={areaPts} fill="none" stroke={YELLOW} strokeWidth={5}
                     opacity={areaT} strokeLinejoin="round" />
          </g>
        ) : null}

        {/* ③ 경로 — 왼쪽부터 그어진다 */}
        {routePts && routePts.length > 1 ? (
          <polyline points={routePts.map((p) => p.join(',')).join(' ')}
                    fill="none" stroke={route.hot ? YELLOW : inkOnMap} strokeWidth={7}
                    strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray={route.dashed ? '18 14' : `${routeLen} ${routeLen}`}
                    strokeDashoffset={route.dashed ? 0 : routeLen * (1 - routeT)}
                    opacity={route.dashed ? routeT : 1} />
        ) : null}

        {/* ④ 핀 — 위에서 떨어져 꽂힌다 */}
        {pins.map((p, i) => {
          const s = spring({frame: frame - (40 + i * 10), fps,
                            config: {damping: 200, mass: 0.5}});
          if (s <= 0.001) return null;
          const [X, Y] = px(p.lat, p.lon);
          const drop = (1 - s) * 46;
          const col = p.hot ? YELLOW : inkOnMap;
          return (
            <g key={i} opacity={s}>
              <ellipse cx={X} cy={Y} rx={12 * s} ry={4 * s} fill={inkOnMap} opacity={0.28} />
              <path d={`M ${X} ${Y - drop} l -13 -22 a 15 15 0 1 1 26 0 Z`}
                    fill={col} stroke={p.hot ? INK : 'none'} strokeWidth={2} />
              <circle cx={X} cy={Y - drop - 30} r={6} fill={p.hot ? INK : T.bg} />
            </g>
          );
        })}
      </svg>

      {/* 핀 라벨 — 검정 상자 (§31-4). 지도는 회색조라 상자가 확실히 이긴다 */}
      {pins.map((p, i) => {
        const o = fadeIn(frame, 50 + i * 10);
        if (o <= 0.01) return null;
        const [X, Y] = px(p.lat, p.lon);
        const size = fit(p.label || '', 40, 520);
        const w = estWidth(p.label || '', size) + 44;
        // 화면 밖으로 나갈 방향이면 뒤집는다
        let left = p.side === 'left';
        if (!left && X + 28 + w > 1880) left = true;
        if (left && X - 28 - w < 40) left = false;
        return (
          <div key={i} style={{position: 'absolute', top: Y - 92,
                               left: left ? X - 28 - w : X + 28,
                               width: w, opacity: o}}>
            {/* 라벨 상자는 **늘 검정**이다. 옐로는 '표시된 대상' 하나에만 쓴다(§31-4) —
                핀도 노랗고 라벨도 노라면 강조가 둘로 갈려 아무것도 강조가 안 된다.
                게다가 노란 영역 위에 노란 라벨이 얹히면 그냥 안 읽힌다. */}
            <StampLabel top={p.label} sub={p.sub} size={size}
                        align={left ? 'right' : 'left'} />
          </div>
        );
      })}

      {/* 제목 — 지도 위라 반드시 상자에 넣는다. 그림자로 버티면 지역마다 결과가 다르다 */}
      {title ? (
        <div style={{position: 'absolute', top: 92,
                     left: align === 'left' ? 120 : 0, right: align === 'left' ? undefined : 0,
                     textAlign: align === 'left' ? 'left' : 'center',
                     opacity: fadeIn(frame, 2)}}>
          <div style={{display: 'inline-block'}}>
            <StampLabel top={title} sub={sub} size={62}
                        align={align === 'left' ? 'left' : 'left'} />
          </div>
        </div>
      ) : null}

      {area?.label ? (
        <div style={{position: 'absolute', left: 120, top: CONTENT_BOTTOM - 60,
                     opacity: fadeIn(frame, 44)}}>
          <StampLabel top={area.label} size={40} hot />
        </div>
      ) : null}

      {source ? (
        <div style={{position: 'absolute', right: 30, top: 1028, textAlign: 'right',
                     fontFamily: 'A2Z Light, sans-serif', fontSize: 21,
                     color: dark ? '#C6CCD4' : '#4A5058',
                     background: dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.62)',
                     padding: '3px 10px'}}>
          {source}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
