#!/usr/bin/env python3
"""같은 파일을 다른 이름으로 두 번 받은 걸 잡아낸다.

출처가 다르다고 믿고 서로 다른 컷에 배치했는데 **바이트가 같은 파일**이면
화면에는 같은 영상이 두 번 나온다. 실제로 Pexels 검색이 다른 검색어에서
같은 클립을 돌려준 적이 있고, 파일 이름만 다르니 눈으로는 안 잡혔다.

내용 해시로 묶어 첫 이름만 남기고 나머지는 지운다. 어떤 이름이 어떤 이름으로
합쳐졌는지 표로 찍어 주므로 props 를 고칠 때 그대로 보고 쓰면 된다.

    python3 dedupe_assets.py 올리브영성수            # 검사만
    python3 dedupe_assets.py 올리브영성수 --apply    # 실제 삭제
"""
import argparse, hashlib, os, sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'motion', 'public')
MEDIA = ('.mp4', '.webm', '.mov', '.jpg', '.jpeg', '.png')


def sha(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--apply', action='store_true')
    a = ap.parse_args()

    d = os.path.join(PUBLIC, a.project)
    by = defaultdict(list)
    for n in sorted(os.listdir(d)):
        p = os.path.join(d, n)
        if os.path.isfile(p) and n.lower().endswith(MEDIA):
            by[sha(p)].append(n)

    dups = {k: v for k, v in by.items() if len(v) > 1}
    if not dups:
        print(f'중복 없음 — 파일 {sum(len(v) for v in by.values())}개 전부 서로 다르다')
        return 0

    print(f'같은 내용을 가진 묶음 {len(dups)}개')
    removed = 0
    for v in dups.values():
        keep, drop = v[0], v[1:]
        print(f'  남김 {keep}')
        for n in drop:
            print(f'   버림 {n}   → props 에서 {keep} 로 바꿔라')
            if a.apply:
                os.remove(os.path.join(d, n))
                removed += 1
    if a.apply:
        print(f'\n{removed}개 삭제했다.')
    else:
        print('\n검사만 했다. 실제로 지우려면 --apply')
    # 중복이 남아 있으면 실패로 알린다 — 렌더 전에 걸러야 한다
    return 0 if a.apply else 1


if __name__ == '__main__':
    sys.exit(main())
