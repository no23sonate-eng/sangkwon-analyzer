import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Img, continueRender, delayRender, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {
  PaperSurface, PaperHead, Stage, Credit, Mark,
  PAPER, PAPER_WARM, INK, INK2, INK3, HAIR, AMBER, BRAND, P, M, SAFE_BOTTOM, fade, KO,
} from './v4';
import {DrawPath, EASE, stagger, useRevealUp} from './anim';

// ── v4 장치 6차 — 스크립트에 나올 만한 나머지를 전부 덮는다 (2026-08-19) ──
// B1M 본편 558프레임에서 새로 확인한 문법 + 부동산 대본에 반드시 필요한 것들.
//   · 수식/계산     — 부동산 설명의 절반은 계산이다. 장치가 아예 없었다
//   · 구성비        — 지분·매출 구성. 막대 하나로 100% 를 쪼갠다
//   · 소유 구조     — 매도사 → SPC → 운용사. 흐름도로는 계층이 안 보인다
//   · 항목 나열     — 조건·요건. 글자 배치만으로 리듬을 만든다
//   · 신문 원문     — B1M 은 기사를 "재구성"하지 않고 지면 위를 천천히 지나간다
//   · 인물 초상     — 흑백 초상 + 이름. (촬영 인물 영상은 사용자가 직접 넣는다)
//   · 구역 색칠 지도 — 베를린 4개 점령지구처럼 면을 칠하고 범례를 단다

// 22) 수식 — 계산 과정을 항 단위로 보여준다
// terms: [{value, label}] / op: ['×','=',...] 항 사이 기호
export const PaperFormulaCard = ({
  eyebrow = '', title = '',
  terms = [], // 마지막 항이 결과 (hot 자동)
  ops = [],
  resultNote = '', note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = terms.length || 1;
  const last = n - 1;
  // 항이 많으면 글자를 줄여 한 줄에 담는다
  const scale = n >= 5 ? 0.72 : n === 4 ? 0.84 : 1;
  const vSize = Math.round(78 * scale);
  const opSize = Math.round(46 * scale);

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} plot />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />

      <div style={{
        position: 'absolute', left: M, right: M, top: 424,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: Math.round(26 * scale),
      }}>
        {terms.map((t, i) => {
          const hot = i === last;
          const inn = useRevealUp(stagger(i, 12, 10), 26, 18);
          return (
            <React.Fragment key={i}>
              {i > 0 ? (
                <div style={{
                  paddingTop: Math.round(vSize * 0.28),
                  opacity: fade(frame, stagger(i, 12, 6)),
                  fontFamily: 'A2Z Light, sans-serif', fontSize: opSize, color: INK3,
                }}>{ops[i - 1] || '×'}</div>
              ) : null}
              <div style={{textAlign: 'center', minWidth: 180, ...inn}}>
                {/* 결과 항만 속을 채운 검은 판 위에 흰 글씨 — 화면에 덩어리 하나 */}
                <div style={{
                  background: hot ? INK : 'transparent',
                  padding: hot ? `${Math.round(14 * scale)}px ${Math.round(24 * scale)}px ${Math.round(10 * scale)}px` : 0,
                  display: 'inline-block',
                }}>
                  <span style={{
                    fontFamily: 'A2Z Medium, sans-serif', fontSize: vSize, letterSpacing: '-0.02em',
                    color: hot ? '#FFFFFF' : INK, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  }}>{t.value}</span>
                </div>
                <div style={{marginTop: 16, ...P.label, fontSize: Math.max(28, Math.round(30 * scale)), color: hot ? INK : INK2}}>
                  {t.label}
                </div>
                {t.sub ? <div style={{marginTop: 6, ...P.caption, fontSize: Math.max(26, Math.round(28 * scale))}}>{t.sub}</div> : null}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* 결과 항 아래 앰버 밑줄 — 어디가 답인지 */}
      {resultNote ? (
        <Stage top={640} style={{opacity: fade(frame, stagger(n, 12, 18))}}>
          <div style={{width: 96, height: 4, background: AMBER, margin: '0 auto 22px'}} />
          <span style={{...P.body, fontSize: 32}}>{resultNote}</span>
        </Stage>
      ) : null}

      {note ? <Stage top={SAFE_BOTTOM - 38} style={{opacity: fade(frame, 56)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 56)} />
    </AbsoluteFill>
  );
};

// 23) 구성비 — 막대 하나를 100% 로 쪼갠다 (지분·매출 구성)
// parts: [{label, value, hot, text}]
export const PaperShareCard = ({
  eyebrow = '', title = '',
  parts = [], totalLabel = '', note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const sum = parts.reduce((a, p) => a + (Number(p.value) || 0), 0) || 1;
  const BW = 1500, BH = 132, BX = (1920 - BW) / 2, BY = 396;
  const grow = interpolate(frame, [8, 44], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
  });
  let acc = 0;
  const laid = parts.map((p) => {
    const w = (BW * (Number(p.value) || 0)) / sum;
    const x = BX + acc;
    acc += w;
    return {...p, x, w, pct: ((Number(p.value) || 0) / sum) * 100};
  });

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} plot />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <g clipPath="url(#shareClip)">
          <defs>
            <clipPath id="shareClip">
              <rect x={BX} y={BY} width={BW * grow} height={BH} />
            </clipPath>
          </defs>
          {laid.map((p, i) => (
            <rect key={i} x={p.x} y={BY} width={p.w} height={BH}
              fill={p.hot ? INK : i % 2 ? '#C9CFD8' : '#DDE2E9'} />
          ))}
        </g>
        <rect x={BX} y={BY} width={BW * grow} height={BH} fill="none" stroke={INK} strokeWidth={1.6} />
        {/* 조각 경계 */}
        {laid.slice(1).map((p, i) => (
          <line key={i} x1={p.x} y1={BY} x2={p.x} y2={BY + BH}
            stroke="#FFFFFF" strokeWidth={2} opacity={grow} />
        ))}
        {/* 주인공 조각만 앰버 밑줄 */}
        {laid.map((p, i) => (p.hot ? (
          <rect key={i} x={p.x} y={BY + BH} width={p.w * grow} height={6} fill={AMBER} />
        ) : null))}
      </svg>

      {laid.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.x + p.w / 2 - 190, width: 380, top: BY + BH + 32,
          textAlign: 'center', opacity: fade(frame, stagger(i, 6, 26)),
        }}>
          <div style={{
            fontFamily: p.hot ? 'A2Z Medium, sans-serif' : 'A2Z Light, sans-serif',
            fontSize: 30, letterSpacing: '0.06em', color: p.hot ? INK : INK2, ...KO,
          }}>{p.label}</div>
          <div style={{marginTop: 6, ...P.valueM, fontSize: p.hot ? 42 : 34, color: p.hot ? INK : INK2}}>
            {p.text || `${p.pct.toFixed(p.pct < 10 ? 1 : 0)}%`}
          </div>
        </div>
      ))}

      {totalLabel ? (
        <div style={{position: 'absolute', left: BX, top: BY - 46, opacity: fade(frame, 24)}}>
          <span style={{...P.caption}}>{totalLabel}</span>
        </div>
      ) : null}

      {note ? <Stage top={SAFE_BOTTOM - 38} style={{opacity: fade(frame, 54)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 54)} />
    </AbsoluteFill>
  );
};

// 24) 소유·지분 구조 — 계층. 흐름도(가로 나열)로는 "누가 위인지"가 안 보인다
// root: {label, sub} / children: [{label, sub, share, hot}]
export const PaperOrgCard = ({
  eyebrow = '', title = '',
  root = null, children: kids = [], note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = kids.length || 1;
  const RW = 460, RH = 130, RY = 352;
  const RX = 960 - RW / 2;
  const CW = Math.min(400, Math.floor(1560 / n) - 30);
  const CH = 150, CY = 592;
  const slot = 1560 / n;
  const cx = (i) => 960 - 780 + slot * i + slot / 2;

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} plot />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />

      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 뿌리 상자 — 검은 덩어리 */}
        {root ? (
          <rect x={RX} y={RY} width={RW} height={RH} fill={INK}
            opacity={interpolate(frame, [4, 26], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo})} />
        ) : null}
        {/* 세로 줄기 + 가로 가지 */}
        <DrawPath d={`M 960 ${RY + RH} L 960 ${CY - 56}`} start={22} dur={16} length={120} stroke={INK2} strokeWidth={1.8} />
        {n > 1 ? (
          <DrawPath d={`M ${cx(0)} ${CY - 56} L ${cx(n - 1)} ${CY - 56}`} start={30} dur={20} length={1560}
            stroke={INK2} strokeWidth={1.8} />
        ) : null}
        {kids.map((k, i) => (
          <DrawPath key={i} d={`M ${cx(i)} ${CY - 56} L ${cx(i)} ${CY}`}
            start={stagger(i, 5, 38)} dur={14} length={60} stroke={INK2} strokeWidth={1.8} />
        ))}
        {/* 자식 상자 */}
        {kids.map((k, i) => {
          const t = interpolate(frame, [stagger(i, 5, 40), stagger(i, 5, 40) + 24], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
          });
          return (
            <g key={i} opacity={t}>
              <rect x={cx(i) - CW / 2} y={CY} width={CW} height={CH}
                fill={k.hot ? 'rgba(217,154,31,0.10)' : '#FFFFFF'}
                stroke={k.hot ? INK : '#B4BAC2'} strokeWidth={k.hot ? 2 : 1.2} />
              {k.hot ? <rect x={cx(i) - CW / 2} y={CY + CH} width={CW} height={5} fill={AMBER} /> : null}
            </g>
          );
        })}
      </svg>

      {root ? (
        <div style={{position: 'absolute', left: RX, top: RY, width: RW, height: RH,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          opacity: fade(frame, 8)}}>
          <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 40, color: '#FFFFFF', ...KO}}>{root.label}</div>
          {root.sub ? <div style={{marginTop: 8, ...P.caption, fontSize: 27, color: 'rgba(255,255,255,0.72)'}}>{root.sub}</div> : null}
        </div>
      ) : null}

      {kids.map((k, i) => (
        <div key={i} style={{
          position: 'absolute', left: cx(i) - CW / 2, top: CY, width: CW, height: CH,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6,
          opacity: fade(frame, stagger(i, 5, 44)), padding: '0 14px', boxSizing: 'border-box',
        }}>
          {k.share ? <div style={{...P.valueM, fontSize: 38, color: k.hot ? INK : INK2}}>{k.share}</div> : null}
          <div style={{...P.label, fontSize: 29, color: INK, textAlign: 'center', ...KO}}>{k.label}</div>
          {k.sub ? <div style={{...P.caption, fontSize: 26, textAlign: 'center'}}>{k.sub}</div> : null}
        </div>
      ))}

      {note ? <Stage top={SAFE_BOTTOM - 38} style={{opacity: fade(frame, 58)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 58)} />
    </AbsoluteFill>
  );
};

// 25) 항목 나열 — 조건·요건. 번호를 달고 하나씩 쌓는다
export const PaperListCard = ({
  eyebrow = '', title = '',
  items = [], // [{text, sub, hot}]
  numbered = true, note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = items.length || 1;
  const rowH = n >= 5 ? 84 : n === 4 ? 96 : 108;
  const top = 400 - (n * rowH) / 2 + 96;
  const W = 1180, X = (1920 - W) / 2;

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} plot />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />

      {items.map((it, i) => {
        const inn = useRevealUp(stagger(i, 8, 12), 26, 18);
        const y = top + i * rowH;
        return (
          <div key={i} style={{
            position: 'absolute', left: X, top: y, width: W, height: rowH,
            display: 'flex', alignItems: 'center', gap: 26, ...inn,
          }}>
            {numbered ? (
              <div style={{
                width: 48, height: 48, flex: '0 0 48px',
                background: it.hot ? INK : 'transparent',
                border: it.hot ? 'none' : `1.5px solid ${HAIR}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: 'A2Z Medium, sans-serif', fontSize: 28, paddingTop: 3,
                  color: it.hot ? '#FFFFFF' : INK2,
                }}>{i + 1}</span>
              </div>
            ) : (
              <div style={{width: 10, height: 10, flex: '0 0 10px', background: it.hot ? AMBER : INK3}} />
            )}
            <div style={{flex: 1}}>
              <div style={{
                ...KO, fontFamily: it.hot ? 'A2Z Regular, sans-serif' : 'A2Z Light, sans-serif',
                fontSize: 36, color: INK, letterSpacing: '0.01em',
              }}>{it.text}</div>
              {it.sub ? <div style={{marginTop: 5, ...P.caption, fontSize: 27}}>{it.sub}</div> : null}
            </div>
            <div style={{position: 'absolute', left: 0, bottom: 0, width: W, height: 1, background: HAIR, opacity: 0.7}} />
          </div>
        );
      })}

      {note ? <Stage top={SAFE_BOTTOM - 38} style={{opacity: fade(frame, stagger(n, 8, 24))}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 54)} />
    </AbsoluteFill>
  );
};

// 26) 신문 원문 — B1M 은 기사를 재구성하지 않는다. 지면 위를 천천히 지나가며
// 한 구절만 형광펜으로 집는다. (실측: 베를린 공항 기사 프레임)
export const PaperPressCard = ({
  outlet = '', byline = '', date = '',
  columns = [], // [[문단, 문단...], [문단...]] — 2~3단 조판
  headline = '', mark = '', // mark 가 들어 있는 문단에 형광펜
  image = '', // 실제 지면 스캔이 있으면 그걸 쓴다
  note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  // 아주 느린 세로 이동 — "읽고 있는" 느낌
  const pan = interpolate(frame, [0, 300], [0, -110], {extrapolateRight: 'clamp'});
  const markOn = interpolate(frame, [44, 78], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
  });
  const nCol = Math.max(1, columns.length);
  // B1M 의 기사 프레임은 지면이 화면보다 크다. 글이 짧으면 크기를 키워 채운다.
  const chars = columns.reduce((a, c) => a + c.reduce((b, p2) => b + p2.length, 0), 0);
  const bodySize = chars < 260 ? 34 : chars < 420 ? 30 : chars < 700 ? 27 : 25;
  const headSize = chars < 420 ? 62 : 54;

  return (
    <AbsoluteFill style={{background: PAPER_WARM}}>
      <PaperSurface tone={PAPER_WARM} />
      <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${pan}px)`}}>
          {image ? (
            <Img src={staticFile(image)} style={{width: '100%', display: 'block'}} />
          ) : (
            <div style={{padding: '150px 150px 0'}}>
              {headline ? (
                <div style={{
                  ...KO, fontFamily: 'A2Z Regular, sans-serif', fontSize: headSize, lineHeight: 1.28,
                  color: INK, marginBottom: 30, opacity: fade(frame, 2),
                }}>{headline}</div>
              ) : null}
              <div style={{display: 'flex', gap: 56, opacity: fade(frame, 6)}}>
                {columns.map((col, ci) => (
                  <div key={ci} style={{flex: 1}}>
                    {col.map((para, pi) => {
                      const has = mark && para.includes(mark);
                      const parts = has ? para.split(mark) : null;
                      return (
                        <p key={pi} style={{
                          ...KO, margin: '0 0 16px', fontFamily: 'A2Z Light, sans-serif',
                          fontSize: bodySize, lineHeight: 1.66, color: '#3B3A36', textAlign: 'justify',
                        }}>
                          {parts ? (<>{parts[0]}<Mark on={markOn}>{mark}</Mark>{parts[1]}</>) : para}
                        </p>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 위·아래 종이색 페이드 — 잘린 글줄이 눈에 안 띄게 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 120, pointerEvents: 'none',
        background: `linear-gradient(180deg, ${PAPER_WARM} 0%, rgba(239,235,227,0) 100%)`}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: SAFE_BOTTOM - 120, bottom: 0, pointerEvents: 'none',
        background: `linear-gradient(180deg, rgba(239,235,227,0) 0%, ${PAPER_WARM} 45%, ${PAPER_WARM} 100%)`}} />

      {/* 매체 표기 — 좌상단 작은 띠 */}
      {outlet ? (
        <div style={{position: 'absolute', left: M, top: 62, opacity: fade(frame, 0),
          display: 'flex', alignItems: 'baseline', gap: 16}}>
          <span style={{
            background: INK, color: '#FFFFFF', padding: '7px 14px 5px',
            fontFamily: 'A2Z Medium, sans-serif', fontSize: 26, letterSpacing: '0.18em',
          }}>{outlet}</span>
          {date ? <span style={{...P.caption, fontSize: 26}}>{date}</span> : null}
          {byline ? <span style={{...P.caption, fontSize: 26}}>{byline}</span> : null}
        </div>
      ) : null}

      {note ? <Stage top={SAFE_BOTTOM - 34} style={{opacity: fade(frame, 60)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 60)} />
    </AbsoluteFill>
  );
};

// 27) 인물 — 흑백 초상 + 이름/역할 (+ 선택적 한 줄 인용).
// 촬영 인물 영상은 사용자가 직접 넣는다. 이건 아카이브 초상용.
export const PaperPortraitCard = ({
  eyebrow = '', image = '',
  name = '', role = '', quote = '', mark = '',
  note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const PW = 380, PH = 470, PX = quote ? 300 : 960 - PW / 2, PY = 300;
  const inn = useRevealUp(10, 30, 24);
  const markOn = interpolate(frame, [40, 70], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
  });
  const parts = mark && quote.includes(mark) ? quote.split(mark) : null;

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} plot />
      <PaperHead eyebrow={eyebrow} title="" opacity={fade(frame, 0)} />

      <div style={{
        position: 'absolute', left: PX, top: PY, width: PW, height: PH, overflow: 'hidden',
        background: '#DDE1E7', ...inn,
      }}>
        {image ? (
          <Img src={staticFile(image)} style={{
            width: '100%', height: '100%', objectFit: 'cover',
            filter: 'grayscale(1) contrast(1.08)',
            transform: `scale(${1.03 + (frame / 1600) * 0.05})`,
          }} />
        ) : null}
      </div>

      <div style={{
        position: 'absolute', left: PX, width: PW, top: PY + PH + 22, textAlign: 'center',
        opacity: fade(frame, 26),
      }}>
        <div style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 32, letterSpacing: '0.06em', color: INK, ...KO}}>{name}</div>
        {role ? <div style={{marginTop: 6, ...P.caption, fontSize: 27}}>{role}</div> : null}
      </div>

      {quote ? (
        <div style={{position: 'absolute', left: PX + PW + 90, right: M, top: PY + 40, opacity: fade(frame, 34)}}>
          <div style={{fontFamily: 'A2Z Medium, serif', fontSize: 96, lineHeight: 0.6, color: HAIR}}>“</div>
          <div style={{
            marginTop: 34, ...KO, fontFamily: 'A2Z Regular, sans-serif', fontSize: 46, lineHeight: 1.44, color: INK,
          }}>
            {parts ? (<>{parts[0]}<Mark on={markOn}>{mark}</Mark>{parts[1]}</>) : quote}
          </div>
        </div>
      ) : null}

      {note ? <Stage top={SAFE_BOTTOM - 38} style={{opacity: fade(frame, 56)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 56)} />
    </AbsoluteFill>
  );
};

// 28) 구역 색칠 지도 + 범례 — 베를린 4개 점령지구 문법.
// regions: [{name, color, label}] — geo 의 feature 이름과 name 을 맞춘다
export const PaperChoroCard = ({
  eyebrow = '', title = '',
  geo = 'geo/korea_provinces.geo.json',
  nameKey = 'name',
  focus = [125.8, 33.1, 129.8, 38.7],
  regions = [], legendTitle = '',
  mapTop = 300, mapBottom = 790, fill = 1,
  note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const [shapes, setShapes] = useState(null);
  const [handle] = useState(() => delayRender('구역 지도 로드'));
  const W_ = 1920, H_ = 1080;

  const prj = (() => {
    const [x0, y0, x1, y1] = focus;
    const cLon = (x0 + x1) / 2;
    const cLat = (y0 + y1) / 2;
    const kx = Math.cos((cLat * Math.PI) / 180);
    const scale = Math.min(((W_ - 2 * M) * fill) / ((x1 - x0) * kx),
      ((mapBottom - mapTop) * fill) / (y1 - y0));
    const cy = (mapTop + mapBottom) / 2;
    return (lon, lat) => [W_ / 2 + (lon - cLon) * kx * scale, cy - (lat - cLat) * scale];
  })();

  useEffect(() => {
    fetch(staticFile(geo))
      .then((r) => r.json())
      .then((gj) => {
        const out = [];
        for (const f of gj.features) {
          const nm = String((f.properties || {})[nameKey] ?? '');
          const g = f.geometry;
          if (!g) continue;
          const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
          const ds = [];
          for (const poly of polys) {
            for (const ring of poly) {
              if (ring.length < 6) continue;
              const step = ring.length > 3000 ? Math.ceil(ring.length / 1500) : 1;
              const kept = step > 1 ? ring.filter((_, i) => i % step === 0 || i === ring.length - 1) : ring;
              ds.push('M' + kept.map(([lo, la]) => prj(lo, la).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z');
            }
          }
          if (ds.length) out.push({name: nm, d: ds.join(' ')});
        }
        setShapes(out);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colorOf = (nm) => {
    const hit = regions.find((r) => nm && (nm === r.name || nm.includes(r.name) || r.name.includes(nm)));
    return hit ? hit.color || AMBER : null;
  };

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} />
      <svg width={W_} height={H_} style={{position: 'absolute', top: 0, left: 0}}>
        {shapes ? shapes.map((s, i) => {
          const c = colorOf(s.name);
          const t = interpolate(frame, [stagger(i % 8, 4, 8), stagger(i % 8, 4, 8) + 22], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
          });
          return (
            <path key={i} d={s.d} fill={c || '#CFD5DE'} stroke="#FFFFFF" strokeWidth={1.4}
              opacity={(c ? 1 : 0.85) * t} />
          );
        }) : null}
      </svg>

      {/* 범례 — B1M 은 우상단에 작은 상자로 단다 */}
      {regions.length ? (
        <div style={{position: 'absolute', right: M, top: 300, opacity: fade(frame, 30),
          background: 'rgba(240,242,247,0.94)', padding: '18px 22px 16px', border: `1px solid ${HAIR}`}}>
          {legendTitle ? <div style={{...P.caption, marginBottom: 12}}>{legendTitle}</div> : null}
          {regions.map((r, i) => (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: i ? 10 : 0}}>
              <div style={{width: 20, height: 14, background: r.color || AMBER}} />
              <span style={{...P.label, fontSize: 28, color: INK}}>{r.label || r.name}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 300, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(240,242,247,0.95) 0%, rgba(240,242,247,0.7) 55%, rgba(240,242,247,0) 100%)'}} />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      {note ? <Stage top={SAFE_BOTTOM - 38} style={{opacity: fade(frame, 52)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 52)} />
    </AbsoluteFill>
  );
};
