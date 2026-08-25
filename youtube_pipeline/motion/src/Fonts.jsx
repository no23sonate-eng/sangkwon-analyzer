import {useEffect} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// A2Z 로컬 폰트를 FontFace API로 직접 로드 — Remotion 은 각 프레임을
// 별도 헤드리스 탭에서 스크린샷 뜨기 때문에, @font-face 선언만 있고
// 실제 로드를 기다리지 않으면 첫 프레임 몇 개가 시스템 폴백 폰트로
// 찍히는 경우가 있다(2026-07-29 "폰트 신경써" 피드백 계기로 확인).
// delayRender/continueRender 로 로드 완료를 명시적으로 기다린다.
// **Pretendard 는 뺐다 (2026-08-25).** 제목과 숫자 강조에만 쓰고 있었는데,
// 한 화면에 두 서체가 섞이면 그게 위계로 읽히지 않고 그냥 다른 채널로 읽힌다.
// 굵기 차이는 A2Z 5단(Thin~Medium)으로 충분히 낸다 — 제목·숫자는 Medium.
const WEIGHTS = {
  'A2Z Thin': 'A2Z-1Thin.ttf',
  'A2Z ExtraLight': 'A2Z-2ExtraLight.ttf',
  'A2Z Light': 'A2Z-3Light.ttf',
  'A2Z Regular': 'A2Z-4Regular.ttf',
  'A2Z Medium': 'A2Z-5Medium.ttf',
  // 기사 인용 판 전용 명조. B1M 이 기사를 인용할 때 원문은 세리프다 —
  // 산세리프로 찍으면 "내가 옮겨 적은 문장"이 되고, 명조여야 "신문에 실린 글"이 된다.
  // (Google Fonts Nanum Myeongjo, OFL)
  'Myeongjo': 'NanumMyeongjo-Regular.ttf',
  'Myeongjo Bold': 'NanumMyeongjo-Bold.ttf',
};

let loaded = false;

export const useA2ZFonts = () => {
  useEffect(() => {
    if (loaded) return;
    const handle = delayRender('A2Z 폰트 로드');
    Promise.all(
      Object.entries(WEIGHTS).map(([family, file]) => {
        const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)})`);
        return face.load().then((loadedFace) => {
          document.fonts.add(loadedFace);
        });
      })
    )
      .then(() => {
        loaded = true;
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, []);
};
