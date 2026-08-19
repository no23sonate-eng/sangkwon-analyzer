#!/usr/bin/env python3
"""완성본(scene_props.json) 전체 컷을 스틸로 뽑고 컨택트 시트를 만든다.

편집 레인의 `MotionWrap` 컴포지션을 그대로 쓴다 — 카드 코드를 건드리지 않고
"지금 화면이 어떻게 생겼나"를 전수로 본다. 디자인 개선 전/후 비교의 기준선.

사용:
  python3 youtube_pipeline/scripts/render_cuts_stills.py 올리브영성수
  python3 youtube_pipeline/scripts/render_cuts_stills.py 올리브영성수 --out-name after
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
if not os.path.exists(CHROME):
    CHROME = '/opt/pw-browsers/chromium/chrome-linux/chrome'

try:
    from PIL import Image, ImageDraw
except ImportError:
    Image = None


def render(cut, out_path, frame, upgrade=''):
    props = {'card': cut.get('card', ''), 'props': cut.get('props', {}),
             'motion': cut.get('motion', {}) or {},
             'durationSec': float(cut.get('durationSec') or 5),
             'upgrade': upgrade}
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(props, f, ensure_ascii=False)
        p = f.name
    cmd = ['npx', 'remotion', 'still', 'src/index.jsx', 'MotionWrap', out_path,
           f'--frame={frame}', f'--props={p}', '--gl=angle']
    if os.path.exists(CHROME):
        cmd.append(f'--browser-executable={CHROME}')
    r = subprocess.run(cmd, cwd=MOTION, capture_output=True, text=True, timeout=600)
    os.unlink(p)
    return r.returncode == 0 and os.path.exists(out_path), r.stderr[-200:]


def sheets(out_dir, tag, cols=5, rows=5, tw=384, th=216):
    if Image is None:
        return []
    names = sorted(n for n in os.listdir(out_dir) if n.endswith('.png'))
    made = []
    per = cols * rows
    for i in range(0, len(names), per):
        chunk = names[i:i + per]
        sh = Image.new('RGB', (cols * tw, rows * (th + 22)), '#0E1114')
        dr = ImageDraw.Draw(sh)
        for j, n in enumerate(chunk):
            im = Image.open(os.path.join(out_dir, n)).convert('RGB').resize((tw, th))
            x, y = (j % cols) * tw, (j // cols) * (th + 22)
            sh.paste(im, (x, y))
            dr.text((x + 5, y + th + 5), n[:-4][:44], fill='#FAFF2E')
        path = os.path.join(out_dir, f'_{tag}_sheet{i // per + 1}.jpg')
        sh.save(path, quality=86)
        made.append(path)
    print('sheets: ' + ', '.join(os.path.basename(m) for m in made), flush=True)
    return made


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--out-name', default='before', help='출력 폴더 이름 (before/after)')
    ap.add_argument('--frame', type=int, default=70, help='뽑을 프레임 (등장 이후)')
    ap.add_argument('--only', default='', help='컷 id 쉼표 목록')
    ap.add_argument('--upgrade', default='', help="개선 레이어: G(실사등급) T(타이포) S(출처) Y(옐로) 또는 all")
    ap.add_argument('--sheets-only', action='store_true')
    args = ap.parse_args()

    proj = os.path.join(BASE, 'projects', args.project)
    data = json.load(open(os.path.join(proj, 'scene_props.json'), encoding='utf-8'))
    scenes = data['scenes']
    out_dir = os.path.join(proj, f'cuts_{args.out_name}')
    os.makedirs(out_dir, exist_ok=True)

    if args.sheets_only:
        sheets(out_dir, args.out_name)
        return 0

    want = {x.strip() for x in args.only.split(',') if x.strip()} if args.only else None
    ok = 0
    keys = sorted(scenes.keys(), key=lambda k: int(k))
    for k in keys:
        if want is not None and k not in want:
            continue
        cut = scenes[k]
        name = cut.get('card', '?')
        out = os.path.join(out_dir, f'cut{int(k):03d}_{name}.png')
        good, err = render(cut, out, args.frame, args.upgrade)
        ok += 1 if good else 0
        if not good:
            print(f'[FAIL] cut{int(k):03d} {name} :: {err}', flush=True)
    print(f'stills: {ok}/{len(keys) if want is None else len(want)}', flush=True)
    sheets(out_dir, args.out_name)
    return 0


if __name__ == '__main__':
    sys.exit(main())
