#!/usr/bin/env python3
"""실사 컷(b-roll) 잘라내기 — 종이 그래픽 사이에 끼워 넣을 영상.

원본은 `projects/<프로젝트>/footage/` 의 공식 프로젝트 필름.
scene_plan.json 의 `broll:{src,ss,dur}` 대로 잘라 `clips/secNN_key_b.mp4` 로 낸다.

- 오디오는 버린다 (내레이션이 올라감)
- 원본 길이가 모자라면 setpts 로 살짝 늘려 채운다 (컷을 반복하지 않음)
- 우하단에 출처를 굽는다 — 카드와 달리 실사에는 자막 레이어가 없으므로

    python3 youtube_pipeline/scripts/render_broll.py           # 전부
    python3 youtube_pipeline/scripts/render_broll.py 18 31     # 특정 장면만
"""
import argparse, json, os, subprocess, sys
import imageio_ffmpeg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.join(ROOT, 'projects', '더파크사이드서울')
FONT = os.path.join(ROOT, 'motion', 'public', 'fonts', 'Pretendard-Bold.otf')
FF = imageio_ffmpeg.get_ffmpeg_exe()
CREDIT = '이미지: 더파크사이드 서울'
FPS = 30


def probe_duration(path):
    r = subprocess.run([FF, '-i', path, '-hide_banner'], capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if 'Duration:' in line:
            h, m, s = line.split('Duration:')[1].split(',')[0].strip().split(':')
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise RuntimeError(f'duration 못 읽음: {path}')


_CREDIT_PNG = os.path.join(PROJ, 'clips', '_credit.png')


def credit_png():
    """우하단 출처 오버레이(1920x1080 투명 PNG). 카드의 PaperSource 와 같은 위치·크기."""
    if os.path.exists(_CREDIT_PNG):
        return _CREDIT_PNG
    from PIL import Image, ImageDraw, ImageFont
    im = Image.new('RGBA', (1920, 1080), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 27)
    w = d.textbbox((0, 0), CREDIT, font=f)[2]
    x, y = 1920 - 96 - w, 812
    d.text((x + 1, y + 2), CREDIT, font=f, fill=(0, 0, 0, 130))   # 밝은 화면용 그림자
    d.text((x, y), CREDIT, font=f, fill=(255, 255, 255, 205))
    os.makedirs(os.path.dirname(_CREDIT_PNG), exist_ok=True)
    im.save(_CREDIT_PNG)
    return _CREDIT_PNG


def cut(src, ss, dur, out):
    avail = probe_duration(src) - ss
    # 모자라면 느리게 재생해 채운다. 1.25배까지만 — 그 이상은 부자연스러움
    slow = max(1.0, dur / avail) if avail < dur else 1.0
    if slow > 1.25:
        print(f'  [warn] {os.path.basename(src)} @{ss}s 는 {avail:.1f}초뿐 — '
              f'{slow:.2f}배 느리게 재생 (원본 구간을 다시 고르는 게 낫다)')
    vf = [f'setpts={slow}*PTS'] if slow > 1.0 else []
    vf += ['scale=1920:1080:force_original_aspect_ratio=increase',
           'crop=1920:1080', f'fps={FPS}']
    # 길이는 반드시 출력 옵션 -frames:v 로 자른다.
    # 입력이 둘이라 -t 를 중간에 두면 두 번째 입력(출처 PNG)에 붙어버려
    # 영상이 원본 끝까지 흘러나온다. setpts 를 쓸 때도 프레임 수가 정답.
    cmd = [FF, '-y', '-loglevel', 'error',
           '-ss', str(ss), '-i', src,
           # 출처 오버레이 — 이 ffmpeg 빌드에는 drawtext(libfreetype)가 없어서
           # PIL 로 만든 투명 PNG 를 얹는다. -loop 1 로 길이만큼 계속 공급
           '-loop', '1', '-i', credit_png(),
           '-filter_complex', f"[0:v]{','.join(vf)}[v];[v][1:v]overlay=0:0",
           '-frames:v', str(int(round(dur * FPS))),
           # 원본이 5~6Mbps 라 crf 만 두면 CG 디테일 때문에 30Mbps 까지 튄다.
           # 원본 수준으로 상한을 걸어 편집 소스 용량을 잡는다.
           '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
           '-maxrate', '7M', '-bufsize', '14M',
           # Remotion 출력과 타임스케일을 맞춘다. 다르면(15360 vs 90k) concat 데먹서가
           # 타임스탬프를 잘못 이어붙여 41분짜리 파일이 나온다.
           '-video_track_timescale', '90000',
           '-pix_fmt', 'yuv420p', '-r', str(FPS), out]
    subprocess.run(cmd, check=True, capture_output=True)
    got = round(probe_duration(out) * FPS)
    want = int(round(dur * FPS))
    assert abs(got - want) <= 1, f'{os.path.basename(out)}: {got}f 나옴 (기대 {want}f)'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ids', nargs='*', type=int)
    a = ap.parse_args()

    plan = json.load(open(os.path.join(PROJ, 'scene_plan.json'), encoding='utf-8'))
    outdir = os.path.join(PROJ, 'clips')
    os.makedirs(outdir, exist_ok=True)
    n = 0
    for sc in plan['scenes']:
        b = sc.get('broll')
        if not b or (a.ids and sc['id'] not in a.ids):
            continue
        src = os.path.join(PROJ, 'footage', b['src'])
        out = os.path.join(outdir, f"sec{sc['id']:02d}_{sc['key']}_b.mp4")
        cut(src, b['ss'], b['dur'], out)
        print(f"[ok] #{sc['id']:02d} {sc['key']:12s} broll {b['dur']:5.1f}s "
              f"{b['src'][:10]}@{b['ss']}s  {os.path.getsize(out)//1024}KB", flush=True)
        n += 1
    print(f'실사 {n}컷 → {outdir}', flush=True)


if __name__ == '__main__':
    main()
