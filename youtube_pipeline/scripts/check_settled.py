#!/usr/bin/env python3
"""숫자가 다 안 자란 채 끝나는 컷을 찾는다.

#220 은 화면에 **40.9% 로 끝난다.** 실제 값은 42.6% 다. RatioCard 의
카운트업이 [16, 70] 프레임인데 이 컷은 2.2초(66프레임)라, 다 세기 전에
컷이 끝난다. 화면에 틀린 수가 나가는 것이고, **검수 시트로는 절대 못 잡는다** —
스틸은 프레임 78 을 굽는데 그건 이 컷에 존재하지도 않는 시점이다.

어떻게 보나
  카드 코드의 일정표를 읽지 않는다. 카드마다 다르고 고칠 때마다 낡는다.
  대신 **결과를 본다** — 클립의 끝 두 프레임을 견준다. 다 자랐으면 두 장이
  같고, 아직 자라는 중이면 다르다.

  실사 카드는 뺀다. 사진이 내내 아주 느리게 확대되므로 끝 두 장이 늘 다르다 —
  그건 설계이지 덜 자란 게 아니다.

    python3 scripts/check_settled.py 니시아자부
"""
import argparse
import io
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FF = 'ffmpeg'
# 사진이 주인공인 카드는 홀드 내내 느린 줌이 걸려 있다 — 끝까지 안 멎는다
PHOTO_CARDS = {
    'StageCard', 'ArchiveCard', 'PhotoSplitCard', 'FullBleedCard', 'MediaPlateCard',
    'PaperImageCard', 'SectionPhotoCard', 'AnnotatedShotCard', 'BeforeAfterCard',
    'PhotoStepsCard', 'TwoPanelCard', 'SplitProofCard',
}


def frame_at(path, t):
    out = subprocess.run(
        [FF, '-v', 'error', '-ss', f'{t:.3f}', '-i', str(path), '-frames:v', '1',
         '-f', 'image2pipe', '-vcodec', 'png', '-'],
        capture_output=True).stdout
    if not out:
        return None
    return np.asarray(Image.open(io.BytesIO(out)).convert('L'), dtype=np.int16)


def duration(path):
    o = subprocess.run([FF, '-i', str(path)], capture_output=True, text=True).stderr
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', o)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    # **평균으로 재면 안 된다.** 처음엔 화면 전체 평균 화소차를 봤는데
    # 0건이 나왔다 — #220 은 마지막 두 프레임에서 '40.7%' 가 '40.9%' 로
    # 바뀌는 게 전부라, 글자 몇백 화소가 200만 화소에 묻힌다.
    # **몇 개나 바뀌었나**를 센다
    ap.add_argument('--tol', type=int, default=200,
                    help='24 이상 바뀐 화소가 이보다 많으면 아직 움직이는 중')
    a = ap.parse_args()

    pdir = ROOT / 'projects' / a.project
    design = json.loads((pdir / 'design.json').read_text(encoding='utf-8'))['cuts']
    clips = sorted((pdir / 'clips').glob('*.mp4'),
                   key=lambda f: int(re.match(r'sec(\d+)', f.name).group(1)))
    if not clips:
        sys.exit(f'{pdir / "clips"} 에 클립이 없다 — 먼저 렌더해야 한다')

    bad, seen = [], 0
    for f in clips:
        sid = int(re.match(r'sec(\d+)', f.name).group(1))
        row = design.get(str(sid)) or ['', '', {}]
        card = row[0]
        if card in PHOTO_CARDS:
            continue
        props = row[2] if len(row) > 2 and isinstance(row[2], dict) else {}
        if props.get('media') or (props.get('bg') or {}).get('backdrop', '').endswith('.mp4'):
            continue                      # 배경 영상도 내내 움직인다
        dur = duration(f)
        if dur < 0.3:
            continue
        seen += 1
        b = frame_at(f, dur - 0.04)
        a2 = frame_at(f, dur - 0.20)
        if a2 is None or b is None:
            continue
        diff = int((np.abs(a2.astype(np.int32) - b.astype(np.int32)) > 24).sum())
        if diff > a.tol:
            bad.append((sid, card, dur, diff))

    print(f'{a.project} — 그래픽 컷 {seen}개 검사')
    if not bad:
        print('  끝까지 다 자란다')
        return 0
    for sid, card, dur, diff in bad:
        print(f'  #{sid:3d} {card:18s} {dur:.1f}s · 끝에서 화소 {diff:,}개가 바뀐다 '
              f'— 다 자라기 전에 끝난다')
    print(f'  걸린 컷 {len(bad)}개')
    return 1


if __name__ == '__main__':
    sys.exit(main())
