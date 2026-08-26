#!/usr/bin/env python3
"""컷마다 **내용이 화면 어디에 앉는지** 픽셀로 잰다.

"위로 솟았다", "가운데가 아니다" 는 눈으로는 맞는데 고치려면 숫자가 있어야
한다. 어느 컷이 얼마나 솟았는지, 아래가 얼마나 비었는지를 재서 상위 목록을
뽑아야 손볼 데가 정해진다.

재는 법: 배경(종이색)과 다른 픽셀을 **잉크**로 보고 그 경계상자를 잡는다.
실사가 화면을 꽉 채운 컷은 경계상자가 전체라 뜻이 없으므로 따로 표시한다.

    python3 scripts/measure_layout.py 더그랜드롯데             # 요약 + 나쁜 순
    python3 scripts/measure_layout.py 더그랜드롯데 --csv       # 전량

읽는 법
  중심      잉크 덩어리의 세로 한가운데 (px). 1080 프레임의 광학 중심은 약 520
  위여백    화면 위 ~ 잉크 시작
  아래여백  잉크 끝 ~ 1080
  쏠림      위여백 − 아래여백. **음수면 위로 솟은 것**이고, 클수록 아래로 처진 것
"""
import argparse
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
# 자막이 얹힐 자리. 글자는 여기 아래로 내려오면 안 되지만, 화면을 채우는
# 사진은 내려와도 된다 — 자막은 그 위에 얹히는 것이지 잘라내는 게 아니다
SUBTITLE_TOP = 880
# 광학 중심. 사람 눈은 기하학적 중심(540)보다 조금 위를 가운데로 본다
OPTICAL = 512


# 화면에 늘 있는 **붙박이**는 구도가 아니다. 우상단 `Source :` 한 줄과
# 하단 캡션은 어느 컷에나 같은 자리에 있으므로, 이걸 잉크로 세면 모든 컷의
# 경계상자가 위로 28px, 아래로 캡션까지 늘어나 구도를 못 잰다.
# 처음에 이걸 안 뺐더니 "위여백 28" 이 줄줄이 나왔다 — 그건 출처 줄이었다.
FURNITURE_TOP = 76       # 우상단 출처 줄
FURNITURE_BOTTOM = 84    # 하단 캡션·단위 표기


def ink_box(im, tol=14):
    """배경색과 다른 픽셀의 경계상자. 배경은 네 모서리에서 읽는다."""
    im = im.convert('RGB')
    w, h = im.size
    sm = im.resize((w // 4, h // 4), Image.BILINEAR)     # 4배 축소 — 재는 데 충분하다
    sw, sh = sm.size
    px = sm.load()
    corners = [px[2, 2], px[sw - 3, 2], px[2, sh - 3], px[sw - 3, sh - 3]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))

    x0, y0, x1, y1 = sw, sh, -1, -1
    ink = 0
    y_lo, y_hi = FURNITURE_TOP // 4, (1080 - FURNITURE_BOTTOM) // 4
    for y in range(y_lo, min(sh, y_hi)):
        for x in range(sw):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > tol * 3:
                ink += 1
                if x < x0: x0 = x
                if y < y0: y0 = y
                if x > x1: x1 = x
                if y > y1: y1 = y
    if x1 < 0:
        return None, 0.0
    return (x0 * 4, y0 * 4, x1 * 4, y1 * 4), ink / (sw * sh)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--csv', action='store_true')
    ap.add_argument('--top', type=int, default=20, help='나쁜 순 몇 개까지')
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    files = sorted((pdir / 'stills').glob('*.png'))
    if not files:
        raise SystemExit('스틸이 없다')

    rows = []
    for f in files:
        box, fill = ink_box(Image.open(f))
        if box is None:
            rows.append((f.stem, None))
            continue
        _, y0, _, y1 = box
        rows.append((f.stem, {
            'y0': y0, 'y1': y1,
            'mid': (y0 + y1) // 2,
            'top': y0,
            'bot': 1080 - y1,
            'skew': y0 - (1080 - y1),      # 음수 = 위로 솟음
            'fill': fill,
            'full': fill > 0.82,           # 화면을 거의 채운 컷 — 정렬을 논할 게 없다
        }))

    if a.csv:
        print('컷,중심,위여백,아래여백,쏠림,채움')
        for n, r in rows:
            if r:
                print(f"{n},{r['mid']},{r['top']},{r['bot']},{r['skew']},{r['fill']:.2f}")
        return

    graphic = [(n, r) for n, r in rows if r and not r['full']]
    if not graphic:
        raise SystemExit('잴 컷이 없다')

    mids = sorted(r['mid'] for _, r in graphic)
    skews = sorted(r['skew'] for _, r in graphic)
    n = len(graphic)
    print(f'{a.project} — 그래픽 컷 {n}개 (사진 꽉 찬 컷 {len(rows) - n}개는 제외)')
    print(f'  중심 중앙값 {mids[n // 2]}px   (광학 중심 {OPTICAL})')
    print(f'  쏠림 중앙값 {skews[n // 2]:+d}px  (음수 = 위로 솟음)')
    high = [x for x in graphic if x[1]['skew'] < -60]
    low = [x for x in graphic if x[1]['skew'] > 220]
    print(f'  위로 솟은 컷 {len(high)}개 · 아래가 텅 빈 컷 {len(low)}개')

    print(f'\n가장 많이 솟은 {a.top}컷 (쏠림 · 중심 · 위여백 · 아래여백)')
    for nm, r in sorted(graphic, key=lambda x: x[1]['skew'])[:a.top]:
        print(f"  {nm:22s} {r['skew']:+5d}  중심 {r['mid']:4d}  위 {r['top']:4d}  아래 {r['bot']:4d}")

    print(f'\n아래가 가장 많이 빈 {a.top}컷')
    for nm, r in sorted(graphic, key=lambda x: -x[1]['skew'])[:a.top]:
        print(f"  {nm:22s} {r['skew']:+5d}  중심 {r['mid']:4d}  위 {r['top']:4d}  아래 {r['bot']:4d}")


if __name__ == '__main__':
    main()
