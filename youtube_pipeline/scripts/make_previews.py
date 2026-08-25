#!/usr/bin/env python3
"""클립 → 검수용 미리보기 영상.

**스틸로는 모션을 못 본다.** 카드가 어떤 순서로 들어오는지, 형광펜이 언제
그어지는지, 숫자가 굴러 올라가는지는 정지 화면에 안 나온다. 그런데 원본
클립은 한 편에 200MB 라 아티팩트(16MB)에 못 넣는다.

다행히 이 채널 화면은 **크림 종이에 먹과 노랑**이라 압축이 아주 잘 먹는다.
1920 원본 1.2MB 짜리가 768px crf30 에서 49KB 로 떨어진다. 사진을 꽉 채운
컷도 200KB 를 잘 안 넘는다. 182컷을 다 넣어도 10MB 안쪽이다.

    python3 scripts/make_previews.py 더그랜드롯데          # 새로 생긴 것만
    python3 scripts/make_previews.py 더그랜드롯데 --force

이미 만든 건 건너뛴다. 렌더가 도는 중에 반복해서 돌려도 된다 —
그래야 롤백이 나도 여기까지는 남는다 (미리보기는 커밋되므로).
"""
import argparse
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
W, CRF = 768, 30


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--width', type=int, default=W)
    ap.add_argument('--crf', type=int, default=CRF)
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    src = pdir / 'clips'
    out = pdir / '검수영상'
    if not src.exists():
        raise SystemExit(f'{src} 가 없다 — 먼저 클립을 렌더할 것')
    out.mkdir(exist_ok=True)

    made = skipped = 0
    for f in sorted(src.glob('*.mp4')):
        dst = out / f.name
        # 원본이 더 새로우면 다시 만든다 — 컷을 고치고 다시 렌더한 경우
        if dst.exists() and not a.force and dst.stat().st_mtime >= f.stat().st_mtime:
            skipped += 1
            continue
        r = subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-i', str(f),
             # 높이는 2로 나눠떨어져야 한다 — libx264 가 홀수 높이를 거부한다
             '-vf', f'scale={a.width}:-2',
             '-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf),
             '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', str(dst)],
            capture_output=True, text=True)
        if r.returncode != 0:
            print(f'  ✗ {f.name}\n{r.stderr[-300:]}')
            continue
        made += 1

    total = sum(p.stat().st_size for p in out.glob('*.mp4'))
    n = len(list(out.glob('*.mp4')))
    print(f'만듦 {made} · 이미 있음 {skipped} · 합계 {n}개 {total / 1e6:.1f}MB'
          f' (컷당 평균 {total / max(1, n) / 1e3:.0f}KB)')
    if total > 13e6:
        print('  ⚠ 13MB 를 넘었다 — 아티팩트 상한 16MB 에 HTML 몫이 안 남는다.'
              f' --width {a.width - 128} --crf {a.crf + 2} 로 다시 만들 것')
        sys.exit(1)


if __name__ == '__main__':
    main()
