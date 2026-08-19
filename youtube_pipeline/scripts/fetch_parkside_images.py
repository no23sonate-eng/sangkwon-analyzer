#!/usr/bin/env python3
"""더 파크사이드 서울 자료 이미지 수집 → motion/public/parkside/

공식 홈페이지(theparksideseoul.com)는 CUPID(국내 WAF) JS 챌린지가 걸려 있어
평범한 curl/requests 로는 빈 스크립트 페이지만 돌아온다. 챌린지는
`slowAES.decrypt(c, 2, a, b)` = AES-128-CBC(nopad) 복호 결과를 CUPID 쿠키에
넣고 ?ckattempt=1 로 재요청하는 구조라, openssl 로 그대로 재현한다.

Wikimedia Commons 이미지는 CC 라이선스 — CREDITS.md 의 표기 문자열을
카드 source prop 에 반드시 넣어야 한다.

    python3 youtube_pipeline/scripts/fetch_parkside_images.py
"""
import binascii, http.cookiejar, os, re, subprocess, urllib.parse, urllib.request, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'motion', 'public', 'parkside')
BASE = 'https://www.theparksideseoul.com'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
WM_UA = 'sangkwon-analyzer/1.0 (youtube pipeline)'

# 홈페이지 경로 → 저장 이름
SITE = {
    '/img/etc/thumb-universe.jpg': 'hero.jpg',
    '/img/etc/etc-seoul-pic05.jpg': 'centralpark.jpg',
    '/img/ill_map3.jpg': 'map.jpg',
    '/suites_resource/img/etc/home-visual.jpg': 'retail.jpg',
    '/img/etc/etc-uni-pic-plan.jpg': 'layout.jpg',
    '/upload/board/news/687480c74429d_20240510_유엔사부지 오피스텔_조감도_Background_01.jpg': 'closing.jpg',
}
COMMONS = {
    'File:Aerial Tour 2 Camp Humphreys, Sept. 13, 2017 (37293016265).jpg': 'humphreys.jpg',
    'File:Rosewood Hong Kong Lobby 201906.jpg': 'rosewood.jpg',
}
MAX_W = 2200


def _aes_cbc_dec(ct_hex, key_hex, iv_hex):
    p = subprocess.run(['openssl', 'enc', '-d', '-aes-128-cbc', '-K', key_hex, '-iv', iv_hex, '-nopad'],
                       input=binascii.unhexlify(ct_hex), capture_output=True, check=True)
    return binascii.hexlify(p.stdout).decode()


def cupid_session(url):
    """CUPID 챌린지를 통과한 opener 를 돌려준다."""
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    op.addheaders = [('User-Agent', UA), ('Accept-Language', 'ko-KR,ko;q=0.9')]
    body = op.open(url, timeout=30).read()
    if b'slowAES' in body:
        t = body.decode('utf8', 'ignore')
        a, b, c = (re.search(rf'{v}=toNumbers\("([0-9a-f]+)"\)', t).group(1) for v in 'abc')
        host = urllib.parse.urlsplit(url).hostname
        cj.set_cookie(http.cookiejar.Cookie(0, 'CUPID', _aes_cbc_dec(c, a, b), None, False,
                                            host, False, False, '/', True, True,
                                            None, False, None, None, {}))
        op.open(url + ('&' if '?' in url else '?') + 'ckattempt=1', timeout=30).read()
    return op


def save(raw, dst):
    from PIL import Image
    import io
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, dst), quality=92)
    print(f'  {dst:16s} {im.size[0]}x{im.size[1]}')


def main():
    os.makedirs(OUT, exist_ok=True)
    print('공식 홈페이지 (CUPID 우회)')
    op = cupid_session(BASE + '/')
    for path, dst in SITE.items():
        req = urllib.request.Request(BASE + urllib.parse.quote(path), headers={'Referer': BASE + '/'})
        save(op.open(req, timeout=60).read(), dst)

    print('Wikimedia Commons (CC — 표기 의무)')
    q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'prop': 'imageinfo',
                                'iiprop': 'url', 'iiurlwidth': str(MAX_W),
                                'titles': '|'.join(COMMONS)})
    pages = json.load(urllib.request.urlopen(
        urllib.request.Request(f'https://commons.wikimedia.org/w/api.php?{q}',
                               headers={'User-Agent': WM_UA}), timeout=30))['query']['pages']
    for p in pages.values():
        ii = p['imageinfo'][0]
        raw = urllib.request.urlopen(urllib.request.Request(
            ii.get('thumburl') or ii['url'], headers={'User-Agent': WM_UA}), timeout=60).read()
        save(raw, COMMONS[p['title']])


if __name__ == '__main__':
    main()
