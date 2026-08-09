#!/usr/bin/env python3
"""스크립트(txt/md) → scene_plan.json + scene_props.json 초안.

지금까지 두 영상 모두 장면 분할·타이밍·카드 선택을 손으로 했다. 그 첫 8할을
자동으로 깔아 두고, 사람은 **고르고 다듬기만** 하게 만든다.

하는 일
  1) 문단(빈 줄) → 섹션, 문장 묶음 → 장면
  2) 낭독 길이 추정: 한글 5.3자/초 (숫자·영문은 읽는 시간이 길어 가중)
  3) 리텐션 규칙 적용 — 15초 넘는 장면은 자동으로 [카드 + 실사] 로 쪼개고,
     첫 30초에 컷이 3개 미만이면 앞쪽을 더 잘게 나눈다
  4) 문장을 읽어 **카드 종류를 추천** (숫자 비교/연도/대립/사진…)
  5) scene_props.json 은 추천 카드의 빈 껍데기까지 만들어 준다

    python3 youtube_pipeline/scripts/plan_from_script.py 스크립트.md --project 새프로젝트
    python3 youtube_pipeline/scripts/plan_from_script.py 스크립트.md --project X --dry

주의: 초안이다. 수치·라벨은 채워야 하고 카드 추천은 틀릴 수 있다.
      만든 뒤 반드시 `qa_check.py` 를 돌린다.
"""
import argparse, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 낭독 속도 (자/초). 파크사이드 확정 타이밍(443.5초)에 맞춰 역산한 값 —
# 5.3 으로 두면 4% 길게 나온다. 새 영상에서 어긋나면 여기만 고친다.
CPS = 5.53
GAP = 0.4            # 문단(섹션)이 바뀔 때의 호흡
GAP_IN = 0.15        # 같은 문단 안에서 장면만 나뉠 때 — 여기서 0.4 를 주면
                     # 한 문단을 읽다 말고 쉬는 꼴이 되고 전체 길이가 부풀어 오른다
# ── 컷 밀도 ──────────────────────────────────────────────────────────────
# 파크사이드 1편은 평균 10.0초였다. 설명 영상이라도 화면이 그렇게 오래 안 바뀌면
# 늘어진다. 목표를 **평균 5초 안팎**으로 내리고, 문장뿐 아니라 **절(쉼표)** 에서도
# 끊는다. 내레이션은 그대로 두고 화면만 더 자주 바뀌게 하는 게 요점이다.
MAX_CUT = 10.0       # 한 컷 최대 (넘으면 실사로 쪼갠다)
SPLIT_AT = 6.0       # 이 길이를 넘기면 문장 경계에서 나눈다
CLAUSE_AT = 6.5      # 한 문장이 이보다 길면 **쉼표에서도** 나눈다
MIN_CUT = 1.8        # 이보다 짧은 조각만 앞에 붙인다.
                     # 2초짜리 마무리 절("전면 경영제휴입니다")은 오히려 리듬을 만든다 —
                     # 여기를 2.2 로 두면 그런 절이 앞 컷에 붙어 7초짜리가 된다
OPENING_SEC = 30.0
OPENING_MIN_CUTS = 3

# ── 카드 추천 규칙 ───────────────────────────────────────────────────────
# (정규식, 카드, 왜) — 위에서부터 먼저 맞는 것을 쓴다. 구체적인 규칙이 위로.
# 구체적인 규칙이 위. 아래로 갈수록 느슨하다.
# 연도는 이 장르 스크립트에 늘 깔려 있어서, 단순 날짜 언급으로 타임라인이
# 잡히지 않도록 "기간을 말하는 단어"를 같이 요구한다.
RULES = [
    (r'(\d+)\s*(위|등)[^.]{0,40}?(\d+)\s*(위|등)', 'RankTrendCard', '순위 변화'),
    (r'(지하\s*\d+\s*층|지상\s*\d+\s*층|연면적|대지면적)', 'SectionPhotoCard', '층수·면적 = 단면'),
    (r'(엘리베이터|위아래로|층층이|아래로 내려가|수직으로)', 'ElevatorCard', '수직 이동'),
    (r'(기부 대 양여|맞바꾸|넘겨줍니다|넘겨준다|양여)', 'ExchangeMotionCard', '주고받기'),
    (r'(vs|반대했|대립|논쟁|갈등|맞섰|원했습니다.{0,40}반대)', 'ExchangeMotionCard', '두 주체의 대립'),
    (r'(\d{4})년[^.]{0,80}?(\d{4})년[^.]{0,40}?(걸렸|끝났|기간|만에|착공|준공|완공)', 'TimelineRailCard', '기간 비교 = 시간축'),
    (r'(\d+(\.\d+)?)\s*%[^.]{0,60}?(\d+(\.\d+)?)\s*%', 'RatioCard', '비율 비교'),
    (r'(\d+(\.\d+)?)\s*대\s*1|경쟁률', 'BigStatsCard', '경쟁률·큰 수치'),
    (r'(\d+[조억][^.]{0,60}?){3}', 'SkylineCompareCard', '금액 3개 비교'),
    (r'(\d+[조억][^.]{0,60}?){2}', 'SkylineCompareCard', '금액 2개 비교'),
    (r'(첫째|둘째|셋으로 나눴|세 단계|차례로|그리고 나서)', 'PhotoStepsCard', '순서 있는 단계'),
    (r'(\d[\d,]*)\s*(평|㎡|제곱미터|헥타르)[^.]{0,60}?(\d[\d,]*)\s*(평|㎡|제곱미터|헥타르)', 'AreaNestCard', '면적 비교'),
    (r'(개발사|운영사|반면|정반대|분리돼|나뉘어)', 'SplitCard', '둘로 갈리는 대비'),
    (r'(준공은|입주는|예정입니다|남은 일정)', 'TimelineRailCard', '앞으로의 일정'),
    (r'(사진|보시면|모습을|전경|현장)', 'FullBleedCard', '사진 한 장으로'),
]
DEFAULT_CARD = 'PaperImageCard'

# 카드별 최소 props 껍데기 — 사람이 값만 채우면 되게
SKELETON = {
    'SkylineCompareCard': {'title': '', 'sub': '', 'buildings': [
        {'label': '', 'value': 0.5, 'note': '', 'shape': 'slab', 'tone': 0},
        {'label': '', 'value': 1.0, 'note': '', 'shape': 'slender', 'hot': True}], 'note': '', 'source': ''},
    'RatioCard': {'title': '', 'sub': '', 'unit': '%', 'items': [
        {'label': '', 'pct': 0, 'sub': '', 'hot': True}, {'label': '', 'pct': 0, 'sub': ''}], 'source': ''},
    'TimelineRailCard': {'title': '', 'sub': '', 'axis': {'from': 2000, 'to': 2030, 'step': 5},
                         'rails': [{'label': '', 'from': 2000, 'to': 2010, 'note': '', 'hot': True}], 'source': ''},
    'ExchangeMotionCard': {'title': '', 'sub': '',
                           'left': {'wordmark': '', 'label': '', 'sub': ''},
                           'right': {'wordmark': '', 'label': '', 'sub': ''},
                           'give': {'icon': 'base', 'label': '', 'sub': ''},
                           'get': {'icon': 'land', 'label': '', 'sub': ''}, 'source': ''},
    'BigStatsCard': {'title': '', 'sub': '', 'items': [
        {'display': '', 'unit': '', 'label': ''}, {'display': '', 'unit': '', 'label': '', 'hot': True}], 'source': ''},
    'RankTrendCard': {'title': '', 'sub': '', 'points': [{'x': '', 'rank': 1}], 'worst': 5,
                      'caption': '', 'source': ''},
    'SectionPhotoCard': {'title': '', 'sub': '', 'above': {'floors': 0, 'label': '지상', 'note': ''},
                         'below': {'floors': 0, 'label': '지하', 'note': ''}, 'bands': [], 'source': ''},
    'ElevatorCard': {'title': '', 'sub': '', 'stops': [{'floor': '', 'label': '', 'sub': ''}], 'source': ''},
    'PhotoStepsCard': {'title': '', 'sub': '', 'steps': [
        {'icon': 'books', 'label': '', 'sub': ''}], 'gapScale': 0.6, 'source': ''},
    'AreaNestCard': {'title': '', 'sub': '', 'unit': '평', 'items': [
        {'label': '', 'value': 1, 'display': '', 'hot': True}], 'multipleNote': '', 'source': ''},
    'SplitCard': {'title': '', 'left': {'label': '', 'sub': '', 'lines': []},
                  'right': {'label': '', 'sub': '', 'lines': []}, 'verdict': '', 'source': ''},
    'FullBleedCard': {'image': '', 'headline': '', 'sub': '', 'scrim': 0.42, 'source': ''},
    'PaperImageCard': {'title': '', 'image': '', 'ratio': 1.778, 'caption': '', 'source': ''},
}


_cps = CPS


def speak_sec(text):
    """낭독 길이 추정. 한글은 CPS, 숫자·영문은 또박또박 읽어 1.6배 가중."""
    ko = len(re.findall(r'[가-힣]', text))
    num = len(re.findall(r'[0-9A-Za-z]', text))
    punct = len(re.findall(r'[,·]', text)) * 0.15 + len(re.findall(r'[.?!]', text)) * 0.35
    return (ko + num * 1.6) / _cps + punct


def split_sentences(par):
    """문장 단위로 쪼갠다 (한국어 종결어미 + 마침표)."""
    parts = re.split(r'(?<=[.?!])\s+', par.strip())
    return [p.strip() for p in parts if p.strip()]


def split_clauses(sent):
    """긴 문장을 쉼표에서 절로 나눈다.

    숫자 안의 쉼표(1만3,600)에서 끊으면 안 되므로 자리표시자로 잠시 치환한다.
    조각이 MIN_CUT 보다 짧으면 앞 절에 도로 붙인다 — 0.8초짜리 컷은 튄다.
    """
    if speak_sec(sent) <= CLAUSE_AT:
        return [sent]
    masked = re.sub(r'(?<=\d),(?=\d)', '\x00', sent)
    parts = [p.strip() for p in re.split(r'(?<=,)\s*', masked) if p.strip()]
    out = []
    for p in parts:
        p = p.replace('\x00', ',')
        if out and speak_sec(p) < MIN_CUT:
            out[-1] = (out[-1] + ' ' + p).strip()
        else:
            out.append(p)
    return out


def build_scenes(sections):
    """섹션(문단) → 장면. 장면이 너무 길면 문장 경계에서 쪼갠다."""
    scenes = []
    for act, par in enumerate(sections, start=1):
        sents = [c for s in split_sentences(par) for c in split_clauses(s)]
        buf, cur = [], 0.0
        for s in sents:
            d = speak_sec(s)
            # 문장 경계에서 끊는다. 기준은 MAX_CUT 이 아니라 SPLIT_AT —
            # 15초까지 버티면 스위트스팟(3~8초)을 늘 벗어난다.
            if buf and cur + d > SPLIT_AT and cur >= MIN_CUT:
                scenes.append((act, ' '.join(buf), cur))
                buf, cur = [], 0.0
            buf.append(s)
            cur += d
        if buf:
            scenes.append((act, ' '.join(buf), cur))
    return scenes


# 같은 문법이 연속될 때 돌려 쓸 대안. 뜻이 안 깨지는 짝만 넣는다.
ALT = {
    'PaperImageCard':      ['FullBleedCard', 'AnnotatedShotCard'],
    'FullBleedCard':       ['PaperImageCard', 'AnnotatedShotCard'],
    'SkylineCompareCard':  ['ScaleCompareCard', 'BigStatsCard'],
    'ScaleCompareCard':    ['SkylineCompareCard'],
    'RatioCard':           ['BigStatsCard', 'AreaNestCard'],
    'BigStatsCard':        ['RatioCard'],
    'PhotoStepsCard':      ['TimelineRailCard', 'SplitCard'],
    'SplitCard':           ['PhotoStepsCard'],
    'TimelineRailCard':    ['PhotoStepsCard'],
}
REPEAT_MAX = 2          # 같은 카드 연속 허용 한도


def suggest_card(text):
    for pat, card, why in RULES:
        if re.search(pat, text):
            return card, why
    return DEFAULT_CARD, '기본값'


def vary(cards):
    """같은 카드가 REPEAT_MAX 를 넘겨 연속되면 대안으로 바꾼다.

    컷을 잘게 쪼개면 인접 장면이 비슷해져 같은 카드가 줄줄이 나온다.
    컷은 빨라졌는데 화면은 안 바뀌는 상태 — 그게 제일 나쁘다.
    """
    out, run = [], 0
    for i, c in enumerate(cards):
        if out and c == out[-1]:
            run += 1
        else:
            run = 1
        if run > REPEAT_MAX:
            for a in ALT.get(c, []):
                if not out or a != out[-1]:
                    c, run = a, 1
                    break
        out.append(c)
    return out


def key_of(text, used):
    """파일명에 쓸 짧은 영문 키. 한글은 못 쓰므로 순번 기반으로 만든다."""
    base = 'cut'
    i = 1
    while f'{base}{i:02d}' in used:
        i += 1
    used.add(f'{base}{i:02d}')
    return f'{base}{i:02d}'


def allocate(scenes):
    """장면 → scene_plan 항목. MAX_CUT 초과 장면은 [카드 + 실사] 로 자동 분할."""
    picked = vary([suggest_card(t)[0] for _, t, _ in scenes])
    out, used, t = [], set(), 0.0
    prev_act = None
    for i, (act, text, dur) in enumerate(scenes):
        if prev_act is not None:
            t += GAP if act != prev_act else GAP_IN
        prev_act = act
        dur = round(dur, 1)
        _, why = suggest_card(text)
        card = picked[i]
        e = {
            'id': i, 'act': act, 'start': round(t, 1), 'end': round(t + dur, 1), 'dur': dur,
            'text': text, 'card': card, 'key': key_of(text, used), '_why': why,
        }
        if dur > MAX_CUT:
            # 앞 2/3 는 카드, 뒤는 실사. 한 컷이 15초를 넘지 않게 나눈다.
            card_dur = round(min(MAX_CUT, dur * 0.66), 1)
            e['cardDur'] = card_dur
            e['broll'] = {'src': 'TODO.mp4', 'ss': 0.0, 'dur': round(dur - card_dur, 1)}
        out.append(e)
        t += dur
    return out


def tighten_opening(plan):
    """첫 30초에 컷이 부족하면 앞쪽 장면을 실사와 반씩 나눠 컷을 늘린다."""
    def cut_count():
        n, t = 0, 0.0
        for e in plan:
            if e['start'] >= OPENING_SEC:
                break
            n += 1 if e.get('cardDur', e['dur']) > 0 else 0
            n += len(e['broll']) if isinstance(e.get('broll'), list) else (1 if e.get('broll') else 0)
        return n
    for e in plan:
        if cut_count() >= OPENING_MIN_CUTS or e['start'] >= OPENING_SEC:
            break
        if 'broll' not in e and e['dur'] >= MIN_CUT * 2:
            half = round(e['dur'] * 0.6, 1)
            e['cardDur'] = half
            e['broll'] = {'src': 'TODO.mp4', 'ss': 0.0, 'dur': round(e['dur'] - half, 1)}
    return plan


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('script')
    ap.add_argument('--project', required=True)
    ap.add_argument('--cps', type=float, default=CPS)
    ap.add_argument('--dry', action='store_true', help='파일로 안 쓰고 요약만 출력')
    a = ap.parse_args()

    global _cps
    _cps = a.cps

    raw = open(a.script, encoding='utf-8').read()
    # 마크다운 제목·인용·구분선은 낭독 대상이 아니다
    raw = re.sub(r'^\s*(#{1,6}\s.*|>.*|-{3,})$', '', raw, flags=re.M)
    sections = [p.strip() for p in re.split(r'\n\s*\n', raw) if p.strip()]
    if not sections:
        sys.exit('스크립트에서 문단을 못 찾았다.')

    plan = tighten_opening(allocate(build_scenes(sections)))
    total = plan[-1]['end']

    print(f'섹션 {len(sections)} → 장면 {len(plan)} · {total:.1f}초 ({int(total)//60}:{int(total)%60:02d})')
    ncut = sum(1 + (len(e['broll']) if isinstance(e.get('broll'), list) else (1 if e.get('broll') else 0))
               if e.get('cardDur', e['dur']) > 0 else 1 for e in plan)
    print(f'예상 컷 {ncut}개 · 첫 30초 컷 {sum(1 for e in plan if e["start"] < 30)}개\n')
    for e in plan:
        mark = '+실사' if e.get('broll') else '    '
        print(f"  #{e['id']:2d} act{e['act']:2d} {e['dur']:5.1f}s {mark} {e['card']:20s} "
              f"({e['_why']})  {e['text'][:34]}…")

    if a.dry:
        return

    outdir = os.path.join(ROOT, 'projects', a.project)
    os.makedirs(outdir, exist_ok=True)
    for e in plan:
        e.pop('_why', None)
    json.dump({'project': a.project, 'scenes': plan},
              open(os.path.join(outdir, 'scene_plan.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)

    props = {str(e['id']): {'card': e['card'],
                            'props': json.loads(json.dumps(SKELETON.get(e['card'], {})))}
             for e in plan}
    json.dump({'project': a.project,
               'note': 'plan_from_script.py 초안. 수치·라벨을 채운 뒤 qa_check.py 로 검사할 것.',
               'scenes': props},
              open(os.path.join(outdir, 'scene_props.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    print(f'\n→ {outdir}/scene_plan.json · scene_props.json')
    print('   다음: 값 채우기 → render_parkside.py --still → qa_check.py')


if __name__ == '__main__':
    main()
