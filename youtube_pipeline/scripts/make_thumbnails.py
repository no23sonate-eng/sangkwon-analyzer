#!/usr/bin/env python3
"""썸네일 A/B 후보 생성 (1280x720).

조회수는 결국 **CTR × 리텐션**인데, 지금까지 이 파이프라인은 리텐션 쪽만
다뤘다. 썸네일은 손도 안 댔다. 여기서 3안을 뽑아 놓고 고르게 한다.

  A 빅넘버   — 배경 사진 + 거대 숫자 한 개 + 한 줄. 수치가 주인공인 기획에.
  B 대조     — 좌우 두 장 + 가운데 VS. "같은 입지, 반대 답" 류에.
  C 질문     — 사진 하나 + 짧은 의문형. 서사가 주인공인 기획에.

공통 규칙 (모바일 피드 기준)
  - 글자는 **6단어 이내**, 세 어절 이하로 끊어 2줄까지
  - 최소 글자 높이 72px (1280 기준) — 폰에서 안 뭉개지는 하한
  - 우하단 20% 는 재생시간 배지가 덮으므로 비운다
  - 채널 옐로(#FAFF2E)는 **한 곳에만** — 여러 군데 쓰면 강조가 죽는다

    python3 youtube_pipeline/scripts/make_thumbnails.py 더파크사이드서울 \
        --big "11조" --line "서울 한복판에 도시가 생긴다" \
        --bg parkside/hero.jpg --left parkside/parkside_towers.jpg \
        --right parkside/eterno_towers.jpg --q "왜 여기만 20층일까"
"""
import argparse, os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'motion', 'public')
FONT_B = os.path.join(ROOT, 'motion', 'public', 'fonts', 'Pretendard-Bold.otf')

W, H = 1280, 720
YELLOW = (250, 255, 46)
INK = (18, 21, 26)
WHITE = (255, 255, 255)
BADGE_ZONE = (int(W * 0.78), int(H * 0.86))   # 재생시간 배지가 덮는 우하단


def cover(path, size):
    im = Image.open(os.path.join(PUBLIC, path)).convert('RGB')
    tw, th = size
    r = max(tw / im.width, th / im.height)
    im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1), Image.LANCZOS)
    x = (im.width - tw) // 2
    y = int((im.height - th) * 0.42)          # 살짝 위 — 하늘보다 건물이 남게
    return im.crop((x, y, x + tw, y + th))


def scrim(im, top=0.15, bottom=0.72):
    """아래쪽을 눌러 흰 글씨가 뜨게. 위는 살짝만."""
    g = Image.new('L', (1, H))
    for y in range(H):
        t = y / H
        a = top + (bottom - top) * (t ** 1.6)
        g.putpixel((0, y), int(255 * a))
    g = g.resize((W, H))
    dark = Image.new('RGB', (W, H), (8, 10, 14))
    return Image.composite(dark, im, g.point(lambda v: v))


def fit_font(draw, text, maxw, start, floor=72):
    size = start
    while size > floor:
        f = ImageFont.truetype(FONT_B, size)
        if draw.textbbox((0, 0), text, font=f)[2] <= maxw:
            return f
        size -= 4
    return ImageFont.truetype(FONT_B, floor)


def shadow_text(d, xy, text, font, fill, off=4):
    d.text((xy[0] + off, xy[1] + off), text, font=font, fill=(0, 0, 0, 170))
    d.text(xy, text, font=font, fill=fill)


def variant_big(bg, big, line, out):
    im = scrim(cover(bg, (W, H)))
    d = ImageDraw.Draw(im)
    # 아래에서부터 쌓는다 — 위에서 내려오면 큰 숫자가 클수록 한 줄이 잘려 나간다
    x = 72
    fb = fit_font(d, big, W - 160, 340, 200)
    bw, bh = d.textbbox((0, 0), big, font=fb)[2:]
    fl = fit_font(d, line, W - 160, 92, 68) if line else None
    lh = d.textbbox((0, 0), line, font=fl)[3] if line else 0
    line_y = H - 56 - lh
    big_y = line_y - 26 - bh
    d.rectangle([x - 24, big_y + bh * 0.10, x + bw + 24, big_y + bh + 8], fill=YELLOW)
    d.text((x, big_y), big, font=fb, fill=INK)
    if line:
        shadow_text(d, (x, line_y), line, fl, WHITE)
    im.save(out, quality=92)
    return out


def variant_vs(left, right, lcap, rcap, out):
    half = W // 2
    im = Image.new('RGB', (W, H))
    im.paste(scrim(cover(left, (half, H)), 0.2, 0.7).resize((half, H)), (0, 0))
    im.paste(scrim(cover(right, (half, H)), 0.2, 0.7).resize((half, H)), (half, 0))
    d = ImageDraw.Draw(im)
    d.line([(half, 0), (half, H)], fill=WHITE, width=6)

    fv = ImageFont.truetype(FONT_B, 132)
    vw, vh = d.textbbox((0, 0), 'VS', font=fv)[2:]
    cx, cy = half - vw // 2, H // 2 - vh // 2 - 30
    d.ellipse([cx - 46, cy - 30, cx + vw + 46, cy + vh + 30], fill=YELLOW)
    d.text((cx, cy), 'VS', font=fv, fill=INK)

    for cap, x0 in ((lcap, 0), (rcap, half)):
        if not cap:
            continue
        fc = fit_font(d, cap, half - 90, 92, 72)
        cw = d.textbbox((0, 0), cap, font=fc)[2]
        shadow_text(d, (x0 + (half - cw) // 2, H - 190), cap, fc, WHITE)
    im.save(out, quality=92)
    return out


def variant_q(bg, q, out):
    im = scrim(cover(bg, (W, H)), 0.28, 0.62)
    d = ImageDraw.Draw(im)
    words = q.split(' ')
    mid = max(1, len(words) // 2)
    lines = [' '.join(words[:mid]), ' '.join(words[mid:])] if len(words) > 3 else [q]
    f = fit_font(d, max(lines, key=len), W - 200, 150, 84)
    lh = d.textbbox((0, 0), lines[0], font=f)[3] + 22
    y = (H - lh * len(lines)) // 2 - 20
    for ln in lines:
        lw = d.textbbox((0, 0), ln, font=f)[2]
        shadow_text(d, ((W - lw) // 2, y), ln, f, WHITE, off=5)
        y += lh
    # 물음표 하나만 옐로로 — 강조는 한 곳에
    d.rectangle([W // 2 - 60, y + 24, W // 2 + 60, y + 34], fill=YELLOW)
    im.save(out, quality=92)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--bg', default='')
    ap.add_argument('--big', default='')
    ap.add_argument('--line', default='')
    ap.add_argument('--left', default='')
    ap.add_argument('--right', default='')
    ap.add_argument('--lcap', default='')
    ap.add_argument('--rcap', default='')
    ap.add_argument('--q', default='')
    a = ap.parse_args()

    outdir = os.path.join(ROOT, 'projects', a.project, 'thumbnails')
    os.makedirs(outdir, exist_ok=True)
    made = []
    if a.bg and a.big:
        made.append(variant_big(a.bg, a.big, a.line, os.path.join(outdir, 'A_빅넘버.jpg')))
    if a.left and a.right:
        made.append(variant_vs(a.left, a.right, a.lcap, a.rcap, os.path.join(outdir, 'B_대조.jpg')))
    if a.bg and a.q:
        made.append(variant_q(a.bg, a.q, os.path.join(outdir, 'C_질문.jpg')))
    for m in made:
        print(f'  {os.path.basename(m)}  {os.path.getsize(m) // 1024}KB')
    if not made:
        print('만든 게 없다 — --big/--line, --left/--right, --q 중 하나는 줘야 한다')
    else:
        print(f'\n→ {outdir}')
        print('폰에서 볼 크기(320x180)로 줄여 놓고 글자가 읽히는지 먼저 본다.')


if __name__ == '__main__':
    main()
