#!/usr/bin/env python3
"""썸네일 A/B 후보 생성 (1280x720).

조회수는 결국 **CTR × 리텐션**인데, 지금까지 이 파이프라인은 리텐션 쪽만
다뤘다. 썸네일은 손도 안 댔다. 여기서 3안을 뽑아 놓고 고르게 한다.

  A 빅넘버   — 배경 사진 + 거대 숫자 한 개 + 한 줄. 수치가 주인공인 기획에.
  B 대조     — 좌우 두 장 + 가운데 VS. "같은 입지, 반대 답" 류에.
  C 질문     — 사진 하나 + 짧은 의문형. 서사가 주인공인 기획에.
  D 스탬프   — 검정 상자 라벨 + 손그림 화살표. **B1M 기본형.**
  E 판정     — 한 단어 + 마침표. "무산." "비어 있다." 서사형 기획에.

D·E 는 B1M 최근 48장을 세어 보고 만들었다. 거기서 실제로 반복되는 건 세 가지다.
  ① 글자는 **검정 상자 안 흰 대문자** — 배경이 뭐든 무조건 읽힌다.
     아래를 통째로 어둡게 까는 스크림은 그들은 거의 안 쓴다. 상자가 그 일을 한다
  ② **작은 한정어 줄 + 큰 본체 줄** 2단 ("WORLD'S LARGEST NAVAL BASE" / "$4BN")
  ③ 라벨에서 대상까지 **손으로 그린 듯 휜 화살표**. 48장 중 가장 자주 나온 도구
  그리고 라벨은 늘 **하늘·물처럼 비어 있는 데** 앉는다 — 좌하단 고정이 아니다.

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


def quietest(im, bw, bh, avoid_badge=True):
    """라벨을 앉힐 **가장 조용한 자리**를 찾는다.

    B1M 은 라벨을 좌하단에 고정하지 않는다. 하늘·물·사막처럼 아무것도 없는 데
    앉힌다. 그래서 사진마다 자리가 다르다 — 그걸 사람이 매번 고르게 하면
    결국 안 고른다. 격자로 훑어 분산이 가장 낮은 칸을 고른다.
    """
    import numpy as np
    g = np.asarray(im.convert('L').resize((W // 8, H // 8))).astype(float)
    gw, gh = max(1, bw // 8), max(1, bh // 8)
    M = 48                                    # 화면 끝에 붙으면 잘린 것처럼 보인다
    best, bxy = None, (M, M)
    for gy in range(M // 8, g.shape[0] - gh, 3):
        for gx in range(M // 8, g.shape[1] - gw, 3):
            x, y = gx * 8, gy * 8
            if avoid_badge and x + bw > BADGE_ZONE[0] and y + bh > BADGE_ZONE[1]:
                continue
            if y + bh > H - M or x + bw > W - M:
                continue
            patch = g[gy:gy + gh, gx:gx + gw]
            # 분산 + 가장자리에서 너무 멀지 않게 하는 약한 페널티
            score = patch.std() + abs(y - H * 0.3) / 60
            if best is None or score < best:
                best, bxy = score, (x, y)
    return bxy


def hand_arrow(im, frm, to, bow=70, color=WHITE, width=15, head=42):
    """손으로 그린 듯 휜 화살표. 끝으로 갈수록 얇아진다.

    일정 굵기의 선으로 그리면 '지시선'이 되고, 얇아지면 '손짓'이 된다.
    B1M 이 쓰는 건 후자다. 2차 베지어 하나 + 테이퍼가 전부다.
    """
    import math
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    x0, y0 = frm
    x1, y1 = to
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1
    cx = (x0 + x1) / 2 + (-dy / ln) * bow
    cy = (y0 + y1) / 2 + (dx / ln) * bow
    N = 30
    L, R = [], []
    for i in range(N + 1):
        t = i / N; u = 1 - t
        x = u * u * x0 + 2 * u * t * cx + t * t * x1
        y = u * u * y0 + 2 * u * t * cy + t * t * y1
        tx = 2 * u * (cx - x0) + 2 * t * (x1 - cx)
        ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy)
        tl = math.hypot(tx, ty) or 1
        w = (width + (width * 0.22 - width) * t) / 2
        L.append((x - ty / tl * w, y + tx / tl * w))
        R.append((x + ty / tl * w, y - tx / tl * w))
    d.polygon(L + R[::-1], fill=color)
    ax, ay = x1 - cx, y1 - cy
    al = math.hypot(ax, ay) or 1
    ux, uy = ax / al, ay / al
    px, py = -uy, ux
    d.polygon([(x1, y1),
               (x1 - ux * head - px * head * 0.44, y1 - uy * head - py * head * 0.44),
               (x1 - ux * head + px * head * 0.44, y1 - uy * head + py * head * 0.44)],
              fill=color)
    im.paste(lay, (0, 0), lay)


def stamp(d, xy, top, sub='', size=104, hot=False, pad=(16, 8)):
    """검정 상자 + 흰 대문자. sub 가 있으면 그 위에 작은 줄이 붙는다.
    반환값은 (전체너비, 전체높이) — 화살표 시작점을 잡는 데 쓴다."""
    bg, fg = (YELLOW, INK) if hot else (INK, WHITE)
    x, y = xy
    w = h = 0
    if sub:
        fs = ImageFont.truetype(FONT_B, int(size * 0.5))
        sw, sh = d.textbbox((0, 0), sub, font=fs)[2:]
        d.rectangle([x, y, x + sw + pad[0] * 2, y + sh + pad[1] * 2], fill=bg)
        d.text((x + pad[0], y + pad[1] - 2), sub, font=fs, fill=fg)
        h = sh + pad[1] * 2 + 6
        w = sw + pad[0] * 2
    ft = ImageFont.truetype(FONT_B, size)
    tw, th = d.textbbox((0, 0), top, font=ft)[2:]
    d.rectangle([x, y + h, x + tw + pad[0] * 2, y + h + th + pad[1] * 2], fill=bg)
    d.text((x + pad[0], y + h + pad[1] - 4), top, font=ft, fill=fg)
    return max(w, tw + pad[0] * 2), h + th + pad[1] * 2


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


def variant_stamp(bg, top, sub, out, arrow_to=None, hot=False):
    """B1M 기본형. 스크림을 깔지 않는다 — 상자가 대비를 만든다."""
    im = cover(bg, (W, H))
    d = ImageDraw.Draw(im)
    ft = ImageFont.truetype(FONT_B, 104)
    est_w = d.textbbox((0, 0), top, font=ft)[2] + 32
    est_h = 150 if sub else 130
    x, y = quietest(im, est_w, est_h)
    if arrow_to:
        tx, ty = int(arrow_to[0] * W), int(arrow_to[1] * H)
        # 화살표를 먼저 깔고 라벨을 그 위에 — 라벨이 항상 이긴다
        sx = x + est_w * 0.5
        sy = y + est_h + 26 if ty > y else y - 26
        bow = 74 if tx > sx else -74
        hand_arrow(im, (sx, sy), (tx, ty), bow=bow)
        d = ImageDraw.Draw(im)
    stamp(d, (x, y), top, sub, hot=hot)
    im.save(out, quality=92)
    return out


def variant_verdict(bg, word, out):
    """한 단어 + 마침표. 마침표가 '끝났다'를 말한다 (ABANDONED. / BROKE.)
    물음표면 '아직 모른다'가 된다 (DOOMED? / CHEATING?) — 부호를 아껴 쓸 것."""
    im = cover(bg, (W, H))
    d = ImageDraw.Draw(im)
    f = fit_font(d, word, W - 220, 176, 104)
    tw, th = d.textbbox((0, 0), word, font=f)[2:]
    x, y = quietest(im, tw + 48, th + 40)
    d.rectangle([x, y, x + tw + 48, y + th + 40], fill=INK)
    d.text((x + 24, y + 14), word, font=f, fill=WHITE)
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
    ap.add_argument('--stamp', default='', help='D안 큰 줄 (2~4어절)')
    ap.add_argument('--stamp-sub', default='', help='D안 작은 한정어 줄')
    ap.add_argument('--arrow', default='', help='D안 화살표 목표 "0.62,0.45" (비율)')
    ap.add_argument('--verdict', default='', help='E안 한 단어 + 부호 ("무산." "왜 여기만?")')
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
    if a.bg and a.stamp:
        at = tuple(float(v) for v in a.arrow.split(',')) if a.arrow else None
        made.append(variant_stamp(a.bg, a.stamp, a.stamp_sub,
                                  os.path.join(outdir, 'D_스탬프.jpg'), arrow_to=at))
    if a.bg and a.verdict:
        made.append(variant_verdict(a.bg, a.verdict, os.path.join(outdir, 'E_판정.jpg')))
    for m in made:
        print(f'  {os.path.basename(m)}  {os.path.getsize(m) // 1024}KB')
    if not made:
        print('만든 게 없다 — --big/--line, --left/--right, --q, --stamp, --verdict 중 하나')
    else:
        print(f'\n→ {outdir}')
        print('폰에서 볼 크기(320x180)로 줄여 놓고 글자가 읽히는지 먼저 본다.')


if __name__ == '__main__':
    main()
