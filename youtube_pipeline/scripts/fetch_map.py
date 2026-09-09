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

# ── 2026-09-09 · CARTO 는 키 없이 못 쓴다 ──────────────────────────────
# light/dark 로 받아 둔 지도 석 장에 'API KEY REQUIRED' 워터마크가 화면
# 전체에 대각선으로 박혀 있었다. **HTTP 200 으로 멀쩡히 돌아온다** — 실패로
# 안 잡히고, 검수시트에서는 타일이 620px 이라 글자가 안 읽혀 그대로 지나갔다.
# 키 없이 되는 osm 을 기본으로 두고, 종이 톤은 받은 뒤에 입힌다(--wash).
STYLES = {
    'osm':   ('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              '© OpenStreetMap contributors'),
    # 아래 둘은 CARTO 계정 키가 있어야 한다. 키 없이 받으면 워터마크가 박힌다
    'light': ('https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              '© OpenStreetMap contributors © CARTO'),
    'dark':  ('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              '© OpenStreetMap contributors © CARTO'),
}
# 종이 톤 — 밝은 쪽은 종이색, 어두운 쪽은 옅은 먹. 채도를 걷어내고 그 사이로
# 편다. CARTO Positron 을 쓰던 이유가 이 톤이었으니 그걸 직접 만든다
WASH = {
    'paper': ((0x86, 0x82, 0x7A), (0xF2, 0xEF, 0xE8)),
    'blueprint': ((0x0E, 0x18, 0x2C), (0x8FA, 0x0, 0x0)),   # 미사용 자리표시
}
MAX_TILES = 64          # 타일 서버 예의. 이걸 넘기면 줌을 낮추라고 말한다
NOMINATIM = 'https://nominatim.openstreetmap.org/search'


def find(query, limit=3):
    """주소·지명 → 좌표 (OSM Nominatim).

    **좌표를 손으로 찍지 말 것.** 샘플 1회차에서 눈대중으로 넣었다가
    용산공원 핀이 1.5km 어긋났다. 지도는 틀리면 바로 티가 나고,
    한 번 틀리면 그 영상의 다른 숫자까지 의심받는다.

    한국 지번(예: "이태원동 22-34")은 Nominatim 이 **동 중심점으로 뭉갠다.**
    필지 단위가 필요하면 근처 랜드마크(역·구청·학교)로 잡는 게 정확하다.
    """
    import urllib.parse
    u = NOMINATIM + '?' + urllib.parse.urlencode({
        'q': query, 'format': 'json', 'limit': str(limit)})
    req = urllib.request.Request(u, headers={'User-Agent': UA})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


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


def wash_paper(im):
    """지도를 종이 톤 2색으로 눕힌다 — 위에 얹을 글자·핀이 이겨야 한다."""
    import numpy as np
    from PIL import Image
    a = np.asarray(im.convert('RGB'), dtype=np.float32)
    lum = (a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114) / 255.0
    # 가운데 대비를 살짝 눌러 도로망이 얼룩이 되지 않게
    lum = np.clip(lum, 0, 1) ** 1.06
    lo, hi = WASH['paper']
    out = np.stack([lo[c] + lum * (hi[c] - lo[c]) for c in range(3)], axis=-1)
    return Image.fromarray(np.clip(out, 0, 255).astype('uint8'))


def looks_watermarked(im):
    """키 없이 받은 타일에 박히는 워터마크를 잡는다.

    베이스맵은 밝다 — 근검정 화소가 3% 를 넘는 일이 없다. 워터마크는 진한
    글자가 판 전체에 반복되므로 그 비율이 훌쩍 뛴다. 실패가 HTTP 200 으로
    돌아오는 판이라, 받은 다음에 그림을 보고 판단하는 수밖에 없다.
    """
    import numpy as np
    g = np.asarray(im.convert('L'))
    return float((g < 110).mean())


def fetch(project, name, lat, lon, zoom, w, h, style, wash=None):
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

    dark = looks_watermarked(canvas)
    if dark > 0.06:
        print(f'  ✗ 진한 화소가 {dark:.1%} 다 — 워터마크(키 요구) 타일일 수 있다.')
        print(f'    {style} 대신 osm 으로 받아 볼 것.')
    if wash == 'paper':
        canvas = wash_paper(canvas)

    out = os.path.join(PUBLIC, project, f'{name}.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    canvas.save(out)

    north, west = px2deg(x0, y0, zoom)
    south, east = px2deg(x0 + w, y0 + h, zoom)

    cred = os.path.join(PUBLIC, project, 'CREDITS.md')
    head = f'# {project} — 자료 출처\n\n| 파일 | 원본 | 출처 / 라이선스 | 화면 표기 |\n|---|---|---|---|\n'
    if not os.path.exists(cred):
        open(cred, 'w', encoding='utf-8').write(head)
    # 같은 파일 줄이 이미 있으면 **갈아 끼운다.** 그냥 붙이기만 하면 줌이나
    # 스타일을 바꿔 다시 받을 때마다 줄이 쌓이고, 지난 줄이 지금 파일과
    # 다른 내용을 말하게 된다 (z17 light 를 받아 놨는데 "dark" 줄이 남는 식).
    row = (f"| `{name}.png` | 지도 타일 z{zoom} ({style}{'·' + wash if wash else ''}) | "
           f"{credit}, **ODbL** | `{credit}` |\n")
    lines = open(cred, encoding='utf-8').read().splitlines(keepends=True)
    kept = [ln for ln in lines if not ln.startswith(f"| `{name}.png` |")]
    open(cred, 'w', encoding='utf-8').write(''.join(kept) + row)

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
    ap.add_argument('--center', nargs=2, type=float, metavar=('LAT', 'LON'))
    ap.add_argument('--zoom', type=int, default=15,
                    help='13=도시권 · 15=동네 · 17=블록 (기본 15)')
    ap.add_argument('--size', nargs=2, type=int, default=[1920, 1080], metavar=('W', 'H'))
    ap.add_argument('--style', choices=list(STYLES), default='osm')
    ap.add_argument('--wash', choices=['paper'], default=None,
                    help='받은 뒤 종이 톤 2색으로 눕힌다 (osm 색이 시끄러울 때)')
    ap.add_argument('--find', action='append', default=[],
                    help='주소·지명으로 좌표를 찾아 출력만 한다 (여러 번). 지도는 안 받는다')
    a = ap.parse_args()

    if not a.find and not a.center:
        sys.exit('--center 또는 --find 중 하나는 줘야 한다.')

    if a.find:
        print('좌표 (OSM Nominatim · ODbL)\n')
        for q in a.find:
            try:
                rs = find(q)
            except Exception as e:
                print(f'  {q:28s} 실패: {e}'); continue
            if not rs:
                print(f'  {q:28s} **못 찾음** — 다른 이름으로 시도할 것'); continue
            r = rs[0]
            print(f"  {q:28s} {float(r['lat']):.6f}, {float(r['lon']):.6f}")
            print(f"  {'':28s} └ {r.get('display_name','')[:70]}")
            time.sleep(1.1)                      # Nominatim 은 초당 1회
        print('\n주의: 한국 지번은 동 중심점으로 뭉개진다. 필지가 필요하면')
        print('      근처 랜드마크(역·구청·학교)로 잡을 것.')
        return

    fetch(a.project, a.name, a.center[0], a.center[1], a.zoom,
          a.size[0], a.size[1], a.style, a.wash)


if __name__ == '__main__':
    main()
