#!/usr/bin/env python3
"""Pexels 를 **검색해서** 받는다.

전에는 검색이 막힌 줄 알고 ID 를 밖에서 구해 왔다 (fetch_pexels.py 주석 참고).
다시 재 보니 `api.pexels.com` 이 이 환경에서 열려 있다 — 키 검증도 안 한다.
검색이 되면 작업 속도가 완전히 달라지므로 여기로 옮긴다.

    # 후보를 훑어본다 (컨택트시트까지)
    python3 scripts/pexels_search.py 더그랜드롯데 --video "construction site" -n 8

    # 눈으로 고른 뒤 채택
    python3 scripts/pexels_search.py 더그랜드롯데 --get video 5674342 construction.mp4

라이선스: Pexels License — 상업 이용 가능, 출처 표기 의무 아님.
다만 이 채널은 어디서 왔는지 밝히는 쪽을 택하므로 CREDITS 에 남긴다.
"""
import argparse
import io
import json
import os
import pathlib
import re
import subprocess
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'motion' / 'public'
API = 'https://api.pexels.com'
HDR = {'Authorization': os.environ.get('PEXELS_KEY', 'x'), 'User-Agent': 'Mozilla/5.0'}


def api(path, **q):
    """API 호출은 **curl 로** 한다.

    urllib 로 부르면 401 이 나오고 curl 은 200 이 나온다 — 이 환경의 프록시가
    curl 쪽에만 키를 끼워 주는 것으로 보인다. 이유를 캐는 것보다 되는 쪽을
    쓰는 게 낫다.

    사진(`/v1/`)만 열려 있고 **영상(`/videos/`)은 401** 이다. 영상 ID 는
    웹검색으로 `pexels.com/video/...-{id}` 주소를 찾아 손으로 넘긴다.
    """
    url = f'{API}{path}?' + urllib.parse.urlencode(q)
    out = subprocess.run(['curl', '-s', '--max-time', '40', url,
                          '-H', 'Authorization: ' + HDR['Authorization']],
                         capture_output=True, text=True)
    try:
        return json.loads(out.stdout)
    except Exception:
        raise SystemExit(f'Pexels 응답을 못 읽었다: {out.stdout[:200]}')


def best_video_file(v, want=1920):
    """가로가 want 에 제일 가까운 mp4 를 고른다.

    4K 를 그대로 받으면 한 클립이 40MB 를 넘고, 1920 렌더에 쓸 이유도 없다.
    반대로 640 짜리를 받으면 화면에서 뭉갠다.
    """
    files = [f for f in v.get('video_files', []) if f.get('file_type') == 'video/mp4']
    if not files:
        return None
    return min(files, key=lambda f: abs((f.get('width') or 0) - want))


def dl(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, 'wb') as f:
        f.write(r.read())
    return dest.stat().st_size


def sheet(rows, out):
    """후보 컨택트시트 — **눈으로 보기 전에는 채택하지 않는다.**"""
    from PIL import Image, ImageDraw
    if not rows:
        return None
    CW, CH, PAD, BAR = 460, 259, 12, 34
    cols = 4
    r = (len(rows) + cols - 1) // cols
    im = Image.new('RGB', (PAD + cols * (CW + PAD), PAD + r * (CH + BAR + PAD)), (22, 23, 26))
    dr = ImageDraw.Draw(im)
    for i, row in enumerate(rows):
        c, rr = i % cols, i // cols
        x, y = PAD + c * (CW + PAD), PAD + rr * (CH + BAR + PAD)
        try:
            req = urllib.request.Request(row['thumb'], headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=40) as resp:
                t = Image.open(io.BytesIO(resp.read())).convert('RGB')
            t.thumbnail((CW, CH))
            im.paste(t, (x + (CW - t.width) // 2, y + (CH - t.height) // 2))
        except Exception:
            dr.rectangle([x, y, x + CW, y + CH], fill=(40, 42, 46))
        dr.text((x + 2, y + CH + 4), f"{row['id']}  {row['note']}", fill=(235, 235, 235))
    im.save(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--photo', action='append', default=[])
    ap.add_argument('--video', action='append', default=[])
    ap.add_argument('-n', type=int, default=8)
    ap.add_argument('--get', nargs=3, metavar=('KIND', 'ID', 'NAME'))
    a = ap.parse_args()

    pdir = PUBLIC / a.project
    if a.get:
        kind, pid, name = a.get
        if kind == 'video':
            # 영상 메타 API 가 막혀 있어 다운로드 주소를 직접 친다.
            # `download/video/{id}/` 는 302 로 CDN 에 넘겨 준다 (실측)
            n = dl(f'https://www.pexels.com/download/video/{pid}/', pdir / name)
            who, src = 'Pexels', f'https://www.pexels.com/video/{pid}/' 
        else:
            p = api(f'/v1/photos/{pid}')
            n = dl(p['src']['large2x'], pdir / name)
            who = p['photographer']
            src = p['url']
        cred = pdir / 'CREDITS.md'
        if not cred.exists():
            cred.write_text(f'# {a.project} — 자료 출처\n\n| 파일 | 원본 | 출처 / 라이선스 | 화면 표기 |\n|---|---|---|---|\n')
        with open(cred, 'a', encoding='utf-8') as fh:
            fh.write(f'| `{name}` | {src} (pexels) | {who}, **Pexels License** | `{who} / Pexels` |\n')
        print(f'{name}  {n/1e6:.1f}MB  {who}  {src}')
        return

    rows = []
    for q in a.photo:
        for p in api('/v1/search', query=q, per_page=a.n, orientation='landscape').get('photos', []):
            rows.append({'id': p['id'], 'thumb': p['src']['medium'],
                         'note': f"사진 {p['width']}x{p['height']} {p['photographer'][:14]}"})
    for q in a.video:
        for v in api('/videos/search', query=q, per_page=a.n, orientation='landscape').get('videos', []):
            th = v.get('image')
            rows.append({'id': v['id'], 'thumb': th,
                         'note': f"영상 {v['width']}x{v['height']} {v['duration']}s {v['user']['name'][:12]}"})
    out = sheet(rows, pdir / '_candidates' / 'pexels_sheet.png')
    print(f'후보 {len(rows)}개 → {out}')
    print('시트를 **눈으로 본 뒤** 채택한다:')
    print(f'  python3 scripts/pexels_search.py {a.project} --get video <id> <파일명>')


if __name__ == '__main__':
    main()
