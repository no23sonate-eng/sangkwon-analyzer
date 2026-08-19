import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Img, continueRender, delayRender, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {
  PaperSurface, PaperHead, Stage, Credit, PlaceChip, FootageSurface, Mark,
  KO,
  PAPER, PAPER_WARM, INK, INK2, INK3, HAIR, AMBER, BRAND, P, W, M, SAFE_BOTTOM, fade,
} from './v4';
import {DrawPath, EASE, stagger, useCountUp, useRevealUp} from './anim';

// ── v4 장치 2차 — B1M 영상 12편 추가 분석에서 확인된 문법 ────────────────
// (나일강 메가댐 / 마그레브 / 하이퍼루프 / 아반도노 등)

// 7) 실사 위 빅넘버 — 초점 흐린 실사 위에 숫자만 크게 (B1M "5,000MW" 문법)
// 숫자는 Light, 단위는 Medium 으로 굵기를 바꿔 대비를 만든다.
export const FootageStatCard = ({
  image = '', video = '', place = '', credit = '',
  valueTarget = 0, valueText = '', decimals = 0, unit = '',
  label = '', caption = '', blur = 6,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const counted = useCountUp(valueTarget, 10, 46, decimals);
  const shown = valueText || counted;
  const inn = useRevealUp(8, 30, 34);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, filter: `blur(${blur}px)`, transform: 'scale(1.06)'}}>
        <FootageSurface image={image} video={video} scrim="full" />
      </div>
      <PlaceChip text={place} opacity={fade(frame, 8)} />
      <Stage top={392} style={inn}>
        {label ? <div style={{...W.label, fontSize: 30, marginBottom: 22, opacity: 0.9}}>{label}</div> : null}
        <div style={{whiteSpace: 'nowrap'}}>
          <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 210, letterSpacing: '-0.03em', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums'}}>
            {shown}
          </span>
          <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 128, letterSpacing: '-0.01em', color: '#FFFFFF', marginLeft: 6}}>
            {unit}
          </span>
        </div>
        {caption ? <div style={{marginTop: 30, ...W.label, fontSize: 30, letterSpacing: '0.08em', opacity: fade(frame, 40)}}>{caption}</div> : null}
      </Stage>
      <Credit text={credit} opacity={fade(frame, 24)} />
    </AbsoluteFill>
  );
};

// 8) 연한 세계지도 — 회색 대륙 + 얇은 루트 + 작은 마커 (B1M 위치 문법)
// focus: [lonMin, latMin, lonMax, latMax] / markers: [{lon, lat, label, hot}]
// route: [[lon,lat], ...] 를 주면 파선 루트를 그린다.
export const PaperWorldMapCard = ({
  eyebrow = '', title = '', focus = [110, 20, 145, 48],
  geo = 'geo/world.geo.json', // 한국 상세도는 'geo/korea_provinces.geo.json'
  markers = [], route = null, note = '', credit = '',
  // 지도가 놓일 세로 구간 — 헤더 아래 ~ 자막 안전영역 위
  mapTop = 285, mapBottom = 800, fill = 1,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const [paths, setPaths] = useState(null);
  const [handle] = useState(() => delayRender('지도 로드'));
  const W_ = 1920, H_ = 1080;
  // 등장방형 투영에 위도 보정(cos φ)을 넣고, focus 상자를 화면에 맞춰 letterbox.
  // 보정 없이 가로로 늘리면 한반도가 뚱뚱해진다 — B1M 지도는 형태를 지킨다.
  const prj = (() => {
    const [x0, y0, x1, y1] = focus;
    const cLon = (x0 + x1) / 2;
    const cLat = (y0 + y1) / 2;
    const kx = Math.cos((cLat * Math.PI) / 180);
    const wUnits = (x1 - x0) * kx;
    const hUnits = y1 - y0;
    // 헤더(상단 ~260px)와 자막 안전영역을 피해 세로로 조금 눌러 담는다
    const availW = (W_ - 2 * M) * fill;
    const availH = (mapBottom - mapTop) * fill;
    const scale = Math.min(availW / wUnits, availH / hUnits);
    const cy = (mapTop + mapBottom) / 2;
    return (lon, lat) => [
      W_ / 2 + (lon - cLon) * kx * scale,
      cy - (lat - cLat) * scale,
    ];
  })();
  useEffect(() => {
    fetch(staticFile(geo))
      .then((r) => r.json())
      .then((gj) => {
        // 정점이 아주 많은 상세 지도는 솎아낸다(형태는 유지, 렌더는 가볍게)
        let total = 0;
        for (const f of gj.features) {
          const g = f.geometry;
          const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
          for (const poly of polys) for (const ring of poly) total += ring.length;
        }
        const step = total > 120000 ? Math.ceil(total / 60000) : 1;
        const ps = [];
        for (const f of gj.features) {
          const g = f.geometry;
          const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
          for (const poly of polys) {
            for (const ring of poly) {
              if (ring.length < 8) continue;
              const kept = step > 1 ? ring.filter((_, i) => i % step === 0 || i === ring.length - 1) : ring;
              if (kept.length < 4) continue;
              const pts = kept.map(([lo, la]) => prj(lo, la).map((v) => v.toFixed(1)).join(','));
              ps.push(`M${pts.join('L')}Z`);
            }
          }
        }
        setPaths(ps.join(' '));
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routeD = route
    ? 'M' + route.map(([lo, la]) => prj(lo, la).map((v) => v.toFixed(1)).join(',')).join('L')
    : null;

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} />
      <svg width={W_} height={H_} style={{position: 'absolute', top: 0, left: 0}}>
        {paths ? <path d={paths} fill="#CFD5DE" stroke="#FFFFFF" strokeWidth={1.4} opacity={fade(frame, 4, 20)} /> : null}
        {routeD ? (
          <DrawPath d={routeD} start={16} dur={40} length={4000} stroke={AMBER} strokeWidth={3.5} strokeDasharray="10 8" />
        ) : null}
        {markers.map((m, i) => {
          const [x, y] = prj(m.lon, m.lat);
          const o = fade(frame, stagger(i, 8, 22));
          return (
            <g key={i} opacity={o}>
              <circle cx={x} cy={y} r={m.hot ? 11 : 7} fill={m.hot ? AMBER : INK} />
              {m.hot ? <circle cx={x} cy={y} r={22} fill="none" stroke={AMBER} strokeWidth={1.4} opacity={0.5} /> : null}
            </g>
          );
        })}
      </svg>
      {markers.map((m, i) => {
        const [x, y] = prj(m.lon, m.lat);
        return (
          <div key={i} style={{position: 'absolute', left: x - 200, width: 400, top: y - 86, textAlign: 'center', opacity: fade(frame, stagger(i, 8, 26))}}>
            <span style={{
              fontFamily: 'A2Z Medium, sans-serif', fontSize: 30, letterSpacing: '0.1em', color: INK,
              background: 'rgba(240,242,247,0.92)', padding: '3px 12px 1px', display: 'inline-block',
            }}>{m.label}</span>
            {m.sub ? (
              <div style={{marginTop: 4}}>
                <span style={{...P.caption, fontSize: 26, background: 'rgba(240,242,247,0.92)', padding: '2px 10px'}}>{m.sub}</span>
              </div>
            ) : null}
          </div>
        );
      })}
      {/* 헤더는 지도 위에 — 흰 스크림을 얇게 깔아 대비 확보 */}
      <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 300, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(240,242,247,0.95) 0%, rgba(240,242,247,0.7) 55%, rgba(240,242,247,0) 100%)'}} />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      {note ? <Stage top={SAFE_BOTTOM - 58} style={{opacity: fade(frame, 44)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 44)} />
    </AbsoluteFill>
  );
};

// 9) 문서 지면 — 밝은 바탕 위에 흰 페이지가 떠 있는 연출 (특허·보고서 인용)
// image 를 주면 실제 문서 스캔을, 없으면 텍스트 블록을 조판한다.
export const PaperDocumentCard = ({
  eyebrow = '', title = '', image = '',
  docTitle = '', docBody = [], mark = '',
  note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const pageIn = useRevealUp(8, 30, 26);
  const markOn = interpolate(frame, [34, 58], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo});
  const PW = 760, PH = 470;
  return (
    <AbsoluteFill>
      <PaperSurface tone="#E4E7EC" />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      <div
        style={{
          position: 'absolute', left: (1920 - PW) / 2, top: 320, width: PW, minHeight: PH,
          background: '#FFFFFF', boxShadow: '0 26px 60px rgba(20,24,30,0.16)',
          padding: '54px 60px', ...pageIn,
        }}
      >
        {image ? (
          <Img src={staticFile(image)} style={{width: '100%', display: 'block'}} />
        ) : (
          <>
            {docTitle ? (
              <div style={{...KO, fontFamily: 'A2Z Regular, sans-serif', fontSize: 40, lineHeight: 1.4, color: INK, letterSpacing: '-0.01em'}}>
                {mark && docTitle.includes(mark)
                  ? (<>{docTitle.split(mark)[0]}<Mark on={markOn}>{mark}</Mark>{docTitle.split(mark)[1]}</>)
                  : docTitle}
              </div>
            ) : null}
            <div style={{marginTop: 26, height: 1, background: '#E2E5EA'}} />
            {docBody.map((ln, i) => (
              <div key={i} style={{marginTop: i ? 14 : 24, ...P.body, fontSize: 29, color: INK2, lineHeight: 1.6, opacity: fade(frame, stagger(i, 5, 24))}}>
                {ln}
              </div>
            ))}
          </>
        )}
      </div>
      {note ? <Stage top={SAFE_BOTTOM - 56} style={{opacity: fade(frame, 46)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 46)} />
    </AbsoluteFill>
  );
};
