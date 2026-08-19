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

try:
    from PIL import Image, ImageDraw
except ImportError:  # 시트만 못 만들 뿐, 렌더는 된다
    Image = None

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOTION = os.path.join(BASE, 'motion')
CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
IMG = 'media/seongsu_skyline.jpg'  # 실사 원칙: 실제 대상(성수동) 자료로 점검한다
IMG_ALT = 'media/seongsu_storefronts.jpg'
IMG_OLD = 'media/seongsu_alley.jpg'  # 아카이브 등급 시험용

DEVICES = [
    ('FootageCard', {
        'durationSec': 6, 'image': IMG, 'place': 'SEONGSU · SEOUL', 'align': 'center',
        'scrim': 'full', 'label': '3막', 'credit': '이미지: Wikimedia Commons',
        'segs': [{'t': '올리브영이 ', 'hot': False}, {'t': '몇 개', 'hot': True}, {'t': '일까요?', 'hot': False}],
    }),
    ('FootageStatCard', {
        'durationSec': 8, 'image': IMG, 'place': 'SEONGSU', 'valueTarget': 2548, 'unit': '억',
        'label': '팩토리얼 성수 · 거래 총액', 'caption': '성수동 오피스 최고가', 'credit': '이미지: Wikimedia Commons',
    }),
    ('FootageAnnotateCard', {
        'durationSec': 7, 'image': IMG, 'place': '도보 2분', 'credit': '이미지: Wikimedia Commons',
        'box': {'x': 700, 'y': 380, 'w': 420, 'h': 260},
        'label': '대상 건물', 'sub': '카탈로그 예시 — 실제 지목이 아님',
    }),
    ('FootageLabelCard', {
        'durationSec': 7, 'image': IMG, 'place': 'SEONGSU', 'concept': '입지', 'credit': '이미지: Wikimedia Commons',
        'labels': [{'x': 700, 'y': 330, 'text': '대상 A', 'to': [880, 470]},
                   {'x': 1330, 'y': 620, 'text': '대상 B', 'to': [1180, 500]}],
    }),
    ('SatelliteRouteCard', {
        'durationSec': 8, 'image': IMG, 'place': 'SEONGSU', 'credit': '이미지: Wikimedia Commons',
        'title': '두 권역의 거리', 'routeLabel': '권역 A → 권역 B',
        'regions': [{'cx': 700, 'cy': 470, 'rx': 150, 'ry': 100, 'label': '권역 A'},
                    {'cx': 1180, 'cy': 430, 'rx': 150, 'ry': 100, 'label': '권역 B', 'hot': True}],
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
    ('PaperFlowCardV4', {
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
        'geo': 'geo/korea_provinces.geo.json', 'focus': [125.8, 33.1, 129.8, 38.7],
        'markers': [{'lon': 127.056, 'lat': 37.545, 'label': '성수동', 'sub': '팩토리얼 성수', 'hot': True}],
    }),
    ('PaperWalkCard', {
        'durationSec': 8, 'eyebrow': '낙찰 부지 → 올리브영N 성수', 'title': '걸어서 2분',
        'from': {'x': 560, 'y': 540, 'label': '낙찰 부지'},
        'to': {'x': 1400, 'y': 500, 'label': '올리브영N 성수', 'sub': '팩토리얼 성수 1~5층'},
        'waypoints': [[860, 560], [1080, 500]],
        'duration': '도보 2분',
        'note': '블록은 개념 도해 — 실제 필지 형상과 다름',
    }),
    ('PaperBarCard', {
        'durationSec': 9, 'eyebrow': '연면적 평당 거래가', 'title': '성수동 오피스',
        'shape': 'building', 'unit': '만원',
        'bars': [{'label': '사례 A', 'value': 2600, 'text': '2,600'},
                 {'label': '사례 B', 'value': 3100, 'text': '3,100'},
                 {'label': '팩토리얼 성수', 'value': 4000, 'text': '4,000', 'hot': True, 'sub': '성수동 최고가'},
                 {'label': '사례 C', 'value': 2900, 'text': '2,900'}],
        'note': '사례 A~C 는 축척 예시 — 실제 사례가 아님',
    }),
    ('PaperDotsCard', {
        'durationSec': 9, 'eyebrow': '수용 규모', 'title': '한 점 = 100석',
        'total': 17000, 'perDot': 100, 'unit': '석',
        'legend': '● = 100석', 'caption': '점의 수가 곧 규모',
        'note': '수치는 카탈로그 예시',
    }),
    ('PaperTrendCard', {
        'durationSec': 9, 'eyebrow': '연도별 추이', 'title': '값의 변화',
        'unit': '만원', 'axisLabel': '연면적 평당',
        'series': [{'label': '2022', 'value': 2600, 'text': '2,600'},
                   {'label': '2023', 'value': 2900, 'text': '2,900'},
                   {'label': '2024', 'value': 3100, 'text': '3,100'},
                   {'label': '2025', 'value': 4000, 'text': '4,000', 'hot': True}],
        'note': '2022~2024 는 축척 예시 — 실제 값이 아님',
    }),
    ('PaperQuoteCard', {
        'durationSec': 8, 'eyebrow': '관계자 발언',
        'quote': '기존 수익률이 좋아서 산 건물이라도 매수자는 결국 수익률을 더 개선시키고 싶어진다',
        'mark': '수익률을 더 개선',
        'speaker': '카탈로그 예시', 'role': '· 발언 인용 장치',
    }),
    ('PaperFormulaCard', {
        'durationSec': 9, 'eyebrow': '연 임대수입 계산', 'title': '평당 임대료 × 면적 × 12개월',
        'terms': [{'value': '15', 'label': '만원/평/월', 'sub': '1층 기준'},
                  {'value': '1,400', 'label': '평'},
                  {'value': '12', 'label': '개월'},
                  {'value': '25.2억', 'label': '연 임대수입'}],
        'ops': ['×', '×', '='],
        'resultNote': '이 수입이 매입가를 정당화하는가',
        'note': '수치는 계산 예시 — 실제 계약 조건이 아님',
    }),
    ('PaperShareCard', {
        'durationSec': 8, 'eyebrow': '연면적 구성', 'title': '누가 얼마를 쓰는가',
        'totalLabel': '연면적 100%',
        'parts': [{'label': '올리브영N 성수', 'value': 45, 'hot': True},
                  {'label': '상층부 임차', 'value': 33},
                  {'label': '공용·설비', 'value': 22}],
        'note': '구성비는 도해 예시',
    }),
    ('PaperOrgCard', {
        'durationSec': 9, 'eyebrow': '소유 구조', 'title': '누가 위에 있는가',
        'root': {'label': '교보AIM자산운용', 'sub': '2025.12.24 이후 소유'},
        'children': [{'label': '펀드', 'share': '100%', 'sub': '부동산 펀드'},
                     {'label': '팩토리얼 성수', 'share': '자산', 'hot': True, 'sub': '1~5층 올리브영N'},
                     {'label': '임차인', 'share': '계약', 'sub': '임대료 지급'}],
        'note': '구조는 개념 도해',
    }),
    ('PaperListCard', {
        'durationSec': 9, 'eyebrow': '매수자가 수익률을 올리는 방법', 'title': '세 가지뿐이다',
        'items': [{'text': '임대료를 올린다', 'sub': '임차인에게 직접 영향', 'hot': True},
                  {'text': '공실을 채운다', 'sub': '비어 있는 층이 있다면'},
                  {'text': '비용을 줄인다', 'sub': '관리·금융 비용'}],
        'note': '설명 구조 예시',
    }),
    ('PaperPressCard', {
        'durationSec': 9, 'outlet': 'NEWS', 'date': '2025.12.24', 'byline': '카탈로그 예시',
        'headline': '성수동 오피스, 연면적 평당 4,000만원에 거래',
        'mark': '연면적 평당 4,000만원',
        'columns': [['팩토리얼 성수가 새 주인을 맞았다. 매도자는 이지스자산운용, 매수자는 교보AIM자산운용이다.',
                     '거래 총액은 2,548억 원으로, 연면적 평당 4,000만원 수준이다. 성수동 오피스 거래 중 가장 높은 값이다.'],
                    ['업계에서는 이 가격이 향후 임대료에 영향을 줄 수 있다고 본다. 높은 가격에 산 건물일수록 수익률 개선 요구가 커지기 때문이다.',
                     '올리브영N 성수는 이 건물 1~5층 약 1,400평을 쓰고 있다. 개점 1년 누적 방문객은 250만 명이다.']],
        'note': '지면은 카탈로그 예시 — 실제 기사 조판이 아님',
    }),
    ('PaperPortraitCard', {
        'durationSec': 8, 'eyebrow': '인물', 'image': IMG_ALT,
        'name': '카탈로그 예시', 'role': '· 아카이브 초상 장치',
        'quote': '높은 가격에 산 건물일수록 수익률을 더 개선하고 싶어진다',
        'mark': '수익률을 더 개선',
        'credit': '이미지: Wikimedia Commons',
    }),
    ('PaperChoroCard', {
        'durationSec': 8, 'eyebrow': '권역 구분', 'title': '어디가 해당되는가',
        'geo': 'geo/korea_provinces.geo.json', 'focus': [126.35, 36.85, 127.95, 38.25],
        'legendTitle': '구분',
        'regions': [{'name': '서울', 'color': '#16181A', 'label': '서울특별시'},
                    {'name': '경기', 'color': '#D99A1F', 'label': '경기도'}],
        'note': '구역 색칠 예시',
    }),
    ('ArchiveCard', {
        'durationSec': 7, 'image': IMG_OLD, 'era': 'bw', 'fit': 'cover',
        'dateChip': 'SEONGSU · ARCHIVE', 'caption': '아카이브 등급 예시',
        'credit': '자료: Wikimedia Commons',
    }),
    ('SourceClipCard', {
        'durationSec': 7, 'image': IMG_ALT, 'outlet': 'NEWS',
        'headline': '외부 영상·기사를 인용하는 화면',
        'dateChip': '2025.12', 'courtesy': 'WIKIMEDIA COMMONS',
    }),
    ('ThenNowCard', {
        'durationSec': 8, 'eyebrow': '같은 자리', 'title': '성수동의 변화',
        'thenImage': IMG_OLD, 'thenLabel': '과거',
        'nowImage': IMG, 'nowLabel': '현재',
        'note': '두 장면은 같은 권역 — 정확한 동일 지점 자료는 교체 필요',
        'credit': '자료: Wikimedia Commons',
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


def build_sheets(out_dir, cols=3, rows=3, tw=640, th=360):
    """전 장치를 3x3 시트로 묶어 한눈에 비교한다."""
    if Image is None:
        print('PIL 없음 — 시트 생략', flush=True)
        return []
    names = [n for n in sorted(os.listdir(out_dir)) if n.endswith('.png')]
    made = []
    for i in range(0, len(names), cols * rows):
        chunk = names[i:i + cols * rows]
        sheet = Image.new('RGB', (cols * tw, rows * (th + 30)), '#101214')
        dr = ImageDraw.Draw(sheet)
        for j, n in enumerate(chunk):
            im = Image.open(os.path.join(out_dir, n)).convert('RGB').resize((tw, th))
            x, y = (j % cols) * tw, (j // cols) * (th + 30)
            sheet.paste(im, (x, y))
            dr.text((x + 8, y + th + 8), n[:-4], fill='#FAFF2E')
        path = os.path.join(out_dir, f'_sheet{i // (cols * rows) + 1}.jpg')
        sheet.save(path, quality=88)
        made.append(path)
    print('sheets: ' + ', '.join(os.path.basename(m) for m in made), flush=True)
    return made


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--sheets-only', action='store_true')
    ap.add_argument('--out', default=os.path.join(BASE, 'reference', 'device_catalog'))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    if args.sheets_only:
        build_sheets(args.out)
        return 0
    made = []
    for name, props in DEVICES:
        if args.only and args.only != name:
            continue
        got = render(name, props, args.out)
        if got:
            made.append(got)
    print(f'catalog: {len(made)}/{len(DEVICES)}', flush=True)
    if not args.only:
        build_sheets(args.out)


if __name__ == '__main__':
    sys.exit(main())
