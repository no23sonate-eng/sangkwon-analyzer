#!/usr/bin/env python3
"""여러 소스에서 자료를 한꺼번에 긁어와 고를 수 있게 깔아 준다.

지금까지 자료 수집은 매번 손이었다 — 커먼즈를 뒤지고, 라이선스를 확인하고,
CREDITS 를 손으로 적고, 잘못된 건물을 쓴 적도 있다(에테르노 3장).
그 전부를 한 명령으로 만든다.

소스
  commons   Wikimedia Commons        사진 · 저작자/라이선스 확실
  openverse Openverse(Flickr 등 집계) 사진 · CC 만 필터
  mixkit    Mixkit                   영상 · Mixkit Free License

  python3 youtube_pipeline/scripts/fetch_sources.py 신세계MOU \\
      --q "shinsegae department store" --q "백화점" --video "shopping mall"

하는 일
  1) 소스별로 검색 → 후보를 `motion/public/<프로젝트>/_candidates/` 에 받는다
  2) 라이선스·저작자·해상도를 `candidates.json` 에 남긴다
  3) **컨택트시트 png** 를 만든다 — 눈으로 한 번 보고 고르라고
  4) `--adopt <id> <새이름>` 으로 채택하면 본 폴더로 옮기고 CREDITS.md 에 줄을 추가한다

**눈으로 확인하기 전에는 절대 본 폴더로 안 들어간다.** 파일 이름이 맞다고
건물이 맞는 게 아니다 — 이 규칙이 없어서 다른 프로젝트 렌더를 쓴 적이 있다.
"""
import argparse, hashlib, json, os, re, subprocess, sys, time, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'motion', 'public')
UA = 'sangkwon-analyzer/1.0 (youtube research; contact via repo)'


def get(url, out=None, timeout=60):
    cmd = ['curl', '-sL', '--max-time', str(timeout), url, '-A', UA]
    if out:
        cmd += ['-o', out]
        r = subprocess.run(cmd, capture_output=True)
        return os.path.exists(out) and os.path.getsize(out) > 1024
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def strip_html(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s or '')).strip()


# ── 소스별 검색 ─────────────────────────────────────────────────────────
def search_commons(q, limit):
    api = 'https://commons.wikimedia.org/w/api.php?'
    d = {}
    for _ in range(3):
        raw = get(api + urllib.parse.urlencode({
            'action': 'query', 'format': 'json', 'list': 'search',
            'srsearch': q, 'srnamespace': '6', 'srlimit': str(limit)}))
        try:
            d = json.loads(raw); break
        except Exception:
            time.sleep(1)
    titles = [r['title'] for r in d.get('query', {}).get('search', [])]
    titles = [t for t in titles if t.lower().endswith(('.jpg', '.jpeg', '.png'))]
    if not titles:
        return []
    raw = get(api + urllib.parse.urlencode({
        'action': 'query', 'format': 'json', 'prop': 'imageinfo',
        'iiprop': 'url|extmetadata|size', 'iiurlwidth': '1920',
        'titles': '|'.join(titles)}))
    try:
        d = json.loads(raw)
    except Exception:
        return []
    out = []
    for pg in d.get('query', {}).get('pages', {}).values():
        ii = (pg.get('imageinfo') or [{}])[0]
        if not ii:
            continue
        m = ii.get('extmetadata', {})
        out.append({
            'source': 'commons', 'kind': 'image',
            'title': pg['title'][5:],
            'url': ii.get('thumburl') or ii.get('url'),
            'page': ii.get('descriptionurl', ''),
            'w': ii.get('width'), 'h': ii.get('height'),
            'license': strip_html(m.get('LicenseShortName', {}).get('value', '?')),
            'author': strip_html(m.get('Artist', {}).get('value', '?'))[:60],
        })
    return out


def search_openverse(q, limit):
    raw = get('https://api.openverse.org/v1/images/?' + urllib.parse.urlencode(
        {'q': q, 'page_size': str(limit), 'license_type': 'commercial,modification'}))
    try:
        d = json.loads(raw)
    except Exception:
        return []
    out = []
    for r in d.get('results', []):
        out.append({
            'source': 'openverse', 'kind': 'image',
            'title': (r.get('title') or '')[:70],
            'url': r.get('url'), 'page': r.get('foreign_landing_url', ''),
            'w': r.get('width'), 'h': r.get('height'),
            'license': f"{(r.get('license') or '').upper()} {r.get('license_version') or ''}".strip(),
            'author': (r.get('creator') or '?')[:60],
        })
    return out


def search_mixkit(q, limit):
    """Mixkit 검색 페이지에서 360p 미리보기 URL 을 긁고, 채택 시 720p 로 바꾼다."""
    slug = re.sub(r'[^a-z0-9]+', '-', q.lower()).strip('-')
    html = get(f'https://mixkit.co/free-stock-video/{slug}/')
    ids = []
    for m in re.finditer(r'assets\.mixkit\.co/videos/(\d+)/\1-360\.mp4', html):
        if m.group(1) not in ids:
            ids.append(m.group(1))
    return [{
        'source': 'mixkit', 'kind': 'video', 'title': f'mixkit {i}',
        'url': f'https://assets.mixkit.co/videos/{i}/{i}-360.mp4',
        'hires': f'https://assets.mixkit.co/videos/{i}/{i}-720.mp4',
        'thumb': f'https://assets.mixkit.co/videos/{i}/{i}-thumb-360-0.jpg',
        'page': f'https://mixkit.co/free-stock-video/', 'w': 640, 'h': 360,
        'license': 'Mixkit Free License', 'author': 'Mixkit',
    } for i in ids[:limit]]


# ── 후보 수집 ───────────────────────────────────────────────────────────
def collect(project, queries, videos, limit):
    cdir = os.path.join(PUBLIC, project, '_candidates')
    os.makedirs(cdir, exist_ok=True)
    found = []
    for q in queries:
        for fn in (search_commons, search_openverse):
            for r in fn(q, limit):
                r['q'] = q
                found.append(r)
    for q in videos:
        for r in search_mixkit(q, limit):
            r['q'] = q
            found.append(r)

    seen, rows = set(), []
    for r in found:
        if not r.get('url') or r['url'] in seen:
            continue
        seen.add(r['url'])
        cid = hashlib.md5(r['url'].encode()).hexdigest()[:8]
        ext = '.mp4' if r['kind'] == 'video' else os.path.splitext(
            urllib.parse.urlparse(r['url']).path)[1].lower() or '.jpg'
        if ext not in ('.jpg', '.jpeg', '.png', '.mp4'):
            ext = '.jpg'
        path = os.path.join(cdir, f'{cid}{ext}')
        if not os.path.exists(path) and not get(r['url'], path):
            continue
        r['id'] = cid
        r['file'] = os.path.relpath(path, ROOT)
        rows.append(r)
        print(f"  [{cid}] {r['source']:9s} {str(r.get('w')):>5}x{str(r.get('h')):<5} "
              f"{r['license'][:22]:22s} {r['title'][:44]}", flush=True)

    json.dump(rows, open(os.path.join(cdir, 'candidates.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    return cdir, rows


def contact_sheet(cdir, rows, cols=4):
    """눈으로 고르라고 만드는 시트. 여기서 **건물이 맞는지 반드시 확인**한다."""
    from PIL import Image, ImageDraw, ImageFont
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
    FONT = os.path.join(PUBLIC, 'fonts', 'Pretendard-Bold.otf')
    TW, TH = 480, 300
    tiles = []
    for r in rows:
        p = os.path.join(ROOT, r['file'])
        try:
            if r['kind'] == 'video':
                th = p + '.jpg'
                subprocess.run([FF, '-y', '-loglevel', 'error', '-ss', '1', '-i', p,
                                '-frames:v', '1', th], capture_output=True)
                im = Image.open(th).convert('RGB')
            else:
                im = Image.open(p).convert('RGB')
        except Exception:
            continue
        im.thumbnail((TW, TH - 44))
        t = Image.new('RGB', (TW, TH), (26, 26, 26))
        t.paste(im, ((TW - im.width) // 2, (TH - 44 - im.height) // 2))
        d = ImageDraw.Draw(t)
        f = ImageFont.truetype(FONT, 19)
        d.rectangle([0, 0, 96, 28], fill=(250, 255, 46))
        d.text((8, 2), r['id'], font=f, fill=(20, 20, 20))
        d.text((8, TH - 40), f"{r['source']} · {r['license'][:24]}", font=f, fill=(230, 230, 230))
        d.text((8, TH - 20), f"{r['author'][:44]}", font=f, fill=(150, 150, 150))
        tiles.append(t)
    if not tiles:
        return None
    rowsn = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (TW + 6), rowsn * (TH + 6)), (14, 14, 14))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * (TW + 6), (i // cols) * (TH + 6)))
    out = os.path.join(cdir, 'contact_sheet.png')
    sheet.save(out)
    return out


def adopt(project, cid, name):
    """후보를 본 폴더로 승격하고 CREDITS.md 에 줄을 추가한다."""
    cdir = os.path.join(PUBLIC, project, '_candidates')
    rows = json.load(open(os.path.join(cdir, 'candidates.json'), encoding='utf-8'))
    r = next((x for x in rows if x['id'] == cid), None)
    if not r:
        sys.exit(f'{cid} 그런 후보 없음')
    src = os.path.join(ROOT, r['file'])
    ext = os.path.splitext(name)[1] or os.path.splitext(src)[1]
    dst = os.path.join(PUBLIC, project, name if os.path.splitext(name)[1] else name + ext)

    if r['kind'] == 'video' and r.get('hires'):
        # 미리보기는 360p 였다. 채택할 때 720p 로 다시 받는다.
        if not get(r['hires'], dst):
            sys.exit('720p 내려받기 실패')
    else:
        import shutil
        shutil.copy(src, dst)

    cred = os.path.join(PUBLIC, project, 'CREDITS.md')
    head = f'# {project} — 자료 출처\n\n| 파일 | 원본 | 출처 / 라이선스 | 화면 표기 |\n|---|---|---|---|\n'
    if not os.path.exists(cred):
        open(cred, 'w', encoding='utf-8').write(head)
    show = f"{r['author']} / {r['license']}" if r['source'] != 'mixkit' else 'Mixkit'
    with open(cred, 'a', encoding='utf-8') as f:
        f.write(f"| `{os.path.basename(dst)}` | {r['title']} ({r['source']}) | "
                f"{r['author']}, **{r['license']}** | `{show}` |\n")
    print(f'{dst}\n화면 표기: {show}\nCREDITS.md 에 추가했다.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--q', action='append', default=[], help='사진 검색어 (여러 번)')
    ap.add_argument('--video', action='append', default=[], help='영상 검색어 (Mixkit)')
    ap.add_argument('--limit', type=int, default=6)
    ap.add_argument('--adopt', nargs=2, metavar=('ID', 'NAME'))
    a = ap.parse_args()

    if a.adopt:
        adopt(a.project, *a.adopt)
        return
    if not a.q and not a.video:
        sys.exit('--q 또는 --video 를 줘야 한다')

    print(f'수집: {a.project}')
    cdir, rows = collect(a.project, a.q, a.video, a.limit)
    sheet = contact_sheet(cdir, rows)
    print(f'\n후보 {len(rows)}개 → {cdir}')
    if sheet:
        print(f'컨택트시트: {sheet}')
    print('\n**시트를 눈으로 확인한 뒤** 채택한다:')
    print(f'  python3 youtube_pipeline/scripts/fetch_sources.py {a.project} --adopt <id> <파일명>')


if __name__ == '__main__':
    main()
