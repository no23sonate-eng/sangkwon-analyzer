#!/usr/bin/env python3
"""공식 사이트 사진을 **원본 크기로** 다시 받는다.

왜 필요했나
  화면이 뭉개진다는 지적을 받고 재 보니, `location_panoImg_night01.jpg` 이
  1920×482 인데 **서버 원본은 3840×1200** 이었다. 이전 세션에서 받으며
  절반으로 줄여 놓은 것이다. 그 상태로 16:9 를 채우니 세로로 2.2배 늘어나
  뭉갠다. 깨진 게 아니라 **없는 화소를 만들어 낸 것**이다.

  3840×1200 을 그대로 쓰면 높이를 1080 에 맞춰도 확대가 아니라 축소다.

무엇을 하나
  공식 페이지들을 훑어 <img>·srcset·background-image 의 주소를 모으고,
  파일명 규칙(`images/location/panoImg/night01.jpg` → `location_panoImg_night01.jpg`)
  으로 우리 파일과 짝지어, **지금 것보다 큰 것만** 덮어쓴다.
  작아지는 교체는 하지 않는다 — 이 스크립트가 같은 실수를 반복하면 안 된다.

    python3 scripts/refetch_official.py 니시아자부           # 무엇이 바뀌는지만
    python3 scripts/refetch_official.py 니시아자부 --write   # 실제로 덮어쓴다
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
SITES = {
    '니시아자부': {
        'base': 'https://www.mfrw.co.jp/parkwellstate/nishiazabu/',
        'pages': ['', 'outline.html', 'location.html', 'service.html',
                  'medicalcare.html', 'common.html', 'plan.html',
                  'premiumplan.html', 'gallery.html', 'annai.html',
                  'care/index.html'],
    },
}
IMG_RE = re.compile(r'(?:src|data-src|href)=["\']([^"\']+\.(?:jpg|jpeg|png))["\']'
                    r'|url\((["\']?)([^)"\']+\.(?:jpg|jpeg|png))\2\)', re.I)


def get(url, binary=False):
    r = subprocess.run(['curl', '-sS', '-L', '--max-time', '60',
                        '-H', 'Referer: https://www.mfrw.co.jp/',
                        '-H', 'User-Agent: Mozilla/5.0', url],
                       capture_output=True)
    return r.stdout if binary else r.stdout.decode('utf-8', 'replace')


def key_for(url, base):
    """주소를 우리 파일명으로. images/ 아래 경로를 `_` 로 잇는다."""
    p = urllib.parse.urlsplit(url).path
    m = re.search(r'/images/(.+)$', p)
    if not m:
        return None
    stem = m.group(1).rsplit('.', 1)[0]
    return re.sub(r'[/]+', '_', stem) + '.jpg'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--write', action='store_true')
    a = ap.parse_args()
    site = SITES.get(a.project)
    if not site:
        sys.exit(f'{a.project}: 공식 사이트가 등록돼 있지 않다')

    pub = ROOT / 'motion' / 'public' / a.project
    have = {f.name: Image.open(f).size for f in pub.glob('*.jpg')}

    seen = {}
    for page in site['pages']:
        url = urllib.parse.urljoin(site['base'], page)
        html = get(url)
        for m in IMG_RE.finditer(html):
            raw = m.group(1) or m.group(3)
            if not raw:
                continue
            full = urllib.parse.urljoin(url, raw)
            k = key_for(full, site['base'])
            if k:
                seen.setdefault(k, full)
    print(f'공식 페이지 {len(site["pages"])}장에서 사진 {len(seen)}종을 찾았다')

    up, same, new = [], 0, []
    for k, url in sorted(seen.items()):
        if k not in have:
            new.append(k)
            continue
        raw = get(url, binary=True)
        try:
            w, h = Image.open(io.BytesIO(raw)).size
        except Exception:
            continue
        ow, oh = have[k]
        if w * h > ow * oh * 1.2:
            up.append((k, ow, oh, w, h, raw))
        else:
            same += 1

    print(f'  더 큰 원본이 있는 것 {len(up)} · 그대로 {same} · '
          f'우리에게 없는 것 {len(new)}')
    for k, ow, oh, w, h, _ in up:
        print(f'    {k:38s} {ow}x{oh} → {w}x{h}')
    if a.write:
        for k, _, _, _, _, raw in up:
            (pub / k).write_bytes(raw)
        print(f'  {len(up)}장 덮어썼다')
    elif up:
        print('  --write 를 붙이면 덮어쓴다')
    return 0


if __name__ == '__main__':
    sys.exit(main())
