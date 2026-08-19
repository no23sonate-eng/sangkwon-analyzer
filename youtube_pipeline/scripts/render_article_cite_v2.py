#!/usr/bin/env python3
"""[테스트] 기사 인용 모션 개선안 — 어색함 3가지를 제거.

기존 문제:
  1) 카메라가 움직이는 "동안" 형광펜이 칠해짐 → 두 모션이 경쟁해 흔들려 보임
  2) 형광펜이 등속 직선 → 기계적
  3) 스크롤·줌이 동시에 → 어지러움

개선:
  1) 스크롤 → 완전 정지(홀드) → 그다음 형광펜. 칠하는 동안 카메라 고정
  2) 형광펜에 ease-out + 줄마다 짧은 텀 (사람이 긋는 리듬)
  3) 스크롤과 줌을 분리 (스크롤 먼저, 도착 후 살짝 줌)
"""
import os, json, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()

def ease_out(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3

def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def render(shot, rects_json, out, seconds=8.0, fps=30, SPEC=(1.2, 3.0, 0.5, 2.4)):
    SHOT = Image.open(shot).convert('RGB')
    S = 1.5
    rects = [{k: v * S for k, v in r.items()} for r in json.load(open(rects_json))]
    M = 120
    base = Image.new('RGB', (SHOT.width + M * 2, SHOT.height + M * 2), '#EFEAE3')
    sh = Image.new('L', base.size, 0)
    ImageDraw.Draw(sh).rectangle([M - 2, M - 2, M + SHOT.width + 8, M + SHOT.height + 8], fill=70)
    base.paste(Image.new('RGB', base.size, '#d8d2c8'), (0, 0), sh.filter(ImageFilter.GaussianBlur(14)))
    base.paste(SHOT, (M, M))
    for r in rects:
        r['x'] += M; r['y'] += M
    grain = Image.effect_noise(base.size, 14).convert('L')
    base = Image.blend(base, Image.merge('RGB', (grain, grain, grain)), 0.035)

    VW, VH = 1920, 1080
    N = int(seconds * fps)
    # 페이즈: 헤드라인 홀드 → 스크롤 → 정착(완전 정지) → 형광펜 → 홀드
    T_HOLD0, T_SCROLL, T_SETTLE, T_WIPE = SPEC
    t0 = T_HOLD0
    t1 = t0 + T_SCROLL       # 스크롤 끝
    t2 = t1 + T_SETTLE       # 완전 정지 후 형광펜 시작
    t3 = t2 + T_WIPE         # 형광펜 끝

    cy_target = sum((r['y'] + r['h'] / 2) for r in rects) / len(rects)
    y_head = M + 340
    total_w = sum(r['w'] for r in rects)

    tmp = out + '.f'
    os.makedirs(tmp, exist_ok=True)
    for f in range(N):
        t = f / fps
        # ── 카메라: 스크롤이 끝나면 그 뒤로는 완전히 고정 ──
        if t < t0:
            p, zt = 0.0, 0.0
        elif t < t1:
            p, zt = smooth((t - t0) / T_SCROLL), 0.0
        else:
            p = 1.0
            zt = smooth((t - t1) / (T_SETTLE + 0.6))  # 도착 후에만 살짝 줌인
        vw = 2000 - 340 * zt
        vh = vw * VH / VW
        cam_y = y_head + (cy_target - y_head) * p
        x0 = max(0, min(base.width - vw, base.width / 2 - vw / 2))
        y0 = max(0, min(base.height - vh, cam_y - vh / 2))
        frame = base.crop((int(x0), int(y0), int(x0 + vw), int(y0 + vh)))

        # ── 형광펜: 카메라 정지 후에만, 줄 단위로 ease-out ──
        if t > t2:
            d = ImageDraw.Draw(frame, 'RGBA')
            per = T_WIPE / len(rects)          # 줄당 시간
            pad = 8
            for li, r in enumerate(rects):
                lt = (t - t2 - li * per * 0.92) / per   # 줄 사이 살짝 겹침
                w = r['w'] * ease_out(lt)
                if w <= 0:
                    break
                d.rounded_rectangle(
                    [r['x'] - pad - x0, r['y'] - pad - y0,
                     r['x'] + w + pad - x0, r['y'] + r['h'] + pad - y0],
                    radius=4, fill=(250, 255, 46, 112))
        frame.resize((VW, VH), Image.LANCZOS).save(f'{tmp}/f{f:04d}.jpg', quality=90)

    subprocess.run([FF, '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', f'{tmp}/f%04d.jpg',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out], check=True)
    print(out, os.path.getsize(out) // 1024, 'KB', flush=True)

if __name__ == '__main__':
    OUT = '/home/user/sangkwon-analyzer/youtube_pipeline/projects/하남스피어/broll_candidates/article_cite'
    # #1 — XML out 669 (+2) = 671프레임 = 22.367초
    # 헤드라인 홀드 2.0 → 스크롤 6.5 → 정지 0.8 → 형광펜 3.6 → 나머지 홀드
    render('fn_shot.png', 'fn_shot_rects.json', f'{OUT}/sec1_fnnews_cite.mp4',
           seconds=671/30, SPEC=(2.0, 6.5, 0.8, 3.6))
