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
import argparse, json, os, subprocess, sys, zlib
import imageio_ffmpeg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PROJECT = '더파크사이드서울'
PROJ = os.path.join(ROOT, 'projects', DEFAULT_PROJECT)   # main() 에서 --project 로 교체
FONT = os.path.join(ROOT, 'motion', 'public', 'fonts', 'Pretendard-Bold.otf')
FF = imageio_ffmpeg.get_ffmpeg_exe()
CREDIT = '더파크사이드 서울'
FPS = 30


def probe_duration(path):
    r = subprocess.run([FF, '-i', path, '-hide_banner'], capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if 'Duration:' in line:
            h, m, s = line.split('Duration:')[1].split(',')[0].strip().split(':')
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise RuntimeError(f'duration 못 읽음: {path}')


FONT_R = os.path.join(ROOT, 'motion', 'public', 'fonts', 'A2Z-4Regular.ttf')
_OVERLAY_DIR = os.path.join(PROJ, 'clips', '_overlay')


def _shadow_text(d, xy, txt, font, fill, sh=(0, 0, 0, 150), off=2):
    d.text((xy[0] + off, xy[1] + off + 1), txt, font=font, fill=sh)
    d.text(xy, txt, font=font, fill=fill)


# ── 실사 위 문구 처리 ────────────────────────────────────────────────────
# 실사 컷이 전부 "가운데 흰 글씨 + 위아래 그라디언트" 하나였다.
# 갤러리 편 9컷 중 4컷이 실사였는데 넷 다 같은 그림으로 읽혔다.
# 세 가지로 나눈다 — 컷마다 `style` 로 고른다.
#
#   center  화면 한가운데. 선언·전환에.        (기존)
#   lower   좌하단 + 옐로 룰. 설명·부연에.      화면 위쪽이 살아 있어 사진이 보인다
#   band    하단 옐로 밴드 + 검은 글씨. 못박을 때. 가장 강하다 — 한 편에 한두 번만
STYLES = ('center', 'lower', 'band')


def overlay_png(text='', sub='', key='credit', credit=CREDIT, style='center'):
    """실사 위에 얹을 투명 PNG. 출처는 항상, text 가 있으면 문구도 함께.

    이 ffmpeg 빌드에는 drawtext(libfreetype)가 없어서 PIL 로 굽는다.
    """
    os.makedirs(_OVERLAY_DIR, exist_ok=True)
    out = os.path.join(_OVERLAY_DIR, f'{key}.png')
    if os.path.exists(out):
        return out
    from PIL import Image, ImageDraw, ImageFont
    im = Image.new('RGBA', (1920, 1080), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    if text and style == 'center':
        # 문구 뒤에 옅은 세로 그라디언트를 깔아 어떤 화면에서도 읽히게
        scrim = Image.new('RGBA', (1920, 1080), (0, 0, 0, 0))
        sd = ImageDraw.Draw(scrim)
        for i in range(360):
            a = int(150 * (1 - abs(i - 180) / 180) ** 0.7)
            sd.line([(0, 360 + i), (1920, 360 + i)], fill=(11, 14, 18, a))
        im = Image.alpha_composite(im, scrim)
        d = ImageDraw.Draw(im)
        fb = ImageFont.truetype(FONT, 88)
        w = d.textbbox((0, 0), text, font=fb)[2]
        _shadow_text(d, ((1920 - w) // 2, 486), text, fb, (255, 255, 255, 255), off=3)
        if sub:
            fs = ImageFont.truetype(FONT_R, 42)
            w2 = d.textbbox((0, 0), sub, font=fs)[2]
            _shadow_text(d, ((1920 - w2) // 2, 600), sub, fs, (226, 231, 238, 255))

    elif text and style == 'lower':
        # 좌하단. 위쪽을 비워 두므로 사진이 살아 있다. 옐로 룰이 시작점을 찍는다.
        scrim = Image.new('RGBA', (1920, 1080), (0, 0, 0, 0))
        sd = ImageDraw.Draw(scrim)
        for i in range(420):
            a = int(190 * (i / 420) ** 1.4)
            sd.line([(0, 660 + i), (1920, 660 + i)], fill=(11, 14, 18, a))
        im = Image.alpha_composite(im, scrim)
        d = ImageDraw.Draw(im)
        y = 640 if sub else 686
        d.rectangle([120, y, 120 + 96, y + 8], fill=(250, 255, 46, 255))
        fb = ImageFont.truetype(FONT, 76)
        _shadow_text(d, (120, y + 34), text, fb, (255, 255, 255, 255), off=3)
        if sub:
            fs = ImageFont.truetype(FONT_R, 38)
            _shadow_text(d, (120, y + 134), sub, fs, (222, 228, 236, 255))

    elif text and style == 'band':
        # 하단 옐로 밴드 + 검은 글씨. 그림 위에 못을 박는 처리라 한 편에 한두 번만.
        d = ImageDraw.Draw(im)
        fb = ImageFont.truetype(FONT, 82)
        bh = 168 if sub else 132
        by = 1080 - 260 - bh          # 자막 안전영역 바로 위
        d.rectangle([0, by, 1920, by + bh], fill=(250, 255, 46, 255))
        w = d.textbbox((0, 0), text, font=fb)[2]
        d.text(((1920 - w) // 2, by + 20), text, font=fb, fill=(18, 21, 26, 255))
        if sub:
            fs = ImageFont.truetype(FONT_R, 36)
            w2 = d.textbbox((0, 0), sub, font=fs)[2]
            d.text(((1920 - w2) // 2, by + 116), sub, font=fs, fill=(18, 21, 26, 210))

    f = ImageFont.truetype(FONT, 23)
    w = d.textbbox((0, 0), credit, font=f)[2]
    _shadow_text(d, (1920 - 44 - w, 1026), credit, f, (255, 255, 255, 205), off=1)
    im.save(out)
    return out


def cut(src, ss, dur, out, overlay):
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
           '-loop', '1', '-i', overlay,
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
    ap.add_argument('--project', default=DEFAULT_PROJECT)
    a = ap.parse_args()

    global PROJ, _OVERLAY_DIR
    PROJ = os.path.join(ROOT, 'projects', a.project)
    _OVERLAY_DIR = os.path.join(PROJ, 'clips', '_overlay')

    plan = json.load(open(os.path.join(PROJ, 'scene_plan.json'), encoding='utf-8'))
    outdir = os.path.join(PROJ, 'clips')
    os.makedirs(outdir, exist_ok=True)
    n = 0
    for sc in plan['scenes']:
        bs = sc.get('broll')
        if not bs or (a.ids and sc['id'] not in a.ids):
            continue
        bs = bs if isinstance(bs, list) else [bs]      # 한 장면에 실사 여러 컷 가능
        for j, b in enumerate(bs):
            src = os.path.join(PROJ, 'footage', b['src'])
            sfx = '_b' if len(bs) == 1 else f'_b{j + 1}'
            out = os.path.join(outdir, f"sec{sc['id']:02d}_{sc['key']}{sfx}.mp4")
            cr = b.get('credit', CREDIT)
            st = b.get('style', 'center')
            key = (f"c{zlib.crc32(cr.encode()) % 99999}" if not b.get('text')
                   else f"t{sc['id']:02d}_{j}_{st}")
            cut(src, b['ss'], b['dur'], out,
                overlay_png(b.get('text', ''), b.get('sub', ''), key, cr, st))
            print(f"[ok] #{sc['id']:02d} {sc['key']:12s} {sfx[1:]:3s} {b['dur']:5.1f}s "
                  f"{b['src'][:10]}@{b['ss']}s  {os.path.getsize(out)//1024}KB", flush=True)
            n += 1
    print(f'실사 {n}컷 → {outdir}', flush=True)


if __name__ == '__main__':
    main()
