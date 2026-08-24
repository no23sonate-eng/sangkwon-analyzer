#!/usr/bin/env python3
"""카드를 cardRegistry.jsx · Root.jsx **둘 다**에 등록한다.

한 쪽만 등록하면 조용히 실패한다 — MotionWrap 이 카드를 못 찾고 `#300`
(진한 빨강) 한 장을 뱉는데, 렌더는 성공으로 끝나서 알아채기까지 오래 걸린다.

예전 헬퍼의 진짜 버그: **앵커를 못 찾아도 '등록' 을 찍었다.**
`.replace()` 는 대상이 없으면 조용히 원문을 그대로 돌려준다. 카드 이름이
없다는 것만 확인했으니 통과, 치환은 no-op, 파일은 그대로 — 그래서
UnitPriceCard 가 `#300` 으로 나왔다. 여기서는 **치환 후 길이가 늘었는지**
까지 확인하고, 안 늘었으면 아무것도 쓰지 않고 죽는다.

  python3 scripts/register_card.py UnitPriceCard [--props '{"count": 0}']
"""
import argparse
import json
import pathlib
import sys

SRC = pathlib.Path(__file__).resolve().parent.parent / 'motion' / 'src'
ANCHOR = 'IsoDiagramCard'          # 두 파일 모두에 세 자리로 들어 있는 카드


def splice(path: pathlib.Path, name: str, edits: list[tuple[str, str]]) -> None:
    txt = path.read_text()
    if name in txt:
        print(f'  = {path.name}: 이미 등록됨')
        return
    for old, new in edits:
        if old not in txt:
            sys.exit(f'!! {path.name}: 앵커를 못 찾음 → {old!r}')
        before = len(txt)
        txt = txt.replace(old, new, 1)
        if len(txt) <= before:
            sys.exit(f'!! {path.name}: 치환이 안 먹음 → {old!r}')
    path.write_text(txt)
    print(f'  + {path.name}')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('name')
    ap.add_argument('--props', default='{}', help='Root.jsx 미리보기용 기본 props (JSON)')
    a = ap.parse_args()
    name = a.name
    props = json.dumps(json.loads(a.props), ensure_ascii=False)

    if not (SRC / f'{name}.jsx').exists():
        sys.exit(f'!! motion/src/{name}.jsx 가 없다')

    imp = f"import {{{name}}} from './{name}';\n"
    anchor_imp = f"import {{{ANCHOR}}} from './{ANCHOR}';\n"

    splice(SRC / 'cardRegistry.jsx', name, [
        (anchor_imp, imp + anchor_imp),
        (f'  {ANCHOR},\n', f'  {name},\n  {ANCHOR},\n'),
    ])
    splice(SRC / 'Root.jsx', name, [
        (anchor_imp, imp + anchor_imp),
        (f"        ['{ANCHOR}',", f"        ['{name}', {name}, {props}],\n        ['{ANCHOR}',"),
    ])
    print(f'{name} 등록 완료')


if __name__ == '__main__':
    main()
