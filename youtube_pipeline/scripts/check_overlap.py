#!/usr/bin/env python3
"""글자가 선·도형·사진의 **구조 위에** 앉은 컷을 기계로 찾는다.

왜 생겼나
  힉스필드 개념도를 StageCard 에 올리자 "60m" 이 점선과 막대 위에, "직경 8m" 이
  노란 기둥 위에 앉았다(#45·#138). 눈으로 잡았지만 269컷을 매번 눈으로 볼 수는
  없다. 사용자 규칙: **도형·이미지·글자는 절대 잘못 겹치지 않는다.**

어떻게 재나
  같은 프레임을 두 번 굽는다 — 보통 스틸(stills/)과 글자만 투명하게 한 스틸
  (stills_notext/, `render_parkside.py --still --no-text`). 둘의 차이가 **글자
  픽셀**이다. 글자를 끈 프레임에서 **구조**(선·도형 가장자리·다른 글자가 아닌 것)
  를 잡아, 글자 픽셀을 조금 부풀린 자리에 구조가 얼마나 있는지 센다.

  글자 자리의 구조 비율이 --tol 을 넘으면 걸린다. 사진 위 글자(StageCard 실사)는
  스크림 아래라 가장자리가 약해서 잘 안 걸리고, 선 위 글자·막대 위 글자·
  그림 위 글자는 확실히 걸린다.

무엇을 못 잡나 — 정직하게
  · 글자 없는 컷은 잴 게 없다 (건너뛰고 **센다**)
  · 두 스틸 중 하나가 없으면 못 잰다 (건너뛰고 **센다**)
  · 도형과 도형의 겹침은 글자가 아니라 여기 안 걸린다
  안 잰 건 통과가 아니다. 건너뛴 개수를 끝에 찍는다.

    python3 scripts/render_parkside.py --still --project 니시아자부
    python3 scripts/render_parkside.py --still --no-text --project 니시아자부
    python3 scripts/check_overlap.py 니시아자부 [--tol 0.12] [--ids 45 138]
"""
import argparse
import json
import pathlib
import re
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE_STRIP = 100      # 우상단 출처 띠 — 늘 글자라 뺀다
TEXT_DIFF = 28          # 두 스틸의 화소 차이가 이보다 크면 글자
GRAD = 34               # 구조(가장자리) 문턱 — check_balance 와 같은 생각
DILATE = 5              # 글자를 이만큼 부풀려 '글자 자리'로 본다 (간격까지 본다)
LINE_FILL = 0.45        # 글자 상자 안 한 줄(열)에 구조가 이만큼 깔리면 선이 가로지른 것

# ── 설계상 글자가 구조 위에 앉는 카드 ────────────────────────────────────
# StrikeSwapCard 는 취소선이 글자를 **지나가는 것**이 문법이다 — 22컷이 전부
# 걸렸다. 사진 위 자막(StageCard 실사, PhotoSplitCard)은 스크림을 깔고 글자를
# 얹는 카드라 사진의 구조가 글자 밑에 있는 게 당연하다. 이건 규칙 13 의
# '잘못 겹침'이 아니라 그 카드가 하는 일이다. 안 재고, 안 쟀다고 센다.
# StageCard 라도 onPaper(종이 톤 개념도)는 잰다 — #45·#138 이 거기서 났다
# 지도 지명은 도로·경계 위에 앉는 게 지도의 문법이다 (#15·#17·#18 이 걸렸다)
BY_DESIGN = {'StrikeSwapCard', 'PhotoSplitCard', 'ArchiveCard', 'FullBleedCard', 'LowerThirdCard',
             'MapCard', 'GeoMapCard'}


def edges(im):
    g = np.asarray(im.convert('L'), dtype=np.float32)
    gx = np.abs(np.diff(g, axis=1, prepend=g[:, :1]))
    gy = np.abs(np.diff(g, axis=0, prepend=g[:1, :]))
    return np.maximum(gx, gy)


def erode(mask, r):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.MinFilter(2 * r + 1))) > 0


def dilate(mask, r):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.MaxFilter(2 * r + 1))) > 0


def blobs(mask, step=4, pad=0):
    """마스크의 연결 덩어리 상자들. step 으로 줄여서 8방향 BFS — 글자 수백 개도 금방."""
    m = mask[::step, ::step]
    H, W = m.shape
    seen = np.zeros_like(m, dtype=bool)
    out = []
    ys, xs = np.where(m)
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]; seen[y0, x0] = True
        miny = maxy = y0; minx = maxx = x0; n = 0
        while stack:
            y, x = stack.pop(); n += 1
            miny, maxy, minx, maxx = min(miny, y), max(maxy, y), min(minx, x), max(maxx, x)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True; stack.append((yy, xx))
        out.append((max(0, minx * step - pad), max(0, miny * step - pad),
                    min(mask.shape[1], (maxx + 1) * step + pad), min(mask.shape[0], (maxy + 1) * step + pad), n))
    return out


def measure(a_path, b_path):
    """글자 덩어리(단어·줄)마다, 그 상자 안을 선이 가로지르는지 / 구조가 얼마나 깔렸는지.

    겹친 픽셀을 뭉쳐 '뻗음'을 재던 방식은 둘 다 틀렸다 — 전체 bbox 는 멀리 떨어진
    점 둘을 431px 선으로 만들었고(#196), 덩어리별 bbox 는 점선 위 글자를 획마다
    끊어 22px 로 만들었다(#45 양성 대조). 선은 **글자 상자를 가로지르는가**로 본다:
    상자 안에서 한 줄(또는 한 열)에 구조가 상자 폭의 LINE_FILL 이상 깔리면 선이다.
    점선은 ~60%, 실선은 100%, 범례 네모 테두리는 ~7% 다.
    """
    A = Image.open(a_path).convert('RGB')
    B = Image.open(b_path).convert('RGB')
    if A.size != B.size:
        return None
    a = np.asarray(A, dtype=np.int16)
    b = np.asarray(B, dtype=np.int16)
    text = np.abs(a - b).max(axis=2) > TEXT_DIFF
    text[:SOURCE_STRIP, :] = False
    # 글자를 끈 프레임에서 **이미 강한 가장자리인 픽셀은 글자가 아니다.** 노란 조각·
    # 원 테두리는 두 렌더 사이에 안티앨리어싱이 미세하게 달라 '글자'로 잡힌다
    e = edges(B) > GRAD
    e[:SOURCE_STRIP, :] = False
    # 화면 끝에서 끝까지 이어지는 선은 **종이 격자**다(청사진 테마의 굵은 기준선).
    # 글자는 격자 위에 앉는 게 종이의 문법이라 구조로 세지 않는다. 카드가 그리는
    # 선(레일·축·칸 테두리)은 화면 폭의 75% 를 안 넘으니 남는다. #224 가 걸렸다
    full_rows = e.sum(axis=1) > e.shape[1] * 0.9
    full_cols = e.sum(axis=0) > e.shape[0] * 0.9
    e[full_rows, :] = False
    e[:, full_cols] = False
    text &= ~dilate(e, 1)
    text = erode(text, 1)                  # 2~5px 슬리버 제거. 글자 획은 3px 이상이다
    n_text = int(text.sum())
    if n_text < 400:
        return {'text': n_text, 'skip': '글자 없음'}
    worst = {'text': n_text, 'ratio': 0.0, 'fill': 0.0, 'box': None, 'kind': ''}
    # 글자를 단어·줄로 뭉친다 (12px 이면 글자 사이는 붙고 다른 줄은 안 붙는다)
    # 상자 여유 3px — 5 로 두니 이름표 상자 테두리(글자에서 14px, 설계)가 걸렸다(#44·#151).
    # 글자를 뭉치는 12px 도 10 으로: 12+5=17 이 테두리에 닿았다
    for x0, y0, x1, y1, _ in blobs(dilate(text, 10), step=4, pad=3):
        w, h = x1 - x0, y1 - y0
        if w < 24 or h < 24:
            continue
        sub = e[y0:y1, x0:x1]
        ratio = float(sub.mean())                     # 상자 안 구조 비율 (면 겹침)
        rows = sub.sum(axis=1) / max(1, w)            # 한 줄이 상자 폭을 얼마나 채우나
        cols = sub.sum(axis=0) / max(1, h)
        fill = float(max(rows.max() if w >= 40 else 0, cols.max() if h >= 40 else 0))
        if ratio > worst['ratio'] or fill > worst['fill']:
            if fill >= worst['fill'] or ratio > worst['ratio']:
                worst.update({'ratio': max(ratio, worst['ratio']), 'fill': max(fill, worst['fill']),
                              'box': (x0, y0, x1, y1) if (fill >= LINE_FILL or ratio > worst['ratio']) else worst['box']})
    return worst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--tol', type=float, default=0.12,
                    help='글자 자리 중 구조가 차지하는 비율 상한')
    ap.add_argument('--ids', type=int, nargs='*')
    ap.add_argument('--verbose', '-v', action='store_true')
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    design = json.loads((pdir / 'design.json').read_text(encoding='utf-8'))['cuts']
    A_DIR, B_DIR = pdir / 'stills', pdir / 'stills_notext'
    if not B_DIR.exists():
        sys.exit('stills_notext 가 없다 — render_parkside.py --still --no-text 를 먼저 돌려라')

    rows, skipped, seen, bydesign = [], [], 0, []
    for f in sorted(A_DIR.glob('*.png'), key=lambda p: int(re.match(r'sec(\d+)', p.name).group(1))):
        sid = int(re.match(r'sec(\d+)', f.name).group(1))
        if a.ids and sid not in a.ids:
            continue
        g = B_DIR / f.name
        row = design.get(str(sid)) or ['?', '', {}]
        card = row[0]
        props = row[2] if len(row) > 2 and isinstance(row[2], dict) else {}
        if card in BY_DESIGN or (card == 'StageCard' and not props.get('onPaper')):
            bydesign.append((sid, card))
            continue
        if not g.exists():
            skipped.append((sid, card, 'notext 스틸 없음'))
            continue
        m = measure(f, g)
        if m is None:
            skipped.append((sid, card, '두 스틸 크기가 다르다'))
            continue
        if m.get('skip'):
            skipped.append((sid, card, m['skip']))
            continue
        seen += 1
        # 면 겹침(비율) 또는 선 겹침(뻗은 길이 + 최소 픽셀) — 둘 중 하나면 걸린다
        line_cross = m['fill'] >= LINE_FILL
        if m['ratio'] > a.tol or line_cross:
            rows.append((sid, card, m))
        if a.verbose:
            print(f'    #{sid:3d} {card:18s} 면 {m["ratio"]:.3f} · 선 채움 {m["fill"]:.2f}')

    print(f'{a.project} — 글자 있는 컷 {seen}개 검사 (구조 비율 상한 {a.tol:.0%})')
    for sid, card, m in rows:
        x0, y0, x1, y1 = m['box'] or (0, 0, 0, 0)
        kind = '면' if m['ratio'] > a.tol else '선'
        print(f'  #{sid:3d} {card:18s} {kind} 겹침 — 구조 {m["ratio"]:.0%} · 선 채움 {m["fill"]:.0%}  (글자 상자 x {x0}~{x1} · y {y0}~{y1})')
    print(f'  걸린 컷 {len(rows)}개' if rows else '  글자가 구조 위에 앉은 컷 없음')
    if bydesign:
        from collections import Counter
        kc = Counter(c for _, c in bydesign)
        print(f'  설계상 글자가 구조 위에 앉는 카드 {len(bydesign)}컷 — 안 쟀다: '
              + ' · '.join(f'{c} {n}' for c, n in kc.most_common()))
    if skipped:
        kinds = {}
        for _, _, why in skipped:
            kinds[why] = kinds.get(why, 0) + 1
        print(f'  못 잰 컷 {len(skipped)}개 — 이건 통과가 아니다: '
              + ' · '.join(f'{k} {v}' for k, v in kinds.items()))
    return 1 if rows else 0


if __name__ == '__main__':
    sys.exit(main())
