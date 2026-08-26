#!/usr/bin/env python3
"""영상 소재를 **다시 받아 온다.**

`.gitignore` 가 `motion/public/*/*.mp4` 를 막는다 — 옳은 결정이다. 클립 하나가
수십 MB라 저장소가 금방 못 쓰게 된다. 대신 이 컨테이너는 파일시스템이
스냅샷으로 되돌아가고, 그때 커밋 안 된 영상은 통째로 사라진다.
사라지면 렌더가 통째로 멈춘다 (`<OffthreadVideo src>` 404).

그래서 **영상 자체 대신 받아오는 방법을 커밋한다.** 프로젝트 폴더의
`VIDEOS.tsv` 에 파일명·출처·ID·길이가 있고, 여기서 그대로 다시 만든다.

    python3 scripts/fetch_videos.py 더그랜드롯데          # 없는 것만
    python3 scripts/fetch_videos.py 더그랜드롯데 --force  # 전부 다시

Pexels 는 API 키 없이 `www.pexels.com/download/video/{id}/` 가 열린다.
검색은 키가 있어야 하지만 **받는 건 열려 있다** — ID 만 적어 두면 된다.
"""
import argparse
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'motion' / 'public'

SRC = {
    # 출처: (내려받기 주소 틀)
    'pexels': 'https://www.pexels.com/download/video/{id}/',
    'mixkit': 'https://assets.mixkit.co/videos/{id}/{id}-720.mp4',
}


def fetch(url, out):
    r = subprocess.run(['curl', '-sL', '--max-time', '180', '-o', str(out), url])
    return r.returncode == 0 and out.exists() and out.stat().st_size > 100_000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()

    pdir = PUBLIC / a.project
    tsv = pdir / 'VIDEOS.tsv'
    if not tsv.exists():
        raise SystemExit(f'{tsv} 가 없다 — 영상 소재를 쓰는 편이면 이 파일이 있어야 한다')

    tmp = pdir / '_dl.bin'
    tmp.unlink(missing_ok=True)      # 지난번에 끊겨 남은 게 있으면 먼저 치운다
    got = miss = skip = 0
    for line in tsv.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        name, src, vid, secs = (line.split('\t') + ['', '', ''])[:4]
        out = pdir / name
        if out.exists() and not a.force:
            skip += 1
            continue
        if src not in SRC:
            print(f'  ? {name} — 모르는 출처 {src}')
            miss += 1
            continue
        if not fetch(SRC[src].format(id=vid), tmp):
            print(f'  ✗ {name} — 못 받았다 ({src} {vid})')
            miss += 1
            continue
        # 4K 원본을 그대로 두면 한 편에 수백 MB다. 1920 렌더에 쓸 이유가 없다
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(tmp),
                        '-t', secs or '10', '-vf', "scale='min(1920,iw)':-2",
                        '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
                        '-pix_fmt', 'yuv420p', '-an', str(out)], check=True)
        print(f'  ✓ {name}  {out.stat().st_size / 1e6:.1f}MB')
        got += 1
    tmp.unlink(missing_ok=True)
    print(f'받음 {got} · 이미 있음 {skip} · 실패 {miss}')
    sys.exit(1 if miss else 0)


if __name__ == '__main__':
    main()
