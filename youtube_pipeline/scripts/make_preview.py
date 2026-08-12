#!/usr/bin/env python3
"""clips/*.mp4 를 순서대로 이어 붙여 미리보기 mp4 하나를 만든다.

프리미어 패키지(개별 클립 + XML)와 별개로, **눈으로 한 번에 확인할** 파일이 필요하다.
지금까지 이 작업을 매번 손으로 했다.

주의 두 가지 (둘 다 실제로 당한 것):
  1) `-video_track_timescale` 이 클립마다 다르면 concat 데먹서가 타임스탬프를 망가뜨려
     7분짜리가 41분으로 나온다. Remotion 출력에 맞춰 **90000 으로 통일**한다.
  2) 파일명 순서가 곧 편집 순서다. scene_plan.json 의 순서를 따르지,
     glob 정렬에 맡기지 않는다 (cut10 이 cut2 앞에 온다).

    python3 youtube_pipeline/scripts/make_preview.py 프로젝트명
"""
import argparse, json, os, subprocess, sys

import imageio_ffmpeg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = imageio_ffmpeg.get_ffmpeg_exe()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--crf', type=int, default=20)
    a = ap.parse_args()

    pdir = os.path.join(ROOT, 'projects', a.project)
    clips = os.path.join(pdir, 'clips')
    plan = json.load(open(os.path.join(pdir, 'scene_plan.json'), encoding='utf-8'))

    files = []
    for sc in plan['scenes']:
        # 카드가 먼저, 그 뒤에 실사. render_broll 은 접미사를 _b / _b1,_b2… 로 붙인다
        names = [f"sec{sc['id']:02d}_{sc['key']}.mp4", f"sec{sc['id']:02d}_{sc['key']}_b.mp4"]
        names += [f"sec{sc['id']:02d}_{sc['key']}_b{j}.mp4" for j in range(1, 5)]
        for name in names:
            p = os.path.join(clips, name)
            if os.path.exists(p):
                files.append(p)
    if not files:
        sys.exit(f'{clips} 에 클립이 없다.')

    lst = os.path.join(pdir, '_preview_list.txt')
    with open(lst, 'w', encoding='utf-8') as f:
        for p in files:
            f.write(f"file '{p}'\n")

    out = os.path.join(pdir, f'{a.project}_미리보기.mp4')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', str(a.crf),
                    '-pix_fmt', 'yuv420p', '-video_track_timescale', '90000', out], check=True)
    os.remove(lst)

    dur = subprocess.run([FF, '-i', out], capture_output=True, text=True).stderr
    print(f'{len(files)}개 클립 → {out}')
    print(f'  {os.path.getsize(out) // 1024 // 1024}MB')
    for ln in dur.splitlines():
        if 'Duration' in ln:
            print(' ', ln.strip())


if __name__ == '__main__':
    main()
