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

# ── 설계상 글자가 구조 위에 앉는 카드 ────────────────────────────────────
# StrikeSwapCard 는 취소선이 글자를 **지나가는 것**이 문법이다 — 22컷이 전부
# 걸렸다. 사진 위 자막(StageCard 실사, PhotoSplitCard)은 스크림을 깔고 글자를
# 얹는 카드라 사진의 구조가 글자 밑에 있는 게 당연하다. 이건 규칙 13 의
# '잘못 겹침'이 아니라 그 카드가 하는 일이다. 안 재고, 안 쟀다고 센다.
# StageCard 라도 onPaper(종이 톤 개념도)는 잰다 — #45·#138 이 거기서 났다
BY_DESIGN = {'StrikeSwapCard', 'PhotoSplitCard', 'ArchiveCard', 'FullBleedCard', 'LowerThirdCard'}


def edges(im):
    g = np.asarray(im.convert('L'), dtype=np.float32)
    gx = np.abs(np.diff(g, axis=1, prepend=g[:, :1]))
    gy = np.abs(np.diff(g, axis=0, prepend=g[:1, :]))
    return np.maximum(gx, gy)


def dilate(mask, r):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.MaxFilter(2 * r + 1))) > 0


def measure(a_path, b_path):
    A = Image.open(a_path).convert('RGB')
    B = Image.open(b_path).convert('RGB')
    if A.size != B.size:
        return None
    a = np.asarray(A, dtype=np.int16)
    b = np.asarray(B, dtype=np.int16)
    text = np.abs(a - b).max(axis=2) > TEXT_DIFF
    text[:SOURCE_STRIP, :] = False
    n_text = int(text.sum())
    if n_text < 400:                       # 글자가 사실상 없다
        return {'text': n_text, 'skip': '글자 없음'}
    zone = dilate(text, DILATE)
    # 글자를 끈 프레임의 구조. 글자 자리 **바로 밑**의 가장자리만 본다
    e = edges(B) > GRAD
    e[:SOURCE_STRIP, :] = False
    hit = zone & e
    n_hit = int(hit.sum())
    ratio = n_hit / max(1, int(zone.sum()))
    ys, xs = np.where(hit)
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if n_hit else None
    # ── 두 번째 기준: 선이 글자를 가로지르는가 ─────────────────────────────
    # 양성 대조(#45 "60m" 을 점선 위에 얹음)가 비율로는 2.2% 였다. 점선은
    # 가늘어서 글자 자리 18,000px 중 411px 뿐이다. 비율은 **면**의 겹침만 본다.
    # 선 겹침은 겹친 픽셀이 얼마나 **뻗어 있는가**로 잡는다 — 191px 가로로.
    reach = max(box[2] - box[0], box[3] - box[1]) if box else 0
    return {'text': n_text, 'zone': int(zone.sum()), 'hit': n_hit, 'ratio': ratio,
            'box': box, 'reach': reach}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--tol', type=float, default=0.12,
                    help='글자 자리 중 구조가 차지하는 비율 상한')
    ap.add_argument('--ids', type=int, nargs='*')
    ap.add_argument('--reach', type=int, default=60,
                    help='겹친 픽셀이 이만큼(px) 뻗어 있으면 선이 글자를 가로지른 것')
    ap.add_argument('--min-px', type=int, default=120,
                    help='선 겹침으로 치려면 겹친 픽셀이 최소 이만큼')
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
        line_cross = m['hit'] >= a.min_px and m['reach'] >= a.reach
        if m['ratio'] > a.tol or line_cross:
            rows.append((sid, card, m))
        if a.verbose:
            print(f'    #{sid:3d} {card:18s} ratio {m["ratio"]:.3f} hit {m["hit"]:5d} reach {m["reach"]:4d}')

    print(f'{a.project} — 글자 있는 컷 {seen}개 검사 (구조 비율 상한 {a.tol:.0%})')
    for sid, card, m in rows:
        x0, y0, x1, y1 = m['box']
        kind = '면' if m['ratio'] > a.tol else '선'
        print(f'  #{sid:3d} {card:18s} {kind} 겹침 — 구조 {m["ratio"]:.0%} · 겹친 픽셀 {m["hit"]} · '
              f'뻗음 {m["reach"]}px  (x {x0}~{x1} · y {y0}~{y1})')
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
