#!/usr/bin/env python3
"""더 파크사이드 서울 — 32개 장면 렌더.

scene_plan.json (타이밍) + scene_props.json (카드·props) 를 합쳐 Remotion 으로 뽑는다.

    python3 youtube_pipeline/scripts/render_parkside.py            # 전부 mp4
    python3 youtube_pipeline/scripts/render_parkside.py --still    # 검수용 스틸(png)만
    python3 youtube_pipeline/scripts/render_parkside.py 0 3 13     # 특정 장면만
    python3 youtube_pipeline/scripts/render_parkside.py --still -j 3  # 세 장씩 동시에

**동시 실행이 왜 필요한가.** 스틸 한 장에 3~7초인데 182컷이면 30분이 넘는다.
이 컨테이너는 파일시스템이 그보다 자주 스냅샷으로 되돌아가서, 렌더가 끝나기
전에 산출물이 통째로 사라지는 일이 오늘만 아홉 번 있었다. 렌더를 짧게 만드는
게 곧 작업을 끝내는 방법이다.

한 장 렌더는 대부분 크로미움을 띄우고 폰트·이미지를 받는 시간이라 CPU 가
놀고 있다. 코어 수보다 하나 적게 띄우면 벽시계 시간이 3분의 1 아래로 준다.
동시에 여러 개를 띄우면 메모리를 많이 쓰므로 기본값은 안전하게 잡는다.
"""
import argparse, glob, json, os, re, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOTION = os.path.join(ROOT, 'motion')
DEFAULT_PROJECT = '더파크사이드서울'
CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
PUBLIC = os.path.join(MOTION, 'public')
# 이것들보다 결과물이 오래됐으면 다시 굽는다 — 카드 코드가 바뀌면 전부 낡는다
# ── 무엇이 바뀌면 그 컷이 낡는가 ──────────────────────────────────────────
# 처음엔 src/*.jsx 를 통째로 봤다. 그러면 **카드 하나만 고쳐도 269컷 전부가
# 낡은 것**이 돼 --fresh 가 아무것도 건너뛰지 못한다. RatioCard 를 고쳤는데
# StageCard 89컷을 다시 굽는 건 말이 안 된다.
# 컷이 쓰는 카드 파일 + 모두가 기대는 공용 파일만 본다.
_SHARED = [f for f in (
    'paper.jsx', 'Fonts.jsx', 'MotionWrap.jsx', 'MotionShell.jsx',
    'cardRegistry.jsx', 'Root.jsx', 'index.jsx', 'shared.jsx', 'layout.jsx',
) if os.path.exists(os.path.join(MOTION, 'src', f))]


def _watch_for(card):
    """이 컷이 기대는 파일들. 없는 이름은 조용히 빠진다"""
    names = list(_SHARED)
    if card:
        names.append(f'{card}.jsx')
    out = []
    for n in names:
        f = os.path.join(MOTION, 'src', n)
        if os.path.exists(f):
            out.append(f)
    return out
FPS = 30


def load(proj):
    # ── design.json 이 더 새것이면 멈춘다 ──────────────────────────────────
    # `apply_design.py --check` 는 **읽기만** 한다. 설계를 고치고 --check 로
    # 확인만 한 뒤 렌더를 돌리면, 낡은 scene_plan 을 그리면서 조용히
    # 성공한다. 실제로 그렇게 60컷이 `[skip] 장면 전체가 실사` 로 빠졌다.
    # 조용히 틀리느니 여기서 세운다
    dj = os.path.join(proj, 'design.json')
    sp = os.path.join(proj, 'scene_plan.json')
    if os.path.exists(dj) and os.path.exists(sp) and os.path.getmtime(dj) > os.path.getmtime(sp):
        sys.exit('design.json 이 scene_plan.json 보다 새것이다 — '
                 'apply_design.py 를 (--check 없이) 먼저 돌려라')
    plan = json.load(open(os.path.join(proj, 'scene_plan.json'), encoding='utf-8'))
    props = json.load(open(os.path.join(proj, 'scene_props.json'), encoding='utf-8'))['scenes']
    out = []
    for sc in plan['scenes']:
        sid = str(sc['id'])
        if sid not in props:
            print(f'[skip] #{sid} — scene_props.json 에 없음', flush=True)
            continue
        entry = props[sid]
        if entry['card'] != sc['card'] and not entry.get('motion'):
            print(f"[warn] #{sid} 카드 불일치: plan={sc['card']} props={entry['card']}", flush=True)
        # cardDur 가 있으면 장면의 앞부분만 카드고 나머지는 실사(render_broll.py).
        # cardDur == 0 이면 장면 전체가 실사라 카드를 아예 안 뽑는다.
        dur = sc.get('cardDur', sc['dur'])
        if dur <= 0:
            print(f"[skip] #{sid} {sc['key']} — 장면 전체가 실사", flush=True)
            continue
        # `motion` 이 있으면 카드를 MotionShell 로 감싸는 컴포지션으로 돌린다.
        # 카드 코드는 그대로 두고 전환·강조 모션만 얹는다 (design_reference §23).
        #
        # **항상 MotionWrap 을 거친다.** 예전엔 motion 이 없으면 카드 이름을
        # 컴포지션으로 직접 불렀는데, 그러려면 카드를 cardRegistry 와 Root.jsx
        # **두 곳**에 등록해야 했다. 한 곳만 등록하면 그 컷이 조용히 렌더에서
        # 빠지고 — 파일이 없다는 것만 QA 에 잡힌다. 실제로 #23·#120 이 그렇게
        # 통째로 사라졌다. MotionWrap 은 cardRegistry 한 곳만 보므로 이제 못 어긋난다.
        # motion 이 없으면 MotionShell 이 기본값(아주 느린 푸시인)으로 돈다.
        out.append((sc['id'], 'MotionWrap',
                    {'card': entry['card'], 'props': dict(entry['props']),
                     'motion': entry.get('motion') or {}},
                    dur, sc['key']))
    return out


def stale(out, props):
    """이미 있는 결과물이 **아직 쓸 만한가.**

    컨테이너가 스냅샷으로 되돌아가면 클립이 통째로 날아간다. 500MB 라
    저장소에 넣을 수도 없어서 다시 굽는 수밖에 없는데, 그때마다 269컷을
    처음부터 구우면 35분이다. 살아남은 것은 건너뛴다.

    무엇과 견주나: 결과물이 **설계(scene_props)보다 뒤에 만들어졌고**,
    그 컷이 쓰는 **소재 파일보다도 뒤**면 다시 구울 이유가 없다.
    그 컷이 쓰는 **카드 파일과 공용 파일**이 바뀌었으면 다시 굽는다 —
    남의 카드가 바뀐 것은 이 컷과 상관이 없다.
    """
    if not os.path.exists(out):
        return True
    made = os.path.getmtime(out)
    # 컴포지션 이름은 늘 'MotionWrap' 이다. 진짜 카드는 props 안에 있다 —
    # 인자로 받은 card 를 쓰면 언제나 MotionWrap.jsx 만 보게 된다
    for src in _watch_for(props.get('card')):
        if os.path.getmtime(src) > made:
            return True
    for name in re.findall(r'"([^"]+\.(?:jpg|jpeg|png|svg|webp|mp4|webm|mov))"',
                           json.dumps(props, ensure_ascii=False)):
        f = os.path.join(PUBLIC, name)
        if os.path.exists(f) and os.path.getmtime(f) > made:
            return True
    return False


def render(sid, card, props, dur, key, still, outdir, fresh=False, no_text=False):
    props = dict(props)
    props['durationSec'] = dur
    if no_text:
        props['hideText'] = True     # check_overlap.py 용 — 글자만 투명하게
    ext = 'png' if still else 'mp4'
    out = os.path.join(outdir, f'sec{sid:02d}_{key}.{ext}')
    if fresh and not stale(out, props):
        print(f'[건너뜀] #{sid:02d} {key:12s} 이미 최신', flush=True)
        return True
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(props, f, ensure_ascii=False)
        pp = f.name
    if still:
        # 모션이 다 자리잡은 시점(2.6초)에서 한 장
        cmd = ['npx', 'remotion', 'still', 'src/index.jsx', card, out,
               f'--props={pp}', f'--frame={min(int(dur * FPS) - 1, 78)}']
    else:
        # crf 18 은 사진을 꽉 채우는 카드에서 20Mbps 넘게 튄다. 편집 소스로는 과해서 20 으로.
        # (remotion 은 --crf 와 --video-bitrate 를 동시에 못 받는다. 상한이 필요한
        #  소수 카드는 렌더 후 ffmpeg 로 -maxrate 걸어 다시 인코딩한다.)
        cmd = ['npx', 'remotion', 'render', 'src/index.jsx', card, out,
               f'--props={pp}', '--codec=h264', '--crf=20']
    cmd += ['--gl=angle', f'--browser-executable={CHROME}', '--log=error']
    # ── 한 컷이 멎으면 렌더 전체가 멎는다 ─────────────────────────────
    # headless 크롬이 가끔 그대로 붙박인다. 같은 배치의 다른 컷은 40초에
    # 끝났는데 한 컷만 11분을 잡고 있었다 — 268컷 렌더에서 이러면 밤새
    # 아무것도 안 나온다. 정해진 시간이 지나면 죽이고 실패로 적는다
    try:
        r = subprocess.run(cmd, cwd=MOTION, capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        os.unlink(pp)
        print(f'[FAIL] #{sid} {card} — 300초 넘게 안 끝나 죽였다 (크롬 먹통)', flush=True)
        return False
    os.unlink(pp)
    if r.returncode != 0:
        print(f'[FAIL] #{sid} {card}\n{r.stderr[-600:]}', flush=True)
        return False
    print(f'[ok] #{sid:02d} {key:12s} {card:20s} {dur:5.1f}s  {os.path.getsize(out)//1024}KB', flush=True)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ids', nargs='*', type=int)
    ap.add_argument('--still', action='store_true')
    # 겹침 검사용. 같은 프레임을 글자만 끄고 한 장 더 굽는다 (stills_notext/)
    ap.add_argument('--no-text', action='store_true',
                    help='글자를 투명하게 한 스틸 (check_overlap.py 가 쓴다)')
    # 보통 스틸만 다시 굽고 글자 끈 스틸을 안 구우면 check_overlap 이 그 차이를
    # 전부 '글자'로 잡는다 — #49·#127 이 그렇게 헛걸렸다. 둘을 한 번에 굽는다
    ap.add_argument('--pair', action='store_true',
                    help='--still 에서 보통 스틸과 글자 끈 스틸을 둘 다 굽는다')
    # 되살릴 때 쓴다 — 살아남은 컷은 건너뛰고 없는 것만 굽는다
    ap.add_argument('--fresh', action='store_true',
                    help='이미 최신인 결과물은 건너뛴다 (스냅샷 복구용)')
    ap.add_argument('--project', default=DEFAULT_PROJECT)
    ap.add_argument('-j', '--jobs', type=int, default=0,
                    help='동시에 띄울 렌더 수 (기본: 코어-1, 최대 3)')
    a = ap.parse_args()
    if a.pair and a.still:
        # 같은 인자로 두 번 — 보통 · 글자 끔. 하나라도 실패하면 실패다
        import copy
        rc = 0
        for nt in (False, True):
            b = copy.copy(a); b.pair = False; b.no_text = nt
            rc |= _run(b)
        return rc
    return _run(a)


def _run(a):
    proj = os.path.join(ROOT, 'projects', a.project)
    outdir = os.path.join(proj, ('stills_notext' if a.no_text else 'stills') if a.still else 'clips')
    os.makedirs(outdir, exist_ok=True)
    scenes = [s for s in load(proj) if not a.ids or s[0] in a.ids]
    jobs = max(1, a.jobs or min(3, (os.cpu_count() or 2) - 1))
    if jobs > 1 and len(scenes) > 1:
        with ThreadPoolExecutor(max_workers=jobs) as ex:
            oks = list(ex.map(lambda s: render(*s, a.still, outdir, a.fresh, a.no_text), scenes))
        fails = [s[0] for s, ok in zip(scenes, oks) if not ok]
    else:
        fails = [s[0] for s in scenes if not render(*s, a.still, outdir, a.fresh, a.no_text)]
    print(('FAILS: ' + str(fails)) if fails else f'all ok ({len(scenes)} scenes) → {outdir}', flush=True)
    return 1 if fails else 0
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
