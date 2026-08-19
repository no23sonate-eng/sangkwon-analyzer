#!/usr/bin/env python3
"""프리미어 임포트용 FCP7 XML — **디스크의 클립을 그대로** 타임라인에 올린다.

기존 build_parkside_xml.py 는 `scene_plan.json` 의 start/end 를 타임라인 위치로
썼는데, 저건 **나레이션 기준 타임라인**이라 실제 렌더 길이와 다르다. 올리브영
성수편에서 27초가 어긋났고, 그 값을 믿었다가 마지막 여섯 컷이 영상 밖을
가리켰다. 파일명 규칙도 `sec{id}_{key}.mp4` 로 잡혀 있어 지금 산출물
(`sec{id}_cut{n}.mp4`) 과 안 맞았다.

그래서 이 스크립트는 **계획서를 안 믿는다.** clips 폴더의 실제 파일과 실제
길이를 재서 순서대로 이어 붙인다. 미리보기 영상과 프레임 단위로 같은 결과가
나오고, 어긋날 여지 자체가 없다.

    python3 scripts/build_premiere_xml.py --project 올리브영성수

프리미어에서 File ▸ Import 로 열면 미디어를 찾으라고 뜬다. clips 폴더 하나만
지정하면 나머지는 알아서 붙는다. 컷 이름은 `#12 …` 처럼 컷 번호가 앞에 붙어
있어서 검수 시트의 번호와 그대로 대응된다.
"""
import argparse, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
FF = ('/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/'
      'ffmpeg-linux-x86_64-v7.0.2')


def dur_sec(path):
    o = subprocess.run([FF, '-i', path], capture_output=True, text=True).stderr
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', o)
    if not m:
        return 0.0
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


def esc(t):
    return (str(t).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--project', default='올리브영성수')
    a = ap.parse_args()
    PROJ = os.path.join(ROOT, 'projects', a.project)
    SEQ = f'{a.project}_타임라인'
    clipdir = os.path.join(PROJ, 'clips')
    plan = json.load(open(os.path.join(PROJ, 'scene_plan.json'), encoding='utf-8'))
    props = json.load(open(os.path.join(PROJ, 'scene_props.json'),
                           encoding='utf-8'))['scenes']

    names = sorted(x for x in os.listdir(clipdir) if x.endswith('.mp4'))

    # 장면 순서대로, 그 장면에 속한 파일을 전부 (카드 + 실사 _b) 이어 붙인다
    cuts, cum = [], 0
    for i, sc in enumerate(plan['scenes']):
        sid = sc['id']
        mine = [x for x in names
                if re.match(rf'sec0*{sid}_cut0*{i + 1}(_b\d*)?\.mp4$', x)]
        if not mine:
            mine = [x for x in names if re.match(rf'sec0*{sid}_', x)]
        if not mine:
            print(f'[warn] #{sid} 클립 없음', file=sys.stderr)
            continue
        # 카드가 먼저, 실사(_b) 가 뒤 — 렌더러가 만드는 순서와 같다
        mine.sort(key=lambda x: ('_b' in x, x))
        p = props.get(str(sid)) or {}
        label = ((p.get('props') or {}).get('label')
                 or (p.get('props') or {}).get('title') or '')
        for f in mine:
            n = int(round(dur_sec(os.path.join(clipdir, f)) * FPS))
            if n <= 0:
                print(f'[warn] {f} 길이 0', file=sys.stderr)
                continue
            cuts.append((sid, f, cum, cum + n, label))
            cum += n

    items = []
    for i, (sid, name, start, end, label) in enumerate(cuts):
        n = end - start
        title = f'#{sid} {label}'.strip()
        items.append(
            f'<clipitem id="clip-{i}"><name>{esc(title)}</name><enabled>TRUE</enabled>'
            f'<duration>{n}</duration>'
            f'<rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate>'
            f'<start>{start}</start><end>{end}</end><in>0</in><out>{n}</out>'
            f'<file id="file-{i}"><name>{esc(name)}</name>'
            f'<pathurl>file://localhost/{esc(name)}</pathurl>'
            f'<rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate>'
            f'<duration>{n}</duration>'
            f'<media><video><samplecharacteristics>'
            f'<rate><timebase>{FPS}</timebase><ntsc>FALSE</ntsc></rate>'
            f'<width>1920</width><height>1080</height>'
            f'</samplecharacteristics></video></media></file>'
            # 컷 번호를 프리미어 마커로도 남긴다 — 검수 시트의 "#12" 로 바로 찾아간다
            f'<marker><name>{esc(title)}</name><in>0</in><out>-1</out></marker>'
            f'</clipitem>')

    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
<sequence id="seq-1">
  <name>{esc(SEQ)}</name>
  <duration>{cum}</duration>
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
    nb = sum(1 for c in cuts if re.search(r'_b\d*\.mp4$', c[1]))
    print(f'{out}\n  {len(items)}클립 (카드 {len(items) - nb} + 실사 {nb}) · '
          f'{cum}프레임 = {cum / FPS / 60:.0f}분 {cum / FPS % 60:.0f}초')


if __name__ == '__main__':
    main()
