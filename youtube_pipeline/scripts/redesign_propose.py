#!/usr/bin/env python3
"""재표현 제안기 — 값을 만지지 말고 표현을 바꾼다.

지난번 개선 작업은 밝기·글씨·위치만 조정했고 "크게 개선된 건 아니네" 라는
평가를 받았다. 이 도구는 그 실패를 되풀이하지 않기 위한 것이다.
컷이 **무슨 말을 하는지** 읽고, 그 말에 더 맞는 장치를 제안한다.

사용:
  python3 redesign_propose.py 올리브영성수 --diagnose        # 편중·리듬 진단
  python3 redesign_propose.py 올리브영성수 --propose         # 컷별 대안 (마크다운)
  python3 redesign_propose.py 올리브영성수 --sheet before,proposal
"""
import argparse
import collections
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 컷이 하는 말 → 더 나은 장치 (design_reference §23-15) ────────────────
# 규칙은 "무엇을 말하는가"로 고른다. 지금 무슨 카드를 쓰는지는 보지 않는다.
RULES = [
    # (이름, 판정, 제안 장치들, 왜)
    ('계산', re.compile(r'(곱하|나누|×|÷|per|평당|㎡당|합치면|더하면|빼면|환산)'),
     ['PaperFormulaCard'], '계산 과정은 항으로 늘어놓아야 따라온다'),
    ('비교', re.compile(r'(보다|대비|비해|차이|두 배|절반|최고가|가장 (높|낮|비싼|싼))'),
     ['PaperBarCard', 'PaperCompareCard'], '비교는 길이로 봐야 한다'),
    ('구성비', re.compile(r'(비중|구성|퍼센트|%|지분|점유)'),
     ['PaperShareCard'], '100%를 쪼개면 몫이 보인다'),
    ('큰수량', re.compile(r'(\d[\d,]{3,}\s*(석|명|세대|개|평|건))'),
     ['PaperDotsCard', 'FootageStatCard'], '큰 수는 읽는 게 아니라 양으로 본다'),
    ('추세', re.compile(r'(년부터|년까지|해마다|매년|추이|증가|감소|올랐|내렸)'),
     ['PaperTrendCard'], '오르내림은 선으로 봐야 읽힌다'),
    ('위치거리', re.compile(r'(도보|걸어서|분 거리|인근|바로 옆|맞은편|권역|일대)'),
     ['PaperWalkCard', 'SatelliteRouteCard', 'PaperChoroCard'], '거리는 도해로 보여야 믿는다'),
    ('층구성', re.compile(r'(\d\s*층|지하|지상|연면적|전용|입면|단면)'),
     ['PaperElevationCard', 'PaperSectionCard'], '층은 쌓아 그려야 한다'),
    ('구조지분', re.compile(r'(자산운용|SPC|펀드|시행|시공|소유권|모회사|자회사)'),
     ['PaperOrgCard', 'PaperTableCard'], '누가 위인지는 계층으로'),
    ('나열', re.compile(r'(첫째|둘째|세 가지|3가지|조건|요건|이유는|방법은)'),
     ['PaperListCard'], '나열은 한 장에 모아야 리듬이 산다'),
    ('인용', re.compile(r'(라고 (했|말|밝혔)|관계자|대표는|회장은|"|“)'),
     ['PaperQuoteCard', 'PaperPortraitCard'], '남의 말은 인용 지면에'),
    ('기사', re.compile(r'(보도|기사|뉴스|매체|신문|공시)'),
     ['PaperPressCard', 'PaperDocumentCard'], '기사는 재구성 말고 지면 위를 지나간다'),
    ('과거', re.compile(r'(예전|과거|당시|\d{4}년(대| 초| 말)|원래|옛)'),
     ['ArchiveCard', 'ThenNowCard'], '과거는 등급을 줘야 과거로 보인다'),
    ('인과', re.compile(r'(그래서|때문에|따라서|결국|이유로|영향)'),
     ['PaperFlowCard', 'PaperFlowCardV4'], '원인→결과는 흐름도로'),
]

# 브랜드·기업 이름을 잡는다 (한글 2자 이상 + 흔한 접미 / 알파벳 대문자 연속)
BRAND_HINT = re.compile(
    r'([가-힣A-Za-z][가-힣A-Za-z0-9]{1,}(?:자산운용|건설|엔지니어링|백화점|면세점|호텔|전자|증권|은행|카드|모빌리티|바이오))'
    r'|(올리브영|무신사|CJ|신세계|현대|삼성|LG|롯데|GS|SK|한화|교보|이지스|아모레|다이소|스타벅스)')

# 실사 위 자막만 얹는 계열 — 이게 많으면 표현이 하나뿐이라는 뜻
SUBTITLE_ONLY = {'LowerThirdCard', 'FullBleedCard', 'AnnotatedShotCard'}


def load(project):
    proj = os.path.join(BASE, 'projects', project)
    for name in ('scene_props.json', 'v2_scenes.json'):
        p = os.path.join(proj, name)
        if os.path.exists(p):
            d = json.load(open(p, encoding='utf-8'))
            sc = d['scenes']
            if isinstance(sc, dict):
                return proj, [dict(sc[k], id=int(k)) for k in sorted(sc, key=lambda x: int(x))]
            return proj, [dict(s, id=s.get('id', i)) for i, s in enumerate(sc)]
    raise SystemExit(f'컷 파일을 못 찾음: {proj}')


def text_of(cut):
    """컷이 화면에 말하는 모든 글자."""
    out = []

    def rec(o):
        if isinstance(o, str):
            out.append(o)
        elif isinstance(o, dict):
            for k, v in o.items():
                if k in ('media', 'image', 'video', 'backdrop', 'src', 'source', 'geo'):
                    continue
                rec(v)
        elif isinstance(o, list):
            for v in o:
                rec(v)
    rec(cut.get('props', {}))
    rec(cut.get('line', ''))
    return ' '.join(out)


def diagnose(cuts):
    n = len(cuts)
    cnt = collections.Counter(c.get('card', '?') for c in cuts)
    print(f'== 컷 {n}개 ==\n')
    print('카드 분포:')
    for k, v in cnt.most_common(10):
        flag = '  ← 편중(25% 초과)' if v / n > 0.25 else ''
        print(f'  {v:>4} ({v / n * 100:>5.1f}%) {k}{flag}')

    sub = sum(v for k, v in cnt.items() if k in SUBTITLE_ONLY)
    print(f'\n실사 위 자막만: {sub}/{n} ({sub / n * 100:.0f}%)')
    if sub / n > 0.4:
        print('  ← 화면의 절반 가까이가 "사진 + 한 줄". 설명을 그리지 않은 상태다.')

    runs, cur, best = 1, cuts[0].get('card'), []
    for c in cuts[1:]:
        if c.get('card') == cur:
            runs += 1
        else:
            if runs >= 3:
                best.append((cur, runs))
            cur, runs = c.get('card'), 1
    if runs >= 3:
        best.append((cur, runs))
    if best:
        print('\n같은 카드 3연속 이상:')
        for k, r in best[:10]:
            print(f'  {k} × {r}')

    brands = collections.Counter()
    for c in cuts:
        for m in BRAND_HINT.finditer(text_of(c)):
            brands[m.group(0)] += 1
    if brands:
        print('\n등장 기업·브랜드 (공식 광고 영상 후보):')
        for b, v in brands.most_common(8):
            print(f'  {v:>3}회  {b}')
    return cnt


def propose(cuts):
    print('# 재표현 제안\n')
    print('> 값 조정이 아니라 **표현 교체** 제안이다. 자동 초안이므로 컷을 보고 손볼 것.\n')
    n = len(cuts)
    made = 0
    for c in cuts:
        card = c.get('card', '?')
        txt = text_of(c)
        hits = [(name, alts, why) for name, rx, alts, why in RULES if rx.search(txt)]
        brands = sorted({m.group(0) for m in BRAND_HINT.finditer(txt)})
        # 자막만 얹는 카드인데 할 말이 따로 있으면 교체 대상
        weak = card in SUBTITLE_ONLY
        if not hits and not brands:
            continue
        if not weak and not brands:
            continue
        made += 1
        head = (txt[:60] + '…') if len(txt) > 60 else txt
        print(f'## cut{c["id"]:03d} — 지금 `{card}`')
        print(f'화면 문구: {head}\n')
        for name, alts, why in hits[:3]:
            print(f'- **{name}** → `{"` 또는 `".join(alts)}`  — {why}')
        for b in brands[:2]:
            print(f'- **브랜드 `{b}` 등장** → 공식 광고 영상을 `SourceClipCard` 로. '
                  f'`fetch_brand_media.py --brand "{b}" --context "<대본 키워드>"` '
                  f'(짧게 인용 + COURTESY OF 표기)')
        print()
    print(f'\n---\n제안 {made}/{n} 컷')


def sheet(proj, tags, cols=4, rows=5):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        raise SystemExit('Pillow 필요')
    a, b = tags
    da, db = os.path.join(proj, f'cuts_{a}'), os.path.join(proj, f'cuts_{b}')
    names = sorted(n for n in os.listdir(da) if n.endswith('.png'))
    tw, th, per = 470, 264, cols * rows
    made = []
    for pg in range(0, len(names), per):
        chunk = names[pg:pg + per]
        sh = Image.new('RGB', (cols * (tw * 2 + 10), rows * (th + 28)), '#0E1114')
        dr = ImageDraw.Draw(sh)
        for j, nm in enumerate(chunk):
            x, y = (j % cols) * (tw * 2 + 10), (j // cols) * (th + 28)
            for k, d in enumerate((da, db)):
                p = os.path.join(d, nm)
                if os.path.exists(p):
                    sh.paste(Image.open(p).convert('RGB').resize((tw, th)), (x + k * tw, y))
            dr.text((x + 5, y + th + 7), nm[:-4][:38], fill='#FAFF2E')
            dr.text((x + tw + 5, y + th + 7), f'← {a} | {b} →', fill='#8FE3A0')
        out = os.path.join(db, f'_비교_{a}_{b}_sheet{pg // per + 1}.jpg')
        sh.save(out, quality=84)
        made.append(out)
    print('\n'.join(made))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--diagnose', action='store_true')
    ap.add_argument('--propose', action='store_true')
    ap.add_argument('--sheet', default='', help='before,proposal')
    args = ap.parse_args()

    proj, cuts = load(args.project)
    if args.sheet:
        sheet(proj, [t.strip() for t in args.sheet.split(',')][:2])
        return 0
    if args.propose:
        propose(cuts)
        return 0
    diagnose(cuts)
    return 0


if __name__ == '__main__':
    sys.exit(main())
