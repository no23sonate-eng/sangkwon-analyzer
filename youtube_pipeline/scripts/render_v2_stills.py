#!/usr/bin/env python3
"""v2_scenes.json 의 장면들을 Remotion 스틸(PNG)로 일괄 렌더.

사용:
  python3 youtube_pipeline/scripts/render_v2_stills.py <프로젝트명> [--ids 0,1,2]

출력: projects/<프로젝트명>/v2_stills/sec{NN}_{card}.png
리뷰 몽타주(3x3 시트)는 --montage-dir 로 지정한 폴더에 sheet{N}.png 로 저장.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # youtube_pipeline/
MOTION = os.path.join(BASE, 'motion')
CHROME_CANDIDATES = [
    '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
]


def chrome_path():
    for p in CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    return None


def render_scene(scene, out_dir):
    props = dict(scene['props'])
    dur = float(props.get('durationSec', 10))
    # 애니메이션이 정착한 지점 — 카드 길이 안에서 최대 110프레임
    frame = scene.get('frame', min(110, max(40, int(dur * 30) - 15)))
    out = os.path.join(out_dir, f"sec{scene['id']:02d}_{scene['card']}.png")
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(props, f, ensure_ascii=False)
        props_path = f.name
    cmd = [
        'npx', 'remotion', 'still', 'src/index.jsx', scene['card'], out,
        f'--frame={frame}', f'--props={props_path}', '--gl=angle',
    ]
    ch = chrome_path()
    if ch:
        cmd.append(f'--browser-executable={ch}')
    r = subprocess.run(cmd, cwd=MOTION, capture_output=True, text=True)
    os.unlink(props_path)
    if r.returncode != 0:
        print(f"[FAIL] sec{scene['id']}: {r.stderr[-600:]}", flush=True)
        return None
    print(f"[ok] sec{scene['id']:02d} {scene['card']} frame={frame}", flush=True)
    return out


def build_montage(files, montage_dir, cols=3, rows=3, cell_w=640, cell_h=360):
    from PIL import Image, ImageDraw
    os.makedirs(montage_dir, exist_ok=True)
    per = cols * rows
    sheets = []
    for s in range(0, len(files), per):
        chunk = files[s:s + per]
        sheet = Image.new('RGB', (cols * cell_w, rows * cell_h), '#111111')
        draw = ImageDraw.Draw(sheet)
        for i, fp in enumerate(chunk):
            im = Image.open(fp).resize((cell_w, cell_h))
            x, y = (i % cols) * cell_w, (i // cols) * cell_h
            sheet.paste(im, (x, y))
            label = os.path.basename(fp).split('_')[0]  # secNN
            # 라벨은 좌하단 — 카드 킥커(좌상단)를 가리지 않게
            draw.rectangle([x + 8, y + cell_h - 40, x + 96, y + cell_h - 8], fill='#000000')
            draw.text((x + 18, y + cell_h - 34), f'#{int(label[3:])}', fill='#FAFF2E')
        out = os.path.join(montage_dir, f'sheet{s // per + 1}.png')
        sheet.save(out)
        sheets.append(out)
        print(f'[sheet] {out}', flush=True)
    return sheets


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--ids', default='')
    ap.add_argument('--montage-dir', default='')
    args = ap.parse_args()

    proj_dir = os.path.join(BASE, 'projects', args.project)
    scenes = json.load(open(os.path.join(proj_dir, 'v2_scenes.json'), encoding='utf-8'))['scenes']
    if args.ids:
        want = {int(x) for x in args.ids.split(',')}
        scenes = [s for s in scenes if s['id'] in want]
    # use_v7 장면(실사/뉴스)은 v7 클립을 그대로 쓰므로 렌더 제외
    skipped = [s['id'] for s in scenes if s.get('use_v7')]
    if skipped:
        print(f"skip (v7 유지): {skipped}", flush=True)
    scenes = [s for s in scenes if not s.get('use_v7')]

    out_dir = os.path.join(proj_dir, 'v2_stills')
    os.makedirs(out_dir, exist_ok=True)

    rendered = []
    for sc in scenes:
        out = render_scene(sc, out_dir)
        if out:
            rendered.append(out)

    print(f'done: {len(rendered)}/{len(scenes)}', flush=True)
    if args.montage_dir:
        # 몽타주는 이번에 렌더한 것만이 아니라 폴더의 전체 스틸 기준
        import glob
        all_stills = sorted(glob.glob(os.path.join(out_dir, 'sec*.png')))
        build_montage(all_stills, args.montage_dir)


if __name__ == '__main__':
    sys.exit(main())
