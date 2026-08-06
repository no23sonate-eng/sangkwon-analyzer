import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {MotionShell} from './MotionShell';
import {FullBleedCard} from './FullBleedCard';
import {ExchangeMotionCard} from './ExchangeMotionCard';
import {SkylineCompareCard} from './SkylineCompareCard';
import {PAPER, INK, YELLOW} from './paper';

// 전환·강조 모션 샘플 — 실제 컷 3개(7 → 8 → 5)를 이어 붙여
// "하드컷" 과 "밀고 들어오는 전환 + 느린 푸시" 를 비교해 보기 위한 데모.
// 채택하면 MotionShell 을 render_parkside.py 에서 카드마다 감싸면 된다.

const CUT7 = {
  image: 'parkside/humphreys.jpg',
  headline: '용산 → 평택',
  sub: '2003년 4월 한미 합의 · 이전 비용 3조 4,000억원',
  scrim: 0.4,
  source: '사진: USAG Humphreys / CC BY 2.0',
};
const CUT8 = {
  title: '기부 대 양여', sub: '2007년 11월',
  left: {wordmark: 'LH', label: 'LH', sub: '한국토지주택공사'},
  right: {logo: 'parkside/logo_mnd.png', label: '국방부', sub: '용산기지 소유'},
  give: {icon: 'base', label: '평택기지', sub: '3조 4,000억'},
  get: {icon: 'land', label: '4개 부지'},
  source: '국방부 · LH 협약',
};
const CUT5 = {
  title: '사업비', sub: '건물 높이가 아니라 사업비를 비교한다',
  buildings: [
    {label: '여의도 파크원', value: 0.96, note: '2조 1,000억', shape: 'parc1', tone: 0},
    {label: '롯데월드타워', value: 0.9, note: '4조 2,000억', shape: 'lotte', tone: 2},
    {label: '더 파크사이드 서울', value: 1.0, note: '11조', shape: 'cluster', hot: true},
  ],
  note: '보도된 금액의 기준이 서로 달라 단순 비교는 참고용',
  source: '보도 종합',
};

// 화면 위에 어떤 동작인지 표시하는 데모 전용 배지 (실제 영상에는 안 들어감)
const Tag = ({text}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [2, 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: 48, top: 34, opacity: o,
                 background: YELLOW, color: INK, padding: '10px 22px',
                 fontFamily: 'Pretendard Bold, A2Z Medium, sans-serif', fontSize: 32}}>
      {text}
    </div>
  );
};

export const MotionSample = () => {
  useA2ZFonts();
  const {fps} = useVideoConfig();
  const S = (sec) => Math.round(sec * fps);

  return (
    <AbsoluteFill style={{background: PAPER, fontFamily: 'A2Z Regular, sans-serif'}}>
      {/* ── A. 지금 방식: 하드컷 + 정지 ── */}
      <Sequence from={0} durationInFrames={S(4)}>
        <FullBleedCard {...CUT7} kenBurns={false} />
        <Tag text="지금 — 하드컷" />
      </Sequence>
      <Sequence from={S(4)} durationInFrames={S(4)}>
        <SkylineCompareCard {...CUT5} />
        <Tag text="지금 — 하드컷" />
      </Sequence>

      {/* ── B. 제안: 방향을 가진 전환 + 홀드 내내 느린 푸시 + 한 번의 강조 ── */}
      <Sequence from={S(8)} durationInFrames={S(5)}>
        <MotionShell durationSec={5} dir="left" exitF={S(0.5)} push={0.06} bg="#0b0e12">
          <FullBleedCard {...CUT7} kenBurns={false} />
        </MotionShell>
        <Tag text="제안 — 왼쪽으로 밀고 들어옴 + 느린 푸시" />
      </Sequence>
      <Sequence from={S(13)} durationInFrames={S(6)}>
        <MotionShell durationSec={6} dir="left" exitF={S(0.5)} push={0.03} punchAt={S(3.2)}>
          <ExchangeMotionCard {...CUT8} />
        </MotionShell>
        <Tag text="제안 — 이어받아 밀림 + 3.2초에 강조 푸시" />
      </Sequence>
      <Sequence from={S(19)} durationInFrames={S(5)}>
        <MotionShell durationSec={5} dir="up" push={0.04} punchAt={S(2.6)} punch={0.05}>
          <SkylineCompareCard {...CUT5} />
        </MotionShell>
        <Tag text="제안 — 위로 밀고 들어옴 + 11조에서 강조" />
      </Sequence>
    </AbsoluteFill>
  );
};
