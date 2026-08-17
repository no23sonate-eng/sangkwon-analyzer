#!/usr/bin/env python3
"""네이버 이미지 검색 → 후보 내려받기 → 컨택트 시트.

구글 이미지 검색은 curl 로 받으면 **JS 껍데기만** 온다 (실측: 92KB 인데 이미지 0개).
브라우저를 띄워도 이 환경의 프록시를 못 뚫는다. 반면 네이버 이미지 검색은
curl 로 바로 열리고 결과 HTML 에 원본 주소가 그대로 박혀 있다.

한 번은 "사진이 없다" 고 결론지었다가 틀렸다 — 카페 쎈느 사진은 널려 있었다.
검색이 막힌 게 아니라 **검색 경로를 잘못 골랐던 것**이라, 그 경로를 여기 남긴다.

    python3 fetch_naver_images.py "카페 쎈느 성수" --out /tmp/scene --n 40
    → /tmp/scene/s000.jpg ... + sheet.jpg (눈으로 고르라고 컨택트 시트도 만든다)
      urls.json 에 이미지 주소와 **원 블로그 글 주소**가 짝지어 들어간다 (출처 표기용)
"""
import argparse, html, json, os, re, subprocess, sys, urllib.parse

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')
SEARCH = 'https://search.naver.com/search.naver?where=image&query='


def page(query):
    out = subprocess.run(
        ['curl', '-sS', '--max-time', '40', '-A', UA,
         SEARCH + urllib.parse.quote(query)],
        capture_output=True)
    return out.stdout.decode('utf-8', 'ignore')


def harvest(h):
    """이미지 주소 + 그 근처에 있는 블로그 글 주소를 짝지어 뽑는다."""
    seen, out = set(), []
    for m in re.finditer(r'"(https?://[^"]*?(?:pstatic|naver)\.net/[^"]*?'
                         r'\.(?:jpe?g|png|webp)[^"]*?)"', h, re.I):
        u = html.unescape(m.group(1).replace('\\/', '/'))
        if re.search(r'static|logo|icon|blank|profile|thumb_', u, re.I):
            continue
        key = u.split('?')[0]
        if key in seen:
            continue
        seen.add(key)
        win = h[max(0, m.start() - 4000):m.start() + 4000]
        blog = re.search(r'https?://(?:m\.)?blog\.naver\.com/[A-Za-z0-9_\-]+/\d+', win)
        out.append({'img': u, 'page': blog.group(0) if blog else ''})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('query', nargs='+')
    ap.add_argument('--out', required=True)
    ap.add_argument('--n', type=int, default=36)
    ap.add_argument('--min', type=int, default=700, help='최소 가로 픽셀')
    a = ap.parse_args()
    from PIL import Image, ImageDraw

    os.makedirs(a.out, exist_ok=True)
    cands = []
    for q in a.query:
        cands += harvest(page(q))
    # 중복 제거 (검색어끼리 겹친다)
    uniq, seen = [], set()
    for c in cands:
        k = c['img'].split('?')[0]
        if k not in seen:
            seen.add(k)
            uniq.append(c)

    kept = []
    for i, c in enumerate(uniq[:a.n * 2]):
        if len(kept) >= a.n:
            break
        f = os.path.join(a.out, f's{len(kept):03d}.jpg')
        subprocess.run(['curl', '-sS', '-o', f, '--max-time', '25', '-A', UA, '-L',
                        '-e', 'https://search.naver.com/',
                        c['img'].replace('http://', 'https://')], capture_output=True)
        try:
            im = Image.open(f)
            if im.size[0] < a.min:
                os.remove(f)
                continue
            kept.append({**c, 'file': os.path.basename(f), 'size': list(im.size)})
        except Exception:
            os.path.exists(f) and os.remove(f)

    json.dump(kept, open(os.path.join(a.out, 'urls.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    # 컨택트 시트 — 어차피 눈으로 골라야 한다
    if kept:
        TW, TH, cols = 300, 225, 6
        rows = (len(kept) + cols - 1) // cols
        c = Image.new('RGB', (cols * (TW + 4), rows * (TH + 20)), (25, 25, 25))
        d = ImageDraw.Draw(c)
        for k, it in enumerate(kept):
            im = Image.open(os.path.join(a.out, it['file'])).convert('RGB')
            im.thumbnail((TW, TH))
            r, cc = divmod(k, cols)
            x, y = cc * (TW + 4), r * (TH + 20)
            c.paste(im, (x + (TW - im.width) // 2, y + 18))
            d.text((x + 4, y + 3), it['file'][1:4], fill=(255, 220, 60))
        c.save(os.path.join(a.out, 'sheet.jpg'), quality=84)
    print(f'{len(kept)}장 → {a.out}/sheet.jpg', file=sys.stderr)


if __name__ == '__main__':
    main()
