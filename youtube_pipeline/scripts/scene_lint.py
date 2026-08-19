#!/usr/bin/env python3
"""장면 JSON 디자인 진단기 — "고도화"를 감이 아니라 규칙으로.

편집 레인이 만든 v2_scenes.json 을 읽어 design_reference.md §20-5(R1~R8)·
§21 위계 기준으로 문제를 잡아낸다. 디자인 레인이 손대기 전에 먼저 돌린다.

사용: python3 youtube_pipeline/scripts/scene_lint.py <프로젝트명> [--json]
"""
import argparse
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 글자가 주인공인 카드 (그래픽 없음)
TEXT_CARDS = {'YHeadlineCard', 'YQuoteCard', 'PaperArticleCard'}
# 수치를 다루는 카드 — 출처·킥커가 있어야 신뢰가 붙는다
DATA_CARDS = {
    'CleoStatCard', 'YTableCard', 'UnitBlocksCard', 'TrendCard',
    'SeatDotsCard', 'TimelineBarsCard', 'IconCountCard', 'YCompareCard',
    'PaperStatCard', 'PaperCountCard', 'PaperCompareCard', 'PaperTableCard',
    'PaperTimelineCard', 'FootageStatCard',
}
# 실사를 바닥에 까는 카드 (§21-2 기본층)
FOOTAGE_CARDS = {
    'FootageCard', 'FootageStatCard', 'FootageAnnotateCard', 'FootageLabelCard',
    'SatelliteRouteCard', 'ArchiveCard', 'SourceClipCard', 'ThenNowCard',
}
# 아카이브·외부 인용 — 출처 표기가 없으면 쓰면 안 되는 카드
ARCHIVE_CARDS = {'ArchiveCard', 'SourceClipCard', 'ThenNowCard'}
# 층 묶음처럼 "한 덩어리" 강조가 정상인 카드
GROUP_HOT_CARDS = {'FloorStackCard', 'PaperElevationCard', 'PaperSectionCard'}
# 자리 채우기용 예시 이미지 — 실사 원칙 위반
PLACEHOLDER_RE = re.compile(r'^(demo|sample|placeholder)/')
# 킥커·출처 역할을 하는 v4 prop 이름
KICKER_KEYS = ('kicker', 'eyebrow', 'label', 'title')
SOURCE_KEYS = ('source', 'credit')
NUM_RE = re.compile(r'[\d][\d,\.]*')


def walk_strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from walk_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk_strings(v)


def count_hot(props):
    """화면에서 옐로로 강조되는 지점 수 (R2: 화면당 1곳)."""
    n = 0
    def rec(o):
        nonlocal n
        if isinstance(o, dict):
            if o.get('hot') is True:
                n += 1
            for v in o.values():
                rec(v)
        elif isinstance(o, list):
            for v in o:
                rec(v)
    rec(props)
    # 헤드라인은 hot 세그먼트가 연속 단어일 수 있어 1건으로 본다
    return n


def numbers_in(text):
    out = set()
    for m in NUM_RE.finditer(text or ''):
        t = m.group().strip('.,')
        if t and any(c.isdigit() for c in t):
            out.add(t.replace(',', ''))
    return out


def lint(scenes):
    findings = []
    n = len(scenes)
    text_only = 0
    prev_cards = []
    # 창작 판정은 대본 "전체" 기준 — 앞 장면에서 이어받은 수치는 정상이다
    script_numbers = set()
    for s in scenes:
        script_numbers |= numbers_in(s.get('line') or '')

    for s in scenes:
        sid = s.get('id')
        card = s.get('card', '?')
        props = s.get('props', {})
        dur = float(props.get('durationSec') or 0)
        line = s.get('line') or ''
        tag = f'#{sid}'

        if card in TEXT_CARDS:
            text_only += 1

        # R2 — 강조는 화면당 1곳
        hot = count_hot(props)
        if card in GROUP_HOT_CARDS:
            hot = 1 if hot else 0  # 층 묶음 강조는 한 덩어리로 본다
        if hot > 1 and card not in ('YCompareCard',):
            findings.append((tag, 'R2', f'강조(hot) {hot}곳 — 화면당 1곳으로 줄일 것', 'warn'))

        # R8 — 데이터 카드는 킥커(맥락)가 있어야 한다
        if card in DATA_CARDS and not any(props.get(k) for k in KICKER_KEYS):
            findings.append((tag, 'R8', '데이터 카드인데 킥커(맥락)가 없음', 'warn'))

        # 출처 — 외부 수치를 말하면 출처가 붙어야 신뢰가 산다
        if card in DATA_CARDS and not any(props.get(k) for k in SOURCE_KEYS):
            findings.append((tag, 'SRC', '수치 카드에 출처 없음 (자체 추정이면 그렇게 표기)', 'info'))

        # 실사 원칙 — 예시 이미지를 그대로 두고 렌더하지 않는다
        img = props.get('image') or props.get('video') or ''
        for key in ('thenImage', 'nowImage'):
            img = img or props.get(key) or ''
        if card in FOOTAGE_CARDS:
            if not img:
                findings.append((tag, 'MEDIA', '실사 카드인데 image/video 가 비어 있음', 'error'))
            elif PLACEHOLDER_RE.match(img):
                findings.append((tag, 'MEDIA', f'예시 이미지 "{img}" 사용 — 실제 대상 자료로 교체', 'error'))

        # 아카이브·인용은 출처 없이 쓰지 않는다
        if card in ARCHIVE_CARDS and not (props.get('credit') or props.get('courtesy')):
            findings.append((tag, 'SRC', '아카이브·인용 화면에 출처 표기 없음', 'error'))

        # 창작 방지 — props 의 숫자가 대본 문장에 없으면 의심
        if script_numbers:
            for txt in walk_strings(props):
                for num in numbers_in(txt):
                    # "2025.12.24" 처럼 합쳐 쓴 날짜는 조각이 다 대본에 있으면 정상
                    parts = [p for p in num.split('.') if p]
                    if len(parts) > 1 and all(p.lstrip('0') or p in script_numbers or p in script_numbers for p in parts):
                        if all(p in script_numbers for p in parts):
                            continue
                    if len(num) >= 3 and num not in script_numbers:
                        findings.append((tag, 'FACT', f'대본에 없는 숫자 "{num}" 사용 — 근거 확인', 'error'))
                        break
                else:
                    continue
                break

        # 리듬 — 글자 카드가 너무 길면 화면이 죽는다
        if card in TEXT_CARDS and dur > 9:
            findings.append((tag, 'RHY', f'글자 카드가 {dur:.0f}초 — 9초 넘으면 그래픽으로 바꾸거나 분할', 'warn'))
        # 데이터 카드가 너무 짧으면 애니메이션이 끝나기 전에 넘어간다
        if card in DATA_CARDS and 0 < dur < 6:
            findings.append((tag, 'RHY', f'데이터 카드가 {dur:.0f}초 — 등장 애니메이션이 다 안 보임(6초 이상 권장)', 'warn'))

        prev_cards.append(card)

    # 리듬 — 같은 카드 3연속
    for i in range(2, n):
        if prev_cards[i] == prev_cards[i - 1] == prev_cards[i - 2]:
            findings.append((f'#{scenes[i]["id"]}', 'RHY', f'{prev_cards[i]} 3연속 — 문법을 바꿔 리듬을 끊을 것', 'warn'))

    # 그래픽 비중 — 글자 카드가 40% 넘으면 "설명을 그리지 않은" 것
    if n and text_only / n > 0.4:
        findings.append(('전체', 'MIX', f'글자 위주 카드 {text_only}/{n} ({text_only/n:.0%}) — 40% 이하로', 'warn'))

    # 위계 — 실사 활용이 0이면 B1M 기본층을 안 쓴 것 (§21-2)
    has_photo = any(
        s.get('use_v7') or s.get('card') in FOOTAGE_CARDS
        or s.get('props', {}).get('bgImage') or s.get('props', {}).get('image')
        or s.get('props', {}).get('video')
        for s in scenes
    )
    if n >= 6 and not has_photo:
        findings.append(('전체', 'LADDER', '실사(1~3단계)가 한 장도 없음 — §21-2 기본층부터 쓰는지 확인', 'info'))

    return findings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args()

    path = os.path.join(BASE, 'projects', args.project, 'v2_scenes.json')
    scenes = json.load(open(path, encoding='utf-8'))['scenes']
    findings = lint(scenes)

    if args.json:
        print(json.dumps([{'scene': a, 'rule': b, 'msg': c, 'level': d} for a, b, c, d in findings],
                         ensure_ascii=False, indent=1))
        return 0

    order = {'error': 0, 'warn': 1, 'info': 2}
    mark = {'error': '✗', 'warn': '!', 'info': '·'}
    findings.sort(key=lambda f: (order[f[3]], f[0]))
    print(f'== {args.project} — 장면 {len(scenes)}개 / 지적 {len(findings)}건 ==')
    for tag, rule, msg, level in findings:
        print(f' {mark[level]} {tag:>4} [{rule}] {msg}')
    if not findings:
        print(' 지적 없음 — 규칙 기준으로는 깨끗함')
    return 0


if __name__ == '__main__':
    sys.exit(main())
