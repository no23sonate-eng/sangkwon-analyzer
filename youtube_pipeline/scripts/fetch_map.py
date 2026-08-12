#!/usr/bin/env python3
"""좌표 → 지도 이미지. 타일을 받아 이어 붙인다.

**부동산 채널인데 지도가 한 장도 없었다.** 파크사이드 43컷에도, 갤러리 편에도 없다.
"용산 유엔사 부지"라고 말해도 그게 어디인지 화면이 답을 안 한다.
B1M 은 위치를 말할 때 거의 항상 지도를 깐다 — 경로선·영역·핀을 얹어서.

    python3 youtube_pipeline/scripts/fetch_map.py 프로젝트 --name yongsan \
        --center 37.5326 126.9800 --zoom 15 --style light

출력은 두 개다.
  motion/public/<프로젝트>/<name>.png       지도 이미지
  ...그리고 **bounds 를 화면에 찍어 준다.** MapCard 에 그대로 붙여 넣으면
  위경도로 핀·경로를 찍을 수 있다 — 픽셀을 눈대중으로 맞출 필요가 없다.

스타일
  light  CARTO Positron — 회색조·최소. **종이 톤과 제일 잘 붙는다 (기본값)**
  dark   CARTO Dark Matter — 먹 테마용
  osm    OpenStreetMap 기본 — 색이 많아 그래픽을 얹으면 시끄럽다. 지형이 필요할 때만

라이선스: 타일은 **© OpenStreetMap contributors** (ODbL). light/dark 는 **© CARTO** 도 함께.
표기는 의무이고, `CREDITS.md` 에 자동으로 들어간다. 화면에도 반드시 적을 것.
타일 서버에 부담을 주지 않도록 한 번에 받는 타일 수를 제한한다 (기본 6x4=24장).
"""
import argparse, io, json, math, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'motion', 'public')
TILE = 256
UA = 'sangkwon-analyzer/1.0 (youtube pipeline; contact: no23sonate@gmail.com)'

STYLES = {
    'light': ('https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              '© OpenStreetMap contributors © CARTO'),
    'dark':  ('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              '© OpenStreetMap contributors © CARTO'),
    'osm':   ('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              '© OpenStreetMap contributors'),
}
MAX_TILES = 48          # 타일 서버 예의. 이걸 넘기면 줌을 낮추라고 말한다


def deg2px(lat, lon, z):
    """위경도 → 웹 메르카토르 픽셀 (줌 z 기준)."""
    n = TILE * 2 ** z
    x = (lon + 180.0) / 360.0 * n
    r = math.radians(lat)
    y = (1.0 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2.0 * n
    return x, y


def px2deg(x, y, z):
    n = TILE * 2 ** z
    lon = x / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat, lon


def fetch(project, name, lat, lon, zoom, w, h, style):
    from PIL import Image
    url, credit = STYLES[style]

    cx, cy = deg2px(lat, lon, zoom)
    x0, y0 = cx - w / 2, cy - h / 2            # 캔버스 좌상단의 전역 픽셀 좌표
    tx0, ty0 = int(x0 // TILE), int(y0 // TILE)
    tx1, ty1 = int((x0 + w) // TILE), int((y0 + h) // TILE)
    n = (tx1 - tx0 + 1) * (ty1 - ty0 + 1)
    if n > MAX_TILES:
        sys.exit(f'타일 {n}장이 필요하다 (한도 {MAX_TILES}). 줌을 낮추거나 크기를 줄일 것.')

    canvas = Image.new('RGB', (int(w), int(h)), (238, 238, 238))
    got = 0
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            u = url.format(z=zoom, x=tx, y=ty)
            try:
                req = urllib.request.Request(u, headers={'User-Agent': UA})
                raw = urllib.request.urlopen(req, timeout=30).read()
                t = Image.open(io.BytesIO(raw)).convert('RGB')
            except Exception as e:
                print(f'  타일 실패 {tx},{ty}: {e}')
                continue
            canvas.paste(t, (int(tx * TILE - x0), int(ty * TILE - y0)))
            got += 1
            time.sleep(0.08)                    # 타일 서버 예의

    out = os.path.join(PUBLIC, project, f'{name}.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    canvas.save(out)

    north, west = px2deg(x0, y0, zoom)
    south, east = px2deg(x0 + w, y0 + h, zoom)

    cred = os.path.join(PUBLIC, project, 'CREDITS.md')
    head = f'# {project} — 자료 출처\n\n| 파일 | 원본 | 출처 / 라이선스 | 화면 표기 |\n|---|---|---|---|\n'
    if not os.path.exists(cred):
        open(cred, 'w', encoding='utf-8').write(head)
    with open(cred, 'a', encoding='utf-8') as f:
        f.write(f"| `{name}.png` | 지도 타일 z{zoom} ({style}) | "
                f"{credit}, **ODbL** | `{credit}` |\n")

    print(f'{out}  ({got}/{n} 타일 · {int(w)}x{int(h)})')
    print(f'화면 표기: {credit}   ← 반드시 화면에 적을 것 (ODbL 의무)')
    print('\nMapCard 에 그대로 붙여 넣을 것:')
    print(json.dumps({'image': f'{project}/{name}.png',
                      'bounds': [round(west, 6), round(south, 6),
                                 round(east, 6), round(north, 6)],
                      'source': credit}, ensure_ascii=False))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--name', required=True, help='파일명 (확장자 없이)')
    ap.add_argument('--center', nargs=2, type=float, required=True, metavar=('LAT', 'LON'))
    ap.add_argument('--zoom', type=int, default=15,
                    help='13=도시권 · 15=동네 · 17=블록 (기본 15)')
    ap.add_argument('--size', nargs=2, type=int, default=[1920, 1080], metavar=('W', 'H'))
    ap.add_argument('--style', choices=list(STYLES), default='light')
    a = ap.parse_args()
    fetch(a.project, a.name, a.center[0], a.center[1], a.zoom, a.size[0], a.size[1], a.style)


if __name__ == '__main__':
    main()
