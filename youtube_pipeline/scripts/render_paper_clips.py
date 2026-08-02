#!/usr/bin/env python3
"""종이 설명 그래픽을 v7 타임라인 6개 장면에 적용 — XML 길이에 맞춰 렌더."""
import json, os, re, subprocess, sys, tempfile

MOTION = '/home/user/sangkwon-analyzer/youtube_pipeline/motion'
OUT = '/home/user/sangkwon-analyzer/youtube_pipeline/projects/하남스피어/broll_candidates/paper'
XML = ('/tmp/claude-0/-home-user-sangkwon-analyzer/5ab6e313-332c-5aa7-a8b8-bd8d00e79058/'
       'scratchpad/rebuild/하남스피어_타임라인.xml')
CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'

xml = open(XML, encoding='utf-8').read()
outs = {int(m.group(1)): int(m.group(2))
        for m in re.finditer(r'<name>#(\d+) [^<]+</name>.*?<out>(\d+)</out>', xml)}

SCENES = {
    16: ('PaperFlowCard', {
        'title': '야스섬 스피어 — 누가 돈을 내나', 'sub': '',
        'exchange': {
            'left': {'icon': 'gov', 'label': '아부다비 문화관광부', 'sub': '발주처 · 소유'},
            'right': {'icon': 'building', 'label': '스피어', 'sub': '건설비 부담 0원'},
            'give': '건설 사업비 2조 5천억 원 전액',
            'get': '브랜드 · 설계 · 운영 노하우',
        },
        'source': 'DCT 아부다비 발표',
    }),
    24: ('PaperFlowCard', {
        'title': '감가상각이란', 'sub': '',
        'nodes': [
            {'icon': 'building', 'label': '건물값 3.4조', 'sub': '라스베가스 스피어'},
            {'icon': 'clock', 'label': '자산 수명', 'sub': '수명 기간으로 분할'},
            {'icon': 'money', 'label': '매년 4,800억', 'sub': '해마다 비용 처리', 'hot': True},
        ],
        'arrows': ['나누면', '매년'],
        'source': 'Sphere Entertainment 공시',
    }),
    28: ('PaperFlowCard', {
        'title': '상영 콘텐츠의 경제학', 'sub': '',
        'nodes': [
            {'icon': 'doc', 'label': '콘텐츠 1편', 'sub': '약 1,500억 원 — 빌딩 한 채 값'},
            {'icon': 'building', 'label': '상영 건물 1곳', 'sub': '라스베가스뿐'},
            {'icon': 'globe', 'label': '확장', 'sub': '더 많은 시장으로 비용 분산', 'hot': True},
        ],
        'arrows': ['한 곳뿐이라면', '그래서'],
        'source': '',
    }),
    29: ('SkylineCompareCard', {
        'title': '더 작은 스피어 — 설계 중', 'sub': '제임스 돌란 회장 · 2025.3',
        'buildings': [
            {'label': '라스베가스형\n콘텐츠 상영관 1곳', 'value': 1.0, 'note': '2만 석', 'shape': 'sphere'},
            {'label': '설계 중\n자본비용 분산', 'value': 0.42, 'note': '5,000석', 'shape': 'sphere', 'hot': True},
        ],
        'source': 'News 3 Las Vegas · 2025.3',
    }),
    31: ('SkylineCompareCard', {
        'title': '2만 석 — 스피어와 같은 숫자', 'sub': '대형 아레나의 일반 규격이기도 하다',
        'buildings': [
            {'label': '라스베가스 스피어', 'value': 1.0, 'note': '2만 석', 'shape': 'sphere'},
            {'label': '하남 공모', 'value': 1.0, 'note': '2만 석 이상', 'shape': 'sphere', 'hot': True},
        ],
        'source': '하남시 공모 · 보도 기준',
    }),
    38: ('TowerGaugeCard', {
        'title': '고양 K-컬처밸리 아레나', 'sub': '수도권 또 하나의 대형 공연장',
        'items': [
            {'label': '', 'pct': 17, 'sub': '공정률에서 정지', 'note': '완공은 2030년으로 연기'},
        ],
        'source': '보도 종합',
    }),
}

os.makedirs(OUT, exist_ok=True)
fails = []
for sid, (card, props) in SCENES.items():
    frames = outs[sid] + 2
    props = dict(props)
    props['durationSec'] = frames / 30.0
    out = os.path.join(OUT, f'sec{sid}_{card}.mp4')
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(props, f, ensure_ascii=False)
        pp = f.name
    r = subprocess.run(['npx', 'remotion', 'render', 'src/index.jsx', card, out,
                        f'--props={pp}', '--codec=h264', '--gl=angle',
                        f'--browser-executable={CHROME}', '--log=error'],
                       cwd=MOTION, capture_output=True, text=True)
    os.unlink(pp)
    if r.returncode != 0:
        print(f'[FAIL] sec{sid}: {r.stderr[-400:]}', flush=True)
        fails.append(sid)
    else:
        print(f'[ok] sec{sid} {card} {frames}f {os.path.getsize(out)//1024}KB', flush=True)
print('done', 'FAILS:' + str(fails) if fails else 'all ok', flush=True)
sys.exit(1 if fails else 0)
