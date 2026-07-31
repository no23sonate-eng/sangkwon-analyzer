import React, {useEffect, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {BLACK, YELLOW, WHITE, MUTE, GRAY, glow, fadeIn, Kicker, Footer} from './v2shared';

// v2 지도 카드 — 순블랙 위 다크 랜드매스 + 발광 마커 (Cleo 지도 문법).
// focus: [lonMin, latMin, lonMax, latMax] 로 영역을 잘라 보여준다.
// markers: [{lon, lat, label, sub, hot, dead}] — hot 옐로 발광, dead 회색 ✕.
// rings=true 인 hot 마커는 퍼져나가는 동심원(교두보/허브 연출).
const W = 1920;
const H = 1080;

const project = (lon, lat, focus) => {
  const [x0, y0, x1, y1] = focus;
  // 화면 비율에 맞춰 등장방형 투영 + 위도 보정 없는 단순 투영(스타일 지도)
  const px = ((lon - x0) / (x1 - x0)) * W;
  const py = ((y1 - lat) / (y1 - y0)) * H;
  return [px, py];
};

const ringsToPath = (rings, focus) =>
  rings
    .map((ring) => {
      const pts = ring.map(([lon, lat]) => project(lon, lat, focus).map((v) => v.toFixed(1)).join(','));
      return `M${pts.join('L')}Z`;
    })
    .join(' ');

export const GeoMapCard = ({
  kicker = '',
  sub = '',
  focus = [100, 20, 150, 50],
  markers = [],
  rings = false,
  caption = '',
  source = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = fadeIn(frame, 0, 16);
  const [paths, setPaths] = useState(null);
  const [handle] = useState(() => delayRender('세계지도 로드'));

  useEffect(() => {
    fetch(staticFile('geo/world.geo.json'))
      .then((r) => r.json())
      .then((geo) => {
        const ps = [];
        for (const f of geo.features) {
          const g = f.geometry;
          const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
          for (const poly of polys) {
            ps.push(ringsToPath(poly, focus));
          }
        }
        setPaths(ps.join(' '));
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
    // focus 는 렌더 간 고정 props — 의존성 재계산 불필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AbsoluteFill style={{background: BLACK, fontFamily: 'A2Z Regular, sans-serif'}}>
      {paths ? (
        <svg width={W} height={H} style={{position: 'absolute', top: 0, left: 0, opacity: enter}}>
          <path d={paths} fill="#181A1D" stroke="#33363B" strokeWidth={1.2} />
        </svg>
      ) : null}

      {/* 마커 */}
      {markers.map((m, i) => {
        const [x, y] = project(m.lon, m.lat, focus);
        const pop = spring({frame: frame - 14 - i * 10, fps, config: {damping: 200}, durationInFrames: 22});
        const pulse = 0.5 + 0.5 * Math.sin(frame / 9 + i);
        const col = m.dead ? '#6A6A6A' : m.hot ? YELLOW : WHITE;
        return (
          <React.Fragment key={i}>
            <svg width={W} height={H} style={{position: 'absolute', top: 0, left: 0, opacity: pop}}>
              {m.hot && rings
                ? [1, 2, 3].map((k) => (
                    <circle
                      key={k}
                      cx={x} cy={y}
                      r={30 + ((frame * 1.2 + k * 46) % 140)}
                      fill="none" stroke={YELLOW}
                      strokeWidth={1.4}
                      opacity={0.5 * (1 - (((frame * 1.2 + k * 46) % 140) / 140))}
                    />
                  ))
                : null}
              {m.hot ? (
                <circle cx={x} cy={y} r={26 + pulse * 6} fill="rgba(250,255,46,0.16)" />
              ) : null}
              {m.dead ? (
                <>
                  <line x1={x - 13} y1={y - 13} x2={x + 13} y2={y + 13} stroke={col} strokeWidth={4} />
                  <line x1={x - 13} y1={y + 13} x2={x + 13} y2={y - 13} stroke={col} strokeWidth={4} />
                </>
              ) : (
                <circle
                  cx={x} cy={y} r={13}
                  fill={col}
                  style={m.hot ? {filter: 'drop-shadow(0 0 14px rgba(250,255,46,0.9))'} : undefined}
                />
              )}
            </svg>
            <div
              style={{
                position: 'absolute',
                left: x + (m.labelLeft ? -460 : 40),
                top: y - 46,
                width: 420,
                textAlign: m.labelLeft ? 'right' : 'left',
                opacity: pop,
              }}
            >
              <div
                style={{
                  fontFamily: 'A2Z Medium, sans-serif',
                  fontSize: 44,
                  letterSpacing: '0.04em',
                  color: col,
                  textShadow: m.hot ? glow(0.7) : 'none',
                }}
              >
                {m.label}
              </div>
              {m.sub ? (
                <div style={{marginTop: 6, fontFamily: 'A2Z Light, sans-serif', fontSize: 29, letterSpacing: '0.05em', color: m.hot ? WHITE : MUTE}}>
                  {m.sub}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}

      <Kicker title={kicker} sub={sub} opacity={enter} />
      <Footer caption={caption} source={source} opacity={fadeIn(frame, 40)} />
    </AbsoluteFill>
  );
};
