#!/usr/bin/env python3
"""유튜브 영상의 스토리보드(프레임 타일)를 받아 분석용 프레임 시트로 만든다.

YouTube 는 각 영상의 타임라인 미리보기용으로 프레임을 격자 이미지(storyboard)로
제공한다. 영상 다운로드가 막힌 환경에서도 이건 받을 수 있어서, 실제 화면을
프레임 단위로 볼 수 있다. (이 프로젝트가 과거 디자인 분석에 쓰던 방식과 동일)

사용: python3 grab_frames.py <video_id> <out_prefix> [--tiles N]
"""
import io
import json
import subprocess
import sys
import time
import urllib.request

from PIL import Image

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'


def _probe(vid, fmt, tries=4):
    """유튜브가 간헐적으로 429/봇확인을 던지므로 지수 백오프로 재시도."""
    for attempt in range(tries):
        cmd = ['yt-dlp', '--extractor-args', 'youtube:player_client=mweb',
               '--sleep-requests', '1', '-f', fmt, '-J', '--skip-download',
               f'https://www.youtube.com/watch?v={vid}']
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
        if r.returncode == 0 and r.stdout.strip():
            try:
                d = json.loads(r.stdout)
            except json.JSONDecodeError:
                d = None
            if d and d.get('fragments'):
                return d
        time.sleep(4 * (attempt + 1))
    return None


def storyboard_spec(vid):
    """가장 해상도 높은 스토리보드 포맷의 조각 URL 목록을 돌려준다."""
    best = None
    for fmt in ('sb0',):
        d = _probe(vid, fmt)
        if not d:
            continue
        area = (d.get('width') or 0) * (d.get('height') or 0)
        if best is None or area > best['area']:
            best = {'area': area, 'meta': d}
        if best and best['area'] >= 320 * 180:
            break  # 충분히 큰 타일이면 더 안 찾는다
    return best['meta'] if best else None


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def grab(vid, out_prefix, want_tiles=24, cols=6):
    meta = storyboard_spec(vid)
    if not meta:
        print(f'[skip] {vid}: 스토리보드 없음', flush=True)
        return None
    tw, th = meta['width'], meta['height']
    rows, columns = meta.get('rows', 5), meta.get('columns', 5)
    frags = meta['fragments']
    title = meta.get('title', '')
    dur = meta.get('duration', 0)

    # 모든 조각에서 개별 프레임 타일을 뽑아낸다
    tiles = []
    for fr in frags:
        try:
            raw = fetch(fr['url'])
        except Exception as e:  # noqa: BLE001
            print(f'  frag fail: {e}', flush=True)
            continue
        sheet = Image.open(io.BytesIO(raw)).convert('RGB')
        for r in range(rows):
            for c in range(columns):
                box = (c * tw, r * th, (c + 1) * tw, (r + 1) * th)
                if box[2] <= sheet.width and box[3] <= sheet.height:
                    tiles.append(sheet.crop(box))
    if not tiles:
        print(f'[skip] {vid}: 타일 0', flush=True)
        return None

    # 영상 전체에 고르게 분포하도록 샘플링 (앞뒤 인트로/아웃트로 제외)
    lo, hi = int(len(tiles) * 0.04), int(len(tiles) * 0.97)
    pool = tiles[lo:hi] or tiles
    step = max(1, len(pool) // want_tiles)
    picked = pool[::step][:want_tiles]

    # 확대해서 붙인 컨택트 시트 (타일이 작아 3배 업스케일)
    UP = 3
    w, h = tw * UP, th * UP
    rows_n = (len(picked) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * w, rows_n * h), '#000000')
    for i, t in enumerate(picked):
        sheet.paste(t.resize((w, h), Image.LANCZOS), ((i % cols) * w, (i // cols) * h))
    out = f'{out_prefix}.png'
    sheet.save(out)
    print(f'[ok] {vid} | {title[:50]} | {dur}s | tiles={len(tiles)} → {out} ({sheet.width}x{sheet.height})', flush=True)
    return out


if __name__ == '__main__':
    vid, prefix = sys.argv[1], sys.argv[2]
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 24
    grab(vid, prefix, want_tiles=n)
