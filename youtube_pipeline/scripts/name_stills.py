#!/usr/bin/env python3
"""검수용 스틸을 **컷 번호가 보이는 이름**으로 정리한다.

렌더가 뱉는 이름은 `sec034_cut035.png` 다. 두 번호가 다르고(0-based 장면 /
1-based 컷) 어느 쪽으로 불러야 할지 매번 헷갈린다. 대화에서 "34번 고쳐 줘"
라고 부르는 건 **scene id** 하나뿐이니 그걸 앞에 세우고, 뒤에 시작 시각과
카드 이름을 붙여 파일 이름만 보고도 무슨 컷인지 알게 한다.

    034_2m39s_ArchiveCard.png

  python3 scripts/name_stills.py 더그랜드롯데
  python3 scripts/name_stills.py 더그랜드롯데 --from 40 --to 60
"""
import argparse
import json
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--from', dest='lo', type=int, default=0)
    ap.add_argument('--to', dest='hi', type=int, default=10 ** 6)
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    design = json.loads((pdir / 'design.json').read_text())['cuts']
    plan = {e['id']: e for e in json.loads((pdir / 'scene_plan.json').read_text())['scenes']}

    out = pdir / '컷'
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    n = 0
    for f in sorted((pdir / 'stills').glob('*.png')):
        m = re.match(r'sec(\d+)_', f.name)
        if not m:
            continue
        i = int(m.group(1))
        if not (a.lo <= i <= a.hi):
            continue
        card = (design.get(str(i)) or ['?'])[0]
        t = int(plan[i]['start']) if i in plan else 0
        shutil.copy(f, out / f'{i:03d}_{t // 60}m{t % 60:02d}s_{card}.png')
        n += 1
    print(f'{n}장 → {out}')


if __name__ == '__main__':
    main()
