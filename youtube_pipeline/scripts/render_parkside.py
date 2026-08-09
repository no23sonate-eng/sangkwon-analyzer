#!/usr/bin/env python3
"""더 파크사이드 서울 — 32개 장면 렌더.

scene_plan.json (타이밍) + scene_props.json (카드·props) 를 합쳐 Remotion 으로 뽑는다.

    python3 youtube_pipeline/scripts/render_parkside.py            # 전부 mp4
    python3 youtube_pipeline/scripts/render_parkside.py --still    # 검수용 스틸(png)만
    python3 youtube_pipeline/scripts/render_parkside.py 0 3 13     # 특정 장면만
"""
import argparse, json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOTION = os.path.join(ROOT, 'motion')
DEFAULT_PROJECT = '더파크사이드서울'
CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
FPS = 30


def load(proj):
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
        motion = entry.get('motion')
        if motion:
            out.append((sc['id'], 'MotionWrap',
                        {'card': entry['card'], 'props': dict(entry['props']), 'motion': motion},
                        dur, sc['key']))
        else:
            out.append((sc['id'], entry['card'], dict(entry['props']), dur, sc['key']))
    return out


def render(sid, card, props, dur, key, still, outdir):
    props = dict(props)
    props['durationSec'] = dur
    ext = 'png' if still else 'mp4'
    out = os.path.join(outdir, f'sec{sid:02d}_{key}.{ext}')
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
    r = subprocess.run(cmd, cwd=MOTION, capture_output=True, text=True)
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
    ap.add_argument('--project', default=DEFAULT_PROJECT)
    a = ap.parse_args()

    proj = os.path.join(ROOT, 'projects', a.project)
    outdir = os.path.join(proj, 'stills' if a.still else 'clips')
    os.makedirs(outdir, exist_ok=True)
    scenes = [s for s in load(proj) if not a.ids or s[0] in a.ids]
    fails = [s[0] for s in scenes if not render(*s, a.still, outdir)]
    print(('FAILS: ' + str(fails)) if fails else f'all ok ({len(scenes)} scenes) → {outdir}', flush=True)
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
