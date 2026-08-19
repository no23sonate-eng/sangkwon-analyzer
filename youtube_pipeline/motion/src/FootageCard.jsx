import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {FootageSurface, PlaceChip, Credit, W, M, SAFE_BOTTOM, BRAND, fade} from './v4';
import {Wipe, stagger} from './anim';

// v4 · 실사 카드 — B1M 의 기본 화면. 화면의 대부분은 이것이어야 한다.
// title: 화면 위 흰 대문자 문장(선택). segs 로 주면 일부 단어만 옐로.
// place: 우상단 지역 칩. credit: 우하단 초소형 출처.
export const FootageCard = ({
  image = '',
  video = '',
  videoStart = 0,
  title = '',
  segs = null, // [{t, hot}] — title 대신 부분 강조가 필요할 때
  label = '',
  place = '',
  credit = '',
  scrim = 'bottom',
  align = 'left', // left | center
}) => {
  useA2ZFonts();
  const frame = useCurrentFrame();
  const parts = segs || (title ? [{t: title, hot: false}] : []);

  return (
    <AbsoluteFill>
      <FootageSurface image={image} video={video} videoStart={videoStart} scrim={scrim} />
      <PlaceChip text={place} opacity={fade(frame, 8)} />

      {parts.length ? (
        <div
          style={{
            position: 'absolute', left: M, right: M,
            top: align === 'center' ? 430 : SAFE_BOTTOM - 210,
            textAlign: align,
          }}
        >
          {label ? (
            <div style={{...W.label, marginBottom: 18, opacity: fade(frame, 6)}}>{label}</div>
          ) : null}
          <Wipe start={10} dur={30} dir="left">
            <div style={{...W.title, lineHeight: 1.16}}>
              {parts.map((s, i) => (
                <span key={i} style={s.hot ? {color: BRAND} : undefined}>{s.t}</span>
              ))}
            </div>
          </Wipe>
        </div>
      ) : null}

      <Credit text={credit} opacity={fade(frame, 20)} />
    </AbsoluteFill>
  );
};
