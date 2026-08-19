#!/usr/bin/env python3
"""실사 수급기 — 장면 내용에 맞는 사진/영상을 찾아 motion/public/media/ 에 받는다.

원칙 (2026-08-19 사용자 지시):
  1순위 — 그 내용의 **실제 대상**을 찍은 자료 (Wikimedia Commons, 라이선스 명시)
  2순위 — 실제 자료가 없으면 **비슷한 느낌**의 스톡 (Pexels)
받은 파일은 credits.json 에 출처·라이선스를 자동 기록한다.

사용:
  python3 youtube_pipeline/scripts/fetch_media.py --subject "성수동 거리" --slug seongsu_street
  python3 youtube_pipeline/scripts/fetch_media.py --mood "modern office building seoul" --slug office --video
  python3 youtube_pipeline/scripts/fetch_media.py --plan media_plan.json   (여러 건 한 번에)

PEXELS_API_KEY 가 env 또는 youtube_pipeline/.env 에 있으면 스톡 검색이 켜진다.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA_DIR = os.path.join(BASE, 'motion', 'public', 'media')
CREDITS = os.path.join(MEDIA_DIR, 'credits.json')
UA = 'Mozilla/5.0 (compatible; sangkwon-youtube-pipeline/1.0)'


def _load_key():
    key = os.environ.get('PEXELS_API_KEY')
    if key:
        return key
    envf = os.path.join(BASE, '.env')
    if os.path.exists(envf):
        for line in open(envf, encoding='utf-8'):
            if line.startswith('PEXELS_API_KEY'):
                return line.split('=', 1)[1].strip().strip('"\'')
    return None


_LAST = [0.0]


def _get(url, headers=None, timeout=60, tries=4):
    """위키미디어는 연속 호출에 429 를 준다 — 간격을 두고 재시도한다."""
    for attempt in range(tries):
        gap = time.time() - _LAST[0]
        # 심사 때문에 후보를 여러 장 받으므로 호출량이 3~4배다. 간격을 넉넉히.
        if gap < 2.6:
            time.sleep(2.6 - gap)
        _LAST[0] = time.time()
        req = urllib.request.Request(url, headers={'User-Agent': UA, **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < tries - 1:
                time.sleep(8 * (attempt + 1))
                continue
            raise


def _save(raw, slug, ext):
    os.makedirs(MEDIA_DIR, exist_ok=True)
    path = os.path.join(MEDIA_DIR, f'{slug}.{ext}')
    open(path, 'wb').write(raw)
    return path


def _record(entry):
    data = []
    if os.path.exists(CREDITS):
        try:
            data = json.load(open(CREDITS, encoding='utf-8'))
        except json.JSONDecodeError:
            data = []
    data = [d for d in data if d.get('file') != entry['file']] + [entry]
    json.dump(data, open(CREDITS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


# ── 1순위: 실제 대상 (Wikimedia Commons) ────────────────────────────────
# ── 화면값 심사 — "실제 대상"이어도 화면에서 B1M 처럼 안 보이면 소용없다 ──
# quality_probe 가 잰 B1M 실사 구간: sat 0.18~0.37 / edge 0.05~0.12 / lum 78~125
MAX_SCREEN = 4  # 후보를 최대 몇 장까지 받아 비교할지
SCREEN_TARGET = {'sat': (0.18, 0.37), 'edge': (0.049, 0.122), 'lum': (78, 125)}
SCREEN_WEIGHT = {'sat': 1.0, 'edge': 0.8, 'lum': 0.4}


def screen_score(raw):
    """구간 밖으로 얼마나 벗어났는지 (0 이면 구간 안). 낮을수록 좋다."""
    try:
        import io as _io
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from quality_probe import metrics  # numpy/Pillow 필요
        from PIL import Image
        m = metrics(Image.open(_io.BytesIO(raw)))
    except Exception:  # noqa: BLE001 — 심사는 있으면 좋은 것, 없어도 진행
        return None, None
    total = 0.0
    for k, (lo, hi) in SCREEN_TARGET.items():
        v = m[k]
        span = hi - lo
        off = (lo - v) / span if v < lo else (v - hi) / span if v > hi else 0.0
        total += SCREEN_WEIGHT[k] * off
    return total, m


def from_wikimedia(query, slug, min_width=1280, anchor='', screen=True):
    """검색어가 길면 결과가 0이 되기 쉬워, 뒤 단어부터 떼며 재시도한다.

    단, 단어를 떼면 "성수동"과 무관한 사진이 걸리기 쉽다. 그래서 앵커(기본값:
    첫 단어)가 파일 제목에 들어 있지 않으면 1순위로 인정하지 않는다.
    엉뚱한 실사를 붙이느니 2순위(유사 분위기)로 내려가는 편이 낫다.
    """
    words = query.split()
    anchor = anchor or (words[0] if words else '')
    tried = []
    for n in range(len(words), 0, -1):
        q = ' '.join(words[:n])
        if q in tried:
            continue
        tried.append(q)
        try:
            got = _wikimedia_once(q, slug, min_width, anchor, screen)
        except Exception as e:  # noqa: BLE001 — 한 검색어가 실패해도 다음으로
            print(f'  검색 실패({e})', flush=True)
            got = None
        if got:
            return got
    return None


def _title_ok(title, anchor):
    """제목이 앵커를 포함하는가. 'Seongsu-dong' ↔ 'seongsu' 처럼 느슨하게 본다."""
    t = title.lower()
    a = re.sub(r'[^a-z0-9가-힣]', '', anchor.lower())
    if not a:
        return True
    return a in re.sub(r'[^a-z0-9가-힣]', '', t)


def _wikimedia_once(query, slug, min_width=1280, anchor='', screen=True):
    api = ('https://commons.wikimedia.org/w/api.php?action=query&generator=search'
           f'&gsrsearch={urllib.parse.quote(query)}&gsrnamespace=6&gsrlimit=12'
           '&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&iiurlwidth=1920&format=json')
    try:
        d = json.loads(_get(api))
    except Exception as e:  # noqa: BLE001
        print(f'  wikimedia 실패: {e}', flush=True)
        return None
    pages = list((d.get('query') or {}).get('pages', {}).values())
    cands = []
    for p in pages:
        title = p.get('title', '')
        # 문서 스캔(PDF·DjVu)에서 뽑힌 페이지 이미지는 실사가 아니다
        if title.lower().endswith(('.pdf', '.djvu', '.svg', '.tif', '.tiff')):
            continue
        if not _title_ok(title, anchor):
            continue
        ii = (p.get('imageinfo') or [{}])[0]
        url = ii.get('thumburl') or ii.get('url') or ''
        # 위키미디어가 URL 뒤에 추적 파라미터를 붙이므로 쿼리를 떼고 확장자를 본다
        stem = url.split('?', 1)[0].lower()
        if not stem.endswith(('.jpg', '.jpeg', '.png')):
            continue
        if (ii.get('width') or 0) < min_width:
            continue
        lic = (ii.get('extmetadata', {}).get('LicenseShortName', {}) or {}).get('value', '')
        if 'fair' in lic.lower():
            continue
        cands.append({'url': url, 'title': title, 'license': lic,
                      'page': f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title)}"})
    if not cands:
        return None

    # 후보를 여러 장 받아 화면값으로 고른다 (screen=False 면 첫 장)
    best, best_raw, best_score, best_m = None, None, None, None
    for c in cands[:MAX_SCREEN if screen else 1]:
        try:
            raw = _get(c['url'])
        except Exception as e:  # noqa: BLE001 — 한 후보가 막혀도 다음 후보로
            print(f'  후보 내려받기 실패({e}) — 다음 후보', flush=True)
            continue
        if not raw or len(raw) < 20000:
            continue
        if not screen:
            best, best_raw = c, raw
            break
        sc, m = screen_score(raw)
        if sc is None:
            best, best_raw = c, raw
            break
        if best_score is None or sc < best_score:
            best, best_raw, best_score, best_m = c, raw, sc, m
        if sc < 0.05:  # 충분히 좋으면 더 안 본다
            break
    if not best:
        return None

    path = _save(best_raw, slug, 'jpg')
    entry = {'file': os.path.basename(path), 'kind': 'photo', 'source': 'Wikimedia Commons',
             'title': best['title'], 'license': best['license'], 'page': best['page'],
             'query': query, 'tier': '1순위 · 실제 대상'}
    if best_m:
        entry['screen'] = {'sat': round(best_m['sat'], 3), 'edge': round(best_m['edge'], 3),
                           'lum': round(best_m['lum'])}
    _record(entry)
    tail = ''
    if best_m:
        tail = f" | sat {best_m['sat']:.2f} edge {best_m['edge']:.2f}"
        if best_score and best_score > 0.25:
            tail += ' ← B1M 실사 대비 밋밋/복잡 (교체 권장)'
    print(f"  [wikimedia] {os.path.basename(path)} | {best['license']} | {best['title'][:50]}{tail}", flush=True)
    return path


# ── 2순위: 비슷한 느낌 (Pexels) ─────────────────────────────────────────
def from_pexels(query, slug, want_video=False):
    key = _load_key()
    if not key:
        print('  [pexels] PEXELS_API_KEY 없음 — 건너뜀 (사용자 PC 에서 실행하면 동작)', flush=True)
        return None
    kind = 'videos' if want_video else 'photos'
    api = (f'https://api.pexels.com/{"videos" if want_video else "v1"}/search'
           f'?query={urllib.parse.quote(query)}&per_page=8&orientation=landscape')
    try:
        d = json.loads(_get(api, headers={'Authorization': key}))
    except Exception as e:  # noqa: BLE001
        print(f'  pexels 실패: {e}', flush=True)
        return None
    items = d.get('videos' if want_video else 'photos') or []
    if not items:
        return None
    it = items[0]
    if want_video:
        files = sorted(it.get('video_files', []), key=lambda f: -(f.get('width') or 0))
        cand = next((f for f in files if (f.get('width') or 0) <= 1920), files[0] if files else None)
        if not cand:
            return None
        raw = _get(cand['file_link'] if 'file_link' in cand else cand['link'])
        path = _save(raw, slug, 'mp4')
        credit = f"Pexels — {it.get('user', {}).get('name', '')}"
        page = it.get('url', '')
    else:
        raw = _get(it['src']['large2x'])
        path = _save(raw, slug, 'jpg')
        credit = f"Pexels — {it.get('photographer', '')}"
        page = it.get('url', '')
    _record({'file': os.path.basename(path), 'kind': 'video' if want_video else 'photo',
             'source': credit, 'license': 'Pexels License', 'page': page,
             'query': query, 'tier': '2순위 · 유사 분위기'})
    print(f'  [pexels] {os.path.basename(path)} | {credit}', flush=True)
    return path


def fetch_one(slug, subject='', mood='', want_video=False, anchor='', screen=True):
    """실제 대상 → 없으면 유사 분위기 순으로 시도."""
    print(f'· {slug}', flush=True)
    if subject and not want_video:
        got = from_wikimedia(subject, slug, anchor=anchor, screen=screen)
        if got:
            return got
        print('  실제 대상 자료 없음 → 유사 분위기로 폴백', flush=True)
    return from_pexels(mood or subject, slug, want_video=want_video)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--subject', default='', help='실제 대상 검색어 (1순위)')
    ap.add_argument('--mood', default='', help='유사 분위기 검색어 (2순위)')
    ap.add_argument('--slug', default='', help='저장 파일명')
    ap.add_argument('--video', action='store_true')
    ap.add_argument('--anchor', default='', help='제목에 반드시 들어가야 할 낱말 (기본: subject 첫 단어)')
    ap.add_argument('--plan', default='', help='[{slug, subject, mood, anchor, video}] JSON')
    ap.add_argument('--prune', action='store_true', help='없는 파일의 크레딧 항목 정리')
    ap.add_argument('--no-screen', action='store_true', help='화면값 심사 없이 첫 후보를 받는다')
    args = ap.parse_args()

    if args.prune:
        # 손으로 지운 파일의 크레딧 항목을 정리한다 (엉뚱한 자료를 버렸을 때)
        data = json.load(open(CREDITS, encoding='utf-8')) if os.path.exists(CREDITS) else []
        kept = [d for d in data if os.path.exists(os.path.join(MEDIA_DIR, d['file']))]
        json.dump(kept, open(CREDITS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'prune: {len(data)} → {len(kept)}', flush=True)
        return 0

    if args.plan:
        plan = json.load(open(args.plan, encoding='utf-8'))
        ok = 0
        for item in plan:
            if fetch_one(item['slug'], item.get('subject', ''), item.get('mood', ''),
                         item.get('video', False), item.get('anchor', ''), not args.no_screen):
                ok += 1
        print(f'done: {ok}/{len(plan)}', flush=True)
        return 0

    if not args.slug:
        ap.error('--slug 필요')
    return 0 if fetch_one(args.slug, args.subject, args.mood, args.video, args.anchor,
                          not args.no_screen) else 1


if __name__ == '__main__':
    sys.exit(main())
