#!/usr/bin/env python3
"""파이프라인을 **혼자 서는 폴더**로 떼어낸다 — 다른 에이전트에게 넘기려고.

왜 필요했나
  이 파이프라인은 `sangkwon-analyzer` 안에 세 들어 산다. 상권분석기의
  CLAUDE.md·메모리·마이그레이션과 한 저장소를 쓴다. 영상 작업만 떼어
  코덱스 같은 다른 도구에 맡기려면 **그 맥락 없이도 읽히는 폴더**여야 한다.

무엇이 들어가나
  scripts/ · motion/src/ · motion/public/fonts/    코드와 폰트 (필수)
  projects/<프로젝트>/*.json·*.md                   설계 원본
  AGENTS.md                                         에이전트가 먼저 읽을 규칙
  docs/                                             카드 고르기·규칙과 함정

무엇이 안 들어가나 — **일부러**
  motion/public/<프로젝트>/  소재 사진 188MB. 저작권 출처가 제각각이라
                             통째로 재배포할 물건이 아니다. bin/자료받기.sh
                             가 공식 사이트에서 다시 받는다
  clips/ stills/             렌더 결과 1GB. design.json 에서 다시 나온다
  node_modules/              npm install 로 나온다

    python3 scripts/pack_standalone.py --project 니시아자부
    python3 scripts/pack_standalone.py --project 니시아자부 --no-zip   # 폴더만
"""
import argparse
import os
import pathlib
import shutil
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = ROOT.parent

# 스킬의 references — 카드 고르는 법이 여기 있다. 이게 없으면 넘겨받은 쪽이
# 카드 88개를 이름만 보고 골라야 한다
SKILL = REPO / '.claude' / 'skills' / 'video-graphics'


def copy_tree(src, dst, skip=()):
    if not src.exists():
        return 0
    n = 0
    for p in src.rglob('*'):
        if p.is_dir() or any(s in p.parts for s in skip):
            continue
        if p.name in ('.DS_Store',) or p.suffix == '.pyc':
            continue
        out = dst / p.relative_to(src)
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, out)
        n += 1
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--project', default='니시아자부',
                    help='설계 원본을 함께 넣을 프로젝트')
    ap.add_argument('--name', default='Youtube_Graphics_Pipeline')
    ap.add_argument('--no-zip', action='store_true')
    a = ap.parse_args()

    stage = ROOT / '_standalone' / a.name
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)

    counts = {}
    counts['scripts'] = copy_tree(ROOT / 'scripts', stage / 'scripts',
                                  skip=('__pycache__',))
    counts['motion/src'] = copy_tree(ROOT / 'motion' / 'src', stage / 'motion' / 'src')
    counts['fonts'] = copy_tree(ROOT / 'motion' / 'public' / 'fonts',
                                stage / 'motion' / 'public' / 'fonts')

    # 설계 원본만. 렌더 결과와 소재는 두고 간다
    pdir = ROOT / 'projects' / a.project
    dest = stage / 'projects' / a.project
    dest.mkdir(parents=True, exist_ok=True)
    keep = 0
    for f in sorted(pdir.glob('*')):
        if f.is_file() and f.suffix in ('.json', '.md', '.xml'):
            shutil.copy2(f, dest / f.name)
            keep += 1
    counts[f'projects/{a.project}'] = keep

    for f in ('package.json', 'remotion.config.ts', 'remotion.config.js'):
        src = ROOT / 'motion' / f
        if src.exists():
            shutil.copy2(src, stage / 'motion' / f)
    for f in ('requirements.txt',):
        if (ROOT / f).exists():
            shutil.copy2(ROOT / f, stage / f)

    counts['docs'] = copy_tree(SKILL / 'references', stage / 'docs')
    if (SKILL / 'SKILL.md').exists():
        shutil.copy2(SKILL / 'SKILL.md', stage / 'docs' / '영상-그래픽-설계.md')

    # 넘겨받는 쪽이 제일 먼저 읽을 것
    shutil.copy2(ROOT / 'AGENTS.md', stage / 'AGENTS.md')
    # standalone/ 의 내용물을 폴더 뿌리에 그대로 얹는다 (README·bin 등)
    counts['overlay'] = copy_tree(ROOT / 'standalone', stage)
    for sh in (stage / 'bin').glob('*.sh'):
        os.chmod(sh, 0o755)

    (stage / 'motion' / 'public' / a.project).mkdir(parents=True, exist_ok=True)
    (stage / 'motion' / 'public' / a.project / '.gitkeep').write_text(
        '소재 사진은 여기 들어간다. bin/자료받기.sh 를 돌려라.\n', encoding='utf-8')

    print(f'{stage}')
    for k, v in counts.items():
        print(f'  {k:28s} {v:4d}개')
    total = sum(f.stat().st_size for f in stage.rglob('*') if f.is_file())
    print(f'  합계 {total / 1024 / 1024:.1f}MB')

    if a.no_zip:
        return 0

    out = ROOT / '_standalone' / f'{a.name}.zip'
    # 한글 경로가 들어간다(projects/니시아자부). zipfile 은 ASCII 가 아닌
    # 이름에 UTF-8 플래그(bit 11)를 세운다 — 맥 Archive Utility 가 이걸 읽는다.
    # 그래도 이름이 깨져 보이면 터미널에서 unzip 하면 된다
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for f in sorted(stage.rglob('*')):
            if f.is_file():
                zf.write(f, str(pathlib.Path(a.name) / f.relative_to(stage)))
    print(f'\n{out}  {out.stat().st_size / 1024 / 1024:.1f}MB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
