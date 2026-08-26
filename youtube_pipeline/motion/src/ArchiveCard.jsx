import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, SP} from './paper';
import {ArchiveFilm, ArchiveStamp} from './archive';

// ── 옛 자료 컷 ────────────────────────────────────────────────────────────
// 1938년 반도호텔, 1970년 청와대, 1979년 개관. 이런 대목은 정지 사진 한 장이
// 전부인데, 그냥 띄우면 화면이 멎는다. 필름처럼 돌려서 **자료 화면**으로 만든다.
// 처리 내용은 archive.jsx 에 있다 (게이트 흔들림·그레인·먼지·깜빡임).
//
// 왜 카드로 따로 두나: 옛 자료는 **연도와 출처가 화면에 박혀야** 자료로 읽힌다.
// 그게 없으면 그냥 세피아 필터를 먹인 사진이고, 오히려 만든 티가 난다.
// 그래서 좌하단 연도 스탬프를 카드가 강제한다.
//
// media  사진 또는 영상 경로. video=true 면 영상으로 읽는다
// era    'film'(1930~60) / 'video'(1980~90 방송) / 'photo'(옛 사진 스캔)
// gate   4:3 자료면 1.333. 안 주면 꽉 채운다 — 억지로 늘리면 사람이 홀쭉해진다
// pan    사진 안을 가로지르는 방향 [x, y] px. 얼굴이나 간판 쪽으로 밀면 좋다
export const ArchiveCard = ({
  media = '', video = false, era = 'film', gate = 0,
  zoom = 0.10, pan = [0, 0],
  year = '', label = '',
  headline = '', sub = '',
  // center — 문장을 화면 한가운데로. 자료 사진의 주인공이 가운데가 아니거나
  //          (하늘·벽·군중) 문장 자체가 그 컷의 전부일 때
  // dim    — 자료 위에 검은 막을 한 겹. 옛 자료는 대비가 낮아 흰 글자가
  //          묻힌다. 그림자만으로 안 될 때 0.25~0.4
  center = false, dim = 0,
  source = '', theme,
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const T = themeOf(theme);

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif', background: '#0B0C0E'}}>
      <ArchiveFilm src={media} video={video} era={era} gate={gate}
                   zoom={zoom} pan={pan} durationF={durationInFrames} />

      {dim > 0 ? (
        <AbsoluteFill style={{background: `rgba(8,9,11,${Math.min(0.75, dim)})`}} />
      ) : null}

      {/* 문장은 아래쪽에. 옛 사진은 가운데가 주인공인 경우가 많다 */}
      {headline ? (
        <div style={{position: 'absolute', left: 120, right: 120,
                     ...(center
                       ? {top: 0, height: CONTENT_BOTTOM, display: 'flex',
                          flexDirection: 'column', justifyContent: 'center',
                          textAlign: 'center'}
                       : {bottom: 366}),
                     opacity: fadeIn(frame, 14)}}>
          <div style={{fontFamily: 'A2Z Medium, sans-serif',
                       fontSize: Math.min(68, Math.max(40, Math.floor(2600 / Math.max(10, headline.length)))),
                       lineHeight: 1.3, color: '#FFFFFF',
                       textShadow: '0 3px 18px rgba(0,0,0,0.92)', wordBreak: 'keep-all'}}>
            {headline}
          </div>
          {sub ? (
            <div style={{marginTop: SP.TIGHT, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: 32, color: 'rgba(255,255,255,0.8)',
                         textShadow: '0 2px 12px rgba(0,0,0,0.9)', wordBreak: 'keep-all'}}>
              {sub}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 문장을 가운데 얹은 컷에서는 그 문장이 이미 연도와 장소를 말한다.
          좌하단 스탬프까지 두면 같은 말이 화면에 두 번 뜬다 (#34·#36) */}
      {center && headline ? null : <ArchiveStamp year={year} label={label} />}
      <PaperSource source={source} theme={theme} onPhoto />
    </AbsoluteFill>
  );
};
