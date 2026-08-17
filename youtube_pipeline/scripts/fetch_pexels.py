#!/usr/bin/env python3
"""Pexels 사진·영상 받기 — **ID 를 알면** CDN 에서 바로 받아진다.

이 환경에서 Pexels 는 반쯤만 막혀 있다 (실측):
  - `www.pexels.com` 검색 페이지 → **403**
  - `www.pexels.com/download/video/{id}/` → **302 → CDN 200** ✅ (검색만 막혀 있다)
  - `api.pexels.com` → **401** (차단이 아니라 API 키가 없어서)
  - `images.pexels.com` / `videos.pexels.com` → **200** ✅

즉 **검색만 막혀 있고 다운로드는 열려 있다.** 그래서 ID 를 밖에서 구해 오면 된다 —
웹검색으로 `pexels.com/photo/...-{id}` 주소를 찾아 숫자만 뽑아 여기에 넘긴다.

    python3 fetch_pexels.py 프로젝트 --photo 28494398 seoul_street.jpg
    python3 fetch_pexels.py 프로젝트 --video 3571264 bl_city.mp4

라이선스: Pexels License — 상업 이용 가능, 출처 표기 **의무 아님**.
다만 이 채널은 어디서 왔는지 밝히는 쪽을 택하므로 CREDITS 에는 남긴다.
"""
import argparse, os, re, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'motion', 'public')
UA = {'User-Agent': 'Mozilla/5.0'}

IMG = ('https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg'
       '?auto=compress&cs=tinysrgb&w=1920')
# 영상 파일명 규격이 **클립마다 다르다** — 해상도·fps·등급이 제각각이라
# 조합을 찍어 맞히는 방식은 절반이 실패했다 (16개 중 9개).
#
# 대신 `www.pexels.com/download/video/{id}/` 를 쓴다. 이 주소는 검색 페이지와
# 달리 403 이 아니라 **302 로 CDN 정본을 가리킨다.** 리다이렉트를 따라가면
# 그 클립이 실제로 가진 파일 하나가 그대로 나온다 — 규격을 알 필요가 없다.
DOWNLOAD = 'https://www.pexels.com/download/video/{id}/'

# 세로형(1080x1920 등)은 **일부러 뺀다** — 16:9 타임라인에 넣으면 양옆이 비고,
# 잘라 쓰면 화면이 뭉개진다. 정본 주소에 해상도가 박혀 있으니 거기서 판별한다.
VERT = re.compile(r'_(\d+)_(\d+)_\d+fps')

# 정본은 **원본 해상도 그대로** 온다 — 4K 클립 하나가 536MB 로 떨어진 적이 있다.
# 타임라인은 1080p 이고 b-roll 은 길어야 12초라 그 이상은 디스크만 먹는다.
# 받자마자 1080p·12초로 줄인다. (디스크 할당량이 고정이라 이건 선택이 아니다)
MAXB = 26 * 1024 * 1024
def normalize(path, seconds=12):
    if os.path.getsize(path) <= MAXB:
        return os.path.getsize(path)
    tmp = path + '.tmp.mp4'
    r = subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-t', str(seconds),
         '-vf', "scale='min(1920,iw)':-2", '-c:v', 'libx264', '-crf', '23',
         '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-an', tmp],
        capture_output=True)
    if r.returncode or not os.path.exists(tmp):
        os.path.exists(tmp) and os.remove(tmp)
        return os.path.getsize(path)
    os.replace(tmp, path)
    return os.path.getsize(path)


def is_vertical(url):
    m = VERT.search(url)
    return bool(m) and int(m.group(1)) < int(m.group(2))


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
        try:
            req = urllib.request.Request(DOWNLOAD.format(id=vid), headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                real = r.geturl()
                # 세로 클립은 받기 전에 주소만 보고 거른다 — 다 받고 버리면 시간만 쓴다
                if is_vertical(real):
                    raise RuntimeError(f'세로형이다 ({real.rsplit("-", 1)[-1]})')
                data = r.read()
            if len(data) < 20000:
                raise RuntimeError(f'너무 작다({len(data)}B)')
            open(out, 'wb').write(data)
            n = normalize(out)
            print(f'ok  {name:28s} {n // 1024:5d}KB  video/{vid}')
            lines.append(f'| `{name}` | Pexels video {vid} | Pexels License | (표기 의무 없음) |')
            ok += 1
        except Exception as e:
            print(f'FAIL {name:27s} video/{vid} — {e}')
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
