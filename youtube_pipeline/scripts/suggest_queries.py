#!/usr/bin/env python3
"""scene_plan.json → 장면별 **실사 검색어** 제안.

여기가 이 파이프라인의 진짜 병목이었다.
B1M 은 화면의 대부분이 실사고 도표는 양념인데, 내 결과물은 정반대다 —
도표만 잔뜩이고 실사가 거의 없다. 이유는 단순하다:
**실사를 넣으려면 검색어를 손으로 만들어야 했고, 그래서 안 넣었다.**

Commons·Openverse·Mixkit 은 전부 영어로 찾아야 결과가 나온다.
("역삼동 오피스텔" 로 검색하면 0건이고, "Gangnam office building" 이면 수백 건이다)
그래서 한국어 장면 텍스트를 **도메인 사전**으로 영어 검색어로 바꾼다.
분야가 부동산·건설 하나라서 사전으로 충분히 커버된다 — 번역 API 가 필요 없다.

    python3 youtube_pipeline/scripts/suggest_queries.py 프로젝트
    python3 youtube_pipeline/scripts/suggest_queries.py 프로젝트 --collect      # 바로 수집까지
    python3 youtube_pipeline/scripts/suggest_queries.py 프로젝트 --collect --ids 3 7

출력은 **제안**이다. 컨택트시트를 눈으로 보고 고르는 단계는 그대로다 (§9-3).
"""
import argparse, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 도메인 사전 ──────────────────────────────────────────────────────────
# (한국어 정규식, [영어 검색어…], 'photo'|'video')
# 위에서부터 걸리는 걸 모두 모으고, 많으면 앞쪽 두세 개만 쓴다.
# 원칙: **구체적인 사물** 이 되게 쓴다. 'development' 같은 추상어는 스톡에서
# 회의실 악수 사진만 나온다 — 그건 이 채널에서 제일 쓰기 싫은 그림이다.
LEX = [
    (r'(굴착|파냈|파야|터파기|흙막이)', ['excavation site', 'construction pit'], 'video'),
    (r'(타워크레인|크레인)', ['tower crane'], 'video'),
    (r'(공사|시공|착공|건설 현장|현장)', ['construction site aerial', 'building under construction'], 'video'),
    (r'(철근|콘크리트|타설)', ['rebar concrete', 'concrete pouring'], 'video'),
    (r'(지하|주차장)', ['underground parking garage'], 'video'),
    (r'(엘리베이터|승강기)', ['elevator interior'], 'video'),
    (r'(로비|입구|현관)', ['hotel lobby interior'], 'video'),
    (r'(인테리어|마감|원목|마블|대리석)', ['walnut wood interior', 'marble surface detail'], 'video'),
    (r'(백화점|쇼핑|리테일|상업시설|매장)', ['department store interior', 'luxury retail mall'], 'video'),
    (r'(호텔|레지던스)', ['luxury hotel room', 'hotel exterior'], 'video'),
    (r'(공원|녹지|숲|조경)', ['urban park aerial', 'city park trees'], 'video'),
    (r'(한강|강변|수변)', ['Han River Seoul', 'river city skyline'], 'photo'),
    (r'(남산|산|능선)', ['Namsan Seoul', 'mountain city skyline'], 'photo'),
    (r'(스카이라인|전경|도시)', ['Seoul skyline', 'city skyline aerial'], 'photo'),
    (r'(용산)', ['Yongsan Seoul', 'Yongsan Station'], 'photo'),
    (r'(강남|역삼|테헤란)', ['Gangnam Seoul', 'Teheran-ro Seoul'], 'photo'),
    (r'(한남|이태원)', ['Itaewon Seoul', 'Hannam-dong Seoul'], 'photo'),
    (r'(여의도)', ['Yeouido Seoul'], 'photo'),
    (r'(잠실|롯데월드)', ['Lotte World Tower', 'Jamsil Seoul'], 'photo'),
    (r'(미군|기지|주한미군)', ['US military base Korea', 'Yongsan Garrison'], 'photo'),
    (r'(국방부|군)', ['Ministry of National Defense Seoul'], 'photo'),
    (r'(아파트|주거|단지|세대|가구)', ['Seoul apartment complex aerial', 'residential tower'], 'photo'),
    (r'(오피스텔|사무실|오피스)', ['office building interior', 'office tower'], 'photo'),
    (r'(분양|모델하우스|갤러리|견본주택)', ['show apartment interior', 'real estate showroom'], 'video'),
    (r'(경매|입찰|낙찰|매각)', ['auction gavel', 'business document signing'], 'video'),
    (r'(계약|협약|MOU|체결|제휴)', ['contract signing', 'business handshake'], 'video'),
    (r'(법|조례|규제|허가|심의)', ['government building', 'city hall'], 'photo'),
    (r'(서울시|시청)', ['Seoul City Hall'], 'photo'),
    (r'(지하철|역세권|교통|도로)', ['Seoul subway station', 'city traffic aerial'], 'video'),
    (r'(가격|시세|금액|억원|조원|평당)', ['stock market chart', 'financial data screen'], 'video'),
    (r'(설계|도면|건축가)', ['architecture blueprint', 'architect drawing'], 'video'),
    (r'(조망|뷰|경관|전망)', ['city view from window', 'skyline view'], 'video'),
    (r'(밤|야경)', ['Seoul night skyline', 'city night aerial'], 'video'),
]

# 이 카드들은 화면이 이미 꽉 찬다 — 실사를 따로 찾을 필요가 없다.
SELF_SUFFICIENT = {
    'ArticleCard', 'StrikeSwapCard', 'IsoDiagramCard', 'MapCard', 'TrackRecordCard',
    'ExchangeMotionCard', 'TimelineRailCard', 'RatioCard', 'SkylineCompareCard',
    'ScaleCompareCard', 'AreaNestCard', 'RankTrendCard', 'BigStatsCard', 'SplitCard',
}


def queries_for(text):
    photo, video = [], []
    for pat, qs, kind in LEX:
        if re.search(pat, text):
            (video if kind == 'video' else photo).extend(qs)
    # 중복 제거 (순서 유지)
    seen = set()
    photo = [q for q in photo if not (q in seen or seen.add(q))]
    seen = set()
    video = [q for q in video if not (q in seen or seen.add(q))]
    return photo[:3], video[:3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--collect', action='store_true', help='제안한 검색어로 바로 수집까지')
    ap.add_argument('--ids', nargs='*', type=int, help='이 장면들만')
    ap.add_argument('--limit', type=int, default=4)
    a = ap.parse_args()

    planp = os.path.join(ROOT, 'projects', a.project, 'scene_plan.json')
    if not os.path.exists(planp):
        sys.exit(f'{planp} 가 없다.')
    plan = json.load(open(planp, encoding='utf-8'))

    rows, allp, allv = [], [], []
    for sc in plan['scenes']:
        if a.ids and sc['id'] not in a.ids:
            continue
        needs = sc.get('broll') is not None or sc['card'] not in SELF_SUFFICIENT
        p, v = queries_for(sc.get('text', ''))
        rows.append((sc, needs, p, v))
        if needs:
            allp += p
            allv += v

    n_need = sum(1 for _, needs, _, _ in rows if needs)
    n_hit = sum(1 for _, needs, p, v in rows if needs and (p or v))
    print(f'장면 {len(rows)}개 · 실사가 필요한 장면 {n_need}개 · 그중 검색어를 뽑은 것 {n_hit}개\n')
    for sc, needs, p, v in rows:
        if not needs:
            print(f"  #{sc['id']:2d} {sc['card']:20s} — 화면이 이미 꽉 참")
            continue
        tag = '사진 ' + ' / '.join(p) if p else ''
        tag2 = '영상 ' + ' / '.join(v) if v else ''
        joined = ' · '.join(x for x in (tag, tag2) if x) or '**검색어 못 뽑음** — 사전에 없는 소재'
        print(f"  #{sc['id']:2d} {sc['card']:20s} {joined}")
        print(f"        └ {sc.get('text','')[:44]}…")

    seen = set()
    up = [q for q in allp if not (q in seen or seen.add(q))]
    seen = set()
    uv = [q for q in allv if not (q in seen or seen.add(q))]
    print(f'\n합쳐서 사진 {len(up)}종 · 영상 {len(uv)}종')

    if not a.collect:
        cmd = ['python3', 'youtube_pipeline/scripts/fetch_sources.py', a.project]
        for q in up[:8]:
            cmd += ['--q', f'"{q}"']
        for q in uv[:8]:
            cmd += ['--video', f'"{q}"']
        print('\n수집하려면:\n  ' + ' \\\n    '.join([' '.join(cmd[:3])] +
              [' '.join(cmd[i:i + 2]) for i in range(3, len(cmd), 2)]))
        return

    cmd = ['python3', os.path.join(ROOT, 'scripts', 'fetch_sources.py'), a.project,
           '--limit', str(a.limit)]
    for q in up[:8]:
        cmd += ['--q', q]
    for q in uv[:8]:
        cmd += ['--video', q]
    print('\n수집 중…')
    subprocess.run(cmd, check=False)


if __name__ == '__main__':
    main()
