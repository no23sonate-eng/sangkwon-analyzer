#!/usr/bin/env python3
"""Pexels 사진·영상 받기 — **ID 를 알면** CDN 에서 바로 받아진다.

이 환경에서 Pexels 는 반쯤만 막혀 있다 (실측):
  - `www.pexels.com` 검색 페이지 → **403**
  - `api.pexels.com` → **401** (차단이 아니라 API 키가 없어서)
  - `images.pexels.com` / `videos.pexels.com` → **200** ✅

즉 **검색만 막혀 있고 다운로드는 열려 있다.** 그래서 ID 를 밖에서 구해 오면 된다 —
웹검색으로 `pexels.com/photo/...-{id}` 주소를 찾아 숫자만 뽑아 여기에 넘긴다.

    python3 fetch_pexels.py 프로젝트 --photo 28494398 seoul_street.jpg
    python3 fetch_pexels.py 프로젝트 --video 3571264 bl_city.mp4

라이선스: Pexels License — 상업 이용 가능, 출처 표기 **의무 아님**.
다만 이 채널은 어디서 왔는지 밝히는 쪽을 택하므로 CREDITS 에는 남긴다.
"""
import argparse, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'motion', 'public')
UA = {'User-Agent': 'Mozilla/5.0'}

IMG = ('https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg'
       '?auto=compress&cs=tinysrgb&w=1920')
# 영상 파일명 규격이 **클립마다 다르다** — 해상도·fps·등급이 제각각이라
# 고정 목록으로는 절반이 실패한다. 가로형 조합을 넓게 훑는다.
# 세로형(1080x1920 등)은 **일부러 뺀다** — 16:9 타임라인에 넣으면 양옆이 비고,
# 잘라 쓰면 화면이 뭉개진다 (실제로 세로 클립이 하나 잡혀 걸렀다).
def vid_urls(vid):
    out = []
    for w, h in [(1920, 1080), (2560, 1440), (3840, 2160),
                 (1280, 720), (960, 540), (640, 360)]:
        for kind in ('hd', 'uhd', 'sd'):
            for fps in (30, 25, 24, 60, 50):
                out.append('https://videos.pexels.com/video-files/'
                           f'{vid}/{vid}-{kind}_{w}_{h}_{fps}fps.mp4')
    return out


def grab(url, out):
    req = urllib.request.Request(url, headers=UA)
    data = urllib.request.urlopen(req, timeout=90).read()
    # 에러 페이지가 이미지 확장자로 저장되는 사고를 여기서 막는다 (§38-3 계열)
    if len(data) < 20000:
        raise RuntimeError(f'너무 작다({len(data)}B) — 에러 페이지일 것')
    open(out, 'wb').write(data)
    return len(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--photo', nargs=2, action='append', default=[], metavar=('ID', 'NAME'))
    ap.add_argument('--video', nargs=2, action='append', default=[], metavar=('ID', 'NAME'))
    a = ap.parse_args()

    outdir = os.path.join(PUBLIC, a.project)
    os.makedirs(outdir, exist_ok=True)
    lines, ok, fail = [], 0, 0

    for pid, name in a.photo:
        out = os.path.join(outdir, name)
        try:
            n = grab(IMG.format(id=pid), out)
            print(f'ok  {name:28s} {n // 1024:5d}KB  photo/{pid}')
            lines.append(f'| `{name}` | Pexels photo {pid} | Pexels License | (표기 의무 없음) |')
            ok += 1
        except Exception as e:
            print(f'FAIL {name:27s} photo/{pid} — {e}')
            if os.path.exists(out):
                os.remove(out)
            fail += 1

    for vid, name in a.video:
        out = os.path.join(outdir, name)
        done = False
        for u in vid_urls(vid):
            try:
                n = grab(u, out)
                print(f'ok  {name:28s} {n // 1024:5d}KB  video/{vid}')
                lines.append(f'| `{name}` | Pexels video {vid} | Pexels License | (표기 의무 없음) |')
                ok += 1
                done = True
                break
            except Exception:
                continue
        if not done:
            print(f'FAIL {name:27s} video/{vid} — 가로형 규격 없음(세로 전용일 수 있다)')
            if os.path.exists(out):
                os.remove(out)
            fail += 1

    if lines:
        cred = os.path.join(outdir, 'CREDITS.md')
        head = ('# 자료 출처\n\n| 파일 | 원본 | 출처 / 라이선스 | 화면 표기 |\n|---|---|---|---|\n')
        if not os.path.exists(cred):
            open(cred, 'w', encoding='utf-8').write(head)
        with open(cred, 'a', encoding='utf-8') as f:
            f.write('\n'.join(lines) + '\n')

    print(f'\n받음 {ok} · 실패 {fail}')
    if fail:
        sys.exit(1)


if __name__ == '__main__':
    main()
