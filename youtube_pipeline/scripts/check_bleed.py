#!/usr/bin/env python3
"""자막 안전선을 밟거나 화면 밖으로 삐져나간 컷을 기계로 찾는다.

눈으로 268컷을 훑으면 꼭 몇 개를 놓친다 — 실제로 놓쳤다. 이건 사람이
못 보는 걸 보는 게 아니라, **사람이 지치는 걸 안 지치고** 보는 쪽이다.

무엇을 보나
  ① 자막 안전선(y>=904) 아래에 글자·도형이 있나
  ② 좌우 가장자리(x<40 · x>1880)에 내용이 닿아 잘렸나
  ③ 위 가장자리(y<20) — 출처 줄 자리다

어떻게 보나
  배경이 판판한 그래픽 컷에서만 본다. 실사 컷은 사진이 화면을 꽉 채우니
  어느 구역에나 화소가 있어서 이 잣대가 안 통한다. 판판한 바탕 위에서는
  글자·선이 **국소 대비**로 튀므로, 이웃 화소와의 차이가 큰 점만 센다.

    python3 scripts/check_bleed.py 니시아자부
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SAFE_BOTTOM = 904          # paper.jsx CONTENT_BOTTOM
EDGE = 40
EDGE_TOP = 20
# 청사진 테마엔 **그려 넣은 모눈**이 있고 종이 테마엔 결이 있다. 26 으로
# 두면 그 결이 전부 '글자' 로 잡혀 28컷이 똑같은 숫자로 걸렸다.
# 흰 글자 대 먹 바탕은 대비가 150 을 넘는다 — 높게 잡아 결을 버린다
GRAD = 90                  # 이 이상 튀면 글자·선으로 본다
PHOTO_CARDS = {
    'StageCard', 'ArchiveCard', 'PhotoSplitCard', 'FullBleedCard', 'MediaPlateCard',
    'PaperImageCard', 'SectionPhotoCard', 'AnnotatedShotCard', 'ArticleCard',
    'NewsHeadlineCard', 'BeforeAfterCard', 'PhotoStepsCard', 'TwoPanelCard',
    'SplitProofCard', 'MapCard', 'GeoMapCard',
}


def edges(img):
    """국소 대비 지도. 판판한 바탕은 0, 글자 테두리는 크게 나온다."""
    g = img.convert('L')
    hi = np.asarray(g.filter(ImageFilter.MaxFilter(3)), dtype=np.int16)
    lo = np.asarray(g.filter(ImageFilter.MinFilter(3)), dtype=np.int16)
    return hi - lo


def check(project, verbose=False):
    pdir = ROOT / 'projects' / project
    design = json.loads((pdir / 'design.json').read_text(encoding='utf-8'))['cuts']
    stills = sorted((pdir / 'stills').glob('*.png'),
                    key=lambda f: int(re.match(r'sec(\d+)', f.name).group(1)))
    if not stills:
        sys.exit(f'{project}: stills 가 없다')

    bad = []
    for f in stills:
        sid = int(re.match(r'sec(\d+)', f.name).group(1))
        dz = design.get(str(sid)) or ['', '', {}]
        card = dz[0]
        blob = json.dumps(dz, ensure_ascii=False)
        # 실사·배경이 깔린 판은 화면 전체에 화소가 있어 이 잣대가 안 통한다
        if card in PHOTO_CARDS or re.search(r'\.(jpg|jpeg|png|mp4)"', blob):
            continue

        e = edges(Image.open(f))
        h, w = e.shape
        hits = []
        # ── punch 를 준 컷은 화면 전체가 커진다 ────────────────────────────
        # 3.5% 를 키우면 오른쪽 위 출처 줄이 1876 → 1908 로 32px 밀린다.
        # **잘리는 게 아니다** — 카메라가 밀고 들어오면 출처도 같이 밀리는 게
        # 맞다. 가장자리 잣대는 '내용이 잘렸나'를 보는 것이므로, 커진 만큼
        # 잣대도 물려 준다. 안 그러면 강조를 넣을 때마다 검사기가 운다
        pu = float(((dz[2] if len(dz) > 2 and isinstance(dz[2], dict) else {})
                    .get('_motion') or {}).get('punch', 0.035)) \
            if (dz[2] if len(dz) > 2 and isinstance(dz[2], dict) else {}).get('_motion', {}).get('punchAt') is not None else 0.0
        edge = EDGE - round(960 * pu) if pu else EDGE

        band = e[SAFE_BOTTOM:, :]
        n = int((band > GRAD).sum())
        if n > 300:
            rows = np.where((band > GRAD).sum(axis=1) > 4)[0]
            deep = SAFE_BOTTOM + int(rows.max()) if len(rows) else SAFE_BOTTOM
            hits.append(f'자막선 {deep - SAFE_BOTTOM}px 침범 ({n}점)')

        for name, sl in (('왼쪽', e[:, :max(4, edge)]), ('오른쪽', e[:, w - max(4, edge):])):
            n = int((sl > GRAD).sum())
            if n > 200:
                hits.append(f'{name} 가장자리 ({n}점)')
        n = int((e[:EDGE_TOP, :] > GRAD).sum())
        if n > 200:
            hits.append(f'위 가장자리 ({n}점)')

        if hits:
            bad.append((sid, card, dz[1][:44], hits))

    print(f'{project} — 그래픽 컷 검사, 걸린 컷 {len(bad)}개')
    for sid, card, why, hits in bad:
        print(f'  #{sid:>4} [{card:<18}] {" · ".join(hits)}')
        if verbose:
            print(f'        {why}')
    return bad


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    check(args[0] if args else '니시아자부', verbose='-v' in sys.argv)
