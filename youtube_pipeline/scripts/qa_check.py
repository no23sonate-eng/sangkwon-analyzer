#!/usr/bin/env python3
"""편집 패키지 납품 전 자동 검사.

이 파이프라인에서 **실제로 났던 사고**를 잡는 게 목적이다. 눈으로 43컷을 다시
보는 대신 여기서 걸러진다.

  1) 데이터 정합    scene_plan ↔ scene_props 카드 불일치 / 누락 장면
  2) 자산 존재      props 가 가리키는 이미지·영상이 실제로 있는지
  3) 클립 규격      해상도·fps·타임스케일·길이(계획 대비)·용량 상한
  4) 리텐션 규칙    한 컷 최대 길이, 오프닝 컷 밀도, 평균 컷 길이
                    (2026 기준: 컷 3~8초, 15초 초과 금지, 첫 30초는 촘촘하게)
  5) 자막 안전영역  종이 카드 하단 260px 에 잉크가 침범했는지 (픽셀 검사)
  6) 출처 표기      사진 자산을 쓰는 카드에 source 가 비어 있지 않은지
                    CC 라이선스 자산은 저작자 표기가 남아 있는지

    python3 youtube_pipeline/scripts/qa_check.py 더파크사이드서울
    python3 youtube_pipeline/scripts/qa_check.py 더파크사이드서울 --skip-pixels

종료 코드: ERROR 가 하나라도 있으면 1. WARN 만 있으면 0.
"""
import argparse, json, os, re, subprocess, sys

import imageio_ffmpeg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'motion', 'public')
CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
FF = imageio_ffmpeg.get_ffmpeg_exe()

FPS = 30
W, H = 1920, 1080
SUBTITLE_SAFE_BOTTOM = 260          # paper.jsx 와 같은 값
TIMESCALE = 90000
MAX_CLIP_MB = 12.0
MAX_CUT_SEC = 10.0                  # 이보다 긴 한 컷은 리텐션이 꺾인다
# 챕터 기준은 전부 B1M 117편 실측치다 (design_reference §31-3)
CHAP_MIN = 48.0                     # p10
CHAP_MAX = 237.0                    # p90
INTRO_MAX = 100.0                   # 중앙 65초. 100초를 넘으면 훅이 늘어진 것
CHAP_PER_MIN = 0.55
OPENING_SEC = 30.0                  # 오프닝 구간
OPENING_MIN_CUTS = 5                # 오프닝은 더 촘촘하게
CUT_SWEET_SPOT = (2.5, 6.0)
TARGET_AVG = 6.0                    # 평균 컷 길이 목표
REPEAT_MAX = 2                      # 같은 카드가 이보다 많이 연속되면 경고

# 저작자 표기가 의무인 자산 → source 에 반드시 들어가야 하는 문자열
# 배경에 사진/도면을 까는 카드 — 하단 잉크 검사로는 자막 침범을 판단할 수 없다
PHOTO_CARDS = {
    'SectionPhotoCard', 'FullBleedCard', 'PaperImageCard', 'ParkCompareCard',
    'PhotoSplitCard', 'PhotoStepsCard', 'NewsQuoteCard',
}

CC_ASSETS = {
    'photo_centralpark.jpg': 'dronepicr',
    'photo_yongsanpark.jpg': 'Korea.net',
    'yongsan_base.jpg': 'MNXANL',
    'humphreys.jpg': 'USAG Humphreys',
    'rosewood.jpg': 'Wpcpey',
    'rosewood_full.jpg': 'Wpcpey',
    'rosewood_tower.jpg': 'Ceeseven',
    'mori_roppongi.jpg': '稲妻ノ歯鯨',
    'mori_toranomon.jpg': 'Kakidai',
    'mori_azabudai.jpg': 'Syced',
}


class Report:
    def __init__(self):
        self.rows = []

    def add(self, level, area, msg):
        self.rows.append((level, area, msg))

    err = lambda self, a, m: self.add('ERROR', a, m)
    warn = lambda self, a, m: self.add('WARN', a, m)
    ok = lambda self, a, m: self.add('ok', a, m)

    def dump(self):
        order = {'ERROR': 0, 'WARN': 1, 'ok': 2}
        for lv, area, msg in sorted(self.rows, key=lambda r: (order[r[0]], r[1])):
            tag = {'ERROR': '✗', 'WARN': '!', 'ok': '·'}[lv]
            print(f'{tag} [{area}] {msg}', flush=True)
        n_e = sum(1 for r in self.rows if r[0] == 'ERROR')
        n_w = sum(1 for r in self.rows if r[0] == 'WARN')
        print(f'\nERROR {n_e} · WARN {n_w} · 검사 {len(self.rows)}건', flush=True)
        return n_e


# ── 공통 ────────────────────────────────────────────────────────────────
def probe(path):
    """길이/해상도/fps/타임스케일/비트레이트를 한 번에."""
    r = subprocess.run([FF, '-i', path, '-hide_banner'], capture_output=True, text=True)
    txt = r.stderr
    out = {}
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', txt)
    if m:
        out['dur'] = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
    m = re.search(r'Stream #0:0.*?Video: (\w+).*?, (\d+)x(\d+)', txt, re.S)
    if m:
        out['codec'], out['w'], out['h'] = m[1], int(m[2]), int(m[3])
    m = re.search(r'([\d.]+) fps', txt)
    if m:
        out['fps'] = float(m[1])
    m = re.search(r'bitrate: (\d+) kb/s', txt)
    if m:
        out['kbps'] = int(m[1])
    return out


def cuts_of(plan):
    """타임라인 순서대로 (파일명, 길이초, 시작초) 목록."""
    cuts, t = [], 0.0
    for sc in plan['scenes']:
        cd = sc.get('cardDur', sc['dur'])
        if cd > 0:
            cuts.append((f"sec{sc['id']:02d}_{sc['key']}.mp4", cd, t))
            t += cd
        bs = sc.get('broll')
        if bs:
            bs = bs if isinstance(bs, list) else [bs]
            for j, b in enumerate(bs):
                sfx = '_b' if len(bs) == 1 else f'_b{j + 1}'
                cuts.append((f"sec{sc['id']:02d}_{sc['key']}{sfx}.mp4", b['dur'], t))
                t += b['dur']
    return cuts


ASSET_KEYS = ('image', 'photo', 'logo', 'shape')
IMG_EXT = ('.jpg', '.jpeg', '.png', '.webp')


def iter_assets(obj):
    """props 안에 박힌 이미지 경로를 훑는다.

    주의: `shape` 는 파일 경로일 때(ParkCompareCard)도 있고 프리셋 이름일
    때(SkylineCompareCard 의 'parc1' 'lotte')도 있다. 확장자로 갈라낸다.
    """
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ASSET_KEYS and isinstance(v, str) and v.lower().endswith(IMG_EXT):
                yield v
            else:
                yield from iter_assets(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from iter_assets(v)


# ── 검사 ────────────────────────────────────────────────────────────────
def check_data(plan, props, rep):
    ids = {str(s['id']) for s in plan['scenes']}
    missing = sorted(ids - set(props), key=int)
    if missing:
        rep.err('데이터', f'scene_props 에 없는 장면: {missing}')
    extra = sorted(set(props) - ids, key=int)
    if extra:
        rep.warn('데이터', f'scene_plan 에 없는 props: {extra}')
    for sc in plan['scenes']:
        e = props.get(str(sc['id']))
        if e and e['card'] != sc['card']:
            rep.err('데이터', f"#{sc['id']} 카드 불일치 plan={sc['card']} props={e['card']}")
    if not missing and not extra:
        rep.ok('데이터', f"{len(ids)}장면 정합 확인")


def check_assets(props, rep):
    seen, bad = set(), []
    for sid, e in props.items():
        for a in iter_assets(e['props']):
            seen.add(a)
            if not os.path.exists(os.path.join(PUBLIC, a)):
                bad.append(f'#{sid} {a}')
    if bad:
        rep.err('자산', '없는 파일: ' + ', '.join(bad))
    else:
        rep.ok('자산', f'{len(seen)}개 이미지 모두 존재')


def check_credits(props, rep):
    for sid, e in props.items():
        src = (e['props'].get('source') or '')
        assets = list(iter_assets(e['props']))
        photos = [a for a in assets if not a.endswith('.png')]   # 로고·실루엣 png 는 제외
        if photos and not src:
            rep.warn('출처', f'#{sid} 사진을 쓰는데 source 가 비었다 ({photos[0]})')
        for a in assets:
            need = CC_ASSETS.get(os.path.basename(a))
            if need and need not in src:
                rep.err('출처', f'#{sid} {os.path.basename(a)} 는 "{need}" 표기가 의무인데 source="{src}"')
    rep.ok('출처', 'CC 자산 저작자 표기 검사 완료')


def check_clips(plan, clipdir, rep):
    if not os.path.isdir(clipdir):
        rep.err('클립', f'clips 폴더 없음: {clipdir}')
        return []
    cuts = cuts_of(plan)
    want = {c[0] for c in cuts}
    have = {f for f in os.listdir(clipdir) if f.endswith('.mp4')}
    for f in sorted(want - have):
        rep.err('클립', f'렌더 안 됨: {f}')
    for f in sorted(have - want):
        rep.warn('클립', f'계획에 없는 잔여 파일: {f} (지울 것)')

    for name, dur, _ in cuts:
        p = os.path.join(clipdir, name)
        if not os.path.exists(p):
            continue
        info = probe(p)
        got = info.get('dur', 0)
        if abs(got - dur) > 0.08:
            rep.err('클립', f'{name} 길이 {got:.2f}s (계획 {dur:.2f}s)')
        if (info.get('w'), info.get('h')) != (W, H):
            rep.err('클립', f"{name} 해상도 {info.get('w')}x{info.get('h')}")
        if info.get('fps') and abs(info['fps'] - FPS) > 0.05:
            rep.err('클립', f"{name} fps {info['fps']}")
        mb = os.path.getsize(p) / 1048576
        if mb > MAX_CLIP_MB:
            rep.warn('클립', f'{name} {mb:.1f}MB — 편집 소스로 과하다 (재인코딩 권장)')
    rep.ok('클립', f'{len(cuts)}컷 규격 검사 완료')
    return cuts


def check_timescale(clipdir, cuts, rep):
    """concat 데먹서가 타임스탬프를 망가뜨리는 원인. 전부 같아야 한다."""
    bad = []
    for name, _, _ in cuts:
        p = os.path.join(clipdir, name)
        if not os.path.exists(p):
            continue
        r = subprocess.run([FF, '-i', p, '-hide_banner'], capture_output=True, text=True)
        m = re.search(r'Stream #0:0.*?\(und\).*?tbn', r.stderr)
        # ffmpeg 는 tbn 을 사람이 읽는 단위로 줄여 쓴다 (90k). 90k 가 아니면 의심.
        if '90k tbn' not in r.stderr:
            bad.append(name)
    if bad:
        rep.err('타임스케일', f'90k 가 아닌 클립 {len(bad)}개 — concat 시 길이가 틀어진다: {bad[:5]}')
    else:
        rep.ok('타임스케일', '전 클립 90k 통일')


def check_retention(cuts, rep):
    """2026 기준 리텐션 편집 규칙."""
    if not cuts:
        return
    longs = [(n, d) for n, d, _ in cuts if d > MAX_CUT_SEC]
    for n, d in longs:
        rep.warn('리텐션', f'{n} {d:.1f}s — 한 컷 {MAX_CUT_SEC:.0f}초 초과. 중간에 실사/앵글 전환을 넣을 것')
    open_cuts = [c for c in cuts if c[2] < OPENING_SEC]
    if len(open_cuts) < OPENING_MIN_CUTS:
        rep.warn('리텐션', f'첫 {OPENING_SEC:.0f}초에 컷이 {len(open_cuts)}개뿐 — {OPENING_MIN_CUTS}개 이상 권장')
    else:
        rep.ok('리텐션', f'첫 {OPENING_SEC:.0f}초 {len(open_cuts)}컷')
    ds = [d for _, d, _ in cuts]
    avg = sum(ds) / len(ds)
    inside = sum(1 for d in ds if CUT_SWEET_SPOT[0] <= d <= CUT_SWEET_SPOT[1])
    rep.ok('리텐션', f'컷 {len(ds)}개 · 평균 {avg:.1f}s · 최장 {max(ds):.1f}s · '
                    f'3~8초 구간 {inside}/{len(ds)}컷 ({inside / len(ds) * 100:.0f}%)')
    if avg > TARGET_AVG:
        rep.warn('리텐션', f'평균 컷 길이 {avg:.1f}s — 목표 {TARGET_AVG:.0f}초. '
                           f'절(쉼표) 단위로 더 쪼개거나 실사를 끼울 것')


def check_chapters(plan, rep):
    """챕터 구조 (design_reference §31-3, B1M 117편 실측).

    챕터는 시청자가 "지금 어디쯤인지" 를 잡는 유일한 장치다.
    없으면 롱폼이 그냥 흐른다. 있어도 30초짜리로 잘게 썰면 목차 구실을 못 한다.
    """
    chs = plan.get('chapters') or []
    total = plan['scenes'][-1]['end'] if plan.get('scenes') else 0
    if not chs:
        rep.warn('챕터', '챕터가 없다 — plan_from_script.py 를 다시 돌리거나 손으로 넣을 것')
        return
    ds = sorted(c['dur'] for c in chs)
    med = ds[len(ds) // 2]
    rep.ok('챕터', f'{len(chs)}개 · 길이 중앙 {med:.0f}초 '
                   f'(B1M 실측 중앙 8개 · 90초 · 분당 {CHAP_PER_MIN})')
    if chs[0]['ts'] != '0:00':
        rep.err('챕터', '첫 챕터가 0:00 이 아니다 — 유튜브가 목차로 안 잡는다')
    short = [c for c in chs if c['dur'] < CHAP_MIN]
    for c in short:
        rep.warn('챕터', f"{c['ts']} {c['dur']:.0f}초 — {CHAP_MIN:.0f}초(B1M p10) 미만. 앞 챕터에 붙일 것")
    for c in chs:
        if c['dur'] > CHAP_MAX:
            rep.warn('챕터', f"{c['ts']} {c['dur']:.0f}초 — {CHAP_MAX:.0f}초(B1M p90) 초과. 쪼갤 것")
    if chs[0]['dur'] > INTRO_MAX:
        rep.warn('챕터', f"인트로 {chs[0]['dur']:.0f}초 — B1M 중앙 65초. 훅이 길면 본론 전에 이탈한다")
    unnamed = [c['ts'] for c in chs if not c.get('name')]
    if unnamed:
        rep.warn('챕터', f"제목 없는 챕터 {len(unnamed)}개 ({', '.join(unnamed[:4])}) — "
                         '설명문 목차에 그대로 나간다')
    if total:
        rate = len(chs) / (total / 60)
        if rate < CHAP_PER_MIN * 0.55:
            rep.warn('챕터', f'분당 {rate:.2f}개 — B1M {CHAP_PER_MIN}. 챕터가 너무 굵다')


def check_grammar_variety(plan, props, rep):
    """같은 카드가 연속으로 반복되면 화면이 안 바뀐 것처럼 읽힌다.

    파크사이드 1편은 SkylineCompareCard 가 4번, PhotoStepsCard 가 3번 반복됐다.
    컷 길이만 봐서는 안 잡히는 결함이라 따로 센다.
    """
    # 카드 이름만 보면 "같은 카드 다른 톤"을 반복으로 오판한다.
    # 화면이 같아 보이느냐가 기준이므로 (카드 + 바탕 + 정렬) 조합으로 센다.
    seq = []
    for sc in plan['scenes']:
        sid = str(sc['id'])
        if sid not in props or sc.get('cardDur', sc['dur']) <= 0:
            continue
        pr = props[sid].get('props', {})
        seq.append(f"{props[sid]['card']}/{pr.get('theme', 'paper')}/{pr.get('align', 'center')}")
    run, worst = 1, []
    for i in range(1, len(seq)):
        if seq[i] == seq[i - 1]:
            run += 1
        else:
            if run > REPEAT_MAX:
                worst.append((seq[i - 1], run))
            run = 1
    if run > REPEAT_MAX:
        worst.append((seq[-1], run))
    for card, n in worst:
        rep.warn('문법', f'{card} 가 {n}컷 연속 — 카드·바탕·정렬 중 하나는 바꿀 것')
    from collections import Counter
    c = Counter(seq)
    top = c.most_common(1)[0] if c else ('-', 0)
    rep.ok('문법', f'화면 {len(set(seq))}종 / {len(seq)}컷 · 최다 {top[0]} {top[1]}회')

    # 실사 문구 처리도 같이 본다 — 여기가 전부 center 면 실사끼리 똑같아 보인다
    st = [b.get('style', 'center')
          for sc in plan['scenes']
          for b in ([sc['broll']] if isinstance(sc.get('broll'), dict)
                    else (sc.get('broll') or []))
          if b.get('text')]
    if st:
        from collections import Counter as C2
        rep.ok('문법', f'실사 문구 {len(set(st))}종 / {len(st)}컷 · {dict(C2(st))}')
        if len(set(st)) == 1 and len(st) >= 3:
            rep.warn('문법', f'실사 문구가 전부 {st[0]} — lower/band 를 섞을 것')


def check_safe_area(props, projdir, rep, limit=None):
    """종이 카드 하단 260px 에 잉크(글자/도형)가 침범했는지 픽셀로 본다.

    사진을 깔지 않는 카드만 검사한다 — 종이 배경에서는 어두운 픽셀 = 콘텐츠다.
    출처 캡션 자리(우하단)는 정상이므로 제외한다.
    """
    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        rep.warn('안전영역', 'Pillow/numpy 없음 — 건너뜀')
        return
    stills = os.path.join(projdir, 'stills')
    if not os.path.isdir(stills):
        rep.warn('안전영역', 'stills 폴더 없음 — `render_parkside.py --still` 먼저')
        return
    y0 = H - SUBTITLE_SAFE_BOTTOM
    checked = hits = 0
    for f in sorted(os.listdir(stills)):
        if not f.endswith('.png'):
            continue
        sid = f[3:5].lstrip('0') or '0'
        e = props.get(sid)
        if not e or e['card'] in PHOTO_CARDS or list(iter_assets(e['props'])):
            continue                                   # 사진 카드는 판단 불가
        a = np.asarray(Image.open(os.path.join(stills, f)).convert('L')).astype(int)
        band = a[y0:H - 40, 40:W - 700]                # 출처 캡션 자리 제외
        # 다크 카드도 있으므로 절대 밝기가 아니라 **배경 대비**로 본다.
        # 띠의 중앙값 = 배경, 거기서 크게 벗어난 픽셀 = 글자/도형.
        ink = (np.abs(band - np.median(band)) > 60).mean()
        checked += 1
        if ink > 0.004:
            hits += 1
            rep.warn('안전영역', f'{f} 하단 자막영역에 잉크 {ink * 100:.1f}% — 자막과 겹칠 수 있다')
        if limit and checked >= limit:
            break
    rep.ok('안전영역', f'종이 카드 {checked}장 검사 · 침범 {hits}장')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--skip-pixels', action='store_true')
    a = ap.parse_args()

    projdir = os.path.join(ROOT, 'projects', a.project)
    plan = json.load(open(os.path.join(projdir, 'scene_plan.json'), encoding='utf-8'))
    props = json.load(open(os.path.join(projdir, 'scene_props.json'), encoding='utf-8'))['scenes']

    rep = Report()
    check_data(plan, props, rep)
    check_assets(props, rep)
    check_credits(props, rep)
    check_chapters(plan, rep)
    check_grammar_variety(plan, props, rep)
    cuts = check_clips(plan, os.path.join(projdir, 'clips'), rep)
    if cuts:
        check_timescale(os.path.join(projdir, 'clips'), cuts, rep)
        check_retention(cuts, rep)
    if not a.skip_pixels:
        check_safe_area(props, projdir, rep)

    print(f'\n── QA: {a.project} ──')
    sys.exit(1 if rep.dump() else 0)


if __name__ == '__main__':
    main()
