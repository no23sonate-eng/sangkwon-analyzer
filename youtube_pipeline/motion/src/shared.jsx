import React from 'react';
import {OffthreadVideo, Img, staticFile, useVideoConfig} from 'remotion';

// 공유 디자인 시스템 — B1M 실측 레퍼런스(2026-07-29) 기반. 모든 카드가
// 이 톤/규칙을 공유한다: 짙은 차콜 배경 + 옅은 청사진 격자, 채도 낮은
// 회색조, 글로우/네온 금지, 절제된 타이포.
export const BG_STYLE = {
  background: 'linear-gradient(180deg, #15171b 0%, #0a0b0d 100%)',
};

// ⚠️ 고정 규칙(2026-07-29 사용자 지시, 항상 지킬 것): 자막은 사용자가
// 직접 나중에 얹는다. 그래픽 콘텐츠를 화면 하단까지 채우지 말고 중앙
// 쪽으로 모아서, 화면 하단 이 px 만큼은 항상 비워둘 것.
export const SUBTITLE_SAFE_BOTTOM = 260;
export const CONTENT_BOTTOM = 1080 - SUBTITLE_SAFE_BOTTOM; // = 820

export const GridBg = ({color = 'rgba(255,255,255,0.05)'}) => {
  const lines = [];
  const step = 80;
  for (let x = step; x < 1920; x += step) {
    lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={1080} />);
  }
  for (let y = step; y < 1080; y += step) {
    lines.push(<line key={`h${y}`} x1={0} y1={y} x2={1920} y2={y} />);
  }
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
      <g stroke={color} strokeWidth={1}>{lines}</g>
    </svg>
  );
};

export const TEXT = {
  title: {color: '#C7CBD3', fontFamily: 'A2Z Light, sans-serif', letterSpacing: '0.02em'},
  value: {color: '#EDEFF3', fontFamily: 'A2Z Regular, sans-serif', letterSpacing: '0.045em'},
  label: {color: '#8D96A0', fontFamily: 'A2Z Light, sans-serif', letterSpacing: '0.02em'},
};

export const ACCENT = '#8E939D';

// pipeline/render.py 가 실사 사진(type=photo) B-roll 에 적용하는 "액자"
// 연출(배경 캔버스 + 얇은 흰 테두리 카드, card_ratio=0.74) 을 Remotion
// 카드에도 그대로 재현한 값 — #5~7 을 #8(실사 사진 구간)과 동일한
// 톤으로 맞추기 위해(2026-07-29 피드백).
export const FRAME_BG_COLOR = '#EFEAE3';
const FRAME_CARD_H = 800;
const FRAME_CARD_W = Math.round((FRAME_CARD_H * 1920) / 1080); // 1422
const FRAME_TOP = (1080 - FRAME_CARD_H) / 2; // 140
const FRAME_LEFT = (1920 - FRAME_CARD_W) / 2; // 249
export const FRAME_CARD = {top: FRAME_TOP, left: FRAME_LEFT, width: FRAME_CARD_W, height: FRAME_CARD_H};

// 실사 배경 + 다크 오버레이 — B1M 레퍼런스처럼 카드가 실제 사진/영상
// 위에 바로 얹히는 연출(2026-07-29 "#0 영상을 #1 배경으로" 피드백).
// video 또는 image 중 하나를 motion/public/ 기준 상대경로로 준다.
// inset=true 면 전체화면이 아니라 화면 중앙에 작게 배치(#9 "돈 내는
// 영상" 처럼 전체 배경이 아니라 포인트로 보여줄 때).
// framed=true 면 render.py 의 사진 프레임(크림 배경 + 흰 테두리 카드)과
// 동일한 톤으로 감싼다(#8 과 통일 피드백).
export const MediaBg = ({video = '', image = '', videoStart = 0, inset = false, overlay = true, framed = false}) => {
  const {fps} = useVideoConfig();
  if (!video && !image) return null;

  if (framed) {
    const mediaStyle = {width: '100%', height: '100%', objectFit: 'cover'};
    return (
      <>
        <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: FRAME_BG_COLOR}} />
        <div
          style={{
            position: 'absolute', top: FRAME_TOP, left: FRAME_LEFT, width: FRAME_CARD_W, height: FRAME_CARD_H,
            border: '6px solid #FFFFFF', boxShadow: '0 24px 50px rgba(0,0,0,0.22)', overflow: 'hidden',
          }}
        >
          {video ? (
            <OffthreadVideo src={staticFile(video)} startFrom={Math.round(videoStart * fps)} style={mediaStyle} />
          ) : (
            <Img src={staticFile(image)} style={mediaStyle} />
          )}
          {overlay ? (
            <div
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: 'linear-gradient(180deg, rgba(5,7,10,.72) 0%, rgba(5,7,10,.5) 45%, rgba(5,7,10,.82) 100%)',
              }}
            />
          ) : null}
        </div>
      </>
    );
  }

  const mediaStyle = inset
    ? {position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
       width: 860, height: 484, objectFit: 'cover', borderRadius: 14,
       boxShadow: '0 30px 60px rgba(0,0,0,.55)'}
    : {position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover'};

  return (
    <>
      {video ? (
        <OffthreadVideo src={staticFile(video)} startFrom={Math.round(videoStart * fps)} style={mediaStyle} />
      ) : (
        <Img src={staticFile(image)} style={mediaStyle} />
      )}
      {overlay && !inset ? (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: 'linear-gradient(180deg, rgba(5,7,10,.72) 0%, rgba(5,7,10,.5) 45%, rgba(5,7,10,.82) 100%)',
          }}
        />
      ) : null}
    </>
  );
};
