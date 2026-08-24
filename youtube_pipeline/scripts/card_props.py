#!/usr/bin/env python3
"""카드 JSX 의 인자 기본값을 읽어 props 빈 껍데기를 만든다.

plan_from_script.py 의 SKELETON 은 손으로 적은 표라 26종밖에 없다.
카드는 81종이고 계속 는다. 손표는 반드시 뒤처지고, 뒤처진 자리는
`{}` 로 나가서 카드가 기본값으로 렌더된다 — 화면엔 아무것도 없는데
렌더는 성공해서 알아채기까지 오래 걸린다.

카드는 전부 이렇게 생겼다:

    export const FooCard = ({
      title = '', sub = '',
      items = [], hot = -1,
      ...
    }) => {

여는 괄호부터 `}) =>` 까지를 잘라서 `이름 = 기본값` 을 읽는다.
주석과 문자열 안의 쉼표·중괄호를 피해야 해서 한 글자씩 센다.

  python3 scripts/card_props.py UnitDensityCard
  python3 scripts/card_props.py --all
"""
import argparse
import json
import pathlib
import re
import sys

SRC = pathlib.Path(__file__).resolve().parent.parent / 'motion' / 'src'


def _strip(s):
    """주석과 문자열을 공백으로 덮는다. 길이는 유지해 위치가 안 어긋나게."""
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '/' and i + 1 < n and s[i + 1] == '/':
            j = s.find('\n', i)
            j = n if j < 0 else j
            out.append(' ' * (j - i)); i = j
        elif c == '/' and i + 1 < n and s[i + 1] == '*':
            j = s.find('*/', i + 2)
            j = n if j < 0 else j + 2
            out.append(' ' * (j - i)); i = j
        elif c in '\'"`':
            j = i + 1
            while j < n and s[j] != c:
                j += 2 if s[j] == '\\' else 1
            j = min(j + 1, n)
            out.append(c + ' ' * (j - i - 2) + c if j - i >= 2 else s[i:j])
            i = j
        else:
            out.append(c); i += 1
    return ''.join(out)


def _split_top(s):
    """중첩 괄호를 지나 최상위 쉼표로 자른 **구간**을 돌려준다.

    자른 문자열이 아니라 (시작, 끝) 을 준다. 자르는 건 주석·문자열을 지운
    사본에서 하고 값은 원문에서 읽어야 하는데, 둘을 따로 자르면 원문 쪽
    문자열 안의 쉼표까지 세어 조각 수가 어긋난다. 같은 구간을 양쪽에
    쓰면 어긋날 데가 없다.
    """
    spans, depth, start = [], 0, 0
    for i, c in enumerate(s):
        if c in '([{':
            depth += 1
        elif c in ')]}':
            depth -= 1
        elif c == ',' and depth == 0:
            spans.append((start, i)); start = i + 1
    if s[start:].strip():
        spans.append((start, len(s)))
    return spans


def _value(raw, blank):
    """JSX 기본값 → JSON 값. 문자열·숫자·참거짓·빈 배열/객체만 본다."""
    v = raw.strip()
    if v in ('', 'undefined', 'null'):
        return None
    if v in ('true', 'false'):
        return v == 'true'
    if re.fullmatch(r'-?\d+(\.\d+)?', v):
        return float(v) if '.' in v else int(v)
    if re.fullmatch(r'''['"`].*['"`]''', v, re.S):
        return '' if blank else v[1:-1]
    if v.startswith('['):
        return []
    if v.startswith('{'):
        return {}
    return None


def skeleton(card, blank=True):
    """카드 하나의 props 빈 껍데기. blank 면 문자열 기본값을 ''로 비운다."""
    f = SRC / f'{card}.jsx'
    if not f.exists():
        return None
    txt = _strip(f.read_text())
    m = re.search(rf'export const {card} = \(\{{', txt)
    if not m:
        return None
    i, depth = m.end() - 1, 0
    for j in range(i, len(txt)):
        if txt[j] == '{':
            depth += 1
        elif txt[j] == '}':
            depth -= 1
            if depth == 0:
                break
    else:
        return None
    raw = (SRC / f'{card}.jsx').read_text()[m.end():j]     # 값은 원문에서 읽는다
    args = _strip(raw)
    out = {}
    for s, e in _split_top(args):
        part = args[s:e]
        if '=' not in part:
            continue
        k = part.index('=')
        name = part[:k].strip()
        if not re.fullmatch(r'\w+', name):
            continue
        # 무대 설정은 컷마다 채우는 값이 아니다 — 껍데기에서 뺀다
        if name in ('theme', 'bg', 'children'):
            continue
        out[name] = _value(raw[s + k + 1:e], blank)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('card', nargs='?')
    ap.add_argument('--all', action='store_true')
    a = ap.parse_args()
    if a.all:
        names = sorted(p.stem for p in SRC.glob('*Card.jsx'))
        bad = [n for n in names if skeleton(n) is None]
        print(f'{len(names)}종 중 {len(names) - len(bad)}종 읽음')
        if bad:
            print('  못 읽음:', ', '.join(bad))
        return
    if not a.card:
        sys.exit('카드 이름을 달라')
    s = skeleton(a.card)
    if s is None:
        sys.exit(f'{a.card} 를 못 읽었다')
    print(json.dumps(s, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
