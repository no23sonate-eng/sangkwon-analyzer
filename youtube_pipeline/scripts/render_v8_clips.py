#!/usr/bin/env python3
"""v8 통합용 — 선별된 장면을 v2 카드 mp4로 렌더.

- 길이: v7 타임라인 XML의 clipitem <out> + 2프레임 여유 (XML 무수정 교체 목적)
- 출력: projects/하남스피어/broll_candidates/v2/sec{N}_{card}.mp4 (v7 원본 보존)
"""
import json, os, re, subprocess, sys, tempfile

BASE = '/home/user/sangkwon-analyzer/youtube_pipeline'
MOTION = os.path.join(BASE, 'motion')
PROJ = os.path.join(BASE, 'projects', '하남스피어')
XML = ('/tmp/claude-0/-home-user-sangkwon-analyzer/'
       '5ab6e313-332c-5aa7-a8b8-bd8d00e79058/scratchpad/premiere_xml_pkg/'
       '하남스피어_편집/하남스피어_타임라인.xml')
CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
if not os.path.exists(CHROME):
    CHROME = '/opt/pw-browsers/chromium/chrome-linux/chrome'

SWAP = [1, 2, 3, 5, 6, 8, 9, 11, 13, 16, 17, 18, 19, 20,
        23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 39, 41, 42]

xml = open(XML, encoding='utf-8').read()
# 섹션별 타임라인 소요 프레임 (<out>)
outs = {}
for m in re.finditer(r'<name>#(\d+) [^<]+</name>.*?<out>(\d+)</out>', xml):
    outs[int(m.group(1))] = int(m.group(2))

scenes = {s['id']: s for s in json.load(open(os.path.join(PROJ, 'v2_scenes.json'), encoding='utf-8'))['scenes']}
out_dir = os.path.join(PROJ, 'broll_candidates', 'v2')
os.makedirs(out_dir, exist_ok=True)

fails = []
for sid in SWAP:
    sc = scenes[sid]
    frames = outs[sid] + 2
    props = dict(sc['props'])
    props['durationSec'] = frames / 30.0
    out = os.path.join(out_dir, f"sec{sid}_{sc['card']}.mp4")
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(props, f, ensure_ascii=False)
        pp = f.name
    cmd = ['npx', 'remotion', 'render', 'src/index.jsx', sc['card'], out,
           f'--props={pp}', '--codec=h264', '--gl=angle',
           f'--browser-executable={CHROME}', '--log=error']
    r = subprocess.run(cmd, cwd=MOTION, capture_output=True, text=True)
    os.unlink(pp)
    if r.returncode != 0:
        print(f"[FAIL] sec{sid}: {r.stderr[-500:]}", flush=True)
        fails.append(sid)
    else:
        mb = os.path.getsize(out) / 1048576
        print(f"[ok] sec{sid:02d} {sc['card']} {frames}f {mb:.1f}MB", flush=True)

print(f"done: {len(SWAP)-len(fails)}/{len(SWAP)}" + (f" FAILS={fails}" if fails else ''), flush=True)
sys.exit(1 if fails else 0)
