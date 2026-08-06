#!/usr/bin/env python3
"""더 파크사이드 서울 — 프리미어 임포트용 FCP7 XML 생성.

scene_plan.json 의 start/end(초)를 그대로 타임라인 위치로 쓴다.
클립은 **파일명만** 참조하므로(`file://localhost/secNN_key.mp4`), 프리미어가
"미디어 찾기"를 띄우면 clips 폴더 하나만 지정하면 나머지는 자동으로 붙는다.

    python3 youtube_pipeline/scripts/build_parkside_xml.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = os.path.join(ROOT, 'projects', '더파크사이드서울')
FPS = 30
SEQ = '더파크사이드서울_타임라인'


def frames(sec):
    return int(round(sec * FPS))


def main():
    plan = json.load(open(os.path.join(PROJ, 'scene_plan.json'), encoding='utf-8'))
    clipdir = os.path.join(PROJ, 'clips')
    items, total = [], 0
    for i, sc in enumerate(plan['scenes']):
        name = f"sec{sc['id']:02d}_{sc['key']}.mp4"
        if not os.path.exists(os.path.join(clipdir, name)):
            print(f'[warn] 없음: {name}')
        start, end = frames(sc['start']), frames(sc['end'])
        dur = end - start
        total = max(total, end)
        items.append(
            f'<clipitem id="clip-{i}"><name>#{sc["id"]} {name}</name><enabled>TRUE</enabled>'
            f'<duration>{dur}</duration><rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate>'
            f'<start>{start}</start><end>{end}</end><in>0</in><out>{dur}</out>'
            f'<file id="file-{i}"><name>{name}</name>'
            f'<pathurl>file://localhost/{name}</pathurl>'
            f'<rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate><duration>{dur}</duration>'
            f'<media><video><samplecharacteristics>'
            f'<rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate>'
            f'<width>1920</width><height>1080</height></samplecharacteristics></video></media>'
            f'</file></clipitem>')

    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
<sequence id="seq-1">
  <name>{SEQ}</name>
  <duration>{total}</duration>
  <rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate>
  <media><video>
    <format><samplecharacteristics><rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate><width>1920</width><height>1080</height><pixelaspectratio>square</pixelaspectratio></samplecharacteristics></format>
    <track>{chr(10).join(items)}</track>
  </video><audio/></media>
</sequence>
</xmeml>
'''
    out = os.path.join(PROJ, f'{SEQ}.xml')
    open(out, 'w', encoding='utf-8').write(xml)
    print(f'{out}  — {len(items)}클립 / {total}프레임 ({total / FPS:.1f}초)')


if __name__ == '__main__':
    main()
