#!/usr/bin/env python3
"""브랜드 공식 광고·홍보 영상 수급 (2026-08-19 사용자 지시).

대본에 기업·브랜드가 나오면 그 기업이 **직접 만든 광고/홍보 영상**을 쓴다.
직접 찍은 실사보다 화면 감도가 높고, 브랜드 톤이 그대로 담겨 있다.

고르는 기준 (순서대로)
  1. 공식 채널일 것 — 팬 편집본·리액션은 제외
  2. 문맥 연관 — 대본 키워드(매장·팝업·리뉴얼 등)가 제목/설명에 있으면 가점
  3. 감도 — 길이 15~120초의 광고/브랜드필름을 우선 (제품 설명·발표회는 감점)
  4. 최신순 가중 — 오래된 소재는 화면이 티가 난다

인용 표기
  받은 항목마다 채널명·영상 제목·URL 을 credits.json 에 남긴다.
  화면에는 `SourceClipCard` 의 `courtesy` 로 'COURTESY OF <채널>' 를 띄운다.
  타인의 저작물이므로 **짧게 인용**하고 출처를 반드시 화면에 표기할 것.

사용:
  python3 youtube_pipeline/scripts/fetch_brand_media.py --brand "올리브영" \
      --context "팝업 성수 매장 리뉴얼" --slug oliveyoung_ad --max 3
  python3 youtube_pipeline/scripts/fetch_brand_media.py --brand "올리브영" --list-only
"""
import argparse
import json
import os
import re
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA_DIR = os.path.join(BASE, 'motion', 'public', 'media')
CREDITS = os.path.join(MEDIA_DIR, 'credits.json')

# 공식 채널로 보기 어려운 신호 — 팬 편집·요약·리액션
NOT_OFFICIAL = re.compile(
    r'(리액션|reaction|요약|모음|shorts 모음|팬|fan\s?cam|커버|cover|먹방|브이로그|vlog)', re.I)
# 광고·브랜드필름 신호 (가점)
AD_HINT = re.compile(
    r'(광고|캠페인|브랜드필름|brand\s?film|TVC|CF|티저|teaser|필름|film|아이덴티티|스팟)', re.I)
# 발표회·설명회 (감점 — 화면 감도가 낮다)
TALK_HINT = re.compile(r'(설명회|기자간담회|인터뷰|웨비나|세미나|컨퍼런스|IR|실적)', re.I)


def ytdlp(args, timeout=240):
    cmd = ['yt-dlp', '--extractor-args', 'youtube:player_client=mweb',
           '--sleep-requests', '1'] + args
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return r.stdout, r.stderr, r.returncode


def search(brand, context='', limit=25):
    """브랜드 공식 채널 위주로 후보를 모은다."""
    queries = [f'{brand} 공식 광고', f'{brand} 브랜드필름', f'{brand} 캠페인']
    if context:
        queries.insert(0, f'{brand} {context}')
    seen, out = set(), []
    for q in queries:
        url = f'ytsearch{limit}:{q}'
        so, se, rc = ytdlp(['--flat-playlist', '--print',
                            '%(id)s\t%(title)s\t%(channel)s\t%(duration)s\t%(upload_date)s', url])
        if rc != 0:
            print(f'  검색 실패({q}): {se.strip()[:120]}', flush=True)
            continue
        for line in so.strip().split('\n'):
            parts = line.split('\t')
            if len(parts) < 3 or not parts[0]:
                continue
            vid, title, channel = parts[0], parts[1], parts[2]
            dur = parts[3] if len(parts) > 3 else ''
            date = parts[4] if len(parts) > 4 else ''
            if vid in seen:
                continue
            seen.add(vid)
            out.append({'id': vid, 'title': title, 'channel': channel,
                        'duration': dur, 'date': date, 'query': q})
    return out


def score(item, brand, context=''):
    """감도·문맥·공식성 점수. 높을수록 좋다."""
    t, ch = item['title'], item['channel']
    s = 0.0
    # 공식 채널 — 채널명에 브랜드가 들어가면 강한 신호
    bn = re.sub(r'\s+', '', brand).lower()
    if bn and bn in re.sub(r'\s+', '', ch).lower():
        s += 5
    if NOT_OFFICIAL.search(t) or NOT_OFFICIAL.search(ch):
        s -= 6
    if AD_HINT.search(t):
        s += 3
    if TALK_HINT.search(t):
        s -= 3
    # 문맥 연관 — 대본 키워드가 제목에 있으면
    for w in [w for w in re.split(r'[\s,·]+', context) if len(w) >= 2]:
        if w in t:
            s += 1.5
    # 길이 — 15~120초를 광고로 본다
    try:
        d = float(item['duration'] or 0)
        if 15 <= d <= 120:
            s += 2
        elif d > 600:
            s -= 2
    except ValueError:
        pass
    # 최신 가중
    m = re.match(r'(\d{4})', item.get('date') or '')
    if m:
        y = int(m.group(1))
        s += max(0, (y - 2020)) * 0.3
    return s


def record(entry):
    data = []
    if os.path.exists(CREDITS):
        try:
            data = json.load(open(CREDITS, encoding='utf-8'))
        except json.JSONDecodeError:
            data = []
    data = [d for d in data if d.get('file') != entry['file']] + [entry]
    os.makedirs(MEDIA_DIR, exist_ok=True)
    json.dump(data, open(CREDITS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def download(item, slug, height=720):
    os.makedirs(MEDIA_DIR, exist_ok=True)
    out = os.path.join(MEDIA_DIR, f'{slug}.%(ext)s')
    so, se, rc = ytdlp(['-f', f'bv*[height<={height}][ext=mp4]+ba[ext=m4a]/b[height<={height}]',
                        '--merge-output-format', 'mp4', '-o', out,
                        f'https://www.youtube.com/watch?v={item["id"]}'], timeout=900)
    path = os.path.join(MEDIA_DIR, f'{slug}.mp4')
    if rc != 0 or not os.path.exists(path):
        print(f'  내려받기 실패: {se.strip()[-160:]}', flush=True)
        return None
    record({'file': f'{slug}.mp4', 'kind': 'video', 'source': f"YouTube — {item['channel']}",
            'title': item['title'], 'license': '인용 (짧게 사용 · 화면 출처 표기 필수)',
            'page': f"https://www.youtube.com/watch?v={item['id']}",
            'query': item['query'], 'tier': '브랜드 공식 광고·홍보',
            'courtesy': item['channel']})
    print(f"  [brand] {slug}.mp4 | {item['channel']} | {item['title'][:52]}", flush=True)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--brand', required=True)
    ap.add_argument('--context', default='', help='대본 문맥 키워드 (연관도 가점)')
    ap.add_argument('--slug', default='', help='저장 파일명 (여러 개면 뒤에 번호가 붙는다)')
    ap.add_argument('--max', type=int, default=1, help='내려받을 개수')
    ap.add_argument('--height', type=int, default=720)
    ap.add_argument('--list-only', action='store_true', help='후보만 보고 안 받는다')
    args = ap.parse_args()

    print(f'· {args.brand} 후보 검색', flush=True)
    items = search(args.brand, args.context)
    if not items:
        print('후보 없음 — yt-dlp/deno 상태를 확인할 것', flush=True)
        return 1
    ranked = sorted(items, key=lambda it: -score(it, args.brand, args.context))

    print(f'{len(ranked)}건 중 상위:', flush=True)
    for it in ranked[:10]:
        print(f"  {score(it, args.brand, args.context):>5.1f}  {it['channel'][:18]:18} "
              f"{(it['duration'] or '?'):>5}s  {it['title'][:52]}", flush=True)
    if args.list_only:
        return 0

    slug = args.slug or re.sub(r'\W+', '_', args.brand.lower())
    got = 0
    for i, it in enumerate(ranked):
        if got >= args.max:
            break
        name = slug if args.max == 1 else f'{slug}_{got + 1}'
        if download(it, name, args.height):
            got += 1
    print(f'done: {got}/{args.max}', flush=True)
    return 0 if got else 1


if __name__ == '__main__':
    sys.exit(main())
