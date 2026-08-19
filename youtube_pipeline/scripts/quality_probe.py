#!/usr/bin/env python3
"""B1M 품질 격차 측정기 — "감으로 비슷하다"를 "수치로 얼마나 다르다"로 바꾼다.

B1M 본편 프레임(reference/channel_study/video_b1m_*.jpg 컨택트 시트)과
우리가 렌더한 카드를 **같은 지표**로 재고, 표면(지면/실사)을 분류해
같은 것끼리만 비교한다. B1M 분포(중앙값 ± IQR)를 벗어난 카드를 지목한다.

지표:
  lum      휘도 평균 (0~255)          — 지면이 충분히 밝은가
  lum_rng  휘도 p95 - p05             — 계조가 죽지 않았는가
  sat      채도 평균 (0~1)            — B1M 은 매우 낮다. 형광이 있으면 튄다
  sat_p99  채도 상위 1%               — 강조색이 과한가
  edge     엣지 밀도 (0~1)            — 화면이 너무 비었나/복잡한가
  ink      배경보다 어두운 픽셀 비율   — 지면 카드의 "그린 양"

사용:
  python3 youtube_pipeline/scripts/quality_probe.py                # 카탈로그 전체
  python3 youtube_pipeline/scripts/quality_probe.py --dir <경로>   # 다른 렌더 묶음
  python3 youtube_pipeline/scripts/quality_probe.py --ref-only     # B1M 기준만 출력
"""
import argparse
import glob
import json
import os
import sys

import numpy as np
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_DIR = os.path.join(BASE, 'reference', 'channel_study')
CAT_DIR = os.path.join(BASE, 'reference', 'device_catalog')
NFRAMES = 18  # 시트 한 장에 담긴 프레임 수


def guess_grid(W, H, n=NFRAMES):
    """시트마다 격자가 달라서(3x6, 6x3 …) 16:9 타일이 되는 배치를 찾는다."""
    best, err = (3, 6), 1e9
    for cols in range(1, n + 1):
        if n % cols:
            continue
        rows = n // cols
        e = abs((W / cols) / (H / rows) - 16 / 9)
        if e < err:
            best, err = (cols, rows), e
    return best


def tiles_from_sheet(path):
    """컨택트 시트를 프레임 낱장으로 자른다."""
    im = Image.open(path).convert('RGB')
    W, H = im.size
    cols, rows = guess_grid(W, H)
    tw, th = W / cols, H / rows
    out = []
    for r in range(rows):
        for c in range(cols):
            box = (round(c * tw), round(r * th), round((c + 1) * tw), round((r + 1) * th))
            t = im.crop(box)
            # 시트 합성 시 생긴 테두리를 살짝 잘라낸다
            w, h = t.size
            t = t.crop((4, 4, w - 4, h - 4))
            out.append(t)
    return out


def metrics(im):
    """한 프레임의 지표. 크기는 통일해서 엣지 밀도가 해상도에 안 휘둘리게."""
    im = im.convert('RGB').resize((448, 252))
    a = np.asarray(im).astype(np.float32) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0.0)

    gx = np.abs(np.diff(lum, axis=1))
    gy = np.abs(np.diff(lum, axis=0))
    edge = float(((gx > 0.06).mean() + (gy > 0.06).mean()) / 2)

    # 배경 = 가장 흔한 휘도 구간. 그보다 확실히 어두운 픽셀을 "잉크"로 본다
    hist, edges = np.histogram(lum, bins=32, range=(0, 1))
    bg = (edges[hist.argmax()] + edges[hist.argmax() + 1]) / 2
    ink = float((lum < bg - 0.12).mean())
    # 배경과 사실상 같은 픽셀의 비율 — 지면은 "빈 여백"이 넓다
    flat = float(((np.abs(lum - bg) < 0.05) & (sat < 0.12)).mean())

    return {
        'lum': float(lum.mean() * 255),
        'lum_rng': float((np.percentile(lum, 95) - np.percentile(lum, 5)) * 255),
        'sat': float(sat.mean()),
        'sat_p99': float(np.percentile(sat, 99)),
        'edge': edge,
        'ink': ink,
        'bg': float(bg * 255),
        'flat': flat,
    }


def surface(m):
    """지면(PAPER) / 실사(FOOTAGE) 분류 — 같은 것끼리만 비교하기 위해.

    밝기만 보면 하늘이 큰 실사가 "지면"으로 새어 들어와 기준이 오염된다.
    (실제로 멜버른 스카이라인 프레임이 지면으로 잡혔다.)
    그래서 배경과 같은 색으로 **평평한 면적**(flat)을 함께 본다.
    """
    if m['bg'] > 190 and m['flat'] > 0.30 and m['sat'] < 0.22 and m['edge'] < 0.09:
        return 'paper'
    return 'footage'


KEYS = ['lum', 'lum_rng', 'sat', 'sat_p99', 'edge', 'ink']
FMT = {'lum': '{:.0f}', 'lum_rng': '{:.0f}', 'sat': '{:.3f}',
       'sat_p99': '{:.3f}', 'edge': '{:.3f}', 'ink': '{:.3f}'}


def band(rows, key):
    """B1M 분포의 중앙 50% 구간 (p25~p75) 과 중앙값."""
    v = np.array([r[key] for r in rows])
    return float(np.percentile(v, 25)), float(np.median(v)), float(np.percentile(v, 75))


def build_reference():
    ref = {'paper': [], 'footage': []}
    sheets = sorted(glob.glob(os.path.join(REF_DIR, 'video_b1m_*.jpg'))
                    + glob.glob(os.path.join(REF_DIR, 'video_b1m_*.png')))
    for sheet in sheets:
        for t in tiles_from_sheet(sheet):
            m = metrics(t)
            ref[surface(m)].append(m)
    return ref


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default=CAT_DIR)
    ap.add_argument('--ref-only', action='store_true')
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args()

    ref = build_reference()
    bands = {s: {k: band(rows, k) for k in KEYS} for s, rows in ref.items() if rows}

    print(f"== B1M 기준 (본편 프레임 {len(ref['paper'])} 지면 / {len(ref['footage'])} 실사) ==")
    for s in ('paper', 'footage'):
        if s not in bands:
            continue
        cells = [f"{k} {FMT[k].format(bands[s][k][1])} [{FMT[k].format(bands[s][k][0])}~{FMT[k].format(bands[s][k][2])}]" for k in KEYS]
        print(f'  {s:8} ' + ' · '.join(cells))
    if args.ref_only:
        return 0

    files = sorted(f for f in glob.glob(os.path.join(args.dir, '*.png')))
    if not files:
        print(f'렌더 없음: {args.dir}')
        return 1

    print(f'\n== 우리 렌더 {len(files)}장 — B1M 중앙 50% 구간을 벗어난 항목 ==')
    report = []
    for f in files:
        m = metrics(Image.open(f))
        s = surface(m)
        if s not in bands:
            continue
        outs = []
        for k in KEYS:
            lo, mid, hi = bands[s][k]
            if m[k] < lo or m[k] > hi:
                d = '↓' if m[k] < lo else '↑'
                outs.append(f'{k}{d} {FMT[k].format(m[k])} (B1M {FMT[k].format(lo)}~{FMT[k].format(hi)})')
        name = os.path.basename(f)[:-4]
        report.append({'card': name, 'surface': s, 'metrics': m, 'out': outs})
        if outs:
            print(f'  {name:24} [{s}] ' + ' | '.join(outs))
    clean = [r for r in report if not r['out']]
    print(f'\n기준 안: {len(clean)}/{len(report)}')
    for r in sorted(report, key=lambda r: -len(r['out']))[:3]:
        if r['out']:
            print(f"  가장 먼 카드: {r['card']} ({len(r['out'])}개 지표 이탈)")
            break

    if args.json:
        out = os.path.join(args.dir, '_quality.json')
        json.dump({'bands': bands, 'report': report}, open(out, 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
        print(f'→ {out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
