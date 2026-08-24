#!/usr/bin/env python3
"""design.json 의 컷별 카드 확정을 scene_plan.json 에 얹고, 바로 검사한다.

plan_from_script 는 **못 고른 것을 드러내는** 도구다. 실제로 고르는 건
사람이 하고, 그 결과가 design.json 이다. 여기서는 얹기만 하는 게 아니라
얹은 결과가 규칙을 지키는지 그 자리에서 본다 — 안 그러면 렌더까지 가서야
"같은 포맷이 또 있다" 가 나온다.

검사 3가지:
  ① 같은 카드가 **연달아** 오지 않는가
  ② 한 카드가 전체의 상한(기본 10%)을 넘지 않는가
  ③ 등록되지 않은 카드 이름이 없는가  ← 이거 놓치면 렌더가 #300 한 장

  python3 scripts/apply_design.py 더그랜드롯데 [--check]
"""
import argparse
import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHARE_MAX = 0.10

# 계열 — 어떤 카드가 **사진을 주인공으로** 쓰는가.
# 올리브영 편에서 실사 자막 카드가 67% 였던 게 문제였지만, 반대로 몰아서
# 도형만 남기면 실존 건물·인물·장소를 다루는 영상이 슬라이드가 된다.
# 채널 규칙: 실존하는 것은 사진이 먼저고, 도형은 구조·개념을 설명할 때다.
PHOTO = {'PaperImageCard', 'FullBleedCard', 'LowerThirdCard', 'AnnotatedShotCard',
         'SectionPhotoCard', 'PhotoSplitCard', 'PhotoStepsCard', 'BeforeAfterCard'}
PLATE = {'MediaPlateCard', 'ArticleCard', 'NewsHeadlineCard', 'QuoteCard', 'NewsQuoteCard'}
GEO = {'MapCard', 'GeoMapCard', 'SitePlotCard'}
# 위쪽 52% 는 상한이다 — 올리브영 편이 80% 라서 "같은 포맷이 또" 가 나왔다.
# 아래쪽 25% 는 하한이다. 실존 건물·인물·장소를 다루는데 사진이 4분의 1도
# 안 되면 그건 영상이 아니라 슬라이드다. 처음엔 52% 를 목표치로 잘못 잡아
# 하한을 40% 로 뒀는데, 그러면 설명 위주 대본을 억지로 사진으로 채우게 된다.
PHOTO_BAND = (0.25, 0.52)


def registered():
    txt = (ROOT / 'motion' / 'src' / 'cardRegistry.jsx').read_text()
    return set(re.findall(r'^  (\w+Card),', txt, re.M))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--check', action='store_true', help='쓰지 않고 검사만')
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    plan = json.loads((pdir / 'scene_plan.json').read_text())
    design = json.loads((pdir / 'design.json').read_text())['cuts']
    known = registered()

    scenes = plan['scenes']
    miss = [i for i in range(len(scenes)) if str(i) not in design]
    bad = sorted({c for c, _ in design.values() if c not in known})

    for e in scenes:
        row = design.get(str(e['id']))
        if row:
            e['card'], e['_why'] = row[0], row[1]

    cards = [e['card'] for e in scenes]
    cnt = collections.Counter(cards)
    runs = [(i, cards[i]) for i in range(1, len(cards)) if cards[i] == cards[i - 1]]
    over = [(c, n) for c, n in cnt.most_common() if n / len(cards) > SHARE_MAX]

    def fam(c):
        return '실사' if c in PHOTO else '자료' if c in PLATE else '지도' if c in GEO else '그래픽'
    fams = collections.Counter(fam(c) for c in cards)
    pshare = fams['실사'] / len(cards)

    print(f'{a.project} — 컷 {len(scenes)} · 카드 {len(cnt)}종')
    print(f'  최다 {cnt.most_common(1)[0][0]} {cnt.most_common(1)[0][1]}컷 '
          f'({cnt.most_common(1)[0][1] / len(cards) * 100:.0f}%)')
    ok = True
    if miss:
        ok = False
        print(f'  ✗ 설계 안 된 컷 {len(miss)}개: {miss[:12]}')
    if bad:
        ok = False
        print(f'  ✗ 등록 안 된 카드: {bad}  ← 이대로 렌더하면 #300 한 장이다')
    if runs:
        ok = False
        print(f'  ✗ 같은 카드 연속 {len(runs)}곳: ' +
              ', '.join(f'#{i}({c})' for i, c in runs[:8]))
    if over:
        ok = False
        print(f'  ✗ 상한 {SHARE_MAX:.0%} 초과: ' +
              ', '.join(f'{c} {n}컷({n / len(cards) * 100:.0f}%)' for c, n in over))
    print('  계열  ' + ' · '.join(f'{k} {v}컷({v / len(cards) * 100:.0f}%)'
                                  for k, v in fams.most_common()))
    if not PHOTO_BAND[0] <= pshare <= PHOTO_BAND[1]:
        ok = False
        which = '적다 — 실존 건물·장소를 도형으로 그리고 있다' if pshare < PHOTO_BAND[0] \
            else '많다 — 사진 위 자막으로 때우고 있다'
        print(f'  ✗ 실사 계열 {pshare:.0%} · 권장 {PHOTO_BAND[0]:.0%}~{PHOTO_BAND[1]:.0%} 보다 {which}')
    if ok:
        print('  ✓ 연속 없음 · 상한 이내 · 전부 등록된 카드')

    if not a.check:
        (pdir / 'scene_plan.json').write_text(
            json.dumps(plan, ensure_ascii=False, indent=1))
        print(f'  → {pdir / "scene_plan.json"} 갱신')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
