import {useEffect} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// A2Z 로컬 폰트를 FontFace API로 직접 로드 — Remotion 은 각 프레임을
// 별도 헤드리스 탭에서 스크린샷 뜨기 때문에, @font-face 선언만 있고
// 실제 로드를 기다리지 않으면 첫 프레임 몇 개가 시스템 폴백 폰트로
// 찍히는 경우가 있다(2026-07-29 "폰트 신경써" 피드백 계기로 확인).
// delayRender/continueRender 로 로드 완료를 명시적으로 기다린다.
const WEIGHTS = {
  'A2Z Thin': 'A2Z-1Thin.ttf',
  'A2Z ExtraLight': 'A2Z-2ExtraLight.ttf',
  'A2Z Light': 'A2Z-3Light.ttf',
  'A2Z Regular': 'A2Z-4Regular.ttf',
  'A2Z Medium': 'A2Z-5Medium.ttf',
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
