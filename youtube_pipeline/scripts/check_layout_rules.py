#!/usr/bin/env python3
"""카드가 **글자를 겹치게 놓는 습관**을 소스에서 잡는다.

렌더된 그림을 눈으로 훑어 겹침을 찾는 건 182컷마다 다시 해야 한다.
겹침은 대부분 한 가지 습관에서 나온다 — **좌표를 손으로 적는 것.**

  const bandTop = title ? 244 : 190;      ← 제목 높이가 바뀌면 그날로 낡는다
  <div style={{top: 300}}>                ← 사진 밝기·글자 수와 무관하게 고정

실제로 이 저장소에서 나온 겹침은 전부 이 꼴이었다:
  · PaperTitle 기본 top 을 138→196 으로 내리자 28종의 상수가 한꺼번에 낡았다
  · PhotoSplitCard 이름이 300 에 박혀 있어 위로 솟고 아래가 비었다 (#152·#163)
  · LogoOrgCard 부제 212 / 부모 상자 232 — 상자가 부제를 덮었다 (#129)
  · RatioCard 라벨 288 고정 + 상자 너비 1600 — 라벨끼리 겹쳤다 (#22)

그래서 **숫자를 세는 게 아니라 유래를 본다.** 세로 좌표는
`stageTop()` · `titleBottom()` · `'50%'` 중 하나에서 나와야 한다.

    python3 scripts/check_layout_rules.py            # 전부
    python3 scripts/check_layout_rules.py BrandCard  # 한 장
"""
import pathlib
import re
import sys

SRC = pathlib.Path(__file__).resolve().parent.parent / 'motion' / 'src'

# **제목과 부딪힐 수 있는 띠만** 본다.
#   200 미만  제목·출처 자리. 카드가 직접 정하는 게 맞다
#   700 이상  캡션·판정 배지 자리. 아래에 붙어 있는 게 제 역할이라 고정이 맞다
# 이 두 곳까지 잡으면 경고가 스물여섯 줄 나오고, 그중 스물이 정상이다.
# 다 맞는 말처럼 보이는 경고는 안 보게 된다 — 실제로 "실사 25% 미만" 경고를
# 그렇게 흘려보냈다. 잡을 것만 잡는다
LO, HI = 200, 700

# `top: 540 - 540 * k` 처럼 **뒤에 식이 이어지면** 고정값이 아니다
HARD_TOP = re.compile(r"top:\s*(\d{3})(?!\s*[-+*/\d])")
DERIVED = ('stageTop', 'titleBottom', 'CONTENT_BOTTOM', 'OPTICAL_CENTER')
# 아래에 붙는 게 제 역할인 것들 — 이름으로 걸러 낸다
BOTTOM_ROLE = ('caption', 'verdict', 'note', 'footnote', 'source')


def check(path):
    txt = path.read_text()
    hits = []
    for m in HARD_TOP.finditer(txt):
        y = int(m.group(1))
        if not (LO <= y <= HI):
            continue
        line = txt.count('\n', 0, m.start()) + 1
        src = txt[max(0, m.start() - 260):m.start()]
        # 같은 식 안에서 이미 유도값을 쓰고 있으면 고정값이 아니다
        if any(d in src for d in DERIVED):
            continue
        if any(w in src[-160:].lower() for w in BOTTOM_ROLE):
            continue
        hits.append((line, y))
    return hits


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    bad = 0
    for f in sorted(SRC.glob('*.jsx')):
        if only and only not in f.name:
            continue
        hits = check(f)
        if not hits:
            continue
        bad += len(hits)
        where = ' · '.join(f'{ln}행 top:{y}' for ln, y in hits)
        print(f'  ✗ {f.name:26s} {where}')
    if bad:
        print(f'\n세로 좌표를 손으로 적은 자리 {bad}곳 — '
              'stageTop() · titleBottom() · 50% 중 하나에서 유도할 것')
    else:
        print('✓ 세로 좌표를 손으로 적은 카드 없음')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
