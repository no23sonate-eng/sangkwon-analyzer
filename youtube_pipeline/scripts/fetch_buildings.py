#!/usr/bin/env python3
"""좌표 → 주변 **실제 건물 발자국**. OSM 메인 API 에서 받아 미터 좌표로 바꾼다.

§35-5 에서 "모델이 없어 원시 도형만 가능하다" 고 적었는데 **그건 틀렸다.**
건물의 진짜 평면 모양은 OSM 에 있고, 그걸 뽑아 올리면(extrude)
박스가 아니라 **그 블록의 실제 형상**이 나온다.

    python3 youtube_pipeline/scripts/fetch_buildings.py 프로젝트 \
        --name yongsan --center 37.5341 126.9881 --radius 260

한계를 먼저 밝힌다 (실측):
  - **발자국은 있는데 높이는 거의 없다.** 이태원 일대 62동 중
    `building:levels` 2동 · `height` 0동. 한국 OSM 은 층수 입력이 드물다
  - 그래서 높이는 **`--levels` 기본값으로 채운다.** 도해라는 걸 화면에 밝힐 것
  - 대상 건물의 층수는 어차피 건축개요에 있으니 그건 손으로 정확히 넣는다

Overpass 는 이 환경에서 막혀 있다(연결 리셋). OSM 메인 API `/api/0.6/map` 은 열린다 —
bbox 로만 받을 수 있어 반경 대신 사각형으로 자른다.

라이선스: **ODbL.** 표기 의무 — `© OpenStreetMap contributors`.
"""
import argparse, json, math, os, sys, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'motion', 'public')
UA = 'sangkwon-analyzer/1.0 (youtube pipeline; contact: no23sonate@gmail.com)'
API = 'https://api.openstreetmap.org/api/0.6/map'
CREDIT = '© OpenStreetMap contributors'


def fetch(lat0, lon0, radius, levels, keep):
    # 미터 → 도. 위도는 거의 상수, 경도는 위도에 따라 줄어든다
    dlat = radius / 110540.0
    dlon = radius / (111320.0 * math.cos(math.radians(lat0)))
    bbox = f'{lon0 - dlon:.6f},{lat0 - dlat:.6f},{lon0 + dlon:.6f},{lat0 + dlat:.6f}'
    req = urllib.request.Request(f'{API}?bbox={bbox}', headers={'User-Agent': UA})
    raw = urllib.request.urlopen(req, timeout=90).read()

    root = ET.fromstring(raw)
    nodes = {n.get('id'): (float(n.get('lat')), float(n.get('lon')))
             for n in root.findall('node')}

    # 위경도 → 미터 (원점 = center). z 는 북쪽이 음수 — three 에서 카메라가 +z 에 서면 북쪽이 위
    def xz(lat, lon):
        return [round((lon - lon0) * 111320.0 * math.cos(math.radians(lat0)), 2),
                round(-(lat - lat0) * 110540.0, 2)]

    out = []
    for w in root.findall('way'):
        tags = {t.get('k'): t.get('v') for t in w.findall('tag')}
        if 'building' not in tags and 'building:part' not in tags:
            continue
        pts = [nodes[nd.get('ref')] for nd in w.findall('nd') if nd.get('ref') in nodes]
        if len(pts) < 4:
            continue
        if pts[0] == pts[-1]:
            pts = pts[:-1]                       # 닫힌 고리의 중복 끝점 제거
        ring = [xz(*p) for p in pts]
        # 반경 밖(사각형 모서리)은 버린다 — 원형으로 잘라야 화면 구성이 안정된다
        if min(math.hypot(x, z) for x, z in ring) > radius:
            continue
        lv = tags.get('building:levels')
        h = tags.get('height')
        try:
            hm = float(h.replace('m', '').strip()) if h else (float(lv) * 3.3 if lv else None)
        except ValueError:
            hm = None
        out.append({'ring': ring,
                    'h': round(hm, 1) if hm else levels * 3.3,
                    'est': hm is None,           # 추정 높이인지 — 화면에 밝히려고 남긴다
                    'name': tags.get('name', '')})

    out.sort(key=lambda b: -sum(math.hypot(x, z) for x, z in b['ring']) / len(b['ring']))
    return out[:keep]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--name', required=True)
    ap.add_argument('--center', nargs=2, type=float, required=True, metavar=('LAT', 'LON'))
    ap.add_argument('--radius', type=int, default=250, help='미터 (기본 250)')
    ap.add_argument('--levels', type=int, default=5,
                    help='층수 태그가 없는 건물에 쓸 기본 층수 (기본 5)')
    ap.add_argument('--keep', type=int, default=120, help='가장 큰 것부터 이만큼만')
    a = ap.parse_args()

    b = fetch(a.center[0], a.center[1], a.radius, a.levels, a.keep)
    if not b:
        sys.exit('건물을 못 찾았다. 반경을 넓히거나 좌표를 확인할 것.')

    outdir = os.path.join(PUBLIC, a.project)
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, f'{a.name}_buildings.json')
    json.dump({'center': a.center, 'radius': a.radius, 'source': CREDIT,
               'buildings': b}, open(out, 'w'), ensure_ascii=False)

    est = sum(1 for x in b if x['est'])
    cred = os.path.join(outdir, 'CREDITS.md')
    head = f'# {a.project} — 자료 출처\n\n| 파일 | 원본 | 출처 / 라이선스 | 화면 표기 |\n|---|---|---|---|\n'
    if not os.path.exists(cred):
        open(cred, 'w', encoding='utf-8').write(head)
    with open(cred, 'a', encoding='utf-8') as f:
        f.write(f"| `{a.name}_buildings.json` | OSM 건물 발자국 (반경 {a.radius}m) | "
                f"{CREDIT}, **ODbL** | `{CREDIT}` |\n")

    print(f'{out}\n건물 {len(b)}동 · 높이 추정 {est}동 ({est / len(b) * 100:.0f}%)')
    print(f'화면 표기: {CREDIT}   ← ODbL 의무')
    if est / len(b) > 0.5:
        print('\n주의: 절반 이상이 추정 높이다. **도해라는 걸 화면에 밝힐 것.**')
        print('      대상 건물 층수는 건축개요에서 손으로 정확히 넣는다.')
    print('\nMassingCard 에 그대로: ' + json.dumps({'data': f'{a.project}/{a.name}_buildings.json'},
                                                  ensure_ascii=False))


if __name__ == '__main__':
    main()
