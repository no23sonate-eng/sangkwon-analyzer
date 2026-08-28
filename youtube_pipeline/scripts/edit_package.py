#!/usr/bin/env python3
"""편집 꾸러미 한 번에 — 소재 받기 → 계획 세우기 → 컷 렌더 → 프리미어 XML.

저장소에는 **결과물이 아니라 만드는 방법**만 들어 있다. mp4 는 gitignore
이고 scene_plan·scene_props 도 파생물이라 커밋하지 않는다. 그래서 로컬에
받아 놓고 편집하려면 매번 네 가지를 순서대로 돌려야 하는데, 그 순서를
외우고 있으라고 할 이유가 없다.

    cd youtube_pipeline
    python3 scripts/edit_package.py 더그랜드롯데

  --skip-video   Pexels 소재를 이미 받아 놓았을 때 (제일 오래 걸린다)
  --skip-render  XML·컷목록만 다시 만들 때
  -j 4           컷을 몇 개씩 나란히 뽑을지. 램이 넉넉하면 올린다

끝나면 `projects/<프로젝트>/프리미어/<프로젝트>.xml` 을 프리미어에서 연다.
"""
import argparse
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
PY = sys.executable


def step(n, total, title):
    print(f'\n[{n}/{total}] {title}', flush=True)


def run(args, label):
    t0 = time.time()
    r = subprocess.run([PY] + args, cwd=ROOT)
    if r.returncode != 0:
        print(f'\n✗ {label} 에서 멈췄다 (exit {r.returncode})', flush=True)
        sys.exit(r.returncode)
    print(f'  ✓ {label} — {time.time() - t0:.0f}초', flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('-j', '--jobs', type=int, default=4)
    ap.add_argument('--skip-video', action='store_true')
    ap.add_argument('--skip-render', action='store_true')
    ap.add_argument('--base', default='', help='클립 폴더 절대경로 (XML 에 그대로 박는다)')
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    if not (pdir / 'design.json').exists():
        sys.exit(f'{pdir}/design.json 이 없다 — 프로젝트 이름을 확인해 달라')

    total = 5 - int(a.skip_video) - int(a.skip_render)
    n = 0

    if not a.skip_video:
        n += 1
        step(n, total, '소재 영상 받기 (VIDEOS.tsv 기준)')
        run(['scripts/fetch_videos.py', a.project], '소재 영상')

    n += 1
    step(n, total, '대본 → 장면 계획 · 설계 반영')
    run(['scripts/plan_from_script.py', str(pdir / 'script.md'),
         '--project', a.project], '장면 계획')
    run(['scripts/apply_design.py', a.project], '설계 반영')

    if not a.skip_render:
        n += 1
        step(n, total, f'컷 렌더 (동시 {a.jobs}개)')
        run(['scripts/render_parkside.py', '--project', a.project,
             '-j', str(a.jobs)], '컷 렌더')

    n += 1
    step(n, total, '프리미어 시퀀스 XML · 컷목록')
    run(['scripts/build_premiere.py', a.project]
        + (['--base', a.base] if a.base else []), '프리미어 꾸러미')

    n += 1
    step(n, total, '프리미어에 올라가는지 검사')
    # 열어 보고 나서 아는 건 늦다. 컷이 빠졌는지, 경로가 맞는지, 길이가
    # 맞는지 여기서 센다
    run(['scripts/check_premiere.py', a.project, '--deep'], '검사')

    clips = sorted((pdir / 'clips').glob('*.mp4'))
    mb = sum(f.stat().st_size for f in clips) / 1024 / 1024
    print(f'\n끝. 클립 {len(clips)}개 · {mb:.0f}MB')
    print(f'프리미어에서 열 파일:\n  {pdir / "프리미어" / (a.project + ".xml")}')


if __name__ == '__main__':
    main()
