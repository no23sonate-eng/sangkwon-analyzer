#!/usr/bin/env python3
"""네이버 이미지 검색으로 **한국 대상** 자료를 찾는다.

커먼즈·오픈버스·Pexels 는 한국 호텔·상업건물·기업 로고가 거의 없다.
더그랜드롯데 편에서 사진 컷 46개에 소재가 12개밖에 안 모인 이유가 이거다.
네이버 이미지 검색은 이 환경에서 **plain curl 로 열린다** (구글은 JS 껍데기라 못 쓴다).

검색 결과 HTML 안에 `"originalUrl":"…"` 가 그대로 박혀 있어 원본까지 받힌다.

    python3 scripts/fetch_naver_image.py 더그랜드롯데 --q "더그랜드롯데 로고" -n 12
    python3 scripts/fetch_naver_image.py 더그랜드롯데 --get 3 lotte_grand_logo.jpg --credit "롯데호텔"

**저작권**: 여기서 나오는 건 대부분 **저작권물**이다. 이 채널은 출처를 밝히고
쓰는 쪽을 택했으므로 `--credit` 을 반드시 준다. 화면 우상단 `Source :` 로 나간다.
출처를 못 적을 자료면 쓰지 않는다.
"""
import argparse
import io
import json
import pathlib
import re
import subprocess
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'motion' / 'public'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120 Safari/537.36')


def curl(url, out=None):
    cmd = ['curl', '-sL', '--max-time', '60', '-H', f'User-Agent: {UA}', url]
    if out:
        cmd += ['-o', str(out)]
        subprocess.run(cmd, check=False)
        return out
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def search(q, n):
    url = ('https://search.naver.com/search.naver?where=image&query='
           + urllib.parse.quote(q))
    html = curl(url)
    # `"originalUrl":"…"` 와 바로 뒤따르는 `"link":"…"`(출처 페이지) 를 짝지어 뽑는다
    hits, seen = [], set()
    for m in re.finditer(r'"originalUrl":"(.*?)"', html):
        u = m.group(1).encode().decode('unicode_escape')
        if u in seen:
            continue
        seen.add(u)
        tail = html[m.end():m.end() + 700]
        link = re.search(r'"link":"(.*?)"', tail)
        title = re.search(r'"(?:title|imageTitle)":"(.*?)"', tail)
        hits.append({'url': u,
                     'page': (link.group(1).encode().decode('unicode_escape') if link else ''),
                     'title': (title.group(1).encode().decode('unicode_escape') if title else '')})
        if len(hits) >= n:
            break
    return hits


def sheet(rows, out):
    from PIL import Image, ImageDraw
    if not rows:
        return None
    CW, CH, PAD, BAR = 420, 300, 12, 32
    cols = 4
    r = (len(rows) + cols - 1) // cols
    im = Image.new('RGB', (PAD + cols * (CW + PAD), PAD + r * (CH + BAR + PAD)), (22, 23, 26))
    dr = ImageDraw.Draw(im)
    tmp = out.parent / '_tmp.bin'
    for i, row in enumerate(rows):
        c, rr = i % cols, i // cols
        x, y = PAD + c * (CW + PAD), PAD + rr * (CH + BAR + PAD)
        try:
            curl(row['url'], tmp)
            t = Image.open(tmp).convert('RGB')
            t.thumbnail((CW, CH))
            im.paste(t, (x + (CW - t.width) // 2, y + (CH - t.height) // 2))
        except Exception:
            dr.rectangle([x, y, x + CW, y + CH], fill=(40, 42, 46))
        dr.text((x + 2, y + CH + 4), f"[{i}] {row['title'][:44]}", fill=(235, 235, 235))
    tmp.unlink(missing_ok=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--q', action='append', default=[])
    ap.add_argument('-n', type=int, default=12)
    ap.add_argument('--get', nargs=2, metavar=('INDEX', 'NAME'))
    ap.add_argument('--credit', default='', help='화면에 나갈 출처 표기 — 없으면 안 받는다')
    a = ap.parse_args()

    pdir = PUBLIC / a.project
    cand = pdir / '_candidates' / 'naver.json'

    if a.get:
        idx, name = int(a.get[0]), a.get[1]
        rows = json.loads(cand.read_text())
        row = rows[idx]
        if not a.credit:
            raise SystemExit('--credit 없이는 안 받는다. 저작권물이라 출처를 화면에 밝혀야 한다.')
        curl(row['url'], pdir / name)
        size = (pdir / name).stat().st_size
        cred = pdir / 'CREDITS.md'
        if not cred.exists():
            cred.write_text(f'# {a.project} — 자료 출처\n\n| 파일 | 원본 | 출처 / 라이선스 | 화면 표기 |\n|---|---|---|---|\n')
        with open(cred, 'a', encoding='utf-8') as fh:
            fh.write(f"| `{name}` | {row['title'][:60]} ({row['page'][:70]}) | "
                     f"**저작권물 · 출처 표기 사용** | `{a.credit}` |\n")
        print(f'{name}  {size/1e3:.0f}KB  표기: {a.credit}\n  {row["page"]}')
        return

    rows = []
    for q in a.q:
        for h in search(q, a.n):
            h['q'] = q
            rows.append(h)
    cand.parent.mkdir(parents=True, exist_ok=True)
    cand.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    out = sheet(rows, pdir / '_candidates' / 'naver_sheet.png')
    # 크기를 같이 찍는다. 1920 으로 렌더하는데 600px 짜리를 받으면 뭉갠다 —
    # 시트에서는 다 그럴듯해 보여서 붙이고 나서야 안다
    from PIL import Image
    tmp = cand.parent / '_probe.bin'
    for i, h in enumerate(rows):
        try:
            curl(h['url'], tmp)
            w, hh = Image.open(tmp).size
        except Exception:
            w = hh = 0
        h['w'], h['h'] = w, hh
        mark = '' if w >= 1400 else ('  ← 작다' if w else '  ← 못 읽음')
        print(f"[{i:2d}] {w:5d}x{hh:<5d}{mark:10s} {h['title'][:40]:40s} {h['page'][:40]}")
    tmp.unlink(missing_ok=True)
    cand.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    print(f'\n{len(rows)}개 → {out}')
    print('시트를 **눈으로 본 뒤** 채택한다 (출처 표기 필수):')
    print(f'  python3 scripts/fetch_naver_image.py {a.project} --get <번호> <파일명> --credit "매체명"')


if __name__ == '__main__':
    main()
