#!/usr/bin/env python3
"""공식 사이트에서 **우리가 아직 안 쓴 사진**을 훑어 온다.

refetch_official.py 로 크기를 맞추다가, 사이트에 우리가 안 가진 사진이
199장 더 있는 걸 알았다. 지금 영상은 종이에 글자만 있는 컷이 예순 개
넘는데(SpecGrid 33 · BigStats 30), 그 자리를 채울 재료가 이미 공개돼
있었던 것이다.

받아만 놓고 고르는 건 눈으로 한다 — 한 장씩 열지 않게 컨택트시트로 굽는다.
`--min` 으로 너무 작은 것은 애초에 거른다(화면을 채우면 뭉갠다).

    python3 scripts/harvest_official.py 니시아자부            # 목록만
    python3 scripts/harvest_official.py 니시아자부 --write    # 받고 시트까지
"""
import argparse
import io
import pathlib
import re
import subprocess
import sys
import urllib.parse

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from refetch_official import SITES, IMG_RE, get, key_for   # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--min', type=int, default=900,
                    help='가로가 이보다 작으면 안 받는다')
    a = ap.parse_args()
    site = SITES.get(a.project)
    if not site:
        sys.exit(f'{a.project}: 공식 사이트가 등록돼 있지 않다')

    pub = ROOT / 'motion' / 'public' / a.project
    have = {f.name for f in pub.glob('*')}
    out = ROOT / 'projects' / a.project / '_후보'
    out.mkdir(parents=True, exist_ok=True)

    seen = {}
    for page in site['pages']:
        url = urllib.parse.urljoin(site['base'], page)
        for m in IMG_RE.finditer(get(url)):
            raw = m.group(1) or m.group(3)
            if not raw:
                continue
            full = urllib.parse.urljoin(url, raw)
            k = key_for(full, site['base'])
            if k and k not in have:
                seen.setdefault(k, full)

    print(f'우리에게 없는 사진 {len(seen)}종')
    got, tiny = [], 0
    for k, url in sorted(seen.items()):
        raw = get(url, binary=True)
        try:
            im = Image.open(io.BytesIO(raw))
            w, h = im.size
        except Exception:
            continue
        if w < a.min:
            tiny += 1
            continue
        got.append((k, w, h, raw))
    print(f'  쓸 만한 크기 {len(got)} · 너무 작아 거른 것 {tiny}')
    if not a.write:
        for k, w, h, _ in got[:40]:
            print(f'    {k:44s} {w}x{h}')
        print('  --write 를 붙이면 받고 컨택트시트까지 굽는다')
        return 0

    for k, w, h, raw in got:
        (out / k).write_bytes(raw)
    print(f'  {out} 에 {len(got)}장')

    # 컨택트시트 — 한 장에 24칸, 파일명을 밑에 적는다
    COLS, TW, TH = 6, 300, 200
    from PIL import ImageDraw
    for page in range(0, len(got), 24):
        batch = got[page:page + 24]
        rows = (len(batch) + COLS - 1) // COLS
        sheet = Image.new('RGB', (COLS * TW, rows * (TH + 22)), '#111')
        d = ImageDraw.Draw(sheet)
        for i, (k, w, h, raw) in enumerate(batch):
            im = Image.open(io.BytesIO(raw)).convert('RGB')
            im.thumbnail((TW - 6, TH - 6))
            x, y = (i % COLS) * TW, (i // COLS) * (TH + 22)
            sheet.paste(im, (x + 3, y + 3))
            d.text((x + 4, y + TH + 4), k[:44], fill='#DDD')
        p = ROOT / 'projects' / a.project / f'_후보시트_{page // 24 + 1}.png'
        sheet.save(p)
        print(f'    {p.name}  {len(batch)}장')
    return 0


if __name__ == '__main__':
    sys.exit(main())
