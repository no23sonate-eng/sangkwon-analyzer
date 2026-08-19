import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {
  PaperSurface, PaperHead, Stage, Credit, Mark,
  PAPER, PAPER_WARM, INK, INK2, INK3, HAIR, AMBER, P, M, SAFE_BOTTOM, fade, KO,
} from './v4';
import {DrawPath, EASE, stagger, useCountUp, useRevealUp} from './anim';

// ── v4 장치 5차 — 큰 수량 / 시계열 / 인용 ────────────────────────────────
// 하남스피어 대본을 v4 로 옮기다 보니 없는 문법 세 가지가 드러났다:
//   · 17,000석 같은 **큰 수량** — 픽토그램 6개짜리 장치로는 못 그린다
//   · 연도별 **추세** — 표로 적으면 "오르는 중"이 안 읽힌다
//   · **인용문** — 관계자 발언을 기사 카드로 우겨넣고 있었다

// 19) 큰 수량 — 점 격자. "숫자를 읽는" 게 아니라 "양을 본다"
export const PaperDotsCard = ({
  eyebrow = '', title = '',
  total = 0, perDot = 100, unit = '',
  hotFrom = -1, // 이 인덱스부터의 점을 강조 (예: 증설분)
  legend = '', caption = '', note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const dots = Math.max(1, Math.round(total / perDot));
  // 격자는 가로로 길게 — 화면비에 맞춰 열 수를 잡는다
  const cols = Math.min(40, Math.max(10, Math.ceil(Math.sqrt(dots * 2.6))));
  const rows = Math.ceil(dots / cols);
  const gap = Math.min(30, Math.max(14, Math.round(1180 / cols)));
  const r = Math.max(4, Math.round(gap * 0.30));
  const gw = (cols - 1) * gap;
  const gh = (rows - 1) * gap;
  const gx = 960 - gw / 2;
  // 글자를 키운 뒤(모바일 하한) 숫자·캡션·note 가 겹쳤다 — 격자를 위로 올린다
  const gy = 420 - gh / 2;
  const shown = Math.round(interpolate(frame, [10, 10 + Math.min(60, dots)], [0, dots], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outQuint,
  }));
  const counted = useCountUp(total, 10, Math.min(60, dots) + 10, 0);

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} plot />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {Array.from({length: dots}, (_, i) => {
          const cx = gx + (i % cols) * gap;
          const cy = gy + Math.floor(i / cols) * gap;
          const on = i < shown;
          const hot = hotFrom >= 0 && i >= hotFrom;
          return (
            <circle key={i} cx={cx} cy={cy} r={r}
              fill={!on ? '#DFE3E9' : hot ? AMBER : INK}
              opacity={on ? 1 : 0.5} />
          );
        })}
      </svg>

      <Stage top={Math.max(gy + gh + 46, 566)} style={{opacity: fade(frame, 16)}}>
        <span style={{...P.valueXL, fontSize: 116}}>{counted}</span>
        {unit ? <span style={{...P.valueXL, fontSize: 52, color: INK2, marginLeft: 10}}>{unit}</span> : null}
        {caption ? <div style={{marginTop: 18, ...P.body, fontSize: 32}}>{caption}</div> : null}
      </Stage>

      {/* 범례 — 나머지 요소와 같이 중앙. 텍스트에 이미 ● 가 있으면 떼고 쓴다 */}
      {legend ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 262, opacity: fade(frame, 30),
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10}}>
          <svg width={16} height={16}><circle cx={8} cy={8} r={5} fill={INK} /></svg>
          <span style={{...P.caption}}>{String(legend).replace(/^[●•]\s*/, '')}</span>
        </div>
      ) : null}

      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      {note ? <Stage top={SAFE_BOTTOM - 30} style={{opacity: fade(frame, 52)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 52)} />
    </AbsoluteFill>
  );
};

// 20) 추세 — 연도별 값을 선으로. "오르는 중"은 표로는 안 읽힌다
export const PaperTrendCard = ({
  eyebrow = '', title = '',
  series = [], // [{label, value, text, hot}]
  unit = '', axisLabel = '', note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = series.length || 1;
  const L = 300, R = 1620, TOP = 360, BASE = 664;
  const vals = series.map((s) => Number(s.value) || 0);
  const vmax = Math.max(...vals, 1);
  const vmin = Math.min(...vals, 0);
  const span = Math.max(vmax - vmin, 1e-6);
  const px = (i) => (n === 1 ? (L + R) / 2 : L + ((R - L) / (n - 1)) * i);
  const py = (v) => BASE - ((v - vmin) / span) * (BASE - TOP);
  const pts = series.map((s, i) => [px(i), py(Number(s.value) || 0)]);
  const d = pts.length ? 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') : '';
  const hotIdx = series.findIndex((s) => s.hot);

  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} plot />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 기준선 */}
        <DrawPath d={`M ${L - 40} ${BASE} L ${R + 40} ${BASE}`} start={2} dur={24} length={1420}
          stroke={INK} strokeWidth={2} />
        {/* 각 지점의 얇은 수직 안내선 */}
        {pts.map(([x, y], i) => (
          <line key={i} x1={x} y1={BASE} x2={x} y2={y} stroke={HAIR} strokeWidth={1}
            opacity={fade(frame, stagger(i, 5, 22)) * 0.9} />
        ))}
        {/* 추세선 — 그려지듯 */}
        {d ? <DrawPath d={d} start={14} dur={44} length={2400} stroke={INK} strokeWidth={3.4} /> : null}
        {pts.map(([x, y], i) => {
          const hot = i === hotIdx;
          return (
            <g key={i} opacity={fade(frame, stagger(i, 5, 24))}>
              {hot ? <circle cx={x} cy={y} r={22} fill="none" stroke={AMBER} strokeWidth={1.6} opacity={0.6} /> : null}
              <circle cx={x} cy={y} r={hot ? 11 : 7} fill={hot ? AMBER : INK} />
            </g>
          );
        })}
      </svg>

      {series.map((s, i) => {
        const [x, y] = pts[i];
        const hot = i === hotIdx;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: x - 150, width: 300, top: y - 76, textAlign: 'center',
              opacity: fade(frame, stagger(i, 5, 28))}}>
              <span style={{
                ...P.valueM, fontSize: hot ? 48 : 38, color: hot ? INK : INK2,
                background: 'rgba(240,242,247,0.92)', padding: '2px 10px', whiteSpace: 'nowrap',
              }}>{s.text || s.value}{unit ? <span style={{...P.dim, fontSize: hot ? 24 : 20, marginLeft: 4}}>{unit}</span> : null}</span>
            </div>
            <div style={{position: 'absolute', left: x - 150, width: 300, top: BASE + 22, textAlign: 'center',
              opacity: fade(frame, stagger(i, 5, 30))}}>
              <span style={{...P.label, fontSize: 30, color: hot ? INK : INK3}}>{s.label}</span>
            </div>
          </React.Fragment>
        );
      })}

      {axisLabel ? (
        <div style={{position: 'absolute', left: M, top: BASE - 34, opacity: fade(frame, 40)}}>
          <span style={{...P.caption}}>{axisLabel}</span>
        </div>
      ) : null}

      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      {note ? <Stage top={SAFE_BOTTOM - 38} style={{opacity: fade(frame, 54)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 54)} />
    </AbsoluteFill>
  );
};

// 21) 인용 — 관계자 발언. 기사 카드로 우겨넣지 않는다
export const PaperQuoteCard = ({
  eyebrow = '', quote = '', mark = '',
  speaker = '', role = '', note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const inn = useRevealUp(8, 30, 26);
  const markOn = interpolate(frame, [36, 62], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo,
  });
  const parts = mark && quote.includes(mark) ? quote.split(mark) : null;
  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER_WARM} />
      {eyebrow ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', opacity: fade(frame, 0)}}>
          <span style={{...P.eyebrow, color: '#8B8172'}}>{eyebrow}</span>
        </div>
      ) : null}
      {/* 큰 따옴표 — 지면 위 유일한 큰 도형 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 252, textAlign: 'center', opacity: fade(frame, 4)}}>
        <span style={{fontFamily: 'A2Z Medium, serif', fontSize: 150, lineHeight: 0.6, color: '#CFC7B8'}}>“</span>
      </div>
      <div style={{position: 'absolute', left: 280, right: 280, top: 344, textAlign: 'center', ...inn}}>
        <div style={{...KO, fontFamily: 'A2Z Regular, sans-serif', fontSize: 58, lineHeight: 1.44,
          letterSpacing: '-0.01em', color: INK}}>
          {parts ? (<>{parts[0]}<Mark on={markOn}>{mark}</Mark>{parts[1]}</>) : quote}
        </div>
      </div>
      {speaker ? (
        <Stage top={SAFE_BOTTOM - 118} style={{opacity: fade(frame, 44)}}>
          <div style={{width: 72, height: 1, background: '#CFC7B8', margin: '0 auto 22px'}} />
          <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 30, letterSpacing: '0.08em', color: INK}}>{speaker}</span>
          {role ? <span style={{...P.caption, fontSize: 28, marginLeft: 14}}>{role}</span> : null}
        </Stage>
      ) : null}
      {note ? <Stage top={SAFE_BOTTOM - 34} style={{opacity: fade(frame, 52)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 52)} />
    </AbsoluteFill>
  );
};
