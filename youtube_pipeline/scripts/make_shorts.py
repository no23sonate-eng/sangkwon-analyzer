#!/usr/bin/env python3
"""롱폼 클립 → 쇼츠(9:16) 파생본.

같은 소재로 세로 컷을 따로 만드는 건 2026 기준 사실상 필수다. 새로 렌더하지
않고 **이미 만든 16:9 클립을 재구성**한다 — 카드 그래픽은 그대로 살리고
위아래 빈 자리에 훅 문구와 브랜드를 넣는다.

  캔버스 1080x1920
    상단 300px   훅 한 줄 (가장 강한 수치/문장)
    중앙 1080x608 원본 클립 (가로폭 맞춤)
    하단        배경은 원본을 크게 흐린 것 — 검은 레터박스보다 덜 답답하다
    하단 420px   자막 자리로 비워 둔다 (쇼츠 UI가 아래를 가린다)

    python3 youtube_pipeline/scripts/make_shorts.py 더파크사이드서울 --list
    python3 youtube_pipeline/scripts/make_shorts.py 더파크사이드서울 --ids 3 27 30
"""
import argparse, json, os, re, subprocess, sys

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = imageio_ffmpeg.get_ffmpeg_exe()
FONT_B = os.path.join(ROOT, 'motion', 'public', 'fonts', 'Pretendard-Bold.otf')
FONT_R = os.path.join(ROOT, 'motion', 'public', 'fonts', 'A2Z-4Regular.ttf')

W, H = 1080, 1920
VID_H = 608                    # 1080 폭으로 맞춘 16:9 높이
VID_Y = 560                    # 영상이 놓이는 세로 위치 (위 훅 / 아래 자막)
SAFE_BOTTOM = 420              # 쇼츠 UI(설명·버튼)가 가리는 영역
YELLOW = (250, 255, 46, 255)
INK = (18, 21, 26, 255)


def wrap(draw, text, font, maxw):
    lines, cur = [], ''
    for w in text.split(' '):
        t = (cur + ' ' + w).strip()
        if draw.textbbox((0, 0), t, font=font)[2] > maxw and cur:
            lines.append(cur)
            cur = w
        else:
            cur = t
    if cur:
        lines.append(cur)
    return lines


def overlay_png(hook, kicker, out):
    """세로 캔버스용 오버레이. 훅은 위, 브랜드 킥커는 영상 바로 아래."""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    fb = ImageFont.truetype(FONT_B, 84)
    lines = wrap(d, hook, fb, W - 120)[:3]
    y = VID_Y - 60 - len(lines) * 104
    for ln in lines:
        tw = d.textbbox((0, 0), ln, font=fb)[2]
        x = (W - tw) // 2
        d.rectangle([x - 20, y - 12, x + tw + 20, y + 96], fill=YELLOW)
        d.text((x, y), ln, font=fb, fill=INK)
        y += 104

    if kicker:
        fk = ImageFont.truetype(FONT_R, 40)
        tw = d.textbbox((0, 0), kicker, font=fk)[2]
        d.text(((W - tw) // 2, VID_Y + VID_H + 46), kicker, font=fk, fill=(255, 255, 255, 220))
    im.save(out)
    return out


def clips_of(plan):
    """장면 id → 그 장면에 속한 클립 파일명들 (카드 + 실사)."""
    m = {}
    for sc in plan['scenes']:
        names = []
        if sc.get('cardDur', sc['dur']) > 0:
            names.append(f"sec{sc['id']:02d}_{sc['key']}.mp4")
        bs = sc.get('broll')
        if bs:
            bs = bs if isinstance(bs, list) else [bs]
            for j in range(len(bs)):
                sfx = '_b' if len(bs) == 1 else f'_b{j + 1}'
                names.append(f"sec{sc['id']:02d}_{sc['key']}{sfx}.mp4")
        m[sc['id']] = names
    return m


def hook_of(sc):
    """장면 내레이션에서 가장 강한 한 조각 — 수치가 있는 문장을 고른다."""
    sents = [s for s in re.split(r'(?<=[.?!])\s+', sc.get('text', '')) if s.strip()]
    if not sents:
        return ''
    scored = sorted(sents, key=lambda s: (len(re.findall(r'\d', s)), -len(s)), reverse=True)
    best = scored[0].strip().rstrip('.')
    if len(best) <= 44:
        return best
    # 문장 중간에서 뚝 끊기지 않게 쉼표 → 어절 순으로 경계를 찾는다
    head = best[:44]
    for sep in (', ', ' '):
        if sep in head:
            return head[:head.rfind(sep)].rstrip(' ,')
    return head


def build(project, sid, plan, names, outdir):
    projdir = os.path.join(ROOT, 'projects', project)
    srcs = [os.path.join(projdir, 'clips', n) for n in names]
    srcs = [s for s in srcs if os.path.exists(s)]
    if not srcs:
        print(f'  #{sid} 클립 없음 — 건너뜀')
        return None
    sc = next(s for s in plan['scenes'] if s['id'] == sid)

    tmp = os.path.join(outdir, f'_concat_{sid}.txt')
    with open(tmp, 'w') as f:
        f.write('\n'.join(f"file '{s}'" for s in srcs) + '\n')
    joined = os.path.join(outdir, f'_join_{sid}.mp4')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
                    '-i', tmp, '-c', 'copy', joined], check=True)

    ov = overlay_png(hook_of(sc), '더 파크사이드 서울 · 전체 영상은 채널에',
                     os.path.join(outdir, f'_ov_{sid}.png'))
    out = os.path.join(outdir, f'shorts_{sid:02d}.mp4')
    # 배경 = 원본을 세로로 꽉 채워 크게 흐린 것 / 전경 = 폭 맞춘 원본
    # 배경은 **세로를 꽉 채우도록** 키운 뒤 가로를 잘라낸다.
    # (가로 기준으로 키우면 1080x608 이라 세로 1920 크롭이 실패한다)
    fc = (f'[0:v]scale=-2:{H},crop={W}:{H},gblur=sigma=42,eq=brightness=-0.12[bg];'
          f'[0:v]scale={W}:{VID_H}[fg];'
          f'[bg][fg]overlay=0:{VID_Y}[v];'
          f'[v][1:v]overlay=0:0,format=yuv420p[o]')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', joined, '-loop', '1', '-i', ov,
                    '-filter_complex', fc, '-map', '[o]',
                    '-frames:v', str(int(round(sum_dur(srcs) * 30))),
                    '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
                    '-maxrate', '8M', '-bufsize', '16M',
                    '-video_track_timescale', '90000', '-r', '30', out],
                   check=True, capture_output=True, text=True)
    for p in (tmp, joined, ov):
        os.remove(p)
    print(f'  #{sid} → {os.path.basename(out)}  {sum_dur(srcs):.1f}s  '
          f'{os.path.getsize(out) // 1024}KB')
    return out


def sum_dur(paths):
    t = 0.0
    for p in paths:
        r = subprocess.run([FF, '-i', p, '-hide_banner'], capture_output=True, text=True)
        m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr)
        if m:
            t += int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
    return t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--ids', nargs='*', type=int)
    ap.add_argument('--list', action='store_true')
    a = ap.parse_args()

    projdir = os.path.join(ROOT, 'projects', a.project)
    plan = json.load(open(os.path.join(projdir, 'scene_plan.json'), encoding='utf-8'))
    m = clips_of(plan)

    if a.list or not a.ids:
        print('쇼츠로 쓸 만한 장면 (수치가 강한 순):')
        ranked = sorted(plan['scenes'],
                        key=lambda s: len(re.findall(r'\d', s.get('text', ''))), reverse=True)
        for s in ranked[:10]:
            print(f"  --ids {s['id']:<3} {s['dur']:5.1f}s  {hook_of(s)}")
        if not a.ids:
            return

    outdir = os.path.join(projdir, 'shorts')
    os.makedirs(outdir, exist_ok=True)
    print(f'쇼츠 {len(a.ids)}편 → {outdir}')
    for sid in a.ids:
        if sid not in m:
            print(f'  #{sid} 그런 장면 없음')
            continue
        build(a.project, sid, plan, m[sid], outdir)


if __name__ == '__main__':
    main()
