import React from 'react';
import {useCurrentFrame} from 'remotion';

// ── 종이 설명 그래픽 공통 토큰 (2026-08-02, Billionaires' Row 레퍼런스) ──
// B1M의 "밝은 종이 + 그리드 + 플랫 실루엣" 설명 문법을 채널 팔레트로 번역:
// 종이는 크림(#EFEAE3, 실사 액자와 동일), 잉크는 딥 차콜, 강조는 레몬 옐로.
// 로직/구조/비교를 "설명"하는 구간 전용 — 실사/다크 카드와 구분되는 톤.
export const PAPER = '#EFEAE3';
export const INK = '#23262B'; // 외곽선·본문
export const INK_MUTE = '#9AA0A8'; // 비강조 면
export const INK_SOFT = '#6E747C'; // 보조 텍스트
export const YELLOW = '#FAFF2E'; // 강조 채움 (외곽선은 항상 INK와 병용)
export const PAPER_LINE = 'rgba(35,38,43,0.10)'; // 그리드선

export const SUBTITLE_SAFE_BOTTOM = 260;
export const CONTENT_BOTTOM = 1080 - SUBTITLE_SAFE_BOTTOM; // 820

// 실루엣 톤 패밀리 (B1M의 5단계 블루 패밀리를 잉크 계열로 번역)
// — 건물/막대마다 다른 톤을 순환시켜 단조로움을 없앤다. 옐로는 강조 전용.
export const TONES = ['#B9BFC9', '#5C6470', '#8F97A3', '#3A414C', '#A8B0BC'];

// 오버라인/언더라인 브래킷 (끝에 짧은 틱) — B1M 라벨·수치 묶음 문법
export const Bracket = ({x, y, w, tick = 10, stroke = INK, strokeWidth = 2, opacity = 1, below = false}) => (
  <g opacity={opacity} stroke={stroke} strokeWidth={strokeWidth}>
    <line x1={x} y1={y} x2={x + w} y2={y} />
    <line x1={x} y1={y} x2={x} y2={y + (below ? -tick : tick)} />
    <line x1={x + w} y1={y} x2={x + w} y2={y + (below ? -tick : tick)} />
  </g>
);

// 빅 스탯 타이포 블록 — 큰 볼드 수치 + 오른쪽 2줄 얇은 라벨 ("72% | Owner/occupied")
export const BigStat = ({value, unit = '%', label = '', color = INK, size = 92, opacity = 1}) => (
  <div style={{display: 'inline-flex', alignItems: 'baseline', gap: 16, opacity}}>
    <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: size, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em'}}>
      {value}
      <span style={{fontFamily: 'A2Z Regular, sans-serif', fontSize: size * 0.62}}>{unit}</span>
    </span>
    {label ? (
      <span style={{fontFamily: 'A2Z Light, sans-serif', fontSize: size * 0.3, lineHeight: 1.22, color: INK_SOFT, whiteSpace: 'pre-line', letterSpacing: '0.04em'}}>
        {label}
      </span>
    ) : null}
  </div>
);

export const fadeIn = (frame, start, len = 14) => {
  const t = Math.max(0, Math.min(1, (frame - start) / len));
  return t * t * (3 - 2 * t);
};

// 어두운 종이 톤 — 같은 문법을 유지한 채 색만 뒤집는다.
// 종이 카드가 길게 이어질 때 중간에 한두 장 끼워 넣어 단조로움을 끊는 용도.
export const DARK_PAPER = '#242830';
export const DARK_INK = '#F2F0EC';
export const DARK_INK_SOFT = '#A7AEB8';
export const DARK_TONES = ['#4A525E', '#79828F', '#3A414C', '#98A1AD', '#5C6470'];
export const palette = (dark) => (dark
  ? {paper: DARK_PAPER, ink: DARK_INK, inkSoft: DARK_INK_SOFT, tones: DARK_TONES,
     line: 'rgba(242,240,236,0.10)', vig: '#000'}
  : {paper: PAPER, ink: INK, inkSoft: INK_SOFT, tones: TONES, line: PAPER_LINE, vig: '#000'});

// 크림 종이 배경 + 옅은 격자 + 가장자리 비네트
export const PaperBg = ({dark = false}) => (
  <>
    <div style={{position: 'absolute', inset: 0, background: dark ? DARK_PAPER : PAPER}} />
    <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
      <g stroke={dark ? 'rgba(242,240,236,0.10)' : PAPER_LINE} strokeWidth={1}>
        {Array.from({length: 23}, (_, i) => (
          <line key={`v${i}`} x1={(i + 1) * 80} y1={0} x2={(i + 1) * 80} y2={1080} />
        ))}
        {Array.from({length: 13}, (_, i) => (
          <line key={`h${i}`} x1={0} y1={(i + 1) * 80} x2={1920} y2={(i + 1) * 80} />
        ))}
      </g>
      <rect x={0} y={0} width={1920} height={1080} fill="url(#paperVig)" />
      <defs>
        <radialGradient id="paperVig" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.75" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.06" />
        </radialGradient>
      </defs>
    </svg>
  </>
);

// 상단 중앙 타이틀 (레퍼런스 "Occupancy" 스타일 — 작고 절제된 제목)
export const PaperTitle = ({title, sub = '', dark = false}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', top: 138, left: 0, width: 1920, textAlign: 'center', opacity: fadeIn(frame, 0)}}>
      <div style={{fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 68, letterSpacing: '-0.01em', color: dark ? DARK_INK : INK}}>
        {title}
      </div>
      {sub ? (
        <div style={{marginTop: 12, fontFamily: 'A2Z Light, sans-serif', fontSize: 36, letterSpacing: '0.08em', color: dark ? DARK_INK_SOFT : INK_SOFT}}>
          {sub}
        </div>
      ) : null}
    </div>
  );
};

// 우하단 출처 캡션 — 화면 오른쪽 아래 **끝**에 붙인다(2026-08-06).
// 자막은 하단 중앙에 깔리므로 모서리로 완전히 빼야 서로 안 건드린다.
export const PaperSource = ({source = '', dark = false}) => {
  const frame = useCurrentFrame();
  if (!source) return null;
  return (
    <div style={{position: 'absolute', right: 72, top: 1008, textAlign: 'right', fontFamily: 'A2Z Light, sans-serif', fontSize: 29, letterSpacing: '0.06em', color: dark ? DARK_INK_SOFT : INK_SOFT, opacity: fadeIn(frame, 40)}}>
      {source}
    </div>
  );
};
