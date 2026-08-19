#!/usr/bin/env python3
"""장면 JSON → 실제 영상 클립(mp4). 스틸 검수의 마지막 단계.

지금까지는 정지 프레임과 필름스트립으로만 봤다. 편집은 프리미어에서 하시므로
**한 덩어리 영상보다 장면별 클립이 낫다** — 순서 바꾸기·빼기가 쉽다.

사용: python3 youtube_pipeline/scripts/render_v2_clips.py <프로젝트명> [--only 0,3,7]
출력: projects/<프로젝트>/clips/secNN_<카드명>.mp4
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOTION = os.path.join(BASE, 'motion')
CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'


def render(name, props, out_path):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(props, f, ensure_ascii=False)
        p = f.name
    cmd = ['npx', 'remotion', 'render', 'src/index.jsx', name, out_path,
           f'--props={p}', '--gl=angle', '--codec=h264', '--crf=18',
           '--concurrency=2']
    if os.path.exists(CHROME):
        cmd.append(f'--browser-executable={CHROME}')
    r = subprocess.run(cmd, cwd=MOTION, capture_output=True, text=True, timeout=2400)
    os.unlink(p)
    ok = r.returncode == 0 and os.path.exists(out_path)
    if not ok:
        print(f'  stderr: {r.stderr[-400:]}', flush=True)
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--only', default='', help='장면 id 쉼표 목록')
    args = ap.parse_args()

    path = os.path.join(BASE, 'projects', args.project, 'v2_scenes.json')
    scenes = json.load(open(path, encoding='utf-8'))['scenes']
    out_dir = os.path.join(BASE, 'projects', args.project, 'clips')
    os.makedirs(out_dir, exist_ok=True)

    want = {int(x) for x in args.only.split(',') if x.strip()} if args.only else None
    made = 0
    for s in scenes:
        if want is not None and s['id'] not in want:
            continue
        if s.get('use_v7'):
            continue
        name = s['card']
        out = os.path.join(out_dir, f"sec{s['id']:02d}_{name}.mp4")
        ok = render(name, s.get('props', {}), out)
        made += 1 if ok else 0
        dur = s.get('props', {}).get('durationSec', '?')
        mot = s.get('props', {}).get('motion', 'accent')
        print(f'{"[ok]" if ok else "[FAIL]"} sec{s["id"]:02d} {name:22} {dur}s  motion={mot}', flush=True)
    print(f'clips: {made}', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
