#!/usr/bin/env python3
"""design.json 의 컷별 카드 확정을 scene_plan.json 에 얹고, 바로 검사한다.

plan_from_script 는 **못 고른 것을 드러내는** 도구다. 실제로 고르는 건
사람이 하고, 그 결과가 design.json 이다. 여기서는 얹기만 하는 게 아니라
얹은 결과가 규칙을 지키는지 그 자리에서 본다 — 안 그러면 렌더까지 가서야
"같은 포맷이 또 있다" 가 나온다.

검사 3가지:
  ① 같은 카드가 **연달아** 오지 않는가
  ② 한 카드가 전체의 상한(기본 10%)을 넘지 않는가
  ③ 등록되지 않은 카드 이름이 없는가  ← 이거 놓치면 렌더가 #300 한 장

  python3 scripts/apply_design.py 더그랜드롯데 [--check]
"""
import argparse
import collections
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from card_props import skeleton                                   # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHARE_MAX = 0.10

# 계열 — 어떤 카드가 **사진을 주인공으로** 쓰는가.
# 올리브영 편에서 실사 자막 카드가 67% 였던 게 문제였지만, 반대로 몰아서
# 도형만 남기면 실존 건물·인물·장소를 다루는 영상이 슬라이드가 된다.
# 채널 규칙: 실존하는 것은 사진이 먼저고, 도형은 구조·개념을 설명할 때다.
PHOTO = {'PaperImageCard', 'FullBleedCard', 'LowerThirdCard', 'AnnotatedShotCard',
         'SectionPhotoCard', 'PhotoSplitCard', 'PhotoStepsCard', 'BeforeAfterCard',
         'ArchiveCard'}          # 아카이브도 사진이 주인공이다 — 필름 처리를 얹었을 뿐
PLATE = {'MediaPlateCard', 'ArticleCard', 'NewsHeadlineCard', 'QuoteCard', 'NewsQuoteCard'}
GEO = {'MapCard', 'GeoMapCard', 'SitePlotCard'}
# 위쪽 52% 는 상한이다 — 올리브영 편이 80% 라서 "같은 포맷이 또" 가 나왔다.
# 아래쪽 25% 는 하한이다. 실존 건물·인물·장소를 다루는데 사진이 4분의 1도
# 안 되면 그건 영상이 아니라 슬라이드다. 처음엔 52% 를 목표치로 잘못 잡아
# 하한을 40% 로 뒀는데, 그러면 설명 위주 대본을 억지로 사진으로 채우게 된다.
PHOTO_BAND = (0.25, 0.52)

# 사진 자리 — 아직 소재를 안 붙인 컷을 렌더할 때 쓴다.
# 빈 문자열을 그대로 두면 <Img src=""> 가 404 로 죽어서 **그 컷만이 아니라
# 렌더 전체가 멈춘다.** 검수용 스틸을 뽑으려는데 사진 한 장 없다고 시트를
# 못 만드는 건 말이 안 된다. 회색 사선 판을 깔아 두면 "여기 사진이 아직
# 없다" 가 시트에서 한눈에 보이고, 레이아웃은 그대로 검수할 수 있다.
PLACEHOLDER = '_ph/photo.png'
IMG_KEYS = {'image', 'media', 'photo', 'before', 'after', 'bgImage', 'portrait',
            'shot', 'leftImage', 'rightImage', 'logo', 'parentLogo'}


def video_cards():
    """<OffthreadVideo> 를 쓰는 카드. 나머지는 <Img> 뿐이라 mp4 를 주면 죽는다."""
    src = ROOT / 'motion' / 'src'
    return {f.stem for f in src.glob('*Card.jsx') if 'OffthreadVideo' in f.read_text()}


def video_slots():
    """카드별로 **영상을 줘도 되는 인자**.

    카드가 직접 <Img> 를 그리지 않고 `PaperBg backdrop={bgImage}` 로 넘기면,
    그 아래 LiveBackdrop 이 확장자를 보고 OffthreadVideo 로 갈라 준다.
    그래서 같은 `bgImage` 라도 카드에 따라 안전하기도, 죽기도 한다 —
    CleoStatCard 는 bgImage 를 <Img> 에 그대로 물린다.

    카드 목록을 손으로 적어 두면 카드가 늘 때마다 이 파일이 뒤처진다.
    소스에서 `backdrop={이름}` 을 읽어 그때그때 세운다.
    """
    src = ROOT / 'motion' / 'src'
    out = {}
    for f in src.glob('*Card.jsx'):
        out[f.stem] = set(re.findall(r'backdrop=\{(\w+)\}', f.read_text()))
    return out


def registered():
    txt = (ROOT / 'motion' / 'src' / 'cardRegistry.jsx').read_text()
    return set(re.findall(r'^  (\w+Card),', txt, re.M))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--check', action='store_true', help='쓰지 않고 검사만')
    ap.add_argument('--placeholder', action='store_true',
                    help='빈 사진 자리에 회색 판을 깐다 (검수용 스틸)')
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    plan = json.loads((pdir / 'scene_plan.json').read_text())
    design = json.loads((pdir / 'design.json').read_text())['cuts']
    known = registered()

    scenes = plan['scenes']
    miss = [i for i in range(len(scenes)) if str(i) not in design]
    bad = sorted({v[0] for v in design.values() if v[0] not in known})

    for e in scenes:
        row = design.get(str(e['id']))
        if row:
            e['card'], e['_why'] = row[0], row[1]
            # plan_from_script 는 "도식이 안 나오는 문장" 을 통째로 실사(cardDur=0,
            # broll TODO.mp4)로 넘긴다. 설계에서 그 컷에 카드를 배정했다면 그
            # 판단은 뒤집힌 것이다 — 안 지우면 render_parkside 가 조용히 건너뛰고
            # (`[skip] 장면 전체가 실사`) 검수 시트에 그 컷만 빈다.
            # 더그랜드롯데 편에서 182컷 중 77컷이 이렇게 안 나왔다.
            e.pop('broll', None)
            e['cardDur'] = e['dur']

    # props 껍데기는 **확정된 카드 기준**으로 다시 만든다.
    # plan_from_script 가 만든 scene_props 는 추천 카드 기준이라, 설계로
    # 카드를 바꾸면 엉뚱한 카드의 껍데기가 남는다.
    props = {'project': a.project,
             'note': 'design.json 이 원본이다. 여기를 직접 고치지 말 것 — apply_design.py 가 덮는다.',
             'scenes': {}}
    filled = 0
    for e in scenes:
        row = design.get(str(e['id']), [e['card'], ''])
        sk = skeleton(e['card']) or {}
        given = row[2] if len(row) > 2 and isinstance(row[2], dict) else {}
        sk.update(given)
        if e.get('source') and not sk.get('source'):
            sk['source'] = e['source']          # 대본 `→` 줄에서 딸려 온 출처
        if a.placeholder:
            for k in IMG_KEYS & set(sk):
                if sk[k] == '':
                    sk[k] = PLACEHOLDER
            for arr in ('steps', 'sides', 'items'):     # 배열 안에도 사진이 산다
                for it in sk.get(arr) or []:
                    if isinstance(it, dict):
                        for k in IMG_KEYS & set(it):
                            if it[k] == '':
                                it[k] = PLACEHOLDER
        if given:
            filled += 1
        props['scenes'][str(e['id'])] = {'card': e['card'], 'props': sk,
                                         'motion': e.get('motion', {})}

    # 사진 슬롯에 영상이 들어갔나 — <Img src="…mp4"> 는 404 로 죽고,
    # 그 컷 하나가 아니라 **렌더 전체가 멈춘다.** 렌더 30분 뒤에 알게 되면
    # 늦다. 실제로 #116 에서 그렇게 한 번 멈췄다
    vc = video_cards()
    vslot = video_slots()
    misvid = []
    for e in scenes:
        if e['card'] in vc:
            continue
        safe = vslot.get(e['card'], set())      # PaperBg backdrop 으로 흘러가는 인자
        row = design.get(str(e['id']))
        for k, v in ((row[2] if row and len(row) > 2 and isinstance(row[2], dict) else {})).items():
            if k in safe:
                continue
            if isinstance(v, str) and v.lower().endswith(('.mp4', '.webm', '.mov')):
                misvid.append(f"#{e['id']} {e['card']}.{k}")

    # props 키가 그 카드에 실제로 있는가.
    # FullBleedCard 에 line1/line2 를 줘도 아무 일도 안 일어난다 — 카드는
    # 기본값으로 그려지고 렌더는 성공한다. 화면이 비었다는 걸 시트에서야
    # 알게 되고, 어느 컷인지 세어 봐야 안다. 여기서 이름으로 잡는다
    unknown = []
    for e in scenes:
        row = design.get(str(e['id']))
        given = row[2] if row and len(row) > 2 and isinstance(row[2], dict) else {}
        sk = skeleton(e['card']) or {}
        for k in given:
            if k not in sk:
                unknown.append(f"#{e['id']} {e['card']}.{k}")

    # 같은 소재를 몇 컷에서 쓰는가.
    # 채널 규칙은 **0중복**이다. 그런데 이걸 세는 데가 없어서 롯데호텔
    # 파사드 한 장이 10컷에 들어가 있는 걸 시트를 다 보고서야 알았다.
    # 소재가 모자라면 모자란다고 나와야 다음 수를 정한다
    seen = collections.defaultdict(list)

    def walk(o, cid):
        if isinstance(o, dict):
            for v in o.values():
                walk(v, cid)
        elif isinstance(o, list):
            for v in o:
                walk(v, cid)
        elif isinstance(o, str) and re.search(r'\.(jpg|jpeg|png|webp|mp4|webm|mov)$', o, re.I):
            if PLACEHOLDER not in o:
                seen[o.split('/')[-1]].append(cid)

    for e in scenes:
        row = design.get(str(e['id']))
        walk(row[2] if row and len(row) > 2 and isinstance(row[2], dict) else {}, e['id'])
    dup = sorted(((f, ks) for f, ks in seen.items() if len(ks) > 1),
                 key=lambda x: -len(x[1]))

    cards = [e['card'] for e in scenes]
    cnt = collections.Counter(cards)
    # 같은 카드가 두 컷 이어지면 대개 실수다 — 두 번째 컷이 첫 컷을 되풀이한다.
    # 다만 **일부러** 두 박자로 쪼갠 자리가 있다. #92 는 빈 칸을 보여 주고
    # #93 이 그 칸을 채운다. 같은 카드여야 "같은 사다리" 로 읽힌다.
    # 그런 자리는 design.json 의 설명(why)을 '이어서' 로 시작해서 표시한다
    def cont(i):
        row = design.get(str(scenes[i]['id']))
        return bool(row) and str(row[1]).startswith('이어서')

    runs = [(i, cards[i]) for i in range(1, len(cards))
            if cards[i] == cards[i - 1] and not cont(i)]
    over = [(c, n) for c, n in cnt.most_common() if n / len(cards) > SHARE_MAX]

    def fam(c):
        return '실사' if c in PHOTO else '자료' if c in PLATE else '지도' if c in GEO else '그래픽'
    fams = collections.Counter(fam(c) for c in cards)
    pshare = fams['실사'] / len(cards)

    print(f'{a.project} — 컷 {len(scenes)} · 카드 {len(cnt)}종')
    print(f'  최다 {cnt.most_common(1)[0][0]} {cnt.most_common(1)[0][1]}컷 '
          f'({cnt.most_common(1)[0][1] / len(cards) * 100:.0f}%)')
    ok = True
    if miss:
        ok = False
        print(f'  ✗ 설계 안 된 컷 {len(miss)}개: {miss[:12]}')
    if bad:
        ok = False
        print(f'  ✗ 등록 안 된 카드: {bad}  ← 이대로 렌더하면 #300 한 장이다')
    if unknown:
        ok = False
        print(f'  ✗ 그 카드에 없는 props {len(unknown)}건 — 조용히 무시된다: '
              + ', '.join(unknown[:10]))
    if misvid:
        ok = False
        print(f'  ✗ 사진 슬롯에 영상 {len(misvid)}건 — 렌더가 통째로 멈춘다: '
              + ', '.join(misvid[:6]))
    if runs:
        ok = False
        print(f'  ✗ 같은 카드 연속 {len(runs)}곳: ' +
              ', '.join(f'#{i}({c})' for i, c in runs[:8]))
    if over:
        ok = False
        print(f'  ✗ 상한 {SHARE_MAX:.0%} 초과: ' +
              ', '.join(f'{c} {n}컷({n / len(cards) * 100:.0f}%)' for c, n in over))
    if dup:
        ok = False
        worst = ', '.join(f'{f} {len(k)}컷' for f, k in dup[:4])
        print(f'  ✗ 같은 소재를 여러 컷에 씀 {len(dup)}건 (채널 규칙: 0중복) — {worst}')
    print(f'  소재 {len(seen)}종 / 사진·자료 컷 '
          f'{sum(1 for c in cards if c in PHOTO | PLATE)}개')
    print('  계열  ' + ' · '.join(f'{k} {v}컷({v / len(cards) * 100:.0f}%)'
                                  for k, v in fams.most_common()))
    if not PHOTO_BAND[0] <= pshare <= PHOTO_BAND[1]:
        ok = False
        which = '적다 — 실존 건물·장소를 도형으로 그리고 있다' if pshare < PHOTO_BAND[0] \
            else '많다 — 사진 위 자막으로 때우고 있다'
        print(f'  ✗ 실사 계열 {pshare:.0%} · 권장 {PHOTO_BAND[0]:.0%}~{PHOTO_BAND[1]:.0%} 보다 {which}')
    if ok:
        print('  ✓ 연속 없음 · 상한 이내 · 전부 등록된 카드')

    print(f'  내용 채운 컷 {filled}/{len(scenes)}')
    if not a.check:
        (pdir / 'scene_plan.json').write_text(
            json.dumps(plan, ensure_ascii=False, indent=1))
        (pdir / 'scene_props.json').write_text(
            json.dumps(props, ensure_ascii=False, indent=1))
        print(f'  → scene_plan.json · scene_props.json 갱신')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
