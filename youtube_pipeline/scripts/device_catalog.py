#!/usr/bin/env python3
"""v4 장치 카탈로그 — 모든 카드를 같은 소재로 한 장씩 렌더해 나란히 본다.

디자인 품질 점검용. 새 장치를 만들 때마다 여기에 예시를 추가하면
"전체가 한 체계로 보이는가"를 매번 확인할 수 있다.

사용: python3 youtube_pipeline/scripts/device_catalog.py [--only 카드명]
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOTION = os.path.join(BASE, 'motion')
CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
IMG = 'demo/yongsan.jpg'  # 예시 실사 (실제 프로젝트에선 교체)

DEVICES = [
    ('FootageCard', {
        'durationSec': 6, 'image': IMG, 'place': 'SEONGSU · SEOUL', 'align': 'center',
        'scrim': 'full', 'label': '3막', 'credit': '이미지 예시',
        'segs': [{'t': '올리브영이 ', 'hot': False}, {'t': '몇 개', 'hot': True}, {'t': '일까요?', 'hot': False}],
    }),
    ('FootageStatCard', {
        'durationSec': 8, 'image': IMG, 'place': 'SEONGSU', 'valueTarget': 2548, 'unit': '억',
        'label': '팩토리얼 성수 · 거래 총액', 'caption': '성수동 오피스 최고가', 'credit': '이미지 예시',
    }),
    ('FootageAnnotateCard', {
        'durationSec': 7, 'image': IMG, 'place': '도보 2분', 'credit': '이미지 예시',
        'box': {'x': 700, 'y': 380, 'w': 420, 'h': 260},
        'label': '올리브영N 성수', 'sub': '낙찰 부지에서 걸어서 2분',
    }),
    ('FootageLabelCard', {
        'durationSec': 7, 'image': IMG, 'place': 'SEONGSU', 'concept': '입지', 'credit': '이미지 예시',
        'labels': [{'x': 760, 'y': 430, 'text': '팩토리얼 성수'}, {'x': 1260, 'y': 540, 'text': '낙찰 부지'}],
    }),
    ('SatelliteRouteCard', {
        'durationSec': 8, 'image': IMG, 'place': 'SEONGSU', 'credit': '이미지 예시',
        'title': '도보 2분 거리', 'routeLabel': '낙찰 부지 → 올리브영N 성수',
        'regions': [{'cx': 700, 'cy': 470, 'rx': 150, 'ry': 100, 'label': '낙찰 부지'},
                    {'cx': 1180, 'cy': 430, 'rx': 150, 'ry': 100, 'label': '올리브영N'}],
        'route': [[700, 470], [900, 500], [1180, 430]],
    }),
    ('PaperStatCard', {
        'durationSec': 8, 'eyebrow': '개점 1년 누적 방문객', 'label': '올리브영N 성수',
        'valueTarget': 250, 'valueSuffix': '만 명', 'caption': '전국 매장 중 내국인 방문 1위',
        'markCaption': True, 'credit': '자료: 올리브영 발표',
    }),
    ('PaperCountCard', {
        'durationSec': 8, 'eyebrow': '성수 권역', 'title': '올리브영 매장 수',
        'count': 6, 'unit': '개', 'caption': '한 상권에 여섯 개', 'markCaption': True,
    }),
    ('PaperCompareCard', {
        'durationSec': 7, 'eyebrow': '거래가 · 연면적 기준', 'title': '성수동 오피스 최고가',
        'left': {'title': '거래 총액', 'value': '2,548억'},
        'right': {'title': '연면적 평당', 'value': '4,000만원', 'hot': True, 'lines': ['성수동 최고가']},
        'vs': '=',
    }),
    ('PaperTableCard', {
        'durationSec': 9, 'eyebrow': '거래 요약', 'title': '팩토리얼 성수',
        'rows': [{'label': '매도', 'value': '이지스자산운용'},
                 {'label': '매수', 'value': '교보AIM자산운용'},
                 {'label': '거래액', 'value': '2,548억', 'hot': True},
                 {'label': '연면적 평당', 'value': '4,000만원', 'note': '성수동 최고가'}],
        'closing': '임차인에게도 영향이 온다',
    }),
    ('PaperTimelineCard', {
        'durationSec': 8, 'eyebrow': '소유권 이전', 'title': '2025년 12월 24일', 'activeIndex': 2,
        'steps': [{'label': '매도', 'value': '이지스자산운용', 'sub': '기존 소유'},
                  {'label': '거래', 'value': '2,548억', 'sub': '평당 4,000만원'},
                  {'label': '매수', 'value': '교보AIM자산운용', 'sub': '새 소유'}],
    }),
    ('PaperFlowCard', {
        'durationSec': 10, 'eyebrow': '높은 가격에 산 건물의 다음 수순',
        'nodes': [{'tag': '매입', 'label': '매입가', 'value': '2,548억', 'sub': '평당 4,000만원'},
                  {'tag': '요구', 'label': '수익률 개선', 'value': '필요', 'sub': '매수자 입장'},
                  {'tag': '결과', 'label': '임차인 임대료', 'value': '인상 압력', 'hot': True}],
        'arrows': [{'label': '높은 매입가'}, {'label': '그래서'}],
    }),
    ('PaperElevationCard', {
        'durationSec': 8, 'eyebrow': '팩토리얼 성수 · 입면', 'title': '올리브영N 성수가 쓰는 층',
        'floors': [{'name': '1F', 'tenant': '올리브영N 성수', 'hot': True},
                   {'name': '2F', 'tenant': '올리브영N 성수', 'hot': True},
                   {'name': '3F', 'tenant': '올리브영N 성수', 'hot': True},
                   {'name': '4F', 'tenant': '올리브영N 성수', 'hot': True},
                   {'name': '5F', 'tenant': '올리브영N 성수', 'hot': True},
                   {'name': '…', 'tenant': '상층부'}],
        'dimension': {'label': '1,400평', 'sub': '1 ~ 5층'},
    }),
    ('PaperSectionCard', {
        'durationSec': 9, 'eyebrow': '단면', 'title': '지상 · 지하 구성',
        'above': [{'name': '1F', 'tenant': '올리브영N 성수', 'hot': True},
                  {'name': '2F', 'tenant': '올리브영N 성수', 'hot': True},
                  {'name': '3F', 'tenant': '올리브영N 성수', 'hot': True},
                  {'name': '4F', 'tenant': '올리브영N 성수', 'hot': True},
                  {'name': '5F', 'tenant': '올리브영N 성수', 'hot': True}],
        'below': [{'name': 'B1', 'tenant': '주차·설비'}, {'name': 'B2', 'tenant': '주차'}],
        'dimension': {'label': '1,400평', 'sub': '지상 1~5층'}, 'note': '지하 구성은 예시',
    }),
    ('PaperMassingCard', {
        'durationSec': 9, 'eyebrow': '성수 권역', 'title': '팩토리얼 성수의 위치',
        'label': '팩토리얼 성수', 'sub': '1~5층 올리브영N 성수',
        'note': '블록은 개념 도해 — 실제 배치와 다름',
    }),
    ('PaperArticleCard', {
        'durationSec': 6, 'outlet': '팩토리얼 성수 · 소유권 변동', 'date': '2025.12.24',
        'headline': '그 건물의 주인이 바뀝니다', 'mark': '주인이 바뀝니다',
        'deck': '이지스자산운용 → 교보AIM자산운용',
    }),
    ('PaperDocumentCard', {
        'durationSec': 8, 'eyebrow': '공시 자료', 'title': '소유권 변동 내역',
        'docTitle': '팩토리얼 성수 — 2,548억 원에 소유권 이전', 'mark': '2,548억 원',
        'docBody': ['매도: 이지스자산운용', '매수: 교보AIM자산운용',
                    '연면적 평당 4,000만원 — 성수동 오피스 최고가'],
        'credit': '자료: 공시',
    }),
    ('PaperWorldMapCard', {
        'durationSec': 8, 'eyebrow': '위치', 'title': '성수 · 서울',
        'geo': 'geo/korea_provinces.geo.json', 'focus': [125.2, 33.0, 131.2, 38.9],
        'markers': [{'lon': 127.056, 'lat': 37.545, 'label': '성수동', 'sub': '팩토리얼 성수', 'hot': True}],
    }),
]


def render(name, props, out_dir, frame=100):
    out = os.path.join(out_dir, f'{name}.png')
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(props, f, ensure_ascii=False)
        p = f.name
    cmd = ['npx', 'remotion', 'still', 'src/index.jsx', name, out,
           f'--frame={frame}', f'--props={p}', '--gl=angle']
    if os.path.exists(CHROME):
        cmd.append(f'--browser-executable={CHROME}')
    r = subprocess.run(cmd, cwd=MOTION, capture_output=True, text=True, timeout=600)
    os.unlink(p)
    ok = r.returncode == 0 and os.path.exists(out)
    print(f'{"[ok]" if ok else "[FAIL]"} {name}' + ('' if ok else f' :: {r.stderr[-200:]}'), flush=True)
    return out if ok else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--out', default=os.path.join(BASE, 'reference', 'device_catalog'))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    made = []
    for name, props in DEVICES:
        if args.only and args.only != name:
            continue
        got = render(name, props, args.out)
        if got:
            made.append(got)
    print(f'catalog: {len(made)}/{len(DEVICES)}', flush=True)


if __name__ == '__main__':
    sys.exit(main())
