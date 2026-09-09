#!/usr/bin/env python3
"""그래픽 컷의 **세로 균형**을 기계로 잰다.

검수시트를 눈으로 훑다가 "위에 몰리고 아래가 텅 빈" 컷을 여럿 봤는데,
어떤 카드가 그런지 규칙이 안 보였다. SpecGridCard 만 그런 것도 아니고
항목 수로 갈리는 것도 아니었다. 눈으로 세는 걸 그만두고 잉크를 잰다.

무엇을 재나
  글자·선이 실제로 놓인 세로 구간 [y0, y1] 을 찾고, 그 한가운데가
  시각 중심(512)에서 얼마나 벗어났는지 본다. 카드가 stageTop 으로
  '한 덩어리'를 가운데 앉혔다고 **주장해도**, 그 덩어리 안이 비어
  있으면(칸 높이는 300인데 글자는 120만 쓰는 식) 눈에는 위로 쏠린다.
  주장이 아니라 결과를 잰다.

어떻게 재나
  check_bleed.py 와 같은 국소 대비 지도. 판판한 바탕은 0, 글자는 크게.
  맨 위 출처 줄(y<60)은 늘 있으므로 뺀다.

    python3 scripts/check_balance.py 니시아자부
    python3 scripts/check_balance.py 니시아자부 --tol 70
"""
import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OPTICAL_CENTER = 512        # paper.jsx
CONTENT_BOTTOM = 904
# PaperSource 는 top 34 · 23px · lineHeight 1.3 이다. 한 줄이면 64,
# 두 줄로 접히면 94 까지 내려온다. 60 으로 뒀더니 **모든 컷의 잉크가
# y=60 에서 시작한다**고 나와서 측정이 통째로 망가졌다
SOURCE_STRIP = 100
GRAD = 90
MIN_ROW = 5                 # 한 줄에 이만큼은 튀어야 '내용이 있다'

PHOTO_CARDS = {
    'StageCard', 'ArchiveCard', 'PhotoSplitCard', 'FullBleedCard', 'MediaPlateCard',
    'PaperImageCard', 'SectionPhotoCard', 'AnnotatedShotCard', 'ArticleCard',
    'NewsHeadlineCard', 'BeforeAfterCard', 'PhotoStepsCard', 'TwoPanelCard',
    'SplitProofCard', 'MapCard', 'GeoMapCard', 'BrandCard', 'QuoteCard',
}


def edges(img):
    g = img.convert('L')
    hi = np.asarray(g.filter(ImageFilter.MaxFilter(3)), dtype=np.int16)
    lo = np.asarray(g.filter(ImageFilter.MinFilter(3)), dtype=np.int16)
    return hi - lo


def flat_background(props):
    """배경 사진이 **깔려도 판판하면** 이 잣대가 통한다.

    veil 0.94 로 누른 배경은 사실상 종이다. 예전 검사기들은 파일 확장자만
    보고 건너뛰어서, 배경을 얹은 순간 그 컷이 검사에서 빠졌다 — 배경을
    넣을수록 검사 범위가 줄어드는 꼴이었다.
    """
    bg = props.get('bg') or {}
    if not (bg.get('backdrop') or props.get('bgImage')):
        return True
    return float(bg.get('veil', 0.94)) >= 0.88 and not bg.get('blur')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--tol', type=int, default=90,
                    help='시각 중심에서 이만큼(px) 벗어나면 걸린다')
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    design = json.loads((pdir / 'design.json').read_text(encoding='utf-8'))['cuts']
    stills = sorted((pdir / 'stills').glob('*.png'),
                    key=lambda f: int(re.match(r'sec(\d+)', f.name).group(1)))
    if not stills:
        sys.exit(f'{a.project}: stills 가 없다')

    rows, seen = [], 0
    for f in stills:
        sid = int(re.match(r'sec(\d+)', f.name).group(1))
        dz = design.get(str(sid)) or ['', '', {}]
        card, props = dz[0], (dz[2] if len(dz) > 2 and isinstance(dz[2], dict) else {})
        if card in PHOTO_CARDS or not flat_background(props):
            continue
        if props.get('media') or props.get('image') or props.get('leftImage'):
            continue

        e = edges(Image.open(f))
        ink = (e > GRAD).sum(axis=1)
        ink[:SOURCE_STRIP] = 0
        # 캡션(가정·근거)은 **일부러** 자막선 바로 위에 매달아 둔다 — 각주지
        # 본문이 아니다. 그걸 본문으로 세면 캡션 있는 컷이 전부 '아래로 쏠림'
        # 으로 걸린다(#49·#101·#176·#205·#215). 각주 띠는 빼고 본문만 잰다
        if props.get('caption') or props.get('closingLine'):
            ink[CONTENT_BOTTOM - 100:] = 0
        ys = np.where(ink > MIN_ROW)[0]
        if len(ys) < 2:
            rows.append((sid, card, None, None, '빈 화면 — 잉크가 없다'))
            continue
        seen += 1
        y0, y1 = int(ys.min()), int(ys.max())
        mid = (y0 + y1) / 2
        off = mid - OPTICAL_CENTER
        msg = []
        if abs(off) > a.tol:
            msg.append(f"{'위' if off < 0 else '아래'}로 {abs(off):.0f}px "
                       f'(잉크 {y0}~{y1} · 아래 여백 {CONTENT_BOTTOM - y1})')
        # 가로도 같이 본다. 출처 줄은 늘 오른쪽 위에 있으므로 그 띠를 뺀 뒤
        # 재야 한다 — 안 빼면 모든 컷이 오른쪽으로 쏠린 것으로 나온다
        colink = (e[SOURCE_STRIP:, :] > GRAD).sum(axis=0)
        xs = np.where(colink > MIN_ROW)[0]
        if len(xs) >= 2:
            x0, x1 = int(xs.min()), int(xs.max())
            xoff = (x0 + x1) / 2 - 960
            if abs(xoff) > a.tol:
                msg.append(f"{'왼' if xoff < 0 else '오른'}쪽으로 {abs(xoff):.0f}px "
                           f'(잉크 {x0}~{x1})')
        if msg:
            rows.append((sid, card, y0, y1, ' · '.join(msg)))

    print(f'{a.project} — 그래픽 컷 {seen}개 검사 (허용 ±{a.tol}px)')
    if not rows:
        print('  균형 벗어난 컷 없음')
        return 0
    for sid, card, y0, y1, msg in rows:
        print(f'  #{sid:3d} {card:18s} {msg}')
    print(f'  걸린 컷 {len(rows)}개')
    return 1


if __name__ == '__main__':
    sys.exit(main())
