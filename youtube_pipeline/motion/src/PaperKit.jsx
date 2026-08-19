import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {
  PaperSurface, PaperHead, Stage, Credit, Mark, PlaceChip, FootageSurface,
  PAPER, PAPER_WARM, INK, INK2, INK3, HAIR, AMBER, BRAND, P, W, M, SAFE_BOTTOM, fade,
} from './v4';
import {DrawPath, EASE, stagger, useCountUp, useRevealUp} from './anim';

// ── v4 장치 모음 — 모두 중앙 정렬 ──────────────────────────────────────
// B1M 지면은 콘텐츠를 화면 가운데로 모은다(인터뷰 카드·매스모델 실측).
// 표현이 단조로워지지 않도록 서로 다른 문법을 갖춘 장치들을 모아둔다.

// 1) 좌우 비교 — 두 값을 같은 축으로 나란히
export const PaperCompareCard = ({
  eyebrow = '', title = '', left = {}, right = {}, vs = 'VS', note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const CW = 560;
  const Side = ({d, x, delay}) => {
    const inn = useRevealUp(delay, 26, 20);
    const hot = Boolean(d.hot);
    return (
      <div style={{position: 'absolute', left: x, top: 330, width: CW, textAlign: 'center', ...inn}}>
        <div style={{...P.label, fontSize: 27}}>{d.title}</div>
        <div style={{marginTop: 22, ...P.valueL, fontSize: String(d.value || '').length > 7 ? 86 : 112, color: hot ? INK : INK2, whiteSpace: 'nowrap'}}>{d.value}</div>
        {hot ? <div style={{margin: '18px auto 0', width: 190, height: 4, background: AMBER}} /> : null}
        {(d.lines || []).map((ln, i) => (
          <div key={i} style={{marginTop: i ? 12 : 26, ...P.body, fontSize: 27, color: INK2}}>{ln}</div>
        ))}
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      <Side d={left} x={960 - CW - 90} delay={10} />
      <Side d={right} x={960 + 90} delay={20} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 424, textAlign: 'center', opacity: fade(frame, 28)}}>
        <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: 44, letterSpacing: '0.2em', color: INK3}}>{vs}</span>
      </div>
      {note ? (
        <Stage top={SAFE_BOTTOM - 66} style={{opacity: fade(frame, 40)}}>
          <span style={P.caption}>{note}</span>
        </Stage>
      ) : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 44)} />
    </AbsoluteFill>
  );
};

// 2) 표 — 얇은 구분선, 가운데 정렬된 표 블록
export const PaperTableCard = ({
  eyebrow = '', title = '', rows = [], closing = '', note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const TW = 1080;
  const rowH = rows.length > 4 ? 92 : 112;
  const top = 330;
  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      {rows.map((r, i) => {
        const inn = useRevealUp(stagger(i, 6, 10), 24, 14);
        return (
          <div key={i} style={{position: 'absolute', left: (1920 - TW) / 2, top: top + i * rowH, width: TW, height: rowH, ...inn}}>
            <div style={{position: 'absolute', bottom: 0, left: 0, width: TW, height: 1, background: HAIR}} />
            {i === 0 ? <div style={{position: 'absolute', top: 0, left: 0, width: TW, height: 1, background: HAIR}} /> : null}
            <div style={{position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 6, ...P.label, fontSize: 28}}>{r.label}</div>
            <div style={{position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 6, textAlign: 'right'}}>
              <span style={{...P.valueM, fontSize: r.hot ? 50 : 42}}>
                {r.hot ? <Mark on={interpolate(frame, [stagger(i, 6, 26), stagger(i, 6, 26) + 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo})}>{r.value}</Mark> : r.value}
              </span>
              {r.note ? <span style={{marginLeft: 16, ...P.caption, fontSize: 22}}>{r.note}</span> : null}
            </div>
          </div>
        );
      })}
      {closing ? (
        <Stage top={top + rows.length * rowH + 46} style={{opacity: fade(frame, stagger(rows.length, 6, 24))}}>
          <span style={{...P.body, fontSize: 34}}>{closing}</span>
        </Stage>
      ) : null}
      {note ? <Stage top={SAFE_BOTTOM - 60} style={{opacity: fade(frame, 46)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 46)} />
    </AbsoluteFill>
  );
};

// 3) 타임라인 — 가로 축 + 번호 점, 현재 단계만 앰버
export const PaperTimelineCard = ({
  eyebrow = '', title = '', steps = [], activeIndex = -1, note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const n = steps.length || 1;
  const axisW = 1360;
  const x0 = (1920 - axisW) / 2;
  const y = 470;
  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <DrawPath d={`M ${x0} ${y} L ${x0 + axisW} ${y}`} start={6} dur={34} length={axisW} stroke={INK2} strokeWidth={1.6} />
        {steps.map((s, i) => {
          const x = x0 + (axisW / (n - 1 || 1)) * i;
          const on = fade(frame, stagger(i, 7, 16));
          const act = i === activeIndex;
          return (
            <g key={i} opacity={on}>
              <circle cx={x} cy={y} r={act ? 13 : 8} fill={act ? AMBER : PAPER} stroke={INK} strokeWidth={act ? 0 : 1.6} />
              {act ? <circle cx={x} cy={y} r={24} fill="none" stroke={AMBER} strokeWidth={1.4} opacity={0.55} /> : null}
            </g>
          );
        })}
      </svg>
      {steps.map((s, i) => {
        const x = x0 + (axisW / (n - 1 || 1)) * i;
        const act = i === activeIndex;
        const LW = 380; // 라벨 폭 — 긴 회사명도 한 줄로
        // 양끝은 화면 밖으로 나가지 않게 안쪽으로 당긴다
        const lx = Math.min(Math.max(x - LW / 2, 20), 1920 - LW - 20);
        const vlen = String(s.value || '').length;
        const vsize = (act ? 46 : 38) * (vlen > 8 ? 0.72 : vlen > 6 ? 0.85 : 1);
        return (
          <div key={i} style={{position: 'absolute', left: lx, width: LW, top: y - 112, textAlign: 'center', opacity: fade(frame, stagger(i, 7, 18))}}>
            <div style={{...P.label, fontSize: 24, color: act ? INK : INK3}}>{s.label}</div>
            {s.value ? <div style={{marginTop: 8, ...P.valueM, fontSize: vsize, color: act ? INK : INK2, whiteSpace: 'nowrap'}}>{s.value}</div> : null}
          </div>
        );
      })}
      {steps.map((s, i) => (
        s.sub ? (
          <div key={i} style={{position: 'absolute', left: Math.min(Math.max(x0 + (axisW / (n - 1 || 1)) * i - 190, 20), 1920 - 400), width: 380, top: y + 34, textAlign: 'center', opacity: fade(frame, stagger(i, 7, 22))}}>
            <span style={{...P.caption, fontSize: 21}}>{s.sub}</span>
          </div>
        ) : null
      ))}
      {note ? <Stage top={SAFE_BOTTOM - 60} style={{opacity: fade(frame, 46)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 46)} />
    </AbsoluteFill>
  );
};

// 4) 개수 — 픽토그램을 실제 개수만큼, 가운데 그리드
const StoreGlyph = ({size = 1, ink = INK, on = 1}) => (
  <svg width={78 * size} height={92 * size} viewBox="0 0 78 92" style={{opacity: on}}>
    <path d="M8 30 L39 8 L70 30" fill="none" stroke={ink} strokeWidth={3} />
    <rect x={14} y={30} width={50} height={52} fill="none" stroke={ink} strokeWidth={3} />
    <rect x={28} y={52} width={22} height={30} fill="none" stroke={ink} strokeWidth={2.4} />
  </svg>
);

export const PaperCountCard = ({
  eyebrow = '', title = '', count = 6, unit = '개', caption = '', markCaption = false, note = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const cols = count <= 6 ? count : Math.ceil(count / 2);
  const cell = count <= 6 ? 190 : 150;
  const size = count <= 6 ? 1.15 : 0.9;
  const gridW = cols * cell;
  const shown = Math.floor(interpolate(frame, [12, 12 + count * 7], [0, count], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const markOn = interpolate(frame, [12 + count * 7 + 16, 12 + count * 7 + 40], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo});
  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER} />
      <PaperHead eyebrow={eyebrow} title={title} opacity={fade(frame, 0)} />
      <div style={{position: 'absolute', left: (1920 - gridW) / 2, top: 330, width: gridW, display: 'flex', flexWrap: 'wrap'}}>
        {Array.from({length: count}, (_, i) => (
          <div key={i} style={{width: cell, display: 'flex', justifyContent: 'center', paddingBottom: 18}}>
            <StoreGlyph size={size} ink={i < shown ? INK : '#CDD2D9'} on={fade(frame, stagger(i, 7, 12))} />
          </div>
        ))}
      </div>
      <Stage top={330 + Math.ceil(count / cols) * (cell * 0.62) + 120} style={{opacity: fade(frame, 12 + count * 7)}}>
        <span style={{...P.valueXL, fontSize: 132}}>{shown}</span>
        <span style={{...P.valueXL, fontSize: 56, color: INK2, marginLeft: 10}}>{unit}</span>
        {caption ? (
          <div style={{marginTop: 26, ...P.body, fontSize: 32}}>
            {markCaption ? <Mark on={markOn}>{caption}</Mark> : caption}
          </div>
        ) : null}
      </Stage>
      {note ? <Stage top={SAFE_BOTTOM - 58} style={{opacity: fade(frame, 50)}}><span style={P.caption}>{note}</span></Stage> : null}
      <Credit text={credit} dark={false} opacity={fade(frame, 50)} />
    </AbsoluteFill>
  );
};

// 5) 기사 지면 — 따뜻한 종이 + 세리프풍 헤드라인 (B1M 인용 문법)
export const PaperArticleCard = ({
  outlet = '', date = '', headline = '', deck = '', mark = '', credit = '',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const headIn = useRevealUp(8, 28, 24);
  const markOn = interpolate(frame, [34, 60], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo});
  const parts = mark && headline.includes(mark) ? headline.split(mark) : null;
  return (
    <AbsoluteFill>
      <PaperSurface tone={PAPER_WARM} />
      <div style={{position: 'absolute', left: 250, right: 250, top: 250, opacity: fade(frame, 0)}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 20}}>
          <span style={{...P.eyebrow, fontSize: 22}}>{outlet}</span>
          {date ? <span style={{...P.caption, fontSize: 20}}>{date}</span> : null}
        </div>
        <div style={{marginTop: 18, height: 1, background: '#CFC7B8'}} />
      </div>
      <div style={{position: 'absolute', left: 250, right: 250, top: 340, ...headIn}}>
        <div style={{fontFamily: 'A2Z Regular, sans-serif', fontSize: 62, lineHeight: 1.34, letterSpacing: '-0.01em', color: INK}}>
          {parts ? (<>{parts[0]}<Mark on={markOn}>{mark}</Mark>{parts[1]}</>) : headline}
        </div>
        {deck ? <div style={{marginTop: 28, ...P.body, fontSize: 28, color: INK2, lineHeight: 1.6}}>{deck}</div> : null}
      </div>
      <Credit text={credit} dark={false} opacity={fade(frame, 40)} />
    </AbsoluteFill>
  );
};

// 6) 항공/실사 위 주석 — 앰버 사각 표시 + 지시선 라벨 (B1M 위성 문법)
export const FootageAnnotateCard = ({
  image = '', video = '', place = '', credit = '',
  box = {x: 760, y: 420, w: 400, h: 240}, // 표시할 영역
  label = '', sub = '',
  labelSide = 'right',
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const t = interpolate(frame, [10, 40], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.outExpo});
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const lx = labelSide === 'right' ? box.x + box.w + 180 : box.x - 180;
  const ly = cy - 120;
  return (
    <AbsoluteFill>
      <FootageSurface image={image} video={video} scrim="bottom" />
      <PlaceChip text={place} opacity={fade(frame, 6)} />
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        {/* 표시 사각 — 네 모서리가 그려지듯 */}
        <rect x={box.x} y={box.y} width={box.w * t} height={box.h} fill="rgba(250,255,46,0.08)" />
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke={BRAND} strokeWidth={3} opacity={t} />
        <DrawPath d={`M ${labelSide === 'right' ? box.x + box.w : box.x} ${cy} L ${lx} ${ly + 92}`}
          start={30} dur={20} length={400} stroke={BRAND} strokeWidth={2} />
      </svg>
      <div style={{position: 'absolute', left: labelSide === 'right' ? lx : 0, width: labelSide === 'right' ? 460 : lx, top: ly, textAlign: labelSide === 'right' ? 'left' : 'right', opacity: fade(frame, 40)}}>
        <div style={{...W.label, fontSize: 30, letterSpacing: '0.1em'}}>{label}</div>
        {sub ? <div style={{marginTop: 10, ...W.caption, fontSize: 24}}>{sub}</div> : null}
      </div>
      <Credit text={credit} opacity={fade(frame, 20)} />
    </AbsoluteFill>
  );
};
