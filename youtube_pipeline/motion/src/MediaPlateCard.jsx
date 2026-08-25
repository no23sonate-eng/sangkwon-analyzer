import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile,
        useCurrentFrame, useVideoConfig} from 'remotion';
import {useA2ZFonts} from './Fonts';
import {themeOf, PaperBg, PaperTitle, PaperSource, YELLOW, CONTENT_BOTTOM, fadeIn, SP} from './paper';
import {fit} from './layout';

// ── 판 위에 얹은 소재 ─────────────────────────────────────────────────────
// B1M 프레임 22장에서 **화면을 꽉 채운 소재는 한 장도 없었다** (§40-2).
// 아카이브 영상도, 사진도, 3D 렌더도, 옛 도면도 전부 바탕 위에 **얹힌 한 장**이다.
// 모서리가 크게 둥글고 테두리가 점선이며, 판 바깥으로 화면 폭의 15~30%가 남는다.
//
// 우리는 반대로 하고 있었다. `LowerThirdCard` 가 화면을 꽉 채우고 그 위에 자막을
// 얹는 방식이라 123컷 중 대다수가 full-bleed 였고, 실측에서 **가장자리 전경
// 0.207** 로 나왔다 (§39-3). B1M 이 늘 비우는 자리가 우리는 안 비어 있었다.
//
// 왜 이게 중요한가: 꽉 찬 사진은 **그 사진이 전부**라고 말한다. 판으로 얹으면
// "이건 내가 가져와 보여 주는 자료"가 된다. 설명하는 영상에서는 후자가 맞다.
// 게다가 바탕이 보이니 격자와 종이 결이 살아나 판마다 같은 세계에 있게 된다.
//
// full-bleed 를 아예 없애지는 않는다 — **장면 자체가 주인공인 컷**(성수동 거리,
// 팝업 대기줄)은 꽉 채우는 게 맞다. 자료로 보여 주는 컷만 이 카드로 옮긴다.
//
// media   사진 또는 영상 (mp4/webm/mov 는 자동으로 영상 처리)
// aspect  소재의 가로/세로 비. 세로 사진은 0.75 처럼 1 미만을 준다.
//         **억지로 16:9 로 자르지 않는다** — B1M 도 세로 사진은 세로 판 그대로 둔다
// archive 옛 필름·아카이브 영상이면 true. 비네팅 + 가장자리 흐림이 붙는다
// label   판 아래 한 줄. 없으면 판이 화면 한가운데로 온다
export const MediaPlateCard = ({
  media = '', aspect = 16 / 9, archive = false,
  title = '', sub = '',
  num = '', label = '', note = '',
  caption = '', source = '', theme, bg = {},
}) => {
  useA2ZFonts();
  const T = themeOf(theme);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dark = T.bg !== '#EFEAE3';

  const bandTop = title ? (sub ? 296 : 244) : 132;
  // 판이 쓸 수 있는 자리. 좌우 여백은 확실히 남긴다 — **여백이 이 카드의 요점**이라
  // 여기서 인색하면 만든 이유가 없어진다.
  //
  // 세로 계산은 **판과 아래 라벨을 한 덩어리로** 잡아 띠 한가운데 앉힌다.
  // 처음엔 라벨 자리를 먼저 빼고 남은 높이에 판을 맞췄는데, 그러면 라벨이 없는
  // 컷에서도 그만큼이 비고 판만 작아졌다. 덩어리로 재야 자리를 다 쓴다.
  const maxW = 1240;
  const avail = CONTENT_BOTTOM - bandTop;
  const extra = label ? SP.BLOCK + (note ? 132 : 92) : 0;
  let h = Math.max(220, Math.min(avail - extra, maxW / aspect));
  let w = h * aspect;
  if (w > maxW) { w = maxW; h = w / aspect; }
  const x = Math.round((1920 - w) / 2);
  const y = Math.round(bandTop + Math.max(0, (avail - (h + extra)) / 2));

  const s = spring({frame, fps, config: {damping: 200, mass: 0.7}});
  const R = 26;                       // 모서리. 이보다 작으면 그냥 사각형으로 읽힌다
  const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(String(media));
  const src = /^https?:/.test(media) ? media : staticFile(media);
  const box = {width: '100%', height: '100%', objectFit: 'cover', display: 'block'};

  return (
    <AbsoluteFill style={{fontFamily: 'A2Z Regular, sans-serif'}}>
      <PaperBg theme={theme} {...bg} />
      <PaperTitle title={title} sub={sub} theme={theme} />

      <div style={{position: 'absolute', left: x, top: y, width: w, height: h,
                   opacity: s,
                   transform: `translateY(${(1 - s) * 18}px) scale(${0.985 + s * 0.015})`}}>
        {/* 점선 테두리 — 판 **바깥**에 그린다. 안쪽에 그리면 소재를 갉아먹는다.
            "잘라 붙인 조각"이라는 표시라 실선이면 뜻이 달라진다 (§40-2) */}
        <div style={{position: 'absolute', inset: -9, borderRadius: R + 9,
                     border: `2px dashed ${dark ? 'rgba(242,240,236,0.55)' : 'rgba(35,38,43,0.42)'}`}} />
        <div style={{position: 'absolute', inset: 0, borderRadius: R, overflow: 'hidden',
                     background: dark ? '#0D1014' : '#DBD6CE',
                     boxShadow: dark ? '0 24px 70px rgba(0,0,0,0.5)'
                                     : '0 20px 56px rgba(35,38,43,0.22)'}}>
          {isVid ? <OffthreadVideo src={src} muted style={box} /> : <Img src={src} style={box} />}
          {/* 아카이브 — 필름 게이트처럼 가장자리가 어두워지고 흐려진다.
              옛 자료라는 걸 자막으로 설명하지 않고 화면으로 말한다 */}
          {archive ? (
            <>
              <div style={{position: 'absolute', inset: 0,
                           boxShadow: 'inset 0 0 90px 30px rgba(0,0,0,0.62)'}} />
              <div style={{position: 'absolute', inset: 0,
                           backdropFilter: 'blur(0.6px) saturate(0.72)'}} />
            </>
          ) : null}
        </div>
      </div>

      {/* 판 아래 한 줄 — 번호는 옐로, 이름은 잉크. 판에서 GAP 만큼 띄운다 */}
      {label ? (
        <div style={{position: 'absolute', left: x, top: y + h + SP.BLOCK, width: w,
                     textAlign: 'center', opacity: fadeIn(frame, 22)}}>
          <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'center',
                       gap: SP.NEAR}}>
            {num ? (
              <span style={{fontFamily: 'A2Z Medium, sans-serif', fontSize: 34,
                            color: YELLOW, fontVariantNumeric: 'tabular-nums'}}>{num}</span>
            ) : null}
            <span style={{fontFamily: 'A2Z Medium, sans-serif',
                          fontSize: fit(label, 56, w - 80), color: T.ink,
                          letterSpacing: '-0.01em', wordBreak: 'keep-all'}}>
              {label}
            </span>
          </div>
          {note ? (
            <div style={{marginTop: SP.NEAR, fontFamily: 'A2Z Light, sans-serif',
                         fontSize: 30, color: T.soft, wordBreak: 'keep-all'}}>
              {note}
            </div>
          ) : null}
        </div>
      ) : null}

      {caption ? (
        <div style={{position: 'absolute', left: 200, width: 1520, top: CONTENT_BOTTOM - 18,
                     textAlign: 'center', fontFamily: 'A2Z Light, sans-serif', fontSize: 30,
                     color: T.soft, opacity: fadeIn(frame, 52), wordBreak: 'keep-all'}}>
          {caption}
        </div>
      ) : null}
      <PaperSource source={source} theme={theme} />
    </AbsoluteFill>
  );
};
