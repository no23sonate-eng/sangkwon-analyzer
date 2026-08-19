#!/usr/bin/env python3
"""모션 검수 — 정지 프레임이 아니라 시간축에서 카드를 본다.

지금까지 검수는 frame=100 한 장만 봤다. 그래서 "등장이 늦다 / 컷이 끊길 때까지
아직 움직인다 / 순서가 안 읽힌다" 같은 문제를 못 잡았다.

각 카드를 여러 시점에서 렌더해 필름스트립으로 붙이고, 프레임 사이 변화량으로
**언제 화면이 안정되는지(settle)** 를 잰다. 컷 길이의 70% 가 지나도 아직
크게 움직이면 지적한다.

사용: python3 youtube_pipeline/scripts/motion_probe.py [--only 카드명]
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from device_catalog import DEVICES, CHROME, MOTION  # noqa: E402

OUT = os.path.join(BASE, 'reference', 'motion')
FPS = 30


def sample_frames(dur_sec):
    """등장 초반을 촘촘히, 끝을 한 번. 컷이 끊기는 순간이 마지막 표본."""
    last = max(6, round(dur_sec * FPS) - 5)
    pts = [3, 14, 30, 55, last]
    return sorted({min(p, last) for p in pts})


def render(name, props, frame, out_path):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(props, f, ensure_ascii=False)
        p = f.name
    cmd = ['npx', 'remotion', 'still', 'src/index.jsx', name, out_path,
           f'--frame={frame}', f'--props={p}', '--gl=angle']
    if os.path.exists(CHROME):
        cmd.append(f'--browser-executable={CHROME}')
    r = subprocess.run(cmd, cwd=MOTION, capture_output=True, text=True, timeout=600)
    os.unlink(p)
    return r.returncode == 0 and os.path.exists(out_path)


def diff(a, b):
    """두 프레임의 평균 절대 차이 (0~1). 움직임의 양."""
    ia = np.asarray(Image.open(a).convert('L').resize((320, 180))).astype(np.float32) / 255
    ib = np.asarray(Image.open(b).convert('L').resize((320, 180))).astype(np.float32) / 255
    return float(np.abs(ia - ib).mean())


def strip(name, paths, frames, dur):
    tw, th = 384, 216
    sheet = Image.new('RGB', (tw * len(paths), th + 26), '#101214')
    dr = ImageDraw.Draw(sheet)
    for i, (p, fr) in enumerate(zip(paths, frames)):
        sheet.paste(Image.open(p).convert('RGB').resize((tw, th)), (i * tw, 0))
        dr.text((i * tw + 6, th + 6), f'f{fr}  {fr / FPS:.1f}s', fill='#FAFF2E')
    out = os.path.join(OUT, f'{name}_strip.jpg')
    sheet.save(out, quality=88)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--analyze-only', action='store_true',
                    help='이미 뽑아둔 프레임으로 다시 판정만 한다 (렌더 생략)')
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    problems = []
    for name, props in DEVICES:
        if args.only and args.only != name:
            continue
        dur = float(props.get('durationSec') or 8)
        frames = sample_frames(dur)
        paths = []
        for fr in frames:
            p = os.path.join(OUT, f'{name}_f{fr:03d}.png')
            if args.analyze_only:
                if os.path.exists(p):
                    paths.append(p)
            elif render(name, props, fr, p):
                paths.append(p)
        if len(paths) < 3:
            print(f'[FAIL] {name}', flush=True)
            continue
        used = [f for f in frames if os.path.exists(os.path.join(OUT, f'{name}_f{f:03d}.png'))]
        strip(name, paths, used, dur)

        # 마지막 프레임을 "정착 상태"로 보고, 각 표본이 거기서 얼마나 먼지 잰다
        d_to_end = [diff(p, paths[-1]) for p in paths]
        tail = diff(paths[-2], paths[-1])       # 컷 직전까지 남은 움직임
        reveal = d_to_end[0]                    # 첫 프레임 ↔ 완성 상태의 거리 = 등장량
        settle_f = used[-1]
        for f, d in zip(used, d_to_end):
            if d < 0.006:
                settle_f = f
                break
        settle_s = settle_f / FPS
        # 실사·3D 는 켄번스/카메라 회전이 **의도된** 지속 움직임이다.
        # 지면 도해에서 컷 직전까지 움직이면 그건 등장이 안 끝난 것.
        drifting = name.startswith('Footage') or name in (
            'SatelliteRouteCard', 'ArchiveCard', 'SourceClipCard', 'PaperMassingCard')
        tail_limit = 0.045 if drifting else 0.010
        flags = []
        if tail > tail_limit:
            flags.append(f'컷 직전까지 움직임 ({tail:.3f} > {tail_limit})')
            problems.append((name, 'tail', tail))
        # (등장량 reveal 은 지표로 쓰지 않는다 — 카드가 성기면 애니메이션이
        #  충분해도 값이 작게 나온다. 움직임이 아니라 잉크량을 재는 셈이었다)
        if dur - settle_s > 5.0:
            flags.append(f'정착 {settle_s:.1f}s 인데 {dur:.0f}s 를 붙듦 — 컷이 길다')
            problems.append((name, 'hold', dur - settle_s))
        print(f'{name:24} {dur:>4.1f}s  등장 {reveal:.3f}  정착 {settle_s:>4.1f}s  잔여 {tail:.3f}'
              + ('  ← ' + ' / '.join(flags) if flags else ''), flush=True)

    print(f'\n지적 {len(problems)}건')
    for n, kind, v in problems:
        print(f'  {n:24} {kind} {v:.3f}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
