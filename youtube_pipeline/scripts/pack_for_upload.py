#!/usr/bin/env python3
"""보내기용 꾸러미 — **터미널 없이** 받을 수 있게 나눈다.

문제: 클립 182개를 한 덩어리로 묶으면 100MB 가까이 된다. 파일 하나로는
못 보내서 조각을 내야 하는데, 조각을 다시 붙이려면 터미널에서
`cat 조각.0* > 파일.zip` 을 쳐야 한다. 그걸 안 쓰겠다는 게 요구다.

해법: **붙일 필요가 없게 나눈다.** 클립을 clips1 · clips2 … 로 갈라
각각 그 자체로 열리는 zip 으로 만들고, XML 이 갈라진 자리를 그대로
가리키게 한다. 받는 쪽은 zip 을 차례로 두 번 누르고 XML 을 불러오면 끝이다.
합치는 단계가 아예 없다.

받는 쪽이 하는 일:
  1. 파일을 전부 같은 폴더(보통 다운로드)에 내려받는다
  2. clips1.zip … 을 두 번 눌러 푼다 — 폴더가 나란히 생긴다
  3. 프리미어 ▸ File ▸ Import ▸ <프로젝트>.xml

    python3 scripts/pack_for_upload.py 더그랜드롯데
    python3 scripts/pack_for_upload.py 더그랜드롯데 --crf 23 --part-mb 27
"""
import argparse
import json
import os
import pathlib
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent


def mb(n):
    return f'{n / 1024 / 1024:.1f}MB'


def encode(src, dst, crf):
    # 렌더 원본은 CRF 20 이라 보내기엔 무겁다. 다시 눌러 담는다.
    # -an: 무음 트랙을 뺀다. 어차피 소리가 없는데 프라이밍 패딩 때문에
    # 길이만 2프레임 길게 잡혀 오해를 산다
    subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-i', str(src),
         '-c:v', 'libx264', '-crf', str(crf), '-preset', 'veryfast',
         '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', str(dst)],
        check=True)
    return dst.stat().st_size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--crf', type=int, default=23)
    ap.add_argument('--part-mb', type=float, default=27.0,
                    help='조각 하나의 상한. 보내기 한도(약 30MB)보다 낮게 잡는다')
    ap.add_argument('-j', '--jobs', type=int, default=4)
    ap.add_argument('--out', default='/tmp/upload')
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    clipdir = pdir / 'clips'
    srcs = sorted(clipdir.glob('*.mp4'))
    if not srcs:
        sys.exit(f'클립이 없다: {clipdir}')

    out = pathlib.Path(a.out)
    if out.exists():
        shutil.rmtree(out)
    stage = out / 'stage'      # 받는 쪽에서 풀렸을 때의 모양 그대로
    small = out / '_small'
    stage.mkdir(parents=True)
    small.mkdir(parents=True)

    print(f'[1/4] 다시 눌러 담기 (CRF {a.crf}) — {len(srcs)}개')
    with ThreadPoolExecutor(max_workers=a.jobs) as ex:
        sizes = list(ex.map(lambda p: encode(p, small / p.name, a.crf), srcs))
    print(f'  {mb(sum(s.stat().st_size for s in srcs))} → {mb(sum(sizes))}')

    # ── 순서대로 담되, 한도를 넘기 직전에 폴더를 바꾼다 ──────────────────
    # 순서를 지키는 게 중요하다. clips1 이 앞부분, clips2 가 그 다음 —
    # 나중에 파일 하나가 빠졌을 때 어디가 빈지 바로 안다
    cap = a.part_mb * 1024 * 1024
    relmap, bins, cur, curbytes = {}, [], [], 0
    for p, sz in zip(srcs, sizes):
        if cur and curbytes + sz > cap:
            bins.append(cur)
            cur, curbytes = [], 0
        cur.append(p.name)
        curbytes += sz
    if cur:
        bins.append(cur)

    print(f'[2/4] {len(bins)}조각으로 가르기')
    for i, names in enumerate(bins, 1):
        d = stage / f'clips{i}'
        d.mkdir()
        for n in names:
            shutil.move(str(small / n), str(d / n))
            relmap[n[:-4]] = f'clips{i}'
        print(f'  clips{i}  {len(names)}개  {mb(sum(f.stat().st_size for f in d.iterdir()))}')
    shutil.rmtree(small)

    mapf = out / 'relmap.json'
    mapf.write_text(json.dumps(relmap, ensure_ascii=False), encoding='utf-8')

    print('[3/4] XML 다시 쓰기 — 갈라진 자리를 가리키게')
    subprocess.run([sys.executable, str(ROOT / 'scripts' / 'build_premiere.py'),
                    a.project, '--relmap', str(mapf)], check=True, cwd=ROOT)
    pre = pdir / '프리미어'
    for f in (f'{a.project}.xml', '컷목록.csv'):
        shutil.copy(pre / f, stage / f)

    # ── 검사: 받는 쪽에서 풀린 모양 그대로 두고 경로를 다 밟아 본다 ──────
    xmlp = stage / f'{a.project}.xml'
    urls = [e.text for e in ET.parse(xmlp).getroot().iter('pathurl')]
    miss = [u for u in urls if not (stage / u).exists()]
    if miss:
        sys.exit(f'경로가 끊긴 클립 {len(miss)}개: {miss[:3]}')
    print(f'  클립 {len(urls)}개 · 경로가 안 맞는 것 0')

    # check_premiere 는 XML 옆을 기준으로 경로를 푼다. 갈라 놓은 폴더를
    # 프리미어/ 옆에 잠깐 걸어 두면 **보내는 그 파일 그대로** 깊은 검사를
    # 받을 수 있다 — 프레임 수·해상도·독립 판독(OTIO)까지
    links = [pre / f'clips{i}' for i in range(1, len(bins) + 1)]
    for i, ln in enumerate(links, 1):
        if ln.is_symlink() or ln.exists():
            ln.unlink()
        ln.symlink_to((stage / f'clips{i}').resolve(), target_is_directory=True)
    try:
        subprocess.run([sys.executable, str(ROOT / 'scripts' / 'check_premiere.py'),
                        a.project, '--deep'], check=True, cwd=ROOT)
    finally:
        for ln in links:
            ln.unlink(missing_ok=True)

    print('[4/4] 조각 압축 (저장 방식 — mp4 는 더 안 줄어든다)')
    sends = []
    for i in range(1, len(bins) + 1):
        z = out / f'clips{i}.zip'
        subprocess.run(['zip', '-q', '-0', '-r', '-X', str(z), f'clips{i}'],
                       cwd=stage, check=True)
        sends.append(z)
        over = ' ← 한도 넘음!' if z.stat().st_size > 30 * 1024 * 1024 else ''
        print(f'  {z.name}  {mb(z.stat().st_size)}{over}')
    for f in (f'{a.project}.xml', '컷목록.csv'):
        shutil.copy(stage / f, out / f)
        sends.append(out / f)

    print('\n보낼 파일:')
    for s in sends:
        print(f'  {s}  ({mb(s.stat().st_size)})')


if __name__ == '__main__':
    main()
